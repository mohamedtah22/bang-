import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import type { LobbyPlayer, PublicPlayer, MePlayer } from "../models/player";
import type { WeaponKey } from "../models/card";

type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

type Phase = "main" | "waiting";
type Pending = null | { kind: string; [k: string]: any };

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
  /** profile */
  name: string;
  setName: (v: string) => void;

  avatarUri: string;
  setAvatarUri: (v: string) => void;

  /** room */
  roomCode: string;
  setRoomCode: (v: string) => void;

  /** lobby */
  lobbyPlayers: LobbyPlayer[];
  setLobbyPlayers: React.Dispatch<React.SetStateAction<LobbyPlayer[]>>;

  roomReady: boolean;
  setRoomReady: React.Dispatch<React.SetStateAction<boolean>>;

  maxPlayers: number;
  setMaxPlayers: React.Dispatch<React.SetStateAction<number>>;

  /** game */
  players: PublicPlayer[];
  setPlayers: React.Dispatch<React.SetStateAction<PublicPlayer[]>>;

  me: MePlayer | null;
  setMe: React.Dispatch<React.SetStateAction<MePlayer | null>>;

  turnPlayerId: string | null;
  setTurnPlayerId: React.Dispatch<React.SetStateAction<string | null>>;

  phase: Phase;
  setPhase: React.Dispatch<React.SetStateAction<Phase>>;

  pending: Pending;
  setPending: React.Dispatch<React.SetStateAction<Pending>>;

  turnEndsAt: number | null;
  setTurnEndsAt: React.Dispatch<React.SetStateAction<number | null>>;

  pendingEndsAt: number | null;
  setPendingEndsAt: React.Dispatch<React.SetStateAction<number | null>>;

  /** errors */
  lastError: string | null;
  clearError: () => void;

  /** websocket */
  ws: WebSocket | null;
  wsStatus: WsStatus;
  connectWS: (url: string) => void;
  sendWS: (obj: any) => void;
  closeWS: () => void;

  /** optional helpers */
  resetAll: () => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

