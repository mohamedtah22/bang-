import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

type BannerTone = "danger" | "reward" | "skill" | "info" | "warning";

type BannerItem = {
  id: string;
  text: string;
  kicker: string;
  tone: BannerTone;
  icon: string;
  sticky?: boolean;
  stickySig?: string;
  durationMs?: number;
};

function playerById(players: any[], id?: any) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return (Array.isArray(players) ? players : []).find((p: any) => String(p?.id ?? "").trim() === key) ?? null;
}

function nameOf(players: any[], id?: any) {
  const hit = playerById(players, id);
  return hit?.name ? String(hit.name) : String(id ?? "").trim();
}

function normalizeKey(raw?: any) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/!/g, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function characterKeyOf(players: any[], id?: any) {
  const p = playerById(players, id);
  const raw = p?.characterKey ?? p?.character ?? p?.playcharacter ?? "";
  const s = normalizeKey(raw);
  if (!s) return "";
  if (s.includes("lucky")) return "lucky_duke";
  if (s.includes("jesse")) return "jesse_jones";
  if (s.includes("pedro")) return "pedro_ramirez";
  if (s.includes("kit")) return "kit_carlson";
  if (s.includes("jourd")) return "jourdonnais";
  if (s.includes("sid")) return "sid_ketchum";
  if (s.includes("bart")) return "bart_cassidy";
  if (s.includes("gringo")) return "el_gringo";
  if (s.includes("suzy")) return "suzy_lafayette";
  if (s.includes("black")) return "black_jack";
  return s;
}

function isLuckyDukePlayer(players: any[], id?: any) {
  return characterKeyOf(players, id) === "lucky_duke";
}

function winnerLabel(raw: any) {
  const k = String(raw ?? "").toLowerCase();
  if (k === "sheriff") return "Sheriff side";
  if (k === "outlaws") return "Outlaws";
  if (k === "renegade") return "Renegade";
  return "Winners";
}

function cardKeyOf(e: any) {
  return normalizeKey(e?.usedCardKey ?? e?.cardKey ?? e?.key ?? e?.name ?? e?.card?.key ?? e?.card?.name ?? "");
}

function suitSymbol(suit?: any) {
  const s = String(suit ?? "").toLowerCase();
  if (s === "hearts") return "♥";
  if (s === "diamonds") return "♦";
  if (s === "spades") return "♠";
  if (s === "clubs") return "♣";
  return "";
}

function shortBadge(card: any) {
  if (!card || typeof card !== "object") return "";
  const rank = String(card?.rank ?? "").toUpperCase();
  return `${rank}${suitSymbol(card?.suit)}`.trim();
}

function weaponLabel(e: any) {
  const wk = normalizeKey(e?.weaponKey ?? e?.weaponName ?? e?.card?.weaponKey ?? e?.card?.weaponName ?? "");
  if (!wk) return "Weapon";
  if (wk === "colt45") return "Colt .45";
  if (wk === "rev_carabine") return "Rev. Carabine";
  return wk
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ownerName(players: any[], e: any) {
  return nameOf(
    players,
    e?.toPlayerId ??
      e?.forPlayerId ??
      e?.responderId ??
      e?.respondingPlayerId ??
      e?.ownerId ??
      e?.targetId ??
      e?.victimId ??
      e?.playerId ??
      e?.pickerId
  );
}

function indexedPendingPlayerId(meta: any) {
  const idx = Number(meta?.idx ?? -1);
  if (Number.isFinite(idx) && idx >= 0) {
    const list = Array.isArray(meta?.targets)
      ? meta.targets
      : Array.isArray(meta?.order)
      ? meta.order
      : [];
    return String(list[idx] ?? "");
  }
  return String(
    meta?.toPlayerId ??
      meta?.forPlayerId ??
      meta?.responderId ??
      meta?.respondingPlayerId ??
      meta?.ownerId ??
      meta?.targetId ??
      meta?.playerId ??
      meta?.pickerId ??
      ""
  );
}

function makeItem(id: string, text: string, tone: BannerTone, kicker: string, icon: string, extra?: Partial<BannerItem>): BannerItem | null {
  if (!text) return null;
  return { id, text, tone, kicker, icon, ...(extra ?? {}) };
}

function countWord(n: number, label: string) {
  return n <= 1 ? label : `${n} ${label}s`;
}

function responseCardLabel(raw: any) {
  const k = normalizeKey(raw);
  if (k === "bang") return "BANG!";
  if (k === "missed") return "MISSED!";
  if (k === "beer") return "BEER";
  if (k === "panic") return "PANIC!";
  if (k === "cat_balou" || k === "catbalou") return "CAT BALOU";
  return k
    ? k
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.toUpperCase())
        .join(" ")
    : "A CARD";
}

