import WebSocket from "ws";
import { rooms, wsToRoom } from "./state";
import type { Room } from "../models/room";
import type { Player, Card } from "../models/player";

const TURN_MS = 30_000;     
const RESPONSE_MS = 12_000;  

type Phase = "main" | "waiting";
type Pending = { kind: "bang"; attackerId: string; targetId: string } | null;

type GameRoom = Room & {
  started?: boolean;
  turnIndex?: number;

  deck?: Card[];
  discard?: Card[];

  phase?: Phase;
  pending?: Pending;

  bangsUsedThisTurn?: number;

  /** timers */
  turnEndsAt?: number;       
  pendingEndsAt?: number;    
};

function safeSend(ws: any, obj: any) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}

function broadcastRoom(room: GameRoom, obj: any) {
  for (const p of room.players as any[]) safeSend((p as Player).ws, obj);
}

function ensureRuntime(room: GameRoom) {
  room.deck ??= [];
  room.discard ??= [];
  room.turnIndex ??= 0;

  room.phase ??= "main";
  room.pending ??= null;

  room.bangsUsedThisTurn ??= 0;

}

function getRoomByWs(ws: any): GameRoom | null {
  const info = wsToRoom.get(ws);
  if (!info) return null;

  const room = rooms.get(info.roomCode) as GameRoom | undefined;
  if (!room) return null;

  ensureRuntime(room);
  return room;
}

function getPlayer(room: GameRoom, id: string): Player | undefined {
  return (room.players as any[]).find((p: Player) => p.id === id);
}

function currentPlayer(room: GameRoom): Player {
  return (room.players as any[])[room.turnIndex ?? 0] as Player;
}

function assertMyTurn(room: GameRoom, playerId: string) {
  const cur = currentPlayer(room);
  if (!cur || cur.id !== playerId) throw new Error("Not your turn");
  if (!cur.isAlive) throw new Error("You are dead");
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function discard(room: GameRoom, c: Card) {
  room.discard ??= [];
  room.discard.push(c);
}

function popCardFromHand(p: Player, cardId: string): Card {
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new Error("Card not in hand");
  const [c] = p.hand.splice(idx, 1);
  return c;
}

function applyDamage(room: GameRoom, target: Player, amount: number) {
  target.hp -= amount;

  if (target.hp <= 0) {
    target.hp = 0;
    target.isAlive = false;

    for (const c of target.hand) discard(room, c);
    for (const c of target.equipment) discard(room, c);
    target.hand = [];
    target.equipment = [];
  }
}

function nextAliveIndex(room: GameRoom, from: number) {
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    const p = (room.players as any[])[i] as Player;
    if (p?.isAlive) return i;
  }
  return from;
}

/** ====== broadcasting state ====== */
function broadcastGameState(room: GameRoom) {
  const turnPlayerId = currentPlayer(room)?.id;

  broadcastRoom(room, {
    type: "game_state",
    roomCode: room.code,
    turnPlayerId,
    phase: room.phase,
    pending: room.pending,
    turnEndsAt: room.turnEndsAt,       
    pendingEndsAt: room.pendingEndsAt, 
    players: (room.players as any[]).map((p: Player) => ({
      id: p.id,
      name: p.name,
      role: p.role, //  
      playcharacter: p.playcharacter,
      hp: p.hp,
      maxHp: p.maxHp,
      isAlive: p.isAlive,
      equipment: p.equipment,
      handCount: p.hand.length,
    })),
  });
}

function broadcastMeStates(room: GameRoom) {
  for (const p of room.players as any[]) {
    const me = p as Player;
    safeSend(me.ws, {
      type: "me_state",
      roomCode: room.code,
      me: {
        id: me.id,
        name: me.name,
        role: me.role,
        playcharacter: me.playcharacter,
        hp: me.hp,
        maxHp: me.maxHp,
        isAlive: me.isAlive,
        equipment: me.equipment,
        hand: me.hand,
      },
    });
  }
}

function startTurn(room: GameRoom) {
  ensureRuntime(room);

  const cur = currentPlayer(room);
  if (!cur?.isAlive) {
    room.turnIndex = nextAliveIndex(room, room.turnIndex ?? 0);
  }

  room.phase = "main";
  room.pending = null;
  room.pendingEndsAt = undefined;
  room.bangsUsedThisTurn = 0;

  const now = Date.now();
  const player = currentPlayer(room);
  player.hand.push(drawCard(room));
  player.hand.push(drawCard(room));

  room.turnEndsAt = now + TURN_MS;

  broadcastRoom(room, {
    type: "turn_started",
    roomCode: room.code,
    turnPlayerId: player.id,
    turnEndsAt: room.turnEndsAt,
  });
}

