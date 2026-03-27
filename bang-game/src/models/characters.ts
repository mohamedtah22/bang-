// src/models/characters.ts

export type CharacterId =
  | "bart_cassidy"
  | "black_jack"
  | "calamity_janet"
  | "el_gringo"
  | "jesse_jones"
  | "jourdonnais"
  | "kit_carlson"
  | "lucky_duke"
  | "paul_regret"
  | "pedro_ramirez"
  | "rose_doolan"
  | "sid_ketchum"
  | "slab_the_killer"
  | "suzy_lafayette"
  | "vulture_sam"
  | "willy_the_kid";

export type Character = {
  id: CharacterId;
  label: string;
  image: any; // RN require()
};

export const CHARACTERS: Record<CharacterId, Character> = {
  bart_cassidy: {
    id: "bart_cassidy",
    label: "Bart Cassidy",
    image: require("../../assets/characters/bart_cassidy.png"),
  },
  black_jack: {
    id: "black_jack",
    label: "Black Jack",
    image: require("../../assets/characters/black_jack.png"),
  },
  calamity_janet: {
    id: "calamity_janet",
    label: "Calamity Janet",
    image: require("../../assets/characters/calamity_janet.png"),
  },
  el_gringo: {
    id: "el_gringo",
    label: "El Gringo",
    image: require("../../assets/characters/el_gringo.png"),
  },
  jesse_jones: {
    id: "jesse_jones",
    label: "Jesse Jones",
    image: require("../../assets/characters/jesse_jones.png"),
  },
  jourdonnais: {
    id: "jourdonnais",
    label: "Jourdonnais",
    image: require("../../assets/characters/jourdonnais.png"),
  },
  kit_carlson: {
    id: "kit_carlson",
    label: "Kit Carlson",
    image: require("../../assets/characters/kit_carlson.png"),
  },
  lucky_duke: {
    id: "lucky_duke",
    label: "Lucky Duke",
    image: require("../../assets/characters/lucky_duke.png"),
  },
  paul_regret: {
    id: "paul_regret",
    label: "Paul Regret",
    image: require("../../assets/characters/paul_regret.png"),
  },
  pedro_ramirez: {
    id: "pedro_ramirez",
    label: "Pedro Ramirez",
    image: require("../../assets/characters/pedro_ramirez.png"),
  },
  rose_doolan: {
    id: "rose_doolan",
    label: "Rose Doolan",
    image: require("../../assets/characters/rose_doolan.png"),
  },
  sid_ketchum: {
    id: "sid_ketchum",
    label: "Sid Ketchum",
    image: require("../../assets/characters/sid_ketchum.png"),
  },
  slab_the_killer: {
    id: "slab_the_killer",
    label: "Slab the Killer",
    image: require("../../assets/characters/slab_the_killer.png"),
  },
  suzy_lafayette: {
    id: "suzy_lafayette",
    label: "Suzy Lafayette",
    image: require("../../assets/characters/suzy_lafayette.png"),
  },
  vulture_sam: {
    id: "vulture_sam",
    label: "Vulture Sam",
    image: require("../../assets/characters/vulture_sam.png"),
  },
  willy_the_kid: {
    id: "willy_the_kid",
    label: "Willy the Kid",
    image: require("../../assets/characters/willy_the_kid.png"),
  },
};

export function getCharacter(id: CharacterId) {
  return CHARACTERS[id];
}

function normalizeCharacterLookup(id: string) {
  const s = String(id ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (!s) return "";
  if (s.includes("pedro")) return "pedro_ramirez";
  if (s.includes("kit")) return "kit_carlson";
  if (s.includes("lucky")) return "lucky_duke";
  if (s.includes("bart") || s.includes("cassidy")) return "bart_cassidy";
  if (s === "sid" || s.startsWith("sid_") || s.endsWith("_sid") || s.includes("sid_ketchum") || s.includes("ketchum")) return "sid_ketchum";
  if (s.includes("rose")) return "rose_doolan";
  if (s.includes("jesse")) return "jesse_jones";
  if (s.includes("janet")) return "calamity_janet";
  if (s.includes("gringo")) return "el_gringo";
  if (s.includes("willy")) return "willy_the_kid";
  if (s.includes("suzy")) return "suzy_lafayette";
  if (s.includes("paul")) return "paul_regret";
  if (s.includes("jourd")) return "jourdonnais";
  if (s.includes("slab")) return "slab_the_killer";
  if (s.includes("black")) return "black_jack";
  if (s.includes("vulture")) return "vulture_sam";
  return s;
}

export function getCharacterSafe(id: string) {
  const key = normalizeCharacterLookup(id);
  return (CHARACTERS as any)[key] ?? null;
}