function abilityInfo(kind: string) {
  const k = normalizeKey(kind);
  if (k === "choose_lucky_draw" || k === "lucky_choice") return { label: "Lucky Duke", text: "draw check", icon: "🎴" as const };
  if (k === "choose_draw" || k === "draw_choice" || k === "draw_choice_pending") return { label: "Kit Carlson", text: "ability", icon: "🃏" as const };
  if (k === "choose_jesse_target") return { label: "Jesse Jones", text: "ability", icon: "🎯" as const };
  if (k === "choose_pedro_source") return { label: "Pedro Ramirez", text: "ability", icon: "♻️" as const };
  if (k === "sid_heal") return { label: "Sid Ketchum", text: "ability", icon: "🍺" as const };
  return null;
}

function pendingResponseText(k: string, who: string, meta?: any) {
  const need = Number(meta?.requiredMissed ?? meta?.needCount ?? 1);
  if (k === "indians" || k === "respond_to_indians") return `${who} must play BANG! for Indians.`;
  if (k === "gatling" || k === "respond_to_gatling") return `${who} must play MISSED! for Gatling.`;
  if (k === "duel" || k === "duel_response" || k === "respond_to_duel") return `${who} must play BANG! for Duel.`;
  if (k === "bang" || k === "respond_to_bang" || k === "need_missed" || k === "respond_missed") {
    if (need > 1) return `${who} must play ${countWord(need, "MISSED!")} for Bang.`;
    return `${who} must play MISSED! for Bang.`;
  }
  if (k === "revive" || k === "respond_to_revive") return `${who} must use BEER to survive.`;
  if (k === "barrel_choice" || k === "choose_barrel") return `${who} is choosing Barrel / Jourdonnais defense.`;
  if (k === "general_store" || k === "choose_general_store") return `${who} is choosing a card from General Store.`;
  return "";
}

function summarizePending(players: any[], pending: any): BannerItem | null {
  const k = normalizeKey(pending?.kind ?? pending?.privateKind);
  const who = nameOf(players, indexedPendingPlayerId(pending));
  if (!k || !who) return null;

  const sig = `${k}:${who}:${String(pending?.idx ?? "")}`;
  const ability = abilityInfo(k);
  if (ability) {
    const text = ability.text === "draw check"
      ? `${who} is making a Lucky Duke draw check.`
      : `${who} is using ${ability.label} ability.`;
    return makeItem(`pending_${sig}`, text, "skill", "CHARACTER ABILITY", ability.icon, { sticky: true, stickySig: sig });
  }

  const responseText = pendingResponseText(k, who, pending);
  if (responseText) {
    const tone: BannerTone = k.includes("revive") ? "danger" : k.includes("barrel") ? "skill" : k.includes("general_store") ? "info" : "warning";
    const kicker = k.includes("revive") ? "REVIVE" : k.includes("barrel") ? "DEFENSE" : k.includes("general_store") ? "STORE" : "ACTION";
    const icon = k.includes("revive") ? "🍺" : k.includes("barrel") ? "🛡️" : k.includes("general_store") ? "🛒" : k.includes("duel") ? "⚔️" : k.includes("indians") ? "🤠" : k.includes("gatling") ? "🔫" : "💥";
    return makeItem(`pending_${sig}`, responseText, tone, kicker, icon, { sticky: true, stickySig: sig });
  }

  return null;
}

function checkKindLabel(kind: string) {
  const k = normalizeKey(kind);
  if (k === "dynamite") return "Dynamite";
  if (k === "jail") return "Jail";
  if (k === "jourdonnais") return "Jourdonnais";
  if (k === "barrel") return "Barrel";
  return "draw";
}

