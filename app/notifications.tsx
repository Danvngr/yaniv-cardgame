import { useRouter } from 'expo-router';
import type { Timestamp } from 'firebase/firestore';
import { ArrowRight, Bell, Check, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
    acceptFriendRequest,
    acceptGameInvite,
    declineFriendRequest,
    declineGameInvite,
    getUserProfile,
    subscribeToFriendRequests,
    subscribeToGameInvites
} from '../lib/userService';

type GameInvite = {
  id: string;
  fromName: string;
  avatar: string;
  roomCode: string;
  sentAt: number;
  fromUid: string;
};

type FriendRequest = {
  id: string;
  fromName: string;
  avatar: string;
  sentAt: number;
  fromUid: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [invites, setInvites] = useState<GameInvite[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const previousInvitesRef = useRef<Set<string>>(new Set());

  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Notifications',
      clearAll: 'Clear All',
      gameInvites: 'Game Invites',
      friendRequests: 'Friend Requests',
      noInvites: 'No invites right now',
      noRequests: 'No requests right now',
      join: 'Join',
      accept: 'Accept',
      decline: 'Decline',
      from: 'from',
      roomCode: 'Room',
      actionDone: 'Updated',
      loading: 'Loading...',
    },
    he: {
      title: 'התראות',
      clearAll: 'נקה הכל',
      gameInvites: 'הזמנות למשחק',
      friendRequests: 'בקשות חברות',
      noInvites: 'אין הזמנות כרגע',
      noRequests: 'אין בקשות כרגע',
      join: 'הצטרף',
      accept: 'אשר',
      decline: 'דחה',
      from: 'מאת',
      roomCode: 'חדר',
      actionDone: 'עודכן',
      loading: 'טוען...',
    },
  };

  const t = text[language];

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to friend requests
    const unsubscribeRequests = subscribeToFriendRequests(user.uid, async (firestoreRequests) => {
      const requestsWithProfiles: FriendRequest[] = [];
      for (const req of firestoreRequests) {
        const profile = await getUserProfile(req.from);
        if (profile) {
          const createdAt = req.createdAt as Timestamp;
          requestsWithProfiles.push({
            id: req.id,
            fromName: profile.username,
            avatar: profile.avatar,
            sentAt: createdAt?.toMillis ? createdAt.toMillis() : Date.now(),
            fromUid: req.from,
          });
        }
      }
      setRequests(requestsWithProfiles);
      setLoading(false);
    });

    // Subscribe to game invites
    const unsubscribeInvites = subscribeToGameInvites(user.uid, async (firestoreInvites) => {
      const invitesWithProfiles: GameInvite[] = [];
      const currentInviteIds = new Set<string>();
      
      for (const invite of firestoreInvites) {
        const createdAt = invite.createdAt as Timestamp;
        const inviteId = invite.id;
        currentInviteIds.add(inviteId);
        
        invitesWithProfiles.push({
          id: inviteId,
          fromName: invite.fromName,
          avatar: invite.fromAvatar,
          roomCode: invite.roomCode,
          sentAt: createdAt?.toMillis ? createdAt.toMillis() : Date.now(),
          fromUid: invite.from,
        });
        
        // Show popup for new invites (not in previous set)
        if (!previousInvitesRef.current.has(inviteId) && !loading) {
          Alert.alert(
            language === 'he' ? 'הזמנה למשחק!' : 'Game Invite!',
            language === 'he'
              ? `${invite.fromName} הזמין אותך למשחק (חדר: ${invite.roomCode})`
              : `${invite.fromName} invited you to a game (Room: ${invite.roomCode})`,
            [
              {
                text: language === 'he' ? 'דחה' : 'Decline',
                style: 'cancel',
                onPress: () => {
                  declineGameInvite(inviteId).catch(() => {});
                },
              },
              {
                text: language === 'he' ? 'הצטרף' : 'Join',
                onPress: () => {
                  acceptGameInvite(inviteId).then(() => {
                    router.push({
                      pathname: '/join-room',
                      params: { roomCode: invite.roomCode },
                    });
                  }).catch(() => {});
                },
              },
            ],
            { cancelable: true }
          );
        }
      }
      
      previousInvitesRef.current = currentInviteIds;
      setInvites(invitesWithProfiles);
      setLoading(false);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeInvites();
    };
  }, [user]);

  const totalCount = useMemo(() => invites.length + requests.length, [invites.length, requests.length]);

  const handleClearAll = () => {
    // Clear all by declining/accepting all
    invites.forEach((invite) => {
      declineGameInvite(invite.id).catch(() => {});
    });
    requests.forEach((req) => {
      declineFriendRequest(req.id).catch(() => {});
    });
    setLastAction(t.actionDone);
  };

  const handleJoinInvite = async (invite: GameInvite) => {
    if (!user) return;
    try {
      await acceptGameInvite(invite.id);
      // Navigate to join room
      router.push({
        pathname: '/join-room',
        params: { roomCode: invite.roomCode },
      });
      setLastAction(t.actionDone);
    } catch (error) {
      console.error('Failed to accept invite:', error);
    }
  };

  const handleAcceptRequest = async (req: FriendRequest) => {
    if (!user) return;
    try {
      await acceptFriendRequest(req.id, req.fromUid, user.uid);
      setLastAction(t.actionDone);
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleDeclineRequest = async (req: FriendRequest) => {
    try {
      await declineFriendRequest(req.id);
      setLastAction(t.actionDone);
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  };

  const renderTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/lobby-background.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={10}>
          <ArrowRight color="#F5E6D3" size={22} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
        </Pressable>
        <View style={styles.titleRow}>
          <View style={styles.titleContainer}>
            <Bell size={20} color="#F5E6D3" />
            <Text style={styles.headerTitle}>{t.title}</Text>
            {totalCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{totalCount}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F5E6D3" />
            <Text style={styles.loadingText}>{t.loading || 'טוען...'}</Text>
          </View>
        ) : (
          <>
            {totalCount > 0 && (
              <Pressable onPress={handleClearAll} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>{t.clearAll}</Text>
              </Pressable>
            )}
            {lastAction && <Text style={styles.actionHint}>{lastAction}</Text>}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.gameInvites}</Text>
              {invites.length === 0 ? (
                <Text style={styles.emptyText}>{t.noInvites}</Text>
              ) : (
                invites.map((invite) => (
                  <View key={invite.id} style={styles.card}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.avatar}>{invite.avatar}</Text>
                      <View>
                        <Text style={styles.cardTitle}>{invite.fromName}</Text>
                        <Text style={styles.cardSub}>
                          {t.from} {invite.fromName} • {t.roomCode} {invite.roomCode}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cardMeta}>
                      <Text style={styles.timeText}>{renderTime(invite.sentAt)}</Text>
                      <Pressable onPress={() => handleJoinInvite(invite)} style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>{t.join}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.friendRequests}</Text>
              {requests.length === 0 ? (
                <Text style={styles.emptyText}>{t.noRequests}</Text>
              ) : (
                requests.map((request) => (
                  <View key={request.id} style={styles.card}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.avatar}>{request.avatar}</Text>
                      <View>
                        <Text style={styles.cardTitle}>{request.fromName}</Text>
                        <Text style={styles.cardSub}>
                          {t.from} {request.fromName}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.requestActions}>
                      <Pressable onPress={() => handleAcceptRequest(request)} style={[styles.actionButton, styles.acceptButton]}>
                        <Check size={14} color="#fff" />
                        <Text style={styles.actionButtonText}>{t.accept}</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeclineRequest(request)} style={[styles.actionButton, styles.declineButton]}>
                        <X size={14} color="#fff" />
                        <Text style={styles.actionButtonText}>{t.decline}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  header: {
    marginTop: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { 
    backgroundColor: '#5C4A32', 
    padding: 10, 
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  headerTitle: { color: '#F5E6D3', fontSize: 18, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5C4A32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  headerBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  clearButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#5C4A32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  clearButtonText: { color: '#F5E6D3', fontWeight: '700' },
  actionHint: { color: 'rgba(245, 230, 211, 0.8)', marginTop: 8 },
  section: { marginTop: 20 },
  sectionTitle: { 
    color: '#F5E6D3', 
    fontWeight: '700', 
    fontSize: 18, 
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  emptyText: { color: 'rgba(245, 230, 211, 0.6)' },
  card: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { fontSize: 26 },
  cardTitle: { fontWeight: '700', color: '#F5E6D3' },
  cardSub: { color: 'rgba(245, 230, 211, 0.6)', fontSize: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeText: { color: 'rgba(245, 230, 211, 0.5)', fontSize: 12 },
  primaryButton: { 
    backgroundColor: '#5B8A72', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3D5E4A',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  requestActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  acceptButton: { backgroundColor: '#5B8A72', borderWidth: 1, borderColor: '#3D5E4A' },
  declineButton: { backgroundColor: '#9B4444', borderWidth: 1, borderColor: '#7A3333' },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#F5E6D3', marginTop: 10, fontSize: 16 },
});
