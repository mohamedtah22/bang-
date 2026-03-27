export type CharacterKey =
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

export const CHARACTER_LABEL: Record<CharacterKey, string> = {
  bart_cassidy: "Bart Cassidy",
  black_jack: "Black Jack",
  calamity_janet: "Calamity Janet",
  el_gringo: "El Gringo",
  jesse_jones: "Jesse Jones",
  jourdonnais: "Jourdonnais",
  kit_carlson: "Kit Carlson",
  lucky_duke: "Lucky Duke",
  paul_regret: "Paul Regret",
  pedro_ramirez: "Pedro Ramirez",
  rose_doolan: "Rose Doolan",
  sid_ketchum: "Sid Ketchum",
  slab_the_killer: "Slab the Killer",
  suzy_lafayette: "Suzy Lafayette",
  vulture_sam: "Vulture Sam",
  willy_the_kid: "Willy the Kid",
};

export type CharacterKind = "rule" | "passive" | "choice" | "active";

export const CHARACTER_META: Record<CharacterKey, { kind: CharacterKind; short: string }> = {
  slab_the_killer: { kind: "rule", short: "When your BANG! is defended, the target usually needs 2 MISSED! cards to fully dodge it." },
  willy_the_kid: { kind: "rule", short: "Always active: no limit on how many BANG! cards you may play on your turn." },
  paul_regret: { kind: "rule", short: "Always active: other players see you at distance +1." },
  rose_doolan: { kind: "rule", short: "Always active: you see other players at distance -1." },
  calamity_janet: { kind: "rule", short: "You may play MISSED! as BANG! and BANG! as MISSED! whenever needed." },

  bart_cassidy: { kind: "passive", short: "Trigger: each time you lose 1 HP, draw 1 card." },
  suzy_lafayette: { kind: "passive", short: "Trigger: whenever your hand becomes empty, draw 1 card immediately." },
  black_jack: { kind: "passive", short: "Trigger: during your draw, if the revealed card is Hearts or Diamonds, draw 1 extra." },
  el_gringo: { kind: "passive", short: "Trigger: when another player hurts you, take a random card from the attacker." },
  vulture_sam: { kind: "passive", short: "Trigger: when another player dies, take all of their hand and equipment cards." },

  lucky_duke: { kind: "choice", short: "On any Draw! check, reveal 2 cards and choose which one counts." },
  kit_carlson: { kind: "choice", short: "At the start of your draw, look at 3 cards, keep 2, return 1." },
  jesse_jones: { kind: "choice", short: "Your first draw can come from another player's hand instead of the deck." },
  pedro_ramirez: { kind: "choice", short: "Your first draw can come from the top of the discard pile instead of the deck." },
  jourdonnais: { kind: "choice", short: "Defensive trigger: you are treated like you have a Barrel when defending BANG!." },

  sid_ketchum: { kind: "active", short: "Manual ability: discard 2 cards to heal 1 HP." },
};

export const CHARACTER_DETAILS: Record<CharacterKey, { timing: string; effect: string; hint?: string }> = {
  bart_cassidy: {
    timing: "When you lose 1 HP",
    effect: "Draw 1 card each time you are wounded.",
    hint: "This happens automatically.",
  },
  black_jack: {
    timing: "During your normal draw",
    effect: "If the revealed second card is Hearts or Diamonds, draw 1 extra card.",
    hint: "This happens automatically during draw phase.",
  },
  calamity_janet: {
    timing: "Whenever you need BANG! or MISSED!",
    effect: "You may use BANG! as MISSED! and MISSED! as BANG!.",
  },
  el_gringo: {
    timing: "When another player hurts you",
    effect: "Take a random card from the attacker for each HP lost.",
    hint: "This happens automatically.",
  },
  jesse_jones: {
    timing: "Your first draw of the turn",
    effect: "You may take your first card from another player's hand instead of the deck. Your second draw still comes from the deck.",
    hint: "When the draw phase starts, this panel will let you choose player or deck.",
  },
  jourdonnais: {
    timing: "When defending against BANG!",
    effect: "You are treated as if you always have a Barrel. A successful ♥ Draw! acts like MISSED!.",
    hint: "The draw check opens automatically when needed.",
  },
  kit_carlson: {
    timing: "At the start of your draw",
    effect: "Look at 3 cards, keep exactly 2, and return 1 to the deck.",
    hint: "When your draw starts, this panel will show the 3 offered cards.",
  },
  lucky_duke: {
    timing: "Whenever you make a Draw! check",
    effect: "Reveal 2 cards and choose which one counts.",
    hint: "This opens automatically for Barrel, Jail, Dynamite, and other Draw! checks.",
  },
  paul_regret: {
    timing: "Always active",
    effect: "Other players see you at distance +1.",
  },
  pedro_ramirez: {
    timing: "Your first draw of the turn",
    effect: "You may take the top card from the discard pile instead of the deck. Your second draw still comes from the deck.",
    hint: "When the draw phase starts, this panel will let you choose discard or deck.",
  },
  rose_doolan: {
    timing: "Always active",
    effect: "You see all other players at distance -1.",
  },
  sid_ketchum: {
    timing: "Manual ability on your turn",
    effect: "Discard 2 cards to recover 1 HP.",
    hint: "Use the button below only when you are wounded and have at least 2 cards.",
  },
  slab_the_killer: {
    timing: "Whenever your BANG! is defended",
    effect: "The target usually needs 2 MISSED! cards to fully cancel your BANG!.",
  },
  suzy_lafayette: {
    timing: "Whenever your hand becomes empty",
    effect: "Immediately draw 1 card.",
    hint: "This happens automatically.",
  },
  vulture_sam: {
    timing: "Whenever another player is eliminated",
    effect: "Take all of that player's hand and table cards.",
    hint: "This happens automatically.",
  },
  willy_the_kid: {
    timing: "Always active",
    effect: "You may play any number of BANG! cards during your turn.",
  },
};

export function asCharacterKey(x: any): CharacterKey | null {
  const s = String(x ?? "").trim().toLowerCase();
  if (!s) return null;
  return (s as CharacterKey) in CHARACTER_LABEL ? (s as CharacterKey) : null;
}
