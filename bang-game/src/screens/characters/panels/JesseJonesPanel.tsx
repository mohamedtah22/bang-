import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import WoodButton from "../../game/WoodButton";
import { CHARACTER_DETAILS } from "../index";

type PendingAny = {
  kind?: string;
  privateKind?: string;
  eligibleTargets?: any[];
  [k: string]: any;
} | null;

type PlayerLite = {
  id?: string;
  name?: string;
  isAlive?: boolean;
  [k: string]: any;
};

type TargetLite = {
  id: string;
  name?: string;
};

type Props = {
  pending: PendingAny;
  players: PlayerLite[];
  meId?: string;
  onSend: (payload: any) => void;
};

function safeStr(x: any): string {
  return String(x ?? "");
}

function kindOf(p: PendingAny): string {
  const k = safeStr(p?.kind);
  const pk = safeStr((p as any)?.privateKind);
  return (k || pk || "").toLowerCase();
}

export default function JesseJonesPanel({ pending, players, meId, onSend }: Props) {
  const k = useMemo(() => kindOf(pending), [pending]);

  const isJesse = useMemo(() => {
    return (
      k === "jesse_choice" ||
      k === "choose_jesse_target" ||
      k.includes("jesse_choice") ||
      k.includes("choose_jesse_target")
    );
  }, [k]);

  const [mode, setMode] = useState<"player" | "deck">("player");

  const playersById = useMemo(() => {
    const map = new Map<string, TargetLite>();
    const arr: PlayerLite[] = Array.isArray(players) ? players : [];

    for (const p of arr) {
      const id = safeStr(p?.id);
      if (!id) continue;
      map.set(id, {
        id,
        name: safeStr(p?.name || "Player"),
      });
    }

    return map;
  }, [players]);

  const eligibleTargets: TargetLite[] = useMemo(() => {
    const raw: any[] = Array.isArray(pending?.eligibleTargets) ? pending!.eligibleTargets : [];

    return raw
      .map((t: any): TargetLite => {
        const id = safeStr(t?.id ?? t?.playerId ?? t);
        const fallback = playersById.get(id);
        return {
          id,
          name: t?.name ? safeStr(t.name) : fallback?.name,
        };
      })
      .filter((t: TargetLite) => t.id.length > 0);
  }, [pending, playersById]);

  const opponents: TargetLite[] = useMemo(() => {
    const arr: PlayerLite[] = Array.isArray(players) ? players : [];
    const my = safeStr(meId);

    return arr
      .filter(
        (p: PlayerLite) =>
          !!p &&
          p.isAlive !== false &&
          safeStr(p.id).length > 0 &&
          safeStr(p.id) !== my
      )
      .map((p: PlayerLite): TargetLite => ({
        id: safeStr(p.id),
        name: safeStr(p.name || "Player"),
      }));
  }, [players, meId]);

  const targets = eligibleTargets.length > 0 ? eligibleTargets : opponents;
  const hasTargets = targets.length > 0;

  useEffect(() => {
    if (!isJesse) return;
    setMode(hasTargets ? "player" : "deck");
  }, [isJesse, k, hasTargets]);

  if (!pending || !isJesse) {
    const details = CHARACTER_DETAILS.jesse_jones;
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
      <Text style={s.desc}>Your first draw may come from another player's hand.</Text>

      <View style={s.row}>
        <WoodButton
          title="Player + Deck"
          onPress={() => setMode("player")}
          disabled={!hasTargets}
          style={mode === "player" ? s.btnOn : s.btnBase}
        />
        <WoodButton
          title="Deck + Deck"
          onPress={() => setMode("deck")}
          style={mode === "deck" ? s.btnOn : s.btnBase}
        />
      </View>

      {mode === "deck" ? (
        <WoodButton
          title="Draw from deck"
          onPress={() => onSend({ type: "choose_jesse_target" })}
          style={s.primaryWide}
        />
      ) : (
        <View style={s.pickWrap}>
          <Text style={s.sub}>Choose a player:</Text>

          <View style={s.targetsWrap}>
            {targets.map((t: TargetLite) => (
              <WoodButton
                key={t.id}
                title={safeStr(t.name ?? "Player")}
                onPress={() => onSend({ type: "choose_jesse_target", targetId: t.id })}
                style={s.targetBtn}
              />
            ))}
          </View>

          {targets.length === 0 ? <Text style={s.hint}>No eligible targets — use Deck + Deck.</Text> : null}
        </View>
      )}
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
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnBase: { flex: 1 },
  btnOn: { flex: 1 },
  primaryWide: { marginTop: 10, alignSelf: "center", minWidth: 180 },
  pickWrap: { marginTop: 10 },
  sub: { color: "rgba(255,255,255,0.88)", fontWeight: "800", marginBottom: 8 },
  targetsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  targetBtn: { minWidth: 128 },
  hint: { marginTop: 8, color: "rgba(255,255,255,0.66)", fontSize: 11, lineHeight: 15 },
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
