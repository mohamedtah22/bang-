// src/data/cardAssets.ts

import type { CardKey, WeaponKey } from "../models/card";

export const CARD_BACK = require("../../assets/cards/back.png");
export const DEFAULT_WEAPON = require("../../assets/cards/default_weapon.png");

export const ACTION_KEYS = [
  "bang",
  "missed",
  "beer",
  "panic",
  "catbalou",
  "duel",
  "gatling",
  "indians",
  "stagecoach",
  "wellsfargo",
  "saloon",
  "generalstore",
] as const;

export const BLUE_KEYS = ["barrel", "mustang", "scope", "jail", "dynamite"] as const;

export type ActionCardKey = (typeof ACTION_KEYS)[number];
export type BlueCardKey = (typeof BLUE_KEYS)[number];
type NonDefaultWeaponKey = Exclude<WeaponKey, "colt45">;

export function isActionKey(k: CardKey): k is ActionCardKey {
  return (ACTION_KEYS as readonly string[]).includes(k);
}

export function isBlueKey(k: CardKey): k is BlueCardKey {
  return (BLUE_KEYS as readonly string[]).includes(k);
}

function isNonDefaultWeaponKey(k: unknown): k is NonDefaultWeaponKey {
  return (
    k === "volcanic" ||
    k === "schofield" ||
    k === "remington" ||
    k === "rev_carabine" ||
    k === "winchester"
  );
}

function isWeaponKey(k: unknown): k is WeaponKey {
  return k === "colt45" || isNonDefaultWeaponKey(k);
}

export const ACTION_CARD_IMAGES: Record<ActionCardKey, any> = {
  bang: require("../../assets/cards/actions/bang.png"),
  missed: require("../../assets/cards/actions/missed.png"),
  beer: require("../../assets/cards/actions/beer.png"),
  panic: require("../../assets/cards/actions/panic.png"),
  catbalou: require("../../assets/cards/actions/catbalou.png"),
  duel: require("../../assets/cards/actions/duel.png"),
  gatling: require("../../assets/cards/actions/gatling.png"),
  indians: require("../../assets/cards/actions/indians.png"),
  stagecoach: require("../../assets/cards/actions/stagecoach.png"),
  wellsfargo: require("../../assets/cards/actions/wellsfargo.png"),
  saloon: require("../../assets/cards/actions/saloon.png"),
  generalstore: require("../../assets/cards/actions/generalstore.png"),
};

export const BLUE_CARD_IMAGES: Record<BlueCardKey, any> = {
  barrel: require("../../assets/cards/blue/barrel.png"),
  mustang: require("../../assets/cards/blue/mustang.png"),
  scope: require("../../assets/cards/blue/scope.png"),
  jail: require("../../assets/cards/blue/jail.png"),
  dynamite: require("../../assets/cards/blue/dynamite.png"),
};

export const WEAPON_IMAGES: Record<NonDefaultWeaponKey, any> = {
  volcanic: require("../../assets/cards/weapons/volcanic.png"),
  schofield: require("../../assets/cards/weapons/schofield.png"),
  remington: require("../../assets/cards/weapons/remington.png"),
  rev_carabine: require("../../assets/cards/weapons/rev_carabine.png"),
  winchester: require("../../assets/cards/weapons/winchester.png"),
};

function normalizeCardKey(raw: unknown): CardKey | "weapon" | WeaponKey | "" {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "");

  if (!s) return "";
  if (s === "catbalou") return "catbalou";
  if (s === "generalstore") return "generalstore";
  if (s === "wellsfargo") return "wellsfargo";
  if (s === "revcarabine" || s === "carabine") return "rev_carabine";
  if (s === "colt45") return "colt45";
  if (s === "volcanic") return "volcanic";
  if (s === "schofield") return "schofield";
  if (s === "remington") return "remington";
  if (s === "winchester") return "winchester";
  if (s === "weapon") return "weapon";
  return s as CardKey;
}

export function getWeaponImage(wk: WeaponKey) {
  if (wk === "colt45") return DEFAULT_WEAPON;
  return WEAPON_IMAGES[wk];
}

function inferWeaponKeyFromCard(card: any): WeaponKey | null {
  const direct = normalizeCardKey(card?.weaponKey ?? card?.weaponName ?? card?.name ?? card?.key ?? "");
  if (isWeaponKey(direct)) return direct;

  if (normalizeCardKey(card?.key ?? card?.name ?? "") === "weapon") {
    const range = Number(card?.range ?? 0);
    if (range === 1) return "volcanic";
    if (range === 2) return "schofield";
    if (range === 3) return "remington";
    if (range === 4) return "rev_carabine";
    if (range === 5) return "winchester";
  }

  return null;
}

export function getCardImage(card: {
  key?: unknown;
  name?: unknown;
  weaponKey?: WeaponKey | null;
  weaponName?: string | null;
}) {
  const key = normalizeCardKey(card?.key ?? card?.name ?? "");
  const inferredWeapon = inferWeaponKeyFromCard(card);

  if (key === "weapon") {
    if (!inferredWeapon) return CARD_BACK;
    return getWeaponImage(inferredWeapon);
  }

  if (isWeaponKey(key)) return getWeaponImage(key);
  if (inferredWeapon) return getWeaponImage(inferredWeapon);
  if (isBlueKey(key as CardKey)) return BLUE_CARD_IMAGES[key as BlueCardKey];
  if (isActionKey(key as CardKey)) return ACTION_CARD_IMAGES[key as ActionCardKey];
  return CARD_BACK;
}