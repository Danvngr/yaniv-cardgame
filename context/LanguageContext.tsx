import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'he' | 'en';

type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
};

const LANGUAGE_KEY = 'app:language';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('he');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => {
        if (!mounted) return;
        if (saved === 'he' || saved === 'en') {
          setLanguageState(saved);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = async (next: Language) => {
    setLanguageState(next);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // Best-effort persistence; keep UI responsive even if storage fails.
    }
  };

  const toggleLanguage = async () => {
    const next: Language = language === 'he' ? 'en' : 'he';
    await setLanguage(next);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, toggleLanguage }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
