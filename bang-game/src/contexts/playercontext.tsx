import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { LobbyPlayer, PublicPlayer, MePlayer as BaseMePlayer } from "../models/player";
import type { WeaponKey } from "../models/card";

type WsStatus = "idle" | "connecting" | "open" | "closed" | "error" | "reconnecting";

const APP_CLIENT_SESSION_ID = `client_${Date.now()}_${Math.random().toString(16).slice(2)}`;

type Phase = "main" | "waiting";
type Pending = null | { kind: string; privateKind?: string; [k: string]: any };

type ActionRequired = null | { type: "action_required"; kind: string; [k: string]: any };

type PassiveTriggered = null | { type: "passive_triggered"; kind: string; seq: number; [k: string]: any };

type GameEvent = { id: string; ts: number; type: string; [k: string]: any };

type ChatMessage = {
  id: string;
  ts: number;
  roomCode?: string;
  playerId: string;
  name: string;
  text: string;
};

type GameOver = null | { type: "game_over"; [k: string]: any };

export type MePlayer = BaseMePlayer & {
  weaponKey: WeaponKey;
  weapon?: WeaponKey | null;
  character?: string | null;
  characterKey?: string | null;
};

export const WEAPON_LABEL: Record<WeaponKey, string> = {
  colt45: "Colt .45",
  volcanic: "Volcanic",
  schofield: "Schofield",
  remington: "Remington",
  rev_carabine: "Rev. Carabine",
  winchester: "Winchester",
};

export const WEAPON_RANGE: Record<WeaponKey, number> = {
  colt45: 1,
  volcanic: 1,
  schofield: 2,
  remington: 3,
  rev_carabine: 4,
  winchester: 5,
};

type PlayerContextType = {
  name: string;
  setName: (v: string) => void;

  avatarUri: string;
  setAvatarUri: (v: string) => void;

  roomCode: string;
  setRoomCode: (v: string) => void;

  lobbyPlayerId: string;
  setLobbyPlayerId: React.Dispatch<React.SetStateAction<string>>;

  hostId: string;
  setHostId: React.Dispatch<React.SetStateAction<string>>;
  isLobbyHost: boolean;

  lobbyPlayers: LobbyPlayer[];
  setLobbyPlayers: React.Dispatch<React.SetStateAction<LobbyPlayer[]>>;

  roomReady: boolean;
  setRoomReady: React.Dispatch<React.SetStateAction<boolean>>;

  maxPlayers: number;
  setMaxPlayers: React.Dispatch<React.SetStateAction<number>>;

  players: PublicPlayer[];
  setPlayers: React.Dispatch<React.SetStateAction<PublicPlayer[]>>;

  discardCount: number;
  setDiscardCount: React.Dispatch<React.SetStateAction<number>>;

  discardTop: any | null;
  setDiscardTop: React.Dispatch<React.SetStateAction<any | null>>;

  deckCount: number | null;
  setDeckCount: React.Dispatch<React.SetStateAction<number | null>>;

  me: MePlayer | null;
  setMe: React.Dispatch<React.SetStateAction<MePlayer | null>>;

  turnPlayerId: string | null;
  setTurnPlayerId: React.Dispatch<React.SetStateAction<string | null>>;

  phase: Phase;
  setPhase: React.Dispatch<React.SetStateAction<Phase>>;

  pending: Pending;
  setPending: React.Dispatch<React.SetStateAction<Pending>>;

  actionRequired: ActionRequired;
  setActionRequired: React.Dispatch<React.SetStateAction<ActionRequired>>;

  clearActionRequired: () => void;

  lastPassive: PassiveTriggered;

  events: GameEvent[];
  clearEvents: () => void;

  chats: ChatMessage[];
  clearChats: () => void;

  gameOver: GameOver;
  clearGameOver: () => void;

  turnEndsAt: number | null;
  setTurnEndsAt: React.Dispatch<React.SetStateAction<number | null>>;

  pendingEndsAt: number | null;
  setPendingEndsAt: React.Dispatch<React.SetStateAction<number | null>>;

  lastError: string | null;
  clearError: () => void;

  wsUrl: string;
  setWsUrl: (v: string) => void;
  clientSessionId: string;

  ws: WebSocket | null;
  wsStatus: WsStatus;
  connectWS: (url: string) => void;
  sendWS: (obj: any) => void;
  closeWS: () => void;

  disconnectWS: () => void;
  leaveRoom: () => void;

  resetAll: () => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

function cleanRoomCode(x: any): string {
  return String(x ?? "")
    .replace(/[‎‏‪-‮]/g, "")
    .trim()
    .toUpperCase();
}

function normCode(x: any): string {
  return cleanRoomCode(x);
}

function normalizeWeaponKey(raw: string): WeaponKey | null {
  const s = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
  if (s === "colt_45" || s === "colt45") return "colt45";
  if (s === "volcanic") return "volcanic";
  if (s === "schofield") return "schofield";
  if (s === "remington") return "remington";
  if (s === "rev_carabine" || s === "revcarabine" || s === "carabine") return "rev_carabine";
  if (s === "winchester") return "winchester";
  return null;
}

function weaponKeyFromAnyWeaponCard(x: any): WeaponKey | null {
  if (!x) return null;
  const raw = String(x.weaponKey ?? x.weaponName ?? x.name ?? x.id ?? "").trim();
  if (!raw) return null;
  return normalizeWeaponKey(raw);
}

function weaponFromTableOrEquipment(table: any, equipment: any[]): WeaponKey {
  const fromTable = weaponKeyFromAnyWeaponCard(table?.weapon);
  if (fromTable) return fromTable;

  if (Array.isArray(equipment)) {
    const weaponCard = equipment.find((it: any) => String(it?.key) === "weapon");
    const fromEq = weaponKeyFromAnyWeaponCard(weaponCard);
    if (fromEq) return fromEq;
  }

  return "colt45";
}

function normalizeCharacterKey(v: any): string | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (!s) return null;

  if (s.includes("pedro")) return "pedro_ramirez";
  if (s.includes("kit")) return "kit_carlson";
  if (s.includes("lucky")) return "lucky_duke";
  if (s.includes("rose")) return "rose_doolan";
  if (s.includes("jesse")) return "jesse_jones";
  if (s.includes("janet")) return "calamity_janet";
  if (s.includes("el_gringo") || s.includes("gringo")) return "el_gringo";
  if (s.includes("willy")) return "willy_the_kid";
  if (s.includes("bart_cassidy") || s.includes("bart") || s.includes("cassidy")) return "bart_cassidy";
  if (s.includes("suzy")) return "suzy_lafayette";
  if (s.includes("paul")) return "paul_regret";
  if (s.includes("jourdonnais")) return "jourdonnais";
  if (s.includes("slab")) return "slab_the_killer";
  if (s.includes("sid_ketchum") || s === "sid" || s.includes("sid_ketchum")) return "sid_ketchum";
  return s;
}

