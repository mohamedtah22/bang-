// controllers/room.ts
import WebSocket from "ws";
import { Room } from "../models/room";
import { Player, Role, CharacterId, Card } from "../models/player";
import { rooms, wsToRoom } from "./state";
import { startTurn } from "./gameengine"; // ✅ كان startFirstTurn

/** ---------- utils ---------- */

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ2345678901";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function normalizeCode(code: string) {
  return String(code || "").toUpperCase().trim();
}

function safeSend(ws: any, obj: any) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}

function broadcastRoom(room: Room, obj: any) {
  for (const p of room.players as any[]) safeSend((p as Player).ws, obj);
}

function ensureWsId(ws: any) {
  if (!ws._id) ws._id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return ws._id as string;
}

function uniqueName(room: Room, base: string) {
  const raw = (base || "Player").trim() || "Player";
  const taken = new Set((room.players as any[]).map((p) => p.name));
  if (!taken.has(raw)) return raw;

  let i = 2;
  while (taken.has(`${raw}${i}`)) i++;
  return `${raw}${i}`;
}

/** ---------- lobby/game room type ---------- */

type GameRoom = Room & {
  hostId?: string;
  started?: boolean;

  // engine runtime + cards runtime
  turnIndex?: number;
  deck?: Card[];
  discard?: Card[];

  phase?: "main" | "waiting";
  pending?: any;
  bangsUsedThisTurn?: number;
};

/** لو كان داخل غرفة قبل، طلّعه */
function leaveIfInRoom(ws: any) {
  const info = wsToRoom.get(ws);
  if (!info) return;

  const room = rooms.get(info.roomCode) as GameRoom | undefined;
  wsToRoom.delete(ws);
  if (!room) return;

  const idx = (room.players as any[]).findIndex((p: Player) => p.id === info.playerId);
  if (idx < 0) return;

  // ✅ إذا اللعبة بدأت: ما تشيل اللاعب من المصفوفة (عشان محرك اللعبة ما ينكسر)
  if (room.started) {
    const p = (room.players as any[])[idx] as any;
    p.ws = undefined;
    p.disconnected = true;

    broadcastRoom(room, {
      type: "player_disconnected",
      roomCode: room.code,
      playerId: p.id,
      name: p.name,
    });

    return;
  }

  // lobby only: remove normally
  const leaving = (room.players as any[])[idx] as Player;
  (room.players as any[]).splice(idx, 1);

  if ((room.players as any[]).length < 4) room.ready = false;

  if ((room.players as any[]).length === 0) {
    rooms.delete(room.code);
    return;
  }

  // ✅ إذا الهوست طلع: عيّن هوست جديد
  if (room.hostId && room.hostId === leaving.id) {
    room.hostId = (room.players as any[])[0]?.id;
  }

  emitRoomUpdate(room);
}

/** ---------- lobby update ---------- */

function emitRoomUpdate(room: GameRoom) {
  broadcastRoom(room, {
    type: "room_update",
    roomCode: room.code,
    playersCount: room.players.length,
    players: (room.players as any[]).map((p) => ({ id: p.id, name: p.name })),
    ready: room.ready,
    maxPlayers: room.maxPlayers,
    started: !!room.started,
    hostId: room.hostId,
  });

  if (room.ready && !room.started) {
    broadcastRoom(room, { type: "room_ready", roomCode: room.code });
  }
}

/** ---------- game setup helpers ---------- */

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rolesFor(n: number): Role[] {
  if (n === 4) return ["sheriff", "outlaw", "outlaw", "renegade"];
  if (n === 5) return ["sheriff", "outlaw", "outlaw", "renegade", "deputy"];
  if (n === 6) return ["sheriff", "outlaw", "outlaw", "outlaw", "renegade", "deputy"];
  if (n === 7) return ["sheriff", "outlaw", "outlaw", "outlaw", "renegade", "deputy", "deputy"];
  throw new Error("Supported players: 4-7");
}

