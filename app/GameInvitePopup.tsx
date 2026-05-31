import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../lib/firebase';
import { socketService } from '../lib/socketService';
import { acceptGameInvite, declineGameInvite, setUserInRoom, subscribeToGameInvites, type GameInvite } from '../lib/userService';

export default function GameInvitePopup() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  const [invites, setInvites] = useState<GameInvite[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const inviteRef = useRef<GameInvite | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToGameInvites(user.uid, setInvites);
    return () => unsub();
  }, [user?.uid]);

  const invite = invites[0];
  const visible = !!invite;

  const text = {
    en: {
      error: 'Error',
      profileLoading: 'Profile is still loading. Try again.',
      invalidRoomCode: 'Invalid room code',
      roomNotFound: 'Room not found',
      gameStarted: 'Game already in progress',
      joinFailed: 'Could not join. Try again.',
      title: 'Game Invitation',
      from: 'invited you to a game',
      join: 'Join',
      decline: 'Decline',
    },
    he: {
      error: 'שגיאה',
      profileLoading: 'הפרופיל טוען. נסה שוב.',
      invalidRoomCode: 'קוד חדר לא תקין',
      roomNotFound: 'החדר לא נמצא',
      gameStarted: 'המשחק כבר התחיל',
      joinFailed: 'לא הצלחנו להצטרף. נסה שוב.',
      title: 'הזמנה למשחק',
      from: 'מזמין/ה אותך למשחק',
      join: 'הצטרף',
      decline: 'דחה',
    },
  };
  const t = text[language];

  const handleJoin = async () => {
    if (!invite || !user || !profile) {
      if (!profile) Alert.alert(t.error, t.profileLoading);
      return;
    }
    setProcessingId(invite.id);
    setIsJoining(true);
    inviteRef.current = invite;
    try {
      await acceptGameInvite(invite.id);
      const code = String(invite.roomCode ?? '').trim().replace(/\s/g, '').toUpperCase();
      if (code.length !== 6) {
        Alert.alert(t.error, t.invalidRoomCode);
        setProcessingId(null);
        setIsJoining(false);
        return;
      }

      // Don't let socket try to rejoin an old room when we connect
      socketService.abandonReconnection();

      const prevOnRoomJoined = socketService.onRoomJoined;
      const prevOnError = socketService.onError;
      const prevOnConnected = socketService.onConnected;

      socketService.onRoomJoined = (room) => {
        socketService.onRoomJoined = prevOnRoomJoined;
        socketService.onError = prevOnError;
        socketService.onConnected = prevOnConnected;
        if (user) setUserInRoom(user.uid, true).catch(() => {});
        setProcessingId(null);
        setIsJoining(false);
        inviteRef.current = null;
        router.replace({
          pathname: '/game',
          params: {
            roomCode: room.code,
            limit: String(room.settings.scoreLimit),
            assaf: room.settings.allowSticking ? 'yes' : 'no',
            isOnline: 'true'
          }
        });
      };

      socketService.onError = (message) => {
        socketService.onRoomJoined = prevOnRoomJoined;
        socketService.onError = prevOnError;
        socketService.onConnected = prevOnConnected;
        setProcessingId(null);
        setIsJoining(false);
        inviteRef.current = null;
        const msg = message === 'Room not found' ? t.roomNotFound : message === 'Game already in progress' ? t.gameStarted : message;
        Alert.alert(t.error, msg);
      };

      if (!socketService.isConnected()) {
        const token = await auth.currentUser?.getIdToken();
        socketService.connect(token);
        socketService.onConnected = () => {
          socketService.onConnected = prevOnConnected;
          if (prevOnConnected) prevOnConnected();
          socketService.joinRoom(code, profile.username, profile.avatar);
        };
      } else {
        socketService.joinRoom(code, profile.username, profile.avatar);
      }
    } catch (e) {
      console.warn('Accept invite failed', e);
      setProcessingId(null);
      setIsJoining(false);
      inviteRef.current = null;
      Alert.alert(t.error, t.joinFailed);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;
    setProcessingId(invite.id);
    try {
      await declineGameInvite(invite.id);
    } catch (e) {
      console.warn('Decline invite failed', e);
    } finally {
      setProcessingId(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.from}>{invite.fromName} {t.from}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.joinBtn]} onPress={handleJoin} disabled={isJoining}>
              {isJoining ? <ActivityIndicator size="small" color="#2D1F14" /> : <Text style={styles.btnText}>{t.join}</Text>}
            </Pressable>
            <Pressable style={[styles.btn, styles.declineBtn]} onPress={handleDecline}>
              <Text style={styles.btnText}>{t.decline}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#F5E6D3',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#8B7355',
    minWidth: 280,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D1F14',
    textAlign: 'center',
    marginBottom: 8,
  },
  from: {
    fontSize: 16,
    color: '#5B8A72',
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  joinBtn: {
    backgroundColor: '#5B8A72',
  },
  declineBtn: {
    backgroundColor: 'rgba(139, 115, 85, 0.3)',
  },
  btnText: {
    color: '#2D1F14',
    fontWeight: '600',
    fontSize: 16,
  },
});
