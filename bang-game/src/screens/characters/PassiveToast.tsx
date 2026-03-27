import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

function suitSymbol(suit?: any) {
  const s = String(suit ?? "").toLowerCase();
  if (s === "hearts") return "♥";
  if (s === "diamonds") return "♦";
  if (s === "spades") return "♠";
  if (s === "clubs") return "♣";
  return "";
}

function shortCard(card: any) {
  if (!card || typeof card !== "object") return "";
  const rank = String(card.rank ?? "").toUpperCase();
  const sym = suitSymbol(card.suit);
  return `${rank}${sym}`.trim();
}

function passiveText(msg: any) {
  const k = String(msg?.kind ?? "").toLowerCase();

  if (k.includes("blackjack_reveal")) {
    const shown = shortCard(msg?.revealed);
    return shown ? `Black Jack: revealed ${shown}` : "Black Jack: revealed second card";
  }

  if (k.includes("blackjack_bonus_draw")) return "Black Jack: ♥/♦ → drew 1 more";
  if (k.includes("suzy")) return "Suzy: drew a card (empty hand)";
  if (k.includes("bart")) return "Bart: drew a card (got hit)";
  if (k.includes("gringo")) return "El Gringo: took a card from attacker";
  if (k.includes("vulture")) return "Vulture Sam: collected cards from dead player";
  if (k.includes("jourd") || k.includes("barrel")) return "Jourdonnais: Draw! check";
  if (k.includes("black") || k.includes("jack")) return "Black Jack: bonus draw check";
  return `Passive: ${String(msg?.kind ?? "passive")}`;
}

export function PassiveToast({ lastPassive }: { lastPassive: any | null }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!lastPassive?.seq) return;
    setText(passiveText(lastPassive));
    const id = setTimeout(() => setText(null), 1900);
    return () => clearTimeout(id);
  }, [lastPassive?.seq]);

  if (!text) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.txt}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    zIndex: 999,
  },
  txt: { color: "white", fontWeight: "900", fontSize: 12 },
});
