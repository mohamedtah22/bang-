import { Card } from "./card";
import { Character } from "./characters";


export type Player = {
    id: string;
    name: string;
    hp: number;
    cards: Card[];
    character: Character,
    role : "sheriff" | "deputy" | "outlaw" | "renegade",
    playcharacter: Card,
    equipment: Card[];
    isAlive?: boolean;
    disfromme : number;
    roomcode: string;
};