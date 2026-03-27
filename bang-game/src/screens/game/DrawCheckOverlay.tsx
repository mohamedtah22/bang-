import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CARD_BACK, getCardImage } from "../../data/cardAssets";

const WOOD_BOARD = require("../../../assets/wood_board.png");
const RED_WOOD = require("../../../assets/red_wood_cracked.png");

type DrawCheckKind = "barrel" | "jourdonnais" | "jail" | "dynamite";

export type DrawCheckEvent = {
  type: "draw_check";
  roomCode?: string;
  kind: DrawCheckKind;
  playerId: string;
  playerName?: string;
  playerDisplayName?: string;
  name?: string;
  drawn: any[];
  chosen?: any | null;
  success?: boolean | null;
  exploded?: boolean;
  freed?: boolean;
  titleOverride?: string;
  hintOverride?: string;
};

function labelForKind(kind: DrawCheckKind) {
  if (kind === "dynamite") return "Dynamite";
  if (kind === "jail") return "Jail";
  if (kind === "barrel") return "Barrel";
  return "Jourdonnais";
}

function actorName(e: DrawCheckEvent) {
  const byName =
    String(e.playerName ?? "").trim() ||
    String(e.playerDisplayName ?? "").trim() ||
    String(e.name ?? "").trim();

  if (byName) return byName;
  return "Current player";
}

function titleText(e: DrawCheckEvent) {
  const actor = actorName(e);
  const label = labelForKind(e.kind);
  return `${actor} drew for ${label}`;
}

function resultText(e: DrawCheckEvent) {
  const actor = actorName(e);

  if (e.kind === "dynamite") {
    return e.exploded
      ? `${actor} exploded from Dynamite`
      : `${actor} passed the Dynamite safely`;
  }

  if (e.kind === "jail") {
    return e.freed
      ? `${actor} escaped Jail`
      : `${actor} stayed in Jail`;
  }

  if (e.kind === "barrel") {
    return e.success
      ? `${actor} dodged with Barrel`
      : `${actor} failed the Barrel check`;
  }

  return e.success
    ? `${actor} dodged with Jourdonnais`
    : `${actor} failed the Jourdonnais check`;
}

function sameCard(a: any, b: any) {
  if (!a || !b) return false;
  const aid = String(a?.id ?? a?.cardId ?? "");
  const bid = String(b?.id ?? b?.cardId ?? "");
  if (aid && bid) return aid === bid;

  return (
    String(a?.key ?? a?.name ?? "") === String(b?.key ?? b?.name ?? "") &&
    String(a?.rank ?? "") === String(b?.rank ?? "") &&
    String(a?.suit ?? "") === String(b?.suit ?? "")
  );
}

function pickIdx(e: DrawCheckEvent) {
  if (!e.chosen || !Array.isArray(e.drawn)) return -1;
  return e.drawn.findIndex((c) => sameCard(c, e.chosen));
}

function cardSig(card: any) {
  if (!card) return "";
  return [
    String(card?.id ?? card?.cardId ?? card?.key ?? card?.name ?? ""),
    String(card?.rank ?? ""),
    String(card?.suit ?? ""),
    String(card?.weaponKey ?? card?.weaponName ?? ""),
  ].join("|");
}

function getFaceSource(card: any) {
  return getCardImage(card) ?? getCardImage(card?.key) ?? getCardImage(card?.name) ?? CARD_BACK;
}

