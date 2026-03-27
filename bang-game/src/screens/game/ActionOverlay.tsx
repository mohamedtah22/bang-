import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Image,
  ScrollView,
  Dimensions,
  ImageBackground,
} from "react-native";

import type { Card } from "../../models/card";
import type { PublicPlayer, MePlayer } from "../../models/player";
import { getCardImage, CARD_BACK } from "../../data/cardAssets";
import WoodButton from "./WoodButton";

const { width: W } = Dimensions.get("window");
const WOOD_BOARD = require("../../../assets/wood_board.png");

type PendingAny = null | { kind?: string; type?: string; [k: string]: any };

export type LocalPick = null | {
  kind: "panic" | "cat_balou";
  cardId: string;
  targetId: string;
  handCount: number;
  equipment: Card[];
};

function kOf(p: PendingAny) {
  const primary = String(p?.kind ?? p?.type ?? "").toLowerCase().trim();
  const fallback = String((p as any)?.privateKind ?? "").toLowerCase().trim();
  if (!primary || primary === "unknown" || primary === "private") return fallback;
  return primary || fallback;
}

function isPanicPending(p: PendingAny) {
  const k = kOf(p);
  return (
    k === "panic" ||
    k === "play_panic" ||
    k === "panic_choose" ||
    k === "choose_panic" ||
    k === "panic_target_choose" ||
    k === "action_panic"
  );
}

function isCatBalouPending(p: PendingAny) {
  const k = kOf(p);
  return (
    k === "cat_balou" ||
    k === "catbalou" ||
    k === "play_cat_balou" ||
    k === "cat_balou_choose" ||
    k === "choose_cat_balou" ||
    k === "action_cat_balou"
  );
}

function isDuelPending(p: PendingAny) {
  const k = kOf(p);
  return k === "respond_to_duel" || k === "duel" || k === "duel_missed" || k === "need_missed_duel" || k === "duel_response";
}

function isBangPending(p: PendingAny) {
  const k = kOf(p);
  return (
    k === "respond_to_bang" ||
    k === "bang" ||
    k === "need_missed" ||
    k === "missed" ||
    k === "respond_missed" ||
    k === "bang_missed" ||
    k === "need_missed_for_bang"
  );
}

function isIndiansPending(p: PendingAny) {
  const k = kOf(p);
  return k === "respond_to_indians" || k === "indians";
}

function isGatlingPending(p: PendingAny) {
  const k = kOf(p);
  return k === "respond_to_gatling" || k === "gatling";
}

function isBeerPending(p: PendingAny) {
  const k = kOf(p);
  return (
    k === "sid_heal" ||
    k === "heal" ||
    k === "choose_heal" ||
    k === "sid_ketchum" ||
    k === "respond_to_revive" ||
    k === "revive"
  );
}

function suitSymbol(suit?: string) {
  const s = String(suit ?? "").toLowerCase();
  if (s === "hearts") return "♥";
  if (s === "spades") return "♠";
  if (s === "diamonds") return "♦";
  if (s === "clubs") return "♣";
  return "";
}

function prettyCardLine(c?: any) {
  if (!c) return "";
  const r = String(c.rank ?? "").toUpperCase();
  const sym = suitSymbol(c.suit);
  const name = String(c.name ?? c.key ?? "").replaceAll("_", " ");
  const mid = [r, sym].filter(Boolean).join("");
  return [name, mid].filter(Boolean).join(" • ");
}

function byId<T extends { id: string }>(arr: T[], id?: string) {
  if (!id) return undefined;
  return arr.find((x) => x.id === id);
}

function safeSend(onSend: (msg: any) => void, pending: PendingAny, payload: any) {
  if (payload?.type) return onSend(payload);

  const replyType = pending?.replyType ?? pending?.resolveType ?? pending?.type;
  const replyKind = pending?.replyKind ?? pending?.kind ?? pending?.action;

  if (typeof replyType === "string" && replyType.length > 0) {
    return onSend({ type: replyType, ...payload });
  }

  if (replyKind) return onSend({ kind: replyKind, ...payload });

  return onSend({ type: "resolve_action", ...payload });
}

function CardFace({
  card,
  w,
  h,
}: {
  card: Card;
  w: number;
  h: number;
}) {
  const src = getCardImage(card);
  return <Image source={src} style={{ width: w, height: h, borderRadius: 10 }} />;
}

function CardBack({ w, h }: { w: number; h: number }) {
  return <Image source={CARD_BACK} style={{ width: w, height: h, borderRadius: 10 }} />;
}

