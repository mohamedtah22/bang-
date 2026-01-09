// controllers/gameengine.ts
import WebSocket from "ws";
import { rooms, wsToRoom } from "./state";
import type { Room } from "../models/room";
import type { Player, Card } from "../models/player";

const TURN_MS = 30_000;
const RESPONSE_MS = 12_000;

type Phase = "main" | "waiting";

const CHAR = {
  bart: "bart_cassidy",
  blackjack: "black_jack",
  calamity: "calamity_janet",
  elgringo: "el_gringo",
  jesse: "jesse_jones",
  jourd: "jourdonnais",
  kit: "kit_carlson",
  lucky: "lucky_duke",
  paul: "paul_regret",
  pedro: "pedro_ramirez",
  rose: "rose_doolan",
  sid: "sid_ketchum",
  slab: "slab_the_killer",
  suzy: "suzy_lafayette",
  vulture: "vulture_sam",
  willy: "willy_the_kid",
} as const;

function charId(p: Player): string {
  return String((p as any).playcharacter ?? "").toLowerCase();
}
function isChar(p: Player, id: string) {
  return charId(p) === id;
}

type Pending =
  | {
      kind: "bang";
      attackerId: string;
      targetId: string;
      requiredMissed: number; 
      missedSoFar: number;
    }
  | {
      kind: "indians";
      attackerId: string;
      targets: string[];
      idx: number;
    }
  | {
      kind: "gatling";
      attackerId: string;
      targets: string[];
      idx: number;
    }
  | {
      kind: "duel";
      initiatorId: string;
      targetId: string;
      responderId: string; // who must play "bang" now
    }
  | {
      kind: "draw_choice"; // Kit Carlson
      playerId: string;
      offered: Card[];
      pickCount: number; // 2
    }
  | {
      kind: "jesse_choice"; // Jesse Jones draw first
      playerId: string;
      eligibleTargets: string[];
    }
  | {
      kind: "pedro_choice"; // Pedro Ramirez draw first
      playerId: string;
      canUseDiscard: boolean;
    }
  | {
      kind: "discard_limit"; // end turn: discard down to hp
      playerId: string;
      need: number;
      after: "end_turn_manual";
    }
  | null;

type GameRoom = Room & {
  started?: boolean;
  ended?: boolean;

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
  for (const p of (room.players as any[]) || []) safeSend((p as any)?.ws, obj);
}

function ensurePlayerRuntime(p: any) {
  p.hand ??= [];
  p.equipment ??= [];
  p.isAlive = p.isAlive ?? true;

  // hp/maxHp defaults (لو ناقصين)
  if (typeof p.maxHp !== "number") p.maxHp = 4;
  if (typeof p.hp !== "number") p.hp = p.maxHp;
  if (p.hp > p.maxHp) p.hp = p.maxHp;

  // role/playcharacter ممكن يضلوا زي ما هم (ما بفرض عليهم)
  p.role = p.role ?? "outlaw";
  p.playcharacter = p.playcharacter ?? "";
}

function ensureRuntime(room: GameRoom) {
  room.players ??= [];
  for (const p of room.players as any[]) ensurePlayerRuntime(p);

  room.deck ??= [];
  room.discard ??= [];
  room.turnIndex ??= 0;

  room.phase ??= "main";
  room.pending ??= null;

  room.bangsUsedThisTurn ??= 0;
  room.ended ??= false;
}

/** Make sure suit/rank exist for Draw! mechanics */
const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"] as const;

function ensureCardMeta(c: Card): Card {
  const suit = (c as any).suit ?? SUITS[Math.floor(Math.random() * SUITS.length)];
  const rank = (c as any).rank ?? RANKS[Math.floor(Math.random() * RANKS.length)];
  return { ...c, suit, rank } as any;
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
    // reshuffle discard into deck
    if (room.discard.length === 0) throw new Error("No cards left (deck+discard empty)");
    room.deck = shuffle(room.discard.map(ensureCardMeta));
    room.discard = [];
  }

  const c = room.deck.pop();
  if (!c) throw new Error("No cards left");
  return ensureCardMeta(c);
}

function discard(room: GameRoom, c: Card) {
  room.discard ??= [];
  room.discard.push(ensureCardMeta(c));
}

function popCardFromHand(p: Player, cardId: string): Card {
  (p as any).hand ??= [];
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new Error("Card not in hand");
  const [c] = p.hand.splice(idx, 1);
  return ensureCardMeta(c);
}

function equipmentHas(p: Player, key: string) {
  (p as any).equipment ??= [];
  return Array.isArray(p.equipment) && p.equipment.some((c) => String((c as any)?.key) === key);
}
function takeEquipment(p: Player, key: string): Card | null {
  (p as any).equipment ??= [];
  const idx = p.equipment.findIndex((c) => String((c as any)?.key) === key);
  if (idx < 0) return null;
  const [c] = p.equipment.splice(idx, 1);
  return c ? ensureCardMeta(c) : null;
}
function replaceUniqueEquipment(room: GameRoom, p: Player, key: string, newCard: Card) {
  const old = takeEquipment(p, key);
  if (old) discard(room, old);
  (p as any).equipment ??= [];
  p.equipment.push(newCard);
}

/** ===== alive helpers ===== */
function alivePlayers(room: GameRoom): Player[] {
  return (room.players as any[]).filter((p: Player) => p?.isAlive);
}
function aliveCount(room: GameRoom): number {
  return alivePlayers(room).length;
}

/** ===== distance & range ===== */
function nextAliveIndex(room: GameRoom, from: number) {
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    const p = (room.players as any[])[i] as Player;
    if (p?.isAlive) return i;
  }
  return -1;
}

function seatDistanceAlive(room: GameRoom, fromId: string, toId: string): number {
  if (fromId === toId) return 0;

  const arr = room.players as any[];
  const fromIdx = arr.findIndex((p: Player) => p.id === fromId);
  const toIdx = arr.findIndex((p: Player) => p.id === toId);
  if (fromIdx < 0 || toIdx < 0) return 999;

  // clockwise
  let stepsCW = 0;
  let cur = fromIdx;
  while (stepsCW < arr.length) {
    const nxt = nextAliveIndex(room, cur);
    if (nxt < 0) break;
    cur = nxt;
    stepsCW++;
    if ((arr[cur] as Player).id === toId) break;
  }

  // counter-clockwise
  let stepsCCW = 0;
  cur = fromIdx;
  while (stepsCCW < arr.length) {
    // previous alive
    let found = -1;
    for (let k = 1; k <= arr.length; k++) {
      const j = (cur - k + arr.length) % arr.length;
      const p = arr[j] as Player;
      if (p?.isAlive) {
        found = j;
        break;
      }
    }
    if (found < 0) break;
    cur = found;
    stepsCCW++;
    if ((arr[cur] as Player).id === toId) break;
  }

  return Math.min(stepsCW || 999, stepsCCW || 999);
}

function weaponRange(p: Player): number {
  (p as any).equipment ??= [];
  const w = p.equipment.find((c) => String((c as any)?.key) === "weapon") as any;
  if (!w) return 1;

  if (typeof w.range === "number") return Math.max(1, Math.min(5, w.range));

  const wKey = String(w.weaponKey ?? w.weaponName ?? w.name ?? "").toLowerCase();

  if (wKey.includes("volcanic")) return 1;
  if (wKey.includes("schofield")) return 2;
  if (wKey.includes("remington")) return 3;
  if (wKey.includes("carabine")) return 4;
  if (wKey.includes("winchester")) return 5;

  return 1;
}

