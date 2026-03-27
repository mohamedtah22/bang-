// src/screens/game/OpponentTile.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, ImageBackground, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { PublicPlayer } from "../../models/player";
import type { FxEvent } from "./FxLayer";
import { getCharacterSafe } from "../../models/characters";
import { getCardImage, CARD_BACK } from "../../data/cardAssets";

const OPPONENT_TILE_BG = require("../../../assets/ui/opponent_tile_bg.png");

const { width: SCREEN_W } = Dimensions.get("window");

function initials(name?: string) {
  const s = String(name ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0] ?? "").slice(0, 1).toUpperCase();
  const b = (parts[1] ?? "").slice(0, 1).toUpperCase();
  return (a + b) || a || "?";
}

function keyOfFx(x: any) {
  return String(x?.kind ?? "").toLowerCase().trim();
}

function lastFxForTarget(playerId: string, fx: FxEvent[]) {
  const now = Date.now();
  const pid = String(playerId);
  for (let i = fx.length - 1; i >= 0; i--) {
    const e: any = fx[i];
    const tid = String(e?.targetId ?? "");
    if (tid && tid === pid && now - (e?.at ?? 0) < 900) return keyOfFx(e);
  }
  return null;
}

function lastFxFromPlayer(playerId: string, fx: FxEvent[]) {
  const now = Date.now();
  const pid = String(playerId);
  for (let i = fx.length - 1; i >= 0; i--) {
    const e: any = fx[i];
    const fromId = String(e?.fromId ?? "");
    if (fromId && fromId === pid && now - (e?.at ?? 0) < 1500) return keyOfFx(e);
  }
  return null;
}

function cardKey(c: any) {
  return String(c?.key ?? c?.name ?? "").toLowerCase();
}

type WeaponVisual = "" | "weapon" | "volcanic" | "schofield" | "remington" | "rev_carabine" | "winchester";

function normalizeWeaponVisual(raw: any): WeaponVisual {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, "_");

  if (!s) return "";
  if (s === "weapon") return "weapon";
  if (s === "volcanic") return "volcanic";
  if (s === "schofield") return "schofield";
  if (s === "remington") return "remington";
  if (s === "rev_carabine" || s === "revcarabine" || s === "carabine") return "rev_carabine";
  if (s === "winchester") return "winchester";
  return "";
}

function weaponVisualKeyOf(card: any) {
  const direct = normalizeWeaponVisual(card?.weaponKey ?? card?.weaponName ?? card?.name ?? card?.key ?? "");
  if (direct && direct !== "weapon") return `weapon:${direct}`;

  const key = cardKey(card);
  const fromKey = normalizeWeaponVisual(key);
  if (fromKey && fromKey !== "weapon") return `weapon:${fromKey}`;

  if (direct === "weapon" || fromKey === "weapon") {
    const range = Number(card?.range ?? 0);
    if (range === 1) return "weapon:volcanic";
    if (range === 2) return "weapon:schofield";
    if (range === 3) return "weapon:remington";
    if (range === 4) return "weapon:rev_carabine";
    if (range === 5) return "weapon:winchester";
    return "weapon:unknown";
  }

  return "";
}

function isBangHitFx(k?: string | null) {
  return k === "bang_hit" || k === "explosion";
}

function isShieldFx(k?: string | null) {
  return k === "shield";
}

function isJailLockFx(k?: string | null) {
  return k === "jail_lock";
}

function isBeerGlowFx(k?: string | null) {
  return k === "beer_glow" || k === "beer" || k === "beer_heal" || k === "heal";
}

function equipmentSlotsForCount(count: number) {
  const clamped = Math.max(0, Math.min(5, count));
  const slots: Array<{ right: number; top: number; zIndex: number }> = [];

  for (let i = 0; i < clamped; i++) {
    slots.push({
      right: -4,
      top: 8 + i * 16,
      zIndex: 12 + i,
    });
  }

  return slots;
}

type Props = {
  player: PublicPlayer;
  focused: boolean;
  fx: FxEvent[];
  distance?: number;
  isTurn?: boolean;
  isResponder?: boolean;
  responderLabel?: string;
  targeting?: boolean;
  isTargeted?: boolean;
  targetLabel?: string;
  statusLabel?: string;
  onPress: () => void;
  onAnchor?: (playerId: string, pt: { x: number; y: number }) => void;
};