export function ActionOverlay({
  me,
  players,
  pending,
  onSend,
  localPick,
  onConfirmLocalPick,
  onCloseLocalPick,
}: {
  me: MePlayer | null;
  players: PublicPlayer[];
  pending: PendingAny;
  onSend: (msg: any) => void;
  localPick?: LocalPick;
  onConfirmLocalPick?: (sel: { type: "hand"; index: number } | { type: "equip"; cardId: string }) => void;
  onCloseLocalPick?: () => void;
}) {
  const prevHandKeys = useRef<string[]>([]);
  const [revealCard, setRevealCard] = useState<Card | null>(null);
  const revealAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!me) return;
    prevHandKeys.current = (me.hand ?? []).map((c: any) => String(c?.id ?? c?.key ?? c?.name ?? ""));
  }, []);

  useEffect(() => {
    if (!me) return;
    const now = (me.hand ?? []).map((c: any) => String(c?.id ?? c?.key ?? c?.name ?? ""));
    const prev = prevHandKeys.current;

    if (now.length > prev.length) {
      const addedKey = now.find((k) => !prev.includes(k));
      if (addedKey) {
        const c = (me.hand ?? []).find(
          (x: any) => String(x?.id ?? x?.key ?? x?.name ?? "") === addedKey
        );
        if (c) {
          setRevealCard(c as any);
          setTimeout(() => setRevealCard(null), 1200);
        }
      }
    }

    prevHandKeys.current = now;
  }, [me?.hand?.length]);

  useEffect(() => {
    if (!revealCard) return;
    revealAnim.setValue(0);
    Animated.sequence([
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.delay(900),
      Animated.timing(revealAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]).start(() => {
      setRevealCard(null);
    });
  }, [revealCard, revealAnim]);

  const pendingSource = String((pending as any)?.__source ?? "").toLowerCase();
  const allowInlinePersonalHints = pendingSource !== "game_state";

  const showBangHint = useMemo(() => allowInlinePersonalHints && isBangPending(pending), [allowInlinePersonalHints, pending]);
  const showDuelHint = useMemo(() => allowInlinePersonalHints && isDuelPending(pending), [allowInlinePersonalHints, pending]);
  const showIndiansHint = useMemo(() => allowInlinePersonalHints && isIndiansPending(pending), [allowInlinePersonalHints, pending]);
  const showGatlingHint = useMemo(() => allowInlinePersonalHints && isGatlingPending(pending), [allowInlinePersonalHints, pending]);
  const showHeal = useMemo(() => allowInlinePersonalHints && isBeerPending(pending), [allowInlinePersonalHints, pending]);

  const showPanicFromServer = useMemo(() => isPanicPending(pending), [pending]);
  const showCatBalouFromServer = useMemo(() => isCatBalouPending(pending), [pending]);

  const showPanicLocal = !!localPick && localPick.kind === "panic";
  const showCatBalouLocal = !!localPick && localPick.kind === "cat_balou";

  const showPanic = showPanicFromServer || showPanicLocal;
  const showCatBalou = showCatBalouFromServer || showCatBalouLocal;

  const targetId: string | undefined =
    (localPick as any)?.targetId ?? pending?.targetId ?? pending?.target?.id ?? pending?.victimId;

  const target = useMemo(() => byId(players, targetId), [players, targetId]);

  const handCount = Number((localPick as any)?.handCount ?? pending?.handCount ?? target?.handCount ?? 0);
  const equipment: Card[] = ((localPick as any)?.equipment ?? pending?.equipment ?? target?.equipment ?? []) as any;

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shouldShow = showPanic || showCatBalou;
    Animated.timing(fade, {
      toValue: shouldShow ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [fade, showPanic, showCatBalou]);

  const [sel, setSel] = useState<
    null | { type: "hand"; index: number } | { type: "equip"; cardId: string }
  >(null);

  useEffect(() => {
    setSel(null);
  }, [showPanic, showCatBalou, targetId]);

  const title = showPanic
    ? "PANIC!"
    : showCatBalou
    ? "CAT BALOU"
    : "";

  const actionVerb = showPanic ? "Take" : "Discard";

  const cardW = Math.min(88, Math.floor((W - 48) / 4));
  const cardH = Math.floor(cardW * 1.35);

  const meChar = String((me as any)?.playcharacter ?? "").toLowerCase();
  const isJanet =
    meChar === "calamity_janet" ||
    meChar === "calamityjanet" ||
    meChar === "janet";

  const requiredMissed = Number((pending as any)?.requiredMissed ?? 1);
  const missedSoFar = Number((pending as any)?.missedSoFar ?? 0);
  const remainingMissed = Math.max(0, requiredMissed - missedSoFar);

  function confirm() {
    if (!sel) return;

    if (localPick && onConfirmLocalPick) {
      onConfirmLocalPick(sel);
      onCloseLocalPick?.();
      return;
    }

    if (sel.type === "hand") {
      safeSend(onSend, pending, {
        action: showPanic ? "take" : "discard",
        pick: "hand",
        index: sel.index,
        targetId,
      });
      return;
    }

    safeSend(onSend, pending, {
      action: showPanic ? "take" : "discard",
      pick: "equipment",
      cardId: sel.cardId,
      targetId,
    });
  }

  if (!pending && !localPick) {
    return (
      <>
        {revealCard ? (
          <View style={s.revealWrap} pointerEvents="none">
            <Animated.View
              style={[
                s.revealCard,
                {
                  opacity: revealAnim,
                  transform: [
                    {
                      scale: revealAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={s.revealTitle}>Card gained</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                <CardFace card={revealCard as any} w={52} h={70} />
                <Text style={[s.revealLine, { marginLeft: 10, flex: 1 }]} numberOfLines={2}>
                  {prettyCardLine(revealCard)}
                </Text>
              </View>
            </Animated.View>
          </View>
        ) : null}
      </>
    );
  }

  const openPick = showPanic || showCatBalou;

  return (
    <>
      {revealCard ? (
        <View style={s.revealWrap} pointerEvents="none">
          <Animated.View
            style={[
              s.revealCard,
              {
                opacity: revealAnim,
                transform: [
                  {
                    scale: revealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={s.revealTitle}>Card gained</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <CardFace card={revealCard as any} w={52} h={70} />
              <Text style={[s.revealLine, { marginLeft: 10, flex: 1 }]} numberOfLines={2}>
                {prettyCardLine(revealCard)}
              </Text>
            </View>
          </Animated.View>
        </View>
      ) : null}

      <Modal visible={openPick} transparent animationType="fade">
        <Animated.View style={[s.backdrop, { opacity: fade }]}> 
          <ImageBackground source={WOOD_BOARD} resizeMode="cover" style={s.modal} imageStyle={s.modalImg}>
            <View style={s.modalInner}>
              <Text style={s.modalTitle}>{title}</Text>

              <Text style={s.subTitle}>
                Target: <Text style={s.bold}>{target?.name ?? "?"}</Text>
              </Text>

              <Text style={[s.sectionTitle, { marginTop: 10 }]}>Hidden hand</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.row}>
                  {Array.from({ length: handCount }).map((_, i) => {
                    const active = sel?.type === "hand" && sel.index === i;
                    return (
                      <Pressable
                        key={`hand-${i}`}
                        onPress={() => setSel({ type: "hand", index: i })}
                        style={[s.cardSlot, active && s.cardSlotActive]}
                      >
                        <CardBack w={cardW} h={cardH} />
                        {active ? (
                          <View style={s.pickBadge}>
                            <Text style={s.pickBadgeText}>PICK</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {handCount === 0 ? <Text style={s.muted}>No cards in hand.</Text> : null}
                </View>
              </ScrollView>

              <Text style={[s.sectionTitle, { marginTop: 12 }]}>Equipment / weapon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.row}>
                  {(equipment ?? []).map((c: any) => {
                    const id = String(c?.id ?? "");
                    const fallback = String(c?.key ?? c?.name ?? "");
                    const pickId = id || fallback;
                    const active = sel?.type === "equip" && sel.cardId === pickId;

                    return (
                      <Pressable
                        key={`eq-${pickId}`}
                        onPress={() => setSel({ type: "equip", cardId: pickId })}
                        style={[s.cardSlot, active && s.cardSlotActive]}
                      >
                        <CardFace card={c} w={cardW} h={cardH} />
                        {active ? (
                          <View style={s.pickBadge}>
                            <Text style={s.pickBadgeText}>PICK</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {(equipment?.length ?? 0) === 0 ? <Text style={s.muted}>No equipment in play.</Text> : null}
                </View>
              </ScrollView>

              <View style={s.btnRow}>
                <WoodButton
                  title="Cancel"
                  onPress={() => {
                    if (localPick) {
                      onCloseLocalPick?.();
                      return;
                    }
                    safeSend(onSend, pending, { action: "cancel" });
                  }}
                  style={s.modalBtn}
                />

                <WoodButton title={actionVerb} onPress={confirm} disabled={!sel} style={s.modalBtn} />
              </View>

            </View>
          </ImageBackground>
        </Animated.View>
      </Modal>

      {showBangHint ? (
        <View style={s.inlineOverlay} pointerEvents="box-none">
          <View style={s.inlineCard}>
            <Text style={s.inlineTitle}>
              {requiredMissed > 1
                ? `Need ${remainingMissed} of ${requiredMissed} Missed`
                : "Bang response required"}
            </Text>
            <Text style={s.inlineLine}>
              {requiredMissed > 1
                ? isJanet
                  ? "This attack needs multiple responses. Play MISSED or BANG as Calamity Janet, then keep defending until the full count is done."
                  : "This attack needs multiple responses. Play MISSED, then keep defending until the full count is done."
                : isJanet
                ? "Play MISSED or BANG as Calamity Janet."
                : "Play MISSED from your hand."}
            </Text>
            {requiredMissed > 1 ? (
              <Text style={s.inlineWarn}>One card is not enough here — after the first defense you still must finish the full count.</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {showDuelHint ? (
        <View style={s.inlineOverlay} pointerEvents="box-none">
          <View style={s.inlineCard}>
            <Text style={s.inlineTitle}>Duel response required</Text>
            <Text style={s.inlineLine}>
              {isJanet
                ? "Play BANG, or MISSED as Calamity Janet, then press Play."
                : "Play BANG from your hand, then press Play."}
            </Text>
          </View>
        </View>
      ) : null}

      {showIndiansHint ? (
        <View style={s.inlineOverlay} pointerEvents="box-none">
          <View style={s.inlineCard}>
            <Text style={s.inlineTitle}>Indians response required</Text>
            <Text style={s.inlineLine}>
              {isJanet
                ? "Play BANG, or MISSED as Calamity Janet, to avoid the hit."
                : "Play BANG to avoid the hit."}
            </Text>
          </View>
        </View>
      ) : null}

      {showGatlingHint ? (
        <View style={s.inlineOverlay} pointerEvents="box-none">
          <View style={s.inlineCard}>
            <Text style={s.inlineTitle}>Gatling response required</Text>
            <Text style={s.inlineLine}>
              {isJanet
                ? "Play MISSED, or BANG as Calamity Janet, to avoid the hit."
                : "Play MISSED to avoid the hit."}
            </Text>
          </View>
        </View>
      ) : null}

      {showHeal ? (
        <View style={s.inlineOverlay} pointerEvents="box-none">
          <View style={s.inlineCard}>
            <Text style={s.inlineTitle}>
              {kOf(pending) === "respond_to_revive" || kOf(pending) === "revive" ? "Revive now" : "Heal"}
            </Text>
            <Text style={s.inlineLine}>
              {kOf(pending) === "respond_to_revive" || kOf(pending) === "revive"
                ? "Play Beer to survive. If you cannot, press TAKE HIT."
                : "Choose cards to discard for healing."}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 18,
    justifyContent: "center",
  },
  modal: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,239,206,0.26)",
  },
  modalImg: { borderRadius: 18 },
  modalInner: {
    backgroundColor: "rgba(16,11,7,0.76)",
    padding: 14,
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  subTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginBottom: 8,
  },
  bold: { fontWeight: "800", color: "white" },
  sectionTitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  cardSlot: {
    position: "relative",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  cardSlotActive: {
    borderColor: "rgba(255,220,120,0.92)",
    transform: [{ translateY: -4 }],
  },
  pickBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 34,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "rgba(255,220,120,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  pickBadgeText: { color: "#231200", fontWeight: "900", fontSize: 10 },
  muted: { color: "rgba(255,255,255,0.6)", fontSize: 12, paddingVertical: 10 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 14, justifyContent: "center" },
  modalBtn: { minWidth: 132 },
  revealWrap: {
    position: "absolute",
    top: 118,
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 1600,
    elevation: 30,
  },
  revealCard: {
    width: Math.min(W - 24, 320),
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(14,14,14,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,230,150,0.22)",
  },
  revealTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  revealLine: { color: "rgba(255,255,255,0.88)", fontWeight: "700", fontSize: 12 },
  inlineOverlay: {
    position: "absolute",
    top: 118,
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 1500,
  },
  inlineCard: {
    maxWidth: 420,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(15,15,15,0.90)",
    borderWidth: 1,
    borderColor: "rgba(255,210,120,0.18)",
  },
  inlineTitle: {
    color: "white",
    fontWeight: "900",
    fontSize: 14,
    textAlign: "center",
  },
  inlineLine: {
    color: "rgba(255,255,255,0.86)",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  inlineWarn: {
    marginTop: 6,
    color: "#ffdca0e6",
    fontWeight: "800",
    fontSize: 11,
    textAlign: "center",
  },
});