function getCharacterAny(me: any): string | null {
  if (!me) return null;
  const v = me.playcharacter ?? me.playCharacter ?? null;
  return normalizeCharacterKey(v);
}

function parseLobbyPlayers(arr: any): LobbyPlayer[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p: any) => ({ id: String(p?.id ?? ""), name: String(p?.name ?? "") }))
    .filter((p: LobbyPlayer) => p.id && p.name);
}

function parsePublicPlayers(arr: any): PublicPlayer[] {
  if (!Array.isArray(arr)) return [];

  return arr.map((p: any) => {
    const equipment = Array.isArray(p?.equipment) ? p.equipment : [];
    const table = p?.table ?? null;
    const character = normalizeCharacterKey(p?.playcharacter ?? p?.playCharacter ?? null);

    return {
      ...p,
      id: String(p?.id ?? ""),
      name: String(p?.name ?? ""),
      equipment,
      handCount: Number(p?.handCount ?? 0),
      weaponKey: normalizeWeaponKey(String(p?.weaponKey ?? "")) ?? weaponFromTableOrEquipment(table, equipment),
      playcharacter: character,
      character,
      characterKey: character,
      disconnected: !!p?.disconnected,
      connectionLost: !!p?.connectionLost,
    };
  });
}

function guessKindFromFields(obj: any): string {
  if (!obj) return "unknown";
  if (Array.isArray(obj?.eligibleTargets)) return "choose_jesse_target";
  if (obj?.canUseDiscard === true) return "choose_pedro_source";
  if (Array.isArray(obj?.options) && obj.options.length > 0) return String(obj?.kind ?? "choose_draw");
  if (obj?.draws && Array.isArray(obj.draws)) return "choose_lucky_draw";
  return String(obj?.kind ?? obj?.type ?? "unknown");
}

function lowerKind(x: any): string {
  return String(x ?? "").toLowerCase().trim();
}

function idAt(arr: any, idx: any): string {
  if (!Array.isArray(arr)) return "";
  const i = Number(idx);
  if (!Number.isInteger(i) || i < 0 || i >= arr.length) return "";
  return String(arr[i] ?? "").trim();
}

function inferPendingOwnerId(obj: any): string {
  if (!obj || typeof obj !== "object") return "";

  const directPool = [
    obj?.forPlayerId,
    obj?.responderId,
    obj?.respondingPlayerId,
    obj?.toPlayerId,
    obj?.ownerId,
    obj?.victimId,
    obj?.targetId,
    obj?.playerId,
    obj?.pickerId,
  ];

  for (const v of directPool) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }

  const k = lowerKind(obj?.kind ?? obj?.type);

  if (k === "gatling" || k === "respond_to_gatling" || k === "indians" || k === "respond_to_indians") {
    return idAt(obj?.targets, obj?.idx);
  }
  if (k === "general_store" || k === "choose_general_store") {
    return idAt(obj?.order, obj?.idx);
  }
  if (k === "duel" || k === "respond_to_duel") {
    return String(obj?.responderId ?? "").trim();
  }
  if (
    k === "bang" ||
    k === "respond_to_bang" ||
    k === "barrel_choice" ||
    k === "choose_barrel" ||
    k === "revive" ||
    k === "respond_to_revive" ||
    k === "discard_limit" ||
    k === "draw_choice" ||
    k === "choose_draw" ||
    k === "jesse_choice" ||
    k === "choose_jesse_target" ||
    k === "pedro_choice" ||
    k === "choose_pedro_source" ||
    k === "lucky_choice" ||
    k === "choose_lucky_draw"
  ) {
    return String(obj?.playerId ?? obj?.targetId ?? "").trim();
  }

  return "";
}