const CHARACTER_IDS: CharacterId[] = [
  "bart_cassidy",
  "black_jack",
  "calamity_janet",
  "el_gringo",
  "jesse_jones",
  "jourdonnais",
  "kit_carlson",
  "lucky_duke",
  "paul_regret",
  "pedro_ramirez",
  "rose_doolan",
  "sid_ketchum",
  "slab_the_killer",
  "suzy_lafayette",
  "vulture_sam",
  "willy_the_kid",
];

const CHARACTER_HP: Record<CharacterId, number> = {
  bart_cassidy: 4,
  black_jack: 4,
  calamity_janet: 4,
  el_gringo: 3,
  jesse_jones: 4,
  jourdonnais: 4,
  kit_carlson: 4,
  lucky_duke: 4,
  paul_regret: 3,
  pedro_ramirez: 4,
  rose_doolan: 4,
  sid_ketchum: 4,
  slab_the_killer: 4,
  suzy_lafayette: 4,
  vulture_sam: 4,
  willy_the_kid: 4,
};

// ✅ suits/ranks ثابتين لآليات Draw!
const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

function buildDefaultDeck(): Card[] {
  let id = 0;
  let meta = 0;

  const mk = (key: string, extra: any = {}): Card => {
    const suit = SUITS[meta % SUITS.length];
    const rank = RANKS[Math.floor(meta / SUITS.length) % RANKS.length];
    meta++;

    return {
      id: `card_${Date.now()}_${id++}_${Math.random().toString(16).slice(2)}`,
      key,
      suit,
      rank,
      ...extra,
    } as any;
  };

  const deck: Card[] = [];

  const pushMany = (key: string, count: number, extra?: any) => {
    for (let i = 0; i < count; i++) deck.push(mk(key, extra));
  };

  // --- actions (تقريب للـ base game) ---
  pushMany("bang", 25);
  pushMany("missed", 12);
  pushMany("beer", 6);
  pushMany("stagecoach", 2);
  pushMany("wellsfargo", 1);
  pushMany("saloon", 1);
  pushMany("panic", 4);
  pushMany("catbalou", 4);
  pushMany("indians", 2);
  pushMany("gatling", 1);
  pushMany("duel", 3);

  // --- equipment ---
  pushMany("barrel", 2);
  pushMany("mustang", 2);
  pushMany("scope", 1);
  pushMany("jail", 3);
  pushMany("dynamite", 1);

  // --- weapons (card.key لازم يكون "weapon") ---
  pushMany("weapon", 2, { weaponName: "volcanic", range: 1 });
  pushMany("weapon", 3, { weaponName: "schofield", range: 2 });
  pushMany("weapon", 2, { weaponName: "remington", range: 3 });
  pushMany("weapon", 2, { weaponName: "carabine", range: 4 });
  pushMany("weapon", 1, { weaponName: "winchester", range: 5 });

  return deck;
}

function initDeckAndDeal(room: GameRoom) {
  room.discard = [];
  room.deck = shuffle(buildDefaultDeck());

  for (const pAny of room.players as any[]) {
    const p = pAny as Player;
    p.hand = [];
    p.equipment = [];

    // ✅ توزيع أولي: عدد كروت = HP (maxHp)
    for (let i = 0; i < p.maxHp; i++) {
      const c = room.deck.pop();
      if (!c) throw new Error("Deck is empty during initial deal");
      p.hand.push(c as any);
    }
  }
}

/** ---------- handlers ---------- */

export function handleCreate(ws: any, payload: { name?: string }) {
  const playerId = ensureWsId(ws);
  leaveIfInRoom(ws);

  const name = (payload.name || "Host").trim() || "Host";

  let code = makeCode();
  while (rooms.has(code)) code = makeCode();

  const room: GameRoom = {
    code,
    hostId: playerId,
    started: false,

    players: [
      {
        id: playerId,
        name,
        ws,
        role: "outlaw",
        playcharacter: "bart_cassidy",
        hp: 0,
        maxHp: 0,
        hand: [],
        equipment: [],
        isAlive: true,
      } as Player,
    ],
    ready: false,
    maxPlayers: 7,
  };

  rooms.set(code, room);
  wsToRoom.set(ws, { roomCode: code, playerId });

  safeSend(ws, { type: "created", roomCode: code });
  emitRoomUpdate(room);
}

