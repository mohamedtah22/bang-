// src/screens/game/GeneralStorePanel.tsx

import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Card } from "../../models/card";
import { CARD_BACK, getCardImage } from "../../data/cardAssets";
import WoodButton from "./WoodButton";

function cardId(c: any) {
  return String(c?.id ?? c?._id ?? c?.cardId ?? "");
}

type PickEntry = {
  id: string;
  pickerId: string;
  pickerName: string;
  card?: any | null;
};

function PickReveal({ entry }: { entry: PickEntry }) {
  const pop = useRef(new Animated.Value(0.88)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pop, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entry.id, fade, pop]);

  const card = entry.card ?? null;
  const src = getCardImage(card) ?? CARD_BACK;
  const title = String(card?.name ?? card?.key ?? "Card")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <Animated.View
      style={[
        s.pickCard,
        {
          opacity: fade,
          transform: [{ scale: pop }],
        },
      ]}
    >
      <Image source={src} style={s.pickImg} resizeMode="contain" />
      <View style={s.pickMeta}>
        <Text style={s.pickPlayer} numberOfLines={1}>
          {entry.pickerName || entry.pickerId}
        </Text>
        <Text style={s.pickText} numberOfLines={1}>
          picked {title}
        </Text>
      </View>
    </Animated.View>
  );
}

export function GeneralStorePanel({
  offered,
  pickerId,
  pickerName,
  isPicker,
  selectedStoreCardId,
  setSelectedStoreCardId,
  confirmBusy = false,
  onConfirm,
  pickHistory = [],
}: {
  offered: Card[];
  pickerId: string;
  pickerName?: string;
  isPicker: boolean;
  selectedStoreCardId: string | null;
  setSelectedStoreCardId: (v: string | null) => void;
  selectedHandCardId?: string | null;
  confirmBusy?: boolean;
  onConfirm: (takeId: string, giveId?: string | null) => void;
  pickHistory?: PickEntry[];
}) {
  const items = Array.isArray(offered) ? offered : [];
  const canTake = isPicker && !!selectedStoreCardId && !confirmBusy;

  const chooserLabel = pickerName || pickerId || "Player";
  const subtitle = isPicker
    ? "It is your turn to choose from the General Store"
    : `${chooserLabel} is choosing right now`;

  const grid = useMemo(() => items.map((c) => ({ c, id: cardId(c) })), [items]);

  if (!items.length && !pickHistory.length) return null;

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <View style={s.scrim} />
      <View style={s.wrap}>
        <View style={s.header}>
          <Text style={s.kicker}>LIVE EVENT</Text>
          <Text style={s.title}>GENERAL STORE</Text>
          <Text style={s.sub}>{subtitle}</Text>

          <View style={s.liveRow}>
            <View style={[s.liveChip, isPicker ? s.liveChipActive : null]}>
              <Text style={s.liveChipText}>Now choosing: {chooserLabel}</Text>
            </View>

            {!!pickHistory.length ? (
              <View style={s.liveChip}>
                <Text style={s.liveChipText}>Picked: {pickHistory.length}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {!!items.length ? (
          <View style={s.board}>
            <View style={s.grid}>
              {grid.map(({ c, id }) => {
                const active = selectedStoreCardId === id;
                const src = getCardImage(c) ?? CARD_BACK;
                return (
                  <Pressable
                    key={id}
                    style={({ pressed }) => [
                      s.cardBox,
                      active && s.cardBoxActive,
                      pressed && isPicker && !confirmBusy ? s.cardBoxPressed : null,
                      !isPicker || confirmBusy ? s.cardBoxLocked : null,
                    ]}
                    onPress={() => {
                      if (!isPicker || confirmBusy) return;
                      setSelectedStoreCardId(active ? null : id);
                    }}
                  >
                    <Image source={src} style={s.cardImg} resizeMode="contain" />
                  </Pressable>
                );
              })}
            </View>

            {isPicker ? (
              <View style={s.actions}>
                <WoodButton
                  title={confirmBusy ? "Picking..." : "Take Card"}
                  onPress={() => selectedStoreCardId && onConfirm(selectedStoreCardId, null)}
                  disabled={!canTake}
                  style={s.takeBtn}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={s.historyWrap}>
          <Text style={s.historyTitle}>Chosen cards</Text>
          {pickHistory.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.historyRow}
            >
              {pickHistory.map((entry) => (
                <PickReveal key={entry.id} entry={entry} />
              ))}
            </ScrollView>
          ) : (
            <Text style={s.historyEmpty}>Waiting for the first pick...</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1700,
    justifyContent: "center",
    alignItems: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 6, 2, 0.64)",
  },
  wrap: {
    width: "94%",
    maxWidth: 1100,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255, 218, 145, 0.34)",
    backgroundColor: "rgba(42, 26, 13, 0.94)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  kicker: {
    color: "#F0CF8C",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 4,
    color: "#FFF5DF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  sub: {
    marginTop: 6,
    color: "rgba(255,245,223,0.84)",
    fontSize: 14,
    fontWeight: "700",
  },

  liveRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  liveChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  liveChipActive: {
    backgroundColor: "rgba(255,215,125,0.18)",
    borderColor: "rgba(255,215,125,0.34)",
  },
  liveChipText: {
    color: "#FFF1D2",
    fontSize: 12,
    fontWeight: "800",
  },
  board: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
  },
  cardBox: {
    width: 112,
    height: 166,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cardBoxActive: {
    borderColor: "#FFD77D",
    transform: [{ translateY: -6 }, { scale: 1.03 }],
    shadowColor: "#FFD77D",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  cardBoxPressed: {
    opacity: 0.92,
  },
  cardBoxLocked: {
    opacity: 0.96,
  },
  cardImg: {
    width: "100%",
    height: "100%",
  },
  actions: {
    marginTop: 16,
    alignItems: "center",
  },
  takeBtn: {
    minWidth: 180,
  },
  historyWrap: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  historyTitle: {
    color: "#F6D9A0",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  historyEmpty: {
    color: "rgba(255,245,223,0.7)",
    fontSize: 13,
  },
  historyRow: {
    gap: 12,
    paddingRight: 12,
  },
  pickCard: {
    width: 210,
    minHeight: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,230,175,0.14)",
  },
  pickImg: {
    width: 58,
    height: 86,
  },
  pickMeta: {
    flex: 1,
  },
  pickPlayer: {
    color: "#FFF4DC",
    fontSize: 15,
    fontWeight: "900",
  },
  pickText: {
    marginTop: 4,
    color: "rgba(255,244,220,0.84)",
    fontSize: 13,
    fontWeight: "700",
  },
});
