import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, FlatList, ImageBackground, StyleSheet, View } from "react-native";

import type { PublicPlayer } from "../../models/player";
import type { FxEvent } from "./FxLayer";
import { OpponentTile } from "./OpponentTile";

const OPPONENTS_BAR_BG = require("../../../assets/ui/opponents_bar_bg.png");

export function OpponentsRow({
  players,
  focusedId,
  fx,
  distanceById,
  turnPlayerId,
  respondingPlayerId,
  respondingLabel,
  onPressPlayer,
  onAnchor,
  targeting,
  activeTargetId,
  activeTargetLabel,
  statusById,
}: {
  players: PublicPlayer[];
  focusedId: string | null;
  fx: FxEvent[];
  distanceById?: Record<string, number>;
  turnPlayerId?: string | null;
  respondingPlayerId?: string | null;
  respondingLabel?: string | null;
  onPressPlayer: (id: string) => void;
  onAnchor?: (playerId: string, pt: { x: number; y: number }) => void;
  targeting?: boolean;
  activeTargetId?: string | null;
  activeTargetLabel?: string | null;
  statusById?: Record<string, string | undefined>;
}) {
  const list = useMemo(() => (Array.isArray(players) ? players : []), [players]);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);

    if (!targeting) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [targeting, pulse]);

  const compactListStyle = [
    s.list,
    list.length <= 3 ? s.listCompact : null,
  ];

  return (
    <View style={s.wrap}>
      <ImageBackground source={OPPONENTS_BAR_BG} resizeMode="stretch" imageStyle={s.bgImage} style={s.bg}>
        {targeting ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.targetGlow,
              {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.12, 0.35],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.995, 1.01],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}

        <FlatList
          horizontal
          data={list}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={compactListStyle}
          renderItem={({ item }) => (
            <OpponentTile
              player={item}
              focused={!targeting && focusedId === item.id}
              fx={fx}
              distance={distanceById ? distanceById[item.id] : undefined}
              isTurn={!!turnPlayerId && turnPlayerId === item.id}
              isResponder={!!respondingPlayerId && respondingPlayerId === item.id}
              responderLabel={respondingLabel ?? undefined}
              targeting={!!targeting}
              isTargeted={!!activeTargetId && activeTargetId === item.id}
              targetLabel={activeTargetLabel ?? undefined}
              statusLabel={statusById?.[item.id]}
              onPress={() => onPressPlayer(item.id)}
              onAnchor={onAnchor}
            />
          )}
        />
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop: 6,
    position: "relative",
    paddingHorizontal: 8,
  },
  bg: {
    minHeight: 128,
    paddingTop: 2,
    paddingBottom: 6,
    justifyContent: "center",
  },
  bgImage: {
    borderRadius: 18,
  },
  list: {
    minWidth: "100%",
    flexGrow: 1,
    paddingHorizontal: 12,
    gap: 15,
    paddingTop: -2,
    paddingBottom: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  listCompact: {
    justifyContent: "space-evenly",
  },
  targetGlow: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 10,
    bottom: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,210,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,245,190,0.18)",
  },
});