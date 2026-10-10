export type UiSound = "hover" | "click" | "correct" | "incorrect";

const STORAGE_KEY = "kotoba-ui-sounds";
const VOLUME_KEY = "kotoba-ui-volume";
let audioContext: AudioContext | null = null;
let enabled: boolean | null = null;
let volume: number | null = null;

function soundsEnabled() {
  if (enabled === null) {
    try {
      enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function setUiSoundsEnabled(value: boolean) {
  enabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // Keep the setting for this page session when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent("kotoba:sound-setting", { detail: value }));
}

export function getUiSoundVolume() {
  if (volume === null) {
    try {
      const stored = Number(window.localStorage.getItem(VOLUME_KEY));
      volume = Number.isFinite(stored) && window.localStorage.getItem(VOLUME_KEY) !== null ? Math.min(100, Math.max(0, stored)) : 60;
    } catch {
      volume = 60;
    }
  }
  return volume;
}

export function setUiSoundVolume(value: number) {
  volume = Math.min(100, Math.max(0, value));
  try {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Keep the setting for this page session when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent("kotoba:sound-volume", { detail: volume }));
}

export function playUiSound(sound: UiSound) {
  if (typeof window === "undefined" || !soundsEnabled()) return;

  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return;
  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === "suspended") void audioContext.resume();

  const now = audioContext.currentTime;
  const notes: Record<UiSound, { frequency: number; delay: number; duration: number; volume: number }[]> = {
    hover: [{ frequency: 880, delay: 0, duration: 0.045, volume: 0.018 }],
    click: [{ frequency: 520, delay: 0, duration: 0.065, volume: 0.035 }],
    correct: [
      { frequency: 660, delay: 0, duration: 0.13, volume: 0.045 },
      { frequency: 880, delay: 0.105, duration: 0.19, volume: 0.04 },
    ],
    incorrect: [
      { frequency: 280, delay: 0, duration: 0.12, volume: 0.04 },
      { frequency: 220, delay: 0.09, duration: 0.17, volume: 0.035 },
    ],
  };

  for (const note of notes[sound]) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + note.delay;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.volume * (getUiSoundVolume() / 100), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + note.duration + 0.015);
  }
}