function hasVolcanic(p: Player): boolean {
  (p as any).equipment ??= [];
  const w = p.equipment.find((c) => String((c as any)?.key) === "weapon") as any;
  const wKey = String(w?.weaponKey ?? w?.weaponName ?? w?.name ?? "").toLowerCase();
  return wKey.includes("volcanic");
}

function effectiveDistance(room: GameRoom, from: Player, to: Player): number {
  let d = seatDistanceAlive(room, from.id, to.id);

  // target makes itself farther
  if (equipmentHas(to, "mustang")) d += 1;
  if (isChar(to, CHAR.paul)) d += 1;

  // attacker makes targets closer
  if (equipmentHas(from, "scope")) d -= 1;
  if (isChar(from, CHAR.rose)) d -= 1;

  if (d < 1) d = 1;
  return d;
}

function canShootBang(room: GameRoom, attacker: Player, target: Player): boolean {
  const d = effectiveDistance(room, attacker, target);
  const r = weaponRange(attacker);
  return d <= r;
}

function maxBangsPerTurn(p: Player): number {
  if (isChar(p, CHAR.willy)) return 999;
  if (hasVolcanic(p)) return 999;
  return 1;
}

function requiredMissedForBang(attacker: Player): number {
  return isChar(attacker, CHAR.slab) ? 2 : 1;
}

/** Calamity Janet: MISSED can be used as BANG, and BANG as MISSED */
function isBangPlay(p: Player, card: Card): boolean {
  return card.key === "bang" || (isChar(p, CHAR.calamity) && card.key === "missed");
}
function canRespondToBangLike(p: Player, card: Card): boolean {
  // to dodge BANG => MISSED (or BANG if Calamity)
  if (card.key === "missed") return true;
  if (isChar(p, CHAR.calamity) && card.key === "bang") return true;
  return false;
}
function canRespondToIndiansOrDuel(p: Player, card: Card): boolean {
  // needs BANG (or MISSED if Calamity playing it as BANG)
  return isBangPlay(p, card);
}

/** Suzy: when hand becomes empty, draw 1 */
function maybeSuzyDraw(room: GameRoom, p: Player) {
  if (!p.isAlive) return;
  if (!isChar(p, CHAR.suzy)) return;
  if (p.hand.length !== 0) return;
  try {
    p.hand.push(drawCard(room));
  } catch {}
}

