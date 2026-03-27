import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  Modal,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { PublicPlayer, MePlayer } from "../../models/player";
import type { FxEvent } from "./FxLayer";
import { getCharacterSafe } from "../../models/characters";
import { CARD_BACK, getCardImage } from "../../data/cardAssets";

const WOOD_BOARD = require("../../../assets/wood_board.png");
const { width: SCREEN_W } = Dimensions.get("window");

function isMe(p: any): p is MePlayer {
  return Array.isArray(p?.hand);
}

const WEAPON_KEYS = new Set([
  "colt45",
  "volcanic",
  "schofield",
  "remington",
  "rev_carabine",
  "winchester",
  "carabine",
]);

function isWeaponCard(c: any) {
  const key = String(c?.key ?? "").toLowerCase();
  if (key === "weapon") return true;
  const k = String(c?.weaponKey ?? c?.weaponName ?? c?.weapon ?? c?.key ?? "").toLowerCase();
  return WEAPON_KEYS.has(k);
}

function isJail(c: any) {
  return String(c?.key ?? "").toLowerCase() === "jail";
}

function isDynamite(c: any) {
  return String(c?.key ?? "").toLowerCase() === "dynamite";
}

function prettyWeaponName(raw?: any) {
  const key = String(raw ?? "colt45").trim().toLowerCase();
  if (!key) return "Colt .45";
  if (key === "colt45" || key === "colt_45") return "Colt .45";
  if (key === "rev_carabine" || key === "revcarabine" || key === "carabine") return "Rev. Carabine";
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function equipmentLabel(card: any) {
  if (isWeaponCard(card)) {
    return prettyWeaponName(card?.weaponKey ?? card?.weaponName ?? card?.weapon ?? card?.key ?? "colt45");
  }
  const raw = String(card?.key ?? card?.name ?? "").replace(/_/g, " ").trim();
  if (!raw) return "Card";
  return raw.replace(/\b\w/g, (m) => m.toUpperCase());
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statPill}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

export function TableCenter({
  me,
  focused,
  fx,
  distanceToMe,
  turnPlayerId,
  children,
  bannerText,
  bannerSub,
  style,
  onAnchor,
  discardTopCard,
  discardCards,
  discardCount,
  deckCount,
  onDeckAnchor,
  onDiscardAnchor,
  highlighted,
  highlightLabel,
  turnHighlighted,
  responseTone,
  abilityControl,
}: {
  me: MePlayer | null;
  focused: PublicPlayer | MePlayer | null;
  fx: FxEvent[];
  distanceToMe?: number | null;
  turnPlayerId?: string | null;
  children?: React.ReactNode;
  bannerText?: string;
  bannerSub?: string;
  style?: ViewStyle | ViewStyle[];
  onAnchor?: (playerId: string, pt: { x: number; y: number }) => void;
  discardTopCard?: any | null;
  discardCards?: any[];
  discardCount?: number | null;
  deckCount?: number | null;
  onDeckAnchor?: (pt: { x: number; y: number }) => void;
  onDiscardAnchor?: (pt: { x: number; y: number }) => void;
  highlighted?: boolean;
  highlightLabel?: string;
  turnHighlighted?: boolean;
  responseTone?: "turn" | "response";
  abilityControl?: React.ReactNode;
}) {
  const focus = focused ?? me;

  const char = useMemo(() => {
    const key = String((focus as any)?.playcharacter ?? (focus as any)?.characterKey ?? (focus as any)?.character ?? "");
    return getCharacterSafe(key) ?? getCharacterSafe("bart_cassidy");
  }, [focus]);

  const avatarSource = (char as any)?.image ?? null;
  const equip = useMemo(() => (Array.isArray((focus as any)?.equipment) ? (focus as any).equipment : []), [focus]);

  const focusWeaponKey = useMemo(
    () =>
      String(
        (focus as any)?.weaponKey ??
          (me && focus && String((focus as any)?.id ?? "") === String(me.id) ? me.weaponKey : "") ??
          ""
      )
        .trim()
        .toLowerCase(),
    [focus, me]
  );

  const equipmentCards = useMemo(() => {
    const raw = equip.filter((c: any) => !isJail(c) && !isDynamite(c));
    const hasWeapon = raw.some((c: any) => isWeaponCard(c));
    if (hasWeapon) return raw;
    if (!focusWeaponKey || focusWeaponKey === "colt45") return raw;
    return [{ id: `weapon_${String((focus as any)?.id ?? "focus")}`, key: "weapon", weaponKey: focusWeaponKey }, ...raw];
  }, [equip, focusWeaponKey, focus]);

  const tableStatusCards = useMemo(() => equip.filter((c: any) => isJail(c) || isDynamite(c)), [equip]);
  const hasJail = tableStatusCards.some((c: any) => isJail(c));
  const hasDynamite = tableStatusCards.some((c: any) => isDynamite(c));
  const handCount = !focus ? 0 : isMe(focus) ? (focus as any).hand?.length ?? 0 : (focus as any).handCount ?? 0;
  const hp = focus ? (focus as any).hp ?? 0 : 0;
  const maxHp = focus ? (focus as any).maxHp ?? 0 : 0;
  const isSelfFocus = !!me && !!focus && String((focus as any)?.id ?? "") === String(me.id);
  const isSheriff = String((me && focus && String((focus as any).id) === String(me.id) ? (me as any).role : (focus as any)?.role) ?? "").toLowerCase() === "sheriff";

  const deckRef = useRef<View | null>(null);
  const discardRef = useRef<View | null>(null);
  const targetPulse = useRef(new Animated.Value(0)).current;
  const hitFlash = useRef(new Animated.Value(0)).current;
  const prevHpRef = useRef<number>(Number(hp ?? 0));

  const reportAnchorOf = (ref: React.RefObject<View | null>, cb?: (pt: { x: number; y: number }) => void) => {
    if (!cb) return;
    requestAnimationFrame(() => {
      ref.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
        cb({ x: x + w / 2, y: y + h / 2 });
      });
    });
  };

  useEffect(() => {
    reportAnchorOf(deckRef, onDeckAnchor);
    reportAnchorOf(discardRef, onDiscardAnchor);
  }, [onDeckAnchor, onDiscardAnchor, discardTopCard]);

  useEffect(() => {
    const nextHp = Number(hp ?? 0);
    const prevHp = prevHpRef.current;
    if (nextHp < prevHp) {
      hitFlash.setValue(0);
      Animated.sequence([
        Animated.timing(hitFlash, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(hitFlash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    }
    prevHpRef.current = nextHp;
  }, [hp, hitFlash]);

  useEffect(() => {
    targetPulse.stopAnimation();
    targetPulse.setValue(0);
    if (!highlighted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(targetPulse, { toValue: 1, duration: 540, useNativeDriver: true }),
        Animated.timing(targetPulse, { toValue: 0, duration: 540, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [highlighted, targetPulse]);

  const discardPreview = useMemo(
    () => (Array.isArray(discardCards) ? discardCards.slice(-2) : discardTopCard ? [discardTopCard] : []),
    [discardCards, discardTopCard]
  );
  const [previewSource, setPreviewSource] = useState<any | null>(null);

  return (
    <View style={[s.wrap, style]}>
      <View style={s.topPilesRow}>
        <View ref={deckRef} collapsable={false} onLayout={() => reportAnchorOf(deckRef, onDeckAnchor)} style={s.pileTopItem}>
          <Text style={s.pileTopCount}>{typeof deckCount === "number" ? deckCount : "?"}</Text>
          <View style={s.deckStackSmall}>
            <Image source={CARD_BACK} style={[s.pileCardSmall, s.deckBack2]} resizeMode="cover" />
            <Image source={CARD_BACK} style={[s.pileCardSmall, s.deckBack3]} resizeMode="cover" />
            <Image source={CARD_BACK} style={s.pileCardSmall} resizeMode="cover" />
          </View>
          <Text style={s.pileTopCaption}></Text>
        </View>

        <View style={s.abilitySlot}>{abilityControl}</View>

        <View ref={discardRef} collapsable={false} onLayout={() => reportAnchorOf(discardRef, onDiscardAnchor)} style={s.pileTopItem}>
          <Text style={s.pileTopCount}>{typeof discardCount === "number" ? discardCount : discardPreview.length}</Text>
          <View style={s.discardStackSmall}>
            {discardPreview.length > 0 ? (
              discardPreview.map((card: any, idx: number) => {
                const src = getCardImage(card as any);
                const offset = discardPreview.length - 1 - idx;
                return src ? (
                  <Pressable
                    key={String(card?.id ?? `${idx}_${String(card?.key ?? "card")}`)}
                    onPress={() => setPreviewSource(src as any)}
                    hitSlop={6}
                    style={s.discardPreviewPressable}
                  >
                    <Image
                      source={src as any}
                      style={[
                        s.pileCardSmall,
                        s.discardPreviewCard,
                        {
                          top: 2 + offset * 3,
                          left: "50%",
                          marginLeft: -24,
                          transform: [
                            { translateX: offset * 4 },
                            { rotate: `${idx === discardPreview.length - 1 ? -6 : 5}deg` },
                          ],
                          opacity: 0.72 + idx * 0.16,
                        },
                      ]}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : null;
              })
            ) : (
              <View style={[s.pileCardSmall, s.cardEmpty]}>
                <Text style={s.emptyText}>Empty</Text>
              </View>
            )}
          </View>
          <Text style={s.pileTopCaption}></Text>
        </View>
      </View>

      <ImageBackground source={WOOD_BOARD} resizeMode="cover" style={s.tableBg} imageStyle={s.tableBgImg}>
        <LinearGradient colors={["rgba(0,0,0,0.14)", "rgba(0,0,0,0.26)"]} style={s.table}>
          <Animated.View pointerEvents="none" style={[s.hitFlash, { opacity: hitFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.42] }) }]} />

          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <Text style={s.name} numberOfLines={1}>{focus ? (focus as any).name : "—"}</Text>
              <View style={s.headerMiniStats}>
                <StatPill label="HP" value={`${hp}/${maxHp}`} />
                <StatPill label="Hand" value={String(handCount)} />
                {!isSelfFocus ? <StatPill label="Dist" value={focused && typeof distanceToMe === "number" ? String(distanceToMe) : "—"} /> : null}
              </View>
            </View>

            <View style={s.badgesRow}>
              {isSheriff ? <View style={s.badgeGold}><Text style={s.badgeTextDark}>⭐</Text></View> : null}
              {hasJail ? <View style={s.badgeDark}><Text style={s.badgeText}>🔒</Text></View> : null}
              {hasDynamite ? <View style={s.badgeDark}><Text style={s.badgeText}>🧨</Text></View> : null}
                            {highlighted ? (
                <View style={responseTone === "turn" ? s.badgeGold : s.badgeAlert}>
                  <Text style={responseTone === "turn" ? s.badgeTextDark : s.badgeText}>{highlightLabel || "RESPOND"}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <ScrollView style={s.bodyScroll} contentContainerStyle={s.bodyScrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <View style={s.topRow}>
              <View style={s.charCol}>
                {highlighted ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.targetHalo,
                      {
                        opacity: targetPulse.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.82] }),
                        transform: [{ scale: targetPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }],
                      },
                      responseTone === "turn" ? s.targetHaloTurn : s.targetHaloAlert,
                    ]}
                  />
                ) : null}
                {avatarSource ? (
                  <Pressable onPress={() => setPreviewSource(avatarSource as any)} hitSlop={8} style={s.charCardPressable}>
                    <Image source={avatarSource as any} style={s.charCard} resizeMode="contain" />
                  </Pressable>
                ) : <View style={[s.charCard, s.cardEmpty]} />}
                <Text style={s.charLabel} numberOfLines={1}>{char ? String((char as any).label ?? "") : ""}</Text>
              </View>

              <View style={s.centerCol}>
                <View style={s.equipmentPanel}>
                  <View style={s.equipmentHeader}>
                    <Text style={s.equipmentTitle}>Table Cards</Text>
                    <Text style={s.equipmentHint}>Swipe left / right</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.equipmentStrip}>
                    {equipmentCards.length ? (
                      equipmentCards.map((card: any, idx: number) => {
                        const src = getCardImage(card as any);
                        const label = equipmentLabel(card);
                        return (
                          <View key={String(card?.id ?? card?._id ?? `${label}_${idx}`)} style={s.equipmentItem}>
                            <Pressable style={s.equipmentThumbWrap} onPress={() => src && setPreviewSource(src as any)} hitSlop={6}>
                              {src ? <Image source={src as any} style={s.equipmentThumb} resizeMode="contain" /> : <View style={[s.equipmentThumb, s.cardEmpty]} />}
                            </Pressable>
                            <Text numberOfLines={1} style={s.equipmentLabel}>{label}</Text>
                          </View>
                        );
                      })
                    ) : (
                      <View style={s.equipmentEmpty}><Text style={s.equipmentEmptyText}>No table cards</Text></View>
                    )}
                    {tableStatusCards.map((card: any, idx: number) => {
                      const src = getCardImage(card as any);
                      const label = equipmentLabel(card);
                      return (
                        <View key={String(card?.id ?? card?._id ?? `${label}_status_${idx}`)} style={s.equipmentItem}>
                          <Pressable style={s.equipmentThumbWrap} onPress={() => src && setPreviewSource(src as any)} hitSlop={6}>
                            {src ? <Image source={src as any} style={s.equipmentThumb} resizeMode="contain" /> : <View style={[s.equipmentThumb, s.cardEmpty]} />}
                          </Pressable>
                          <Text numberOfLines={1} style={s.equipmentLabel}>{label}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>

                {children ? <View style={s.inlinePanel}>{children}</View> : null}

                {bannerText ? (
                  <View style={s.banner}>
                    <Text style={s.bannerText} numberOfLines={2}>{bannerText}</Text>
                    {bannerSub ? <Text style={s.bannerSub} numberOfLines={2}>{bannerSub}</Text> : null}
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </ImageBackground>

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
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 2,
  },
  topPilesRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    gap: 18,
    marginBottom: -6,
  },
  abilitySlot: {
    flex: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  pileTopItem: {
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 88,
    minWidth: 72,
    flexShrink: 0,
  },
  pileTopCaption: {
    marginTop: 6,
    color: "rgba(255,255,255,0.86)",
    fontWeight: "900",
    fontSize: 11,
  },
  pileTopCount: {
    marginBottom: 6,
    minWidth: 34,
    textAlign: "center",
    color: "#fff0c2",
    fontWeight: "900",
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(88,44,15,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,220,145,0.22)",
  },
  deckStackSmall: {
    height: 66,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  discardStackSmall: {
    height: 66,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  pileCardSmall: {
    width: 48,
    height: 64,
    borderRadius: 8,
    position: "absolute",
  },
  deckBack2: {
    top: 2,
    left: "50%",
    marginLeft: -24,
    transform: [{ rotate: "-5deg" }],
    opacity: 0.76,
  },
  deckBack3: {
    top: 6,
    left: "50%",
    marginLeft: -24,
    transform: [{ translateX: 3 }, { rotate: "6deg" }],
    opacity: 0.54,
  },
  discardPreviewCard: {
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  discardPreviewPressable: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 60,
    height: 66,
  },
  cardEmpty: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "800",
    fontSize: 9,
  },
  tableBg: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    minHeight: 176,
  },
  tableBgImg: { borderRadius: 22 },
  table: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  hitFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor: "rgba(255,40,40,0.64)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    alignItems: "flex-start",
  },
  name: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  headerMiniStats: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  statPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 10,
    fontWeight: "800",
  },
  statValue: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    maxWidth: 138,
  },
  badgeGold: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,230,130,0.95)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
  },
  badgeAlert: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,120,120,0.95)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
  },
  badgeDark: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  badgeText: { color: "rgba(255,255,255,0.9)", fontWeight: "900", fontSize: 11 },
  badgeTextDark: { color: "rgba(0,0,0,0.85)", fontWeight: "900", fontSize: 11 },
  bodyScroll: {
    flex: 1,
    marginTop: 2,
  },
  bodyScrollContent: {
    paddingBottom: 4,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  charCol: {
    width: 88,
    alignItems: "center",
    position: "relative",
  },
  charCardPressable: {
    borderRadius: 12,
  },
  targetHalo: { position: "absolute", top: -4, left: 0, right: 0, bottom: 22, borderWidth: 2, borderRadius: 14 },
  targetHaloTurn: { borderColor: "rgba(255,220,120,0.98)", backgroundColor: "rgba(255,180,80,0.08)" },
  targetHaloAlert: { borderColor: "rgba(255,120,120,0.98)", backgroundColor: "rgba(255,70,70,0.08)" },
  charCard: {
    width: 74,
    height: 104,
    borderRadius: 12,
  },
  charLabel: {
    color: "rgba(255,255,255,0.78)",
    marginTop: 4,
    fontSize: 10,
    textAlign: "center",
    fontWeight: "900",
  },
  centerCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  equipmentPanel: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  equipmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  equipmentTitle: { color: "rgba(255,255,255,0.88)", fontWeight: "900", fontSize: 12 },
  equipmentHint: { color: "rgba(255,255,255,0.56)", fontWeight: "800", fontSize: 10 },
  equipmentStrip: {
    gap: 8,
    paddingRight: 8,
    minHeight: 70,
    alignItems: "flex-start",
  },
  equipmentItem: { width: 58, alignItems: "center" },
  equipmentThumbWrap: {
    width: 50,
    height: 70,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  equipmentThumb: { width: 46, height: 66, borderRadius: 8 },
  equipmentLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "800",
    fontSize: 9,
    textAlign: "center",
  },
  equipmentEmpty: {
    minWidth: 120,
    height: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  equipmentEmptyText: { color: "rgba(255,255,255,0.62)", fontWeight: "800", fontSize: 11, textAlign: "center" },
  inlinePanel: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  banner: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(150,30,30,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,210,190,0.30)",
  },
  bannerText: { color: "rgba(255,255,255,0.96)", fontWeight: "900", fontSize: 12, textAlign: "center" },
  bannerSub: { color: "rgba(255,255,255,0.82)", fontWeight: "800", fontSize: 11, textAlign: "center", marginTop: 3 },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  previewCardWrap: {
    width: Math.min(SCREEN_W - 36, 360),
    aspectRatio: 0.72,
    borderRadius: 18,
    backgroundColor: "rgba(20,12,8,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,220,145,0.22)",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  previewCardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },

});
