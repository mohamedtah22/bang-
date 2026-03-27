import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  ImageBackground,
} from "react-native";

import type { Card } from "../../models/card";
import type { MePlayer } from "../../models/player";
import { getCardImage, CARD_BACK } from "../../data/cardAssets";
import  WoodButton  from "./WoodButton";

const { width: W } = Dimensions.get("window");


const PLAY_WOOD = require("../../../assets/red_wood_cracked.png");

function keyOf(card: any) {
  return String(card?.key ?? card?.name ?? "").toLowerCase();
}

function HandCard({
  card,
  active,
  dimmed,
  onSelect,
  onPreview,
}: {
  card: Card;
  active: boolean;
  dimmed?: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  // keep the selected card "tilted"
  const sel = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(sel, {
      toValue: active ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [active, sel]);

  const pressIn = () => {
    Animated.spring(scale, { toValue: 1.06, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const src = getCardImage(card as any) ?? CARD_BACK;

  return (
    <Pressable
      onPress={onSelect}
      onLongPress={onPreview}
      delayLongPress={220}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[s.cardWrap, dimmed && { opacity: 0.35 }]}
    >
      <Animated.View
        style={[
          s.cardFrame,
          active && { zIndex: 10, elevation: 10 },
          {
            transform: [
              { translateY: sel.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
              { translateX: sel.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
              { rotate: sel.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-10deg"] }) },
            ],
          },
        ]}
      >
        <Animated.Image
          source={src as any}
          resizeMode="contain"
          style={[
            s.cardImg,
            {
              transform: [
                { scale },
                { scale: sel.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
              ],
            },
          ]}
        />
        {active ? <View pointerEvents="none" style={s.selectedOverlay} /> : null}
      </Animated.View>
    </Pressable>
  );
}

type HandBarProps = {
  me: MePlayer | null;
  selectedCardId: string | null;
  onPressCard: (c: Card) => void;

  hint?: string;
  multiSelectedIds?: Set<string>;

  // messages فوق الهاند
  messages?: string[];

  // play button
  playEnabled?: boolean;
  playLabel?: string;
  onPlay?: () => void;

  // respond mode
  mode?: "play" | "respond";
  allowedKeys?: string[];

  // ✅ take hit button (للـ respond) بدل PASS
  onTakeHit?: () => void;
  takeHitLabel?: string;

  // ✅ report "me" anchor for FX lines
  onMeAnchor?: (pt: { x: number; y: number }) => void;
};

export function HandBar({
  me,
  selectedCardId,
  onPressCard,
  hint,
  multiSelectedIds,
  messages,
  playEnabled,
  playLabel,
  onPlay,
  mode = "play",
  allowedKeys,
  onTakeHit,
  takeHitLabel = "TAKE HIT",
  onMeAnchor,
}: HandBarProps) {
  const [preview, setPreview] = useState<Card | null>(null);
  const wrapRef = useRef<View>(null);

  const cards = me?.hand ?? [];
  const title = useMemo(() => " ", []);

  // Normalize allowed keys.
  const allowedSet = useMemo(() => {
    if (!allowedKeys?.length) return null;
    return new Set(allowedKeys.map((k) => String(k).toLowerCase()));
  }, [allowedKeys]);

  // The play button should light up only when the current selection is actually ready.
  const glowState = useMemo<"off" | "ready">(() => {
    return playEnabled ? "ready" : "off";
  }, [playEnabled]);

  // Pulse animation for the ready state only.
  const pulse = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (glowState === "off") {
      loopRef.current?.stop();
      loopRef.current = null;
      pulse.setValue(0);
      return;
    }

    loopRef.current?.stop();
    pulse.setValue(0);

    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
    };
  }, [glowState, pulse]);

  if (!me) return null;

  const label = playLabel ?? (mode === "respond" ? "USE" : "PLAY");

  return (
    <View
      ref={wrapRef}
      style={s.wrap}
      onLayout={() => {
        if (!onMeAnchor || !me?.id) return;
        // measure on next frame so layout is final
        requestAnimationFrame(() => {
          wrapRef.current?.measureInWindow?.((x, y, w, h) => {
            onMeAnchor({ x: x + w / 2, y: y + h / 2 });
          });
        });
      }}
    >
      <View style={s.topRow}>
        <Text style={s.title}>{title}</Text>

        {hint ? (
          <Text style={s.hint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}

      </View>

      {/* Status messages above the hand. */}
      {!!messages?.length && (
        <View pointerEvents="none" style={s.msgWrap}>
          {messages.slice(0, 2).map((m, i) => (
            <View key={i} style={s.msgBubble}>
              <Text style={s.msgText}>{m}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons above the hand. */}
      <View style={s.btnRow}>
        {/* TAKE HIT appears only during response mode. */}
        {mode === "respond" && onTakeHit ? (
          <WoodButton title={takeHitLabel} onPress={onTakeHit} style={s.hitBtn} />
        ) : null}

        {/* Play button. */}
        <Pressable
          onPress={playEnabled ? onPlay : undefined}
          disabled={!playEnabled}
          style={({ pressed }) => [s.playOuter, pressed && playEnabled ? s.playOuterPressed : null]}
        >
          <ImageBackground
            source={PLAY_WOOD}
            resizeMode="cover"
            style={[
              s.playBtn,
              glowState === "off" && s.playBtnOff,
              glowState === "ready" && s.playBtnReady,
              !playEnabled && s.playBtnDisabled,
            ]}
            imageStyle={s.playImg}
          >
            {/* Dim the button while it is not ready. */}
            {glowState === "off" ? <View pointerEvents="none" style={s.playDim} /> : null}

            {/* Soft pulse while the action is ready. */}
            {glowState !== "off" ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  s.playPulseRing,
                  {
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }),
                    transform: [
                      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
                    ],
                  },
                ]}
              />
            ) : null}

            {/* Button text. */}
            <Text
              style={[
                s.playText,
                glowState === "off" && s.playTextOff,
                glowState !== "off" && s.playTextOn,
              ]}
            >
              {label}
            </Text>
          </ImageBackground>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={cards}
        keyExtractor={(c: any) => String(c.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const id = String((item as any).id);
          const active = selectedCardId === id || !!multiSelectedIds?.has(id);

          const k = keyOf(item);
          const allowed = !allowedSet || allowedSet.has(k);

          const dimmed = mode === "respond" && !!allowedSet && !allowed;

          return (
            <HandCard
              card={item}
              active={active}
              dimmed={dimmed}
              onSelect={() => {
                if (multiSelectedIds) {
                  onPressCard(item);
                  return;
                }
                if (mode === "respond" && allowedSet && !allowed) return;
                onPressCard(item);
              }}
              onPreview={() => setPreview(item)}
            />
          );
        }}
      />

      {/* Preview Modal */}
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setPreview(null)}>
          <View style={s.modalCard}>
            <Animated.Image
              source={(preview ? getCardImage(preview as any) ?? CARD_BACK : CARD_BACK) as any}
              resizeMode="contain"
              style={s.previewImg}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 8, marginTop: 2, position: "relative" },
  topRow: { paddingHorizontal: 12, marginBottom: 6, gap: 2 },
  title: { color: "white", fontWeight: "900" },
  hint: { color: "rgba(255,255,255,0.72)", fontSize: 12 },
  help: { color: "rgba(255,255,255,0.45)", fontSize: 11 },

  list: { paddingHorizontal: 12, paddingBottom: 8, gap: 12 },

  cardWrap: { paddingVertical: 2 },

  cardFrame: {
    width: 98,
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
  },

  cardImg: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: "rgba(255,230,130,0.75)",
    borderRadius: 14,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.70)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: Math.min(W - 40, 360),
    height: 520,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  previewImg: { width: "100%", height: 520, borderRadius: 14 },

  // messages
  msgWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 8,
    alignItems: "center",
    gap: 6,
  },
  msgBubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  msgText: { color: "rgba(255,255,255,0.92)", fontWeight: "800", fontSize: 12 },

  // Action buttons live in normal layout so they do not cover the cards.
  btnRow: {
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  // ✅ take hit
  hitBtn: {
    minWidth: 118,
  },

  // ✅ PLAY button (wood)
  playOuter: {
    borderRadius: 3,
    overflow: "visible",
  },
  playOuterPressed: {
    transform: [{ translateY: 5 }],
  },

  playBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 3,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(30,10,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 102,
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  playImg: {
    borderRadius: 3,
  },

  // off
  playBtnOff: {
    borderColor: "rgba(0,0,0,0.6)",
  },
  playDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  // Selected style kept available for future use.
  playBtnSelected: {
    borderColor: "rgba(255,190,120,0.55)",
    shadowColor: "#ffb36a",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },

  // ready (جاهز للعب فعلاً)
  playBtnReady: {
    borderColor: "rgba(255,230,130,0.85)",
    shadowColor: "#ffd27a",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 10,
  },

  playBtnDisabled: {
    opacity: 0.65,
  },

  playPulseRing: {
    position: "absolute",
    left: -8,
    right: -8,
    top: -6,
    bottom: -6,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: "rgba(255,220,150,0.55)",
  },

  playText: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.8,
  },
  playTextOff: {
    color: "rgba(255,255,255,0.7)",
  },
  playTextOn: {
    color: "white",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
});