import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import type { Card } from "../../../models/card";
import { getCardImage, CARD_BACK } from "../../../data/cardAssets";
import WoodButton from "../../game/WoodButton";
import { CHARACTER_DETAILS } from "../index";

type Props = {
  hp: number;
  maxHp: number;
  hand?: Card[];
  selectedIds: Set<string>;
  onHeal: (cardIds: string[]) => void;
  onClear: () => void;
  onToggleCard?: (cardId: string) => void;
  selectMode?: boolean;
  onToggleSelectMode?: () => void;
};

function cardIdOf(card: any) {
  return String(card?.id ?? card?.cardId ?? card?._id ?? card?.uid ?? card?.uuid ?? "");
}

function cardLabel(card: any) {
  const key = String(card?.weaponName ?? card?.key ?? card?.name ?? "Card")
    .replace(/_/g, " ")
    .trim();
  const niceKey = key ? key.replace(/\b\w/g, (m: string) => m.toUpperCase()) : "Card";
  const rank = String(card?.rank ?? "").trim();
  const suit = String(card?.suit ?? "").trim();
  return [niceKey, rank && suit ? `${rank} ${suit}` : rank || suit].filter(Boolean).join(" • ");
}

export function SidKetchumPanel({
  hp,
  maxHp,
  hand = [],
  selectedIds,
  onHeal,
  onClear,
  onToggleCard,
}: Props) {
  const arr = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const canHeal = hp < maxHp && arr.length === 2;
  const details = CHARACTER_DETAILS.sid_ketchum;

  return (
    <View style={s.box}>
      <Text style={s.desc}>{details.effect}</Text>

      <View style={s.infoBlock}>
        <Text style={s.infoLabel}>WHEN</Text>
        <Text style={s.infoText}>{details.timing}</Text>
      </View>

      <Text style={s.hint}>
        HP: <Text style={s.bold}>{hp}</Text> / {maxHp} • Selected: <Text style={s.bold}>{arr.length}</Text> / 2
      </Text>

      <View style={s.cardsWrap}>
        {hand.length > 0 ? (
          hand.map((card) => {
            const id = cardIdOf(card);
            const active = selectedIds.has(id);
            const blocked = !active && arr.length >= 2;
            const src = getCardImage(card as any) ?? CARD_BACK;

            return (
              <Pressable
                key={id}
                onPress={blocked ? undefined : () => onToggleCard?.(id)}
                style={({ pressed }) => [
                  s.cardPress,
                  active ? s.cardPressActive : null,
                  blocked ? s.cardPressBlocked : null,
                  pressed && !blocked ? s.cardPressPressed : null,
                ]}
              >
                <Image source={src as any} resizeMode="contain" style={s.cardImg} />
                <Text numberOfLines={2} style={s.cardText}>
                  {cardLabel(card)}
                </Text>
                {active ? (
                  <View style={s.checkBadge}>
                    <Text style={s.checkText}>✓</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <Text style={s.note}>No cards in hand.</Text>
        )}
      </View>

      <View style={s.row}>
        <WoodButton title="Clear" onPress={onClear} style={s.btnItem} />
        <WoodButton title="Heal +1" disabled={!canHeal} onPress={() => onHeal(arr)} style={s.btnItem} />
      </View>

      <Text style={s.note}>Tap exactly 2 cards here in the panel, then press Heal +1.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  desc: { color: "rgba(255,255,255,0.82)", marginTop: 6, fontSize: 12, lineHeight: 17 },
  infoBlock: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  infoLabel: { color: "#FFD28A", fontWeight: "900", fontSize: 10, letterSpacing: 0.7 },
  infoText: { color: "rgba(255,255,255,0.88)", marginTop: 5, fontSize: 12, lineHeight: 17 },
  hint: { marginTop: 10, color: "rgba(255,255,255,0.70)", fontSize: 12 },
  bold: { fontWeight: "900", color: "white" },
  cardsWrap: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  cardPress: {
    width: 104,
    padding: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    position: "relative",
  },
  cardPressActive: {
    borderColor: "#FFD86F",
    backgroundColor: "rgba(255,216,111,0.14)",
    transform: [{ translateY: -4 }],
  },
  cardPressBlocked: {
    opacity: 0.48,
  },
  cardPressPressed: {
    opacity: 0.88,
  },
  cardImg: {
    width: "100%",
    height: 132,
    borderRadius: 10,
  },
  cardText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.86)",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    minHeight: 30,
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22,84,32,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  checkText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap", justifyContent: "center" },
  btnItem: { minWidth: 128 },
  note: { marginTop: 8, color: "rgba(255,255,255,0.55)", fontSize: 11, textAlign: "center" },
});