function enrichPendingOwnership(raw: any): Pending {
  if (!raw || typeof raw !== "object") return raw ?? null;

  const next: any = { ...raw };
  const k = lowerKind(next?.kind ?? next?.type);

  if ((k === "gatling" || k === "respond_to_gatling" || k === "indians" || k === "respond_to_indians") && !next.targetId) {
    const inferred = idAt(next.targets, next.idx);
    if (inferred) next.targetId = inferred;
    if (inferred && !next.toPlayerId) next.toPlayerId = inferred;
  }

  if ((k === "duel" || k === "respond_to_duel") && !next.toPlayerId) {
    const inferred = String(next.responderId ?? "").trim();
    if (inferred) next.toPlayerId = inferred;
  }

  if ((k === "bang" || k === "respond_to_bang" || k === "barrel_choice" || k === "choose_barrel") && !next.toPlayerId) {
    const inferred = String(next.targetId ?? next.playerId ?? "").trim();
    if (inferred) next.toPlayerId = inferred;
  }

  if (
    (k === "revive" ||
      k === "respond_to_revive" ||
      k === "discard_limit" ||
      k === "draw_choice" ||
      k === "choose_draw" ||
      k === "jesse_choice" ||
      k === "choose_jesse_target" ||
      k === "pedro_choice" ||
      k === "choose_pedro_source" ||
      k === "lucky_choice" ||
      k === "choose_lucky_draw") &&
    !next.toPlayerId
  ) {
    const inferred = String(next.playerId ?? "").trim();
    if (inferred) next.toPlayerId = inferred;
  }

  if (k === "general_store" || k === "choose_general_store") {
    const inferred = String(next.pickerId ?? idAt(next.order, next.idx) ?? "").trim();
    if (inferred && !next.pickerId) next.pickerId = inferred;
    if (inferred && !next.toPlayerId) next.toPlayerId = inferred;
  }

  return next;
}

function normalizePendingAny(raw: any, outerKind?: string): Pending {
  if (!raw || typeof raw !== "object") {
    const ok = String(outerKind ?? "").trim();
    if (ok && ok.toLowerCase() !== "private") return enrichPendingOwnership({ kind: ok });
    return null;
  }

  let obj: any = raw;
  const k0 = lowerKind(obj?.kind ?? obj?.type);
  if (k0 === "private" && obj?.pending && typeof obj.pending === "object") {
    obj = { ...(obj.pending as any), privateKind: "private" };
  }
  const t0 = lowerKind(obj?.type);
  if (t0 === "private" && obj?.inner && typeof obj.inner === "object") {
    obj = { ...(obj.inner as any), privateKind: "private" };
  }

  const innerKind = String(obj?.kind ?? obj?.type ?? "").trim();
  const outer = String(outerKind ?? "").trim();
  const innerLower = innerKind.toLowerCase();
  const outerLower = outer.toLowerCase();

  let finalKind =
    innerKind && innerLower !== "private"
      ? innerKind
      : outer && outerLower !== "private"
      ? outer
      : guessKindFromFields(obj);

  if (!finalKind || lowerKind(finalKind) === "private") finalKind = "unknown";

  const privateKind =
    outerLower === "private"
      ? "private"
      : outer && outer !== finalKind
      ? outer
      : (obj as any)?.privateKind;

  return enrichPendingOwnership({ ...(obj as any), kind: finalKind, privateKind });
}

function isChooseDrawKind(k: any) {
  const s = lowerKind(k);
  return s === "choose_draw" || s === "draw_choice" || s.includes("choose_draw") || s.includes("draw_choice");
}

function responseKindFrom(msg: any): string {
  const outer = lowerKind(msg?.kind);
  const inner = lowerKind(msg?.pending?.kind ?? msg?.pending?.type);
  return inner || outer;
}

function isPersonalResponseKind(msg: any) {
  const k = responseKindFrom(msg);
  return (
    k === "respond_to_bang" ||
    k === "barrel_choice" ||
    k === "choose_barrel" ||
    k === "respond_to_duel" ||
    k === "respond_to_indians" ||
    k === "respond_to_gatling" ||
    k === "respond_to_revive" ||
    k === "bang" ||
    k === "revive" ||
    k === "need_missed" ||
    k === "respond_missed" ||
    k === "bang_missed" ||
    k === "need_missed_for_bang" ||
    k === "duel" ||
    k === "duel_missed" ||
    k === "need_missed_duel" ||
    k === "duel_response" ||
    k === "indians" ||
    k === "gatling"
  );
}

function addressedPlayerId(msg: any): string {
  const pool = [
    msg?.forPlayerId,
    msg?.responderId,
    msg?.respondingPlayerId,
    msg?.toPlayerId,
    msg?.ownerId,
    msg?.pending?.forPlayerId,
    msg?.pending?.responderId,
    msg?.pending?.respondingPlayerId,
    msg?.pending?.toPlayerId,
    msg?.pending?.ownerId,
    msg?.victimId,
    msg?.pending?.victimId,
    msg?.targetId,
    msg?.pending?.targetId,
    msg?.playerId,
    msg?.pending?.playerId,
    msg?.pickerId,
    msg?.pending?.pickerId,
  ];

  for (const v of pool) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }

  const fromPending = inferPendingOwnerId(msg?.pending);
  if (fromPending) return fromPending;
  return inferPendingOwnerId(msg);
}

function actionRequiredTargetsMe(msg: any, myId: string) {
  if (!isPersonalResponseKind(msg)) return true;
  if (!myId) return false;
  const ownerId = addressedPlayerId(msg);
  if (!ownerId) return false;
  return ownerId === myId;
}

function shouldClearStaleGeneralStoreAction(currentAction: ActionRequired, nextPending: Pending, myId: string) {
  if (!currentAction || !nextPending || !myId) return false;

  const actionKind = lowerKind(currentAction?.kind);
  const nextKind = lowerKind(nextPending?.kind);
  if (actionKind !== "choose_general_store" || nextKind !== "general_store") return false;

  const pickerId = String((nextPending as any)?.pickerId ?? "");
  if (!pickerId) return false;
  return pickerId !== myId;
}

function shouldKeepPrevPendingWhileWaiting(prev: Pending) {
  if (!prev) return false;

  const k = lowerKind((prev as any)?.kind);

  if (isPersonalResponseKind({ kind: k, pending: prev })) return false;

  return true;
}