export function handleJoin(ws: any, payload: { roomCode?: string; name?: string }) {
  const playerId = ensureWsId(ws);
  leaveIfInRoom(ws);

  const code = normalizeCode(payload.roomCode || "");
  const room = rooms.get(code) as GameRoom | undefined;
  if (!room) return safeSend(ws, { type: "error", message: "Room not found" });

  if (room.started) return safeSend(ws, { type: "error", message: "Game already started" });

  if (room.players.length >= room.maxPlayers)
    return safeSend(ws, { type: "error", message: "Room is full" });

  const wanted = (payload.name || "Player").trim() || "Player";
  const name = uniqueName(room, wanted);

  const existing = (room.players as any[]).find((p) => p.id === playerId) as Player | undefined;

  if (!existing) {
    room.players.push({
      id: playerId,
      name,
      ws,
      role: "outlaw",
      playcharacter: "bart_cassidy",
      hp: 0,
      maxHp: 0,
      hand: [],
      equipment: [],
      isAlive: true,
    } as Player);
  } else {
    existing.ws = ws;
    existing.name = name;
  }

  wsToRoom.set(ws, { roomCode: code, playerId });

  safeSend(ws, { type: "joined", roomCode: code });

  room.ready = room.players.length >= 4;
  emitRoomUpdate(room);
}

export function handleLeave(ws: any) {
  leaveIfInRoom(ws);
}

export function handleDisconnect(ws: any) {
  leaveIfInRoom(ws);
}

export function handleStart(ws: any) {
  const info = wsToRoom.get(ws);
  if (!info) return;

  const room = rooms.get(info.roomCode) as GameRoom | undefined;
  if (!room) return;

  const n = room.players.length;
  if (n < 4) return safeSend(ws, { type: "error", message: "Not enough players to start the game" });
  if (n > 7) return safeSend(ws, { type: "error", message: "Too many players (max 7)" });
  if (room.started) return;

  // ✅ هوست ثابت
  if (room.hostId && info.playerId !== room.hostId) {
    return safeSend(ws, { type: "error", message: "Only host can start" });
  }

  room.started = true;

  const roles = shuffle(rolesFor(n));
  const chars = shuffle([...CHARACTER_IDS]).slice(0, n);

  for (let i = 0; i < n; i++) {
    const p = (room.players as any[])[i] as Player;

    p.role = roles[i];
    p.playcharacter = chars[i];

    const baseHp = CHARACTER_HP[p.playcharacter];
    p.maxHp = baseHp + (p.role === "sheriff" ? 1 : 0);
    p.hp = p.maxHp;

    p.isAlive = true;
    p.equipment = [];
    p.hand = [];
  }

  // sheriff يبدأ
  room.turnIndex = (room.players as any[]).findIndex((p: Player) => p.role === "sheriff");
  if (room.turnIndex < 0) room.turnIndex = 0;

  // runtime fields
  room.phase = "main";
  room.pending = null;
  room.bangsUsedThisTurn = 0;

  // ✅ جهّز الدك + وزّع أولي
  try {
    initDeckAndDeal(room);
  } catch (e: any) {
    room.started = false;
    return safeSend(ws, { type: "error", message: e?.message || "Failed to init deck" });
  }

  // ✅ خلي الواجهة تنتقل أولاً
  broadcastRoom(room, { type: "started", roomCode: room.code });

  // ✅ ابدأ أول دور (dynamite/jail/draw... + timers)
  setTimeout(() => {
    try {
      startTurn(room as any);
    } catch (e: any) {
      broadcastRoom(room, { type: "error", message: e?.message || "Failed to start turn" });
    }
  }, 50);
}
