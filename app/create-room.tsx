import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Check, Crown, Trophy, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { setUserInRoom } from '../lib/userService';
import { socketService } from '../lib/socketService';

export default function CreateRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [scoreLimit, setScoreLimit] = useState(200);
  const [allowSticking, setAllowSticking] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Game Settings',
      scoreLimit: 'Score Limit',
      sticking: 'Allow Sticking?',
      yes: 'Yes',
      no: 'No',
      continueBtn: 'Continue to Create Room',
      creating: 'Creating...',
      connectionError: 'Connection Error',
    },
    he: {
      title: 'הגדרות משחק',
      scoreLimit: 'תקרת ניקוד',
      sticking: 'הדבקות?',
      yes: 'כן',
      no: 'לא',
      continueBtn: 'המשך ליצירת חדר',
      creating: 'יוצר חדר...',
      connectionError: 'שגיאת חיבור',
    }
  };

  const t = text[language];

  useEffect(() => {
    if (params.limit) {
      const parsed = parseInt(params.limit as string, 10);
      if (!Number.isNaN(parsed)) {
        setScoreLimit(parsed);
      }
    }
    if (params.assaf) {
      setAllowSticking(params.assaf === 'yes');
    }
  }, [params.limit, params.assaf]);

  // Connect to server when screen loads
  useEffect(() => {
    const connectWithAuth = async () => {
      if (!socketService.isConnected()) {
        setIsConnecting(true);
        // Get auth token and connect
        const token = await auth.currentUser?.getIdToken();
        socketService.connect(token);
      }
    };

    connectWithAuth();

    // Setup callbacks
    socketService.onConnected = () => {
      setIsConnecting(false);
    };

    socketService.onError = (message) => {
      setIsConnecting(false);
      setIsCreating(false);
      Alert.alert(t.connectionError, message);
    };

    socketService.onRoomCreated = (code) => {
      console.log('[CreateRoom] Room created:', code);
    };

    socketService.onRoomJoined = (room) => {
      setIsCreating(false);
      if (user) setUserInRoom(user.uid, true).catch(() => {});
      // Navigate to waiting room with room data
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
      // Don't disconnect here - we need the connection for the game
      socketService.onConnected = undefined;
      socketService.onError = undefined;
      socketService.onRoomCreated = undefined;
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

  const handleCreateRoom = () => {
    if (!profile) {
      Alert.alert(
        language === 'he' ? 'שגיאה' : 'Error',
        language === 'he' ? 'הפרופיל עדיין לא נטען. נסה שוב.' : 'Profile not loaded yet. Please try again.'
      );
      return;
    }
    
    // Make sure we're connected before trying to create room
    if (!socketService.isConnected()) {
      setIsConnecting(true);
      socketService.connect();
      // Wait a bit for connection then try to create
      setTimeout(() => {
        if (socketService.isConnected()) {
          setIsConnecting(false);
          setIsCreating(true);
          socketService.createRoom(
            { scoreLimit, allowSticking },
            profile.username,
            profile.avatar
          );
        } else {
          setIsConnecting(false);
          Alert.alert(
            language === 'he' ? 'שגיאה' : 'Error',
            language === 'he' ? 'לא הצלחנו להתחבר לשרת. נסה שוב.' : 'Could not connect to server. Please try again.'
          );
        }
      }, 2000);
      return;
    }
    
    setIsCreating(true);
    
    socketService.createRoom(
      { scoreLimit, allowSticking },
      profile.username,
      profile.avatar
    );
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/lobby-background.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
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
              <Text style={styles.connectingText}>מתחבר לשרת...</Text>
            </View>
          )}

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.screenTitle}>{t.title}</Text>
          </View>

          {/* Settings Cards */}
          <View style={styles.cardsContainer}>
            
            {/* Score Limit */}
            <View style={styles.settingCard}>
              <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.3)' }]}>
                  <Trophy size={20} color="#FFD700" />
                </View>
                <Text style={styles.cardTitle}>{t.scoreLimit}</Text>
              </View>
              <View style={[styles.optionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                 {[200, 100].map((option) => (
                   <Pressable 
                     key={option} 
                     onPress={() => setScoreLimit(option)}
                     style={[styles.optionBtn, scoreLimit === option && styles.optionBtnActive]}
                   >
                     {scoreLimit === option && <Check size={16} color="#fff" style={{marginRight: 5}} />}
                     <Text style={[styles.optionText, scoreLimit === option && styles.optionTextActive]}>{option}</Text>
                   </Pressable>
                 ))}
              </View>
            </View>

            {/* Sticking / Assaf */}
            <View style={styles.settingCard}>
              <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(91, 138, 114, 0.3)' }]}>
                  <Zap size={20} color="#5B8A72" />
                </View>
                <Text style={styles.cardTitle}>{t.sticking}</Text>
              </View>
              <View style={[styles.optionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Pressable onPress={() => setAllowSticking(true)} style={[styles.optionBtn, allowSticking && styles.optionBtnActiveGreen]}>
                     {allowSticking && <Check size={16} color="#fff" style={{marginRight: 5}} />}
                     <Text style={[styles.optionText, allowSticking && styles.optionTextActive]}>{t.yes}</Text>
                  </Pressable>
                  <Pressable onPress={() => setAllowSticking(false)} style={[styles.optionBtn, !allowSticking && styles.optionBtnActiveRed]}>
                     {!allowSticking && <Check size={16} color="#fff" style={{marginRight: 5}} />}
                     <Text style={[styles.optionText, !allowSticking && styles.optionTextActive]}>{t.no}</Text>
                  </Pressable>
              </View>
            </View>

          </View>

          {/* Continue Button */}
          <Pressable 
            onPress={handleCreateRoom}
            disabled={isConnecting || isCreating}
            style={[styles.mainButton, (isConnecting || isCreating) && styles.mainButtonDisabled]}
          >
            {isCreating ? (
              <>
                <ActivityIndicator size="small" color="#F5E6D3" />
                <Text style={styles.mainButtonText}>{t.creating}</Text>
              </>
            ) : (
              <>
                <Crown size={24} color="#FFD700" />
                <Text style={styles.mainButtonText}>{t.continueBtn}</Text>
              </>
            )}
          </Pressable>

        </ScrollView>
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
  scrollContent: { padding: 20, paddingTop: 60, flexGrow: 1 },
  topBar: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  iconButton: { 
    backgroundColor: '#5C4A32', 
    padding: 10, 
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  screenTitle: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#F5E6D3', 
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  cardsContainer: { gap: 20, marginBottom: 40 },
  settingCard: { 
    backgroundColor: 'rgba(75, 55, 40, 0.95)', 
    borderRadius: 20, 
    padding: 20,
    borderWidth: 3,
    borderColor: '#8B7355',
    elevation: 5 
  },
  cardHeader: { alignItems: 'center', marginBottom: 15, gap: 10 },
  iconBox: { 
    padding: 8, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#F5E6D3' },
  optionsRow: { gap: 10 },
  optionBtn: { 
    flex: 1, 
    backgroundColor: 'rgba(92, 74, 50, 0.5)', 
    padding: 15, 
    borderRadius: 15, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  optionBtnActive: { backgroundColor: '#5B8A72', borderColor: '#3D5E4A' },
  optionBtnActiveGreen: { backgroundColor: '#5B8A72', borderColor: '#3D5E4A' },
  optionBtnActiveRed: { backgroundColor: '#9B4444', borderColor: '#7A3333' },
  optionText: { color: 'rgba(245, 230, 211, 0.7)', fontWeight: 'bold', fontSize: 16 },
  optionTextActive: { color: '#fff' },
  mainButton: { 
    backgroundColor: '#5C4A32', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 20, 
    gap: 10, 
    borderWidth: 3,
    borderColor: '#8B7355',
    elevation: 5 
  },
  mainButtonDisabled: { backgroundColor: 'rgba(92, 74, 50, 0.5)', borderColor: '#6B5344' },
  mainButtonText: { fontSize: 20, fontWeight: 'bold', color: '#F5E6D3' },
  connectingBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    backgroundColor: 'rgba(92, 74, 50, 0.8)', 
    padding: 10, 
    borderRadius: 10, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  connectingText: { color: '#F5E6D3', fontWeight: '600' },
});
