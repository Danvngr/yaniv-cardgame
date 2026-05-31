import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const STORAGE_MUSIC = 'sound:musicOn';
const STORAGE_SFX = 'sound:sfxOn';

let backgroundMusicPlayer: AudioPlayer | null = null;

type SoundContextValue = {
  musicOn: boolean;
  setMusicOn: (on: boolean) => void;
  sfxOn: boolean;
  setSfxOn: (on: boolean) => void;
};

const SoundContext = createContext<SoundContextValue | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [musicOn, setMusicOnState] = useState(true);
  const [sfxOn, setSfxOnState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const bgMusicRef = useRef<AudioPlayer | null>(null);
  const isMusicLoadedRef = useRef(false);

  // Load preferences from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([
          AsyncStorage.getItem(STORAGE_MUSIC),
          AsyncStorage.getItem(STORAGE_SFX),
        ]);
        if (m !== null) setMusicOnState(m === 'true');
        if (s !== null) setSfxOnState(s === 'true');
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  // Load background music once (do not play until settings + sound are ready)
  useEffect(() => {
    let isMounted = true;
    const loadBackgroundMusic = async () => {
      if (isMusicLoadedRef.current) return;
      try {
        if (backgroundMusicPlayer) {
          bgMusicRef.current = backgroundMusicPlayer;
          isMusicLoadedRef.current = true;
          setSoundReady(true);
          return;
        }

        await (setAudioModeAsync as any)({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'duckOthers',
        });
        const sound = createAudioPlayer(
          require('../assets/sounds/tropy.mp3'),
          { downloadFirst: true, keepAudioSessionActive: true }
        );
        sound.loop = true;
        sound.volume = 0.3;

        if (!isMounted) {
          sound.remove();
          return;
        }

        backgroundMusicPlayer = sound;
        if (isMounted) {
          bgMusicRef.current = sound;
          isMusicLoadedRef.current = true;
          setSoundReady(true);
        }
      } catch (e) {
        console.warn('Failed to load background music:', e);
      }
    };
    loadBackgroundMusic();
    return () => {
      isMounted = false;
      if (bgMusicRef.current) {
        try {
          bgMusicRef.current.pause();
          bgMusicRef.current.remove();
        } catch {}
        if (backgroundMusicPlayer === bgMusicRef.current) {
          backgroundMusicPlayer = null;
        }
        bgMusicRef.current = null;
        isMusicLoadedRef.current = false;
      }
    };
  }, []);

  // Play/stop background music per setting (only after prefs and sound are loaded)
  useEffect(() => {
    if (!loaded || !soundReady) return;
    const sound = bgMusicRef.current;
    if (!sound) return;

    if (musicOn) {
      try {
        sound.play();
      } catch {}
    } else {
      try {
        sound.pause();
      } catch {}
    }
  }, [musicOn, loaded, soundReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bgMusicRef.current) {
        try {
          bgMusicRef.current.pause();
          bgMusicRef.current.remove();
        } catch {}
        if (backgroundMusicPlayer === bgMusicRef.current) {
          backgroundMusicPlayer = null;
        }
        bgMusicRef.current = null;
      }
    };
  }, []);

  const setMusicOn = (on: boolean) => {
    setMusicOnState(on);
    AsyncStorage.setItem(STORAGE_MUSIC, String(on)).catch(() => {});
  };

  const setSfxOn = (on: boolean) => {
    setSfxOnState(on);
    AsyncStorage.setItem(STORAGE_SFX, String(on)).catch(() => {});
  };

  const value: SoundContextValue = {
    musicOn,
    setMusicOn,
    sfxOn,
    setSfxOn,
  };

  if (!loaded) {
    return null;
  }

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (ctx === undefined) {
    throw new Error('useSound must be used within SoundProvider');
  }
  return ctx;
}
