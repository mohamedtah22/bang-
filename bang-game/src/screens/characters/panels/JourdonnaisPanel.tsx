import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CHARACTER_DETAILS } from "../index";

export function JourdonnaisPanel({
  pending,
}: {
  pending: any;
  onSend: (payload: any) => void;
}) {
  // The server handles Barrel/Jourdonnais Draw! automatically via draw_check / draw_check overlay.
  // This panel is informational only to avoid misleading "buttons that do nothing".
  const details = CHARACTER_DETAILS.jourdonnais;
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

const s = StyleSheet.create({
  box: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
});