function advanceTurn(room: GameRoom, reason: "manual" | "timeout") {
  ensureRuntime(room);

  if (room.phase !== "main") return;

  const prev = currentPlayer(room);
  room.turnIndex = nextAliveIndex(room, room.turnIndex ?? 0);

  startTurn(room);

  broadcastRoom(room, {
    type: "turn_ended",
    roomCode: room.code,
    reason,
    prevPlayerId: prev?.id,
    nextPlayerId: currentPlayer(room)?.id,
  });

  broadcastGameState(room);
  broadcastMeStates(room);
}



setInterval(() => {
  const now = Date.now();

  for (const r of rooms.values()) {
    const room = r as GameRoom;
    if (!room.started) continue;

    ensureRuntime(room);

    if (room.phase === "waiting" && room.pending && room.pendingEndsAt && now >= room.pendingEndsAt) {
      const pend = room.pending;
      const target = getPlayer(room, pend.targetId);

      if (target && target.isAlive) {
        applyDamage(room, target, 1);
      }

      room.pending = null;
      room.phase = "main";
      room.pendingEndsAt = undefined;

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "bang_timeout_hit",
        attackerId: pend.attackerId,
        targetId: pend.targetId,
      });

      broadcastGameState(room);
      broadcastMeStates(room);
    }

    if (room.phase === "main" && room.turnEndsAt && now >= room.turnEndsAt) {
      advanceTurn(room, "timeout");
    }
  }
}, 500);

/** ================= handlers ================= */

export function handlePlayCard(ws: any, payload: { cardId?: string; targetId?: string; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started) return safeSend(ws, { type: "error", message: "Game not started" });

  const info = wsToRoom.get(ws)!;

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  try {
    ensureRuntime(room);

    if (room.phase !== "main") throw new Error("Wait for the pending action");
    assertMyTurn(room, me.id);

    if (!payload.cardId) throw new Error("Missing cardId");
    const card = popCardFromHand(me, payload.cardId);

    /** ===== BANG ===== */
    if (card.key === "bang") {
      if (!payload.targetId) throw new Error("Missing targetId");
      const target = getPlayer(room, payload.targetId);
      if (!target || !target.isAlive) throw new Error("Bad target");
      if (target.id === me.id) throw new Error("Can't target yourself");

      room.bangsUsedThisTurn ??= 0;
      if (room.bangsUsedThisTurn >= 1) throw new Error("Only 1 BANG per turn (for now)");
      room.bangsUsedThisTurn++;

      discard(room, card);

      room.phase = "waiting";
      room.pending = { kind: "bang", attackerId: me.id, targetId: target.id };
      room.pendingEndsAt = Date.now() + RESPONSE_MS; 
      safeSend(target.ws, {
        type: "action_required",
        roomCode: room.code,
        kind: "respond_to_bang",
        fromPlayerId: me.id,
        pendingEndsAt: room.pendingEndsAt,
      });

      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== BEER ===== */
    if (card.key === "beer") {
      me.hp = Math.min(me.maxHp, me.hp + 1);

      discard(room, card);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** باقي الكروت placeholder */
    discard(room, card);
    broadcastGameState(room);
    broadcastMeStates(room);
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Bad action" });
  }
}

export function handleRespond(ws: any, payload: { cardId?: string; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;
  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  try {
    ensureRuntime(room);

    if (room.phase !== "waiting" || !room.pending) throw new Error("No pending action");
    const pend = room.pending;

    if (pend.kind !== "bang") throw new Error("Unsupported pending");
    if (pend.targetId !== me.id) throw new Error("Not your response");
    if (!me.isAlive) throw new Error("You are dead");

    if (payload.cardId) {
      const c = popCardFromHand(me, payload.cardId);
      if (c.key !== "missed") throw new Error("This response requires MISSED");
      discard(room, c);

      room.pending = null;
      room.phase = "main";
      room.pendingEndsAt = undefined;

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "bang_missed",
        attackerId: pend.attackerId,
        targetId: pend.targetId,
      });

      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    applyDamage(room, me, 1);

    room.pending = null;
    room.phase = "main";
    room.pendingEndsAt = undefined;

    broadcastRoom(room, {
      type: "action_resolved",
      roomCode: room.code,
      kind: "bang_hit",
      attackerId: pend.attackerId,
      targetId: pend.targetId,
      newHp: me.hp,
      isAlive: me.isAlive,
    });

    broadcastGameState(room);
    broadcastMeStates(room);
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Bad response" });
  }
}

export function handleEndTurn(ws: any, payload?: { roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload?.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;

  try {
    ensureRuntime(room);

    if (room.phase !== "main") throw new Error("Can't end turn now");
    assertMyTurn(room, info.playerId);

    advanceTurn(room, "manual");
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Can't end turn" });
  }
}
