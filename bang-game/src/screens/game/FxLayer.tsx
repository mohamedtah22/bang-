// src/screens/game/FxLayer.tsx

import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export type FxKind =
  | "bang_hit"
  | "explosion"
  | "shield"
  | "defense"
  | "duel_pulse_end"
  | "beer_glow"
  | "jail_lock"
  | "indians_start"
  | "gatling";

export type FxEvent = {
  id: string;
  kind: FxKind;
  at: number;
  fromId?: string;
  toId?: string;
  targetId?: string;
};

function pointFor(e: FxEvent, anchors?: Record<string, { x: number; y: number }>) {
  if (!anchors) return null;
  const id = String(e.targetId ?? e.toId ?? "");
  if (!id) return null;
  return anchors[id] ?? null;
}

export function FxLayer({
  fx,
  duelActive,
  anchors,
  onFxDone,
}: {
  fx: FxEvent[];
  duelActive?: boolean;
  anchors?: Record<string, { x: number; y: number }>;
  onFxDone?: (id: string) => void;
}) {
  const recent = useMemo(() => (Array.isArray(fx) ? fx.slice(-18) : []), [fx]);

  return (
    <View pointerEvents="none" style={s.root}>
      {recent.map((e) => {
        const pt = pointFor(e, anchors);
        if (e.kind === "bang_hit") return <LocalFx key={e.id} id={e.id} kind="hit" pt={pt} onDone={onFxDone} />;
        if (e.kind === "explosion") return <LocalFx key={e.id} id={e.id} kind="boom" pt={pt} onDone={onFxDone} />;
        if (e.kind === "shield") return <LocalFx key={e.id} id={e.id} kind="shield" pt={pt} onDone={onFxDone} />;
        if (e.kind === "defense") return <LocalFx key={e.id} id={e.id} kind="defense" pt={pt} onDone={onFxDone} />;
        if (e.kind === "beer_glow") return <LocalFx key={e.id} id={e.id} kind="heal" pt={pt} onDone={onFxDone} />;
        if (e.kind === "jail_lock") return <LocalFx key={e.id} id={e.id} kind="lock" pt={pt} onDone={onFxDone} />;
        if (e.kind === "duel_pulse_end") return <CenterRing key={e.id} id={e.id} color="rgba(255,220,120,0.8)" onDone={onFxDone} />;
        if (e.kind === "indians_start") return <CenterRing key={e.id} id={e.id} color="rgba(255,170,110,0.78)" label="INDIANS" onDone={onFxDone} />;
        if (e.kind === "gatling") return <CenterRing key={e.id} id={e.id} color="rgba(255,110,110,0.82)" label="GATLING" onDone={onFxDone} />;
        return null;
      })}
    </View>
  );
}

function LocalFx({
  id,
  kind,
  pt,
  onDone,
}: {
  id: string;
  kind: "hit" | "boom" | "shield" | "defense" | "heal" | "lock";
  pt: { x: number; y: number } | null;
  onDone?: (id: string) => void;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => onDone?.(id));
  }, [a, id, onDone]);

  const size = kind === "boom" ? 120 : 86;
  const color =
    kind === "heal"
      ? "rgba(90,220,140,0.9)"
      : kind === "shield"
      ? "rgba(120,200,255,0.9)"
      : kind === "defense"
      ? "rgba(255,228,150,0.92)"
      : kind === "lock"
      ? "rgba(255,220,140,0.9)"
      : "rgba(255,90,90,0.95)";

  const label =
    kind === "heal" ? "+1" : kind === "shield" ? "MISS" : kind === "defense" ? "DEF" : kind === "lock" ? "LOCK" : kind === "boom" ? "-3" : "HIT";

  if (!pt) return null;

  return (
    <Animated.View
      style={[
        s.localWrap,
        {
          left: pt.x - size / 2,
          top: pt.y - size / 2,
          opacity: a,
          transform: [
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] }) },
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [6, -6] }) },
          ],
        },
      ]}
    >
      <View style={[s.localRing, { width: size, height: size, borderColor: color, backgroundColor: color.replace('0.9', '0.12').replace('0.95', '0.14') }]} />
      <Text style={[s.localText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

function CenterRing({
  id,
  color,
  label,
  onDone,
}: {
  id: string;
  color: string;
  label?: string;
  onDone?: (id: string) => void;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }).start(() => onDone?.(id));
  }, [a, id, onDone]);

  return (
    <Animated.View
      style={[
        s.center,
        {
          opacity: a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.9, 0] }),
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.25] }) }],
        },
      ]}
    >
      <View style={[s.centerRing, { borderColor: color, backgroundColor: "rgba(255,255,255,0.03)" }]} />
      {label ? <Text style={[s.centerLabel, { color }]}>{label}</Text> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 1450 },
  localWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  localRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 3,
  },
  localText: {
    fontWeight: "900",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerRing: {
    width: 230,
    height: 230,
    borderRadius: 999,
    borderWidth: 3,
  },
  centerLabel: {
    position: "absolute",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
