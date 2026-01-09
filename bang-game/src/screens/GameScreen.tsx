// src/screens/GameScreen.tsx

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ImageBackground,
  Image,
  Modal,
  useWindowDimensions,
  ScrollView,
  SafeAreaView,
  Animated,
  Easing,
} from "react-native";

import { usePlayer, WEAPON_LABEL, WEAPON_RANGE } from "../contexts/playercontext";
import type { Card, WeaponKey } from "../models/card";

import { getCardImage, CARD_BACK } from "../data/cardAssets";
import { ROLE_IMAGES } from "../data/roleAssets";
import { getCharacterSafe } from "../models/characters";

// ✅ حط صورة الخشبة هون (عدّل المسار حسب مشروعك)
const WOOD_BOARD = require("../../assets/wood_board.png");

const OPP_CARD_W = 190;
const GAP = 12;

/** ================== HELPERS ================== */

function rotateToMe<T extends { id: string }>(arr: T[], myId: string) {
  const idx = arr.findIndex((p) => p.id === myId);
  if (idx <= 0) return arr;
  return [...arr.slice(idx), ...arr.slice(0, idx)];
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
    if (it?.key === "weapon" && it?.weaponKey) return it.weaponKey as WeaponKey;
  }

  for (const it of equipment) {
    const k = normalizeWeaponKey(String(it?.weaponKey ?? it?.key ?? it?.id ?? it?.name ?? it ?? ""));
    if (k) return k;
  }

  return "colt45";
}

function isWeaponItem(x: any) {
  if (!x) return false;
  if (x?.key === "weapon") return true;
  const maybe = String(x?.weaponKey ?? x?.key ?? x?.id ?? x?.name ?? x ?? "");
  return !!normalizeWeaponKey(maybe);
}

function pickFirstBlueEquipment(equipment: any[]) {
  if (!Array.isArray(equipment)) return null;
  const nonWeapon = equipment.filter((x) => !isWeaponItem(x));
  return nonWeapon.length ? nonWeapon[0] : null;
}

function findEquippedWeaponCard(equipment: any[]) {
  if (!Array.isArray(equipment)) return null;
  const w = equipment.find(
    (x) =>
      x?.key === "weapon" ||
      (x && normalizeWeaponKey(String(x?.weaponKey ?? x?.key ?? x?.id ?? x?.name ?? "")))
  );
  return w ?? null;
}