export function DrawCheckOverlay({
  event,
  onDone,
}: {
  event: DrawCheckEvent | null;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const deal = useRef(new Animated.Value(0)).current;
  const panelRise = useRef(new Animated.Value(16)).current;

  const lastEventId = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  const cards = useMemo(() => {
    const drawn = Array.isArray(event?.drawn) ? event!.drawn.slice(0, 2) : [];
    if (drawn.length > 0) return drawn;
    return event?.chosen ? [event.chosen] : [];
  }, [event]);

  const chosenIdx = useMemo(() => {
    if (!event || cards.length <= 1) return -1;
    return pickIdx({ ...event, drawn: cards } as any);
  }, [cards, event]);

  const finishClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(panelRise, {
        toValue: 10,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      lastEventId.current = null;
      closingRef.current = false;
      onDone();
    });
  }, [fade, onDone, panelRise]);

  useEffect(() => {
    if (!event) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastEventId.current = null;
      closingRef.current = false;
      setVisible(false);
      return;
    }

    const currentId = [
      String((event as any)?._localId ?? ""),
      event.playerId,
      event.kind,
      String(event.success ?? ""),
      String(event.exploded ?? ""),
      String(event.freed ?? ""),
      ...(Array.isArray(event.drawn) ? event.drawn.map(cardSig) : []),
      cardSig(event?.chosen),
    ].join("__");

    if (lastEventId.current === currentId) return;
    lastEventId.current = currentId;

    closingRef.current = false;
    setVisible(true);

    fade.stopAnimation();
    deal.stopAnimation();
    panelRise.stopAnimation();

    fade.setValue(0);
    deal.setValue(0);
    panelRise.setValue(16);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(panelRise, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(deal, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.back(1.08)),
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => {
      finishClose();
    }, 4500);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [deal, event, fade, finishClose, panelRise]);

  if (!event || !visible) return null;

  const title = event.titleOverride || titleText(event);
  const res = resultText(event);

  return (
    <Animated.View style={[s.overlay, { opacity: fade }]}>
      <Animated.View
        style={[
          s.panelWrap,
          {
            transform: [{ translateY: panelRise }],
          },
        ]}
      >
        <View style={s.board}>
          <Image source={WOOD_BOARD} resizeMode="cover" style={s.boardTexture} />
          <View style={s.boardShade} />

          <View style={s.topMeta}>
            <Text style={s.kicker}>DRAW CHECK</Text>
          </View>

          <Text style={s.title}>{title}</Text>
          {!!res ? <Text style={s.result}>{res}</Text> : null}

          <View style={s.cardsStage}>
            {cards.map((c, idx) => (
              <DealtCard
                key={`${idx}_${String(c?.id ?? idx)}`}
                card={c}
                idx={idx}
                count={cards.length}
                deal={deal}
                highlight={cards.length > 1 && idx === chosenIdx}
              />
            ))}
          </View>

          {chosenIdx >= 0 && cards.length > 1 ? <Text style={s.chosenBadge}>Chosen card</Text> : null}

          <Pressable onPress={finishClose} style={({ pressed }) => [s.skipBtn, pressed ? s.skipBtnPressed : null]}>
            <ImageBackground source={RED_WOOD} resizeMode="stretch" imageStyle={s.skipBtnBg} style={s.skipBtnInner}>
              <Text style={s.skipBtnText}>Close</Text>
            </ImageBackground>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function DealtCard({
  card,
  idx,
  count,
  deal,
  highlight,
}: {
  card: any;
  idx: number;
  count: number;
  deal: Animated.Value;
  highlight: boolean;
}) {
  const spread = count <= 1 ? 0 : idx === 0 ? -82 : 82;

  const dx = deal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spread],
  });

  const dy = deal.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 0],
  });

  const sc = deal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  const rot = deal.interpolate({
    inputRange: [0, 1],
    outputRange: [idx === 0 ? "8deg" : "-8deg", "0deg"],
  });

  const glow = useRef(new Animated.Value(highlight ? 0.35 : 0)).current;

  useEffect(() => {
    glow.stopAnimation();

    if (!highlight) {
      glow.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.62,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.18,
          duration: 480,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [glow, highlight]);

  return (
    <Animated.View
      style={[
        s.dealtWrap,
        {
          transform: [{ translateX: dx }, { translateY: dy }, { scale: sc }, { rotate: rot }],
        },
      ]}
    >
      <View style={[s.cardOuter, highlight ? s.cardHighlight : null]}>
        <Image source={getFaceSource(card)} style={s.cardImg} resizeMode="stretch" />
        {highlight ? (
          <>
            <Animated.View pointerEvents="none" style={[s.highlightGlow, { opacity: glow }]} />
            <View style={s.checkMark}>
              <Text style={s.checkText}>✓</Text>
            </View>
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3000,
    elevation: 3000,
    paddingHorizontal: 18,
  },
  panelWrap: {
    width: 380,
    maxWidth: "96%",
  },
  board: {
    width: "100%",
    minHeight: 410,
    borderRadius: 24,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 18,
    overflow: "hidden",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(90,55,25,0.28)",
    backgroundColor: "rgba(85,60,35,0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 18,
    position: "relative",
  },
  boardTexture: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    width: undefined,
    height: undefined,
    opacity: 1,
  },
  boardShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(40,25,12,0.2)",
  },
  topMeta: {
    width: "100%",
    alignItems: "center",
    marginBottom: 8,
  },
  kicker: {
    color: "#F4D39A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#fff8ee",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },
  result: {
    marginTop: 8,
    color: "#FFE7B8",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 10,
  },
  cardsStage: {
    width: "100%",
    minHeight: 220,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  dealtWrap: {
    position: "absolute",
  },
  cardOuter: {
    width: 126,
    height: 185,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardHighlight: {
    borderColor: "#FFD980",
    shadowColor: "#FFD980",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  cardImg: {
    width: "100%",
    height: "100%",
  },
  highlightGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,220,120,0.28)",
  },
  checkMark: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(16,95,45,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  chosenBadge: {
    marginTop: 8,
    color: "#F6D89B",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  skipBtn: {
    width: 170,
    height: 48,
    marginTop: 18,
  },
  skipBtnPressed: {
    transform: [{ translateY: 2 }, { scale: 0.985 }],
  },
  skipBtnInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(30,10,0,0.85)",
  },
  skipBtnBg: {
    borderRadius: 4,
  },
  skipBtnText: {
    color: "#FFF0D0",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});