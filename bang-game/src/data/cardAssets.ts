// src/data/cardAssets.ts

import type { CardKey, WeaponKey } from "../models/card";

/** card back */
export const CARD_BACK = require("../../assets/cards/back.png");

/** ✅ default weapon placeholder (for Colt .45) */
export const DEFAULT_WEAPON = require("../../assets/cards/default_weapon.png");

/** keys */
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

export function isActionKey(k: CardKey): k is ActionCardKey {
  return (ACTION_KEYS as readonly string[]).includes(k);
}

export function isBlueKey(k: CardKey): k is BlueCardKey {
  return (BLUE_KEYS as readonly string[]).includes(k);
}

/** action cards images */
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

/** blue (equipment/status) images */
export const BLUE_CARD_IMAGES: Record<BlueCardKey, any> = {
  barrel: require("../../assets/cards/blue/barrel.png"),
  mustang: require("../../assets/cards/blue/mustang.png"),
  scope: require("../../assets/cards/blue/scope.png"),
  jail: require("../../assets/cards/blue/jail.png"),
  dynamite: require("../../assets/cards/blue/dynamite.png"),
};

/** ✅ weapon images (WITHOUT colt45) */
export const WEAPON_IMAGES: Omit<Record<WeaponKey, any>, "colt45"> = {
  volcanic: require("../../assets/cards/weapons/volcanic.png"),
  schofield: require("../../assets/cards/weapons/schofield.png"),
  remington: require("../../assets/cards/weapons/remington.png"),
  rev_carabine: require("../../assets/cards/weapons/rev_carabine.png"),
  winchester: require("../../assets/cards/weapons/winchester.png"),
};

/** ✅ helper: get weapon image with default for colt45 */
export function getWeaponImage(wk: WeaponKey) {
  if (wk === "colt45") return DEFAULT_WEAPON;
  return WEAPON_IMAGES[wk];
}

export function getCardImage(card: { key: CardKey; weaponKey?: WeaponKey | null }) {
  if (card.key === "weapon") {
    const wk = (card.weaponKey ?? "colt45") as WeaponKey;
    return getWeaponImage(wk);
  }
  if (isBlueKey(card.key)) return BLUE_CARD_IMAGES[card.key];
  if (isActionKey(card.key)) return ACTION_CARD_IMAGES[card.key];
  return CARD_BACK;
}