function formatSeconds(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function safeCardImage(c: any) {
  if (!c) return null;
  try {
    return getCardImage(c) ?? null;
  } catch {
    return null;
  }
}

function cardLabel(c: any) {
  if (!c) return "";
  if (typeof c === "string") return c;
  return String(c.key ?? c.weaponName ?? c.weaponKey ?? c.id ?? "");
}

function normPendingKind(pending: any): string {
  return String(pending?.kind ?? pending?.type ?? "").toLowerCase();
}

function includesAny(s: string, arr: string[]) {
  return arr.some((x) => s.includes(x));
}

function normCardKey(raw: any) {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function isCharId(me: any, id: string) {
  return String(me?.playcharacter ?? "").toLowerCase().trim() === id;
}

/** ================== COMPONENT ================== */

export default function GameScreen() {
  const ctx = usePlayer();
  const { width, height } = useWindowDimensions();

  const {
    roomCode,
    players,
    me,
    turnPlayerId,
    wsStatus,
    sendWS,
    phase,
    pending,
    turnEndsAt,
    pendingEndsAt,
  } = ctx as any;

  /** ✅ لازم كل الـHooks تكون قبل أي return شرطي */
  const isSmall = height < 740;
  const BOARD_H = isSmall ? 190 : 220;
  const OPP_H = isSmall ? 112 : 130;

  /** ============ WS SEND ============ */
  const sendGameWS = (payload: any) => {
    if (wsStatus !== "open") return;
    if (!roomCode) return;
    sendWS({ ...payload, roomCode });
  };

  /** ============ PLAYERS ORDER ============ */
  const ordered = useMemo(() => {
    if (!me) return players ?? [];
    return rotateToMe(players ?? [], me.id);
  }, [players, me]);

  const others = useMemo(() => {
    if (!me) return [];
    return ordered.filter((p: any) => p.id !== me.id);
  }, [ordered, me]);

  /** ============ OPPONENT SELECT ============ */
  const listRef = useRef<FlatList<any>>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);

  const selectedOpponent = useMemo(() => {
    if (!selectedOpponentId) return null;
    return (players ?? []).find((p: any) => p.id === selectedOpponentId) ?? null;
  }, [players, selectedOpponentId]);

  const selectedOpponentIndex = useMemo(() => {
    if (!selectedOpponentId) return 0;
    const i = others.findIndex((p: any) => p.id === selectedOpponentId);
    return i < 0 ? 0 : i;
  }, [selectedOpponentId, others]);

  const goPrev = () => {
    if (!others.length) return;
    const next = Math.max(0, selectedOpponentIndex - 1);
    const id = others[next].id;
    setSelectedOpponentId(id);
    listRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
  };

  const goNext = () => {
    if (!others.length) return;
    const next = Math.min(others.length - 1, selectedOpponentIndex + 1);
    const id = others[next].id;
    setSelectedOpponentId(id);
    listRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
  };

  /** ============ HAND SELECT (single + multi) ============ */
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [multiIds, setMultiIds] = useState<Set<string>>(new Set());

  const myHand: Card[] = (me?.hand ?? []) as any[];

  const selectedCard = useMemo(() => {
    if (!me || !selectedCardId) return null;
    return myHand.find((c: any) => c.id === selectedCardId) ?? null;
  }, [me, selectedCardId, myHand]);

  const isCalamity = useMemo(() => isCharId(me, "calamity_janet"), [me]);
  const isSid = useMemo(() => isCharId(me, "sid_ketchum"), [me]);

  const selectedKey = useMemo(() => normCardKey((selectedCard as any)?.key), [selectedCard]);

  const needsTarget = useMemo(() => {
    if (!selectedCard) return false;
    if (selectedKey === "bang") return true;
    if (selectedKey === "panic") return true;
    if (selectedKey === "catbalou") return true;
    if (selectedKey === "duel") return true;
    if (selectedKey === "jail") return true;
    if (isCalamity && selectedKey === "missed") return true;
    return false;
  }, [selectedCard, selectedKey, isCalamity]);

  const isMyTurn = !!me && turnPlayerId === me.id;

  const canPlaySelected = useMemo(() => {
    if (!selectedCardId) return false;
    if (!isMyTurn) return false;
    if (phase !== "main") return false;
    if (needsTarget && !selectedOpponentId) return false;
    return true;
  }, [isMyTurn, selectedCardId, needsTarget, selectedOpponentId, phase]);

  /** ============ PEEK MODAL (tap to zoom) ============ */
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekSrc, setPeekSrc] = useState<any | null>(null);
  const [peekTitle, setPeekTitle] = useState<string>("");

  const openPeekByCard = (c: any) => {
    if (!c) return;
    const src = safeCardImage(c);
    setPeekSrc(src ?? CARD_BACK);
    setPeekTitle(cardLabel(c) || "CARD");
    setPeekOpen(true);
  };

  const openPeekByImage = (src: any, title: string) => {
    if (!src) return;
    setPeekSrc(src);
    setPeekTitle(title || "");
    setPeekOpen(true);
  };

  const closePeek = () => {
    setPeekOpen(false);
    setPeekSrc(null);
    setPeekTitle("");
  };

  /** ============ ACTIONS ============ */
  const endTurn = () => {
    if (!isMyTurn) return;
    if (phase !== "main") return;
    sendGameWS({ type: "end_turn" });
  };

  const playSelected = () => {
    if (!selectedCardId) return;
    if (!isMyTurn) return;
    if (phase !== "main") return;

    const payload: any = { type: "play_card", cardId: selectedCardId };
    if (needsTarget && selectedOpponentId) payload.targetId = selectedOpponentId;

    sendGameWS(payload);
    setSelectedCardId(null);
  };

  /** ============ PENDING / RESPONSE / CHOICES ============ */
  const pKind = normPendingKind(pending);
  const isWaiting = phase === "waiting";

  const pendingCurrentTargetId = useMemo(() => {
    if (!pending) return null;
    const arr = pending?.targets;
    const idx = pending?.idx;
    if (!Array.isArray(arr)) return null;
    const i = Number(idx);
    if (!Number.isFinite(i) || i < 0 || i >= arr.length) return null;
    return arr[i] ?? null;
  }, [pending]);

  const iAmActor = useMemo(() => {
    if (!me) return false;
    if (!isWaiting) return false;

    if (pKind.startsWith("respond_to_")) return true;
    if (includesAny(pKind, ["choose_draw", "choose_pedro_source", "choose_jesse_target", "discard_to_limit"]))
      return true;

    if (pending?.playerId && pending.playerId === me.id) return true;
    if (pending?.targetId && pending.targetId === me.id) return true;
    if (pending?.toPlayerId && pending.toPlayerId === me.id) return true;
    if (pending?.responderId && pending.responderId === me.id) return true;

    if ((pKind === "indians" || pKind === "gatling") && pendingCurrentTargetId === me.id) return true;

    return false;
  }, [me, isWaiting, pKind, pending, pendingCurrentTargetId]);

  const isRespondBang = useMemo(() => {
    if (!me || !isWaiting) return false;
    if (pKind === "bang" && pending?.targetId === me.id) return true;
    if (pKind.includes("respond_to_bang")) return true;
    return false;
  }, [me, isWaiting, pKind, pending]);

  const isRespondIndians = useMemo(() => {
    if (!me || !isWaiting) return false;
    if (pKind.includes("respond_to_indians")) return true;
    if (pKind === "indians" && pendingCurrentTargetId === me.id) return true;
    return false;
  }, [me, isWaiting, pKind, pendingCurrentTargetId]);

  const isRespondGatling = useMemo(() => {
    if (!me || !isWaiting) return false;
    if (pKind.includes("respond_to_gatling")) return true;
    if (pKind === "gatling" && pendingCurrentTargetId === me.id) return true;
    return false;
  }, [me, isWaiting, pKind, pendingCurrentTargetId]);

  const isRespondDuel = useMemo(() => {
    if (!me || !isWaiting) return false;
    if (pKind.includes("respond_to_duel")) return true;
    if (pKind === "duel" && pending?.responderId === me.id) return true;
    return false;
  }, [me, isWaiting, pKind, pending]);

  const isChooseDraw = useMemo(
    () => isWaiting && includesAny(pKind, ["choose_draw", "draw_choice", "kit"]),
    [isWaiting, pKind]
  );
  const isChoosePedro = useMemo(
    () => isWaiting && includesAny(pKind, ["choose_pedro_source", "pedro_choice", "pedro"]),
    [isWaiting, pKind]
  );
  const isChooseJesse = useMemo(
    () => isWaiting && includesAny(pKind, ["choose_jesse_target", "jesse_choice", "jesse"]),
    [isWaiting, pKind]
  );
  const isDiscardToLimit = useMemo(
    () => isWaiting && includesAny(pKind, ["discard_to_limit", "discard_limit", "hand_limit"]),
    [isWaiting, pKind]
  );

  const missedCardId = useMemo(() => {
    const m = myHand.find((x: any) => normCardKey(x?.key) === "missed");
    if (m) return m.id ?? null;

    if (isCalamity) {
      const b = myHand.find((x: any) => normCardKey(x?.key) === "bang");
      return b?.id ?? null;
    }
    return null;
  }, [myHand, isCalamity]);

  const bangCardId = useMemo(() => {
    const b = myHand.find((x: any) => normCardKey(x?.key) === "bang");
    if (b) return b.id ?? null;

    if (isCalamity) {
      const m = myHand.find((x: any) => normCardKey(x?.key) === "missed");
      return m?.id ?? null;
    }
    return null;
  }, [myHand, isCalamity]);

  const respondWithCard = (cardId: string) => sendGameWS({ type: "respond", cardId });
  const respondPass = () => sendGameWS({ type: "respond" });

  const chooseDrawOptions: any[] = useMemo(() => {
    const opt = pending?.offered ?? pending?.options ?? pending?.cards ?? pending?.candidates ?? null;
    if (Array.isArray(opt)) return opt;
    return [];
  }, [pending]);

  const chooseDrawPickCount = useMemo(() => {
    const k = Number(pending?.pickCount ?? 2);
    return Number.isFinite(k) && k > 0 ? k : 2;
  }, [pending]);

  const chooseDrawSelectedIds = useMemo(() => Array.from(multiIds), [multiIds]);
  const chooseDrawCanConfirm = chooseDrawSelectedIds.length === chooseDrawPickCount;

  const confirmChooseDraw = () => {
    if (!chooseDrawCanConfirm) return;
    sendGameWS({ type: "choose_draw", cardIds: chooseDrawSelectedIds });
    setMultiIds(new Set());
  };

  const canPedroDiscard = useMemo(() => {
    const v = pending?.canUseDiscard;
    if (typeof v === "boolean") return v;
    return !!pending?.canUseDiscard;
  }, [pending]);

  const choosePedro = (source: "deck" | "discard") => {
    if (source === "discard" && !canPedroDiscard) return;
    sendGameWS({ type: "choose_pedro_source", source });
  };

  const eligibleJesseTargets: string[] = useMemo(() => {
    const arr = pending?.eligibleTargets;
    if (Array.isArray(arr)) return arr.map(String);
    return [];
  }, [pending]);

  const chooseJesse = (targetId?: string) => {
    sendGameWS({ type: "choose_jesse_target", targetId });
  };

  const requiredDiscardCount = useMemo(() => {
    const fromPending = Number(pending?.requiredCount ?? pending?.count ?? pending?.need ?? pending?.required ?? NaN);
    if (Number.isFinite(fromPending) && fromPending >= 0) return fromPending;

    const hp = Number(me?.hp ?? 0);
    return Math.max(0, myHand.length - hp);
  }, [pending, me, myHand.length]);

  const discardSelectedIds = useMemo(() => Array.from(multiIds), [multiIds]);
  const discardCanConfirm = discardSelectedIds.length === requiredDiscardCount;

  const confirmDiscardToLimit = () => {
    if (!discardCanConfirm) return;
    sendGameWS({ type: "discard_to_limit", cardIds: discardSelectedIds });
    setMultiIds(new Set());
  };

  /** ============ SID HEAL ============ */
  const [sidMode, setSidMode] = useState(false);

  const canOpenSidMode = useMemo(() => {
    if (!isSid) return false;
    if (phase !== "main") return false;
    if (!me?.isAlive) return false;
    if (Number(me?.hp ?? 0) >= Number(me?.maxHp ?? 0)) return false;
    if ((myHand?.length ?? 0) < 2) return false;
    return true;
  }, [isSid, phase, me, myHand?.length]);

  const sidSelectedIds = useMemo(() => Array.from(multiIds), [multiIds]);
  const sidCanConfirm = sidSelectedIds.length === 2;

  const confirmSidHeal = () => {
    if (!sidCanConfirm) return;
    sendGameWS({ type: "sid_heal", cardIds: sidSelectedIds });
    setMultiIds(new Set());
    setSidMode(false);
  };

  /** ============ MULTI MODE ============ */
  const multiMode = isChooseDraw || isDiscardToLimit || sidMode;

  const toggleMulti = useCallback((id: string, max: number) => {
    setMultiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= max) return next;
      next.add(id);
      return next;
    });
  }, []);

  const clearMulti = () => setMultiIds(new Set());

  useEffect(() => {
    setMultiIds(new Set());
  }, [isChooseDraw, isDiscardToLimit, sidMode]);

  useEffect(() => {
    if (isWaiting) setSidMode(false);
  }, [isWaiting]);

  /** ============ TIMER ============ */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const activeEndsAt = isWaiting ? pendingEndsAt : turnEndsAt;

  const secondsLeft = useMemo(() => {
    if (!activeEndsAt || activeEndsAt <= 0) return 0;
    const msLeft = Math.max(0, activeEndsAt - now);
    return Math.ceil(msLeft / 1000);
  }, [activeEndsAt, now]);

  const timerLabel = isWaiting ? "ACTION" : "TURN";

  /** ============ DECK/DISCARD + DRAW ANIMATION ============ */
  const [flyVisible, setFlyVisible] = useState(false);
  const flyT = useRef(new Animated.Value(0)).current;
  const prevHandLenRef = useRef<number>(0);

  const triggerDrawAnim = useCallback(() => {
    setFlyVisible(true);
    flyT.stopAnimation();
    flyT.setValue(0);
    Animated.timing(flyT, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setFlyVisible(false);
      flyT.setValue(0);
    });
  }, [flyT]);

  useEffect(() => {
    const cur = myHand.length;
    const prev = prevHandLenRef.current;

    // أول مرة ما نعمل أنيميشن
    if (prev === 0) {
      prevHandLenRef.current = cur;
      return;
    }

    if (cur > prev) triggerDrawAnim();
    prevHandLenRef.current = cur;
  }, [myHand.length, triggerDrawAnim]);

  const flyX = flyT.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(width * 0.45)],
  });
  const flyY = flyT.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height * 0.55],
  });
  const flyS = flyT.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.05],
  });
  const flyA = flyT.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 0],
  });

  /** ============ BOARD DATA (بدون Hooks) ============ */
  const boardPlayer = selectedOpponent ?? me;
  const boardChar = getCharacterSafe(String(boardPlayer?.playcharacter ?? ""));
  const boardWeaponCard = findEquippedWeaponCard(boardPlayer?.equipment);
  const boardBlueCard = pickFirstBlueEquipment(boardPlayer?.equipment);
  const boardWeaponKey: WeaponKey =
    (boardPlayer?.weaponKey as WeaponKey) ?? weaponFromEquipment(boardPlayer?.equipment ?? []);

  const showBoardRole = boardPlayer?.id === me?.id || boardPlayer?.role === "sheriff";
  const boardRoleImg = showBoardRole ? (ROLE_IMAGES as any)[boardPlayer?.role] ?? null : null;
  const boardIsMe = boardPlayer?.id === me?.id;

  /** ============ EARLY RENDER WHEN NO ME (بعد كل الـHooks) ============ */
  if (!me) {
    return (
      <ImageBackground source={require("../../assets/homescreen3.png")} style={{ flex: 1 }} resizeMode="cover">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
            <Text style={{ color: "white" }}>Loading…</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  /** ============ RENDER ============ */
  return (
    <ImageBackground source={require("../../assets/homescreen3.png")} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.root}>
          <View style={styles.overlay} />

          {/* ✅ FLYING CARD ANIMATION (from deck to hand) */}
          {flyVisible && (
            <Animated.Image
              source={CARD_BACK}
              resizeMode="cover"
              style={[
                styles.flyCard,
                {
                  opacity: flyA,
                  transform: [{ translateX: flyX }, { translateY: flyY }, { scale: flyS }],
                },
              ]}
            />
          )}

          {/* ✅ PEEK MODAL */}
          <Modal visible={peekOpen} transparent animationType="fade" onRequestClose={closePeek}>
            <View style={styles.peekBackdrop}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={closePeek} />
              <View style={styles.peekCenter}>
                <View
                  style={[
                    styles.peekCardWrap,
                    {
                      width: Math.min(width * 0.78, 360),
                      height: Math.min(width * 0.78 * 1.38, 520),
                    },
                  ]}
                >
                  {peekSrc ? <Image source={peekSrc} style={styles.peekImg} resizeMode="contain" /> : null}
                </View>
                {!!peekTitle && <Text style={styles.peekTitle}>{peekTitle}</Text>}
                <Text style={styles.peekHint}>Tap outside to close</Text>
              </View>
            </View>
          </Modal>

          {/* ✅ SCROLLABLE TOP (عشان ما يختفي اشي تحت) */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
            {/* Top bar + TIMER */}
            <View style={[styles.topBar, { paddingTop: isSmall ? 8 : 12 }]}>
              <View style={{ gap: 4 }}>
                <Text style={styles.topText}>Room: {roomCode || "—"}</Text>
                <Text style={styles.topText}>
                  Turn:{" "}
                  {turnPlayerId === me.id
                    ? "YOU"
                    : (players ?? []).find((p: any) => p.id === turnPlayerId)?.name ?? "—"}
                </Text>
              </View>

              <View style={styles.timerBadge}>
                <Text style={styles.timerLabel}>{timerLabel}</Text>
                <Text style={styles.timerText}>{formatSeconds(secondsLeft)}</Text>
              </View>
            </View>

            {/* Opponents row */}
            <View style={[styles.opponentsRow, { height: OPP_H + 18 }]}>
              <Pressable onPress={goPrev} style={[styles.navBtn, { height: OPP_H }]}>
                <Text style={styles.navBtnText}>‹</Text>
              </Pressable>

              <FlatList
                ref={listRef}
                horizontal
                data={others}
                keyExtractor={(p: any) => p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 10, gap: GAP }}
                snapToInterval={OPP_CARD_W + GAP}
                decelerationRate="fast"
                renderItem={({ item }: any) => {
                  const isTurn = item.id === turnPlayerId;
                  const isSel = item.id === selectedOpponentId;

                  const showRole = item.role === "sheriff";
                  const roleImg = showRole ? (ROLE_IMAGES as any)[item.role] ?? null : null;

                  const wKey: WeaponKey = (item.weaponKey as WeaponKey) ?? weaponFromEquipment(item.equipment);
                  const wLabel = WEAPON_LABEL[wKey] ?? "Colt .45";
                  const wRange = WEAPON_RANGE[wKey] ?? 1;

                  const char = getCharacterSafe(String(item.playcharacter ?? ""));

                  return (
                    <Pressable
                      onPress={() => setSelectedOpponentId(isSel ? null : item.id)}
                      style={[
                        styles.pCard,
                        { width: OPP_CARD_W, height: OPP_H },
                        isTurn && styles.turnGlow,
                        isSel && styles.selGlow,
                      ]}
                    >
                      <View style={styles.pHead}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          {char?.image ? <Image source={char.image} style={styles.avatarCircle} /> : null}
                          <Text style={styles.pName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>

                        {roleImg ? <Image source={roleImg} style={styles.roleIcon} /> : null}
                      </View>

                      {item.role === "sheriff" && (
                        <View style={[styles.badge, { marginTop: 6, alignSelf: "flex-start" }]}>
                          <Text style={styles.badgeText}>⭐ SHERIFF</Text>
                        </View>
                      )}

                      <Text style={styles.pMeta}>
                        ❤️ {item.hp}/{item.maxHp} • Hand {item.handCount}
                      </Text>

                      <View style={styles.weaponLine}>
                        <Text style={styles.weaponLineText}>🔫 {wLabel} ({wRange})</Text>
                      </View>
                    </Pressable>
                  );
                }}
                onScrollToIndexFailed={() => {}}
              />

              <Pressable onPress={goNext} style={[styles.navBtn, { height: OPP_H }]}>
                <Text style={styles.navBtnText}>›</Text>
              </Pressable>
            </View>

            {/* ✅ BOARD */}
            <View style={styles.boardArea}>
              <ImageBackground
                source={WOOD_BOARD}
                style={[styles.board, { height: BOARD_H }]}
                imageStyle={styles.boardImg}
                resizeMode="cover"
              >
                <View style={styles.boardShade} />

                {/* Deck/Discard (يمين فوق) */}
                <View style={styles.pilesRow}>
                  <Pressable
                    onPress={() => openPeekByImage(CARD_BACK, "DECK")}
                    style={styles.pile}
                  >
                    <Image source={CARD_BACK} style={styles.pileImg} resizeMode="cover" />
                    <Text style={styles.pileText}>DECK</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openPeekByImage(CARD_BACK, "DISCARD")}
                    style={[styles.pile, { opacity: 0.95 }]}
                  >
                    <Image source={CARD_BACK} style={[styles.pileImg, { opacity: 0.55 }]} resizeMode="cover" />
                    <Text style={styles.pileText}>DISCARD</Text>
                  </Pressable>
                </View>

                {/* Header: name + hp + role */}
                <View style={styles.boardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boardName}>
                      {boardIsMe ? `You: ${boardPlayer.name}` : boardPlayer.name}
                    </Text>
                    <Text style={styles.boardHp}>
                      ❤️ {boardPlayer.hp}/{boardPlayer.maxHp}
                    </Text>
                  </View>

                  {boardRoleImg ? <Image source={boardRoleImg} style={styles.boardRole} /> : null}
                </View>

                {/* Cards Row: [Equipment] [Character] [Weapon] */}
                <View style={styles.boardCardsRow}>
                  {/* Equipment slot */}
                  <View style={styles.slotCol}>
                    <Text style={styles.slotLabel}>EQUIP</Text>

                    {boardBlueCard ? (
                      <Pressable onPress={() => openPeekByCard(boardBlueCard)} style={styles.slotCard}>
                        {safeCardImage(boardBlueCard) ? (
                          <Image source={safeCardImage(boardBlueCard)!} style={styles.slotImg} resizeMode="cover" />
                        ) : (
                          <View style={styles.slotFallback}>
                            <Text style={styles.slotFallbackText}>{cardLabel(boardBlueCard) || "EQUIP"}</Text>
                          </View>
                        )}
                      </Pressable>
                    ) : (
                      <View style={[styles.slotCard, styles.slotEmpty]}>
                        <Text style={styles.emptyText}>EMPTY</Text>
                      </View>
                    )}
                  </View>

                  {/* Character */}
                  <View style={styles.charCol}>
                    <Text style={styles.slotLabel}>CHARACTER</Text>

                    <Pressable
                      onPress={() => {
                        if (boardChar?.image) openPeekByImage(boardChar.image, String(boardChar?.id ?? "character"));
                      }}
                      style={[styles.charCard, { height: isSmall ? 138 : 150, width: isSmall ? 110 : 120 }]}
                    >
                      {boardChar?.image ? (
                        <Image source={boardChar.image} style={styles.charImg} resizeMode="cover" />
                      ) : (
                        <View style={styles.slotFallback}>
                          <Text style={styles.slotFallbackText}>CHAR</Text>
                        </View>
                      )}
                    </Pressable>
                  </View>

                  {/* Weapon */}
                  <View style={styles.slotCol}>
                    <Text style={styles.slotLabel}>WEAPON</Text>

                    {boardWeaponCard ? (
                      <Pressable onPress={() => openPeekByCard(boardWeaponCard)} style={styles.slotCard}>
                        {safeCardImage(boardWeaponCard) ? (
                          <Image source={safeCardImage(boardWeaponCard)!} style={styles.slotImg} resizeMode="cover" />
                        ) : (
                          <View style={styles.slotFallback}>
                            <Text style={styles.slotFallbackText}>{cardLabel(boardWeaponCard) || "WEAPON"}</Text>
                          </View>
                        )}
                      </Pressable>
                    ) : (
                      <View style={[styles.slotCard, styles.slotEmpty]}>
                        <Text style={styles.emptyText}>EMPTY</Text>
                        <Text style={styles.emptySub}>
                          {WEAPON_LABEL[boardWeaponKey]
                            ? `default: ${WEAPON_LABEL[boardWeaponKey]}`
                            : "no weapon"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.boardHint}>Tap any card on the board to zoom</Text>
              </ImageBackground>
            </View>

            {/* ✅ PENDING PANEL */}
            {isWaiting && (
              <View style={styles.pendingPanel}>
                <Text style={styles.pendingTitle}>Action required</Text>
                <Text style={styles.pendingSub} numberOfLines={2}>
                  {pKind || "waiting…"}
                </Text>

                {!iAmActor && <Text style={styles.pendingNote}>Waiting for another player…</Text>}

                {/* RESPOND: BANG */}
                {iAmActor && isRespondBang && (
                  <>
                    <Text style={styles.pendingTiny}>
                      Needed:{" "}
                      <Text style={{ fontWeight: "900" }}>
                        {Number(pending?.requiredMissed ?? 1) - Number(pending?.missedSoFar ?? 0)}
                      </Text>{" "}
                      MISSED
                    </Text>

                    <View style={styles.pendingBtnsRow}>
                      <Pressable
                        onPress={() => missedCardId && respondWithCard(missedCardId)}
                        disabled={!missedCardId}
                        style={[styles.pendingBtn, !missedCardId && { opacity: 0.4 }]}
                      >
                        <Text style={styles.pendingBtnText}>
                          Play{" "}
                          {isCalamity &&
                          normCardKey((myHand.find((x: any) => x?.id === missedCardId) as any)?.key) === "bang"
                            ? "BANG (as MISSED)"
                            : "MISSED"}
                        </Text>
                      </Pressable>

                      <Pressable onPress={respondPass} style={[styles.pendingBtn, styles.pendingDanger]}>
                        <Text style={styles.pendingBtnText}>Take Hit</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {/* RESPOND: INDIANS */}
                {iAmActor && isRespondIndians && (
                  <View style={styles.pendingBtnsRow}>
                    <Pressable
                      onPress={() => bangCardId && respondWithCard(bangCardId)}
                      disabled={!bangCardId}
                      style={[styles.pendingBtn, !bangCardId && { opacity: 0.4 }]}
                    >
                      <Text style={styles.pendingBtnText}>
                        Discard{" "}
                        {isCalamity &&
                        normCardKey((myHand.find((x: any) => x?.id === bangCardId) as any)?.key) === "missed"
                          ? "MISSED (as BANG)"
                          : "BANG"}
                      </Text>
                    </Pressable>

                    <Pressable onPress={respondPass} style={[styles.pendingBtn, styles.pendingDanger]}>
                      <Text style={styles.pendingBtnText}>Lose 1 HP</Text>
                    </Pressable>
                  </View>
                )}

                {/* RESPOND: GATLING */}
                {iAmActor && isRespondGatling && (
                  <View style={styles.pendingBtnsRow}>
                    <Pressable
                      onPress={() => missedCardId && respondWithCard(missedCardId)}
                      disabled={!missedCardId}
                      style={[styles.pendingBtn, !missedCardId && { opacity: 0.4 }]}
                    >
                      <Text style={styles.pendingBtnText}>
                        Play{" "}
                        {isCalamity &&
                        normCardKey((myHand.find((x: any) => x?.id === missedCardId) as any)?.key) === "bang"
                          ? "BANG (as MISSED)"
                          : "MISSED"}
                      </Text>
                    </Pressable>

                    <Pressable onPress={respondPass} style={[styles.pendingBtn, styles.pendingDanger]}>
                      <Text style={styles.pendingBtnText}>Lose 1 HP</Text>
                    </Pressable>
                  </View>
                )}

                {/* RESPOND: DUEL */}
                {iAmActor && isRespondDuel && (
                  <View style={styles.pendingBtnsRow}>
                    <Pressable
                      onPress={() => bangCardId && respondWithCard(bangCardId)}
                      disabled={!bangCardId}
                      style={[styles.pendingBtn, !bangCardId && { opacity: 0.4 }]}
                    >
                      <Text style={styles.pendingBtnText}>
                        Play{" "}
                        {isCalamity &&
                        normCardKey((myHand.find((x: any) => x?.id === bangCardId) as any)?.key) === "missed"
                          ? "MISSED (as BANG)"
                          : "BANG"}
                      </Text>
                    </Pressable>

                    <Pressable onPress={respondPass} style={[styles.pendingBtn, styles.pendingDanger]}>
                      <Text style={styles.pendingBtnText}>Lose 1 HP</Text>
                    </Pressable>
                  </View>
                )}

                {/* CHOOSE_DRAW */}
                {iAmActor && isChooseDraw && (
                  <>
                    <Text style={styles.pendingNote}>
                      Choose exactly <Text style={{ fontWeight: "900" }}>{chooseDrawPickCount}</Text> cards
                    </Text>

                    <View style={styles.smallRow}>
                      {chooseDrawOptions.map((c: any) => {
                        const id = String(c?.id ?? c);
                        const picked = multiIds.has(id);
                        const src = safeCardImage(c);
                        return (
                          <Pressable
                            key={id}
                            onPress={() => toggleMulti(id, chooseDrawPickCount)}
                            style={[styles.smallCard, picked && styles.smallCardPicked]}
                          >
                            {src ? (
                              <Image source={src} style={styles.smallCardImg} resizeMode="cover" />
                            ) : (
                              <View style={styles.slotFallback}>
                                <Text style={styles.slotFallbackText}>{cardLabel(c) || "CARD"}</Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.pendingBtnsRow}>
                      <Pressable
                        onPress={confirmChooseDraw}
                        disabled={!chooseDrawCanConfirm}
                        style={[styles.pendingBtn, !chooseDrawCanConfirm && { opacity: 0.4 }]}
                      >
                        <Text style={styles.pendingBtnText}>Confirm</Text>
                      </Pressable>

                      <Pressable onPress={clearMulti} style={[styles.pendingBtn, styles.pendingNeutral]}>
                        <Text style={styles.pendingBtnText}>Clear</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {/* PEDRO */}
                {iAmActor && isChoosePedro && (
                  <View style={styles.pendingBtnsRow}>
                    <Pressable onPress={() => choosePedro("deck")} style={styles.pendingBtn}>
                      <Text style={styles.pendingBtnText}>From Deck</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => choosePedro("discard")}
                      style={[styles.pendingBtn, !canPedroDiscard && { opacity: 0.4 }]}
                      disabled={!canPedroDiscard}
                    >
                      <Text style={styles.pendingBtnText}>From Discard</Text>
                    </Pressable>
                  </View>
                )}

                {/* JESSE */}
                {iAmActor && isChooseJesse && (
                  <>
                    <Text style={styles.pendingNote}>Choose a player (or skip)</Text>

                    <View style={styles.pendingBtnsRow}>
                      <Pressable onPress={() => chooseJesse(undefined)} style={[styles.pendingBtn, styles.pendingNeutral]}>
                        <Text style={styles.pendingBtnText}>Skip</Text>
                      </Pressable>

                      {(eligibleJesseTargets.length ? eligibleJesseTargets : others.map((p: any) => p.id))
                        .slice(0, 4)
                        .map((id: string) => {
                          const p = (players ?? []).find((x: any) => x.id === id);
                          if (!p) return null;
                          return (
                            <Pressable key={id} onPress={() => chooseJesse(id)} style={styles.pendingBtn}>
                              <Text style={styles.pendingBtnText} numberOfLines={1}>
                                {p.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                    </View>

                    {!!selectedOpponentId && (
                      <Pressable
                        onPress={() => chooseJesse(selectedOpponentId)}
                        style={[styles.pendingBtn, { marginTop: 10 }]}
                      >
                        <Text style={styles.pendingBtnText}>
                          Use selected: {(players ?? []).find((p: any) => p.id === selectedOpponentId)?.name ?? "Player"}
                        </Text>
                      </Pressable>
                    )}

                    <Text style={styles.pendingTiny}>
                      Tip: Tap a player above to select them, then press “Use selected”.
                    </Text>
                  </>
                )}

                {/* DISCARD TO LIMIT */}
                {iAmActor && isDiscardToLimit && (
                  <>
                    <Text style={styles.pendingNote}>
                      Discard exactly <Text style={{ fontWeight: "900" }}>{requiredDiscardCount}</Text> cards
                    </Text>
                    <View style={styles.pendingBtnsRow}>
                      <Pressable
                        onPress={confirmDiscardToLimit}
                        disabled={!discardCanConfirm}
                        style={[styles.pendingBtn, !discardCanConfirm && { opacity: 0.4 }]}
                      >
                        <Text style={styles.pendingBtnText}>Discard</Text>
                      </Pressable>
                      <Pressable onPress={clearMulti} style={[styles.pendingBtn, styles.pendingNeutral]}>
                        <Text style={styles.pendingBtnText}>Clear</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* ✅ HAND ثابتة تحت */}
          <View style={styles.handArea}>
            <View style={styles.handHeader}>
              <Text style={styles.handTitle}>Your hand ({myHand.length})</Text>

              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                {canOpenSidMode && !isWaiting && (
                  <Pressable
                    onPress={() => {
                      setSidMode((v) => !v);
                      setSelectedCardId(null);
                      setMultiIds(new Set());
                    }}
                    style={[
                      styles.endBtn,
                      { backgroundColor: "rgba(0,200,255,0.18)", borderColor: "rgba(0,200,255,0.35)" },
                    ]}
                  >
                    <Text style={styles.endBtnText}>{sidMode ? "Cancel Heal" : "Sid Heal"}</Text>
                  </Pressable>
                )}

                {isMyTurn && phase === "main" && (
                  <Pressable onPress={endTurn} style={styles.endBtn}>
                    <Text style={styles.endBtnText}>End Turn</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {!!selectedCard && !multiMode && (
              <Text style={styles.selInfo}>
                Selected: <Text style={{ fontWeight: "900" }}>{String((selectedCard as any).key)}</Text>
                {needsTarget && !selectedOpponentId ? " • Select a target" : ""}
                {needsTarget && selectedOpponentId
                  ? ` • Target: ${(players ?? []).find((p: any) => p.id === selectedOpponentId)?.name ?? "player"}`
                  : ""}
              </Text>
            )}

            {!!multiMode && (
              <Text style={styles.selInfo}>
                {sidMode ? (
                  <>
                    Sid Heal: select <Text style={{ fontWeight: "900" }}>2</Text> cards ({multiIds.size}/2)
                  </>
                ) : isChooseDraw ? (
                  <>
                    Choose draw: <Text style={{ fontWeight: "900" }}>{multiIds.size}</Text> / {chooseDrawPickCount}
                  </>
                ) : isDiscardToLimit ? (
                  <>
                    Discard: <Text style={{ fontWeight: "900" }}>{multiIds.size}</Text> / {requiredDiscardCount}
                  </>
                ) : (
                  <>
                    Multi-select: <Text style={{ fontWeight: "900" }}>{multiIds.size}</Text>
                  </>
                )}
              </Text>
            )}

            <FlatList
              horizontal
              data={myHand}
              keyExtractor={(c: any, idx) => String(c?.id ?? idx)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
              renderItem={({ item }: any) => {
                const id = String(item?.id ?? "");
                const selectedSingle = selectedCardId === id;
                const selectedMulti = multiIds.has(id);
                const src = safeCardImage(item);

                const maxMulti = sidMode ? 2 : isChooseDraw ? chooseDrawPickCount : isDiscardToLimit ? requiredDiscardCount : 0;

                return (
                  <Pressable
                    onPress={() => {
                      if (multiMode) {
                        if (!id) return;
                        toggleMulti(id, maxMulti);
                        return;
                      }
                      setSelectedCardId(selectedSingle ? null : id);
                    }}
                    onLongPress={() => openPeekByCard(item)}
                    delayLongPress={220}
                    style={[
                      styles.handCard,
                      !multiMode && selectedSingle && styles.cardSelected,
                      multiMode && selectedMulti && styles.cardSelected,
                    ]}
                  >
                    {src ? (
                      <Image source={src} style={styles.handCardImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.slotFallback}>
                        <Text style={styles.slotFallbackText}>{String(item?.key ?? "CARD")}</Text>
                      </View>
                    )}

                    {multiMode && (
                      <View style={[styles.checkBadge, selectedMulti && styles.checkBadgeOn]}>
                        <Text style={styles.checkBadgeText}>{selectedMulti ? "✓" : ""}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />

            {sidMode && !isWaiting && (
              <View style={styles.pendingBtnsRow}>
                <Pressable
                  onPress={confirmSidHeal}
                  disabled={!sidCanConfirm}
                  style={[styles.pendingBtn, !sidCanConfirm && { opacity: 0.4 }]}
                >
                  <Text style={styles.pendingBtnText}>Heal (+1)</Text>
                </Pressable>
                <Pressable onPress={() => setMultiIds(new Set())} style={[styles.pendingBtn, styles.pendingNeutral]}>
                  <Text style={styles.pendingBtnText}>Clear</Text>
                </Pressable>
              </View>
            )}

            {phase === "main" && !sidMode && (
              <Pressable onPress={playSelected} disabled={!canPlaySelected} style={[styles.playBtn, !canPlaySelected && styles.playBtnDisabled]}>
                <Text style={styles.playBtnText}>Play selected{needsTarget ? " (needs target)" : ""}</Text>
              </Pressable>
            )}

            {!!selectedOpponentId && (
              <Pressable onPress={() => setSelectedOpponentId(null)} style={styles.clearTargetBtn}>
                <Text style={styles.clearTargetText}>Clear viewed player</Text>
              </Pressable>
            )}

            {isWaiting &&
              iAmActor &&
              !isRespondBang &&
              !isRespondIndians &&
              !isRespondGatling &&
              !isRespondDuel &&
              !isChooseDraw &&
              !isChoosePedro &&
              !isChooseJesse &&
              !isDiscardToLimit && (
                <Text style={styles.waitHint}>
                  Waiting for an action ({pKind}). If buttons missing, paste msg.pending / action_required payload.
                </Text>
              )}
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

/** ================== STYLES ================== */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },

  flyCard: {
    position: "absolute",
    right: 22,
    top: 150,
    width: 74,
    height: 98,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topText: { color: "white", fontWeight: "900", fontSize: 16 },

  timerBadge: {
    minWidth: 110,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.50)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "flex-end",
  },
  timerLabel: { color: "rgba(255,255,255,0.70)", fontSize: 12, fontWeight: "900" },
  timerText: { color: "white", fontSize: 18, fontWeight: "900", marginTop: 2 },

  opponentsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navBtn: {
    width: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  navBtnText: { color: "white", fontSize: 26, fontWeight: "900" },

  pCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  pHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  pName: { color: "white", fontWeight: "900", fontSize: 16, flex: 1 },
  pMeta: { color: "rgba(255,255,255,0.75)", marginTop: 6, fontSize: 12 },

  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  roleIcon: { width: 26, height: 26, borderRadius: 6, opacity: 0.95 },

  weaponLine: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,200,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,200,0,0.25)",
  },
  weaponLineText: { color: "rgba(255,255,255,0.90)", fontWeight: "900", fontSize: 12 },

  turnGlow: { borderColor: "rgba(255,200,0,0.85)" },
  selGlow: { borderColor: "rgba(0,200,255,0.85)" },

  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,200,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,200,0,0.25)",
  },
  badgeText: { color: "rgba(255,235,180,0.95)", fontSize: 12, fontWeight: "900" },

  boardArea: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  board: {
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "flex-start",
  },
  boardImg: { borderRadius: 26 },
  boardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },

  pilesRow: {
    position: "absolute",
    right: 10,
    top: 10,
    flexDirection: "row",
    gap: 10,
    zIndex: 10,
  },
  pile: {
    width: 54,
    height: 74,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  pileImg: { width: "100%", height: "100%" },
  pileText: {
    position: "absolute",
    bottom: 4,
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(255,255,255,0.92)",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },

  boardHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  boardName: { color: "white", fontWeight: "900", fontSize: 18 },
  boardHp: { color: "rgba(255,255,255,0.85)", fontWeight: "800", marginTop: 2 },
  boardRole: { width: 30, height: 30, borderRadius: 8, opacity: 0.95 },

  boardCardsRow: {
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },

  slotLabel: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "900",
    fontSize: 11,
    marginBottom: 6,
    textAlign: "center",
  },

  slotCol: { width: 92, alignItems: "center" },
  charCol: { flex: 1, alignItems: "center" },

  slotCard: {
    width: 86,
    height: 112,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  slotImg: { width: "100%", height: "100%" },

  slotEmpty: {
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  emptyText: { color: "rgba(255,255,255,0.90)", fontWeight: "900", fontSize: 12 },
  emptySub: {
    color: "rgba(255,255,255,0.65)",
    fontWeight: "700",
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },

  charCard: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  charImg: { width: "100%", height: "100%" },

  boardHint: {
    marginTop: 10,
    textAlign: "center",
    color: "rgba(255,255,255,0.75)",
    fontWeight: "800",
    fontSize: 12,
  },

  pendingPanel: {
    marginHorizontal: 14,
    marginTop: 6,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  pendingTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  pendingSub: { color: "rgba(255,255,255,0.75)", marginTop: 2, fontWeight: "800", fontSize: 12 },
  pendingNote: { color: "rgba(255,255,255,0.85)", marginTop: 10, fontWeight: "800", fontSize: 12 },
  pendingTiny: { color: "rgba(255,255,255,0.60)", marginTop: 8, fontWeight: "700", fontSize: 11 },

  pendingBtnsRow: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  pendingBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(0,200,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(0,200,255,0.35)",
  },
  pendingNeutral: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" },
  pendingDanger: { backgroundColor: "rgba(255,80,80,0.22)", borderColor: "rgba(255,80,80,0.35)" },
  pendingBtnText: { color: "white", fontWeight: "900" },

  smallRow: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  smallCard: {
    width: 72,
    height: 95,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  smallCardPicked: { borderColor: "rgba(0,200,255,0.9)" },
  smallCardImg: { width: "100%", height: "100%" },

  handArea: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  handHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  handTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  selInfo: { color: "rgba(255,255,255,0.8)", marginTop: 6, fontSize: 12, fontWeight: "700" },

  endBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,80,80,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
  },
  endBtnText: { color: "white", fontWeight: "900" },

  handCard: {
    width: 115,
    height: 150,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  handCardImg: { width: "100%", height: "100%" },
  cardSelected: { borderColor: "rgba(0,200,255,0.9)" },

  checkBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeOn: { backgroundColor: "rgba(0,200,255,0.25)", borderColor: "rgba(0,200,255,0.55)" },
  checkBadgeText: { color: "white", fontWeight: "900" },

  playBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(0,200,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(0,200,255,0.35)",
  },
  playBtnDisabled: { opacity: 0.4 },
  playBtnText: { color: "white", fontWeight: "900" },

  clearTargetBtn: {
    marginTop: 8,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  clearTargetText: { color: "rgba(255,255,255,0.85)", fontWeight: "900" },

  waitHint: {
    marginTop: 10,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
  },

  slotFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    backgroundColor: "rgba(20,15,10,0.70)",
  },
  slotFallbackText: { color: "rgba(255,255,255,0.92)", fontWeight: "900", textAlign: "center", fontSize: 12 },

  peekBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  peekCenter: { alignItems: "center", paddingHorizontal: 16 },
  peekCardWrap: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(20,15,10,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  peekImg: { width: "100%", height: "100%" },
  peekTitle: { marginTop: 10, color: "rgba(255,255,255,0.92)", fontWeight: "900" },
  peekHint: { marginTop: 6, color: "rgba(255,255,255,0.80)", fontWeight: "800", fontSize: 12 },
});
