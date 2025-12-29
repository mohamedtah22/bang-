import React, { createContext, useContext, useMemo, useRef, useState } from "react";

type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";
type Role = "sheriff" | "deputy" | "outlaw" | "renegade";

type Phase = "main" | "waiting";
type Pending = { kind: "bang"; attackerId: string; targetId: string } | null;

/** ✅ BANG! base game weapons */
export type WeaponKey =
  | "colt45"
  | "volcanic"
  | "schofield"
  | "remington"
  | "rev_carabine"
  | "winchester";

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

export type LobbyPlayer = { id: string; name: string };

export type PublicPlayer = {
  id: string;
  name: string;
  role: Role;
  playcharacter: string;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  equipment: any[];
  handCount: number;

  weaponKey: WeaponKey;
};

export type MePlayer = Omit<PublicPlayer, "handCount"> & { hand: any[] };

type PlayerContextType = {
  /** lobby inputs */
  name: string;
  setName: (v: string) => void;

  avatarUri: string;
  setAvatarUri: (v: string) => void;

  /** room state */
  roomCode: string;
  setRoomCode: (v: string) => void;

  /** lobby state */
  lobbyPlayers: LobbyPlayer[];
  setLobbyPlayers: React.Dispatch<React.SetStateAction<LobbyPlayer[]>>;

  /** game state */
  players: PublicPlayer[];
  setPlayers: React.Dispatch<React.SetStateAction<PublicPlayer[]>>;

  me: MePlayer | null;
  setMe: React.Dispatch<React.SetStateAction<MePlayer | null>>;

  turnPlayerId: string | null;
  setTurnPlayerId: React.Dispatch<React.SetStateAction<string | null>>;

  phase: Phase;
  pending: Pending;
  turnEndsAt: number | null;
  pendingEndsAt: number | null;

  lastError: string | null;
  clearError: () => void;

  /** WebSocket shared */
  ws: WebSocket | null;
  wsStatus: WsStatus;
  connectWS: (url: string) => void;
  sendWS: (obj: any) => void;
  closeWS: () => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

/** helpers */
function extractKey(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x.key ?? x.cardKey ?? x.id ?? x.name ?? "");
}

function normalizeWeaponKey(raw: string): WeaponKey | null {
  const s = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
  if (s === "colt_45" || s === "colt45") return "colt45";
  if (s === "volcanic") return "volcanic";
  if (s === "schofield") return "schofield";
  if (s === "remington") return "remington";
  if (s === "rev_carabine" || s === "revcarabine") return "rev_carabine";
  if (s === "winchester") return "winchester";
  return null;
}

function weaponFromEquipment(equipment: any[]): WeaponKey {
  if (!Array.isArray(equipment)) return "colt45";
  for (const it of equipment) {
    const k = normalizeWeaponKey(extractKey(it));
    if (k) return k;
  }
  return "colt45";
}

function normCode(x: any): string {
  return String(x ?? "").trim().toUpperCase();
}

function parseLobbyPlayers(arr: any): LobbyPlayer[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p: any) => ({
      id: String(p?.id ?? ""),
      name: String(p?.name ?? ""),
    }))
    .filter((p: LobbyPlayer) => p.id && p.name);
}

function parsePublicPlayers(arr: any): PublicPlayer[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((p: any) => ({
    ...p,
    id: String(p?.id ?? ""),
    name: String(p?.name ?? ""),
    weaponKey: (p?.weaponKey as WeaponKey) ?? weaponFromEquipment(p?.equipment),
  }));
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  /** lobby inputs */
  const [name, setName] = useState("");
  const [avatarUri, setAvatarUri] = useState("");

  /** room */
  const [roomCode, setRoomCode] = useState("");

  /** lobby + game */
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [me, setMe] = useState<MePlayer | null>(null);
  const [turnPlayerId, setTurnPlayerId] = useState<string | null>(null);

  /** ✅ extra runtime */
  const [phase, setPhase] = useState<Phase>("main");
  const [pending, setPending] = useState<Pending>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [pendingEndsAt, setPendingEndsAt] = useState<number | null>(null);

  const [lastError, setLastError] = useState<string | null>(null);
  const clearError = () => setLastError(null);

  /** ws */
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [, force] = useState(0);

  const connectWS = (url: string) => {
    const cur = wsRef.current;
    if (cur && (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING)) return;

    setWsStatus("connecting");
    const s = new WebSocket(url);
    wsRef.current = s;
    force((x) => x + 1);

    s.onopen = () => setWsStatus("open");
    s.onclose = () => setWsStatus("closed");
    s.onerror = () => setWsStatus("error");

    s.onmessage = (e: any) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (__DEV__) console.log("WS IN:", msg);

      if (msg.type === "error") {
        setLastError(String(msg.message ?? "Server error"));
        return;
      }

      if (msg.type === "created" || msg.type === "joined") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        if (msg.players) setLobbyPlayers(parseLobbyPlayers(msg.players));
        return;
      }

      if (msg.type === "room_update") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        setLobbyPlayers(parseLobbyPlayers(msg.players));
        return;
      }

      if (msg.type === "started") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        return;
      }

      if (msg.type === "turn_started") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);
        if (typeof msg.turnEndsAt === "number") setTurnEndsAt(msg.turnEndsAt);
        return;
      }

      if (msg.type === "action_required") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        setPhase("waiting");
        if (typeof msg.pendingEndsAt === "number") setPendingEndsAt(msg.pendingEndsAt);

        if (msg.kind === "respond_to_bang" && typeof msg.fromPlayerId === "string") {
        }
        return;
      }

      if (msg.type === "action_resolved") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        return;
      }

      if (msg.type === "game_state") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);

        // phase/pending/timers
        if (msg.phase === "main" || msg.phase === "waiting") setPhase(msg.phase);
        setPending((msg.pending ?? null) as Pending);

        if (typeof msg.turnEndsAt === "number") setTurnEndsAt(msg.turnEndsAt);
        if (typeof msg.pendingEndsAt === "number") setPendingEndsAt(msg.pendingEndsAt);

        setPlayers(parsePublicPlayers(msg.players));
        return;
      }

      // ✅ me_state
      if (msg.type === "me_state") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        if (msg.me) {
          const m: MePlayer = {
            ...msg.me,
            weaponKey: (msg.me?.weaponKey as WeaponKey) ?? weaponFromEquipment(msg.me?.equipment),
          };
          setMe(m);
        }
        return;
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
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    setWsStatus("closed");
    force((x) => x + 1);
  };

  const value = useMemo<PlayerContextType>(
    () => ({
      name,
      setName,
      avatarUri,
      setAvatarUri,

      roomCode,
      setRoomCode,

      lobbyPlayers,
      setLobbyPlayers,

      players,
      setPlayers,

      me,
      setMe,

      turnPlayerId,
      setTurnPlayerId,

      phase,
      pending,
      turnEndsAt,
      pendingEndsAt,

      lastError,
      clearError,

      ws: wsRef.current,
      wsStatus,
      connectWS,
      sendWS,
      closeWS,
    }),
    [
      name,
      avatarUri,
      roomCode,
      lobbyPlayers,
      players,
      me,
      turnPlayerId,
      phase,
      pending,
      turnEndsAt,
      pendingEndsAt,
      lastError,
      wsStatus,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
