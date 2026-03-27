import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CHARACTER_DETAILS, CHARACTER_LABEL, CHARACTER_META, asCharacterKey } from "./index";

export function DefaultCharacterPanel({
  me,
  compact = false,
}: {
  me: any | null;
  compact?: boolean;
  pending?: any | null;
}) {
  const key = asCharacterKey(me?.playcharacter ?? me?.character);
  if (!key) return null;

  const meta = CHARACTER_META[key];
  const label = CHARACTER_LABEL[key];
  const details = CHARACTER_DETAILS[key];

  if (compact) {
    return (
      <View style={[s.box, s.compactBox]}>
        <Text style={s.compactTitle}>{label}</Text>
        <Text style={s.compactTag}>{String(meta?.kind ?? "rule").toUpperCase()}</Text>
        <Text style={s.compactDesc}>{meta?.short ?? ""}</Text>
      </View>
    );
  }

  return (
    <View style={s.box}>
      <Text style={s.title}>{label}</Text>
      <Text style={s.tag}>{String(meta?.kind ?? "rule").toUpperCase()}</Text>
      <Text style={s.desc}>{meta?.short ?? ""}</Text>

      {details?.timing ? (
        <View style={s.infoBlock}>
          <Text style={s.infoLabel}>WHEN</Text>
          <Text style={s.infoText}>{details.timing}</Text>
        </View>
      ) : null}

      {details?.effect ? (
        <View style={s.infoBlock}>
          <Text style={s.infoLabel}>EFFECT</Text>
          <Text style={s.infoText}>{details.effect}</Text>
        </View>
      ) : null}

      {details?.hint ? <Text style={s.hint}>{details.hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  compactBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  title: { color: "white", fontWeight: "900", fontSize: 14 },
  tag: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,210,120,0.12)",
    color: "#FFD28A",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  desc: { color: "rgba(255,255,255,0.84)", marginTop: 8, fontSize: 12, lineHeight: 18 },
  infoBlock: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  infoLabel: {
    color: "#FFD28A",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.7,
  },
  infoText: {
    color: "rgba(255,255,255,0.88)",
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
  },
  hint: {
    color: "rgba(255,255,255,0.62)",
    marginTop: 10,
    fontSize: 11,
    lineHeight: 15,
  },
  compactTitle: { color: "white", fontWeight: "900", fontSize: 13 },
  compactTag: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,210,120,0.12)",
    color: "#FFD28A",
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  compactDesc: { color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 6, lineHeight: 15 },
});
