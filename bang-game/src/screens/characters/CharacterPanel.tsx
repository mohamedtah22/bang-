
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { DefaultCharacterPanel } from "./DefaultCharacterPanel";
import JesseJonesPanel from "./panels/JesseJonesPanel";
import { JourdonnaisPanel } from "./panels/JourdonnaisPanel";
import { KitCarlsonPanel } from "./panels/KitCarlsonPanel";
import { LuckyDukePanel } from "./panels/LuckyDukePanel";
import PedroRamirezPanel from "./panels/PedroRamirezPanel";
import { SidKetchumPanel } from "./panels/SidKetchumPanel";
import WoodButton from "../game/WoodButton";

type Props = {
  me: any;
  players: any[];
  phase: any;
  pending: any;
  onSend: (payload: any) => void;
  sidMode?: boolean;
  sidSelectedIds?: Set<string>;
  onSidToggleMode?: () => void;
  onSidToggleCard?: (cardId: string) => void;
  onSidHeal?: (cardIds: string[]) => void;
  onSidClear?: () => void;
  variant?: "full" | "buttonOnly" | "panelOnly";
  open?: boolean;
  onToggle?: () => void;
};

function kOf(x: any) {
  return String(x?.kind ?? x?.type ?? "").toLowerCase().trim();
}

function getCharacterKey(me: any) {
  return String(me?.playcharacter ?? "").toLowerCase().trim();
}

export function getNeedsAttention(params: {
  characterKey: string;
  me: any;
  pending: any;
  sidMode?: boolean;
  sidSelectedIds?: Set<string>;
}) {
  const { characterKey, me, pending, sidMode, sidSelectedIds } = params;
  const kind = kOf(pending);

  if (!me || me.isAlive === false) return false;

  switch (characterKey) {
    case "jesse_jones":
      return kind === "choose_jesse_target";
    case "pedro_ramirez":
      return kind === "choose_pedro_source" || kind === "pedro_choice";
    case "lucky_duke":
      return kind === "choose_lucky_draw" || kind === "lucky_choice";
    case "kit_carlson":
      return kind === "choose_draw" || kind === "draw_choice" || kind === "draw_choice_pending";
    case "jourdonnais":
      return false;
    case "sid_ketchum": {
      const hp = Number(me?.hp ?? 0);
      const maxHp = Number(me?.maxHp ?? 0);
      const handCount = Array.isArray(me?.hand) ? me.hand.length : 0;
      const selectedCount = sidSelectedIds instanceof Set ? sidSelectedIds.size : 0;
      const canHeal = hp < maxHp && handCount >= 2;
      return !!sidMode || selectedCount > 0 || canHeal;
    }
    default:
      return false;
  }
}

export function CharacterPanel({
  me,
  players,
  phase,
  pending,
  onSend,
  sidMode = false,
  sidSelectedIds = new Set<string>(),
  onSidToggleMode,
  onSidToggleCard,
  onSidHeal,
  onSidClear,
  variant = "full",
  open = false,
  onToggle,
}: Props) {
  const characterKey = useMemo(() => getCharacterKey(me), [me]);


  const needsAttention = useMemo(
    () =>
      getNeedsAttention({
        characterKey,
        me,
        pending,
        sidMode,
        sidSelectedIds,
      }),
    [characterKey, me, pending, sidMode, sidSelectedIds]
  );

  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    if (needsAttention) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 420, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      glow.stopAnimation();
      glow.setValue(0);
    }

    return () => loop?.stop();
  }, [needsAttention, glow]);

  const panelNode = useMemo(() => {
    if (!me || !characterKey) return null;

    switch (characterKey) {
      case "jesse_jones":
        return <JesseJonesPanel pending={pending} players={players} meId={String(me?.id ?? "")} onSend={onSend} />;
      case "pedro_ramirez":
        return <PedroRamirezPanel pending={pending} onSend={onSend} />;
      case "lucky_duke":
        return <LuckyDukePanel pending={pending} onSend={onSend} />;
      case "kit_carlson":
        return <KitCarlsonPanel pending={pending} onSend={onSend} />;
      case "jourdonnais":
        return <JourdonnaisPanel pending={pending} onSend={onSend} />;
      case "sid_ketchum":
        return (
          <SidKetchumPanel
            hp={Number(me?.hp ?? 0)}
            maxHp={Number(me?.maxHp ?? 0)}
            hand={Array.isArray(me?.hand) ? me.hand : []}
            selectedIds={sidSelectedIds}
            onToggleCard={onSidToggleCard}
            selectMode={!!sidMode}
            onToggleSelectMode={onSidToggleMode!}
            onHeal={onSidHeal!}
            onClear={onSidClear!}
          />
        );
      default:
        return <DefaultCharacterPanel me={me} pending={pending} compact={false} />;
    }
  }, [me, characterKey, pending, players, onSend, sidSelectedIds, sidMode, onSidToggleMode, onSidToggleCard, onSidHeal, onSidClear]);

  if (!me || !characterKey) return null;

  if (variant === "buttonOnly") {
    return (
      <View style={s.buttonShell}>
        {needsAttention ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.attentionHalo,
              {
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.92] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.16] }) }],
              },
            ]}
          />
        ) : null}
        <Animated.View
          style={[
            s.buttonWrap,
            needsAttention
              ? {
                  opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
                  transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                }
              : null,
          ]}
        >
          <WoodButton title={open ? "Hide Ability" : "Ability"} onPress={onToggle} style={s.woodBtn} />
        </Animated.View>
      </View>
    );
  }

  if (variant === "panelOnly") {
    if (!open) return null;
    return (
      <View style={s.panelOnlyWrap}>
        <View style={s.panelWrap}>{panelNode}</View>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.buttonShell}>
        {needsAttention ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.attentionHalo,
              {
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.92] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.16] }) }],
              },
            ]}
          />
        ) : null}
        <Animated.View
          style={[
            s.buttonWrap,
            needsAttention
              ? {
                  opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
                  transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                }
              : null,
          ]}
        >
          <WoodButton title={open ? "Hide Ability" : "Ability"} onPress={onToggle} style={s.woodBtn} />
        </Animated.View>
      </View>
      {open ? (
        <View style={s.panelOnlyWrap}>
          <View style={s.panelWrap}>{panelNode}</View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 8,
  },
  buttonShell: {
    alignSelf: "center",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonWrap: {
    alignSelf: "center",
    zIndex: 2,
  },
  attentionHalo: {
    position: "absolute",
    left: -18,
    right: -18,
    top: -12,
    bottom: -12,
    borderRadius: 24,
    backgroundColor: "rgba(255, 216, 64, 0.28)",
    borderWidth: 2,
    borderColor: "rgba(255, 232, 120, 0.96)",
    shadowColor: "#FFD84D",
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  woodBtn: {
    minWidth: 126,
    height: 42,
  },
  panelOnlyWrap: {
    width: "100%",
    gap: 6,
  },
  panelOnlyHeader: {
    paddingHorizontal: 2,
    gap: 2,
  },
  panelTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  panelSub: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
    fontWeight: "700",
  },
  panelWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
});