function shouldClearActionRequiredFromPrivatePending(currentAction: ActionRequired, nextPending: Pending) {
  if (!currentAction) return false;

  const actionKind = lowerKind(currentAction?.kind);
  const nextKind = lowerKind((nextPending as any)?.kind);

  if (!nextPending) return true;

  const sameOwner = addressedPlayerId(currentAction) === addressedPlayerId({ pending: nextPending });
  const sameResponseGroup =
    isPersonalResponseKind(currentAction) &&
    isPersonalResponseKind({ kind: nextKind, pending: nextPending });
  const sameGeneralStoreGroup =
    actionKind === "choose_general_store" &&
    nextKind === "general_store";

  if (sameGeneralStoreGroup && sameOwner) return false;
  if (sameResponseGroup && sameOwner) return false;

  return actionKind !== nextKind || !sameOwner;
}

function resolvePlayerNameFromKnownLists(
  playerId: string,
  players: PublicPlayer[],
  me: MePlayer | null,
  lobbyPlayers: LobbyPlayer[]
) {
  const pid = String(playerId ?? "").trim();
  if (!pid) return "";

  if (String(me?.id ?? "").trim() === pid) {
    return String(me?.name ?? "").trim();
  }

  const pub = Array.isArray(players)
    ? players.find((p: any) => String(p?.id ?? "").trim() === pid)
    : null;
  if (pub?.name) return String(pub.name).trim();

  const lobby = Array.isArray(lobbyPlayers)
    ? lobbyPlayers.find((p: any) => String(p?.id ?? "").trim() === pid)
    : null;
  if (lobby?.name) return String(lobby.name).trim();

  return "";
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState("");
  const [avatarUri, setAvatarUri] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [lobbyPlayerId, setLobbyPlayerId] = useState("");
  const [hostId, setHostId] = useState("");

  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [roomReady, setRoomReady] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(7);

  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [discardCount, setDiscardCount] = useState(0);
  const [discardTop, setDiscardTop] = useState<any | null>(null);
  const [deckCount, setDeckCount] = useState<number | null>(null);
  const [me, setMe] = useState<MePlayer | null>(null);
  const [turnPlayerId, setTurnPlayerId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("main");
  const [pending, setPending] = useState<Pending>(null);

  const [actionRequired, setActionRequired] = useState<ActionRequired>(null);
  const clearActionRequired = () => setActionRequired(null);

  const passiveSeqRef = useRef(0);
  const [lastPassive, setLastPassive] = useState<PassiveTriggered>(null);

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [gameOver, setGameOver] = useState<GameOver>(null);

  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [pendingEndsAt, setPendingEndsAt] = useState<number | null>(null);

  const [lastError, setLastError] = useState<string | null>(null);
  const clearError = () => setLastError(null);

  const [wsUrl, setWsUrl] = useState("");

  const clientSessionIdRef = useRef(APP_CLIENT_SESSION_ID);
  const pendingConnectUrlRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [wsTick, setWsTick] = useState(0);

  const manualCloseRef = useRef(false);
  const reconnectTimerRef = useRef<any>(null);
  const reconnectUntilRef = useRef(0);
  const reconnectSessionRef = useRef<{ roomCode: string; playerId: string; name: string }>({ roomCode: "", playerId: "", name: "" });
  const heartbeatTimerRef = useRef<any>(null);
  const lastInboundAtRef = useRef<number>(0);
  const heartbeatMissesRef = useRef(0);
  const serverClockOffsetRef = useRef<number | null>(null);

  const myIdRef = useRef("");
  const actionRequiredRef = useRef<ActionRequired>(null);
  const lastTurnRef = useRef<{ playerId: string; localEnd: number | null }>({ playerId: "", localEnd: null });
  const lastPendingRef = useRef<{ ownerId: string; localEnd: number | null }>({ ownerId: "", localEnd: null });

  const playersRef = useRef<PublicPlayer[]>([]);
  const meRef = useRef<MePlayer | null>(null);
  const lobbyPlayersRef = useRef<LobbyPlayer[]>([]);
  const roomCodeRef = useRef("");
  const prevRoomCodeRef = useRef("");

  useEffect(() => {
    myIdRef.current = String(me?.id ?? "").trim();
  }, [me?.id]);

  useEffect(() => {
    actionRequiredRef.current = actionRequired;
  }, [actionRequired]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    lobbyPlayersRef.current = lobbyPlayers;
  }, [lobbyPlayers]);

  useEffect(() => {
    const next = normCode(roomCode);
    roomCodeRef.current = next;
    if (prevRoomCodeRef.current && prevRoomCodeRef.current !== next) {
      setChats([]);
    }
    if (!next && prevRoomCodeRef.current) {
      setChats([]);
    }
    prevRoomCodeRef.current = next;
  }, [roomCode]);

  const isLobbyHost = !!lobbyPlayerId && !!hostId && lobbyPlayerId === hostId;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      console.log("APP STATE:", state);
      if (state !== "active") {
        stopHeartbeat();
      } else {
        const s = wsRef.current;
        if (s && s.readyState === WebSocket.OPEN) {
          startHeartbeat(s);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const updateServerClockOffset = (serverNow: any) => {
    const srv = Number(serverNow ?? 0);
    if (!Number.isFinite(srv) || srv <= 0) return;

    const nextOffset = srv - Date.now();
    const prevOffset = serverClockOffsetRef.current;

    if (prevOffset == null || Math.abs(nextOffset - prevOffset) > 2000) {
      serverClockOffsetRef.current = nextOffset;
      return;
    }

    serverClockOffsetRef.current = prevOffset * 0.85 + nextOffset * 0.15;
  };

  const toLocalEndAt = (rawEndAt: any, serverNow: any) => {
    const endAt = Number(rawEndAt ?? 0);
    if (!Number.isFinite(endAt) || endAt <= 0) return null;

    updateServerClockOffset(serverNow);

    const offset = serverClockOffsetRef.current;
    if (offset == null) {
      return endAt;
    }

    return endAt - offset;
  };

  const applyTurnTiming = (msg: any, source: "turn_started" | "game_state" | "me_state") => {
    const nextPlayerId = String(msg?.turnPlayerId ?? "").trim();
    const localEnd = toLocalEndAt(msg?.turnEndsAt, msg?.serverNow);
    if (!localEnd) return;

    const prev = lastTurnRef.current;
    const force = source === "turn_started";

    let accept = false;
    if (force || !prev.localEnd) accept = true;
    else if (nextPlayerId && nextPlayerId === prev.playerId) accept = localEnd >= prev.localEnd - 1500;
    else accept = localEnd > prev.localEnd + 1500;

    if (!accept) return;

    lastTurnRef.current = { playerId: nextPlayerId, localEnd };
    setTurnEndsAt(localEnd);
  };

  const applyPendingTiming = (msg: any, nextPending: any) => {
    const localEnd = toLocalEndAt(msg?.pendingEndsAt, msg?.serverNow);
    if (!localEnd) {
      if (!nextPending) setPendingEndsAt(null);
      return;
    }

    const ownerId = addressedPlayerId({ ...msg, pending: nextPending });
    const prev = lastPendingRef.current;

    let accept = false;
    if (!prev.localEnd) accept = true;
    else if (ownerId && ownerId === prev.ownerId) accept = localEnd >= prev.localEnd - 1500;
    else accept = localEnd > prev.localEnd + 1500;

    if (!accept) return;

    lastPendingRef.current = { ownerId, localEnd };
    setPendingEndsAt(localEnd);
  };

  const pushEvent = (msg: any) => {
    const t = String(msg?.type ?? "event");
    let enriched = msg;

    if (t === "draw_check") {
      const pid = String(msg?.playerId ?? "").trim();
      const playerName = resolvePlayerNameFromKnownLists(
        pid,
        playersRef.current,
        meRef.current,
        lobbyPlayersRef.current
      );

      if (playerName && !msg?.playerName && !msg?.playerDisplayName && !msg?.name) {
        enriched = { ...msg, playerName };
      }
    }

    const evt: GameEvent = {
      ...enriched,
      type: t,
      ts: typeof enriched?.ts === "number" ? enriched.ts : Date.now(),
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    };

    setEvents((prev) => {
      const next = [...prev, evt];
      return next.length > 80 ? next.slice(-80) : next;
    });
  };

  const clearEvents = () => setEvents([]);
  const clearChats = () => setChats([]);
  const clearGameOver = () => setGameOver(null);

  const stopReconnectLoop = () => {
    pendingConnectUrlRef.current = null;
    if (reconnectTimerRef.current) {
      try {
        clearTimeout(reconnectTimerRef.current);
      } catch {}
    }
    reconnectTimerRef.current = null;
    reconnectUntilRef.current = 0;
  };

  const rememberReconnectSession = (next: Partial<{ roomCode: string; playerId: string; name: string }>) => {
    reconnectSessionRef.current = {
      roomCode: String(next.roomCode ?? reconnectSessionRef.current.roomCode ?? "").trim().toUpperCase(),
      playerId: String(next.playerId ?? reconnectSessionRef.current.playerId ?? "").trim(),
      name: String(next.name ?? reconnectSessionRef.current.name ?? name ?? "").trim(),
    };
  };

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      try {
        clearInterval(heartbeatTimerRef.current);
      } catch {}
    }
    heartbeatTimerRef.current = null;
    heartbeatMissesRef.current = 0;
  };

  const startHeartbeat = (socket: WebSocket) => {
    stopHeartbeat();
    lastInboundAtRef.current = Date.now();
    heartbeatMissesRef.current = 0;

    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current !== socket) return;
      if (socket.readyState !== WebSocket.OPEN) return;
      if (AppState.currentState !== "active") return;

      const idleMs = Date.now() - lastInboundAtRef.current;
      if (idleMs > 45000) {
        heartbeatMissesRef.current += 1;
      } else {
        heartbeatMissesRef.current = 0;
      }

      if (heartbeatMissesRef.current >= 2) {
        console.log("WS HEARTBEAT TIMEOUT -> closing socket");
        try {
          socket.close();
        } catch {}
        return;
      }

      try {
        socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        if (__DEV__) console.log("WS OUT:", { type: "ping" });
      } catch {}
    }, 10000);
  };

  const tryScheduleReconnect = () => {
    const { roomCode: savedRoomCode, playerId: savedPlayerId } = reconnectSessionRef.current;
    const hasRecoverableSession = !!savedRoomCode && !!savedPlayerId;
    if (!hasRecoverableSession || !wsUrl || gameOver) return;

    const now = Date.now();
    if (!reconnectUntilRef.current || reconnectUntilRef.current <= now) {
      reconnectUntilRef.current = now + 30_000;
    }

    if (reconnectTimerRef.current) return;

    const attempt = () => {
      reconnectTimerRef.current = null;
      if (manualCloseRef.current) return;
      if (Date.now() >= reconnectUntilRef.current) return;

      const cur = wsRef.current;
      if (cur && (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING)) return;

      setWsStatus("reconnecting");
      connectWS(wsUrl);
      reconnectTimerRef.current = setTimeout(attempt, 1500);
    };

    reconnectTimerRef.current = setTimeout(attempt, 800);
  };

  const resetAll = () => {
    setRoomCode("");
    setLobbyPlayerId("");
    setHostId("");
    setLobbyPlayers([]);
    setRoomReady(false);
    setMaxPlayers(7);

    setPlayers([]);
    setDiscardCount(0);
    setDiscardTop(null);
    setDeckCount(null);
    setMe(null);
    setTurnPlayerId(null);

    setPhase("main");
    setPending(null);
    setActionRequired(null);

    setTurnEndsAt(null);
    setPendingEndsAt(null);

    setLastError(null);

    passiveSeqRef.current = 0;
    setLastPassive(null);

    setEvents([]);
    setChats([]);
    setGameOver(null);

    stopReconnectLoop();
    stopHeartbeat();
    reconnectSessionRef.current = { roomCode: "", playerId: "", name: "" };

    myIdRef.current = "";
    actionRequiredRef.current = null;
    lastTurnRef.current = { playerId: "", localEnd: null };
    lastPendingRef.current = { ownerId: "", localEnd: null };
    playersRef.current = [];
    meRef.current = null;
    lobbyPlayersRef.current = [];
  };

  const connectWS = (url: string) => {
    if (!url) return;

    setWsUrl(url);

    const cur = wsRef.current;
    if (cur) {
      if (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING) return;
      if (cur.readyState === WebSocket.CLOSING) {
        pendingConnectUrlRef.current = url;
        return;
      }
    }

    pendingConnectUrlRef.current = null;

    if (!manualCloseRef.current && reconnectSessionRef.current.roomCode && reconnectSessionRef.current.playerId) {
      setWsStatus("reconnecting");
    } else {
      setWsStatus("connecting");
    }

    manualCloseRef.current = false;
    const s = new WebSocket(url);
    wsRef.current = s;
    setWsTick((x) => x + 1);

    s.onopen = () => {
      if (wsRef.current !== s) return;
      pendingConnectUrlRef.current = null;
      setWsStatus("open");
      startHeartbeat(s);

      const { roomCode: savedRoomCode, playerId: savedPlayerId, name: savedName } = reconnectSessionRef.current;
      if (!manualCloseRef.current && savedRoomCode && savedPlayerId) {
        try {
          s.send(
            JSON.stringify({
              type: "reconnect",
              roomCode: savedRoomCode,
              playerId: savedPlayerId,
              name: savedName || name || "",
              clientSessionId: clientSessionIdRef.current,
            })
          );
          if (__DEV__) console.log("WS OUT:", { type: "reconnect", roomCode: savedRoomCode, playerId: savedPlayerId });
        } catch {}
      }
    };

    s.onclose = (ev: any) => {
      console.log("WS CLOSED", {
        code: ev?.code,
        reason: ev?.reason,
        wasClean: ev?.wasClean,
      });

      stopHeartbeat();

      if (wsRef.current === s) {
        wsRef.current = null;
        setWsTick((x) => x + 1);
      }

      const queuedUrl = pendingConnectUrlRef.current;
      if (queuedUrl) {
        pendingConnectUrlRef.current = null;
        manualCloseRef.current = false;
        setWsStatus("closed");
        setTimeout(() => connectWS(queuedUrl), 0);
        return;
      }

      if (manualCloseRef.current) {
        manualCloseRef.current = false;
        stopReconnectLoop();
        setWsStatus("closed");
        return;
      }

      setWsStatus("closed");
      tryScheduleReconnect();
    };

    s.onerror = (ev: any) => {
      console.log("WS ERROR", ev);
      if (wsRef.current !== s) return;
      setWsStatus("error");
    };

    s.onmessage = (e: any) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch (err) {
        console.log("WS JSON PARSE ERROR", err, e?.data);
        return;
      }

      try {
        lastInboundAtRef.current = Date.now();

        if (__DEV__) console.log("WS IN:", msg);

        updateServerClockOffset(msg?.serverNow);

        if (msg.type === "pong") {
          return;
        }

        if (msg.type === "ping") {
          try {
            s.send(JSON.stringify({ type: "pong", ts: msg.ts ?? Date.now() }));
          } catch {}
          return;
        }

      if (msg.type === "error") {
        setLastError(String(msg.message ?? "Server error"));
        return;
      }

      if (msg.type === "chat_message") {
        const chatRoom = normCode(msg.roomCode);
        const currentRoom = roomCodeRef.current || normCode(reconnectSessionRef.current.roomCode);
        if (currentRoom && chatRoom && currentRoom !== chatRoom) {
          return;
        }

        const nextChat: ChatMessage = {
          id: String(msg.id ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`),
          ts: Number(msg.ts ?? Date.now()),
          roomCode: chatRoom,
          playerId: String(msg.playerId ?? ""),
          name: String(msg.name ?? "Player"),
          text: String(msg.text ?? "").trim(),
        };
        setChats((prev) => [...prev.filter((c) => !chatRoom || normCode(c?.roomCode) === chatRoom), nextChat].slice(-60));
        return;
      }

      if (
        msg.type === "card_played" ||
        msg.type === "card_discarded" ||
        msg.type === "player_passed" ||
        msg.type === "action_resolved" ||
        msg.type === "passive_triggered" ||
        msg.type === "draw_check" ||
        msg.type === "turn_started" ||
        msg.type === "turn_ended" ||
        msg.type === "game_over" ||
        msg.type === "action_required" ||
        msg.type === "general_store_open" ||
        msg.type === "general_store_pick" ||
        msg.type === "general_store_update" ||
        msg.type === "player_connection_lost" ||
        msg.type === "player_reconnected" ||
        msg.type === "player_disconnected" ||
        msg.type === "chat_message"
      ) {
        pushEvent(msg);
      }

      if (msg.type === "game_over") {
        setGameOver(msg as any);
      }

      if (msg.type === "passive_triggered") {
        passiveSeqRef.current += 1;
        setLastPassive({ ...msg, seq: passiveSeqRef.current });
      }

      if (msg.type === "created" || msg.type === "joined" || msg.type === "reconnected") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        const nextLobbyPlayerId = String(msg.playerId ?? reconnectSessionRef.current.playerId ?? "").trim();
        if (nextLobbyPlayerId) setLobbyPlayerId(nextLobbyPlayerId);
        const nextHostId = String(msg.hostId ?? "").trim();
        if (nextHostId || msg.hostId === "") setHostId(nextHostId);
        rememberReconnectSession({ roomCode: code || reconnectSessionRef.current.roomCode, playerId: nextLobbyPlayerId, name });
        stopReconnectLoop();
        if (msg.players) setLobbyPlayers(parseLobbyPlayers(msg.players));
        if (typeof msg.maxPlayers === "number") setMaxPlayers(msg.maxPlayers);
        if (typeof msg.ready === "boolean") setRoomReady(msg.ready);
        return;
      }

      if (msg.type === "room_update") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        if (code) rememberReconnectSession({ roomCode: code, name });
        setLobbyPlayers(parseLobbyPlayers(msg.players));
        setRoomReady(Boolean(msg.ready));
        setHostId(String(msg.hostId ?? "").trim());
        if (typeof msg.maxPlayers === "number") setMaxPlayers(msg.maxPlayers);
        return;
      }

      if (msg.type === "host_changed") {
        setHostId(String(msg.hostId ?? "").trim());
        return;
      }

      if (msg.type === "started" || msg.type === "game_started") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);
        return;
      }

      if (msg.type === "turn_started") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);
        applyTurnTiming(msg, "turn_started");
        setPhase("main");
        setPending(null);
        setPendingEndsAt(null);
        setActionRequired(null);
        return;
      }

      if (msg.type === "action_required") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        const outerKind = String(msg.kind ?? "").trim();
        const raw = msg.pending ?? { ...msg };
        const nextPending = normalizePendingAny(raw, outerKind);

        if (!actionRequiredTargetsMe({ ...msg, pending: nextPending }, myIdRef.current)) {
          return;
        }

        setPhase("waiting");
        setActionRequired(msg as any);
        setPending(nextPending ? ({ ...(nextPending as any), __source: "action_required" } as any) : null);
        applyPendingTiming(msg, nextPending);
        return;
      }

      if (msg.type === "action_resolved") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        const resolvedKind = lowerKind(msg?.kind);
        if (resolvedKind === "player_dying") {
          return;
        }

        if (resolvedKind === "bang_partial_missed") {
          return;
        }

        // action_resolved is descriptive only.
        // Do not clear pending/timers here, otherwise flows like Gatling, Duel,
        // Dynamite revive, and other chained responses lose their active timer/UI.
        return;
      }

      if (msg.type === "game_state") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);
        if (msg.phase === "main" || msg.phase === "waiting") setPhase(msg.phase);

        const rawNextPending = msg.pending ?? null;
        const normalizedNextPending = rawNextPending ? normalizePendingAny(rawNextPending) : null;

        setPending((prev) => {
          if (!rawNextPending && msg.phase === "waiting") {
            return shouldKeepPrevPendingWhileWaiting(prev) ? prev : null;
          }

          if (!rawNextPending) return null;

          const next = normalizedNextPending;

          if (next && isPersonalResponseKind({ kind: next.kind, pending: next })) {
            const ownerId = addressedPlayerId({ ...msg, pending: next });
            if (!myIdRef.current) return null;
            if (!ownerId) return null;
            if (ownerId !== myIdRef.current) return null;
          }

          if (
            next &&
            isChooseDrawKind(next.kind) &&
            !Array.isArray((next as any).options) &&
            prev &&
            isChooseDrawKind((prev as any)?.kind) &&
            Array.isArray((prev as any).options)
          ) {
            return { ...next, options: (prev as any).options, __source: "game_state" } as any;
          }

          return next ? ({ ...(next as any), __source: "game_state" } as any) : next;
        });

        applyTurnTiming(msg, "game_state");
        applyPendingTiming(msg, normalizedNextPending);
        if (typeof msg.discardCount === "number") setDiscardCount(msg.discardCount);
        if (msg.discardTop !== undefined) setDiscardTop(msg.discardTop ?? null);
        if (typeof msg.deckCount === "number") setDeckCount(msg.deckCount);
        setPlayers(parsePublicPlayers(msg.players));

        const nextPublicPending = normalizePendingAny(msg.pending ?? null);
        if (msg.phase === "waiting" && shouldClearStaleGeneralStoreAction(actionRequiredRef.current, nextPublicPending, myIdRef.current)) {
          setActionRequired(null);
        }
        if (msg.phase === "waiting" && shouldClearActionRequiredFromPrivatePending(actionRequiredRef.current, nextPublicPending)) {
          setActionRequired(null);
        }
        if (msg.phase === "main" && !msg.pending) {
          setActionRequired(null);
        }
        return;
      }

      if (msg.type === "me_state") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);
        if (msg.phase === "main" || msg.phase === "waiting") setPhase(msg.phase);
        applyTurnTiming(msg, "me_state");

        const rawPrivatePending = msg.pending === undefined ? undefined : msg.pending;
        const normalizedPrivatePending = rawPrivatePending == null ? null : normalizePendingAny(rawPrivatePending);
        if (msg.pending !== undefined) {
          setPending((prev) => {
            if (rawPrivatePending === null && msg.phase === "waiting") {
              return shouldKeepPrevPendingWhileWaiting(prev) ? prev : null;
            }

            if (rawPrivatePending === null) return null;

            const next = normalizedPrivatePending;
            if (!next) return null;

            if (isPersonalResponseKind({ kind: next.kind, pending: next })) {
              const currentMeId = String(msg?.me?.id ?? myIdRef.current ?? "").trim();
              const ownerId = addressedPlayerId({ ...msg, pending: next });
              if (!currentMeId) return null;
              if (!ownerId) return null;
              if (ownerId !== currentMeId) return null;
            }

            if (
              isChooseDrawKind(next.kind) &&
              !Array.isArray((next as any).options) &&
              prev &&
              isChooseDrawKind((prev as any)?.kind) &&
              Array.isArray((prev as any).options)
            ) {
              return { ...next, options: (prev as any).options, __source: "me_state" } as any;
            }

            return { ...(next as any), __source: "me_state" } as any;
          });
        }

        if (typeof msg.discardCount === "number") setDiscardCount(msg.discardCount);
        if (msg.discardTop !== undefined) setDiscardTop(msg.discardTop ?? null);
        if (typeof msg.deckCount === "number") setDeckCount(msg.deckCount);

        if (msg.me) {
          const equipment = Array.isArray(msg.me?.equipment) ? msg.me.equipment : [];
          const table = msg.me?.table ?? null;
          const weaponKey = normalizeWeaponKey(String(msg.me?.weaponKey ?? "")) ?? weaponFromTableOrEquipment(table, equipment);
          const character = getCharacterAny(msg.me);

          const m: MePlayer = {
            ...(msg.me as any),
            id: String(msg.me?.id ?? ""),
            name: String(msg.me?.name ?? ""),
            equipment,
            hand: Array.isArray(msg.me?.hand) ? msg.me.hand : [],
            weaponKey,
            weapon: weaponKey,
            character,
            characterKey: character,
            playcharacter: character,
            disconnected: !!msg.me?.disconnected,
            connectionLost: !!msg.me?.connectionLost,
          } as any;

          myIdRef.current = String(m.id ?? "");
          rememberReconnectSession({ roomCode: code || roomCode, playerId: myIdRef.current, name: String(m.name ?? name ?? "") });
          stopReconnectLoop();
          setMe(m);
        }

        const nextPrivatePending = msg.pending === undefined ? null : normalizedPrivatePending;
        applyPendingTiming(msg, nextPrivatePending);

        if (msg.pending !== undefined && shouldClearActionRequiredFromPrivatePending(actionRequiredRef.current, nextPrivatePending)) {
          setActionRequired(null);
        }
        if (msg.phase === "waiting" && shouldClearStaleGeneralStoreAction(actionRequiredRef.current, nextPrivatePending, myIdRef.current)) {
          setActionRequired(null);
        }
        if (msg.phase === "main") {
          setActionRequired(null);
        }
        return;
      }
      } catch (err: any) {
        console.log("WS MESSAGE HANDLER CRASH", {
          error: String(err?.message ?? err),
          stack: err?.stack,
          msg,
        });
        setLastError(`WS handler crash: ${String(err?.message ?? err)}`);
      }
    };
  };

  const sendWS = (obj: any) => {
    const s = wsRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    if (__DEV__) console.log("WS OUT:", obj);
    s.send(JSON.stringify(obj));
  };

  const closeWS = () => {
    manualCloseRef.current = true;
    stopReconnectLoop();
    stopHeartbeat();

    const s = wsRef.current;
    if (!s) {
      setWsStatus("closed");
      return;
    }

    try {
      if (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING) {
        s.close();
      }
    } catch {}
  };

  const disconnectWS = () => {
    manualCloseRef.current = true;
    stopReconnectLoop();
    stopHeartbeat();

    const s = wsRef.current;
    if (!s) {
      setWsStatus("closed");
      return;
    }

    try {
      if (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING) {
        s.close();
      }
    } catch {}
  };

  const leaveRoom = () => {
    manualCloseRef.current = true;
    stopReconnectLoop();
    stopHeartbeat();

    const s = wsRef.current;
    try {
      if (s && s.readyState === WebSocket.OPEN) {
        const code = reconnectSessionRef.current.roomCode || roomCode;
        const payload: any = { type: "leave" };
        if (code) payload.roomCode = code;
        if (__DEV__) console.log("WS OUT:", payload);
        s.send(JSON.stringify(payload));
      }
    } catch {}

    if (!s) {
      setWsStatus("closed");
      return;
    }

    try {
      if (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING) {
        s.close(1000, "leave_room");
      }
    } catch {}
  };

  const value = useMemo<PlayerContextType>(
    () => ({
      name,
      setName,
      avatarUri,
      setAvatarUri,
      roomCode,
      setRoomCode,
      lobbyPlayerId,
      setLobbyPlayerId,
      hostId,
      setHostId,
      isLobbyHost,
      lobbyPlayers,
      setLobbyPlayers,
      roomReady,
      setRoomReady,
      maxPlayers,
      setMaxPlayers,
      players,
      setPlayers,
      discardCount,
      setDiscardCount,
      discardTop,
      setDiscardTop,
      deckCount,
      setDeckCount,
      me,
      setMe,
      turnPlayerId,
      setTurnPlayerId,
      phase,
      setPhase,
      pending,
      setPending,
      actionRequired,
      setActionRequired,
      clearActionRequired,
      lastPassive,
      turnEndsAt,
      setTurnEndsAt,
      pendingEndsAt,
      setPendingEndsAt,
      events,
      clearEvents,
      chats,
      clearChats,
      gameOver,
      clearGameOver,
      lastError,
      clearError,
      wsUrl,
      setWsUrl,
      clientSessionId: clientSessionIdRef.current,
      ws: wsRef.current,
      wsStatus,
      connectWS,
      sendWS,
      closeWS,
      disconnectWS,
      leaveRoom,
      resetAll,
    }),
    [
      name,
      avatarUri,
      roomCode,
      lobbyPlayerId,
      hostId,
      isLobbyHost,
      lobbyPlayers,
      roomReady,
      maxPlayers,
      players,
      discardCount,
      discardTop,
      deckCount,
      me,
      turnPlayerId,
      phase,
      pending,
      actionRequired,
      lastPassive,
      turnEndsAt,
      pendingEndsAt,
      events,
      chats,
      gameOver,
      lastError,
      wsStatus,
      wsUrl,
      wsTick,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}