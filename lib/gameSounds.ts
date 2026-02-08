import { Audio } from 'expo-av';

let yanivSound: Audio.Sound | null = null;
let assafSound: Audio.Sound | null = null;
let stickSound: Audio.Sound | null = null;
let pickSound: Audio.Sound | null = null;
let flickSound: Audio.Sound | null = null;

export async function loadGameSounds(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const [y, a, s, p, f] = await Promise.all([
      Audio.Sound.createAsync(require('../assets/sounds/yaniv.wav')),
      Audio.Sound.createAsync(require('../assets/sounds/assaf.wav')),
      Audio.Sound.createAsync(require('../assets/sounds/stick.wav')),
      Audio.Sound.createAsync(require('../assets/sounds/pick.mp3')),
      Audio.Sound.createAsync(require('../assets/sounds/flick.mp3')),
    ]);
    yanivSound = y.sound;
    assafSound = a.sound;
    stickSound = s.sound;
    pickSound = p.sound;
    flickSound = f.sound;
  } catch (e) {
    console.warn('Failed to load game sounds:', e);
  }
}

export function playYaniv(on: boolean): void {
  if (!on || !yanivSound) return;
  yanivSound.replayAsync().catch(() => {});
}

export function playAssaf(on: boolean): void {
  if (!on || !assafSound) return;
  assafSound.replayAsync().catch(() => {});
}

export function playStick(on: boolean): void {
  if (!on || !stickSound) return;
  stickSound.replayAsync().catch(() => {});
}

export function playPick(on: boolean): void {
  if (!on || !pickSound) return;
  pickSound.replayAsync().catch(() => {});
}

export function playFlick(on: boolean): void {
  if (!on || !flickSound) return;
  flickSound.replayAsync().catch(() => {});
}
