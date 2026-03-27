import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type Phase = "main" | "waiting";

type Props = {
  phase: Phase;
  turnEndsAt?: number | null;
  pendingEndsAt?: number | null;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function TimerBar({ phase, turnEndsAt, pendingEndsAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const targetTs = phase === "waiting" ? (pendingEndsAt ?? 0) : (turnEndsAt ?? 0);
  const leftMs = Math.max(0, targetTs - now);

  // Just a lightweight bar (not exact duration-based, but useful).
  const progress = useMemo(() => {
    // assume max 30s turn / 12s pending if we don't know exact
    const max = phase === "waiting" ? 12_000 : 30_000;
    return clamp01(leftMs / max);
  }, [leftMs, phase]);

  const seconds = Math.ceil(leftMs / 1000);

  if (!targetTs) return null;

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Text style={s.label}>{phase === "waiting" ? "Pending" : "Turn"}</Text>
        <Text style={s.time}>{seconds}s</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: "rgba(255,255,255,0.75)", fontWeight: "900", fontSize: 12 },
  time: { color: "white", fontWeight: "900", fontSize: 12 },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(120,220,120,0.55)",
  },
});