import { useCallback, useEffect } from "react";

const CLICK_SFX = require("../../../assets/sfx/buttonclick.mp3");
const JOIN_SFX = require("../../../assets/sfx/card_flip.mp3");
const LEAVE_SFX = require("../../../assets/sfx/buttonclick.mp3");
const CHAT_SFX = require("../../../assets/sfx/buttonclick.mp3");

type UiBank = {
  click: any | null;
  join: any | null;
  leave: any | null;
  chat: any | null;
};

let bank: UiBank = { click: null, join: null, leave: null, chat: null };
let loadPromise: Promise<void> | null = null;
let users = 0;

async function ensureLoaded() {
  if (bank.click || bank.join || bank.leave || bank.chat) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    let mod: any = null;
    try {
      mod = require("expo-av");
    } catch {
      return;
    }

    const Audio = mod?.Audio;
    if (!Audio) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });
    } catch {}

    const load = async (asset: any, volume = 0.55) => {
      const created = await Audio.Sound.createAsync(asset, {
        shouldPlay: false,
        volume,
      });
      return created.sound;
    };

    try {
      const [click, join, leave, chat] = await Promise.all([
        load(CLICK_SFX, 0.36),
        load(JOIN_SFX, 0.5),
        load(LEAVE_SFX, 0.28),
        load(CHAT_SFX, 0.42),
      ]);
      bank = { click, join, leave, chat };
    } catch {}
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

async function unloadBank() {
  const sounds = Object.values(bank);
  bank = { click: null, join: null, leave: null, chat: null };
  for (const sound of sounds) {
    try {
      await sound?.unloadAsync?.();
    } catch {}
  }
}

async function playKey(key: keyof UiBank) {
  await ensureLoaded();
  const sound: any = bank[key];
  if (!sound) return;
  try {
    await sound.replayAsync();
  } catch {}
}

export function useUiSounds() {
  useEffect(() => {
    users += 1;
    ensureLoaded();
    return () => {
      users = Math.max(0, users - 1);
      if (users === 0) {
        unloadBank();
      }
    };
  }, []);

  const playClick = useCallback(() => playKey("click"), []);
  const playJoin = useCallback(() => playKey("join"), []);
  const playLeave = useCallback(() => playKey("leave"), []);
  const playChat = useCallback(() => playKey("chat"), []);

  return { playClick, playJoin, playLeave, playChat };
}
