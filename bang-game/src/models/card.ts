// src/models/card.ts

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type CardKey =
  | "bang"
  | "missed"
  | "beer"
  | "panic"
  | "catbalou"
  | "duel"
  | "gatling"
  | "indians"
  | "stagecoach"
  | "wellsfargo"
  | "saloon"
  | "generalstore"
  | "jail"
  | "dynamite"
  | "weapon"
  | "barrel"
  | "mustang"
  | "scope";

export type WeaponKey =
  | "colt45"
  | "volcanic"
  | "schofield"
  | "remington"
  | "rev_carabine"
  | "winchester";

export type Card = {
  id: string;
  key: CardKey;

  // للـ draw checks (dynamite/jail/barrel...)
  suit?: Suit;
  rank?: Rank;

  // للأسلحة
  weaponKey?: WeaponKey;
  weaponName?: string;
  range?: number;
};
