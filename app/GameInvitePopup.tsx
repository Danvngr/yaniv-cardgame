import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { acceptGameInvite, declineGameInvite, subscribeToGameInvites, type GameInvite } from '../lib/userService';

export default function GameInvitePopup() {
  const { user } = useAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<GameInvite[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToGameInvites(user.uid, setInvites);
    return () => unsub();
  }, [user?.uid]);

  const invite = invites[0];
  const visible = !!invite && !processingId;

  const handleJoin = async () => {
    if (!invite) return;
    setProcessingId(invite.id);
    try {
      await acceptGameInvite(invite.id);
      router.replace({
        pathname: '/join-room',
        params: { code: invite.roomCode }
      });
    } catch (e) {
      console.warn('Accept invite failed', e);
    } finally {
      setProcessingId(null);
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
          <Text style={styles.title}>הזמנה למשחק</Text>
          <Text style={styles.from}>{invite.fromName} מזמין/ה אותך למשחק</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.joinBtn]} onPress={handleJoin}>
              <Text style={styles.btnText}>הצטרף</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.declineBtn]} onPress={handleDecline}>
              <Text style={styles.btnText}>דחה</Text>
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
