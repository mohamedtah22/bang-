
import React, { useMemo } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import WoodButton from "./WoodButton";

function roleLabel(role?: any) {
  const r = String(role ?? "").toLowerCase();
  if (r === "sheriff") return "Sheriff";
  if (r === "deputy") return "Deputy";
  if (r === "outlaw") return "Outlaw";
  if (r === "renegade") return "Renegade";
  return String(role ?? "Unknown");
}

export function roleGoal(role?: any) {
  const r = String(role ?? "").toLowerCase();
  if (r === "sheriff") return "Eliminate all Outlaws and the Renegade.";
  if (r === "deputy") return "Protect the Sheriff and defeat the Outlaws.";
  if (r === "outlaw") return "Eliminate the Sheriff.";
  if (r === "renegade") return "Be the last survivor.";
  return "";
}

export default function EndGameOverlay({ open, meId, gameOver, onBackHome }: { open: boolean; meId?: string | null; gameOver: any; onBackHome: () => void; }) {
  const players = Array.isArray(gameOver?.players) ? gameOver.players : [];
  const winners = Array.isArray(gameOver?.winners) ? gameOver.winners.map(String) : [];
  const alive = Array.isArray(gameOver?.alivePlayerIds) ? gameOver.alivePlayerIds.map(String) : [];
  const didWin = !!meId && winners.includes(String(meId));

  const ordered = useMemo(() => [...players].sort((a: any, b: any) => {
    const aw = winners.includes(String(a?.id ?? "")) ? 0 : 1;
    const bw = winners.includes(String(b?.id ?? "")) ? 0 : 1;
    return aw - bw;
  }), [players, winners]);

  return (
    <Modal visible={open} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.panel}>
          <Text style={s.kicker}>GAME OVER</Text>
          <Text style={s.title}>{didWin ? "VICTORY" : "DEFEAT"}</Text>
          <Text style={s.sub}>{String(gameOver?.winner ?? "").replace(/_/g, " ")} win.</Text>

          <View style={s.listWrap}>
            {ordered.map((p: any) => {
              const pid = String(p?.id ?? "");
              const win = winners.includes(pid);
              const dead = !alive.includes(pid);
              return (
                <View key={pid} style={[s.row, win ? s.rowWinner : s.rowLoser]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{String(p?.name ?? "Player")}</Text>
                    <Text style={s.rowMeta}>{roleLabel(p?.role)} • {dead ? "Dead" : "Alive"}</Text>
                  </View>
                  <Text style={[s.rowSide, win ? s.good : s.bad]}>{win ? "WINNER" : "LOSER"}</Text>
                </View>
              );
            })}
          </View>

          <WoodButton title="Back Home" onPress={onBackHome} style={s.btn} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 18 },
  panel: { width: "100%", maxWidth: 460, borderRadius: 22, padding: 18, backgroundColor: "rgba(46,26,8,0.97)", borderWidth: 2, borderColor: "rgba(255,210,120,0.35)" },
  kicker: { color: "#E6C27A", fontWeight: "900", letterSpacing: 1.2, textAlign: "center" },
  title: { color: "white", fontSize: 28, fontWeight: "900", textAlign: "center", marginTop: 4 },
  sub: { color: "rgba(255,255,255,0.82)", textAlign: "center", marginTop: 6, marginBottom: 16 },
  listWrap: { gap: 8, marginBottom: 14 },
  row: { borderRadius: 14, padding: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  rowWinner: { backgroundColor: "rgba(40,80,40,0.28)", borderColor: "rgba(120,255,120,0.24)" },
  rowLoser: { backgroundColor: "rgba(0,0,0,0.18)", borderColor: "rgba(255,255,255,0.12)" },
  rowName: { color: "white", fontWeight: "900", fontSize: 15 },
  rowMeta: { color: "rgba(255,255,255,0.76)", marginTop: 2 },
  rowSide: { fontWeight: "900", fontSize: 12 },
  good: { color: "#A7FF9A" },
  bad: { color: "#FFC1C1" },
  btn: { alignSelf: "center", marginTop: 4, minWidth: 180 },
});
