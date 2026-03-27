import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PublicPlayer, MePlayer } from "../../models/player";

function nameOf(players: any[], id: string) {
  const p = players.find((x: any) => x.id === id);
  return p ? p.name : id;
}

function prettyEvent(players: any[], e: any) {
  const t = String(e?.type ?? "");
  if (t === "card_played") {
    const who = nameOf(players, String(e.playerId));
    const ck = String(e.cardKey ?? "");
    const target = e.targetId ? ` -> ${nameOf(players, String(e.targetId))}` : "";
    return `${who} played ${ck}${target}`;
  }
  if (t === "action_resolved") {
    const k = String(e?.kind ?? "");
    if (k === "bang_hit") return `${nameOf(players, String(e.targetId))} got hit`;
    if (k === "bang_missed") return `${nameOf(players, String(e.targetId))} dodged`;
    return `${k}`;
  }
  if (t === "draw_check") {
    const who = nameOf(players, String(e.playerId));
    return `${who} draw_check ${String(e.kind)} -> ${e.ok ? "OK" : "FAIL"}`;
  }
  if (t === "player_passed") {
    const who = nameOf(players, String(e.playerId));
    return `${who} passed (${String(e.context ?? "")})`;
  }
  if (t === "game_over") return `Game Over`;
  return `${t}`;
}

export function LogPanel({
  me,
  players,
  events,
}: {
  me: MePlayer | null;
  players: (PublicPlayer | MePlayer)[] | null;
  events: any[] | null;
}) {
  const [open, setOpen] = useState(false);
  const ps = useMemo(() => (Array.isArray(players) ? players : []), [players]);
  const list = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const last = useMemo(() => list.slice(-10), [list]);

  return (
    <View style={s.wrap}>
      <Pressable onPress={() => setOpen((x) => !x)} style={s.head}>
        <Text style={s.title}>Log</Text>
        <Text style={s.small}>{open ? "hide" : "show"}</Text>
      </Pressable>

      {open ? (
        <ScrollView style={s.box}>
          {last.map((e, idx) => (
            <Text key={idx} style={s.line}>
              {prettyEvent(ps, e)}
            </Text>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  title: { color: "rgba(255,255,255,0.9)", fontWeight: "900" },
  small: { color: "rgba(255,255,255,0.6)" },
  box: { maxHeight: 120, padding: 10, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  line: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginBottom: 6 },
});