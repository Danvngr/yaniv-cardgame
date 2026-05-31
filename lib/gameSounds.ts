import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let yanivSound: AudioPlayer | null = null;
let assafSound: AudioPlayer | null = null;
let stickSound: AudioPlayer | null = null;
let pickSound: AudioPlayer | null = null;
let flickSound: AudioPlayer | null = null;

function replaySound(player: AudioPlayer | null): void {
  if (!player) return;
  player.seekTo(0)
    .then(() => player.play())
    .catch(() => {
      try {
        player.play();
      } catch {}
    });
}

export async function loadGameSounds(): Promise<void> {
  try {
    await (setAudioModeAsync as any)({
      // Keep SFX audible on iOS even when hardware mute switch is on.
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    });

    const loadOne = async (label: string, asset: number): Promise<AudioPlayer | null> => {
      try {
        return createAudioPlayer(asset, {
          downloadFirst: true,
          keepAudioSessionActive: true,
        });
      } catch (err) {
        console.warn(`[SFX] Failed to load ${label}:`, err);
        return null;
      }
    };

    // Load each SFX independently so one missing file does not disable all sounds.
    yanivSound = await loadOne('yaniv.wav', require('../assets/sounds/yaniv.wav'));
    assafSound = await loadOne('assaf.wav', require('../assets/sounds/assaf.wav'));
    stickSound = await loadOne('stick.wav', require('../assets/sounds/stick.wav'));
    pickSound = await loadOne('pick.mp3', require('../assets/sounds/pick.mp3'));
    flickSound = await loadOne('flick.mp3', require('../assets/sounds/flick.mp3'));
  } catch (e) {
    console.warn('Failed to load game sounds:', e);
  }
}

export function playYaniv(on: boolean): void {
  if (!on) return;
  replaySound(yanivSound);
}

export function playAssaf(on: boolean): void {
  if (!on) return;
  replaySound(assafSound);
}

export function playStick(on: boolean): void {
  if (!on) return;
  replaySound(stickSound);
}

export function playPick(on: boolean): void {
  if (!on) return;
  replaySound(pickSound);
}

export function playFlick(on: boolean): void {
  if (!on) return;
  replaySound(flickSound);
}
