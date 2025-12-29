// src/data/characters.ts

export type CharacterId =
  | "c1"
  | "c2"
  | "c3"
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
  image: any;
};

// ✅ بدل Array: خليها Record
export const CHARACTERS: Record<CharacterId, Character> = {
  bart_cassidy: { id: "bart_cassidy", label: "Bart Cassidy", image: require("../../assets/charachters/bart_cassidy.png") },
  black_jack: { id: "black_jack", label: "Black Jack", image: require("../../assets/charachters/black_jack.png") },
  calamity_janet: { id: "calamity_janet", label: "Calamity Janet", image: require("../../assets/charachters/calamity_janet.png") },
  el_gringo: { id: "el_gringo", label: "El Gringo", image: require("../../assets/charachters/el_gringo.png") },
  jesse_jones: { id: "jesse_jones", label: "Jesse Jones", image: require("../../assets/charachters/jesse_jones.png") },
  jourdonnais: { id: "jourdonnais", label: "Jourdonnais", image: require("../../assets/charachters/jourdonnais.png") },
  kit_carlson: { id: "kit_carlson", label: "Kit Carlson", image: require("../../assets/charachters/kit_carlson.png") },
  lucky_duke: { id: "lucky_duke", label: "Lucky Duke", image: require("../../assets/charachters/lucky_duke.png") },
  paul_regret: { id: "paul_regret", label: "Paul Regret", image: require("../../assets/charachters/paul_regret.png") },
  pedro_ramirez: { id: "pedro_ramirez", label: "Pedro Ramirez", image: require("../../assets/charachters/pedro_ramirez.png") },
  rose_doolan: { id: "rose_doolan", label: "Rose Doolan", image: require("../../assets/charachters/rose_doolan.png") },
  sid_ketchum: { id: "sid_ketchum", label: "Sid Ketchum", image: require("../../assets/charachters/sid_ketchum.png") },
  slab_the_killer: { id: "slab_the_killer", label: "Slab the Killer", image: require("../../assets/charachters/slab_the_killer.png") },
  suzy_lafayette: { id: "suzy_lafayette", label: "Suzy Lafayette", image: require("../../assets/charachters/suzy_lafayette.png") },
  vulture_sam: { id: "vulture_sam", label: "Vulture Sam", image: require("../../assets/charachters/vulture_sam.png") },
  willy_the_kid: { id: "willy_the_kid", label: "Willy the Kid", image: require("../../assets/charachters/willy_the_kid.png") },
  c1: {
    id: "c1",
    label: "",
    image: undefined
  },
  c2: {
    id: "c1",
    label: "",
    image: undefined
  },
  c3: {
    id: "c1",
    label: "",
    image: undefined
  }
};

export function getCharacter(id: CharacterId) {
  return CHARACTERS[id];
}

// ✅ safe لو اجاك id غريب من السيرفر
export function getCharacterSafe(id: string) {
  return (CHARACTERS as any)[id] ?? null;
}
