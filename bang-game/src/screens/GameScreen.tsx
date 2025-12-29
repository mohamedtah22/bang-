import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ImageBackground,
} from "react-native";
import {
  usePlayer,
  WEAPON_LABEL,
  WEAPON_RANGE,
  WeaponKey,
} from "../contexts/playercontext";

const CARD_W = 190;
const GAP = 12;

function rotateToMe<T extends { id: string }>(arr: T[], myId: string) {
  const idx = arr.findIndex((p) => p.id === myId);
  if (idx <= 0) return arr;
  return [...arr.slice(idx), ...arr.slice(0, idx)];
}

function equipKeys(equipment: any[]) {
  if (!Array.isArray(equipment)) return [];
  return equipment
    .map((x) => {
      if (!x) return "";
      if (typeof x === "string") return x;
      return String(x.key ?? x.id ?? x.name ?? "");
    })
    .filter(Boolean);
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

function removeWeaponFromEquipment(keys: string[]) {
  return keys.filter((k) => !normalizeWeaponKey(k));
}

function formatSeconds(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  const mmStr = String(mm).padStart(2, "0");
  const ssStr = String(ss).padStart(2, "0");
  return `${mmStr}:${ssStr}`;
}

export default function GameScreen() {
  const ctx = usePlayer();
  const { ws, roomCode, players, me, turnPlayerId, wsStatus, sendWS } = ctx;

  const isMyTurn = !!me && turnPlayerId === me.id;

  const [phase, setPhase] = useState<"main" | "waiting">("main");
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [pendingEndsAt, setPendingEndsAt] = useState<number | null>(null);
  const [pending, setPending] = useState<any>(null);

  useEffect(() => {
    if (!ws) return;

    const onMsg = (e: any) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "game_state") {
        setPhase(msg.phase === "waiting" ? "waiting" : "main");

        setTurnEndsAt(typeof msg.turnEndsAt === "number" ? msg.turnEndsAt : null);
        setPendingEndsAt(
          typeof msg.pendingEndsAt === "number" ? msg.pendingEndsAt : null
        );

        setPending(msg.pending ?? null);
        return;
      }

      if (msg.type === "turn_started") {
        setPhase("main");
        setPending(null);
        setPendingEndsAt(null);
        setTurnEndsAt(typeof msg.turnEndsAt === "number" ? msg.turnEndsAt : null);
        return;
      }

      if (msg.type === "action_required") {
        setPhase("waiting");
        setPendingEndsAt(
          typeof msg.pendingEndsAt === "number" ? msg.pendingEndsAt : null
        );
        return;
      }

      if (msg.type === "action_resolved") {
        setPhase("main");
        setPending(null);
        setPendingEndsAt(null);
        return;
      }
    };

    ws.addEventListener("message", onMsg);
    return () => {
      ws.removeEventListener("message", onMsg);
    };
  }, [ws]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  /** ================== SEND HELPERS ================== */

  const sendGameWS = (payload: any) => {
    if (wsStatus !== "open") return;
    if (!roomCode) return;
    sendWS({ ...payload, roomCode });
  };

  /** ================== PLAYERS ORDER ================== */

  const ordered = useMemo(() => {
    if (!me) return players;
    return rotateToMe(players, me.id);
  }, [players, me]);

  const others = useMemo(() => {
    if (!me) return [];
    return ordered.filter((p) => p.id !== me.id);
  }, [ordered, me]);

  /** ================== OPPONENT SELECT ================== */

  // تنقل بين الخصوم
  const listRef = useRef<FlatList<any>>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(
    null
  );

  const selectedOpponentIndex = useMemo(() => {
    if (!selectedOpponentId) return 0;
    const i = others.findIndex((p) => p.id === selectedOpponentId);
    return i < 0 ? 0 : i;
  }, [selectedOpponentId, others]);

  const goPrev = () => {
    if (!others.length) return;
    const next = Math.max(0, selectedOpponentIndex - 1);
    const id = others[next].id;
    setSelectedOpponentId(id);
    listRef.current?.scrollToIndex({
      index: next,
      animated: true,
      viewPosition: 0.5,
    });
  };

  const goNext = () => {
    if (!others.length) return;
    const next = Math.min(others.length - 1, selectedOpponentIndex + 1);
    const id = others[next].id;
    setSelectedOpponentId(id);
    listRef.current?.scrollToIndex({
      index: next,
      animated: true,
      viewPosition: 0.5,
    });
  };

  /** ================== HAND SELECT ================== */

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const selectedCard = useMemo(() => {
    if (!me || !selectedCardId) return null;
    return me.hand.find((c: any) => c.id === selectedCardId) ?? null;
  }, [me, selectedCardId]);

  // ✅ كروت تحتاج هدف (حتى لو السيرفر لسه ما طبقها كلها، هذا أصح للـ UI)
  const needsTarget = useMemo(() => {
    const key = selectedCard?.key;
    return (
      key === "bang" ||
      key === "panic" ||
      key === "catbalou" ||
      key === "duel" ||
      key === "jail"
    );
  }, [selectedCard]);

  const canPlaySelected = useMemo(() => {
    if (!isMyTurn) return false;
    if (!selectedCardId) return false;
    if (needsTarget && !selectedOpponentId) return false;
    return true;
  }, [isMyTurn, selectedCardId, needsTarget, selectedOpponentId]);

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedCardId(null);
      // setSelectedOpponentId(null); // اختياري
    }
  }, [isMyTurn]);

  /** ================== ACTIONS ================== */

  const endTurn = () => {
    sendGameWS({ type: "end_turn" });
  };

  const playSelected = () => {
    if (!selectedCardId) return;

    const payload: any = {
      type: "play_card",
      cardId: selectedCardId,
    };

    // ابعث targetId بس إذا الكرت بده هدف
    if (needsTarget && selectedOpponentId) {
      payload.targetId = selectedOpponentId;
    }

    sendGameWS(payload);
    setSelectedCardId(null);
  };

  /** ================== BANG RESPONSE UI ================== */

  const isAwaitingMyResponse = useMemo(() => {
    if (!me) return false;
    return (
      phase === "waiting" &&
      pending &&
      pending.kind === "bang" &&
      pending.targetId === me.id
    );
  }, [phase, pending, me]);

  const missedCardId = useMemo(() => {
    if (!me) return null;
    const c = me.hand.find((x: any) => x?.key === "missed");
    return c?.id ?? null;
  }, [me]);

  const respondMissed = () => {
    if (!missedCardId) return;
    sendGameWS({ type: "respond", cardId: missedCardId });
  };

  const takeHitNow = () => {
    // respond بدون cardId => السيرفر بعمل damage 1
    sendGameWS({ type: "respond" });
  };

  /** ================== TIMER DISPLAY ================== */

  const activeEndsAt = isAwaitingMyResponse
    ? pendingEndsAt
    : turnEndsAt;

  const secondsLeft = useMemo(() => {
    if (!activeEndsAt) return 0;
    const msLeft = Math.max(0, activeEndsAt - now);
    // نخليها ceil عشان ما يطلع 00:00 بسرعة
    return Math.ceil(msLeft / 1000);
  }, [activeEndsAt, now]);

  const timerLabel = isAwaitingMyResponse ? "RESPONSE" : "TURN";

  /** ================== RENDER ================== */

  if (!me) {
    return (
      <View
        style={[
          styles.root,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: "white" }}>Loading…</Text>
      </View>
    );
  }

  // ✅ مهم لتجنب خطأ: "Element implicitly has an 'any' type..."
  const myWKey: WeaponKey = (me.weaponKey ?? "colt45");

  return (
    <ImageBackground
      // غيّر الصورة إذا عندك خلفية ثانية
      source={require("../../assets/homescreen3.png")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={styles.root}>
        <View style={styles.overlay} />

        {/* Top bar + TIMER */}
        <View style={styles.topBar}>
          <View style={{ gap: 4 }}>
            <Text style={styles.topText}>Room: {roomCode || "—"}</Text>
            <Text style={styles.topText}>
              Turn:{" "}
              {turnPlayerId === me.id
                ? "YOU"
                : players.find((p) => p.id === turnPlayerId)?.name ?? "—"}
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
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10, gap: GAP }}
            snapToInterval={CARD_W + GAP}
            decelerationRate="fast"
            renderItem={({ item }) => {
              const isTurn = item.id === turnPlayerId;
              const isSel = item.id === selectedOpponentId;
              const isSheriff = item.role === "sheriff";

              // ✅ اجبر النوع عشان WEAPON_RANGE ما يزعل
              const wKey: WeaponKey = (item.weaponKey as WeaponKey) ?? "colt45";
              const wLabel = WEAPON_LABEL[wKey] ?? "Colt .45";
              const wRange = WEAPON_RANGE[wKey] ?? 1;

              const keys = equipKeys(item.equipment);
              const rest = removeWeaponFromEquipment(keys);

              return (
                <Pressable
                  onPress={() => setSelectedOpponentId(isSel ? null : item.id)}
                  style={[
                    styles.pCard,
                    { width: CARD_W },
                    isTurn && styles.turnGlow,
                    isSel && styles.selGlow,
                  ]}
                >
                  <View style={styles.pHead}>
                    <Text style={styles.pName} numberOfLines={1}>
                      {item.name}
                    </Text>

                    {isSheriff && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>⭐ SHERIFF</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.pMeta}>
                    HP {item.hp}/{item.maxHp} • Hand {item.handCount}
                  </Text>
                  <Text style={styles.pMeta}>{item.playcharacter}</Text>

                  {/* ✅ سلاح + معدات */}
                  <View style={styles.eqRow}>
                    <View style={[styles.eqChip, styles.weaponChip]}>
                      <Text style={styles.eqText}>
                        🔫 {wLabel} ({wRange})
                      </Text>
                    </View>

                    {rest.length > 0 ? (
                      rest.slice(0, 4).map((k) => (
                        <View key={k} style={styles.eqChip}>
                          <Text style={styles.eqText}>{k}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.eqEmpty}>No equipment</Text>
                    )}
                  </View>

                  {isSel && (
                    <Text style={styles.targetHint}>Target selected</Text>
                  )}
                </Pressable>
              );
            }}
            onScrollToIndexFailed={() => {}}
          />

          <Pressable onPress={goNext} style={styles.navBtn}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        {/* Middle area */}
        <View style={styles.tableArea}>
          <View style={styles.tableFrame} />

          {/* ✅ Overlay لرد BANG */}
          {isAwaitingMyResponse && (
            <View style={styles.responseOverlay}>
              <Text style={styles.responseTitle}>You got BANG! 💥</Text>
              <Text style={styles.responseSub}>
                Respond with MISSED or take 1 damage
              </Text>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={respondMissed}
                  disabled={!missedCardId}
                  style={[
                    styles.resBtn,
                    !missedCardId && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.resBtnText}>Play MISSED</Text>
                </Pressable>

                <Pressable onPress={takeHitNow} style={[styles.resBtn, styles.hitBtn]}>
                  <Text style={styles.resBtnText}>Take Hit</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Me card */}
        <View style={[styles.meCard, isMyTurn && styles.turnGlow]}>
          <View style={styles.pHead}>
            <Text style={styles.pName}>You: {me.name}</Text>
            {me.role === "sheriff" && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>⭐ SHERIFF</Text>
              </View>
            )}
          </View>

          <Text style={styles.pMeta}>
            HP {me.hp}/{me.maxHp}
          </Text>
          <Text style={styles.pMeta}>{me.playcharacter}</Text>

          {/* ✅ سلاحك + معداتك */}
          <View style={styles.eqRow}>
            <View style={[styles.eqChip, styles.weaponChip]}>
              <Text style={styles.eqText}>
                🔫 {WEAPON_LABEL[myWKey]} ({WEAPON_RANGE[myWKey] ?? 1})
              </Text>
            </View>

            {(() => {
              const myKeys = equipKeys(me.equipment);
              const myRest = removeWeaponFromEquipment(myKeys);
              return myRest.length > 0 ? (
                myRest.map((k) => (
                  <View key={k} style={styles.eqChip}>
                    <Text style={styles.eqText}>{k}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.eqEmpty}>No equipment</Text>
              );
            })()}
          </View>
        </View>

        {/* Hand */}
        <View style={styles.handArea}>
          <View style={styles.handHeader}>
            <Text style={styles.handTitle}>Your hand ({me.hand.length})</Text>

            {isMyTurn && (
              <Pressable onPress={endTurn} style={styles.endBtn}>
                <Text style={styles.endBtnText}>End Turn</Text>
              </Pressable>
            )}
          </View>

          {!!selectedCard && (
            <Text style={styles.selInfo}>
              Selected:{" "}
              <Text style={{ fontWeight: "900" }}>{selectedCard.key}</Text>
              {needsTarget && !selectedOpponentId ? " • Select a target" : ""}
            </Text>
          )}

          <FlatList
            horizontal
            data={me.hand}
            keyExtractor={(c: any) => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
            renderItem={({ item }: any) => {
              const selected = selectedCardId === item.id;
              return (
                <Pressable
                  onPress={() => setSelectedCardId(selected ? null : item.id)}
                  style={[styles.card, selected && styles.cardSelected]}
                >
                  <Text style={styles.cardText}>{item.key}</Text>
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
            <Pressable
              onPress={() => setSelectedOpponentId(null)}
              style={styles.clearTargetBtn}
            >
              <Text style={styles.clearTargetText}>Clear target</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

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
  timerLabel: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontWeight: "900",
  },
  timerText: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

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
  pHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  pName: { color: "white", fontWeight: "900", fontSize: 18, flex: 1 },
  pMeta: { color: "rgba(255,255,255,0.75)", marginTop: 3, fontSize: 12 },

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
  badgeText: {
    color: "rgba(255,235,180,0.95)",
    fontSize: 12,
    fontWeight: "900",
  },

  eqRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  eqChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  weaponChip: {
    backgroundColor: "rgba(255,200,0,0.10)",
    borderColor: "rgba(255,200,0,0.25)",
  },
  eqText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
  },
  eqEmpty: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "700",
  },

  targetHint: {
    marginTop: 6,
    color: "rgba(0,200,255,0.9)",
    fontWeight: "900",
    fontSize: 12,
  },

  tableArea: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  tableFrame: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  responseOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
  },
  responseTitle: {
    color: "white",
    fontWeight: "900",
    fontSize: 18,
  },
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
  hitBtn: {
    backgroundColor: "rgba(255,80,80,0.22)",
    borderColor: "rgba(255,80,80,0.35)",
  },
  resBtnText: { color: "white", fontWeight: "900" },

  meCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginBottom: 10,
  },

  handArea: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  handHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  handTitle: { color: "white", fontWeight: "900", fontSize: 16 },

  selInfo: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
  },

  endBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,80,80,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
  },
  endBtnText: { color: "white", fontWeight: "900" },

  card: {
    width: 95,
    height: 125,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardSelected: { borderColor: "rgba(0,200,255,0.9)" },
  cardText: { color: "white", fontWeight: "900", fontSize: 14 },

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
});
