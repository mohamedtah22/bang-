import React, { useEffect, useMemo, useRef, memo } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View, Platform } from "react-native";
import { CARD_BACK, getCardImage } from "../../data/cardAssets";

// --- Config & Constants ---
const CARD_W = 62; 
const CARD_H = 88;
const FLIGHT_DURATION = 750;

export type DrawMotionEvent = {
  id: string;
  at: number;
  fromId: string;
  toId: string;
  delayMs?: number;
  faceUpCard?: any | null;
  label?: string | null;
};

export const DrawMotionLayer = memo(({ items, anchors, onDone }: {
  items: DrawMotionEvent[];
  anchors: Record<string, { x: number; y: number }>;
  onDone?: (id: string) => void;
}) => {
  const visible = useMemo(() => (Array.isArray(items) ? items.slice(-10) : []), [items]);

  return (
    <View pointerEvents="none" style={s.root}>
      {visible.map((item) => (
        <FlyingCard key={item.id} item={item} anchors={anchors} onDone={onDone} />
      ))}
    </View>
  );
});

function FlyingCard({ item, anchors, onDone }: {
  item: DrawMotionEvent;
  anchors: Record<string, { x: number; y: number }>;
  onDone?: (id: string) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  
  const coords = useRef(useMemo(() => {
    const start = anchors[item.fromId];
    const end = anchors[item.toId];
    if (!start || !end) return null;
    return { sx: start.x, sy: start.y, ex: end.x, ey: end.y };
  }, [item.fromId, item.toId, anchors])).current;

  useEffect(() => {
    if (!coords) return;

    const run = () => {
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: FLIGHT_DURATION,
          easing: Easing.bezier(0.2, 0, 0.3, 1), 
          useNativeDriver: true,
        }),
        Animated.timing(anim, { 
          toValue: 1.1, 
          duration: 150,
          useNativeDriver: true,
        })
      ]).start(() => onDone?.(item.id));
    };

    const timer = setTimeout(run, item.delayMs ?? 0);
    return () => {
      clearTimeout(timer);
      anim.stopAnimation();
    };
  }, [coords, item.id]);

  if (!coords) return null;

 
  
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [coords.sx - CARD_W / 2, coords.ex - CARD_W / 2],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [
      coords.sy - CARD_H / 2, 
      coords.sy - CARD_H / 2 - 60, 
      coords.ey - CARD_H / 2
    ],
  });

  
  const isMovingRight = coords.ex > coords.sx;
  const rotate = anim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [
      "0deg", 
      isMovingRight ? "8deg" : "-8deg", 
      isMovingRight ? "-2deg" : "2deg", 
      "0deg"
    ],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.85, 1.15, 1], 
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.9, 1, 1.1],
    outputRange: [0, 1, 1, 0.8, 0],
  });

  const imgSrc = item.faceUpCard ? getCardImage(item.faceUpCard) ?? CARD_BACK : CARD_BACK;

  return (
    <Animated.View style={[s.cardWrap, { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}>
      
      <Animated.View style={[s.shadow, {
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 25, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.8, 1] }) }
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.1, 0.3] })
      }]} />

      <View style={s.cardContainer}>
        <Image source={imgSrc as any} style={s.card} resizeMode="stretch" />
        
        <Animated.View
          style={[
            s.gloss,
            {
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-36, CARD_W + 36],
                  }),
                },
                { rotate: "18deg" },
              ],
            },
          ]}
        />
      </View>

      {item.label && (
        <View style={s.labelWrap}>
          <Text style={s.labelText}>{item.label}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  cardWrap: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
        android: { elevation: 20 }
    })
  },
  cardContainer: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a1a12',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  card: {
    width: "100%",
    height: "100%",
  },
  shadow: {
    position: 'absolute',
    width: CARD_W * 0.9,
    height: CARD_H * 0.9,
    backgroundColor: 'black',
    borderRadius: 8,
    bottom: -10,
    zIndex: -1,
  },
  gloss: {
    position: 'absolute',
    width: 22,
    height: CARD_H + 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -7,
    left: -10,
  },
  labelWrap: {
    position: 'absolute',
    bottom: -25,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.5)", 
  },
  labelText: {
    color: "#ffd700",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});