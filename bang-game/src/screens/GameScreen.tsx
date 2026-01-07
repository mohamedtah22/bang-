// src/screens/GameScreen.tsx

import React, { useMemo, useRef, useState, useEffect } from "react";
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
  // بدنا "كرت معدات واحد" على الخشبة (أول كرت غير سلاح)
  if (!Array.isArray(equipment)) return null;
  const nonWeapon = equipment.filter((x) => !isWeaponItem(x));
  return nonWeapon.length ? nonWeapon[0] : null;
}

function findEquippedWeaponCard(equipment: any[]) {
  // بدنا نظهر سلاح على الخشبة فقط إذا فعلاً مركّب من كرت (مش الافتراضي)
  if (!Array.isArray(equipment)) return null;
  const w = equipment.find((x) => x?.key === "weapon" || (x && normalizeWeaponKey(String(x?.weaponKey ?? x?.key ?? x?.id ?? x?.name ?? ""))));
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

/** ================== COMPONENT ================== */

export default function GameScreen() {
  const ctx = usePlayer();
  const { width } = useWindowDimensions();

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

  const isMyTurn = !!me && turnPlayerId === me.id;

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

  /** ============ HAND SELECT ============ */

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const myHand: Card[] = (me?.hand ?? []) as any[];

  const selectedCard = useMemo(() => {
    if (!me || !selectedCardId) return null;
    return myHand.find((c: any) => c.id === selectedCardId) ?? null;
  }, [me, selectedCardId, myHand]);

  const needsTarget = useMemo(() => {
    const key = selectedCard?.key;
    return key === "bang" || key === "panic" || key === "catbalou" || key === "duel" || key === "jail";
  }, [selectedCard]);

  const canPlaySelected = useMemo(() => {
    if (!isMyTurn) return false;
    if (!selectedCardId) return false;
    if (needsTarget && !selectedOpponentId) return false;
    return true;
  }, [isMyTurn, selectedCardId, needsTarget, selectedOpponentId]);

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

  const endTurn = () => sendGameWS({ type: "end_turn" });

  const playSelected = () => {
    if (!selectedCardId) return;
    const payload: any = { type: "play_card", cardId: selectedCardId };
    if (needsTarget && selectedOpponentId) payload.targetId = selectedOpponentId;
    sendGameWS(payload);
    setSelectedCardId(null);
  };

  /** ============ PENDING / RESPONSE ============ */

  const pendingKind = pending?.kind ?? pending?.type ?? null;

  const pendingTargetId =
    pending?.targetId ?? pending?.toPlayerId ?? pending?.target ?? pending?.playerId ?? null;

  const isAwaitingMyResponse = useMemo(() => {
    if (!me) return false;
    if (phase !== "waiting") return false;
    if (!pendingKind) return false;
    const isBang =
      pendingKind === "bang" ||
      pendingKind === "respond_to_bang" ||
      String(pendingKind).includes("bang");
    return isBang && pendingTargetId === me.id;
  }, [phase, pendingKind, pendingTargetId, me]);

  const missedCardId = useMemo(() => {
    const c = myHand.find((x: any) => x?.key === "missed");
    return c?.id ?? null;
  }, [myHand]);

  const respondMissed = () => {
    if (!missedCardId) return;
    sendGameWS({ type: "respond", cardId: missedCardId });
  };

  const takeHitNow = () => {
    sendGameWS({ type: "respond" });
  };

  /** ============ TIMER ============ */

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const activeEndsAt = isAwaitingMyResponse ? pendingEndsAt : turnEndsAt;

  const secondsLeft = useMemo(() => {
    if (!activeEndsAt) return 0;
    const msLeft = Math.max(0, activeEndsAt - now);
    return Math.ceil(msLeft / 1000);
  }, [activeEndsAt, now]);

  const timerLabel = isAwaitingMyResponse ? "RESPONSE" : "TURN";

  /** ============ BOARD (خشبة) ============ */

  if (!me) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "white" }}>Loading…</Text>
      </View>
    );
  }

  // إذا محدد لاعب -> اعرض خشبته، غير هيك اعرض خشبتك
  const boardPlayer = selectedOpponent ?? me;

  const boardChar = getCharacterSafe(String(boardPlayer.playcharacter ?? ""));
  const boardWeaponCard = findEquippedWeaponCard(boardPlayer.equipment); // فقط إذا مركّب فعليًا
  const boardBlueCard = pickFirstBlueEquipment(boardPlayer.equipment); // أول معدات (غير سلاح)
  const boardWeaponKey: WeaponKey =
    (boardPlayer.weaponKey as WeaponKey) ?? weaponFromEquipment(boardPlayer.equipment);

  // إظهار الدور: دورك دايمًا ظاهر، وباقي اللاعبين مخفي إلا الشيريف
  const showBoardRole = boardPlayer.id === me.id || boardPlayer.role === "sheriff";
  const boardRoleImg = showBoardRole ? (ROLE_IMAGES as any)[boardPlayer.role] ?? null : null;

  const boardIsMe = boardPlayer.id === me.id;

  /** ============ RENDER ============ */

  return (
    <ImageBackground source={require("../../assets/homescreen3.png")} style={{ flex: 1 }} resizeMode="cover">
      <View style={styles.root}>
        <View style={styles.overlay} />

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

        {/* Top bar + TIMER */}
        <View style={styles.topBar}>
          <View style={{ gap: 4 }}>
            <Text style={styles.topText}>Room: {roomCode || "—"}</Text>
            <Text style={styles.topText}>
              Turn:{" "}
              {turnPlayerId === me.id ? "YOU" : (players ?? []).find((p: any) => p.id === turnPlayerId)?.name ?? "—"}
            </Text>
          </View>

          <View style={styles.timerBadge}>
            <Text style={styles.timerLabel}>{timerLabel}</Text>
            <Text style={styles.timerText}>{formatSeconds(secondsLeft)}</Text>
          </View>
        </View>

        {/* Opponents row */}
        <View style={styles.opponentsRow}>
          <Pressable onPress={goPrev} style={styles.navBtn}>
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

              // دور باقي اللاعبين مخفي إلا الشيريف
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
                    { width: OPP_CARD_W },
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
                    <Text style={styles.weaponLineText}>
                      🔫 {wLabel} ({wRange})
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            onScrollToIndexFailed={() => {}}
          />

          <Pressable onPress={goNext} style={styles.navBtn}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        {/* ✅ BOARD خشبة بالنص */}
        <View style={styles.boardArea}>
          <ImageBackground source={WOOD_BOARD} style={styles.board} imageStyle={styles.boardImg} resizeMode="cover">
            <View style={styles.boardShade} />

            {/* Header: name + hp + role */}
            <View style={styles.boardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.boardName}>
                  {boardIsMe ? `You: ${boardPlayer.name}` : boardPlayer.name}
                </Text>
                <Text style={styles.boardHp}>❤️ {boardPlayer.hp}/{boardPlayer.maxHp}</Text>
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

              {/* Character card (not circle) */}
              <View style={styles.charCol}>
                <Text style={styles.slotLabel}>CHARACTER</Text>

                <Pressable
                  onPress={() => {
                    if (boardChar?.image) openPeekByImage(boardChar.image, String(boardChar?.id ?? "character"));
                  }}
                  style={styles.charCard}
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

              {/* Weapon slot */}
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
                      {WEAPON_LABEL[boardWeaponKey] ? `default: ${WEAPON_LABEL[boardWeaponKey]}` : "no weapon"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Hint */}
            <Text style={styles.boardHint}>
              Tap any card on the board to zoom
            </Text>
          </ImageBackground>
        </View>

        {/* ✅ Overlay لرد BANG */}
        {isAwaitingMyResponse && (
          <View style={styles.responseOverlay}>
            <Text style={styles.responseTitle}>You got BANG! 💥</Text>
            <Text style={styles.responseSub}>Respond with MISSED or take 1 damage</Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={respondMissed}
                disabled={!missedCardId}
                style={[styles.resBtn, !missedCardId && { opacity: 0.4 }]}
              >
                <Text style={styles.resBtnText}>Play MISSED</Text>
              </Pressable>

              <Pressable onPress={takeHitNow} style={[styles.resBtn, styles.hitBtn]}>
                <Text style={styles.resBtnText}>Take Hit</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Hand */}
        <View style={styles.handArea}>
          <View style={styles.handHeader}>
            <Text style={styles.handTitle}>Your hand ({myHand.length})</Text>

            {isMyTurn && (
              <Pressable onPress={endTurn} style={styles.endBtn}>
                <Text style={styles.endBtnText}>End Turn</Text>
              </Pressable>
            )}
          </View>

          {!!selectedCard && (
            <Text style={styles.selInfo}>
              Selected: <Text style={{ fontWeight: "900" }}>{selectedCard.key}</Text>
              {needsTarget && !selectedOpponentId ? " • Select a target" : ""}
            </Text>
          )}

          <FlatList
            horizontal
            data={myHand}
            keyExtractor={(c: any) => String(c?.id ?? Math.random())}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
            renderItem={({ item }: any) => {
              const selected = selectedCardId === item.id;
              const src = safeCardImage(item);

              return (
                <Pressable
                  onPress={() => setSelectedCardId(selected ? null : item.id)}
                  // ✅ long press OR tap? خلّيه LongPress لليد (مثل ما بدك)
                  onLongPress={() => openPeekByCard(item)}
                  delayLongPress={220}
                  style={[styles.handCard, selected && styles.cardSelected]}
                >
                  {src ? (
                    <Image source={src} style={styles.handCardImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.slotFallback}>
                      <Text style={styles.slotFallbackText}>{String(item?.key ?? "CARD")}</Text>
                    </View>
                  )}
                </Pressable>
              );
            }}
          />

          <Pressable
            onPress={playSelected}
            disabled={!canPlaySelected}
            style={[styles.playBtn, !canPlaySelected && styles.playBtnDisabled]}
          >
            <Text style={styles.playBtnText}>
              Play selected{needsTarget ? " (needs target)" : ""}
            </Text>
          </Pressable>

          {!!selectedOpponentId && (
            <Pressable onPress={() => setSelectedOpponentId(null)} style={styles.clearTargetBtn}>
              <Text style={styles.clearTargetText}>Clear viewed player</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

/** ================== STYLES ================== */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },

  topBar: {
    paddingTop: 50,
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
    height: 130,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  navBtnText: { color: "white", fontSize: 26, fontWeight: "900" },

  pCard: {
    height: 130,
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

  /** ✅ Board area */
  boardArea: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  board: {
    height: 220,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "flex-start",
  },
  boardImg: { borderRadius: 26 },
  boardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },

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
  emptySub: { color: "rgba(255,255,255,0.65)", fontWeight: "700", fontSize: 10, marginTop: 4, textAlign: "center" },

  charCard: {
    width: 120,
    height: 150,
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

  /** ✅ Pending overlay */
  responseOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 230,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    zIndex: 10,
  },
  responseTitle: { color: "white", fontWeight: "900", fontSize: 18 },
  responseSub: {
    color: "rgba(255,255,255,0.80)",
    marginTop: 4,
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  resBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(0,200,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(0,200,255,0.35)",
  },
  hitBtn: { backgroundColor: "rgba(255,80,80,0.22)", borderColor: "rgba(255,80,80,0.35)" },
  resBtnText: { color: "white", fontWeight: "900" },

  /** ✅ Hand */
  handArea: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.40)",
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

  /** ✅ Fallback when no image */
  slotFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    backgroundColor: "rgba(20,15,10,0.70)",
  },
  slotFallbackText: { color: "rgba(255,255,255,0.92)", fontWeight: "900", textAlign: "center", fontSize: 12 },

  /** ✅ PEEK modal */
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
