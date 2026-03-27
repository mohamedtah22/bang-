import { useEffect, useRef } from "react";

type SoundBank = {
  wood: any | null;
  shot: any | null;
  boom: any | null;
  heal: any | null;
  shield: any | null;
  turn: any | null;
  chat: any | null;
  win: any | null;
  lose: any | null;
  dynamite: any | null;
};

const CLICK_SFX = require("../../../assets/sfx/buttonclick.mp3");
const FLIP_SFX = require("../../../assets/sfx/card_flip.mp3");
const SHOT_SFX = require("../../../assets/sfx/gunshot.mp3");
const GATLING_SFX = require("../../../assets/sfx/gatling_burst.mp3");
const HEAL_SFX = require("../../../assets/sfx/heal_magic.mp3");
const DYNAMITE_SFX = require("../../../assets/sfx/dynamite.mp3");
const WIN_SFX = require("../../../assets/sfx/win_trumpet.wav");
const LOSE_SFX = require("../../../assets/sfx/lose_sting.wav");

export function useGameSounds(events: any[], gameOver?: any, meId?: string, chats?: any[]) {
  const bankRef = useRef<SoundBank>({
    wood: null,
    shot: null,
    boom: null,
    heal: null,
    shield: null,
    turn: null,
    chat: null,
    win: null,
    lose: null,
    dynamite: null,
  });
  const lastEvtIdRef = useRef<string | null>(null);
  const lastChatIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const playedResultRef = useRef<string>("");

  useEffect(() => {
    let mounted = true;
    let mod: any = null;

    (async () => {
      try {
        mod = require("expo-av");
      } catch {
        return;
      }

      try {
        const Audio = mod?.Audio;
        if (!Audio) return;
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
        const load = async (asset: any, volume = 0.7) => {
          const created = await Audio.Sound.createAsync(asset, { shouldPlay: false, volume });
          return created.sound;
        };

        const [wood, shot, boom, heal, shield, turn, chat, win, lose, dynamite] = await Promise.all([
          load(FLIP_SFX, 0.42),
          load(SHOT_SFX, 0.58),
          load(GATLING_SFX, 0.62),
          load(HEAL_SFX, 0.5),
          load(CLICK_SFX, 0.46),
          load(CLICK_SFX, 0.34),
          load(CLICK_SFX, 0.34),
          load(WIN_SFX, 0.7),
          load(LOSE_SFX, 0.68),
          load(DYNAMITE_SFX, 0.72),
        ]);

        if (!mounted) {
          for (const sound of [wood, shot, boom, heal, shield, turn, chat, win, lose, dynamite]) {
            try { await sound?.unloadAsync?.(); } catch {}
          }
          return;
        }

        bankRef.current = { wood, shot, boom, heal, shield, turn, chat, win, lose, dynamite };
        readyRef.current = true;
      } catch {}
    })();

    return () => {
      mounted = false;
      const all = Object.values(bankRef.current);
      all.forEach(async (sound: any) => {
        try { await sound?.unloadAsync?.(); } catch {}
      });
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    const list = Array.isArray(events) ? events : [];
    if (!list.length) return;

    let startIdx = 0;
    if (lastEvtIdRef.current) {
      const idx = list.findIndex((e: any) => String(e?.id ?? "") === String(lastEvtIdRef.current));
      startIdx = idx >= 0 ? idx + 1 : Math.max(0, list.length - 12);
    } else {
      startIdx = Math.max(0, list.length - 5);
    }

    const fresh = list.slice(startIdx);
    const play = async (key: keyof SoundBank) => {
      const sound: any = bankRef.current[key];
      if (!sound) return;
      try {
        await sound.replayAsync();
      } catch {}
    };

    fresh.forEach((evt: any) => {
      const type = String(evt?.type ?? "").toLowerCase();
      const kind = String(evt?.kind ?? "").toLowerCase();

      if (type === "turn_started" && String(evt?.turnPlayerId ?? "") === String(meId ?? "")) {
        play("turn");
        return;
      }

      if (type === "card_played" || type === "general_store_pick" || type === "player_passed" || type === "card_discarded") {
        const cardKey = String(evt?.cardKey ?? evt?.card?.key ?? "").toLowerCase();
        if (cardKey === "indians" || cardKey === "gatling") {
          return;
        }
        play("wood");
        return;
      }

      if (type === "action_resolved") {
        if (kind === "gatling" || kind === "gatling_start") {
          play("boom");
          return;
        }
        if (kind === "indians" || kind === "indians_start") {
          play("wood");
          return;
        }
        if (kind === "gatling_hit" || kind === "indians_hit") {
          play("shot");
          return;
        }
        if (kind === "bang_hit" || kind === "bang_timeout_hit" || kind === "duel_hit" || kind === "duel_lose" || kind === "duel_timeout_lose") {
          play("shot");
          return;
        }
        if (
          kind === "bang_missed" ||
          kind === "bang_dodged_barrel" ||
          kind === "bang_partial_missed" ||
          kind === "gatling_defended" ||
          kind === "gatling_defended_missed" ||
          kind === "gatling_defended_barrel"
        ) {
          play("shield");
          return;
        }
        if (kind === "beer" || kind === "beer_heal" || kind === "heal" || kind === "sid_heal" || kind === "saloon") {
          play("heal");
          return;
        }
        if (kind === "dynamite_exploded") {
          play("dynamite");
          return;
        }
      }

      if (type === "draw_check" && kind === "dynamite" && evt?.exploded) {
        play("dynamite");
      }
    });

    lastEvtIdRef.current = String(list[list.length - 1]?.id ?? "");
  }, [events, meId]);

  useEffect(() => {
    if (!readyRef.current) return;
    const list = Array.isArray(chats) ? chats : [];
    if (!list.length) return;

    const play = async (key: keyof SoundBank) => {
      const sound: any = bankRef.current[key];
      if (!sound) return;
      try {
        await sound.replayAsync();
      } catch {}
    };

    let startIdx = 0;
    if (lastChatIdRef.current) {
      const idx = list.findIndex((c: any) => String(c?.id ?? "") === String(lastChatIdRef.current));
      startIdx = idx >= 0 ? idx + 1 : Math.max(0, list.length - 5);
    } else {
      startIdx = Math.max(0, list.length - 1);
    }

    const fresh = list.slice(startIdx);
    fresh.forEach((msg: any) => {
      if (String(msg?.playerId ?? "") === String(meId ?? "")) play("wood");
      else play("chat");
    });

    lastChatIdRef.current = String(list[list.length - 1]?.id ?? "");
  }, [chats, meId]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (!gameOver || !meId) {
      playedResultRef.current = "";
      return;
    }

    const winners = Array.isArray(gameOver?.winners) ? gameOver.winners.map(String) : [];
    const token = `${String(gameOver?.winner ?? "")}_${winners.join(",")}_${String(meId)}`;
    if (playedResultRef.current === token) return;
    playedResultRef.current = token;

    const play = async (key: keyof SoundBank) => {
      const sound: any = bankRef.current[key];
      if (!sound) return;
      try {
        await sound.replayAsync();
      } catch {}
    };

    if (winners.includes(String(meId))) play("win");
    else play("lose");
  }, [gameOver, meId]);
}
