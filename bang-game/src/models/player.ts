import type { Card, WeaponKey } from "./card";

export type Role = "sheriff" | "deputy" | "outlaw" | "renegade";

export type LobbyPlayer = {
  id: string;
  name: string;
};

export type PublicPlayer = {
  id: string;
  name: string;
  role: Role;
  playcharacter: string;

  hp: number;
  maxHp: number;
  isAlive: boolean;

  equipment: Card[];
  handCount: number;
  disconnected?: boolean;
  connectionLost?: boolean;

  weaponKey: WeaponKey;
};

export type MePlayer = Omit<PublicPlayer, "handCount"> & {
  hand: Card[];
};