function summarize(players: any[], e: any): BannerItem | null {
  const t = normalizeKey(e?.type ?? "");
  const id = String(e?.id ?? `${t}_${Date.now()}`);

  if (t === "player_disconnected") {
    const who = nameOf(players, e?.playerId) || String(e?.name ?? "A player");
    return makeItem(id, `${who} disconnected.`, "warning", "DISCONNECT", "📴");
  }

  if (t === "action_required") {
    const k = normalizeKey(e?.kind ?? e?.pending?.kind ?? "");
    const who = ownerName(players, e) || "A player";
    const ability = abilityInfo(k);
    if (ability) {
      const text = ability.text === "draw check"
        ? `${who} is making a Lucky Duke draw check.`
        : `${who} is using ${ability.label} ability.`;
      return makeItem(id, text, "skill", "CHARACTER ABILITY", ability.icon);
    }
    const responseText = pendingResponseText(k, who, e);
    if (responseText) {
      const tone: BannerTone = k.includes("revive") ? "danger" : k.includes("barrel") ? "skill" : k.includes("general_store") ? "info" : "warning";
      const kicker = k.includes("revive") ? "REVIVE" : k.includes("barrel") ? "DEFENSE" : k.includes("general_store") ? "STORE" : "ACTION";
      const icon = k.includes("revive") ? "🍺" : k.includes("barrel") ? "🛡️" : k.includes("general_store") ? "🛒" : k.includes("duel") ? "⚔️" : k.includes("indians") ? "🤠" : k.includes("gatling") ? "🔫" : "💥";
      return makeItem(id, responseText, tone, kicker, icon);
    }
    return null;
  }

  if (t === "card_played") {
    const who = nameOf(players, e?.playerId) || "A player";
    const target = nameOf(players, e?.targetId);
    const key = normalizeKey(e?.cardKey ?? e?.key ?? e?.name ?? "");
    const action = normalizeKey(e?.action ?? "play");
    const context = normalizeKey(e?.context ?? "");
    const usedLabel = responseCardLabel(e?.usedCardKey ?? e?.cardKey ?? e?.name ?? "");

    if (action === "respond") {
      if (context.includes("indians")) return makeItem(id, `${who} used ${usedLabel} for Indians.`, "warning", "RESPONSE", "🤠");
      if (context.includes("gatling")) return makeItem(id, `${who} used ${usedLabel} for Gatling.`, "warning", "RESPONSE", "🔫");
      if (context.includes("duel")) return makeItem(id, `${who} used ${usedLabel} for Duel.`, "warning", "RESPONSE", "⚔️");
      if (context.includes("bang")) return makeItem(id, `${who} used ${usedLabel}.`, "info", "RESPONSE", "🛡️");
      if (context.includes("revive")) return makeItem(id, `${who} used ${usedLabel} to survive.`, "reward", "REVIVE", "🍺");
      if (context.includes("general_store")) return makeItem(id, `${who} picked a card from General Store.`, "info", "STORE", "🛒");
      return makeItem(id, `${who} used ${usedLabel}.`, "info", "RESPONSE", "🃏");
    }

    if (key === "bang") return makeItem(id, target ? `${who} played BANG! on ${target}.` : `${who} played BANG!.`, "danger", "PLAY", "💥");
    if (key === "duel") return makeItem(id, target ? `${who} challenged ${target} to a Duel.` : `${who} played Duel.`, "danger", "DUEL", "⚔️");
    if (key === "indians") return makeItem(id, `${who} played Indians.`, "warning", "PLAY", "🤠");
    if (key === "gatling") return makeItem(id, `${who} played Gatling.`, "danger", "PLAY", "🔫");
    if (key === "beer") return makeItem(id, `${who} played BEER.`, "reward", "HEAL", "🍺");
    if (key === "jail") return makeItem(id, target ? `${who} placed Jail on ${target}.` : `${who} played Jail.`, "warning", "PLAY", "🔒");
    if (key === "dynamite") return makeItem(id, `${who} played Dynamite.`, "danger", "PLAY", "🧨");
    if (key === "general_store" || key === "generalstore") return makeItem(id, `${who} opened General Store.`, "info", "STORE", "🛒");
    if (key === "mustang") return makeItem(id, `${who} equipped Mustang.`, "info", "EQUIPMENT", "🐎");
    if (key === "scope") return makeItem(id, `${who} equipped Scope.`, "info", "EQUIPMENT", "🔭");
    if (key === "barrel") return makeItem(id, `${who} equipped Barrel.`, "skill", "EQUIPMENT", "🛡️");
    if (key === "weapon") return makeItem(id, `${who} equipped ${weaponLabel(e)}.`, "warning", "WEAPON", "🔫");
    if (key === "panic" || key === "cat_balou" || key === "catbalou") {
      const label = key === "panic" ? "Panic!" : "Cat Balou";
      return makeItem(id, target ? `${who} used ${label} on ${target}.` : `${who} used ${label}.`, "warning", "PLAY", "🎯");
    }
    return null;
  }

  if (t === "action_resolved") {
    const k = normalizeKey(e?.kind ?? "");
    const who = nameOf(players, e?.playerId ?? e?.targetId);
    const from = nameOf(players, e?.attackerId ?? e?.initiatorId ?? e?.playerId ?? e?.fromPlayerId);
    const target = nameOf(players, e?.targetId ?? e?.playerId ?? e?.toPlayerId);

    if (k === "duel_start") return makeItem(id, from && target ? `${from} started a Duel against ${target}.` : "A Duel started.", "danger", "DUEL", "⚔️");
    if (k === "indians_start") return makeItem(id, from ? `${from} started Indians.` : "Indians started.", "warning", "ACTION", "🤠");
    if (k === "gatling_start") return makeItem(id, from ? `${from} started Gatling.` : "Gatling started.", "danger", "ACTION", "🔫");
    if (k === "indians_hit") return makeItem(id, target ? `${target} was hit by Indians.` : "A player was hit by Indians.", "danger", "HIT", "💥");
    if (k === "gatling_hit") return makeItem(id, target ? `${target} was hit by Gatling.` : "A player was hit by Gatling.", "danger", "HIT", "💥");
    if (k === "player_dying") return makeItem(id, who ? `${who} is dying.` : "A player is dying.", "danger", "DYING", "☠️");
    if (k === "bang_hit" || k === "bang_timeout_hit") return makeItem(id, target ? `${target} took 1 damage.` : "A player took 1 damage.", "danger", "HIT", "💥");
    if (k === "bang_missed") return makeItem(id, target ? `${target} defended with MISSED!.` : "Bang was defended with MISSED!.", "info", "DEFENSE", "🛡️");
    if (k === "bang_dodged_barrel") return makeItem(id, target ? `${target} blocked with Barrel / Jourdonnais.` : "Bang was blocked by a draw check.", "skill", "DEFENSE", "🛡️");
    if (k === "bang_partial_missed") return makeItem(id, target ? `${target} played one defense card.` : "One defense card was played.", "info", "DEFENSE", "🛡️");
    if (k === "indians_defended") return makeItem(id, target ? `${target} defended Indians.` : "Indians were defended.", "info", "DEFENSE", "🛡️");
    if (k === "gatling_defended") return makeItem(id, target ? `${target} defended Gatling.` : "Gatling was defended.", "info", "DEFENSE", "🛡️");
    if (k === "gatling_defended_missed") return makeItem(id, target ? `${target} defended Gatling with MISSED!.` : "Gatling was defended with MISSED!.", "info", "DEFENSE", "🛡️");
    if (k === "gatling_defended_barrel") return makeItem(id, target ? `${target} blocked Gatling with Barrel / Jourdonnais.` : "Gatling was blocked by a draw check.", "skill", "DEFENSE", "🛡️");
    if (k === "saloon") return makeItem(id, "Saloon healed everyone still alive.", "reward", "HEAL", "🍺");
    if (k === "heal" || k.includes("beer") || k === "sid_heal") return makeItem(id, who ? `${who} recovered 1 HP.` : "A player recovered 1 HP.", "reward", "HEAL", "🍺");
    if (k === "beer_no_effect_two_left") return makeItem(id, "Beer has no effect when only 2 players are left.", "warning", "RULE", "🍺");
    if (k === "general_store_done") return makeItem(id, "General Store is complete.", "info", "STORE", "🛒");
    if (k === "draw_choice_done") return makeItem(id, who ? `${who} finished Kit Carlson ability.` : "Kit Carlson ability is complete.", "skill", "CHARACTER ABILITY", "🃏");
    if (k === "jesse_draw_choice") return makeItem(id, who ? `${who} finished Jesse Jones ability.` : "Jesse Jones ability is complete.", "skill", "CHARACTER ABILITY", "🎯");
    if (k.includes("pedro")) return makeItem(id, who ? `${who} finished Pedro Ramirez ability.` : "Pedro Ramirez ability is complete.", "skill", "CHARACTER ABILITY", "♻️");
    if (k === "jail_freed") return makeItem(id, who ? `${who} escaped Jail.` : "A player escaped Jail.", "reward", "DRAW CHECK", "🔓");
    if (k === "jail_skip_turn") return makeItem(id, who ? `${who} stayed in Jail and lost the turn.` : "A player lost the turn in Jail.", "warning", "DRAW CHECK", "🔒");
    if (k === "dynamite_passed") return makeItem(id, from && target ? `Dynamite passed from ${from} to ${target}.` : "Dynamite was passed.", "warning", "DRAW CHECK", "🧨");
    if (k === "dynamite_exploded") return makeItem(id, who ? `${who} was hit by Dynamite.` : "Dynamite exploded.", "danger", "DRAW CHECK", "🧨");
    if (k === "revive_success") return makeItem(id, who ? `${who} survived with BEER.` : "A player survived with BEER.", "reward", "REVIVE", "🍺");
    if (k === "revive_failed_died" || k === "revive_timeout_died") return makeItem(id, who ? `${who} has died.` : "A player has died.", "danger", "DEATH", "☠️");
    if (k.includes("dead") || k.includes("died") || k.includes("death") || k.includes("killed")) return makeItem(id, who ? `${who} has died.` : "A player has died.", "danger", "DEATH", "☠️");
    return null;
  }

  if (t === "player_passed") {
    const who = nameOf(players, e?.playerId) || "A player";
    const ctx = normalizeKey(e?.context ?? "");
    if (ctx.includes("duel")) return makeItem(id, `${who} could not answer Duel and took 1 damage.`, "warning", "ACTION", "⚔️");
    if (ctx.includes("indians")) return makeItem(id, `${who} could not answer Indians and took 1 damage.`, "warning", "ACTION", "🤠");
    if (ctx.includes("gatling")) return makeItem(id, `${who} could not answer Gatling and took 1 damage.`, "warning", "ACTION", "🔫");
    if (ctx.includes("bang")) return makeItem(id, `${who} could not answer Bang.`, "warning", "ACTION", "💥");
    if (ctx.includes("revive")) return makeItem(id, `${who} could not use BEER and died.`, "danger", "REVIVE", "☠️");
    return null;
  }

  if (t === "passive_triggered") {
    const who = nameOf(players, e?.playerId ?? e?.targetId ?? e?.victimId ?? e?.vultureId);
    const killer = nameOf(players, e?.killerId ?? e?.sheriffId);
    const k = normalizeKey(e?.kind ?? "");
    if (k.includes("kill_reward_outlaw")) return makeItem(id, killer ? `${killer} got the Outlaw reward: draw 3 cards.` : "An Outlaw reward was claimed.", "reward", "REWARD", "🎁");
    if (k.includes("sheriff_killed_deputy_penalty")) return makeItem(id, killer ? `${killer} triggered the Sheriff penalty for killing a Deputy.` : "The Sheriff penalty was triggered.", "danger", "PENALTY", "⚠️");
    if (k.includes("vulture_loot")) return makeItem(id, who ? `${who} looted the dead player's cards.` : "Vulture Sam looted the dead player's cards.", "reward", "PASSIVE", "🦅");
    if (k.includes("bart")) return makeItem(id, who ? `${who} activated Bart Cassidy.` : "Bart Cassidy activated.", "skill", "PASSIVE", "🃏");
    if (k.includes("gringo")) return makeItem(id, who ? `${who} activated El Gringo.` : "El Gringo activated.", "skill", "PASSIVE", "🎯");
    if (k.includes("suzy")) return makeItem(id, who ? `${who} activated Suzy Lafayette.` : "Suzy Lafayette activated.", "skill", "PASSIVE", "✨");
    if (k.includes("blackjack_reveal")) {
      const badge = shortBadge(e?.revealed);
      const revealText = badge ? `revealed the 2nd draw: ${badge}` : "revealed the 2nd draw";
      return makeItem(
        id,
        who ? `${who} ${revealText}.` : `Black Jack ${revealText}.`,
        "skill",
        "BLACK JACK",
        "🂡",
        { durationMs: 5600 }
      );
    }
    if (k.includes("blackjack_bonus_draw")) {
      return makeItem(
        id,
        who ? `${who} gets a 3rd card from Black Jack.` : "Black Jack grants a 3rd card.",
        "skill",
        "BLACK JACK",
        "🂡",
        { durationMs: 6200 }
      );
    }
    if (k.includes("blackjack")) return makeItem(id, who ? `${who} activated Black Jack.` : "Black Jack activated.", "skill", "PASSIVE", "🂡", { durationMs: 5200 });
    return null;
  }

  if (t === "general_store_open") return makeItem(id, "General Store is open.", "info", "STORE", "🛒");
  if (t === "general_store_pick") {
    const who = nameOf(players, e?.pickerId) || "A player";
    return makeItem(id, `${who} picked from General Store.`, "info", "STORE", "🛒");
  }

  if (t === "draw_check") {
    const who = nameOf(players, e?.playerId) || "A player";
    const rawKind = normalizeKey(e?.kind ?? "draw");
    const kind = rawKind === "barrel" && normalizeKey(e?.source ?? e?.reason ?? e?.ability ?? "").includes("jourd") ? "jourdonnais" : rawKind;
    const chosen = e?.chosen ?? (Array.isArray(e?.drawn) ? e.drawn[0] : null);
    const badge = shortBadge(chosen);
    const checkLabel = checkKindLabel(kind);
    const lucky = (Array.isArray(e?.drawn) && e.drawn.length > 1) || isLuckyDukePlayer(players, e?.playerId);

    if (lucky) {
      const suffix = badge ? ` Chosen card: ${badge}.` : "";
      return makeItem(id, `${who} made a Lucky Duke draw check for ${checkLabel}.${suffix}`, "skill", "LUCKY DUKE", "🎴", { durationMs: 5600 });
    }

    const suffix = badge ? ` ${badge}.` : "";
    if (kind === "dynamite") return makeItem(id, `${who} made a Dynamite check.${suffix}`, "warning", "DRAW CHECK", "🧨");
    if (kind === "jail") return makeItem(id, `${who} made a Jail check.${suffix}`, "warning", "DRAW CHECK", "🔒");
    if (kind === "jourdonnais") return makeItem(id, `${who} made a Jourdonnais check.${suffix}`, "skill", "DRAW CHECK", "🛡️");
    if (kind === "barrel") return makeItem(id, `${who} made a Barrel check.${suffix}`, "skill", "DRAW CHECK", "🛡️");
    return null;
  }

  if (t === "game_over") return makeItem(id, `${winnerLabel(e?.winner)} win the game.`, "reward", "GAME OVER", "🏆");
  return null;
}

