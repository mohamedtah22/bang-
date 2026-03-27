import { useEffect, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";

const AMBIENT_TRACK = require("../../../assets/music/game_western.wav.mp3");

type TrackKey = "lobby" | "game";

let currentSound: any = null;
let loadPromise: Promise<any> | null = null;
let activeOwners = new Set<string>();
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let currentVolume = 0.22;

async function ensureSound(volume: number) {
  currentVolume = volume;

  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }

  if (currentSound) {
    try {
      await currentSound.setVolumeAsync?.(currentVolume);
    } catch {}
    return currentSound;
  }

  if (loadPromise) {
    await loadPromise;
    if (currentSound) {
      try {
        await currentSound.setVolumeAsync?.(currentVolume);
      } catch {}
    }
    return currentSound;
  }

  loadPromise = (async () => {
    let mod: any = null;
    try {
      mod = require("expo-av");
    } catch {
      return null;
    }

    const Audio = mod?.Audio;
    if (!Audio) return null;

    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
    } catch {}

    try {
      const created = await Audio.Sound.createAsync(AMBIENT_TRACK, {
        shouldPlay: false,
        isLooping: true,
        volume: currentVolume,
      });
      currentSound = created.sound;
      return currentSound;
    } catch {
      return null;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

async function activate(owner: string, volume: number) {
  activeOwners.add(owner);
  const sound = await ensureSound(volume);
  if (!sound) return;

  try {
    await sound.setIsLoopingAsync?.(true);
    await sound.setVolumeAsync?.(volume);
    const status = await sound.getStatusAsync?.();
    if (!status?.isLoaded) return;
    if (!status?.isPlaying) {
      await sound.playAsync?.();
    }
  } catch {}
}

function deactivate(owner: string) {
  activeOwners.delete(owner);
  if (activeOwners.size > 0) return;

  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(async () => {
    if (activeOwners.size > 0) return;
    try {
      await currentSound?.pauseAsync?.();
    } catch {}
  }, 950);
}

export function useAmbientMusic(_track: TrackKey, enabled = true, volume = 0.22) {
  const isFocused = useIsFocused();
  const ownerRef = useRef(`music_${Math.random().toString(16).slice(2)}`);

  useEffect(() => {
    if (enabled && isFocused) {
      activate(ownerRef.current, volume);
    } else {
      deactivate(ownerRef.current);
    }

    return () => {
      deactivate(ownerRef.current);
    };
  }, [enabled, isFocused, volume]);
}
