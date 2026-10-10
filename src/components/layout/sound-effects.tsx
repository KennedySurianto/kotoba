"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { getUiSoundVolume, playUiSound, setUiSoundVolume, setUiSoundsEnabled } from "@/lib/ui-sound";

export function SoundEffects() {
  useEffect(() => {
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>("a, button, [role='button']");
      if (!control || control.hasAttribute("disabled") || (event.relatedTarget instanceof Node && control.contains(event.relatedTarget))) return;
      playUiSound("hover");
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>("a, button, [role='button']");
      if (!control || control.hasAttribute("disabled") || control.dataset.sound === "off" || control.classList.contains("check-button")) return;
      playUiSound("click");
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}

export function SoundToggle() {
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    try {
      setIsEnabled(window.localStorage.getItem("kotoba-ui-sounds") !== "off");
    } catch {
      setIsEnabled(true);
    }
    const onSetting = (event: Event) => setIsEnabled((event as CustomEvent<boolean>).detail);
    window.addEventListener("kotoba:sound-setting", onSetting);
    return () => window.removeEventListener("kotoba:sound-setting", onSetting);
  }, []);

  const [volume, setVolume] = useState(60);

  useEffect(() => {
    setVolume(getUiSoundVolume());
    const onVolume = (event: Event) => setVolume((event as CustomEvent<number>).detail);
    window.addEventListener("kotoba:sound-volume", onVolume);
    return () => window.removeEventListener("kotoba:sound-volume", onVolume);
  }, []);

  return <div className="sound-controls">
    <button className="sound-toggle" type="button" data-sound="off" aria-label={isEnabled ? "Turn interface sounds off" : "Turn interface sounds on"} aria-pressed={isEnabled} title={isEnabled ? "Interface sounds on" : "Interface sounds off"} onClick={() => setUiSoundsEnabled(!isEnabled)}>{isEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
    <label className="sound-volume-control" title={`Sound volume: ${volume}%`}>
      <input type="range" min="0" max="100" step="1" value={volume} aria-label="Interface sound volume" onChange={(event) => setUiSoundVolume(Number(event.target.value))} />
      <span aria-hidden="true">{volume}%</span>
    </label>
  </div>;
}
