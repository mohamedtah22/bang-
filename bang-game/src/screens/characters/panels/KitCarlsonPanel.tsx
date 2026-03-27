import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";

import { CARD_BACK, getCardImage } from "../../../data/cardAssets";
import WoodButton from "../../game/WoodButton";
import { CHARACTER_DETAILS } from "../index";

export function KitCarlsonPanel({
  pending,
  onSend,
}: {
  pending: any;
  onSend: (payload: any) => void;
}) {
  const options = useMemo(() => {
    if (Array.isArray(pending?.offered)) return pending.offered;
    if (Array.isArray(pending?.options)) return pending.options;
    if (Array.isArray(pending?.cards)) return pending.cards;
    return [];
  }, [pending]);

  const optionsKey = useMemo(
    () => options.map((op: any, idx: number) => String(op?.id ?? idx)).join("|"),
    [options]
  );

  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    setPicked([]);
  }, [optionsKey]);

  const canConfirm = picked.length === 2;

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  if (options.length < 3) {
    const details = CHARACTER_DETAILS.kit_carlson;
    return (
      <View style={s.box}>
        <Text style={s.desc}>{details.effect}</Text>
        <View style={s.infoBlock}>
          <Text style={s.infoLabel}>WHEN</Text>
          <Text style={s.infoText}>{details.timing}</Text>
        </View>
        {details.hint ? <Text style={s.hint}>{details.hint}</Text> : null}
      </View>
    );
  }

  return (
    <View style={s.box}>
      <Text style={s.desc}>Look at 3 cards and keep exactly 2.</Text>

      <View style={s.cardsRow}>
        {options.slice(0, 3).map((op: any, idx: number) => {
          const id = String(op?.id ?? idx);
          const active = picked.includes(id);
          const src = getCardImage(op) ?? CARD_BACK;

          return (
            <Pressable key={id} style={[s.cardShell, active && s.cardShellActive]} onPress={() => toggle(id)}>
              <Image source={src} style={s.cardImg} resizeMode="contain" />
              <View style={s.caption}>
                <Text style={s.captionText}>{active ? "Selected" : `Card ${idx + 1}`}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.pickState}>{picked.length === 0 ? "Select 2 cards." : `Selected ${picked.length} / 2`}</Text>

      <View style={s.row}>
        <WoodButton
          title="Keep 2"
          disabled={!canConfirm}
          onPress={() =>
            onSend({
              type: "choose_draw",
              cardIds: picked,
            })
          }
          style={s.btnHalf}
        />

        <WoodButton title="Clear" onPress={() => setPicked([])} style={s.btnHalf} />
      </View>
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
  title: { color: "white", fontWeight: "900", fontSize: 14 },
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
  hint: { marginTop: 8, color: "rgba(255,255,255,0.66)", fontSize: 11, lineHeight: 15 },
  cardsRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  cardShell: {
    width: 86,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardShellActive: {
    borderColor: "rgba(255,220,120,0.96)",
    transform: [{ translateY: -4 }],
  },
  cardImg: {
    width: 86,
    height: 120,
  },
  caption: {
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  captionText: { color: "white", fontWeight: "900", fontSize: 11, textAlign: "center" },
  pickState: {
    marginTop: 10,
    color: "rgba(255,255,255,0.86)",
    fontWeight: "800",
    textAlign: "center",
  },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnHalf: { flex: 1 },
});