export function EventBanner({ players, events, pending }: { players: any[]; events: any[] | null; pending?: any | null }) {
  const [feed, setFeed] = useState<BannerItem[]>([]);
  const [dismissedStickySig, setDismissedStickySig] = useState<string>("");
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-18)).current;
  const pulse = useRef(new Animated.Value(0.96)).current;
  const seenRef = useRef<Set<string>>(new Set());
  const pendingSigRef = useRef<string>("");

  const freshItems = useMemo(() => {
    const list = Array.isArray(events) ? events : [];
    const out: BannerItem[] = [];
    for (let i = Math.max(0, list.length - 14); i < list.length; i++) {
      const e = list[i];
      const id = String(e?.id ?? "");
      if (!id || seenRef.current.has(id)) continue;
      const item = summarize(players, e);
      seenRef.current.add(id);
      if (item) out.push(item);
    }
    return out;
  }, [events, players]);

  const stickyItem = useMemo(() => {
    const item = summarizePending(players, pending);
    if (!item?.stickySig) return null;
    if (item.stickySig === dismissedStickySig) return null;
    return item;
  }, [players, pending, dismissedStickySig]);

  const animateIn = () => {
    fade.stopAnimation();
    slide.stopAnimation();
    pulse.stopAnimation();
    fade.setValue(0);
    slide.setValue(-18);
    pulse.setValue(0.96);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.015, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  };

  useEffect(() => {
    if (!freshItems.length) return;
    setFeed((prev) => [...prev, ...freshItems].slice(-4));
    animateIn();
  }, [freshItems]);

  useEffect(() => {
    const kind = String(pending?.kind ?? "").toLowerCase();
    const pid = indexedPendingPlayerId(pending);
    const idx = String(pending?.idx ?? "");
    const sig = `${kind}:${pid}:${idx}`;
    if (!kind || sig === pendingSigRef.current) return;
    pendingSigRef.current = sig;
    if (dismissedStickySig && dismissedStickySig !== sig) setDismissedStickySig("");
    const item = summarizePending(players, pending);
    if (!item) return;
    animateIn();
  }, [pending, players, dismissedStickySig]);

  useEffect(() => {
    if (!feed.length) return;
    const latest = feed[feed.length - 1];
    const timeoutMs = latest?.durationMs ?? 4200;
    const t = setTimeout(() => {
      setFeed((prev) => (prev.length > 1 ? prev.slice(1) : []));
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [feed]);

  const latestTransient = feed.length ? feed[feed.length - 1] : null;
  const current = stickyItem ?? latestTransient;

  if (!current) return null;

  const history = stickyItem ? feed.slice(-3) : feed.slice(0, -1);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        s.wrap,
        {
          opacity: fade,
          transform: [{ translateY: slide }, { scale: pulse }],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          if (stickyItem?.stickySig) {
            setDismissedStickySig(stickyItem.stickySig);
            return;
          }
          setFeed((prev) => (prev.length > 1 ? prev.slice(0, -1) : []));
        }}
        style={({ pressed }) => [s.box, toneBoxStyle[current.tone], pressed ? s.boxPressed : null]}
      >
        <View style={s.headerRow}>
          <View style={[s.iconChip, toneChipStyle[current.tone]]}>
            <Text style={s.iconText}>{current.icon}</Text>
          </View>
          <View style={s.headerTextWrap}>
            <View style={s.kickerRow}>
              <Text style={s.kicker}>{current.kicker}</Text>
              <Text style={s.dismissHint}>{stickyItem ? "Tap to hide" : "Tap"}</Text>
            </View>
            <Text style={s.latestText} numberOfLines={2}>{current.text}</Text>
          </View>
        </View>

        {history.length ? (
          <View style={s.historyWrap}>
            {history.map((item) => (
              <Text key={item.id} style={s.historyText} numberOfLines={1}>
                {item.icon} {item.text}
              </Text>
            ))}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const toneBoxStyle = StyleSheet.create({
  danger: { borderColor: "rgba(255,120,120,0.34)", backgroundColor: "rgba(42,15,15,0.95)" },
  reward: { borderColor: "rgba(255,215,120,0.34)", backgroundColor: "rgba(43,28,9,0.95)" },
  skill: { borderColor: "rgba(140,190,255,0.34)", backgroundColor: "rgba(17,24,38,0.95)" },
  info: { borderColor: "rgba(175,175,255,0.28)", backgroundColor: "rgba(18,18,28,0.95)" },
  warning: { borderColor: "rgba(255,178,92,0.34)", backgroundColor: "rgba(40,24,10,0.95)" },
});

const toneChipStyle = StyleSheet.create({
  danger: { backgroundColor: "rgba(255,90,90,0.18)" },
  reward: { backgroundColor: "rgba(255,214,92,0.18)" },
  skill: { backgroundColor: "rgba(110,170,255,0.18)" },
  info: { backgroundColor: "rgba(180,180,255,0.14)" },
  warning: { backgroundColor: "rgba(255,170,80,0.18)" },
});

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 14,
    zIndex: 2200,
    alignItems: "center",
  },
  box: {
    width: "100%",
    maxWidth: 860,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  boxPressed: {
    opacity: 0.94,
    transform: [{ translateY: 1 }],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 20,
  },
  headerTextWrap: {
    flex: 1,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  kicker: {
    color: "#F6DDB0",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  dismissHint: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 11,
    fontWeight: "700",
  },
  latestText: {
    marginTop: 4,
    color: "#FFF6E8",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  historyWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  historyText: {
    color: "rgba(255,245,230,0.72)",
    fontSize: 12,
    fontWeight: "700",
  },
});
