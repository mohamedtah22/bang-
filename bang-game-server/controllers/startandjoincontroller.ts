import WebSocket from "ws";
import { Room } from "../models/room";
import { Player, Role, CharacterId, Card, CardKey } from "../models/player";
import { rooms, wsToRoom } from "./state";

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
  for (const p of room.players as any[]) safeSend(p.ws, obj);
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

/** لو كان داخل غرفة قبل، طلّعه */
function leaveIfInRoom(ws: any) {
  const info = wsToRoom.get(ws);
  if (!info) return;

  const room = rooms.get(info.roomCode);
  wsToRoom.delete(ws);
  if (!room) return;

  room.players = (room.players as any[]).filter((p) => p.id !== info.playerId);

  if (room.players.length < 4) room.ready = false;

  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }

  emitRoomUpdate(room);
}

/** ---------- lobby update ---------- */

function emitRoomUpdate(room: Room) {
  broadcastRoom(room, {
    type: "room_update",
    roomCode: room.code,
    playersCount: room.players.length,
    players: (room.players as any[]).map((p) => ({ id: p.id, name: p.name })),
    ready: room.ready,
    maxPlayers: room.maxPlayers,
  });

  if (room.ready) {
    broadcastRoom(room, { type: "room_ready", roomCode: room.code });
  }
}

/** ---------- game setup ---------- */

type GameRoom = Room & {
  started?: boolean;
  turnIndex?: number;
  deck?: Card[];
  discard?: Card[];

  // رح نستخدمهن في gameengine
  phase?: "main" | "waiting";
  pending?: any;
  bangsUsedThisTurn?: number;
};

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

const makeId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function buildDeck(): Card[] {
  const deck: Card[] = [];
  const add = (key: CardKey, count: number) => {
    for (let i = 0; i < count; i++) deck.push({ id: makeId(), key });
  };

  add("bang", 25);
  add("missed", 12);
  add("beer", 6);
  add("panic", 4);
  add("catbalou", 4);
  add("duel", 3);
  add("gatling", 2);
  add("indians", 2);
  add("stagecoach", 2);
  add("wellsfargo", 1);
  add("saloon", 1);

  add("jail", 3);
  add("dynamite", 1);

  add("weapon", 4);
  add("barrel", 2);
  add("mustang", 2);
  add("scope", 1);

  return shuffle(deck);
}

function drawCard(room: GameRoom): Card {
  room.deck ??= [];
  room.discard ??= [];

  if (room.deck.length === 0) {
    room.deck = shuffle(room.discard);
    room.discard = [];
  }

  const c = room.deck.pop();
  if (!c) throw new Error("No cards left");
  return c;
}

/** ---------- handlers ---------- */

export function handleCreate(ws: any, payload: { name?: string }) {
  const playerId = ensureWsId(ws);
  leaveIfInRoom(ws);

  const name = (payload.name || "Host").trim() || "Host";

  let code = makeCode();
  while (rooms.has(code)) code = makeCode();

  const room: Room = {
    code,
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
  const room = rooms.get(code);
  if (!room) return safeSend(ws, { type: "error", message: "Room not found" });
  if (room.players.length >= room.maxPlayers)
    return safeSend(ws, { type: "error", message: "Room is full" });

  const wanted = (payload.name || "Player").trim() || "Player";
  const name = uniqueName(room, wanted);

  const existing = (room.players as any[]).find((p) => p.id === playerId);

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

  const room = rooms.get(info.roomCode) as GameRoom;
  if (!room) return;

  const n = room.players.length;
  if (n < 4) return safeSend(ws, { type: "error", message: "Not enough players to start the game" });
  if (n > 7) return safeSend(ws, { type: "error", message: "Too many players (max 7)" });
  if (room.started) return;

  const hostId = (room.players as any[])[0]?.id;
  if (hostId && info.playerId !== hostId) {
    return safeSend(ws, { type: "error", message: "Only host can start" });
  }

  room.started = true;

  room.deck = buildDeck();
  room.discard = [];

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

    for (let k = 0; k < p.maxHp; k++) {
      p.hand.push(drawCard(room));
    }
  }

  room.turnIndex = (room.players as any[]).findIndex((p: Player) => p.role === "sheriff");
  if (room.turnIndex < 0) room.turnIndex = 0;

  // runtime for engine
  room.phase = "main";
  room.pending = null;
  room.bangsUsedThisTurn = 0;

  broadcastRoom(room, {
    type: "game_state",
    roomCode: room.code,
    turnPlayerId: (room.players as any[])[room.turnIndex]?.id,
    players: (room.players as any[]).map((p: Player) => ({
      id: p.id,
      name: p.name,

      // إذا بدك تخبي الأدوار للجميع:
      // role: p.role === "sheriff" ? "sheriff" : "hidden",
      role: p.role,

      playcharacter: p.playcharacter,
      hp: p.hp,
      maxHp: p.maxHp,
      isAlive: p.isAlive,
      equipment: p.equipment,
      handCount: p.hand.length,
    })),
    phase: room.phase,
    pending: room.pending,
  });

  for (const p of room.players as any[]) {
    safeSend(p.ws, {
      type: "me_state",
      roomCode: room.code,
      me: {
        id: p.id,
        name: p.name,
        role: p.role, 
        playcharacter: p.playcharacter,
        hp: p.hp,
        maxHp: p.maxHp,
        isAlive: p.isAlive,
        equipment: p.equipment,
        hand: p.hand,
      },
    });
  }

  broadcastRoom(room, { type: "started", roomCode: room.code });
}
