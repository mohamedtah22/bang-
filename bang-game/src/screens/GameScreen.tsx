// src/screens/GameScreen.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  Animated,
  ImageBackground,
  PanResponder,
  Pressable,
  SafeAreaView,
  Alert,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { usePlayer } from "../contexts/playercontext";
import type { Card } from "../models/card";
import type { PublicPlayer } from "../models/player";

import { OpponentsRow } from "./game/OpponentsRow";
import { TableCenter } from "./game/TableCenter";
import { HandBar } from "./game/HandBar";
import { ActionOverlay } from "./game/ActionOverlay";
import { FxLayer, type FxEvent, type FxKind } from "./game/FxLayer";
import { DrawMotionLayer, type DrawMotionEvent } from "./game/DrawMotionLayer";
import { DrawCheckOverlay } from "./game/DrawCheckOverlay";
import { GeneralStorePanel } from "./game/GeneralStorePanel";
import { EventBanner } from "./game/EventBanner";
import EndGameOverlay from "./game/EndGameOverlay";
import CharacterAbilityOverlay from "./game/CharacterAbilityOverlay";
import { ChatOverlay } from "./game/ChatOverlay";
import { useGameSounds } from "./game/useGameSounds";
import { useAmbientMusic } from "./game/useAmbientMusic";
import StartInfoOverlay from "./game/StartInfoOverlay";
import WoodButton from "./game/WoodButton";

import { PassiveToast } from "./characters/PassiveToast";
import { CharacterPanel, getNeedsAttention } from "./characters/CharacterPanel";

const GAME_BG = require("../../assets/gamescreen.png");

const RESOLVE_ACTION_TYPE = "resolve_action";
const SID_HEAL_TYPE = "sid_heal";

function cardUid(c: any): string {
  if (!c) return "";
  const base = c.id ?? c.cardId ?? c._id ?? c.uid ?? c.uuid;
  if (base) return String(base);

  const k = String(c.key ?? c.name ?? "card");
  const r = String(c.rank ?? "");
  const s = String(c.suit ?? "");
  return `${k}_${r}_${s}`;
}

function hasEquip(p: any, key: string) {
  const eq = Array.isArray(p?.equipment) ? p.equipment : [];
  return eq.some((c: any) => String(c?.key) === key);
}

function seatDistance(order: string[], aId: string, bId: string) {
  const n = order.length;
  const a = order.indexOf(aId);
  const b = order.indexOf(bId);
  if (a < 0 || b < 0 || n <= 1) return 99;

  const cw = (b - a + n) % n;
  const ccw = (a - b + n) % n;
  return Math.min(cw, ccw);
}

function effectiveDistance(me: any, target: any, base: number) {
  let d = base;

  if (hasEquip(target, "mustang")) d += 1;
  if (String(target?.playcharacter ?? "") === "paul_regret") d += 1;

  if (hasEquip(me, "scope")) d -= 1;
  if (String(me?.playcharacter ?? "") === "rose_doolan") d -= 1;

  return Math.max(1, d);
}

function useNowTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function firstString(obj: any, keys: string[]) {
  for (const key of keys) {
    const v = String(obj?.[key] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function actionFocus(meta: any, meId?: string | null) {
  const kind = String(meta?.kind ?? "").toLowerCase();
  const targetId = firstString(meta, [
    "toPlayerId",
    "forPlayerId",
    "responderId",
    "respondingPlayerId",
    "ownerId",
    "targetId",
    "victimId",
    "playerId",
    "pickerId",
  ]);
  if (!targetId) return { id: "", label: "" };

  if (isCharacterAbilityKind(kind)) return { id: "", label: "" };
  if (kind.includes("general_store")) return { id: targetId, label: "PICK" };
  if (kind.includes("panic") || kind.includes("cat")) return { id: targetId, label: "TARGET" };
  if (kind.includes("barrel")) return { id: targetId, label: "DECIDE" };
  if (kind.includes("revive")) {
    return { id: targetId, label: targetId === String(meId ?? "") ? "USE BEER" : "REVIVE" };
  }
  if (
    kind.includes("duel") ||
    kind.includes("indians") ||
    kind.includes("gatling") ||
    kind.includes("bang") ||
    kind.includes("missed")
  ) {
    return { id: targetId, label: targetId === String(meId ?? "") ? "YOUR TURN" : "RESPOND" };
  }
  return { id: "", label: "" };
}

function isResponsePendingKind(p: any) {
  const k = String(p?.kind ?? "").toLowerCase();
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

function isCharacterAbilityKind(kind: any) {
  const k = String(kind ?? "").toLowerCase().trim();
  return (
    k === "choose_draw" ||
    k === "draw_choice" ||
    k === "choose_jesse_target" ||
    k === "jesse_choice" ||
    k === "choose_pedro_source" ||
    k === "pedro_choice" ||
    k === "choose_lucky_draw" ||
    k === "lucky_choice"
  );
}

function isRespondBadgeKind(kind: any) {
  const k = String(kind ?? "").toLowerCase().trim();
  return (
    k === "respond_to_bang" ||
    k === "bang" ||
    k === "need_missed" ||
    k === "respond_missed" ||
    k === "bang_missed" ||
    k === "need_missed_for_bang" ||
    k === "respond_to_duel" ||
    k === "duel" ||
    k === "duel_missed" ||
    k === "need_missed_duel" ||
    k === "duel_response" ||
    k === "respond_to_indians" ||
    k === "indians" ||
    k === "respond_to_gatling" ||
    k === "gatling" ||
    k === "respond_to_revive" ||
    k === "revive"
  );
}

function pendingAbilityOwnerId(src: any): string {
  if (!src || typeof src !== "object") return "";
  return String(
    src?.playerId ??
      src?.toPlayerId ??
      src?.forPlayerId ??
      src?.ownerId ??
      src?.targetId ??
      src?.pickerId ??
      ""
  ).trim();
}

function pendingUiKind(src: any): string {
  const kind = String(src?.kind ?? "").toLowerCase().trim();
  if (kind && kind !== "private" && kind !== "unknown") return kind;
  return String(src?.privateKind ?? "").toLowerCase().trim();
}

function eventCardLike(msg: any): any | null {
  const direct =
    msg?.card ??
    msg?.playedCard ??
    msg?.discardTop ??
    msg?.topDiscard ??
    msg?.lastDiscard ??
    msg?.pickedCard ??
    null;

  if (direct && typeof direct === "object") return direct;

  const key = String(msg?.cardKey ?? msg?.key ?? msg?.name ?? "").trim();
  const id = String(msg?.cardId ?? msg?.id ?? "").trim();
  const rank = msg?.rank;
  const suit = msg?.suit;

  if (!key && !id && !rank && !suit) return null;

  return {
    id: id || undefined,
    key: key || undefined,
    name: key || undefined,
    rank,
    suit,
    weaponKey: msg?.weaponKey,
    weaponName: msg?.weaponName,
    range: msg?.range,
  };
}

const TABLE_STAY_KEYS = new Set(["jail", "dynamite", "barrel", "mustang", "scope", "weapon"]);

function cardKeyOfAnyCard(card: any): string {
  return String(card?.key ?? card?.cardKey ?? card?.name ?? "").toLowerCase().trim();
}

function isTableStayCard(card: any): boolean {
  const key = cardKeyOfAnyCard(card);
  if (TABLE_STAY_KEYS.has(key)) return true;
  return !!String(card?.weaponKey ?? card?.weaponName ?? "").trim();
}

function shouldAnimatePlayedCardToDiscard(evt: any, card: any): boolean {
  const action = String(evt?.action ?? "play").toLowerCase().trim();
  if (action === "respond") return true;
  return !isTableStayCard(card);
}

function shouldShowDiscardTopCard(card: any): boolean {
  return !!card && typeof card === "object";
}

function buildDiscardStackFromEvents(list: any[]): any[] {
  const stack: any[] = [];

  const pushCard = (card: any) => {
    if (!shouldShowDiscardTopCard(card)) return;
    stack.push(card);
  };

  const popCard = () => {
    if (!stack.length) return null;
    return stack.pop() ?? null;
  };

  for (const e of Array.isArray(list) ? list : []) {
    const t = String(e?.type ?? "");

    if (t === "card_discarded") {
      pushCard(eventCardLike(e?.card ?? e));
      continue;
    }

    if (t === "action_resolved") {
      const k = String(e?.kind ?? "").toLowerCase();
      const sourceName = String(e?.source ?? e?.drawSource ?? "").toLowerCase();
      const fromDiscard =
        e?.fromDiscard === true ||
        e?.useDiscard === true ||
        e?.pickedDiscard === true ||
        sourceName.includes("discard");

      if (k.includes("pedro") && fromDiscard) {
        popCard();
      }
    }
  }

  return stack;
}

function passiveLabel(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("gringo")) return "El Gringo";
  if (k.includes("bart")) return "Bart";
  if (k.includes("suzy")) return "Suzy";
  if (k.includes("black")) return "Black Jack";
  return "Draw";
}

function suitSymbol(suit?: any) {
  const s = String(suit ?? "").toLowerCase();
  if (s === "hearts") return "♥";
  if (s === "diamonds") return "♦";
  if (s === "spades") return "♠";
  if (s === "clubs") return "♣";
  return "";
}


function prettyRole(role?: any) {
  return String(role ?? "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function prettyCharacterName(key?: any) {
  return String(key ?? "character")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function prettyWeaponName(raw?: any) {
  const key = String(raw ?? "colt45").trim().toLowerCase();
  if (!key) return "Colt .45";
  if (key === "colt45" || key === "colt_45") return "Colt .45";
  if (key === "rev_carabine" || key === "revcarabine" || key === "carabine") return "Rev. Carabine";
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function shortCardBadge(card: any) {
  if (!card || typeof card !== "object") return "";
  const rank = String(card.rank ?? "").toUpperCase();
  const sym = suitSymbol(card.suit);
  return `${rank}${sym}`.trim();
}

function TimerBadge({
  phase,
  turnEndsAt,
  pendingEndsAt,
  pendingKind,
}: {
  phase: any;
  turnEndsAt: number | null;
  pendingEndsAt: number | null;
  pendingKind?: string | null;
}) {
  const now = useNowTick(250);
  const k = String(pendingKind ?? "").toLowerCase();
  const sharesTurnDeadline =
    !!turnEndsAt &&
    !!pendingEndsAt &&
    Math.abs(Number(turnEndsAt) - Number(pendingEndsAt)) <= 1500;
  const usesTurnClock =
    k === "discard_limit" ||
    k === "discard_to_limit" ||
    isCharacterAbilityKind(k) ||
    k === "lucky_choice" ||
    (!k && sharesTurnDeadline);
  const isAction = String(phase) === "waiting" && !usesTurnClock;
  const endsAt = String(phase) === "waiting" ? (usesTurnClock ? turnEndsAt ?? pendingEndsAt ?? null : pendingEndsAt ?? null) : turnEndsAt ?? null;
  if (!endsAt) return null;

  const sec = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <View style={[s.timerBox, isAction ? s.timerBoxAction : null]}>
      <Text style={[s.timerKicker, isAction ? s.timerKickerAction : null]}>{isAction ? "ACTION" : "TURN"}</Text>
      <Text style={s.timerText}>{sec}s</Text>
    </View>
  );
}

export default function GameScreen() {
  const {
    roomCode,
    players,
    discardCount,
    deckCount,
    me,
    phase,
    pending,
    actionRequired,
    lastPassive,
    events,
    chats,
    turnPlayerId,
    turnEndsAt,
    pendingEndsAt,
    sendWS,
    leaveRoom,
    gameOver,
    clearGameOver,
    resetAll,
  } = usePlayer();

  const navigation = useNavigation<any>();

  useAmbientMusic("game", !!roomCode && !gameOver);
  useGameSounds(events as any[], gameOver as any, String((me as any)?.id ?? ""), chats as any[]);

  const [chatOpen, setChatOpen] = useState(false);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const chatFabFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chatFabFloat, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(chatFabFloat, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [chatFabFloat]);

  useEffect(() => {
    if (chatOpen) setSeenChatCount(Array.isArray(chats) ? chats.length : 0);
  }, [chatOpen, chats]);

  const unreadChatCount = Math.max(0, (Array.isArray(chats) ? chats.length : 0) - seenChatCount);
  const [introDismissedRoom, setIntroDismissedRoom] = useState("");

  useEffect(() => {
    if (!roomCode) setIntroDismissedRoom("");
  }, [roomCode]);

  const uiPending: any = useMemo(() => {
    const ar: any = actionRequired ?? null;
    const pub: any = pending ?? null;
    const arKind = String(ar?.kind ?? "").toLowerCase();
    const pubKind = String(pub?.kind ?? "").toLowerCase();
    const pubPrivateKind = String((pub as any)?.privateKind ?? "").toLowerCase();
    const pubSource = String((pub as any)?.__source ?? "").toLowerCase();
    const myId = String((me as any)?.id ?? "");

    if (arKind === "choose_general_store" && pubKind === "general_store") {
      const pickerId = String(pub?.pickerId ?? "");
      if (pickerId && myId && pickerId !== myId) return pub;

      const cards = Array.isArray(ar?.cards)
        ? ar.cards
        : Array.isArray(pub?.offered)
        ? pub.offered
        : [];

      return {
        ...pub,
        ...ar,
        kind: "choose_general_store",
        pickerId: pickerId || myId || String(ar?.pickerId ?? ""),
        cards,
      };
    }

    if (pub && pubSource === "game_state") {
      if (pubKind === "private") {
        if (isCharacterAbilityKind(pubPrivateKind)) return null;
        if (isResponsePendingKind({ kind: pubPrivateKind })) return { ...(pub as any), kind: pubPrivateKind };
        return null;
      }

      if (isResponsePendingKind(pub)) {
        return ar ?? null;
      }
    }

    return ar ?? pub ?? null;
  }, [actionRequired, pending, me]);

  const personalPending: any = useMemo(() => {
    const myId = String((me as any)?.id ?? "").trim();

    const ar: any = actionRequired ?? null;
    if (ar) {
      const ownerId = String(
        ar?.toPlayerId ??
          ar?.forPlayerId ??
          ar?.responderId ??
          ar?.respondingPlayerId ??
          ar?.ownerId ??
          ar?.targetId ??
          ar?.victimId ??
          ""
      ).trim();

      if (ownerId && myId && ownerId !== myId) return null;
      return { ...ar, __source: "action_required" };
    }

    const p: any = pending ?? null;
    if (!p) return null;

    const k = String(p?.kind ?? "").toLowerCase();
    if (k === "general_store") return null;

    const src = String((p as any)?.__source ?? "").toLowerCase();
    const isResponseLike =
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
      k === "gatling";

    if (isResponseLike) {
      if (src === "game_state") return null;

      const ownerId = String(
        (p as any)?.toPlayerId ??
          (p as any)?.forPlayerId ??
          (p as any)?.responderId ??
          (p as any)?.respondingPlayerId ??
          (p as any)?.ownerId ??
          (p as any)?.targetId ??
          (p as any)?.victimId ??
          ""
      ).trim();

      if (!myId) return null;
      if (!ownerId) return null;
      if (ownerId !== myId) return null;
    }

    return p;
  }, [actionRequired, pending, me]);


  const activeFocus = useMemo(() => {
    const myId = String((me as any)?.id ?? "");
    const privateKind = String((pending as any)?.privateKind ?? "").toLowerCase();
    const publicAbilityPending =
      pending &&
      String((pending as any)?.__source ?? "").toLowerCase() === "game_state" &&
      isCharacterAbilityKind(privateKind)
        ? { ...(pending as any), kind: privateKind }
        : null;

    const resolvedPendingKind = pendingUiKind(pending);
    const pendingIsPrivatePublic =
      pending &&
      String((pending as any)?.__source ?? "").toLowerCase() === "game_state" &&
      (isResponsePendingKind({ ...(pending as any), kind: resolvedPendingKind }) ||
        (!resolvedPendingKind && String((pending as any)?.kind ?? "").toLowerCase() === "unknown"));
    const publicPending = pendingIsPrivatePublic ? publicAbilityPending : pending;
    const direct = actionFocus(actionRequired ?? personalPending ?? publicAbilityPending ?? uiPending ?? publicPending ?? null, myId);
    if (direct.id) return direct;
    return { id: "", label: "" };
  }, [actionRequired, personalPending, uiPending, pending, me]);

  const respondingFocus = useMemo(() => {
    const publicResponsePending =
      pending &&
      String((pending as any)?.__source ?? "").toLowerCase() === "game_state"
        ? (() => {
            const resolvedKind = pendingUiKind(pending);
            if (!resolvedKind) return null;
            if (!isResponsePendingKind({ ...(pending as any), kind: resolvedKind })) return null;
            return { ...(pending as any), kind: resolvedKind };
          })()
        : null;
    const src: any = actionRequired ?? personalPending ?? publicResponsePending ?? uiPending ?? null;
    const k = pendingUiKind(src);
    if (!k || !isRespondBadgeKind(k) || isCharacterAbilityKind(k) || k === "discard_limit" || k === "discard_to_limit") {
      return { id: "", label: "" };
    }

    const idx = Number(src?.idx ?? src?.currentIndex ?? -1);
    const order = Array.isArray(src?.order) ? src.order : Array.isArray(src?.targets) ? src.targets : null;
    const direct = String(src?.toPlayerId ?? src?.forPlayerId ?? src?.responderId ?? src?.respondingPlayerId ?? src?.playerId ?? src?.targetId ?? "");
    let id = direct;
    if (!id && order && idx >= 0 && idx < order.length) id = String(order[idx] ?? "");

    if (!id) return { id: "", label: "" };
    return { id, label: k.includes("revive") ? "REVIVE" : "RESPOND" };
  }, [pending, uiPending, actionRequired, personalPending]);

  const myRole = String((me as any)?.role ?? "");

  const confirmDisconnect = useCallback(() => {
    Alert.alert(
      "Disconnect?",
      "Are you sure you want to disconnect?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            leaveRoom();
            resetAll();
            navigation.reset({ index: 0, routes: [{ name: "Home" }] });
          },
        },
      ]
    );
  }, [leaveRoom, resetAll, navigation]);

  const backHomeFromGameOver = useCallback(() => {
    clearGameOver();
    leaveRoom();
    resetAll();
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  }, [clearGameOver, leaveRoom, resetAll, navigation]);

  const { width: WIN_W, height: WIN_H } = useWindowDimensions();
  const isLandscape = WIN_W > WIN_H;

  const [chatFabPos, setChatFabPos] = useState({ x: 0, y: 0 });
  const chatFabPosRef = useRef({ x: 0, y: 0 });
  const chatMovedRef = useRef(false);
  const chatDragStartRef = useRef({ x: 0, y: 0 });

  const clampChatPos = useCallback((x: number, y: number) => ({
    x: Math.min(Math.max(10, x), Math.max(10, WIN_W - 104)),
    y: Math.min(Math.max(92, y), Math.max(92, WIN_H - 84)),
  }), [WIN_W, WIN_H]);

  useEffect(() => {
    const seeded = chatFabPosRef.current.x || chatFabPosRef.current.y;
    if (!seeded) {
      const next = clampChatPos(WIN_W - 104, WIN_H - 210);
      chatFabPosRef.current = next;
      setChatFabPos(next);
      return;
    }

    const next = clampChatPos(chatFabPosRef.current.x, chatFabPosRef.current.y);
    chatFabPosRef.current = next;
    setChatFabPos(next);
  }, [WIN_W, WIN_H, clampChatPos]);

  const chatPanResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        chatMovedRef.current = false;
        chatDragStartRef.current = { ...chatFabPosRef.current };
      },
      onPanResponderMove: (_evt, gesture) => {
        if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) chatMovedRef.current = true;
        const next = clampChatPos(chatDragStartRef.current.x + gesture.dx, chatDragStartRef.current.y + gesture.dy);
        chatFabPosRef.current = next;
        setChatFabPos(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const tapped = !chatMovedRef.current && Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6;
        if (tapped) setChatOpen((v) => !v);
      },
    }),
  [clampChatPos]);

  const tableH = isLandscape
    ? Math.max(322, Math.floor(WIN_H * 0.52))
    : Math.max(252, Math.floor(WIN_H * 0.31));

  const [localPick, setLocalPick] = useState<
    | null
    | {
        kind: "panic" | "cat_balou";
        cardId: string;
        targetId: string;
        handCount: number;
        equipment: any[];
      }
  >(null);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedStoreCardId, setSelectedStoreCardId] = useState<string | null>(null);

  const [sidMode, setSidMode] = useState(false);
  const [sidSelectedIds, setSidSelectedIds] = useState<Set<string>>(new Set());
  const [discardSelectedIds, setDiscardSelectedIds] = useState<Set<string>>(new Set());
  const [respondSelectedIds, setRespondSelectedIds] = useState<Set<string>>(new Set());

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [abilityOpen, setAbilityOpen] = useState(false);

  const rootRef = useRef<View | null>(null);
  const [rootOffset, setRootOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>({});

  const [drawMotions, setDrawMotions] = useState<DrawMotionEvent[]>([]);
  const [discardTopCard, setDiscardTopCard] = useState<any | null>(null);
  const discardStackRef = useRef<any[]>([]);
  const [drawCheckOverlayEvent, setDrawCheckOverlayEvent] = useState<any | null>(null);
  const [barrelChoiceBusy, setBarrelChoiceBusy] = useState(false);

  const myCharacterKey = String(((me as any)?.characterKey ?? (me as any)?.playcharacter ?? "")).toLowerCase().trim();
  const showStartInfo = !!roomCode && !!myRole && myRole !== "unknown" && !!myCharacterKey && introDismissedRoom !== roomCode;
  const abilityNeedsAttention = useMemo(
    () =>
      getNeedsAttention({
        characterKey: myCharacterKey,
        me: me as any,
        pending: personalPending as any,
        sidMode,
        sidSelectedIds,
      }),
    [myCharacterKey, me, personalPending, sidMode, sidSelectedIds]
  );

  const abilityPendingKind = String((personalPending as any)?.kind ?? "").toLowerCase().trim();
  const abilityPendingToken = useMemo(() => {
    if (!isCharacterAbilityKind(abilityPendingKind)) return "";
    return [
      myCharacterKey,
      abilityPendingKind,
      String((personalPending as any)?.playerId ?? (me as any)?.id ?? ""),
      String((personalPending as any)?.pendingEndsAt ?? pendingEndsAt ?? ""),
    ].join("|");
  }, [abilityPendingKind, myCharacterKey, personalPending, me, pendingEndsAt]);
  const autoAbilityCharacter = myCharacterKey === "lucky_duke";
  const trackedAbilityTokenRef = useRef("");

  useEffect(() => {
    if (!abilityPendingToken) {
      if (trackedAbilityTokenRef.current) {
        trackedAbilityTokenRef.current = "";
        setAbilityOpen(false);
      }
      return;
    }

    if (!autoAbilityCharacter) return;

    trackedAbilityTokenRef.current = abilityPendingToken;
    setAbilityOpen(true);
  }, [abilityPendingToken, autoAbilityCharacter]);

  const hasBeerInHand = useMemo(() => {
    const hand: any[] = Array.isArray((me as any)?.hand) ? (me as any).hand : [];
    return hand.some((card: any) => String(card?.key ?? card?.name ?? "").toLowerCase() === "beer");
  }, [me]);

  const reviveAutoPassRef = useRef("");

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        (rootRef.current as any)?.measureInWindow?.((x: number, y: number) =>
          setRootOffset({ x, y })
        );
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [WIN_W, WIN_H]);

  const onAnchor = useCallback(
    (playerId: string, pt: { x: number; y: number }) => {
      const id = String(playerId);
      if (!id) return;
      const local = { x: pt.x - rootOffset.x, y: pt.y - rootOffset.y };

      setAnchors((prev) => {
        const cur = prev[id];
        if (cur && Math.abs(cur.x - local.x) < 0.5 && Math.abs(cur.y - local.y) < 0.5) return prev;
        return { ...prev, [id]: local };
      });
    },
    [rootOffset.x, rootOffset.y]
  );

  const pushDrawMotion = useCallback(
    (
      fromId: string,
      toId: string,
      extra?: Partial<Pick<DrawMotionEvent, "delayMs" | "faceUpCard" | "label">>
    ) => {
      if (!fromId || !toId) return;
      setDrawMotions((prev) => {
        const next: DrawMotionEvent = {
          id: `draw_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          at: Date.now(),
          fromId,
          toId,
          delayMs: extra?.delayMs,
          faceUpCard: extra?.faceUpCard,
          label: extra?.label,
        };
        return [...prev, next].slice(-18);
      });
    },
    []
  );

  const removeDrawMotion = useCallback((id: string) => {
    setDrawMotions((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const [fx, setFx] = useState<FxEvent[]>([]);
  const onAddFx = useCallback((kind: FxKind, data?: Partial<FxEvent>) => {
    setFx((prev) => {
      const e: FxEvent = {
        id: `fx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        kind,
        at: Date.now(),
        ...(data ?? {}),
      };
      return [...prev, e].slice(-40);
    });
  }, []);

  const onFxDone = useCallback((id: string) => {
    setFx((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const lastEvtIdRef = useRef<string | null>(null);
  const syncDiscardTopFromStack = useCallback(() => {
    const stack = discardStackRef.current;
    setDiscardTopCard(stack.length ? stack[stack.length - 1] : null);
  }, []);

  useEffect(() => {
    const list = Array.isArray(events) ? events : [];
    if (!list.length) return;

    let startIdx = 0;
    if (lastEvtIdRef.current) {
      const idx = list.findIndex((e: any) => String(e?.id) === String(lastEvtIdRef.current));
      startIdx = idx >= 0 ? idx + 1 : Math.max(0, list.length - 15);
    } else {
      startIdx = Math.max(0, list.length - 15);
    }

    if (!lastEvtIdRef.current) {
      discardStackRef.current = buildDiscardStackFromEvents(list.slice(0, startIdx));
      syncDiscardTopFromStack();
    }

    const pushDiscardCard = (card: any) => {
      if (!shouldShowDiscardTopCard(card)) return;
      discardStackRef.current = [...discardStackRef.current, card];
      syncDiscardTopFromStack();
    };

    const popDiscardCard = () => {
      const stack = [...discardStackRef.current];
      const popped = stack.pop() ?? null;
      discardStackRef.current = stack;
      syncDiscardTopFromStack();
      return popped;
    };

    const fresh = list.slice(startIdx);

    for (const e of fresh) {
      const t = String(e?.type ?? "");

      if (t === "card_played") {
        const ck = String(e?.cardKey ?? "").toLowerCase();
        const fromId = String(e?.playerId ?? "");
        const targetId = String(e?.targetId ?? "");

        const topCard = eventCardLike(e);
        const shouldGoDiscard = shouldAnimatePlayedCardToDiscard(e, topCard);

        if (fromId && targetId && ["bang", "duel", "panic", "cat_balou", "catbalou", "jail"].includes(ck)) {
          pushDrawMotion(fromId, targetId, {
            faceUpCard: topCard ?? undefined,
            label: ck.replace(/_/g, " ").toUpperCase(),
          });
        }

        if (fromId && topCard && shouldGoDiscard) {
          pushDrawMotion(fromId, "__discard__", {
            faceUpCard: topCard,
            label: String(e?.action ?? "play").toLowerCase() === "respond" ? "Respond" : "Discard",
            delayMs: targetId ? 520 : 240,
          });
        }

        if (ck === "gatling") onAddFx("gatling", { fromId });
        else if (ck === "indians") onAddFx("indians_start", { fromId });
        else if (ck === "beer") onAddFx("beer_glow", { targetId: fromId });
      }

      if (t === "card_discarded") {
        const discardedCard = eventCardLike(e?.card ?? e);
        if (discardedCard) pushDiscardCard(discardedCard);
      }

      if (t === "general_store_pick") {
        const pickerId = String(e?.pickerId ?? "");
        const pickedCard = eventCardLike(e?.card ?? e);
        if (pickerId) {
          pushDrawMotion("__deck__", pickerId, {
            faceUpCard: pickedCard ?? undefined,
            label: "Store",
          });
        }
      }

      if (t === "turn_started") {
        const pid = String(e?.turnPlayerId ?? "");
        const turnPlayer = (Array.isArray(players) ? players : []).find(
          (p: any) => String(p?.id ?? "") === pid
        );
        const turnChar = String((turnPlayer as any)?.playcharacter ?? "").toLowerCase();
        const hasCustomDrawFlow =
          turnChar === "kit_carlson" ||
          turnChar === "jesse_jones" ||
          turnChar === "pedro_ramirez" ||
          turnChar === "black_jack";

        if (pid && turnChar === "black_jack") {
          pushDrawMotion("__deck__", pid, {
            delayMs: 90,
            label: "Draw 1",
          });
        }

        if (pid && !hasCustomDrawFlow) {
          pushDrawMotion("__deck__", pid, { delayMs: 70 });
          pushDrawMotion("__deck__", pid, { delayMs: 250 });
        }
      }

      if (t === "passive_triggered") {
        const kind = String(e?.kind ?? "").toLowerCase();
        const toId = firstString(e, ["playerId", "targetId", "victimId"]);

        if (kind.includes("gringo") && toId) {
          const fromId =
            firstString(e, ["attackerId", "fromId", "sourcePlayerId", "fromPlayerId"]) || "__deck__";
          pushDrawMotion(fromId, toId, { label: "El Gringo" });
        } else if (kind.includes("blackjack_reveal") && toId) {
          const shown = eventCardLike(e?.revealed ?? e);
          const badge = shortCardBadge(shown);
          pushDrawMotion("__deck__", toId, {
            faceUpCard: shown ?? undefined,
            delayMs: 560,
            label: badge ? `2nd Card ${badge}` : "2nd Card",
          });
        } else if (kind.includes("blackjack_bonus_draw") && toId) {
          pushDrawMotion("__deck__", toId, {
            delayMs: 1120,
            label: "3rd Card",
          });
        } else if ((kind.includes("bart") || kind.includes("suzy") || kind.includes("black")) && toId) {
          pushDrawMotion("__deck__", toId, { label: passiveLabel(kind) });
        }
      }

      if (t === "action_resolved") {
        const k = String(e?.kind ?? "").toLowerCase();
        const targetId = e?.targetId ? String(e.targetId) : undefined;
        const fromId = String(e?.attackerId ?? e?.playerId ?? "");

        const nextDiscard = eventCardLike(
          e?.discardTop ?? e?.topDiscard ?? e?.lastDiscard ? e : null
        );
        if (nextDiscard && shouldShowDiscardTopCard(nextDiscard)) {
          const stack = [...discardStackRef.current];
          if (stack.length) stack[stack.length - 1] = nextDiscard;
          else stack.push(nextDiscard);
          discardStackRef.current = stack;
          syncDiscardTopFromStack();
        }

        if ((k === "bang_hit" || k === "bang_timeout_hit") && targetId) {
          onAddFx("bang_hit", { fromId, targetId });
        }

        if ((k === "indians_hit" || k === "gatling_hit") && targetId) {
          onAddFx("bang_hit", { fromId, targetId });
        }

        if (k === "duel_timeout_lose" || k === "duel_lose") {
          const loserId = String(e?.loserId ?? e?.targetId ?? "");
          if (loserId) onAddFx("bang_hit", { fromId, targetId: loserId });
        }

        if (k === "discard_limit_done") {
          const pid = firstString(e, ["playerId", "targetId"]);
          const discardedCards = Array.isArray((e as any)?.discardedCards) ? (e as any).discardedCards : [];
          if (pid && discardedCards.length) {
            discardedCards.forEach((card: any, index: number) => {
              pushDrawMotion(pid, "__discard__", {
                faceUpCard: eventCardLike(card) ?? undefined,
                label: index === 0 ? "Discard" : undefined,
                delayMs: 80 + index * 130,
              });
            });
          }
        }

        if (
          (
            k === "bang_missed" ||
            k === "bang_dodged_barrel" ||
            k === "bang_partial_missed" ||
            k === "gatling_defended" ||
            k === "gatling_defended_missed" ||
            k === "gatling_defended_barrel"
          ) &&
          targetId
        ) {
          onAddFx("shield", { fromId, targetId });
        }

        if (k === "beer" || k === "beer_heal" || k === "heal" || k === "sid_heal" || k === "revive_success") {
          const pid = String(e?.playerId ?? e?.targetId ?? fromId ?? "");
          if (pid) onAddFx("beer_glow", { targetId: pid });
        }

        if (k === "saloon") {
          const everyone = [
            ...((Array.isArray(players) ? players : []).map((pl: any) => String(pl?.id ?? "")).filter(Boolean)),
            String((me as any)?.id ?? ""),
          ];
          Array.from(new Set(everyone)).forEach((pid) => {
            if (pid) onAddFx("beer_glow", { targetId: pid });
          });
        }

        if (k === "jesse_draw_choice") {
          const pid = firstString(e, ["playerId", "targetId"]);
          const sourceId = String(e?.targetId ?? "");
          const fromTarget = e?.fromTarget === true && !!sourceId;

          if (pid) {
            pushDrawMotion(fromTarget ? sourceId : "__deck__", pid, {
              label: fromTarget ? "Jesse" : "Deck",
            });
            pushDrawMotion("__deck__", pid, {
              delayMs: 180,
              label: fromTarget ? "Deck" : "Draw",
            });
          }
        }

        if (k === "draw_choice_done") {
          const pid = firstString(e, ["playerId", "targetId"]);
          if (pid) {
            pushDrawMotion("__deck__", pid, { delayMs: 70, label: "Kit" });
            pushDrawMotion("__deck__", pid, { delayMs: 240, label: "Kit" });
          }
        }

        if (k.includes("pedro")) {
          const pid = firstString(e, ["playerId", "targetId"]);
          const sourceName = String(e?.source ?? e?.drawSource ?? "").toLowerCase();
          const fromDiscard =
            e?.fromDiscard === true ||
            e?.useDiscard === true ||
            e?.pickedDiscard === true ||
            sourceName.includes("discard");

          if (pid) {
            const takenFromDiscard = fromDiscard ? popDiscardCard() : null;
            pushDrawMotion(fromDiscard ? "__discard__" : "__deck__", pid, {
              label: "Pedro",
              faceUpCard: fromDiscard
                ? eventCardLike(e) ?? takenFromDiscard ?? undefined
                : undefined,
            });
            pushDrawMotion("__deck__", pid, { delayMs: 180, label: "Deck" });
          }
        }
      }

      if (t === "draw_check") {
        const kind = String(e?.kind ?? "").toLowerCase();
        const targetId = e?.playerId ? String(e.playerId) : undefined;

        const ok =
          typeof e?.success === "boolean"
            ? e.success
            : typeof e?.freed === "boolean"
            ? e.freed
            : typeof e?.exploded === "boolean"
            ? !e.exploded
            : !!e?.ok;

        const drawnCards = Array.isArray(e?.drawn) ? e.drawn : [];
        if (
          targetId &&
          (kind === "barrel" || kind === "jail" || kind === "dynamite" || kind === "jourdonnais")
        ) {
          setDrawCheckOverlayEvent({
            ...e,
            type: "draw_check",
            drawn: drawnCards,
          });

          const chosenCard = eventCardLike(e?.chosen ?? e);
          if (chosenCard) {
            const badge = shortCardBadge(chosenCard);
            pushDrawMotion("__deck__", targetId, {
              faceUpCard: chosenCard,
              label: badge ? `${kind.toUpperCase()} ${badge}` : kind.toUpperCase(),
            });

            pushDrawMotion(targetId, "__discard__", {
              faceUpCard: chosenCard,
              label: "Discard",
              delayMs: 2100,
            });
          }
        }

        if (!ok && targetId && kind === "jail") onAddFx("jail_lock", { targetId });
        if (!ok && targetId && kind === "dynamite") onAddFx("explosion", { targetId });
      }
    }

    lastEvtIdRef.current = String(list[list.length - 1]?.id ?? "");
  }, [events, onAddFx, pushDrawMotion, players, me, syncDiscardTopFromStack]);

  const disconnectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of Array.isArray(events) ? events : []) {
      if (String(e?.type ?? "") === "player_disconnected") {
        const pid = String((e as any)?.playerId ?? "").trim();
        if (pid) set.add(pid);
      }
    }
    return set;
  }, [events]);

  const allPlayers = useMemo(
    () =>
      (Array.isArray(players) ? players : []).map((p: any) => ({
        ...p,
        disconnected: disconnectedIds.has(String(p?.id ?? "")),
      })),
    [players, disconnectedIds]
  );
  const alivePlayers = useMemo(() => allPlayers.filter((p: any) => p && p.isAlive !== false), [allPlayers]);
  const seatOrder = useMemo(() => alivePlayers.map((p: any) => String(p.id)), [alivePlayers]);

  const opponents = useMemo(() => {
    if (!me) return allPlayers as any[];
    return allPlayers.filter((p: any) => String(p.id) !== String(me.id));
  }, [allPlayers, me]);

  const focusedPlayer = useMemo(() => {
    if (!focusedId) return null;
    return (allPlayers.find((p: any) => String(p.id) === String(focusedId)) as any) ?? null;
  }, [allPlayers, focusedId]);

  const distanceById = useMemo(() => {
    if (!me) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const p of opponents) {
      if ((p as any)?.isAlive === false || (p as any)?.disconnected) continue;
      const base = seatDistance(seatOrder, String(me.id), String(p.id));
      map[String(p.id)] = effectiveDistance(me, p, base);
    }
    return map;
  }, [me, opponents, seatOrder]);

  const focusedDistance = useMemo(() => {
    if (!me || !focusedPlayer) return null;
    if ((focusedPlayer as any)?.isAlive === false || (focusedPlayer as any)?.disconnected) return null;
    const base = seatDistance(seatOrder, String(me.id), String((focusedPlayer as any).id));
    return effectiveDistance(me, focusedPlayer, base);
  }, [me, focusedPlayer, seatOrder]);

  const isMyTurn = !!me && !!turnPlayerId && String(turnPlayerId) === String((me as any).id);

  useEffect(() => {
    if (isMyTurn) setFocusedId(null);
  }, [isMyTurn]);

  const selectedCard = useMemo(() => {
    const hand: any[] = Array.isArray((me as any)?.hand) ? (me as any).hand : [];
    return hand.find((c) => cardUid(c) === String(selectedCardId ?? "")) ?? null;
  }, [me, selectedCardId]);

  const selectedCardKey = String((selectedCard as any)?.key ?? (selectedCard as any)?.name ?? "").toLowerCase();

  const meCharForRules = String((me as any)?.playcharacter ?? "").toLowerCase();
  const isJanetForRules =
    meCharForRules === "calamity_janet" ||
    meCharForRules === "calamityjanet" ||
    meCharForRules === "janet";

  const cardNeedsTarget = useMemo(() => {
    const k = selectedCardKey;
    if (!k) return false;
    if (k === "missed") return isJanetForRules;
    return ["bang", "duel", "panic", "cat_balou", "catbalou", "jail"].includes(k);
  }, [selectedCardKey, isJanetForRules]);

  const targeting =
    !!selectedCardId && !actionRequired && isMyTurn && String(phase ?? "") === "main" && cardNeedsTarget;

  useEffect(() => {
    if (String(phase ?? "") !== "main" || !!actionRequired) {
      setSidMode(false);
      setSidSelectedIds(new Set());
    }
  }, [phase, actionRequired]);

  const onPressOpponent = useCallback(
    (id: string) => {
      const hit = allPlayers.find((p: any) => String(p?.id ?? "") === String(id));
      if (targeting) {
        if (!hit || hit.isAlive === false || (hit as any).disconnected) return;
        setSelectedTargetId((prev) => (prev === id ? null : id));
        setFocusedId(id);
        return;
      }
      setFocusedId((prev) => (prev === id ? null : id));
    },
    [targeting, allPlayers]
  );

  const pendingKindNow = String((personalPending as any)?.kind ?? "").toLowerCase();
  const discardNeed = Number((personalPending as any)?.need ?? 0);
  const discardMode = pendingKindNow === "discard_to_limit" || pendingKindNow === "discard_limit";

  useEffect(() => {
    setDiscardSelectedIds(new Set());
    if (discardMode) {
      setSelectedCardId(null);
      setSelectedTargetId(null);
      setSidMode(false);
      setSidSelectedIds(new Set());
      setRespondSelectedIds(new Set());
    }
  }, [discardMode]);

  const canEndTurn = !!roomCode && isMyTurn && !actionRequired && !pending && String(phase ?? "") === "main";
  const overflowDiscardNeed = Math.max(
    0,
    Number(Array.isArray((me as any)?.hand) ? (me as any)?.hand.length : 0) - Number((me as any)?.hp ?? 0)
  );

  const endTurn = useCallback(() => {
    if (!canEndTurn) return;
    if (!roomCode) return;

    const sendNow = () => sendWS({ type: "end_turn", roomCode });

    if (overflowDiscardNeed > 0) {
      Alert.alert(
        "Discard before turn ends",
        `Are you sure? Ending your turn will force you to discard ${overflowDiscardNeed} card${overflowDiscardNeed > 1 ? "s" : ""}.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "End Turn", style: "destructive", onPress: sendNow },
        ]
      );
      return;
    }

    sendNow();
  }, [roomCode, sendWS, canEndTurn, overflowDiscardNeed]);

  const canPlayNow = !!roomCode && isMyTurn && !actionRequired && !pending && String(phase ?? "") === "main";
  const missedPlayable = selectedCardKey !== "missed" || isJanetForRules;
  const playEnabled = canPlayNow && missedPlayable && !!selectedCardId && (!cardNeedsTarget || !!selectedTargetId);

  const playSelected = useCallback(() => {
    if (!playEnabled) return;
    if (!roomCode) return;
    if (!selectedCardId) return;

    if (selectedCardKey === "panic" || selectedCardKey === "cat_balou" || selectedCardKey === "catbalou") {
      if (!selectedTargetId) return;
      const t = (players as any[]).find((p: any) => String(p?.id) === String(selectedTargetId));

      setLocalPick({
        kind: selectedCardKey === "panic" ? "panic" : "cat_balou",
        cardId: selectedCardId,
        targetId: selectedTargetId,
        handCount: Number(t?.handCount ?? 0),
        equipment: Array.isArray(t?.equipment) ? t.equipment : [],
      });

      setSelectedCardId(null);
      setSelectedTargetId(null);
      return;
    }

    const payload: any = { type: "play_card", roomCode, cardId: selectedCardId };
    if (cardNeedsTarget) payload.targetId = selectedTargetId;

    sendWS(payload);
    setSelectedCardId(null);
    setSelectedTargetId(null);
  }, [
    playEnabled,
    roomCode,
    selectedCardId,
    cardNeedsTarget,
    selectedTargetId,
    sendWS,
    selectedCardKey,
    players,
  ]);

  const arKind = String((actionRequired as any)?.kind ?? "").toLowerCase();
  const pendingKind = String((personalPending as any)?.kind ?? "").toLowerCase();
  const uiPendingKind = String((uiPending as any)?.kind ?? "").toLowerCase();

  const isBarrelChoicePending =
    arKind === "choose_barrel" ||
    pendingKind === "barrel_choice" ||
    uiPendingKind === "choose_barrel" ||
    uiPendingKind === "barrel_choice";

  const barrelChoicePending: any = isBarrelChoicePending
    ? personalPending ?? actionRequired ?? uiPending ?? null
    : null;

  const barrelChoiceCount = Math.max(
    0,
    Number((barrelChoicePending as any)?.barrelChecksRemaining ?? 0)
  );

  const barrelChoiceToken = useMemo(() => {
    if (!isBarrelChoicePending || !barrelChoicePending) return "";
    return [
      String((barrelChoicePending as any)?.attackerId ?? ""),
      String((barrelChoicePending as any)?.targetId ?? ""),
      String((barrelChoicePending as any)?.toPlayerId ?? ""),
      String((barrelChoicePending as any)?.source ?? ""),
      String((barrelChoicePending as any)?.requiredMissed ?? ""),
      String((barrelChoicePending as any)?.missedSoFar ?? ""),
      String((barrelChoicePending as any)?.barrelChecksRemaining ?? ""),
      String(pendingEndsAt ?? ""),
    ].join("|");
  }, [isBarrelChoicePending, barrelChoicePending, pendingEndsAt]);

  useEffect(() => {
    setBarrelChoiceBusy(false);
  }, [barrelChoiceToken]);

  const sendBarrelChoice = useCallback(
    (useBarrel: boolean) => {
      if (!roomCode) return;
      if (!isBarrelChoicePending) return;
      if (barrelChoiceBusy) return;

      setBarrelChoiceBusy(true);
      sendWS({ type: "choose_barrel", roomCode, useBarrel });
    },
    [roomCode, isBarrelChoicePending, barrelChoiceBusy, sendWS]
  );

  const generalStoreView = useMemo(() => {
    const allEvents = Array.isArray(events) ? events : [];
    const publicPendingActive =
      uiPendingKind === "general_store" || uiPendingKind === "choose_general_store";

    const playerNameById = (pid: string) => {
      if (!pid) return "";
      const hit = (Array.isArray(players) ? players : []).find(
        (p: any) => String(p?.id ?? "") === String(pid)
      );
      if (hit?.name) return String(hit.name);
      if (String((me as any)?.id ?? "") === pid) return String((me as any)?.name ?? "");
      return pid;
    };

    let active = false;
    let offered: any[] = [];
    let pickerId = "";
    let order: string[] = [];
    let idx = 0;
    const history: any[] = [];

    for (const evt of allEvents) {
      const type = String((evt as any)?.type ?? "").toLowerCase();

      if (type === "general_store_open") {
        active = true;
        offered = Array.isArray((evt as any)?.offered) ? (evt as any).offered : [];
        order = Array.isArray((evt as any)?.order)
          ? (evt as any).order.map((x: any) => String(x ?? ""))
          : [];
        idx = Number((evt as any)?.idx ?? 0) || 0;
        pickerId = String((evt as any)?.pickerId ?? order[idx] ?? "");
        history.length = 0;
        continue;
      }

      if (type === "general_store_update") {
        active = true;
        if (Array.isArray((evt as any)?.offered)) offered = (evt as any).offered;
        if (Array.isArray((evt as any)?.order)) {
          order = (evt as any).order.map((x: any) => String(x ?? ""));
        }
        if (Number.isFinite(Number((evt as any)?.idx))) idx = Number((evt as any).idx);
        pickerId = String((evt as any)?.pickerId ?? order[idx] ?? pickerId ?? "");
        continue;
      }

      if (type === "general_store_pick") {
        active = true;
        const pid = String((evt as any)?.pickerId ?? "");
        const pickedCard = (evt as any)?.card ?? null;

        if (pid && pickedCard) {
          history.push({
            id: String((evt as any)?.id ?? `${pid}_${String(pickedCard?.id ?? history.length)}`),
            pickerId: pid,
            pickerName: playerNameById(pid),
            card: pickedCard,
          });
        }

        if (Array.isArray((evt as any)?.remaining)) {
          offered = (evt as any).remaining;
        }

        const nextPickerId =
          (evt as any)?.nextPickerId === null
            ? ""
            : String((evt as any)?.nextPickerId ?? "");

        if (nextPickerId) {
          pickerId = nextPickerId;
        } else if (order.length) {
          idx += 1;
          pickerId = String(order[idx] ?? "");
        } else {
          pickerId = "";
        }
        continue;
      }

      if (
        type === "action_resolved" &&
        String((evt as any)?.kind ?? "").toLowerCase() === "general_store_done"
      ) {
        active = false;
        offered = [];
        pickerId = "";
      }
    }

    if (publicPendingActive) {
      active = true;
      const pendingCards =
        (uiPending as any)?.cards ??
        (uiPending as any)?.offered ??
        (uiPending as any)?.pending?.cards ??
        (uiPending as any)?.pending?.offered ??
        offered;
      offered = Array.isArray(pendingCards) ? pendingCards : offered;

      const pendingPickerId = String(
        (uiPending as any)?.pickerId ??
          (uiPending as any)?.pending?.pickerId ??
          (uiPending as any)?.order?.[(uiPending as any)?.idx ?? 0] ??
          pickerId
      );
      if (pendingPickerId) pickerId = pendingPickerId;
    }

    return {
      active: !!active && (!!offered.length || !!pickerId || history.length > 0),
      offered,
      pickerId,
      pickerName: playerNameById(pickerId),
      history: history.slice(-8),
    };
  }, [events, uiPending, uiPendingKind, players, me]);

  const isGeneralStorePending = generalStoreView.active;
  const generalStoreCards = generalStoreView.offered;
  const generalStorePickerId = generalStoreView.pickerId;
  const generalStorePickerName = generalStoreView.pickerName;
  const generalStorePickHistory = generalStoreView.history;

  const isGeneralStorePicker =
    isGeneralStorePending &&
    !!generalStorePickerId &&
    !!me &&
    generalStorePickerId === String((me as any)?.id ?? "");

  useEffect(() => {
    if (!isGeneralStorePending) {
      setSelectedStoreCardId(null);
      return;
    }

    if (
      selectedStoreCardId &&
      !generalStoreCards.some(
        (c: any) => String(c?.id ?? c?._id ?? c?.cardId ?? "") === String(selectedStoreCardId)
      )
    ) {
      setSelectedStoreCardId(null);
    }
  }, [isGeneralStorePending, generalStoreCards, selectedStoreCardId, generalStorePickerId]);

  const isBangPendingLike =
    arKind === "respond_to_bang" ||
    pendingKind === "bang" ||
    pendingKind === "need_missed" ||
    pendingKind === "respond_missed" ||
    pendingKind === "bang_missed" ||
    pendingKind === "need_missed_for_bang";

  const isDuelPendingLike =
    arKind === "respond_to_duel" ||
    pendingKind === "duel" ||
    pendingKind === "duel_response" ||
    pendingKind === "duel_missed" ||
    pendingKind === "need_missed_duel";

  const isIndiansPendingLike = arKind === "respond_to_indians" || pendingKind === "indians";
  const isGatlingPendingLike = arKind === "respond_to_gatling" || pendingKind === "gatling";
  const isRevivePendingLike = arKind === "respond_to_revive" || pendingKind === "revive";

  const respondMode =
    !!personalPending &&
    !isBarrelChoicePending &&
    (isBangPendingLike ||
      isDuelPendingLike ||
      isIndiansPendingLike ||
      isGatlingPendingLike ||
      isRevivePendingLike);

  const meChar = String((me as any)?.playcharacter ?? "").toLowerCase();
  const isJanet =
    meChar === "calamity_janet" ||
    meChar === "calamityjanet" ||
    meChar === "janet";

  const respondNeed = useMemo<"bang" | "missed" | "beer" | null>(() => {
    if (!respondMode) return null;
    if (isRevivePendingLike) return "beer";
    if (isIndiansPendingLike || isDuelPendingLike) return "bang";
    return "missed";
  }, [respondMode, isRevivePendingLike, isIndiansPendingLike, isDuelPendingLike]);

  const respondRequired = useMemo(
    () => Number((personalPending as any)?.requiredMissed ?? 1),
    [personalPending]
  );
  const respondDone = useMemo(
    () => Number((personalPending as any)?.missedSoFar ?? 0),
    [personalPending]
  );
  const respondRemaining = useMemo(
    () => Math.max(0, respondRequired - respondDone),
    [respondRequired, respondDone]
  );

  const respondMultiMissedMode =
    respondMode && respondNeed === "missed" && respondRemaining > 1;

  const respondAllowedKeys = useMemo(() => {
    if (!respondMode || !respondNeed) return undefined;

    if (respondNeed === "bang") {
      return isJanet ? ["bang", "missed"] : ["bang"];
    }

    if (respondNeed === "beer") {
      return ["beer"];
    }

    return isJanet ? ["missed", "bang"] : ["missed"];
  }, [respondMode, respondNeed, isJanet]);

  useEffect(() => {
    if (!respondMode || !respondMultiMissedMode) {
      setRespondSelectedIds(new Set());
      return;
    }

    const handIds = new Set(
      (Array.isArray((me as any)?.hand) ? (me as any).hand : []).map((c: any) => String(cardUid(c)))
    );

    setRespondSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (handIds.has(id)) next.add(id);
      }
      return next;
    });

    setSelectedCardId(null);
    setSelectedTargetId(null);
  }, [respondMode, respondMultiMissedMode, me]);

  const onPressCard = useCallback(
    (c: Card) => {
      const id = cardUid(c);

      if (discardMode) {
        setDiscardSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }

      if (sidMode) {
        setSidSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }

      if (respondMultiMissedMode) {
        const key = String((c as any)?.key ?? (c as any)?.name ?? "").toLowerCase();
        const allowed =
          respondNeed === "missed"
            ? isJanet
              ? key === "missed" || key === "bang"
              : key === "missed"
            : true;

        if (!allowed) return;

        setRespondSelectedIds((prev) => {
          const next = new Set(prev);

          if (next.has(id)) {
            next.delete(id);
            return next;
          }

          if (next.size >= respondRemaining) {
            return prev;
          }

          next.add(id);
          return next;
        });
        return;
      }

      setSelectedCardId((prev) => (prev === id ? null : id));
      setSelectedTargetId(null);
      onAddFx("duel_pulse_end");
    },
    [discardMode, sidMode, respondMultiMissedMode, respondNeed, isJanet, respondRemaining, onAddFx]
  );

  const respondUseSelected = useCallback(() => {
    if (!respondMode) return;
    if (!roomCode) return;

    if (respondMultiMissedMode) {
      const ids = Array.from(respondSelectedIds);
      if (ids.length !== respondRemaining) return;

      sendWS({ type: "respond", roomCode, cardIds: ids });
      setRespondSelectedIds(new Set());
      setSelectedCardId(null);
      return;
    }

    if (!selectedCardId) return;

    sendWS({ type: "respond", roomCode, cardId: selectedCardId });
    setSelectedCardId(null);
  }, [respondMode, roomCode, respondMultiMissedMode, respondSelectedIds, respondRemaining, selectedCardId, sendWS]);

  const respondTakeHit = useCallback(() => {
    if (!respondMode) return;
    if (!roomCode) return;

    sendWS({ type: "respond", roomCode });
    setSelectedCardId(null);
    setRespondSelectedIds(new Set());
  }, [respondMode, roomCode, sendWS]);

  const handMode = (respondMode ? "respond" : "play") as "play" | "respond";
  const handAllowedKeys = respondMode ? respondAllowedKeys : undefined;
  const handPlayEnabled = respondMode
    ? respondMultiMissedMode
      ? respondSelectedIds.size === respondRemaining
      : !!selectedCardId
    : playEnabled;
  const handOnPlay = respondMode ? respondUseSelected : playSelected;
  const canTakeHitDuringResponse =
    !respondMode ||
    respondNeed !== "missed" ||
    respondRequired <= 1 ||
    respondDone <= 0 ||
    respondRemaining <= 0;
  const handOnTakeHit = respondMode && canTakeHitDuringResponse ? respondTakeHit : undefined;

  useEffect(() => {
    if (!respondMode || !isRevivePendingLike) {
      reviveAutoPassRef.current = "";
      return;
    }

    const token = [
      String((personalPending as any)?.playerId ?? ""),
      String((personalPending as any)?.attackerId ?? ""),
      String(pendingEndsAt ?? ""),
    ].join("|");

    if (reviveAutoPassRef.current === token) return;
    reviveAutoPassRef.current = token;
    setSelectedCardId(null);
  }, [respondMode, isRevivePendingLike, personalPending, pendingEndsAt]);

  const handMessages = useMemo(() => {
    if (!respondMode || !respondNeed) return undefined;

    if (respondNeed === "missed" && respondRequired > 1) {
      return [
        `⚠️ ${respondRemaining} of ${respondRequired} MISSED still needed`,
        isJanet
          ? "One response is not enough — play MISSED or BANG, then repeat until the count is done."
          : "One response is not enough — play MISSED, then repeat until the count is done.",
      ];
    }

    if (respondNeed === "bang") {
      return [isJanet ? "Respond now with BANG or MISSED (Calamity Janet)." : "Respond now with BANG."];
    }

    if (respondNeed === "beer") {
      return ["You are dying — play Beer now or press TAKE HIT."];
    }

    return [isJanet ? "Respond now with MISSED or BANG (Calamity Janet)." : "Respond now with MISSED."];
  }, [respondMode, respondNeed, respondRequired, respondRemaining, isJanet]);

  const discardPlayEnabled =
    discardMode && discardNeed > 0 && discardSelectedIds.size === discardNeed;

  const discardSend = useCallback(() => {
    if (!discardPlayEnabled) return;
    if (!roomCode) return;

    const selectedIds = Array.from(discardSelectedIds);
    const handCards = Array.isArray((me as any)?.hand) ? (me as any).hand : [];
    const myId = String((me as any)?.id ?? "");

    if (myId) {
      selectedIds.forEach((id, index) => {
        const card = handCards.find((c: any) => String(cardUid(c)) === String(id));
        pushDrawMotion(myId, "__discard__", {
          faceUpCard: card ?? undefined,
          label: "Discard",
          delayMs: index * 120,
        });
      });
    }

    sendWS({
      type: "discard_to_limit",
      roomCode,
      cardIds: selectedIds,
    });

    setDiscardSelectedIds(new Set());
  }, [discardPlayEnabled, roomCode, sendWS, discardSelectedIds, me, pushDrawMotion]);

  const handPlayLabel = useMemo(() => {
    if (!respondMode) return "PLAY";
    if (respondNeed === "missed" && respondRequired > 1) {
      if (respondMultiMissedMode) {
        return `MISS ${respondSelectedIds.size}/${respondRemaining}`;
      }
      return `MISS ${respondRemaining}/${respondRequired}`;
    }
    if (respondNeed === "bang") return "PLAY BANG";
    if (respondNeed === "beer") return "PLAY BEER";
    return "PLAY MISS";
  }, [respondMode, respondNeed, respondRequired, respondRemaining, respondMultiMissedMode, respondSelectedIds]);

  const finalHandOnPlay = discardMode ? discardSend : handOnPlay;
  const finalHandPlayEnabled = discardMode ? discardPlayEnabled : handPlayEnabled;
  const finalHandPlayLabel =
    discardMode ? `DISCARD ${discardSelectedIds.size}/${discardNeed}` : handPlayLabel;
  const finalHandMessages = discardMode
    ? [`Discard ${discardNeed} card(s) to end your turn.`]
    : handMessages;

  const finalMultiSelected =
    discardMode
      ? discardSelectedIds
      : sidMode
      ? sidSelectedIds
      : respondMultiMissedMode
      ? respondSelectedIds
      : undefined;

  const overlayPending = useMemo(() => {
    const k = String((uiPending as any)?.kind ?? "").toLowerCase();
    if (
      k === "panic" ||
      k === "play_panic" ||
      k === "panic_choose" ||
      k === "choose_panic" ||
      k === "panic_target_choose" ||
      k === "action_panic" ||
      k === "cat_balou" ||
      k === "catbalou" ||
      k === "play_cat_balou" ||
      k === "cat_balou_choose" ||
      k === "choose_cat_balou" ||
      k === "action_cat_balou"
    ) {
      return uiPending;
    }
    return null;
  }, [uiPending]);

  const onSendFromPanel = useCallback(
    (payload: any) => {
      if (!roomCode) return;
      if (!payload || typeof payload !== "object") return;

      const hasType = typeof (payload as any).type === "string" && (payload as any).type.length > 0;
      const outgoingType = hasType ? String((payload as any).type ?? "") : RESOLVE_ACTION_TYPE;

      if (abilityPendingToken) {
        trackedAbilityTokenRef.current = abilityPendingToken;
      }

      if (hasType) {
        sendWS({ ...(payload as any), roomCode });
      } else {
        sendWS({ type: RESOLVE_ACTION_TYPE, roomCode, ...(payload as any) });
      }

      if (
        outgoingType === "choose_draw" ||
        outgoingType === "choose_jesse_target" ||
        outgoingType === "choose_pedro_source" ||
        outgoingType === "choose_lucky_draw" ||
        outgoingType === SID_HEAL_TYPE
      ) {
        if (autoAbilityCharacter) {
          return;
        }
      }
    },
    [roomCode, sendWS, abilityPendingToken, autoAbilityCharacter]
  );

  const onToggleAbility = useCallback(() => {
    setAbilityOpen((prev) => {
      const next = !prev;
      if (next && abilityPendingToken) {
        trackedAbilityTokenRef.current = abilityPendingToken;
      }
      if (!next && autoAbilityCharacter && abilityPendingToken) {
        return true;
      }
      return next;
    });
  }, [abilityPendingToken, autoAbilityCharacter]);

  const clearFocus = useCallback(() => setFocusedId(null), []);

  const responseBanner = useMemo(() => {
    if (isBarrelChoicePending) {
      return {
        text: "Do you want to use Barrel / Jourdonnais against Bang!?",
        sub:
          barrelChoiceCount > 1
            ? `${barrelChoiceCount} draw chances are available. Tap USE BARREL to make a draw check, or SKIP BARREL to answer normally.`
            : "Tap USE BARREL to make a draw check, or SKIP BARREL to answer normally.",
      };
    }

    if (respondMode) {
      if (isRevivePendingLike) {
        return {
          text: "Use Beer now to survive.",
          sub: "Choose Beer and press Play. If not, press TAKE HIT.",
        };
      }

      const req = respondRequired;
      const remaining = respondRemaining;
      const what = isIndiansPendingLike
        ? "Indians"
        : isDuelPendingLike
        ? "Duel"
        : isGatlingPendingLike
        ? "Gatling"
        : "Bang!";

      if (respondNeed === "bang") {
        return {
          text: isJanet ? `Respond to ${what} with BANG or MISSED.` : `Respond to ${what} with BANG.`,
          sub: isJanet
            ? "Pick BANG or MISSED, then press Play. Or press TAKE HIT before you start defending."
            : "Pick BANG, then press Play. Or press TAKE HIT before you start defending.",
        };
      }

      if (req > 1) {
        return {
          text: isJanet
            ? `${what}: ${remaining}/${req} MISSED still needed (or BANG as Janet).`
            : `${what}: ${remaining}/${req} MISSED still needed.`,
          sub: isJanet
            ? "One response is not enough. Once you start defending, finish the remaining MISSED count."
            : "One response is not enough. Once you start defending, finish the remaining MISSED count.",
        };
      }

      return {
        text: isJanet ? `Respond to ${what} with MISSED or BANG.` : `Respond to ${what} with MISSED.`,
        sub: isJanet
          ? "Pick MISSED or BANG, then press Play. Or press TAKE HIT."
          : "Pick MISSED, then press Play. Or press TAKE HIT.",
      };
    }

    if (sidMode) {
      return {
        text: "Sid Ketchum: select 2 cards to heal 1 HP.",
        sub: "Then use the character panel below.",
      };
    }

    return null;
  }, [
    isBarrelChoicePending,
    barrelChoiceCount,
    respondMode,
    sidMode,
    isIndiansPendingLike,
    isDuelPendingLike,
    isGatlingPendingLike,
    isRevivePendingLike,
    respondNeed,
    respondRequired,
    respondRemaining,
    isJanet,
  ]);

  return (
    <SafeAreaView ref={rootRef as any} style={s.root}>
      <ImageBackground source={GAME_BG} style={s.bg} resizeMode="cover">
        <View style={s.bgScrim} />
      </ImageBackground>

      <TimerBadge
            phase={phase as any}
            turnEndsAt={turnEndsAt ?? null}
            pendingEndsAt={pendingEndsAt ?? null}
            pendingKind={String((personalPending as any)?.kind ?? (uiPending as any)?.kind ?? (pending as any)?.privateKind ?? (pending as any)?.kind ?? "")}
          />
      <EventBanner players={players as any[]} events={events as any} pending={pending as any} />

      <FxLayer fx={fx} anchors={anchors} onFxDone={onFxDone} />
      <DrawMotionLayer items={drawMotions} anchors={anchors} onDone={removeDrawMotion} />
      <DrawCheckOverlay
        event={drawCheckOverlayEvent as any}
        onDone={() => setDrawCheckOverlayEvent(null)}
      />

      <View style={s.gameBody}>
        <View style={s.hudTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.hudTitle} numberOfLines={1}>
              Room {roomCode || "—"}
            </Text>
            <View style={s.hudMetaRow}>
              <Text style={s.hudSub} numberOfLines={1}>ROLE: {prettyRole(myRole)}</Text>
            </View>
          </View>

          <View style={s.hudRight}>
            {isMyTurn ? (
              <WoodButton title="End Turn" onPress={endTurn} disabled={!canEndTurn} style={s.topActionBtn} />
            ) : null}

            <WoodButton title="Disconnect" onPress={confirmDisconnect} style={s.topActionBtn} />
          </View>
        </View>

        <OpponentsRow
          players={opponents as PublicPlayer[]}
          targeting={targeting}
          focusedId={focusedId}
          fx={fx}
          distanceById={distanceById}
          turnPlayerId={turnPlayerId}
          respondingPlayerId={respondingFocus.id || null}
          respondingLabel={respondingFocus.label || null}
          onPressPlayer={onPressOpponent}
          onAnchor={onAnchor}
          activeTargetId={activeFocus.id || null}
          activeTargetLabel={activeFocus.label || null}
        />

        {focusedPlayer ? (
          <View style={s.focusBackRow}>
            <WoodButton title="Back" onPress={clearFocus} style={s.focusBackBtn} />
          </View>
        ) : null}

        <View style={[s.tableArea, { minHeight: tableH }]}> 
          <TableCenter
            me={me as any}
            focused={focusedPlayer ?? null}
            fx={fx}
            distanceToMe={focusedDistance}
            turnPlayerId={turnPlayerId}
            discardTopCard={discardTopCard}
            discardCount={Number.isFinite(discardCount as any) ? discardCount : discardStackRef.current.length}
            deckCount={deckCount ?? null}
            onDeckAnchor={(pt) => onAnchor("__deck__", pt)}
            onDiscardAnchor={(pt) => onAnchor("__discard__", pt)}
            style={s.tableCenter}
            abilityControl={
              !focusedPlayer && !!me ? (
                <CharacterPanel
                  me={me as any}
                  players={players as any}
                  phase={phase as any}
                  pending={personalPending as any}
                  onSend={onSendFromPanel}
                  sidMode={sidMode}
                  sidSelectedIds={sidSelectedIds}
                  onSidToggleMode={() => setSidMode((v) => !v)}
                  onSidHeal={(cardIds: string[]) => sendWS({ type: SID_HEAL_TYPE, roomCode, cardIds })}
                  onSidClear={() => {
                    setSidMode(false);
                    setSidSelectedIds(new Set());
                  }}
                  variant="buttonOnly"
                  open={abilityOpen}
                  onToggle={onToggleAbility}
                />
              ) : null
            }
            highlighted={
              !!activeFocus.id &&
              !!me &&
              activeFocus.id === String((me as any)?.id ?? "") &&
              !focusedPlayer
            }
            highlightLabel={activeFocus.label || undefined}
          />
        </View>

        {!focusedPlayer && !!me ? (
          <CharacterAbilityOverlay
            open={abilityOpen}
            title="Character Ability"
            subtitle={
              abilityNeedsAttention
                ? `${prettyCharacterName((me as any)?.playcharacter ?? "")} • READY`
                : prettyCharacterName((me as any)?.playcharacter ?? "")
            }
            onClose={() => {
              if (autoAbilityCharacter && abilityPendingToken) return;
              setAbilityOpen(false);
            }}
          >
            <CharacterPanel
              me={me as any}
              players={players as any}
              phase={phase as any}
              pending={personalPending as any}
              onSend={onSendFromPanel}
              sidMode={sidMode}
              sidSelectedIds={sidSelectedIds}
              onSidToggleMode={() => setSidMode((v) => !v)}
              onSidHeal={(cardIds: string[]) => sendWS({ type: SID_HEAL_TYPE, roomCode, cardIds })}
              onSidClear={() => {
                setSidMode(false);
                setSidSelectedIds(new Set());
              }}
              variant="panelOnly"
              open={abilityOpen}
              onToggle={onToggleAbility}
            />
          </CharacterAbilityOverlay>
        ) : null}

        <Pressable
          style={s.tableDismissTap}
          onPress={() => {
            if (!sidMode) setSelectedCardId(null);
            setSelectedTargetId(null);
            setFocusedId(null);
          }}
        />
      </View>

      {isGeneralStorePending ? (
        <GeneralStorePanel
          offered={generalStoreCards as any}
          pickerId={generalStorePickerId || String((me as any)?.id ?? "")}
          pickerName={generalStorePickerName || undefined}
          isPicker={isGeneralStorePicker}
          selectedStoreCardId={selectedStoreCardId}
          setSelectedStoreCardId={setSelectedStoreCardId}
          selectedHandCardId={null}
          onConfirm={(takeId) => {
            if (!roomCode) return;
            sendWS({ type: "choose_general_store", roomCode, cardId: takeId });
            setSelectedStoreCardId(null);
          }}
          pickHistory={generalStorePickHistory as any}
        />
      ) : null}

      {isBarrelChoicePending ? (
        <View style={s.barrelDockWrap}>
          <View style={s.barrelDock}>
            <WoodButton
              title={barrelChoiceBusy ? "Sending..." : "Use Barrel"}
              onPress={() => sendBarrelChoice(true)}
              disabled={barrelChoiceBusy || !roomCode}
              style={s.barrelBtn}
            />
            <WoodButton
              title={barrelChoiceBusy ? "Sending..." : "Skip Barrel"}
              onPress={() => sendBarrelChoice(false)}
              disabled={barrelChoiceBusy || !roomCode}
              style={s.barrelBtn}
            />
          </View>
        </View>
      ) : null}

      {responseBanner ? (
        <View style={[s.responseDock, respondMode ? s.responseDockDanger : null, isBarrelChoicePending ? s.responseDockBarrel : null]}>
          <Text style={s.responseDockText}>{responseBanner.text}</Text>
          {responseBanner.sub ? <Text style={s.responseDockSub}>{responseBanner.sub}</Text> : null}
        </View>
      ) : null}

      <Animated.View
        {...chatPanResponder.panHandlers}
        style={[
          s.chatFabWrap,
          {
            left: chatFabPos.x,
            top: chatFabPos.y,
            right: undefined,
            bottom: undefined,
            transform: [
              {
                translateY: chatFabFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[s.chatFab, chatOpen ? s.chatFabOpen : null]}>
          <Text style={s.chatFabText}>{chatOpen ? "CLOSE" : "CHAT"}</Text>
          <Text style={s.chatFabGrip}>DRAG</Text>
          {unreadChatCount > 0 ? (
            <View style={s.chatFabBadge}>
              <Text style={s.chatFabBadgeText}>{unreadChatCount > 9 ? "9+" : unreadChatCount}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>

      <ChatOverlay open={chatOpen} onClose={() => setChatOpen(false)} />

      <HandBar
        me={me as any}
        selectedCardId={selectedCardId}
        onPressCard={onPressCard}
        onPlay={finalHandOnPlay}
        onTakeHit={handOnTakeHit}
        takeHitLabel="TAKE HIT"
        mode={handMode}
        allowedKeys={handAllowedKeys}
        playLabel={finalHandPlayLabel}
        playEnabled={finalHandPlayEnabled}
        hint=""
        messages={finalHandMessages}
        multiSelectedIds={finalMultiSelected}
        onMeAnchor={(pt) => {
          if (!me?.id) return;
          onAnchor(String((me as any).id), pt);
        }}
      />

      <ActionOverlay
        me={me as any}
        players={players as any}
        pending={overlayPending as any}
        onSend={onSendFromPanel}
        localPick={localPick as any}
        onCloseLocalPick={() => setLocalPick(null)}
        onConfirmLocalPick={(sel) => {
          if (!roomCode) return;
          if (!localPick) return;

          const base: any = {
            type: "play_card",
            roomCode,
            cardId: localPick.cardId,
            targetId: localPick.targetId,
          };

          if (sel.type === "hand") {
            sendWS({
              ...base,
              pickHand: true,
              targetZone: "hand",
              targetHandIndex: sel.index,
            });
            return;
          }

          const eq =
            (localPick.equipment as any[]).find((c: any) => String(c?.id) === String(sel.cardId)) ??
            (localPick.equipment as any[]).find((c: any) => String(c?.key ?? c?.name) === String(sel.cardId));

          const realId = String(eq?.id ?? sel.cardId);

          sendWS({
            ...base,
            targetCardId: realId,
            pickHand: false,
            targetZone: "equipment",
          });
        }}
      />

      {lastPassive ? <PassiveToast lastPassive={lastPassive as any} /> : null}

      <StartInfoOverlay
        open={showStartInfo}
        role={myRole}
        characterKey={myCharacterKey}
        playerName={String((me as any)?.name ?? "")}
        onSkip={() => setIntroDismissedRoom(roomCode)}
      />

      <EndGameOverlay
        open={!!gameOver}
        meId={String((me as any)?.id ?? "")}
        gameOver={gameOver}
        onBackHome={backHomeFromGameOver}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#08090a" },
  scrollContent: { paddingBottom: 8 },
  gameBody: {
    flex: 1,
    paddingBottom: 2,
  },
  focusBackRow: {
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 2,
    alignItems: "flex-start",
    zIndex: 3,
  },
  focusBackBtn: {
    minWidth: 96,
    height: 34,
  },
  tableArea: {
    flexShrink: 1,
    marginTop: 2,
    marginBottom: 4,
  },
  tableCenter: {
    flexShrink: 1,
  },
  tableDismissTap: {
    height: 4,
  },

  bg: { ...StyleSheet.absoluteFillObject },
  bgScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },

  hudTop: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hudTitle: { color: "rgba(255,255,255,0.92)", fontWeight: "900", fontSize: 16 },
  hudSub: { color: "rgba(255,255,255,0.70)", fontSize: 12, marginTop: 2, fontWeight: "800" },
  hudMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  turnHeroChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,216,107,0.96)",
    borderWidth: 1,
    borderColor: "rgba(100,58,12,0.36)",
  },
  turnHeroChipText: { color: "#3C210D", fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  turnWaitChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  turnWaitChipText: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  hudRight: { flexDirection: "row", gap: 10, alignItems: "center" },
  topActionBtn: { minWidth: 104 },

  playerZone: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 8,
  },
  playerInfoBoard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(40,22,6,0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,210,120,0.24)",
  },
  playerInfoTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  playerInfoName: {
    color: "white",
    fontSize: 17,
    fontWeight: "900",
  },
  playerInfoSub: {
    color: "rgba(255,255,255,0.78)",
    marginTop: 3,
    fontWeight: "700",
  },
  playerStatsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  playerStatChip: {
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
  },
  playerStatLabel: {
    color: "#E6C27A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  playerStatValue: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  playerInfoDivider: {
    height: 1,
    marginVertical: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  playerInfoBottomRow: {
    gap: 8,
  },
  playerInfoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playerInfoCaption: {
    width: 58,
    color: "#E6C27A",
    fontWeight: "900",
    fontSize: 12,
  },
  playerInfoValue: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontWeight: "800",
    fontSize: 12,
  },
  playerGoalText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.80)",
    lineHeight: 18,
  },

  btnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  btnWarn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,120,60,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,120,60,0.30)",
  },
  btnText: { color: "rgba(255,255,255,0.92)", fontWeight: "900" },

  endTurnBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(220,40,40,0.95)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
  },
  endTurnText: { color: "white", fontWeight: "900" },

  characterDock: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },

  barrelDockWrap: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  barrelDock: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  barrelBtn: {
    flex: 1,
    maxWidth: 190,
  },

  responseDock: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(10,10,10,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  responseDockDanger: {
    backgroundColor: "rgba(150,30,30,0.84)",
    borderColor: "rgba(255,220,200,0.24)",
  },
  responseDockBarrel: {
    marginBottom: 6,
  },
  responseDockText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },
  responseDockSub: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },

  turnRibbon: {
    position: "absolute",
    top: 56,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(80,42,12,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,214,138,0.34)",
    zIndex: 1200,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  turnRibbonText: { color: "#FFF3D6", fontWeight: "900", fontSize: 13, letterSpacing: 0.7 },

  chatFabWrap: {
    position: "absolute",
    zIndex: 1400,
  },
  chatFab: {
    minWidth: 88,
    height: 48,
    borderRadius: 21,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    backgroundColor: "rgba(73,38,16,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,214,138,0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  chatFabOpen: {
    backgroundColor: "rgba(101,49,18,0.98)",
  },
  chatFabText: {
    color: "#FFF3D6",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.7,
  },
  chatFabGrip: {
    color: "rgba(255,243,214,0.54)",
    fontWeight: "800",
    fontSize: 9,
    letterSpacing: 1.1,
  },
  chatFabBadge: {
    position: "absolute",
    top: -6,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "#B3261E",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  chatFabBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
  },

  timerBox: {
    position: "absolute",
    top: 52,
    right: 14,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.70)",
    borderWidth: 1,
    borderColor: "rgba(255,200,120,0.35)",
    zIndex: 999,
    alignItems: "center",
  },
  timerBoxAction: {
    borderColor: "rgba(255,116,92,0.55)",
    backgroundColor: "rgba(33,10,8,0.78)",
  },
  timerKicker: {
    color: "rgba(255,225,170,0.9)",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  timerKickerAction: {
    color: "#ffb6a4",
  },
  timerText: { color: "white", fontWeight: "900", fontSize: 16 },
});