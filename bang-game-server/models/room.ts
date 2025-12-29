import type { Player } from "./player";

export type Room = {
  code: string;
  players: Player[];
  ready: boolean;
  maxPlayers: number;
};
