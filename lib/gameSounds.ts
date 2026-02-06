import { Audio } from 'expo-av';

let yanivSound: Audio.Sound | null = null;
let assafSound: Audio.Sound | null = null;
let stickSound: Audio.Sound | null = null;

export async function loadGameSounds(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const [y, a, s] = await Promise.all([
      Audio.Sound.createAsync(require('../assets/sounds/yaniv.wav')),
      Audio.Sound.createAsync(require('../assets/sounds/assaf.wav')),
      Audio.Sound.createAsync(require('../assets/sounds/stick.wav')),
    ]);
    yanivSound = y.sound;
    assafSound = a.sound;
    stickSound = s.sound;
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
