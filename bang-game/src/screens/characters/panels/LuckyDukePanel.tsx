import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from "react-native";
import { getCardImage, CARD_BACK } from "../../../data/cardAssets";
import { CHARACTER_DETAILS } from "../index";

type LuckyOption = {
  id: string;
  key?: string;
  rank?: string;
  suit?: string;
  label?: string;
  name?: string;
};

function suitSymbol(suit?: string) {
  const s = String(suit ?? "").toLowerCase();
  if (s === "hearts") return "♥";
  if (s === "spades") return "♠";
  if (s === "diamonds") return "♦";
  if (s === "clubs") return "♣";
  return "?";
}

function suitColor(suit?: string) {
  const s = String(suit ?? "").toLowerCase();
  if (s === "hearts" || s === "diamonds") return "#ff5a5a";
  return "#f5f5f5";
}

function cardTitle(key?: string) {
  const k = String(key ?? "").toLowerCase();
  if (!k) return "Card";
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyCard(op: LuckyOption) {
  const r = String(op?.rank ?? "").toUpperCase();
  const sym = suitSymbol(op?.suit);
  const k = cardTitle(op?.key ?? op?.label ?? op?.name);
  return `${r}${sym} • ${k}`;
}

function predictSuccess(drawKind: string, chosen: LuckyOption) {
  const suit = String(chosen?.suit ?? "").toLowerCase();
  const rank = String(chosen?.rank ?? "").toUpperCase();
  const num =
    rank === "A" ? 1 :
    rank === "J" ? 11 :
    rank === "Q" ? 12 :
    rank === "K" ? 13 :
    Number(rank);

  if (drawKind === "barrel") return suit === "hearts";
  if (drawKind === "jourdonnais") return suit === "hearts";
  if (drawKind === "jail") return suit === "hearts";
  if (drawKind === "dynamite") {
    const explode = suit === "spades" && Number.isFinite(num) && num >= 2 && num <= 9;
    return !explode;
  }
  return false;
}

function LuckyRealCard({
  option,
  onPress,
  disabled,
  dimmed,
  flipDeg,
}: {
  option: LuckyOption;
  onPress: () => void;
  disabled?: boolean;
  dimmed?: boolean;
  flipDeg: Animated.AnimatedInterpolation<string>;
}) {
  const rank = String(option?.rank ?? "").toUpperCase() || "?";
  const suit = String(option?.suit ?? "").toLowerCase();
  const symbol = suitSymbol(suit);
  const color = suitColor(suit);
  const img = getCardImage(option);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.cardPress, dimmed && { opacity: 0.35 }]}
    >
      <Animated.View
        style={[
          styles.realCardWrap,
          {
            transform: [{ perspective: 900 }, { rotateY: flipDeg }],
          },
        ]}
      >
        <View style={styles.realCardFrame}>
          <Image source={img} style={styles.realCardImage} resizeMode="contain" />

          <View style={styles.cardBadgeTop}>
            <Text style={[styles.badgeRank, { color }]}>{rank}</Text>
            <Text style={[styles.badgeSuit, { color }]}>{symbol}</Text>
          </View>

          <View style={styles.cardBadgeBottom}>
            <Text style={[styles.badgeRank, { color }]}>{rank}</Text>
            <Text style={[styles.badgeSuit, { color }]}>{symbol}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function LuckyBackCard({
  spin,
}: {
  spin: Animated.AnimatedInterpolation<string>;
}) {
  return (
    <Animated.View style={[styles.realCardWrap, { transform: [{ rotateZ: spin }] }]}>
      <View style={styles.realCardFrame}>
        <Image source={CARD_BACK} style={styles.realCardImage} resizeMode="contain" />
        <View style={styles.backOverlay}>
          <Text style={styles.backTitle}>Lucky Duke</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export function LuckyDukePanel({
  pending,
  onSend,
}: {
  pending: any;
  onSend: (msg: any) => void;
}) {
  const options: LuckyOption[] = Array.isArray(pending?.options) ? pending.options : [];
  const drawKind = String(pending?.drawKind ?? "");
  const pendingEndsAt = Number(pending?.pendingEndsAt ?? 0);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [phase, setPhase] = useState<"spinning" | "revealed" | "picked">("spinning");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [localOutcome, setLocalOutcome] = useState<null | { ok: boolean; text: string }>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const spin1 = useRef(new Animated.Value(0)).current;
  const spin2 = useRef(new Animated.Value(0)).current;
  const flip1 = useRef(new Animated.Value(0)).current;
  const flip2 = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const spinLoop1 = useRef<Animated.CompositeAnimation | null>(null);
  const spinLoop2 = useRef<Animated.CompositeAnimation | null>(null);
  const glowLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const hasEnoughOptions = options.length >= 2;
  const key = useMemo(
    () => options.map((o) => o.id).join("|") + "|" + drawKind,
    [options, drawKind]
  );

  const rot1 = spin1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1080deg"] });
  const rot2 = spin2.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1080deg"] });

  const frontFlip1 = flip1.interpolate({ inputRange: [0, 1], outputRange: ["90deg", "0deg"] });
  const frontFlip2 = flip2.interpolate({ inputRange: [0, 1], outputRange: ["90deg", "0deg"] });

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });

  useEffect(() => {
    if (!hasEnoughOptions) {
      setPhase("spinning");
      setPickedId(null);
      setLocalOutcome(null);
      fade.setValue(0);
      spin1.setValue(0);
      spin2.setValue(0);
      flip1.setValue(0);
      flip2.setValue(0);
      glow.setValue(0);
      spinLoop1.current?.stop();
      spinLoop2.current?.stop();
      glowLoop.current?.stop();
      return;
    }

    setPhase("spinning");
    setPickedId(null);
    setLocalOutcome(null);

    fade.setValue(0);
    spin1.setValue(0);
    spin2.setValue(0);
    flip1.setValue(0);
    flip2.setValue(0);
    glow.setValue(0);

    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    glowLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.current.start();

    spinLoop1.current = Animated.loop(
      Animated.timing(spin1, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop2.current = Animated.loop(
      Animated.timing(spin2, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop1.current.start();
    spinLoop2.current.start();

    const t = setTimeout(() => {
      spinLoop1.current?.stop();
      spinLoop2.current?.stop();

      spin1.stopAnimation(() => spin1.setValue(0));
      spin2.stopAnimation(() => spin2.setValue(0));

      Animated.parallel([
        Animated.timing(flip1, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(flip2, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setPhase("revealed"));
    }, 1100);

    return () => {
      clearTimeout(t);
      spinLoop1.current?.stop();
      spinLoop2.current?.stop();
      glowLoop.current?.stop();
    };
  }, [fade, flip1, flip2, glow, hasEnoughOptions, key, spin1, spin2]);

  const choose = (op: LuckyOption) => {
    if (phase !== "revealed") return;
    if (pickedId) return;

    setPickedId(op.id);
    setPhase("picked");

    const ok = predictSuccess(drawKind, op);
    const text =
      drawKind === "barrel"
        ? ok
          ? "✅ Barrel succeeded"
          : "❌ Barrel failed"
        : drawKind === "jourdonnais"
          ? ok
            ? "✅ Jourdonnais succeeded"
            : "❌ Jourdonnais failed"
          : drawKind === "jail"
            ? ok
              ? "✅ Freed from Jail"
              : "❌ Stayed in Jail"
            : drawKind === "dynamite"
              ? ok
                ? "✅ Dynamite passed safely"
                : "💥 Dynamite exploded"
              : ok
                ? "✅ Success"
                : "❌ Failed";

    setLocalOutcome({ ok, text });
    onSend({ type: "choose_lucky_draw", cardId: op.id });
  };

  const secondsLeft =
    pendingEndsAt > 0 ? Math.max(0, Math.floor((pendingEndsAt - nowMs) / 1000)) : null;

  const kindLabel =
    drawKind === "barrel"
      ? "Barrel"
      : drawKind === "jourdonnais"
        ? "Jourdonnais"
        : drawKind === "jail"
          ? "Jail"
          : drawKind === "dynamite"
            ? "Dynamite"
            : "Lucky Draw";

  if (!hasEnoughOptions) {
    const details = CHARACTER_DETAILS.lucky_duke;
    return (
      <View style={styles.infoWrap}>
        <Text style={styles.infoDesc}>{details.effect}</Text>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>WHEN</Text>
          <Text style={styles.infoText}>{details.timing}</Text>
        </View>
        {details.hint ? <Text style={styles.infoHint}>{details.hint}</Text> : null}
      </View>
    );
  }

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]}>
      <View style={styles.header}>
        <Text style={styles.sub}>
          {phase === "spinning" ? `Drawing cards... (${kindLabel})` : `Choose one card (${kindLabel})`}
          {secondsLeft != null ? ` • ${secondsLeft}s` : ""}
        </Text>
      </View>

      <View style={styles.board}>
        <Animated.View style={[styles.shine, { opacity: glowOpacity }]} />

        <View style={styles.cardsRow}>
          <View style={styles.singleCardWrap}>
            {phase === "spinning" ? (
              <LuckyBackCard spin={rot1} />
            ) : (
              <LuckyRealCard
                option={options[0]}
                onPress={() => choose(options[0])}
                disabled={phase !== "revealed"}
                dimmed={!!pickedId && pickedId !== options[0].id}
                flipDeg={frontFlip1}
              />
            )}
            <Text style={styles.cardLabel}>{prettyCard(options[0])}</Text>
          </View>

          <View style={styles.singleCardWrap}>
            {phase === "spinning" ? (
              <LuckyBackCard spin={rot2} />
            ) : (
              <LuckyRealCard
                option={options[1]}
                onPress={() => choose(options[1])}
                disabled={phase !== "revealed"}
                dimmed={!!pickedId && pickedId !== options[1].id}
                flipDeg={frontFlip2}
              />
            )}
            <Text style={styles.cardLabel}>{prettyCard(options[1])}</Text>
          </View>
        </View>
      </View>

      {localOutcome && (
        <View style={[styles.outcomeBox, localOutcome.ok ? styles.okBox : styles.badBox]}>
          <Text style={styles.outcomeText}>{localOutcome.text}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  infoWrap: {
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  infoDesc: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 18 },
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
  infoHint: { color: "rgba(255,255,255,0.66)", marginTop: 8, fontSize: 11, lineHeight: 15 },
  wrap: {
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  header: {
    marginBottom: 12,
  },

  title: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },

  sub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    textAlign: "center",
  },

  board: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },

  shine: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,215,0,0.14)",
  },

  cardsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
  },

  singleCardWrap: {
    width: "47%",
    alignItems: "center",
  },

  cardPress: {
    width: "100%",
    alignItems: "center",
  },

  realCardWrap: {
    width: 128,
    height: 184,
  },

  realCardFrame: {
    width: 128,
    height: 184,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  realCardImage: {
    width: "100%",
    height: "100%",
  },

  backOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: "center",
  },

  backTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },

  cardBadgeTop: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
  },

  cardBadgeBottom: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    transform: [{ rotate: "180deg" }],
  },

  badgeRank: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 16,
  },

  badgeSuit: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 14,
  },

  cardLabel: {
    marginTop: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    minHeight: 34,
    paddingHorizontal: 4,
  },

  outcomeBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  okBox: {
    backgroundColor: "rgba(0,255,140,0.12)",
    borderColor: "rgba(0,255,140,0.25)",
  },

  badBox: {
    backgroundColor: "rgba(255,60,60,0.12)",
    borderColor: "rgba(255,60,60,0.25)",
  },

  outcomeText: {
    color: "#fff",
    fontWeight: "900",
    textAlign: "center",
  },
});