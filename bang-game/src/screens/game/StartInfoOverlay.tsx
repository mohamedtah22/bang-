import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getCharacterSafe } from "../../models/characters";
import { getRoleImage } from "../../data/roleAssets";
import WoodButton from "./WoodButton";

const ROLE_GOAL: Record<string, string> = {
  sheriff: "Stay alive. Your team wins when every Outlaw and the Renegade are gone.",
  deputy: "Protect the Sheriff. Help remove the Outlaws and the Renegade.",
  outlaw: "Take down the Sheriff.",
  renegade: "Be the last survivor after the Sheriff is eliminated.",
};

const CHARACTER_DESC: Record<string, { timing: string; effect: string }> = {
  bart_cassidy: { timing: "When you lose 1 HP", effect: "Draw 1 card each time." },
  black_jack: { timing: "During your normal draw", effect: "If the second drawn card is Hearts or Diamonds, draw 1 extra." },
  calamity_janet: { timing: "Any time you play BANG! or MISSED!", effect: "You may swap them: BANG! as MISSED! and MISSED! as BANG!." },
  el_gringo: { timing: "When another player hurts you", effect: "Take a random card from the attacker for each HP lost." },
  jesse_jones: { timing: "Your first draw of the turn", effect: "You may draw the first card from another player's hand instead of the deck." },
  jourdonnais: { timing: "When defending against BANG!", effect: "You are treated like you always have a Barrel in play." },
  kit_carlson: { timing: "At the start of your draw", effect: "Look at 3 cards, keep 2, return 1 on top of the deck." },
  lucky_duke: { timing: "Whenever you make a Draw! check", effect: "Reveal 2 cards and choose which one counts." },
  paul_regret: { timing: "Always active", effect: "Other players see you at distance +1." },
  pedro_ramirez: { timing: "Your first draw of the turn", effect: "You may take the top card from the discard pile instead of the deck." },
  rose_doolan: { timing: "Always active", effect: "You see all other players at distance -1." },
  sid_ketchum: { timing: "Manual ability on your turn", effect: "Discard 2 cards to recover 1 HP." },
  slab_the_killer: { timing: "Whenever your BANG! is defended", effect: "The target usually needs 2 MISSED! to fully cancel it." },
  suzy_lafayette: { timing: "Whenever your hand becomes empty", effect: "Immediately draw 1 card." },
  vulture_sam: { timing: "Whenever another player is eliminated", effect: "Take all of that player's hand and equipment cards." },
  willy_the_kid: { timing: "Always active", effect: "You may play any number of BANG! cards during your turn." },
};

export default function StartInfoOverlay({
  open,
  role,
  characterKey,
  playerName,
  onSkip,
}: {
  open: boolean;
  role?: string | null;
  characterKey?: string | null;
  playerName?: string | null;
  onSkip: () => void;
}) {
  if (!open) return null;

  const roleKey = String(role ?? "unknown").toLowerCase();
  const roleImage = (["sheriff", "deputy", "outlaw", "renegade"].includes(roleKey)
    ? getRoleImage(roleKey as any)
    : null) as any;
  const charKey = String(characterKey ?? "").toLowerCase();
  const char = getCharacterSafe(charKey);
  const desc = CHARACTER_DESC[charKey];

  return (
    <View style={s.overlay} pointerEvents="auto">
      <View style={s.scrim} />
      <View style={s.panel}>
        <Text style={s.kicker}>ROUND START</Text>
        <Text style={s.title}>{playerName ? `${playerName}, know your role.` : "Know your role"}</Text>

        <View style={s.row}>
          <View style={s.roleCard}>
            <Text style={s.blockLabel}>ROLE</Text>
            {roleImage ? <Image source={roleImage} style={s.roleImage} resizeMode="contain" /> : null}
            <Text style={s.roleText}>{String(roleKey || "unknown").replace(/_/g, " ").toUpperCase()}</Text>
            <Text style={s.blockBody}>{ROLE_GOAL[roleKey] ?? "Stay alive and outplay the table."}</Text>
          </View>

          <View style={s.charCard}>
            <Text style={s.blockLabel}>CHARACTER</Text>
            {char?.image ? <Image source={char.image} style={s.charImage} resizeMode="contain" /> : null}
            <Text style={s.charText}>{char?.label ?? "Unknown Character"}</Text>
            <View style={s.tipBox}>
              <Text style={s.tipLabel}>WHEN</Text>
              <Text style={s.tipText}>{desc?.timing ?? "Use the right moment."}</Text>
            </View>
            <View style={s.tipBox}>
              <Text style={s.tipLabel}>EFFECT</Text>
              <Text style={s.tipText}>{desc?.effect ?? "Use your ability to gain tempo."}</Text>
            </View>
          </View>
        </View>

        <WoodButton title="Skip" onPress={onSkip} style={s.skipBtn} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.74)",
  },
  panel: {
    width: "100%",
    maxWidth: 820,
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(45,28,15,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,214,138,0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  kicker: {
    color: "#D9B36E",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    textAlign: "center",
  },
  title: {
    color: "#FFF3D7",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  roleCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  charCard: {
    flex: 1.25,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  blockLabel: {
    color: "#E8C27A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  roleImage: {
    width: 92,
    height: 92,
    marginBottom: 8,
  },
  roleText: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  charImage: {
    width: 156,
    height: 128,
    marginBottom: 6,
  },
  charText: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  blockBody: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 10,
    textAlign: "center",
  },
  tipBox: {
    width: "100%",
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tipLabel: {
    color: "#F2C67A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  tipText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  skipBtn: {
    alignSelf: "center",
    minWidth: 150,
    marginTop: 16,
  },
});
