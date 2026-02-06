import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  buildDefaultProfile,
  createUserProfile,
  getUserProfile,
  type UserProfile,
  updateUserProfile,
  updateLastSeen,
  updateUsername,
} from '../lib/userService';

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_USERNAME_KEY = 'profile:username';
const PROFILE_AVATAR_KEY = 'profile:avatar';

const normalizeProfile = (data: Partial<UserProfile>, fallback: UserProfile): UserProfile => {
  // CRITICAL: Always preserve existing username/avatar - never override with fallback
  // Only use fallback if the field is truly missing (undefined/null/empty)
  return {
    username: (data.username && data.username.trim()) ? data.username : fallback.username,
    avatar: data.avatar ? data.avatar : fallback.avatar,
    coins: typeof data.coins === 'number' ? data.coins : fallback.coins,
    createdAt: data.createdAt ?? fallback.createdAt,
    stats: data.stats ?? fallback.stats,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureProfile = async (nextUser: User) => {
    try {
      const fallback = buildDefaultProfile(nextUser);
      const existing = await getUserProfile(nextUser.uid);
      if (!existing) {
        // New user - create profile with default values
        await createUserProfile(nextUser.uid, fallback);
        setProfile(fallback);
        return;
      }
      // Existing user - preserve their data, only use fallback for missing fields
      // CRITICAL: Always preserve existing username/avatar - never override with fallback
      // Use normalizeProfile but ensure we preserve existing values
      const normalized = normalizeProfile(existing, fallback);
      
      // Double-check: if existing has username, use it (don't trust normalizeProfile fallback)
      if (existing.username && existing.username.trim()) {
        normalized.username = existing.username;
      }
      if (existing.avatar) {
        normalized.avatar = existing.avatar;
      }
      
      setProfile(normalized);
      // Cache latest profile fields for offline startup
      AsyncStorage.setItem(PROFILE_USERNAME_KEY, normalized.username).catch(() => {});
      AsyncStorage.setItem(PROFILE_AVATAR_KEY, normalized.avatar).catch(() => {});
      
      // Only update if profile is truly missing fields (not just empty strings)
      // But NEVER overwrite existing username/avatar
      const needsUpdate = 
        (!existing.username || !existing.username.trim()) || 
        !existing.avatar || 
        typeof existing.coins !== 'number' ||
        !existing.stats ||
        !existing.usernameLower;
      
      if (needsUpdate) {
        // Update missing fields but preserve existing username/avatar
        const updateData: Partial<UserProfile> = {};
        // Only update username if it's truly missing (not just empty)
        if (!existing.username || !existing.username.trim()) {
          updateData.username = normalized.username;
        }
        // Only update avatar if it's missing
        if (!existing.avatar) {
          updateData.avatar = normalized.avatar;
        }
        // Only update coins if it's missing
        if (typeof existing.coins !== 'number') {
          updateData.coins = normalized.coins;
        }
        // Only update stats if it's missing
        if (!existing.stats) {
          updateData.stats = normalized.stats;
        }
        if (!existing.usernameLower && normalized.username) {
          updateData.usernameLower = normalized.username.trim().toLowerCase();
        }
        
        if (Object.keys(updateData).length > 0) {
          await updateUserProfile(nextUser.uid, updateData);
        }
      }
    } catch (error) {
      // If profile fetch fails, try to get existing profile from cache or use fallback
      console.error('[Auth] Failed to ensure profile:', error);
      const fallback = buildDefaultProfile(nextUser);
      try {
        const cachedUsername = await AsyncStorage.getItem(PROFILE_USERNAME_KEY);
        const cachedAvatar = await AsyncStorage.getItem(PROFILE_AVATAR_KEY);
        setProfile({
          ...fallback,
          username: cachedUsername?.trim() ? cachedUsername : fallback.username,
          avatar: cachedAvatar || fallback.avatar,
        });
      } catch {
        setProfile(fallback);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      console.log('[Auth] Auth state changed:', nextUser ? `User: ${nextUser.uid}` : 'No user');
      
      setUser(nextUser);
      
      if (!nextUser) {
        console.log('[Auth] User logged out');
        setProfile(null);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        await ensureProfile(nextUser);
        // Update last seen for online status (don't block on this)
        // Only update after profile is ensured to exist (ensureProfile creates it if missing)
        updateLastSeen(nextUser.uid).catch((error) => {
          // Silently fail - profile might not exist yet, but ensureProfile should have created it
          console.error('[Auth] Failed to update last seen:', error);
        });
      } catch (error) {
        console.error('[Auth] Auth state change error:', error);
        // Don't lose the user if profile fetch fails - use fallback
        const fallback = buildDefaultProfile(nextUser);
        setProfile(fallback);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Update last seen periodically while user is logged in
  useEffect(() => {
    if (!user) return;

    // Update immediately (but don't block)
    updateLastSeen(user.uid).catch((error) => {
      // Silently fail - don't affect user session
      console.error('Failed to update last seen:', error);
    });

    // Then update every minute
    const intervalId = setInterval(() => {
      updateLastSeen(user.uid).catch((error) => {
        // Silently fail - don't affect user session
        console.error('Failed to update last seen:', error);
      });
    }, 60000); // Every minute

    return () => clearInterval(intervalId);
  }, [user]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const signInAsGuest = async () => {
    await signInAnonymously(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const updateData: Partial<UserProfile> = { ...data };
      if (typeof updateData.username === 'string') {
        await updateUsername(user.uid, updateData.username);
        // Keep Firebase Auth displayName in sync as a fallback
        await updateAuthProfile(user, { displayName: updateData.username });
        delete updateData.username;
      }
      if (Object.keys(updateData).length > 0) {
        await updateUserProfile(user.uid, updateData);
      }
      // Update local state immediately
      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, ...data };
      });
      if (typeof data.username === 'string') {
        AsyncStorage.setItem(PROFILE_USERNAME_KEY, data.username).catch(() => {});
      }
      if (typeof data.avatar === 'string') {
        AsyncStorage.setItem(PROFILE_AVATAR_KEY, data.avatar).catch(() => {});
      }
    } catch (error) {
      console.error('[Auth] Failed to update profile:', error);
      throw error; // Re-throw so caller can handle it
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOutUser,
      signInAsGuest,
      updateProfile,
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
