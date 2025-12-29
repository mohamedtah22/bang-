// src/models/card.ts

export type color  = "spades" | "hearts" | "diamonds" | "clubs";

export type CardKind = "action" | "equipment" | "character" | "status";

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
  | "jail"
  | "dynamite"
  | "weapon"
  | "barrel"
  | "mustang"
  | "scope";


export type Card = {
  color: color;       
  kind:CardKind
  key: CardKey;      
  path: any;     
};