export function OpponentTile({
  player,
  focused,
  fx,
  distance,
  isTurn,
  isResponder,
  responderLabel,
  targeting,
  isTargeted,
  targetLabel,
  statusLabel,
  onPress,
  onAnchor,
}: Props) {
  const id = String(player?.id ?? "");
  const targetFx = useMemo(() => lastFxForTarget(id, fx), [id, fx]);
  const sourceFx = useMemo(() => lastFxFromPlayer(id, fx), [id, fx]);

  const wrapRef = useRef<View | null>(null);

  const reportAnchor = useCallback(() => {
    if (!onAnchor) return;
    requestAnimationFrame(() => {
      wrapRef.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
        onAnchor(id, { x: x + w / 2, y: y + h / 2 });
      });
    });
  }, [id, onAnchor]);

  const scale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const boom = useRef(new Animated.Value(0)).current;

  const hitFlash = useRef(new Animated.Value(0)).current;
  const healFlash = useRef(new Animated.Value(0)).current;
  const shieldFloat = useRef(new Animated.Value(0)).current;
  const healFloat = useRef(new Animated.Value(0)).current;
  const targetPulse = useRef(new Animated.Value(0)).current;
  const castPulse = useRef(new Animated.Value(0)).current;
  const responderPulse = useRef(new Animated.Value(0)).current;
  const hourglassPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    boom.stopAnimation();
    shake.stopAnimation();
    scale.stopAnimation();

    if (isShieldFx(targetFx)) {
      scale.setValue(1);
      shieldFloat.setValue(0);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(shieldFloat, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.delay(280),
        Animated.timing(shieldFloat, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }

    if (isJailLockFx(targetFx)) {
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.98, duration: 90, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 140, useNativeDriver: true }),
      ]).start();
    }

    if (isBangHitFx(targetFx)) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start();

      hitFlash.setValue(0);
      Animated.sequence([
        Animated.timing(hitFlash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(hitFlash, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();

      if (targetFx === "explosion") {
        boom.setValue(0);
        Animated.sequence([
          Animated.timing(boom, { toValue: 1, duration: 240, useNativeDriver: true }),
          Animated.timing(boom, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]).start();
      }
    }

    if (isBeerGlowFx(targetFx)) {
      healFlash.setValue(0);
      healFloat.setValue(0);
      Animated.sequence([
        Animated.timing(healFlash, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(healFlash, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(healFloat, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(320),
        Animated.timing(healFloat, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    }
  }, [targetFx, boom, shake, scale, hitFlash, healFlash, shieldFloat, healFloat]);

  useEffect(() => {
    targetPulse.stopAnimation();
    targetPulse.setValue(0);
    if (!isTargeted) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(targetPulse, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(targetPulse, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isTargeted, targetPulse]);

  useEffect(() => {
    responderPulse.stopAnimation();
    responderPulse.setValue(0);
    if (!isResponder) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(responderPulse, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(responderPulse, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isResponder, responderPulse]);

  useEffect(() => {
    hourglassPulse.stopAnimation();
    hourglassPulse.setValue(0);
    if (!isResponder) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hourglassPulse, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(hourglassPulse, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isResponder, hourglassPulse]);

  const showIndiansCast = sourceFx === "indians_start";

  useEffect(() => {
    castPulse.stopAnimation();
    castPulse.setValue(0);
    if (!showIndiansCast) return;

    Animated.sequence([
      Animated.timing(castPulse, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.delay(620),
      Animated.timing(castPulse, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]).start();
  }, [showIndiansCast, castPulse]);

  const tx = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  const charKey = String((player as any)?.playcharacter ?? "");
  const char = getCharacterSafe(charKey) ?? getCharacterSafe("bart_cassidy");
  const avatarSource = (char as any)?.image ?? null;

  const equip = useMemo(
    () => (Array.isArray((player as any)?.equipment) ? (player as any).equipment : []),
    [player]
  );

  const sideCards = useMemo(() => {
    const seen = new Set<string>();
    const raw: any[] = [];

    const visualKeyOf = (card: any) => {
      const weaponVisual = weaponVisualKeyOf(card);
      if (weaponVisual) return weaponVisual;
      return cardKey(card);
    };

    const sortKeyOf = (card: any) => {
      const weaponVisual = weaponVisualKeyOf(card);
      if (weaponVisual) return "weapon";
      return cardKey(card);
    };

    const pushUnique = (card: any) => {
      if (!card) return;
      const visualKey = visualKeyOf(card);
      if (!visualKey) return;
      if (seen.has(visualKey)) return;
      seen.add(visualKey);
      raw.push(card);
    };

    const wk = normalizeWeaponVisual((player as any)?.weaponKey);
    if (wk && wk !== "weapon") {
      pushUnique({ key: "weapon", weaponKey: wk });
    }

    for (const card of equip) {
      pushUnique(card);
    }

    const order: Record<string, number> = {
      weapon: 0,
      barrel: 1,
      mustang: 2,
      scope: 3,
      jail: 4,
      dynamite: 5,
    };

    return raw
      .filter((c: any) => !!getCardImage(c))
      .sort((a: any, b: any) => {
        const ak = sortKeyOf(a);
        const bk = sortKeyOf(b);
        return (order[ak] ?? 50) - (order[bk] ?? 50);
      })
      .slice(0, 5);
  }, [equip, player]);

  const equipmentSlots = useMemo(() => equipmentSlotsForCount(sideCards.length), [sideCards.length]);
  const isSheriff = String((player as any)?.role ?? "").toLowerCase() === "sheriff";
  const isDead = (player as any)?.isAlive === false;
  const isDisconnected = !!(player as any)?.disconnected;

  const responderText = responderLabel || "RESPOND";
  const [previewSource, setPreviewSource] = useState<any | null>(null);

  return (
    <View ref={wrapRef} collapsable={false} onLayout={reportAnchor}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.tile,
          focused && !targeting ? s.tileFocused : null,
          isTurn ? s.tileTurn : null,
          isResponder ? s.tileResponder : null,
          isTargeted ? s.tileTargeted : null,
          isDead ? s.tileDead : null,
          isDisconnected ? s.tileDisconnected : null,
          pressed ? s.tilePressed : null,
        ]}
      >
        <Animated.View style={[s.inner, { transform: [{ translateX: tx }, { scale }] }]}>
          <View style={s.boardWrap}>
            <ImageBackground source={OPPONENT_TILE_BG} resizeMode="stretch" style={s.boardBg} imageStyle={s.boardBgImage}>
              <Animated.View
                pointerEvents="none"
                style={[
                  s.flash,
                  { opacity: hitFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
                  s.flashRed,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  s.flash,
                  { opacity: healFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.68] }) },
                  s.flashGreen,
                ]}
              />

              {isTargeted ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.targetRing,
                    {
                      opacity: targetPulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.9] }),
                      transform: [{ scale: targetPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }],
                    },
                  ]}
                />
              ) : null}

              {isResponder ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.responderRing,
                    {
                      opacity: responderPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.95] }),
                      transform: [{ scale: responderPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
                    },
                  ]}
                />
              ) : null}

              <Animated.View
                pointerEvents="none"
                style={[
                  s.boom,
                  {
                    opacity: boom,
                    transform: [{ scale: boom.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.25] }) }],
                  },
                ]}
              />

              <View style={[s.avatarArea, isDead || isDisconnected ? s.avatarWrapDim : null]}>
                <View style={s.cardZone}>
                  {sideCards.length ? (
                    <View style={s.equipmentLayer}>
                      {sideCards.map((card: any, index: number) => {
                        const src = getCardImage(card) ?? CARD_BACK;
                        return (
                          <Pressable
                            key={`equip_${cardKey(card)}_${index}`}
                            onPress={(e) => {
                              e.stopPropagation();
                              setPreviewSource(src as any);
                            }}
                            hitSlop={6}
                            style={[s.equipmentCardWrap, equipmentSlots[index]]}
                          >
                            <Image source={src as any} style={s.equipmentCard} resizeMode="cover" />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  <View style={s.avatarWrap}>
                    {avatarSource ? (
                      <Image source={avatarSource as any} style={s.avatar} resizeMode="contain" />
                    ) : (
                      <View style={[s.avatar, s.avatarFallback]}>
                        <Text style={s.avatarText}>{initials((player as any)?.name)}</Text>
                      </View>
                    )}
                  </View>

                  {isSheriff ? (
                    <View style={s.roleBadge}>
                      <Text style={s.roleBadgeText}>★</Text>
                    </View>
                  ) : null}

                  {showIndiansCast ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        s.castBadge,
                        {
                          opacity: castPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                          transform: [
                            { translateY: castPulse.interpolate({ inputRange: [0, 1], outputRange: [10, -4] }) },
                            { scale: castPulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.08] }) },
                          ],
                        },
                      ]}
                    >
                      <Text style={s.castBadgeEmoji}>🪶</Text>
                    </Animated.View>
                  ) : null}

                  {isResponder ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        s.hourglassBadge,
                        {
                          opacity: hourglassPulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
                          transform: [{ scale: hourglassPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.1] }) }],
                        },
                      ]}
                    >
                      <Text style={s.hourglassText}>⏳</Text>
                    </Animated.View>
                  ) : null}

                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.floatBadge,
                      s.floatShieldBadge,
                      {
                        opacity: shieldFloat.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                        transform: [
                          { translateY: shieldFloat.interpolate({ inputRange: [0, 1], outputRange: [8, -14] }) },
                          { scale: shieldFloat.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.08] }) },
                        ],
                      },
                    ]}
                  >
                    <Text style={s.floatBadgeText}>🛡️</Text>
                  </Animated.View>

                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.floatBadge,
                      s.floatHealBadge,
                      {
                        opacity: healFloat.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                        transform: [
                          { translateY: healFloat.interpolate({ inputRange: [0, 1], outputRange: [12, -18] }) },
                          { scale: healFloat.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.02] }) },
                        ],
                      },
                    ]}
                  >
                    <Text style={s.floatHealText}>+1</Text>
                  </Animated.View>

                  {isDead ? (
                    <View pointerEvents="none" style={[s.stateBadge, s.stateBadgeDead]}>
                      <Text style={s.stateBadgeText}>☠</Text>
                    </View>
                  ) : null}

                  {!isDead && isDisconnected ? (
                    <View pointerEvents="none" style={[s.stateBadge, s.stateBadgeDisconnected]}>
                      <Text style={s.stateBadgeText}>⛔</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={s.hpBarWrap}>
                <View style={s.hpBar}>
                  <View
                    style={[
                      s.hpFill,
                      {
                        width: `${Math.max(0, Math.min(1, (player.hp ?? 0) / Math.max(1, player.maxHp ?? 1))) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={s.hpText}>{player.hp ?? 0}/{player.maxHp ?? 0}</Text>
              </View>

              {typeof distance === "number" ? (
                <View style={s.distBadge}>
                  <Text style={s.distText}>{distance}</Text>
                </View>
              ) : null}

              {isResponder ? (
                <View style={[s.overlayBadge, s.overlayBadgeRespond]}>
                  <Text style={[s.overlayBadgeText, s.overlayBadgeTextDark]} numberOfLines={1}>{responderText}</Text>
                </View>
              ) : null}

              {!isResponder && isTargeted ? (
                <View style={[s.overlayBadge, s.overlayBadgeDanger]}>
                  <Text style={[s.overlayBadgeText, s.overlayBadgeTextDark]} numberOfLines={1}>{targetLabel || "TARGET"}</Text>
                </View>
              ) : null}

              {!isResponder && !isTargeted && isTurn ? (
                <View style={[s.overlayBadge, s.overlayBadgeTurn]}>
                  <Text style={[s.overlayBadgeText, s.overlayBadgeTextDark]}>TURN</Text>
                </View>
              ) : null}
            </ImageBackground>
          </View>

          <View style={s.nameWrap}>
            <Text style={[s.name, isDead || isDisconnected ? s.nameDim : null]} numberOfLines={1}>
              {(player as any)?.name ?? "—"}
            </Text>

            {statusLabel ? (
              <Text style={s.statusText} numberOfLines={1}>
                {statusLabel}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>

      <Modal visible={!!previewSource} transparent animationType="fade" onRequestClose={() => setPreviewSource(null)}>
        <Pressable style={s.previewBackdrop} onPress={() => setPreviewSource(null)}>
          <View style={s.previewCardWrap}>
            <Image source={(previewSource ?? CARD_BACK) as any} resizeMode="contain" style={s.previewCardImage} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    width: 112,
    borderRadius: 0,
    overflow: "visible",
  },
  tilePressed: {
    transform: [{ scale: 0.98 }],
  },
  boardWrap: {
    alignSelf: "center",
    width: 120,
    height: 156,
  },
  boardBg: {
    width: "100%",
    height: "100%",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 7,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  boardBgImage: {
    borderRadius: 0,
  },
  tileFocused: {
    shadowColor: "#fff4c7",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  tileTurn: {
    shadowColor: "#ffd36d",
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  tileResponder: {
    shadowColor: "#ff6b6b",
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  tileTargeted: {
    shadowColor: "#ffb26b",
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  tileDead: {
    opacity: 0.7,
  },
  tileDisconnected: {
    opacity: 0.82,
  },
  inner: {
    position: "relative",
    alignItems: "stretch",
    paddingTop: 14,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  flashRed: {
    backgroundColor: "rgba(255,40,40,0.75)",
  },
  flashGreen: {
    backgroundColor: "rgba(70,255,140,0.70)",
  },
  targetRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "rgba(255,220,120,0.95)",
    backgroundColor: "rgba(255,180,90,0.08)",
  },
  responderRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "rgba(255,100,100,0.96)",
    backgroundColor: "rgba(255,80,80,0.08)",
  },
  boom: {
    position: "absolute",
    left: -10,
    right: -10,
    top: -10,
    bottom: -10,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "rgba(255,80,80,0.75)",
    backgroundColor: "rgba(255,80,80,0.10)",
  },
  avatarArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    marginBottom: 0,
  },
  cardZone: {
    width: "100%",
    height: 108,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  avatarWrap: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 70,
    height: 120,
    marginLeft: -40,
    marginTop: -74,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  avatarWrapDim: {
    opacity: 0.82,
  },
  avatar: {
    width: "100%",
    height: "100%",
    alignSelf: "center",
    borderRadius: 0,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(84,54,28,0.25)",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13,
  },
  equipmentCardWrap: {
    position: "absolute",
    width: 22,
    height: 34,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 5,
  },
  equipmentCard: {
    width: "100%",
    height: "100%",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  previewCardWrap: {
    width: Math.min(SCREEN_W - 28, 360),
    height: 540,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(18,12,8,0.96)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,140,0.28)",
  },
  previewCardImage: {
    width: "100%",
    height: "100%",
  },
  roleBadge: {
    position: "absolute",
    right: 2,
    top: 18,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,220,120,0.96)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadgeText: {
    color: "#201000",
    fontWeight: "900",
    fontSize: 13,
  },
  castBadge: {
    position: "absolute",
    top: -4,
    alignSelf: "center",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,210,120,0.96)",
    borderWidth: 1,
    borderColor: "rgba(80,40,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  castBadgeEmoji: {
    fontSize: 9,
  },
  hourglassBadge: {
    position: "absolute",
    top: 2,
    right: 6,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "rgba(255,245,210,0.98)",
    borderWidth: 1,
    borderColor: "rgba(100,55,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  hourglassText: {
    fontSize: 10,
  },
  floatBadge: {
    position: "absolute",
    alignSelf: "center",
    minWidth: 26,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    elevation: 6,
  },
  floatShieldBadge: {
    top: 4,
    backgroundColor: "rgba(90,160,255,0.98)",
    borderColor: "rgba(255,255,255,0.25)",
  },
  floatHealBadge: {
    top: -2,
    backgroundColor: "rgba(86,205,110,0.98)",
    borderColor: "rgba(255,255,255,0.24)",
  },
  floatBadgeText: {
    color: "white",
    fontWeight: "900",
    fontSize: 11,
  },
  floatHealText: {
    color: "white",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.4,
  },
  stateBadge: {
    position: "absolute",
    left: 4,
    top: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBadgeDead: {
    backgroundColor: "rgba(35,35,35,0.96)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  stateBadgeDisconnected: {
    backgroundColor: "rgba(120,70,20,0.96)",
    borderColor: "rgba(255,210,140,0.22)",
  },
  stateBadgeText: {
    color: "white",
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  nameWrap: {
    width: 100,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: -2,
    paddingHorizontal: 4,
  },
  name: {
    color: "#f6f5f0",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 19,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    paddingHorizontal: 6,
    marginTop: -28,
  },
  nameDim: {
    color: "rgba(246,224,181,0.56)",
  },
  statusText: {
    marginTop: -2,
    color: "#ffde8a",
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.7,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.34)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayBadge: {
    position: "absolute",
    bottom: -15.5,
    left: 22,
    minWidth: 62,
    paddingHorizontal: 8,
    height: 17,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  overlayBadgeTurn: {
    backgroundColor: "rgba(250, 250, 78, 0.98)",
    borderColor: "rgba(120,72,10,0.35)",
  },
  overlayBadgeDanger: {
    backgroundColor: "rgba(255,135,105,0.96)",
    borderColor: "rgba(90,20,0,0.30)",
  },
  overlayBadgeRespond: {
    backgroundColor: "rgba(255,200,110,0.98)",
    borderColor: "rgba(110,52,0,0.28)",
  },
  overlayBadgeText: {
    fontWeight: "900",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  overlayBadgeTextDark: {
    color: "#3a1f04",
  },
  hpBarWrap: {
    position: "absolute",
    left: 15,
    right: 5,
    bottom: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hpBar: {
    flex: 2,
    height: 9,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(7, 0, 2, 0.73)",
    borderWidth: 1,
    borderColor: "rgba(255,230,180,0.12)",
  },
  hpFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: "rgba(248, 60, 60, 0.85)",
  },
  hpText: {
    color: "#fff1d6",
    fontWeight: "900",
    fontSize: 10,
    minWidth: 30,
    textAlign: "right",
  },
  distBadge: {
    position: "absolute",
    right: 50,
    top: -15,
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(16, 16, 16, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  distText: {
    color: "white",
    fontWeight: "900",
    fontSize: 11,
  },
});
