import React from "react";
import { View, Text, StyleSheet } from "react-native";
import WoodButton from "../../game/WoodButton";
import { CHARACTER_DETAILS } from "../index";

type PendingAny = { kind?: string; privateKind?: string; [k: string]: any } | null;

type Props = {
  pending: PendingAny;
  onSend: (payload: any) => void;
};

function getKind(pending: PendingAny) {
  const k = String(pending?.kind ?? "");
  const pk = String((pending as any)?.privateKind ?? "");
  return k || pk;
}

function isPedroPending(pending: PendingAny) {
  const k = getKind(pending).toLowerCase();
  return (
    k === "pedro_choice" ||
    k === "choose_pedro_source" ||
    k.includes("pedro_choice") ||
    k.includes("choose_pedro_source")
  );
}

export function PedroRamirezPanel({ pending, onSend }: Props) {
  if (!pending || !isPedroPending(pending)) {
    const details = CHARACTER_DETAILS.pedro_ramirez;
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

  const canDiscard =
    !!(pending as any)?.canUseDiscard ||
    Number((pending as any)?.discardCount ?? 0) > 0 ||
    Number((pending as any)?.discardSize ?? 0) > 0;

  return (
    <View style={s.box}>
      <Text style={s.desc}>Your first draw may come from the discard pile. The second draw always comes from the deck.</Text>

      <View style={s.row}>
        <WoodButton
          title="Discard → Deck"
          disabled={!canDiscard}
          onPress={() => onSend({ type: "choose_pedro_source", source: "discard" })}
          style={s.btnHalf}
        />

        <WoodButton
          title="Deck → Deck"
          onPress={() => onSend({ type: "choose_pedro_source", source: "deck" })}
          style={s.btnHalf}
        />
      </View>

      {!canDiscard ? <Text style={s.hint}>Discard pile is empty.</Text> : null}
    </View>
  );
}

export default PedroRamirezPanel;

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
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnHalf: { flex: 1 },
  hint: { marginTop: 8, color: "rgba(255,255,255,0.6)", fontSize: 11, lineHeight: 15 },
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
});
