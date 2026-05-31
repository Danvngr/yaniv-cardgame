import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Search, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../lib/firebase';
import { setUserInRoom } from '../lib/userService';
import { socketService } from '../lib/socketService';

export default function JoinRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [roomCode, setRoomCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Join Room',
      placeholder: 'Enter room code...',
      joinBtn: 'Join Game',
      joining: 'Joining...',
      invalidCode: 'Code must be 6 characters',
      connectionError: 'Connection Error',
      roomNotFound: 'Room not found',
      gameInProgress: 'Game already in progress',
      roomFull: 'Room is full',
      error: 'Error',
      connecting: 'Connecting to server...',
      failedToJoin: 'Failed to join room',
      notConnected: 'Not connected to server',
      notAuthenticated: 'Not authenticated. Please reconnect.',
      profileNotLoaded: 'Profile not loaded yet. Please try again.',
    },
    he: {
      title: 'הצטרף לחדר',
      placeholder: 'הכנס קוד חדר...',
      joinBtn: 'הצטרף למשחק',
      joining: 'מצטרף...',
      invalidCode: 'הקוד חייב להכיל 6 תווים',
      connectionError: 'שגיאת חיבור',
      roomNotFound: 'החדר לא נמצא',
      gameInProgress: 'המשחק כבר התחיל',
      roomFull: 'החדר מלא',
      error: 'שגיאה',
      connecting: 'מתחבר לשרת...',
      failedToJoin: 'לא הצלחנו להצטרף לחדר',
      notConnected: 'לא מחובר לשרת',
      notAuthenticated: 'לא מאומת. צא מהמסך ונסה להתחבר שוב.',
      profileNotLoaded: 'הפרופיל עדיין לא נטען. נסה שוב.',
    }
  };

  const t = text[language];

  // Pre-fill room code when navigating from invite popup
  useEffect(() => {
    if (params.code && params.code.length === 6) {
      setRoomCode(params.code.toUpperCase());
    }
  }, [params.code]);

  // Connect to server when screen loads
  useEffect(() => {
    // Don't auto-rejoin an old room – we're here to enter a new code
    socketService.abandonReconnection();

    const connectWithAuth = async () => {
      if (!socketService.isConnected()) {
        setIsConnecting(true);
        // Get auth token and connect
        const token = await auth.currentUser?.getIdToken();
        socketService.connect(token);
      }
    };

    connectWithAuth();

    socketService.onConnected = () => {
      setIsConnecting(false);
    };

    socketService.onError = (message) => {
      setIsConnecting(false);
      setIsJoining(false);
      // Translate server error messages to Hebrew
      let translatedMessage = message;
      if (language === 'he') {
        if (message === 'Room not found') translatedMessage = t.roomNotFound;
        else if (message === 'Game already in progress') translatedMessage = t.gameInProgress;
        else if (message === 'Room is full') translatedMessage = t.roomFull;
        else if (message === 'Failed to join room') translatedMessage = t.failedToJoin;
        else if (message === 'Not connected to server') translatedMessage = t.notConnected;
        else if (message === 'Not authenticated. Please reconnect.') translatedMessage = t.notAuthenticated;
      }
      Alert.alert(t.error, translatedMessage);
    };

    socketService.onRoomJoined = (room) => {
      setIsJoining(false);
      if (user) setUserInRoom(user.uid, true).catch(() => {});
      router.replace({
        pathname: '/game',
        params: {
          roomCode: room.code,
          limit: room.settings.scoreLimit,
          assaf: room.settings.allowSticking ? 'yes' : 'no',
          isOnline: 'true'
        }
      });
    };

    return () => {
      socketService.onConnected = undefined;
      socketService.onError = undefined;
      socketService.onRoomJoined = undefined;
    };
  }, [user]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/friends');
    }
  };

  const handleJoin = async () => {
    if (!profile) {
      Alert.alert(
        t.error,
        t.profileNotLoaded
      );
      return;
    }
    const code = String(roomCode || '').trim().replace(/\s/g, '').toUpperCase();
    if (code.length !== 6) {
      Alert.alert('', t.invalidCode);
      return;
    }

    socketService.abandonReconnection();

    if (!socketService.isConnected()) {
      setIsConnecting(true);
      const token = await auth.currentUser?.getIdToken();
      const prevOnConnected = socketService.onConnected;
      socketService.onConnected = () => {
        socketService.onConnected = prevOnConnected;
        if (prevOnConnected) prevOnConnected();
        setIsConnecting(false);
        setIsJoining(true);
        socketService.joinRoom(code, profile.username, profile.avatar);
      };
      socketService.connect(token);
      return;
    }

    setIsJoining(true);
    socketService.joinRoom(code, profile.username, profile.avatar);
  };

  const normalizedCode = roomCode.trim().replace(/\s/g, '').toUpperCase();
  const isCodeValid = normalizedCode.length === 6;

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/lobby-background.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        
        {/* Top Bar */}
        <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <ArrowRight color="#F5E6D3" size={24} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
          </Pressable>
          
          <View style={{ width: 50 }} />
        </View>

        {/* Connection Status */}
        {isConnecting && (
          <View style={styles.connectingBanner}>
            <ActivityIndicator size="small" color="#F5E6D3" />
            <Text style={styles.connectingText}>{t.connecting}</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <View style={styles.titleIconBox}>
              <Users size={48} color="#FFD700" />
            </View>
            <Text style={styles.screenTitle}>{t.title}</Text>
          </View>

          {/* Code Input Card */}
          <View style={styles.inputCard}>
            <View style={styles.inputContainer}>
              <Search size={24} color="#8B7355" />
              <TextInput
                style={styles.input}
                placeholder={t.placeholder}
                placeholderTextColor="rgba(245, 230, 211, 0.5)"
                value={roomCode}
                onChangeText={(text) => setRoomCode(text.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.codeCounter}>{roomCode.length}/6</Text>
          </View>

          {/* Join Button */}
          <Pressable 
            onPress={handleJoin}
            disabled={isConnecting || isJoining || !isCodeValid}
            style={[styles.joinButton, (!isCodeValid || isConnecting || isJoining) && styles.joinButtonDisabled]}
          >
            {isJoining ? (
              <>
                <ActivityIndicator size="small" color="#F5E6D3" />
                <Text style={styles.joinButtonText}>{t.joining}</Text>
              </>
            ) : (
              <Text style={styles.joinButtonText}>{t.joinBtn}</Text>
            )}
          </Pressable>
        </View>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  topBar: { 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  iconButton: { 
    backgroundColor: '#5C4A32', 
    padding: 10, 
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  connectingBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    backgroundColor: 'rgba(92, 74, 50, 0.8)', 
    padding: 10, 
    marginHorizontal: 20, 
    borderRadius: 10, 
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  connectingText: { color: '#F5E6D3', fontWeight: '600' },
  
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
    marginTop: -60,
  },
  
  titleContainer: { alignItems: 'center', marginBottom: 40 },
  titleIconBox: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    padding: 16,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  screenTitle: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#F5E6D3', 
    textShadowColor: 'rgba(0,0,0,0.5)', 
    textShadowRadius: 4 
  },

  inputCard: { 
    backgroundColor: 'rgba(75, 55, 40, 0.95)', 
    borderRadius: 20, 
    padding: 20, 
    width: '100%',
    maxWidth: 340,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#8B7355',
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F5E6D3',
    textAlign: 'center',
    letterSpacing: 4,
  },
  codeCounter: {
    textAlign: 'center',
    color: 'rgba(245, 230, 211, 0.5)',
    fontSize: 12,
    marginTop: 10,
  },

  joinButton: {
    backgroundColor: '#5B8A72',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 5,
    width: '100%',
    maxWidth: 340,
    borderWidth: 3,
    borderColor: '#3D5E4A',
  },
  joinButtonDisabled: {
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
    borderColor: '#8B7355',
  },
  joinButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
});