function normCode(x: any): string {
  return String(x ?? "").trim().toUpperCase();
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

/** ✅ أهم تعديل: استخراج السلاح من كرت weapon نفسه (weaponKey/weaponName/...) */
function weaponKeyFromAnyWeaponCard(x: any): WeaponKey | null {
  if (!x) return null;

  // server weapon card usually: { key:"weapon", weaponKey:"winchester", range:5, ... }
  const raw =
    String(x.weaponKey ?? x.weaponName ?? x.name ?? x.id ?? "").trim();

  if (!raw) return null;
  return normalizeWeaponKey(raw);
}

/** ✅ السلاح الحقيقي = من table.weapon إذا موجود، وإلا من equipment */
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

    return {
      ...p,
      id: String(p?.id ?? ""),
      name: String(p?.name ?? ""),
      equipment,
      handCount: Number(p?.handCount ?? 0),
      weaponKey: (p?.weaponKey as WeaponKey) ?? weaponFromTableOrEquipment(table, equipment),
    };
  });
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState("");
  const [avatarUri, setAvatarUri] = useState("");

  const [roomCode, setRoomCode] = useState("");

  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [roomReady, setRoomReady] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(7);

  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [me, setMe] = useState<MePlayer | null>(null);
  const [turnPlayerId, setTurnPlayerId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("main");
  const [pending, setPending] = useState<Pending>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [pendingEndsAt, setPendingEndsAt] = useState<number | null>(null);

  const [lastError, setLastError] = useState<string | null>(null);
  const clearError = () => setLastError(null);

  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [, force] = useState(0);

  const resetAll = () => {
    setRoomCode("");
    setLobbyPlayers([]);
    setRoomReady(false);
    setMaxPlayers(7);

    setPlayers([]);
    setMe(null);
    setTurnPlayerId(null);

    setPhase("main");
    setPending(null);
    setTurnEndsAt(null);
    setPendingEndsAt(null);

    setLastError(null);
  };

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
        if (typeof msg.maxPlayers === "number") setMaxPlayers(msg.maxPlayers);
        if (typeof msg.ready === "boolean") setRoomReady(msg.ready);
        return;
      }

      if (msg.type === "room_update") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        setLobbyPlayers(parseLobbyPlayers(msg.players));
        setRoomReady(Boolean(msg.ready));
        if (typeof msg.maxPlayers === "number") setMaxPlayers(msg.maxPlayers);
        return;
      }

      /** ✅ السيرفر ممكن يبعث started أو game_started */
      if (msg.type === "started" || msg.type === "game_started") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        return;
      }

      if (msg.type === "turn_started") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);
        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);
        if (typeof msg.turnEndsAt === "number") setTurnEndsAt(msg.turnEndsAt);

        setPhase("main");
        setPending(null);
        setPendingEndsAt(null);
        return;
      }

      if (msg.type === "action_required") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        setPhase("waiting");

        // ✅ pending من السيرفر غالبًا مش موجود، فبنركبه من msg
        const nextPending: Pending = msg.pending ?? { kind: msg.kind ?? "unknown", ...msg };

        setPending(nextPending);
        if (typeof msg.pendingEndsAt === "number") setPendingEndsAt(msg.pendingEndsAt);
        return;
      }

      if (msg.type === "action_resolved") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        setPhase("main");
        setPending(null);
        setPendingEndsAt(null);
        return;
      }

      if (msg.type === "game_state") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);

        if (msg.phase === "main" || msg.phase === "waiting") setPhase(msg.phase);

        // ✅ حماية: ما تمسح pending إذا اللعبة waiting ولسا السيرفر بعث pending ناقص/فارغ
        setPending((prev) => {
          const next = (msg.pending ?? null) as Pending;

          if (!next && msg.phase === "waiting") return prev;

          // لو choose_draw وجاي pending بدون options، خذ options من prev
          if (
            next &&
            next.kind === "choose_draw" &&
            !Array.isArray((next as any).options) &&
            prev &&
            prev.kind === "choose_draw" &&
            Array.isArray((prev as any).options)
          ) {
            return { ...next, options: (prev as any).options };
          }

          return next;
        });

        if (typeof msg.turnEndsAt === "number") setTurnEndsAt(msg.turnEndsAt);
        if (typeof msg.pendingEndsAt === "number") setPendingEndsAt(msg.pendingEndsAt);

        setPlayers(parsePublicPlayers(msg.players));
        return;
      }

      if (msg.type === "me_state") {
        const code = normCode(msg.roomCode);
        if (code) setRoomCode(code);

        // ✅ خذ كمان phase/pending/turn من me_state إذا السيرفر بعتهم
        if (typeof msg.turnPlayerId === "string") setTurnPlayerId(msg.turnPlayerId);
        if (msg.phase === "main" || msg.phase === "waiting") setPhase(msg.phase);
        if (typeof msg.turnEndsAt === "number") setTurnEndsAt(msg.turnEndsAt);
        if (typeof msg.pendingEndsAt === "number") setPendingEndsAt(msg.pendingEndsAt);
        if (msg.pending !== undefined) {
          setPending((prev) => (msg.pending === null ? prev : (msg.pending as Pending)));
        }

        if (msg.me) {
          const equipment = Array.isArray(msg.me?.equipment) ? msg.me.equipment : [];
          const table = msg.me?.table ?? null;

          const m: MePlayer = {
            ...msg.me,
            id: String(msg.me?.id ?? ""),
            name: String(msg.me?.name ?? ""),
            equipment,
            hand: Array.isArray(msg.me?.hand) ? msg.me.hand : [],
            weaponKey: (msg.me?.weaponKey as WeaponKey) ?? weaponFromTableOrEquipment(table, equipment),
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
      roomReady,
      setRoomReady,
      maxPlayers,
      setMaxPlayers,

      players,
      setPlayers,
      me,
      setMe,

      turnPlayerId,
      setTurnPlayerId,

      phase,
      setPhase,
      pending,
      setPending,
      turnEndsAt,
      setTurnEndsAt,
      pendingEndsAt,
      setPendingEndsAt,

      lastError,
      clearError,

      ws: wsRef.current,
      wsStatus,
      connectWS,
      sendWS,
      closeWS,

      resetAll,
    }),
    [
      name,
      avatarUri,
      roomCode,
      lobbyPlayers,
      roomReady,
      maxPlayers,
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
