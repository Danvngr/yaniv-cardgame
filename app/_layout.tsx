import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SoundProvider } from '../context/SoundContext';
import GameInvitePopup from './GameInvitePopup';
import { preloadAssets } from '../lib/assetPreloader';
import { loadGameSounds } from '../lib/gameSounds';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function LoadingScreen({ progress }: { progress: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={loadingStyles.container}>
      {/* Background */}
      <View style={loadingStyles.background} />
      
      <Animated.View style={[loadingStyles.content, { opacity: fadeAnim }]}>
        {/* Title */}
        <Text style={loadingStyles.title}>יניב</Text>
        <Text style={loadingStyles.subtitle}>Yaniv</Text>
        
        {/* Card suits decoration */}
        <View style={loadingStyles.suitsRow}>
          <Text style={loadingStyles.suit}>♠</Text>
          <Text style={[loadingStyles.suit, loadingStyles.redSuit]}>♥</Text>
          <Text style={[loadingStyles.suit, loadingStyles.redSuit]}>♦</Text>
          <Text style={loadingStyles.suit}>♣</Text>
        </View>
        
        {/* Progress bar */}
        <View style={loadingStyles.progressContainer}>
          <View style={loadingStyles.progressBackground}>
            <View 
              style={[
                loadingStyles.progressFill, 
                { width: `${Math.round(progress * 100)}%` }
              ]} 
            />
          </View>
          <Text style={loadingStyles.progressText}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        
        <Text style={loadingStyles.loadingText}>טוען משאבים...</Text>
      </Animated.View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2D1F14',
  },
  content: {
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F5E6D3',
    marginBottom: 30,
    opacity: 0.8,
  },
  suitsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  suit: {
    fontSize: 32,
    color: '#F5E6D3',
  },
  redSuit: {
    color: '#DC2626',
  },
  progressContainer: {
    width: 250,
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(139, 115, 85, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5B8A72',
    borderRadius: 4,
  },
  progressText: {
    color: '#F5E6D3',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  loadingText: {
    color: 'rgba(245, 230, 211, 0.6)',
    fontSize: 14,
  },
});

function RootLayoutNav() {
  const { user, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isInGameRef = useRef(false);
  
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Disable Android hardware back button globally
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      return true;
    });
    return () => backHandler.remove();
  }, []);

  // Preload assets (images + sounds)
  useEffect(() => {
    const loadAll = async () => {
      try {
        await Promise.all([
          preloadAssets((loaded, total) => {
            setLoadProgress(loaded / total);
          }),
          loadGameSounds(),
        ]);
      } catch (error) {
        console.error('Failed to preload assets:', error);
      } finally {
        setAssetsLoaded(true);
      }
    };

    loadAll();
  }, []);

  // Hide splash screen when everything is ready
  const onLayoutReady = useCallback(async () => {
    if (assetsLoaded && !authLoading) {
      await SplashScreen.hideAsync();
    }
  }, [assetsLoaded, authLoading]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  useEffect(() => {
    if (authLoading || !assetsLoaded) return;
    
    // Get current route path
    const routePath = segments.join('/') || '';
    const firstSegment = segments[0] ?? '';

    // Avoid redirects while router is still resolving segments
    if (segments.length === 0 || routePath === '') {
      return;
    }
    
    const isAuthRoute = firstSegment === '' || firstSegment === 'index' || firstSegment === 'signup';
    
    // Don't redirect if user is in game screens or other protected routes
    const isGameRoute = routePath.includes('game-table') || routePath.includes('round-summary') || 
                        routePath.includes('game-over') || routePath.includes('game') ||
                        firstSegment === 'friends' || firstSegment === 'create-room' ||
                        firstSegment === 'shop' || firstSegment === 'leaderboard' ||
                        firstSegment === 'stats' || firstSegment === 'notifications' ||
                        firstSegment === 'friends-list' || firstSegment === 'settings' ||
                        firstSegment === 'lobby';

    // CRITICAL: Never redirect if user is in game flow - this prevents kicking users out mid-game
    if (isGameRoute) {
      isInGameRef.current = true;
      return; // Don't do anything if in game
    }

    // If we were in game and now we're not, reset the flag
    if (isInGameRef.current && !isGameRoute) {
      isInGameRef.current = false;
    }

    // Only redirect unauthenticated users away from protected routes (but not if we were just in game)
    if (!user && !isAuthRoute && !isInGameRef.current) {
      console.log('[Layout] Redirecting to login - no user, route:', routePath);
      router.replace('/');
    }
    // Only redirect authenticated users from auth routes to lobby (but not if we were just in game)
    else if (user && isAuthRoute && !isInGameRef.current) {
      console.log('[Layout] Redirecting to lobby - user authenticated, route:', routePath);
      router.replace('/lobby');
    }
  }, [user, authLoading, assetsLoaded, segments, router]);

  // Show loading screen while assets or auth are loading
  if (!assetsLoaded || authLoading) {
    return <LoadingScreen progress={assetsLoaded ? 1 : loadProgress} />;
  }

  return (
    <>
      <Stack screenOptions={{ 
        headerShown: false,
        gestureEnabled: false, // Disable swipe back gesture on iOS
        animation: 'fade', // Use fade instead of slide to prevent swipe back
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(protected)" />
      </Stack>
      {user ? <GameInvitePopup /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SoundProvider>
        <RootLayoutNav />
      </SoundProvider>
    </AuthProvider>
  );
}