/** ===== Draw! checks (Lucky Duke draws 2 and picks best automatically) ===== */
function rankNum(r: any): number | null {
  const s = String(r ?? "").toUpperCase();
  if (s === "A") return 1;
  if (s === "J") return 11;
  if (s === "Q") return 12;
  if (s === "K") return 13;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function isDynamiteExplosionCard(c: Card): boolean {
  const suit = String((c as any).suit ?? "").toLowerCase();
  const num = rankNum((c as any).rank);
  return suit === "spades" && num != null && num >= 2 && num <= 9;
}
function isHearts(c: Card): boolean {
  return String((c as any).suit ?? "").toLowerCase() === "hearts";
}
function isHeartsOrDiamonds(c: Card): boolean {
  const s = String((c as any).suit ?? "").toLowerCase();
  return s === "hearts" || s === "diamonds";
}

type DrawKind = "barrel" | "jail" | "dynamite" | "blackjack_reveal";

function drawCheck(room: GameRoom, player: Player, kind: DrawKind): { drawn: Card[]; chosen: Card } {
  const lucky = isChar(player, CHAR.lucky);

  if (!lucky) {
    const c = drawCard(room);
    discard(room, c);
    return { drawn: [c], chosen: c };
  }

  const c1 = drawCard(room);
  const c2 = drawCard(room);
  discard(room, c1);
  discard(room, c2);

  const arr = [c1, c2];

  // pick best outcome for the player automatically
  if (kind === "dynamite") {
    const safe = arr.find((x) => !isDynamiteExplosionCard(x));
    return { drawn: arr, chosen: safe ?? arr[0] };
  }

  if (kind === "jail" || kind === "barrel") {
    const good = arr.find((x) => isHearts(x));
    return { drawn: arr, chosen: good ?? arr[0] };
  }

  return { drawn: arr, chosen: arr[1] };
}

/** ===== broadcasting state ===== */
function broadcastGameState(room: GameRoom) {
  const turnPlayerId = currentPlayer(room)?.id;

  let pendingPublic: any = room.pending;
  if (room.pending?.kind === "draw_choice") {
    pendingPublic = { kind: "draw_choice", playerId: room.pending.playerId, pickCount: room.pending.pickCount };
  }

  broadcastRoom(room, {
    type: "game_state",
    roomCode: room.code,
    turnPlayerId,
    phase: room.phase,
    pending: pendingPublic,
    turnEndsAt: room.turnEndsAt ?? 0,
    pendingEndsAt: room.pendingEndsAt ?? 0,
    ended: !!room.ended,
    players: (room.players as any[]).map((p: Player) => ({
      id: p.id,
      name: p.name,
      role: p.role,
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
    safeSend((me as any).ws, {
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

/** ===== GAME OVER (قواعد أصلية) =====
 * - إذا الشريف مات:
 *    - إذا الباقي الوحيد Renegade => renegade wins
 *    - غير هيك => outlaws win
 * - إذا الشريف عايش وما في outlaws ولا renegade => sheriff+deputies win
 */
function checkGameOver(room: GameRoom) {
  if (!room.started || room.ended) return;

  const alive = alivePlayers(room);
  const sheriff = (room.players as any[]).find((p: Player) => p.role === "sheriff") as Player | undefined;
  const sheriffAlive = !!sheriff?.isAlive;

  const anyOutlawAlive = alive.some((p) => p.role === "outlaw");
  const anyRenegadeAlive = alive.some((p) => p.role === "renegade");

  let winner: "outlaws" | "renegade" | "sheriff" | null = null;

  if (!sheriffAlive) {
    if (alive.length === 1 && alive[0].role === "renegade") winner = "renegade";
    else winner = "outlaws";
  } else {
    if (!anyOutlawAlive && !anyRenegadeAlive) winner = "sheriff";
  }

  if (winner) {
    room.ended = true;
    room.started = false;

    broadcastRoom(room, {
      type: "game_over",
      roomCode: room.code,
      winner,
    });

    broadcastGameState(room);
    broadcastMeStates(room);
  }
}

/** ===== Damage + kill rewards/penalties (اللعبة الحقيقية) =====
 * - قتل Outlaw => القاتل يسحب 3
 * - الشريف إذا قتل Deputy => يرمي كل كروته (hand+equipment)
 * - Vulture loot (موجود)
 */
function discardAllOfPlayer(room: GameRoom, p: Player) {
  const hand = p.hand.splice(0);
  const eq = p.equipment.splice(0);
  for (const c of hand) discard(room, c);
  for (const c of eq) discard(room, c);
  maybeSuzyDraw(room, p);
}

function applyDamage(room: GameRoom, target: Player, amount: number, attackerId?: string) {
  const attacker = attackerId ? getPlayer(room, attackerId) : undefined;

  for (let i = 0; i < amount; i++) {
    if (!target.isAlive) break;

    target.hp -= 1;

    // El Gringo: steal random from attacker each damage (if damage from another player)
    if (
      attacker &&
      attacker.id !== target.id &&
      isChar(target, CHAR.elgringo) &&
      attacker.hand.length > 0
    ) {
      const j = Math.floor(Math.random() * attacker.hand.length);
      const [stolen] = attacker.hand.splice(j, 1);
      if (stolen) target.hand.push(ensureCardMeta(stolen));
      maybeSuzyDraw(room, attacker);
    }

    if (target.hp <= 0) {
      target.hp = 0;
      target.isAlive = false;
      break;
    }

    // Bart Cassidy: draw 1 each damage if still alive
    if (isChar(target, CHAR.bart)) {
      try {
        target.hand.push(drawCard(room));
      } catch {}
    }
  }

  // if died: vulture + rewards/penalties + check game end
  if (!target.isAlive) {
    // Reward/Penalty depend on killer (if player killed)
    if (attacker && attacker.isAlive && attacker.id !== target.id) {
      // Kill outlaw => draw 3
      if (target.role === "outlaw") {
        try {
          attacker.hand.push(drawCard(room), drawCard(room), drawCard(room));
        } catch {}
        broadcastRoom(room, {
          type: "passive_triggered",
          roomCode: room.code,
          kind: "kill_reward_outlaw",
          killerId: attacker.id,
          victimId: target.id,
        });
      }

      // Sheriff kills deputy => sheriff discards everything
      if (attacker.role === "sheriff" && target.role === "deputy") {
        discardAllOfPlayer(room, attacker);
        broadcastRoom(room, {
          type: "passive_triggered",
          roomCode: room.code,
          kind: "sheriff_killed_deputy_penalty",
          sheriffId: attacker.id,
          deputyId: target.id,
        });
      }
    }

    // Vulture Sam: loot all cards from dead player
    const vulture = (room.players as any[]).find(
      (p: Player) => p.isAlive && isChar(p as Player, CHAR.vulture) && (p as Player).id !== target.id
    ) as Player | undefined;

    const hand = target.hand.splice(0);
    const eq = target.equipment.splice(0);

    if (vulture) {
      vulture.hand.push(...hand.map(ensureCardMeta), ...eq.map(ensureCardMeta));

      broadcastRoom(room, {
        type: "passive_triggered",
        roomCode: room.code,
        kind: "vulture_loot",
        vultureId: vulture.id,
        victimId: target.id,
        cardsCount: hand.length + eq.length,
      });
    } else {
      for (const c of hand) discard(room, c);
      for (const c of eq) discard(room, c);
    }

    checkGameOver(room);
  }

  maybeSuzyDraw(room, target);
  if (attacker) maybeSuzyDraw(room, attacker);
}

/** ===== Barrel / Jourdonnais auto-dodge (فقط ضد BANG الحقيقي) ===== */
function tryAutoBarrelDodgeAgainstBang(room: GameRoom, defender: Player): boolean {
  const has = equipmentHas(defender, "barrel") || isChar(defender, CHAR.jourd);
  if (!has) return false;

  const { drawn, chosen } = drawCheck(room, defender, "barrel");
  const success = isHearts(chosen);

  broadcastRoom(room, {
    type: "draw_check",
    roomCode: room.code,
    kind: "barrel",
    playerId: defender.id,
    drawn,
    chosen,
    success,
  });

  return success;
}

/** ===== Turn-start: Dynamite then Jail ===== */
function resolveDynamiteAtTurnStart(room: GameRoom, player: Player): boolean {
  const dyn = takeEquipment(player, "dynamite");
  if (!dyn) return true;

  const { drawn, chosen } = drawCheck(room, player, "dynamite");
  const exploded = isDynamiteExplosionCard(chosen);

  broadcastRoom(room, {
    type: "draw_check",
    roomCode: room.code,
    kind: "dynamite",
    playerId: player.id,
    drawn,
    chosen,
    exploded,
  });

  if (exploded) {
    discard(room, dyn);
    applyDamage(room, player, 3);
    broadcastRoom(room, {
      type: "action_resolved",
      roomCode: room.code,
      kind: "dynamite_exploded",
      playerId: player.id,
      newHp: player.hp,
      isAlive: player.isAlive,
    });
    return player.isAlive;
  }

  // pass to next alive
  const idx = (room.players as any[]).findIndex((p: Player) => p.id === player.id);
  const nextIdx = nextAliveIndex(room, idx >= 0 ? idx : (room.turnIndex ?? 0));
  const nextP = nextIdx >= 0 ? ((room.players as any[])[nextIdx] as Player | undefined) : undefined;

  if (!nextP || nextP.id === player.id) {
    player.equipment.push(dyn);
    return true;
  }

  nextP.equipment.push(dyn);

  broadcastRoom(room, {
    type: "action_resolved",
    roomCode: room.code,
    kind: "dynamite_passed",
    fromPlayerId: player.id,
    toPlayerId: nextP.id,
  });

  return true;
}

function resolveJailAtTurnStart(room: GameRoom, player: Player): "ok" | "skip" {
  const jail = takeEquipment(player, "jail");
  if (!jail) return "ok";

  const { drawn, chosen } = drawCheck(room, player, "jail");
  const freed = isHearts(chosen);

  discard(room, jail);

  broadcastRoom(room, {
    type: "draw_check",
    roomCode: room.code,
    kind: "jail",
    playerId: player.id,
    drawn,
    chosen,
    freed,
  });

  if (freed) return "ok";

  broadcastRoom(room, {
    type: "action_resolved",
    roomCode: room.code,
    kind: "jail_skip_turn",
    playerId: player.id,
  });

  return "skip";
}

/** ===== Draw Phase ===== */
function startDrawPhase(room: GameRoom, player: Player) {
  // Kit Carlson: choose 2 from 3
  if (isChar(player, CHAR.kit)) {
    const offered = [drawCard(room), drawCard(room), drawCard(room)];
    room.phase = "waiting";
    room.pending = { kind: "draw_choice", playerId: player.id, offered, pickCount: 2 };
    room.pendingEndsAt = Date.now() + RESPONSE_MS;

    safeSend((player as any).ws, {
      type: "action_required",
      roomCode: room.code,
      kind: "choose_draw",
      pickCount: 2,
      offered,
      pendingEndsAt: room.pendingEndsAt,
    });

    broadcastGameState(room);
    broadcastMeStates(room);
    return;
  }

  // Jesse Jones: optional steal first draw from another hand (or skip)
  if (isChar(player, CHAR.jesse)) {
    const eligible = (room.players as any[])
      .map((p: Player) => p)
      .filter((p) => p.isAlive && p.id !== player.id && p.hand.length > 0)
      .map((p) => p.id);

    if (eligible.length > 0) {
      room.phase = "waiting";
      room.pending = { kind: "jesse_choice", playerId: player.id, eligibleTargets: eligible };
      room.pendingEndsAt = Date.now() + RESPONSE_MS;

      safeSend((player as any).ws, {
        type: "action_required",
        roomCode: room.code,
        kind: "choose_jesse_target",
        eligibleTargets: eligible,
        pendingEndsAt: room.pendingEndsAt,
      });

      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }
  }

  // Pedro Ramirez: optional discard for first draw
  if (isChar(player, CHAR.pedro)) {
    const canUseDiscard = (room.discard?.length ?? 0) > 0;
    if (canUseDiscard) {
      room.phase = "waiting";
      room.pending = { kind: "pedro_choice", playerId: player.id, canUseDiscard: true };
      room.pendingEndsAt = Date.now() + RESPONSE_MS;

      safeSend((player as any).ws, {
        type: "action_required",
        roomCode: room.code,
        kind: "choose_pedro_source",
        canUseDiscard: true,
        pendingEndsAt: room.pendingEndsAt,
      });

      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }
  }

  finishStandardDraw(room, player, undefined);
}

function takeFromDiscard(room: GameRoom): Card {
  room.discard ??= [];
  const c = room.discard.pop();
  if (!c) throw new Error("Discard empty");
  return ensureCardMeta(c);
}

function finishStandardDraw(room: GameRoom, player: Player, firstCard?: Card) {
  let c1 = firstCard ?? drawCard(room);
  player.hand.push(ensureCardMeta(c1));

  const c2 = drawCard(room);
  player.hand.push(ensureCardMeta(c2));

  // Black Jack: reveal 2nd, if ♥/♦ draw +1
  if (isChar(player, CHAR.blackjack)) {
    broadcastRoom(room, {
      type: "passive_triggered",
      roomCode: room.code,
      kind: "blackjack_reveal",
      playerId: player.id,
      revealed: c2,
    });

    if (isHeartsOrDiamonds(c2)) {
      try {
        player.hand.push(drawCard(room));
        broadcastRoom(room, {
          type: "passive_triggered",
          roomCode: room.code,
          kind: "blackjack_bonus_draw",
          playerId: player.id,
        });
      } catch {}
    }
  }

  room.phase = "main";
  room.pending = null;
  room.pendingEndsAt = undefined;

  maybeSuzyDraw(room, player);

  broadcastGameState(room);
  broadcastMeStates(room);
}

/** ===== Multi-target effects: Indians / Gatling ===== */
function buildOtherPlayersOrder(room: GameRoom, attackerId: string): string[] {
  const arr = room.players as any[];
  const attackerIdx = arr.findIndex((p: Player) => p.id === attackerId);
  const n = arr.length;

  const list: string[] = [];
  for (let step = 1; step <= n; step++) {
    const i = (attackerIdx + step) % n;
    const p = arr[i] as Player;
    if (p?.isAlive && p.id !== attackerId) list.push(p.id);
  }
  return list;
}

function continueIndians(room: GameRoom) {
  const pend = room.pending;
  if (!pend || pend.kind !== "indians") return;

  while (pend.idx < pend.targets.length) {
    const targetId = pend.targets[pend.idx];
    const target = getPlayer(room, targetId);
    if (!target || !target.isAlive) {
      pend.idx++;
      continue;
    }

    room.phase = "waiting";
    room.pendingEndsAt = Date.now() + RESPONSE_MS;

    safeSend((target as any).ws, {
      type: "action_required",
      roomCode: room.code,
      kind: "respond_to_indians",
      fromPlayerId: pend.attackerId,
      pendingEndsAt: room.pendingEndsAt,
    });

    broadcastGameState(room);
    broadcastMeStates(room);
    return;
  }

  room.phase = "main";
  room.pending = null;
  room.pendingEndsAt = undefined;

  broadcastRoom(room, {
    type: "action_resolved",
    roomCode: room.code,
    kind: "indians_done",
    attackerId: pend.attackerId,
  });

  broadcastGameState(room);
  broadcastMeStates(room);
}

function continueGatling(room: GameRoom) {
  const pend = room.pending;
  if (!pend || pend.kind !== "gatling") return;

  while (pend.idx < pend.targets.length) {
    const targetId = pend.targets[pend.idx];
    const target = getPlayer(room, targetId);
    if (!target || !target.isAlive) {
      pend.idx++;
      continue;
    }

    // IMPORTANT: Barrel/Jourdonnais لا ينفع ضد Gatling باللعبة الأصلية
    room.phase = "waiting";
    room.pendingEndsAt = Date.now() + RESPONSE_MS;

    safeSend((target as any).ws, {
      type: "action_required",
      roomCode: room.code,
      kind: "respond_to_gatling",
      fromPlayerId: pend.attackerId,
      pendingEndsAt: room.pendingEndsAt,
    });

    broadcastGameState(room);
    broadcastMeStates(room);
    return;
  }

  room.phase = "main";
  room.pending = null;
  room.pendingEndsAt = undefined;

  broadcastRoom(room, {
    type: "action_resolved",
    roomCode: room.code,
    kind: "gatling_done",
    attackerId: pend.attackerId,
  });

  broadcastGameState(room);
  broadcastMeStates(room);
}

/** ===== Duel ===== */
function promptDuel(room: GameRoom, pend: Extract<Pending, { kind: "duel" }>) {
  const responder = getPlayer(room, pend.responderId);
  if (!responder || !responder.isAlive) {
    room.phase = "main";
    room.pending = null;
    room.pendingEndsAt = undefined;
    broadcastGameState(room);
    broadcastMeStates(room);
    return;
  }

  room.phase = "waiting";
  room.pendingEndsAt = Date.now() + RESPONSE_MS;

  safeSend((responder as any).ws, {
    type: "action_required",
    roomCode: room.code,
    kind: "respond_to_duel",
    opponentId: pend.responderId === pend.targetId ? pend.initiatorId : pend.targetId,
    pendingEndsAt: room.pendingEndsAt,
  });

  broadcastGameState(room);
  broadcastMeStates(room);
}

/** ===== end turn helpers (discard to hp) ===== */
function openDiscardLimit(room: GameRoom, player: Player, after: "end_turn_manual") {
  const need = Math.max(0, player.hand.length - player.hp);
  if (need <= 0) return false;

  room.phase = "waiting";
  room.pending = { kind: "discard_limit", playerId: player.id, need, after };
  room.pendingEndsAt = Date.now() + RESPONSE_MS;

  safeSend((player as any).ws, {
    type: "action_required",
    roomCode: room.code,
    kind: "discard_to_limit",
    need,
    pendingEndsAt: room.pendingEndsAt,
  });

  broadcastGameState(room);
  broadcastMeStates(room);
  return true;
}

function discardRandomFromHand(room: GameRoom, player: Player, count: number) {
  for (let i = 0; i < count; i++) {
    if (player.hand.length === 0) break;
    const j = Math.floor(Math.random() * player.hand.length);
    const [c] = player.hand.splice(j, 1);
    if (c) discard(room, c);
  }
  maybeSuzyDraw(room, player);
}

/** ===== TURN FLOW ===== */
function startTurn(room: GameRoom) {
  ensureRuntime(room);
  if (!room.started || room.ended) return;

  // if game already ended by something
  checkGameOver(room);
  if (room.ended) return;

  // move to next alive if needed
  let cur = currentPlayer(room);
  if (!cur?.isAlive) {
    const nxt = nextAliveIndex(room, room.turnIndex ?? 0);
    if (nxt < 0) {
      checkGameOver(room);
      return;
    }
    room.turnIndex = nxt;
    cur = currentPlayer(room);
  }

  const player = currentPlayer(room);

  room.phase = "main";
  room.pending = null;
  room.pendingEndsAt = undefined;
  room.bangsUsedThisTurn = 0;

  const now = Date.now();
  room.turnEndsAt = now + TURN_MS;

  broadcastRoom(room, {
    type: "turn_started",
    roomCode: room.code,
    turnPlayerId: player.id,
    turnEndsAt: room.turnEndsAt,
  });

  // 1) Dynamite
  const aliveAfterDyn = resolveDynamiteAtTurnStart(room, player);
  if (!aliveAfterDyn) {
    if (room.ended) return;
    const nxt = nextAliveIndex(room, room.turnIndex ?? 0);
    if (nxt < 0) {
      checkGameOver(room);
      return;
    }
    room.turnIndex = nxt;
    startTurn(room);
    return;
  }

  // 2) Jail
  const jailRes = resolveJailAtTurnStart(room, player);
  if (jailRes === "skip") {
    if (room.ended) return;
    const nxt = nextAliveIndex(room, room.turnIndex ?? 0);
    if (nxt < 0) {
      checkGameOver(room);
      return;
    }
    room.turnIndex = nxt;
    startTurn(room);
    return;
  }

  // 3) Draw phase
  startDrawPhase(room, player);
}

/** Advance only if no pending */
function advanceTurn(room: GameRoom, reason: "manual" | "timeout" | "jail_skip") {
  ensureRuntime(room);
  if (!room.started || room.ended) return;
  if (room.phase !== "main") return;

  const prev = currentPlayer(room);

  const nxt = nextAliveIndex(room, room.turnIndex ?? 0);
  if (nxt < 0) {
    checkGameOver(room);
    return;
  }
  room.turnIndex = nxt;

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

/** ===== MAIN TIMER LOOP ===== */
function resolvePendingTimeout(room: GameRoom) {
  if (!room.pending) return;

  const pend = room.pending;

  // Kit draw_choice timeout: auto pick first 2
  if (pend.kind === "draw_choice") {
    const p = getPlayer(room, pend.playerId);
    if (p && p.isAlive) {
      const autoPick = pend.offered.slice(0, pend.pickCount).map((c) => c.id);
      resolveDrawChoice(room, p, autoPick);
    } else {
      for (const c of pend.offered) discard(room, c);
      room.pending = null;
      room.phase = "main";
      room.pendingEndsAt = undefined;
      broadcastGameState(room);
      broadcastMeStates(room);
    }
    return;
  }

  // Jesse choice timeout: skip (draw from deck)
  if (pend.kind === "jesse_choice") {
    const p = getPlayer(room, pend.playerId);
    room.pending = null;
    room.phase = "main";
    room.pendingEndsAt = undefined;
    if (p && p.isAlive) finishStandardDraw(room, p, undefined);
    return;
  }

  // Pedro choice timeout: default deck
  if (pend.kind === "pedro_choice") {
    const p = getPlayer(room, pend.playerId);
    room.pending = null;
    room.phase = "main";
    room.pendingEndsAt = undefined;
    if (p && p.isAlive) finishStandardDraw(room, p, undefined);
    return;
  }

  // discard_limit timeout: discard random then end turn
  if (pend.kind === "discard_limit") {
    const p = getPlayer(room, pend.playerId);
    if (p && p.isAlive) discardRandomFromHand(room, p, pend.need);

    room.pending = null;
    room.phase = "main";
    room.pendingEndsAt = undefined;

    if (pend.after === "end_turn_manual") {
      advanceTurn(room, "manual");
    }
    return;
  }

  // action-response timeouts
  if (pend.kind === "bang") {
    const target = getPlayer(room, pend.targetId);
    if (target && target.isAlive) applyDamage(room, target, 1, pend.attackerId);

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

    if (target) maybeSuzyDraw(room, target);
    broadcastGameState(room);
    broadcastMeStates(room);
    return;
  }

  if (pend.kind === "indians") {
    const targetId = pend.targets[pend.idx];
    const target = getPlayer(room, targetId);
    if (target && target.isAlive) applyDamage(room, target, 1, pend.attackerId);

    pend.idx++;
    continueIndians(room);
    return;
  }

  if (pend.kind === "gatling") {
    const targetId = pend.targets[pend.idx];
    const target = getPlayer(room, targetId);
    if (target && target.isAlive) applyDamage(room, target, 1, pend.attackerId);

    pend.idx++;
    continueGatling(room);
    return;
  }

  if (pend.kind === "duel") {
    const loser = getPlayer(room, pend.responderId);
    const winnerId =
      pend.responderId === pend.targetId ? pend.initiatorId : pend.targetId;

    if (loser && loser.isAlive) applyDamage(room, loser, 1, winnerId);

    room.pending = null;
    room.phase = "main";
    room.pendingEndsAt = undefined;

    broadcastRoom(room, {
      type: "action_resolved",
      roomCode: room.code,
      kind: "duel_timeout_lose",
      loserId: pend.responderId,
    });

    broadcastGameState(room);
    broadcastMeStates(room);
    return;
  }
}

setInterval(() => {
  const now = Date.now();

  for (const r of rooms.values()) {
    const room = r as GameRoom;
    if (!room.started || room.ended) continue;

    ensureRuntime(room);

    if (room.phase === "waiting" && room.pending && room.pendingEndsAt && now >= room.pendingEndsAt) {
      resolvePendingTimeout(room);
      continue;
    }

    if (room.phase === "main" && room.turnEndsAt && now >= room.turnEndsAt) {
      const p = currentPlayer(room);
      const need = Math.max(0, p.hand.length - p.hp);
      if (need > 0) discardRandomFromHand(room, p, need);
      advanceTurn(room, "timeout");
    }
  }
}, 500);

/** ================= RESOLVE HELPERS FOR CHOICES ================= */
function resolveDrawChoice(room: GameRoom, player: Player, chosenIds: string[]) {
  if (!room.pending || room.pending.kind !== "draw_choice") throw new Error("No draw choice pending");
  const pend = room.pending;
  if (pend.playerId !== player.id) throw new Error("Not your draw choice");
  if (currentPlayer(room).id !== player.id) throw new Error("Not your turn");

  const uniq = Array.from(new Set(chosenIds));
  if (uniq.length !== pend.pickCount) throw new Error(`Pick exactly ${pend.pickCount} cards`);

  const byId = new Map(pend.offered.map((c) => [c.id, c]));
  const chosen: Card[] = [];
  for (const id of uniq) {
    const c = byId.get(id);
    if (!c) throw new Error("Bad cardId");
    chosen.push(c);
  }

  const remaining = pend.offered.filter((c) => !uniq.includes(c.id));

  player.hand.push(...chosen.map(ensureCardMeta));

  room.deck ??= [];
  for (let i = remaining.length - 1; i >= 0; i--) {
    room.deck.push(ensureCardMeta(remaining[i]));
  }

  room.pending = null;
  room.phase = "main";
  room.pendingEndsAt = undefined;

  broadcastRoom(room, {
    type: "action_resolved",
    roomCode: room.code,
    kind: "draw_choice_done",
    playerId: player.id,
    picked: chosen.length,
    returned: remaining.length,
  });

  maybeSuzyDraw(room, player);
  broadcastGameState(room);
  broadcastMeStates(room);
}

/** Jesse: choose target to steal first draw from (or skip) */
function resolveJesseChoice(room: GameRoom, player: Player, targetId?: string) {
  if (!room.pending || room.pending.kind !== "jesse_choice") throw new Error("No Jesse choice pending");
  const pend = room.pending;
  if (pend.playerId !== player.id) throw new Error("Not your Jesse choice");

  room.pending = null;
  room.phase = "main";
  room.pendingEndsAt = undefined;

  let first: Card | undefined;

  if (targetId && pend.eligibleTargets.includes(targetId)) {
    const t = getPlayer(room, targetId);
    if (t && t.isAlive && t.hand.length > 0) {
      const j = Math.floor(Math.random() * t.hand.length);
      const [stolen] = t.hand.splice(j, 1);
      if (stolen) first = ensureCardMeta(stolen);
      maybeSuzyDraw(room, t);
    }
  }

  finishStandardDraw(room, player, first);
}

/** Pedro: choose deck vs discard for first draw */
function resolvePedroChoice(room: GameRoom, player: Player, source: "deck" | "discard") {
  if (!room.pending || room.pending.kind !== "pedro_choice") throw new Error("No Pedro choice pending");
  const pend = room.pending;
  if (pend.playerId !== player.id) throw new Error("Not your Pedro choice");

  room.pending = null;
  room.phase = "main";
  room.pendingEndsAt = undefined;

  let first: Card | undefined;

  if (source === "discard" && pend.canUseDiscard) {
    try {
      first = takeFromDiscard(room);
    } catch {
      first = undefined;
    }
  }

  finishStandardDraw(room, player, first);
}

/** ===== core card effects ===== */
function stealRandomCard(target: Player): Card | null {
  const pool: { from: "hand" | "equipment"; idx: number }[] = [];
  for (let i = 0; i < target.hand.length; i++) pool.push({ from: "hand", idx: i });
  for (let i = 0; i < target.equipment.length; i++) pool.push({ from: "equipment", idx: i });
  if (pool.length === 0) return null;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick.from === "hand") {
    const [c] = target.hand.splice(pick.idx, 1);
    return c ? ensureCardMeta(c) : null;
  } else {
    const [c] = target.equipment.splice(pick.idx, 1);
    return c ? ensureCardMeta(c) : null;
  }
}

function discardRandomCard(room: GameRoom, target: Player): Card | null {
  const c = stealRandomCard(target);
  if (!c) return null;
  discard(room, c);
  return c;
}

/** ================= handlers ================= */

export function handlePlayCard(
  ws: any,
  payload: { cardId?: string; targetId?: string; roomCode?: string }
) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  const info = wsToRoom.get(ws)!;

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  let takenCard: Card | undefined;

  try {
    ensureRuntime(room);

    if (room.phase !== "main") throw new Error("Finish pending action first");
    assertMyTurn(room, me.id);

    if (!payload.cardId) throw new Error("Missing cardId");
    takenCard = popCardFromHand(me, payload.cardId);

    /** ===== Equipment plays ===== */
    if (takenCard.key === "weapon") {
      replaceUniqueEquipment(room, me, "weapon", takenCard);
      takenCard = undefined;
      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    if (takenCard.key === "barrel") {
      replaceUniqueEquipment(room, me, "barrel", takenCard);
      takenCard = undefined;
      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    if (takenCard.key === "mustang") {
      replaceUniqueEquipment(room, me, "mustang", takenCard);
      takenCard = undefined;
      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    if (takenCard.key === "scope") {
      replaceUniqueEquipment(room, me, "scope", takenCard);
      takenCard = undefined;
      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    if (takenCard.key === "dynamite") {
      if (payload.targetId && payload.targetId !== me.id) throw new Error("Dynamite is played on yourself");
      if (equipmentHas(me, "dynamite")) throw new Error("You already have Dynamite");
      me.equipment.push(takenCard);
      takenCard = undefined;
      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    if (takenCard.key === "jail") {
      if (!payload.targetId) throw new Error("Missing targetId");
      const target = getPlayer(room, payload.targetId);
      if (!target || !target.isAlive) throw new Error("Bad target");
      if (target.id === me.id) throw new Error("Can't jail yourself");
      if (target.role === "sheriff") throw new Error("Can't jail the Sheriff");

      const old = takeEquipment(target, "jail");
      if (old) discard(room, old);

      target.equipment.push(takenCard);
      takenCard = undefined;

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "jail_set",
        fromPlayerId: me.id,
        targetId: target.id,
      });

      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== BANG (Calamity can play MISSED as BANG) ===== */
    if (isBangPlay(me, takenCard)) {
      if (!payload.targetId) throw new Error("Missing targetId");
      const target = getPlayer(room, payload.targetId);
      if (!target || !target.isAlive) throw new Error("Bad target");
      if (target.id === me.id) throw new Error("Can't target yourself");

      if (!canShootBang(room, me, target)) {
        const d = effectiveDistance(room, me, target);
        const r = weaponRange(me);
        throw new Error(`Target out of range (distance ${d}, range ${r})`);
      }

      room.bangsUsedThisTurn ??= 0;
      const maxB = maxBangsPerTurn(me);
      if (room.bangsUsedThisTurn >= maxB) throw new Error(`Only ${maxB >= 999 ? "many" : maxB} BANG per turn`);
      room.bangsUsedThisTurn++;

      discard(room, takenCard);
      takenCard = undefined;

      // Barrel/Jourdonnais only against BANG (صح)
      const dodged = tryAutoBarrelDodgeAgainstBang(room, target);
      if (dodged) {
        broadcastRoom(room, {
          type: "action_resolved",
          roomCode: room.code,
          kind: "bang_dodged_barrel",
          attackerId: me.id,
          targetId: target.id,
        });

        maybeSuzyDraw(room, me);
        broadcastGameState(room);
        broadcastMeStates(room);
        return;
      }

      const need = requiredMissedForBang(me);

      room.phase = "waiting";
      room.pending = {
        kind: "bang",
        attackerId: me.id,
        targetId: target.id,
        requiredMissed: need,
        missedSoFar: 0,
      };
      room.pendingEndsAt = Date.now() + RESPONSE_MS;

      safeSend((target as any).ws, {
        type: "action_required",
        roomCode: room.code,
        kind: "respond_to_bang",
        fromPlayerId: me.id,
        requiredMissed: need,
        missedSoFar: 0,
        pendingEndsAt: room.pendingEndsAt,
      });

      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== BEER (قانون اللعبة: ممنوع إذا باقي بس 2 لاعبين) ===== */
    if (takenCard.key === "beer") {
      if (aliveCount(room) <= 2) throw new Error("Beer can't be played with 2 players left");
      if (me.hp >= me.maxHp) throw new Error("Already at full HP");

      me.hp = Math.min(me.maxHp, me.hp + 1);
      discard(room, takenCard);
      takenCard = undefined;

      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== Stagecoach (draw 2) ===== */
    if (takenCard.key === "stagecoach") {
      discard(room, takenCard);
      takenCard = undefined;

      me.hand.push(drawCard(room));
      me.hand.push(drawCard(room));

      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== Wells Fargo (draw 3) ===== */
    if (takenCard.key === "wellsfargo") {
      discard(room, takenCard);
      takenCard = undefined;

      me.hand.push(drawCard(room));
      me.hand.push(drawCard(room));
      me.hand.push(drawCard(room));

      maybeSuzyDraw(room, me);
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== Saloon (heal all alive +1) ===== */
    if (takenCard.key === "saloon") {
      discard(room, takenCard);
      takenCard = undefined;

      for (const p of room.players as any[]) {
        const pl = p as Player;
        if (!pl.isAlive) continue;
        pl.hp = Math.min(pl.maxHp, pl.hp + 1);
      }

      broadcastRoom(room, { type: "action_resolved", roomCode: room.code, kind: "saloon" });
      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== Panic! (distance <= 1) steal random card ===== */
    if (takenCard.key === "panic") {
      if (!payload.targetId) throw new Error("Missing targetId");
      const target = getPlayer(room, payload.targetId);
      if (!target || !target.isAlive) throw new Error("Bad target");
      if (target.id === me.id) throw new Error("Can't target yourself");

      const d = effectiveDistance(room, me, target);
      if (d > 1) throw new Error(`Panic out of range (distance ${d})`);

      discard(room, takenCard);
      takenCard = undefined;

      const stolen = stealRandomCard(target);
      if (stolen) me.hand.push(stolen);

      maybeSuzyDraw(room, target);
      maybeSuzyDraw(room, me);

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "panic",
        fromPlayerId: me.id,
        targetId: target.id,
        success: !!stolen,
      });

      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== Cat Balou (discard random card from target) ===== */
    if (takenCard.key === "catbalou") {
      if (!payload.targetId) throw new Error("Missing targetId");
      const target = getPlayer(room, payload.targetId);
      if (!target || !target.isAlive) throw new Error("Bad target");
      if (target.id === me.id) throw new Error("Can't target yourself");

      discard(room, takenCard);
      takenCard = undefined;

      const removed = discardRandomCard(room, target);

      maybeSuzyDraw(room, target);
      maybeSuzyDraw(room, me);

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "catbalou",
        fromPlayerId: me.id,
        targetId: target.id,
        success: !!removed,
      });

      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    /** ===== Indians! ===== */
    if (takenCard.key === "indians") {
      discard(room, takenCard);
      takenCard = undefined;

      const targets = buildOtherPlayersOrder(room, me.id);

      room.pending = { kind: "indians", attackerId: me.id, targets, idx: 0 };
      room.phase = "waiting";
      room.pendingEndsAt = Date.now() + RESPONSE_MS;

      broadcastRoom(room, { type: "action_resolved", roomCode: room.code, kind: "indians_start", attackerId: me.id });

      maybeSuzyDraw(room, me);
      continueIndians(room);
      return;
    }

    /** ===== Gatling ===== */
    if (takenCard.key === "gatling") {
      discard(room, takenCard);
      takenCard = undefined;

      const targets = buildOtherPlayersOrder(room, me.id);

      room.pending = { kind: "gatling", attackerId: me.id, targets, idx: 0 };
      room.phase = "waiting";
      room.pendingEndsAt = Date.now() + RESPONSE_MS;

      broadcastRoom(room, { type: "action_resolved", roomCode: room.code, kind: "gatling_start", attackerId: me.id });

      maybeSuzyDraw(room, me);
      continueGatling(room);
      return;
    }

    /** ===== Duel ===== */
    if (takenCard.key === "duel") {
      if (!payload.targetId) throw new Error("Missing targetId");
      const target = getPlayer(room, payload.targetId);
      if (!target || !target.isAlive) throw new Error("Bad target");
      if (target.id === me.id) throw new Error("Can't duel yourself");

      discard(room, takenCard);
      takenCard = undefined;

      const pend: Extract<Pending, { kind: "duel" }> = {
        kind: "duel",
        initiatorId: me.id,
        targetId: target.id,
        responderId: target.id,
      };

      room.pending = pend;
      room.phase = "waiting";
      room.pendingEndsAt = Date.now() + RESPONSE_MS;

      broadcastRoom(room, { type: "action_resolved", roomCode: room.code, kind: "duel_start", initiatorId: me.id, targetId: target.id });

      promptDuel(room, pend);
      return;
    }

    /** MISSED alone can't be played as a normal action */
    if (takenCard.key === "missed") {
      throw new Error("MISSED is a response card");
    }

    /** fallback: discard unknown */
    discard(room, takenCard);
    takenCard = undefined;

    maybeSuzyDraw(room, me);
    broadcastGameState(room);
    broadcastMeStates(room);
  } catch (e: any) {
    if (takenCard) me.hand.push(takenCard);
    safeSend(ws, { type: "error", message: e?.message || "Bad action" });
  }
}

/**
 * handleRespond:
 * - respond_to_bang: MISSED (or BANG if Calamity) => increments missedSoFar
 * - respond_to_gatling: MISSED (or BANG if Calamity)
 * - respond_to_indians: BANG (or MISSED if Calamity)
 * - respond_to_duel: BANG (or MISSED if Calamity)
 *
 * If payload.cardId is missing => "pass"
 */
export function handleRespond(ws: any, payload: { cardId?: string; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;
  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  let takenCard: Card | undefined;

  try {
    ensureRuntime(room);

    if (room.phase !== "waiting" || !room.pending) throw new Error("No pending action");
    const pend = room.pending;

    const isPass = !payload.cardId;

    // === BANG pending ===
    if (pend.kind === "bang") {
      if (pend.targetId !== me.id) throw new Error("Not your response");
      if (!me.isAlive) throw new Error("You are dead");

      if (isPass) {
        applyDamage(room, me, 1, pend.attackerId);

        room.pending = null;
        room.phase = "main";
        room.pendingEndsAt = undefined;

        broadcastRoom(room, {
          type: "action_resolved",
          roomCode: room.code,
          kind: "bang_hit",
          attackerId: pend.attackerId,
          targetId: me.id,
          newHp: me.hp,
          isAlive: me.isAlive,
        });

        broadcastGameState(room);
        broadcastMeStates(room);
        return;
      }

      takenCard = popCardFromHand(me, payload.cardId!);
      if (!canRespondToBangLike(me, takenCard)) {
        me.hand.push(takenCard);
        takenCard = undefined;
        throw new Error("Need MISSED (or BANG if Calamity)");
      }

      discard(room, takenCard);
      takenCard = undefined;

      pend.missedSoFar += 1;

      if (pend.missedSoFar < pend.requiredMissed) {
        room.pendingEndsAt = Date.now() + RESPONSE_MS;

        safeSend((me as any).ws, {
          type: "action_required",
          roomCode: room.code,
          kind: "respond_to_bang",
          fromPlayerId: pend.attackerId,
          requiredMissed: pend.requiredMissed,
          missedSoFar: pend.missedSoFar,
          pendingEndsAt: room.pendingEndsAt,
        });

        broadcastRoom(room, {
          type: "action_resolved",
          roomCode: room.code,
          kind: "bang_partial_missed",
          attackerId: pend.attackerId,
          targetId: pend.targetId,
          remaining: pend.requiredMissed - pend.missedSoFar,
        });

        maybeSuzyDraw(room, me);

        broadcastGameState(room);
        broadcastMeStates(room);
        return;
      }

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

      maybeSuzyDraw(room, me);

      broadcastGameState(room);
      broadcastMeStates(room);
      return;
    }

    // === Indians pending ===
    if (pend.kind === "indians") {
      const targetId = pend.targets[pend.idx];
      if (me.id !== targetId) throw new Error("Not your response");

      if (isPass) {
        applyDamage(room, me, 1, pend.attackerId);
        pend.idx++;
        continueIndians(room);
        return;
      }

      takenCard = popCardFromHand(me, payload.cardId!);
      if (!canRespondToIndiansOrDuel(me, takenCard)) {
        me.hand.push(takenCard);
        takenCard = undefined;
        throw new Error("Need BANG (or MISSED if Calamity)");
      }

      discard(room, takenCard);
      takenCard = undefined;

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "indians_defended",
        attackerId: pend.attackerId,
        targetId: me.id,
      });

      maybeSuzyDraw(room, me);

      pend.idx++;
      continueIndians(room);
      return;
    }

    // === Gatling pending ===
    if (pend.kind === "gatling") {
      const targetId = pend.targets[pend.idx];
      if (me.id !== targetId) throw new Error("Not your response");

      if (isPass) {
        applyDamage(room, me, 1, pend.attackerId);
        pend.idx++;
        continueGatling(room);
        return;
      }

      takenCard = popCardFromHand(me, payload.cardId!);
      if (!canRespondToBangLike(me, takenCard)) {
        me.hand.push(takenCard);
        takenCard = undefined;
        throw new Error("Need MISSED (or BANG if Calamity)");
      }

      discard(room, takenCard);
      takenCard = undefined;

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "gatling_defended",
        attackerId: pend.attackerId,
        targetId: me.id,
      });

      maybeSuzyDraw(room, me);

      pend.idx++;
      continueGatling(room);
      return;
    }

    // === Duel pending ===
    if (pend.kind === "duel") {
      if (me.id !== pend.responderId) throw new Error("Not your response");

      const opponentId = me.id === pend.targetId ? pend.initiatorId : pend.targetId;

      if (isPass) {
        applyDamage(room, me, 1, opponentId);

        room.pending = null;
        room.phase = "main";
        room.pendingEndsAt = undefined;

        broadcastRoom(room, {
          type: "action_resolved",
          roomCode: room.code,
          kind: "duel_lose",
          loserId: me.id,
          winnerId: opponentId,
          newHp: me.hp,
          isAlive: me.isAlive,
        });

        broadcastGameState(room);
        broadcastMeStates(room);
        return;
      }

      takenCard = popCardFromHand(me, payload.cardId!);
      if (!canRespondToIndiansOrDuel(me, takenCard)) {
        me.hand.push(takenCard);
        takenCard = undefined;
        throw new Error("Need BANG (or MISSED if Calamity)");
      }

      discard(room, takenCard);
      takenCard = undefined;

      maybeSuzyDraw(room, me);

      pend.responderId = opponentId;
      room.pendingEndsAt = Date.now() + RESPONSE_MS;

      broadcastRoom(room, {
        type: "action_resolved",
        roomCode: room.code,
        kind: "duel_continue",
        nextResponderId: pend.responderId,
      });

      promptDuel(room, pend);
      return;
    }

    throw new Error("This pending requires a specific handler");
  } catch (e: any) {
    if (takenCard) me.hand.push(takenCard);
    safeSend(ws, { type: "error", message: e?.message || "Bad response" });
  }
}

/** Kit Carlson choose 2 from 3 */
export function handleChooseDraw(ws: any, payload: { cardIds?: string[]; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;
  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  try {
    ensureRuntime(room);
    if (room.phase !== "waiting" || room.pending?.kind !== "draw_choice") throw new Error("No draw choice pending");
    resolveDrawChoice(room, me, payload.cardIds ?? []);
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Bad choose_draw" });
  }
}

/** Jesse Jones choose target or skip */
export function handleChooseJesseTarget(ws: any, payload: { targetId?: string; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;
  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  try {
    ensureRuntime(room);
    if (room.phase !== "waiting" || room.pending?.kind !== "jesse_choice") throw new Error("No Jesse choice pending");
    resolveJesseChoice(room, me, payload.targetId);
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Bad choose_jesse_target" });
  }
}

/** Pedro Ramirez choose "deck" or "discard" */
export function handleChoosePedroSource(ws: any, payload: { source?: "deck" | "discard"; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;
  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  try {
    ensureRuntime(room);
    if (room.phase !== "waiting" || room.pending?.kind !== "pedro_choice") throw new Error("No Pedro choice pending");
    resolvePedroChoice(room, me, payload.source === "discard" ? "discard" : "deck");
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Bad choose_pedro_source" });
  }
}

/** Sid Ketchum: discard 2 cards -> heal 1 */
export function handleSidHeal(ws: any, payload: { cardIds?: string[]; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;
  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  try {
    ensureRuntime(room);
    if (!isChar(me, CHAR.sid)) throw new Error("Not Sid Ketchum");
    if (room.phase !== "main") throw new Error("Finish pending action first");
    if (!me.isAlive) throw new Error("You are dead");
    if (me.hp >= me.maxHp) throw new Error("Already at full HP");

    const ids = payload.cardIds ?? [];
    if (ids.length !== 2) throw new Error("Need exactly 2 cardIds");

    const c1 = popCardFromHand(me, ids[0]);
    const c2 = popCardFromHand(me, ids[1]);

    discard(room, c1);
    discard(room, c2);

    me.hp = Math.min(me.maxHp, me.hp + 1);

    maybeSuzyDraw(room, me);

    broadcastRoom(room, { type: "action_resolved", roomCode: room.code, kind: "sid_heal", playerId: me.id, newHp: me.hp });
    broadcastGameState(room);
    broadcastMeStates(room);
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Bad sid_heal" });
  }
}

/** Discard down to HP (when requested) */
export function handleDiscardToLimit(ws: any, payload: { cardIds?: string[]; roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;
  const me = getPlayer(room, info.playerId);
  if (!me) return safeSend(ws, { type: "error", message: "Player not found" });

  try {
    ensureRuntime(room);
    if (room.phase !== "waiting" || room.pending?.kind !== "discard_limit") throw new Error("No discard_limit pending");
    const pend = room.pending;
    if (pend.playerId !== me.id) throw new Error("Not your discard_limit");

    const ids = Array.from(new Set(payload.cardIds ?? []));
    if (ids.length !== pend.need) throw new Error(`Need exactly ${pend.need} cards`);

    for (const id of ids) {
      const c = popCardFromHand(me, id);
      discard(room, c);
    }

    room.pending = null;
    room.phase = "main";
    room.pendingEndsAt = undefined;

    maybeSuzyDraw(room, me);

    broadcastRoom(room, { type: "action_resolved", roomCode: room.code, kind: "discard_limit_done", playerId: me.id });

    broadcastGameState(room);
    broadcastMeStates(room);

    if (pend.after === "end_turn_manual") {
      advanceTurn(room, "manual");
    }
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Bad discard_to_limit" });
  }
}

export function handleEndTurn(ws: any, payload?: { roomCode?: string }) {
  const room = getRoomByWs(ws);
  if (!room) return safeSend(ws, { type: "error", message: "Not in a room" });
  if (!room.started || room.ended) return safeSend(ws, { type: "error", message: "Game not started" });

  if (payload?.roomCode && payload.roomCode !== room.code) {
    return safeSend(ws, { type: "error", message: "Wrong roomCode" });
  }

  const info = wsToRoom.get(ws)!;

  try {
    ensureRuntime(room);

    if (room.phase !== "main") throw new Error("Can't end turn now");
    assertMyTurn(room, info.playerId);

    const me = getPlayer(room, info.playerId)!;

    if (openDiscardLimit(room, me, "end_turn_manual")) return;

    advanceTurn(room, "manual");
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Can't end turn" });
  }
}

/** ===== startGame (مهم عشان التايمر ما يضل 0) =====
 * - بتتأكد runtime
 * - بتختار أول لاعب: Sheriff إذا موجود، غير هيك index 0
 * - بتوزّع كروت البداية: عددها = hp (بداية اللعبة اللاعبين full hp)
 * - بعدها بتنادي startTurn(room)
 *
 * لازم تكون room.deck جاهزة قبل ما تنادي startGame، وإلا رح يعطي error "deck empty"
 */
export function startGame(room: GameRoom) {
  ensureRuntime(room);

  room.started = true;
  room.ended = false;

  // sheriff يبدأ
  const idxSheriff = (room.players as any[]).findIndex((p: Player) => p.role === "sheriff");
  room.turnIndex = idxSheriff >= 0 ? idxSheriff : 0;

  // reset hp/alive + deal starting hands (على قدر hp)
  for (const p of room.players as any[]) {
    const pl = p as Player;
    ensurePlayerRuntime(pl);

    pl.isAlive = true;
    // خليهم full
    pl.hp = Math.min(pl.maxHp, pl.maxHp);

    pl.hand = pl.hand ?? [];
    pl.equipment = pl.equipment ?? [];

    // وزع: عدد كروت البداية = hp
    const need = Math.max(0, pl.hp - pl.hand.length);
    for (let i = 0; i < need; i++) {
      try {
        pl.hand.push(drawCard(room));
      } catch {
        break;
      }
    }
  }

  broadcastRoom(room, { type: "game_started", roomCode: room.code, turnPlayerId: currentPlayer(room)?.id });
  broadcastGameState(room);
  broadcastMeStates(room);

  startTurn(room);
}

/**
 * IMPORTANT:
 * إذا عندك start handler برا:
 * بدل room.started=true لحال، نادِ startGame(room)
 */
export { startTurn };
