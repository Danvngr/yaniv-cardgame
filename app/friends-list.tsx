import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
  Clipboard,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, UserPlus, Check, X, Copy, Users } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  searchUsersByUsername,
  sendFriendRequest,
  getIncomingFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  removeFriend,
  subscribeToFriendRequests,
  subscribeToFriends,
  getUserProfile,
  type FriendRequest,
  type Friend,
} from '../lib/userService';

const { width } = Dimensions.get('window');

export default function FriendsListScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ uid: string; username: string; avatar: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isRTL = language === 'he';
  const myCode = profile?.username ? `@${profile.username}` : '';

  const text = {
    en: {
      title: 'Friends',
      myCode: 'My Username',
      copy: 'Copy',
      copied: 'Copied',
      addFriend: 'Add Friend',
      searchPlaceholder: 'Enter username...',
      sendRequest: 'Send Request',
      requestSent: 'Request sent to',
      pendingRequests: 'Pending Requests',
      noRequests: 'No pending requests',
      friends: 'Friends',
      noFriends: 'No friends yet',
      remove: 'Remove',
      accept: 'Accept',
      decline: 'Decline',
      online: 'Online',
      offline: 'Offline',
      loading: 'Loading...',
      error: 'Error',
      alreadyFriends: 'Already friends',
      requestExists: 'Request already sent',
      notFound: 'User not found',
    },
    he: {
      title: 'חברים',
      myCode: 'שם המשתמש שלי',
      copy: 'העתק',
      copied: 'הועתק',
      addFriend: 'הוסף חבר',
      searchPlaceholder: 'הכנס שם משתמש...',
      sendRequest: 'שלח בקשה',
      requestSent: 'בקשה נשלחה אל',
      pendingRequests: 'בקשות ממתינות',
      noRequests: 'אין בקשות ממתינות',
      friends: 'חברים',
      noFriends: 'אין חברים עדיין',
      remove: 'הסר',
      accept: 'אשר',
      decline: 'דחה',
      online: 'אונליין',
      offline: 'אופליין',
      loading: 'טוען...',
      error: 'שגיאה',
      alreadyFriends: 'כבר חברים',
      requestExists: 'בקשה כבר נשלחה',
      notFound: 'משתמש לא נמצא',
    },
  };

  const t = text[language];

  // Load initial data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [friendsList, requestsList] = await Promise.all([
          getFriends(user.uid),
          getIncomingFriendRequests(user.uid),
        ]);
        setFriends(friendsList);
        setRequests(requestsList);
      } catch (e) {
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to real-time updates
    const unsubscribeRequests = subscribeToFriendRequests(user.uid, (newRequests) => {
      setRequests(newRequests);
    });

    const unsubscribeFriends = subscribeToFriends(user.uid, (newFriends) => {
      setFriends(newFriends);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeFriends();
    };
  }, [user, t.error]);

  // Search users
  const handleSearch = async () => {
    const trimmed = search.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const results = await searchUsersByUsername(trimmed, user?.uid);
      setSearchResults(results);
      if (results.length === 0) {
        setError(t.notFound);
      }
    } catch (e) {
      setError(t.error);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredFriends = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return friends;
    return friends.filter((friend) => friend.username.toLowerCase().includes(trimmed));
  }, [friends, search]);

  const handleCopy = () => {
    if (myCode) {
      Clipboard.setString(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSendRequest = async (toUid: string, username: string) => {
    if (!user) return;
    setError(null);
    setSuccess(null);
    try {
      await sendFriendRequest(user.uid, toUid);
      setSuccess(`${t.requestSent} ${username}`);
      setSearch('');
      setSearchResults([]);
    } catch (e: any) {
      if (e.message === 'Friend request already sent') {
        setError(t.requestExists);
      } else if (e.message === 'Already friends') {
        setError(t.alreadyFriends);
      } else {
        setError(t.error);
      }
    }
  };

  const handleAccept = async (request: FriendRequest) => {
    if (!user) return;
    setError(null);
    try {
      await acceptFriendRequest(request.id, request.from, request.to);
      setSuccess(t.accept);
    } catch (e) {
      setError(t.error);
    }
  };

  const handleDecline = async (requestId: string) => {
    setError(null);
    try {
      await declineFriendRequest(requestId);
    } catch (e) {
      setError(t.error);
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (!user) return;
    setError(null);
    try {
      await removeFriend(user.uid, friendUid);
      setSuccess(t.remove);
    } catch (e) {
      setError(t.error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Image 
          source={require('../assets/images/lobby-background.png')} 
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5E6D3" />
          <Text style={styles.loadingText}>{t.loading}</Text>
        </View>
      </View>
    );
  }

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
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>{t.title}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {myCode && (
          <View style={styles.codeCard}>
            <View style={[styles.codeHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Users size={18} color="#8B7355" />
              <Text style={styles.codeTitle}>{t.myCode}</Text>
            </View>
            <View style={styles.codeRow}>
              <Text style={styles.codeValue}>{myCode}</Text>
              <Pressable onPress={handleCopy} style={styles.copyButton}>
                {copied ? <Check size={16} color="#fff" /> : <Copy size={16} color="#fff" />}
                <Text style={styles.copyText}>{copied ? t.copied : t.copy}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.searchCard}>
          <View style={[styles.searchHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <UserPlus size={18} color="#F5E6D3" />
            <Text style={styles.searchTitle}>{t.addFriend}</Text>
          </View>
          <View style={[styles.searchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TextInput
              style={[styles.searchInput, isRTL && styles.searchInputRtl]}
              placeholder={t.searchPlaceholder}
              placeholderTextColor="rgba(245, 230, 211, 0.5)"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearch}
            />
            <Pressable
              onPress={handleSearch}
              disabled={search.trim().length < 3 || isSearching}
              style={[styles.requestButton, (search.trim().length < 3 || isSearching) && styles.requestButtonDisabled]}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.requestButtonText}>{t.sendRequest}</Text>
              )}
            </Pressable>
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {success && <Text style={styles.successText}>{success}</Text>}
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((result) => (
                <View key={result.uid} style={styles.searchResultItem}>
                  <Text style={styles.avatarText}>{result.avatar}</Text>
                  <Text style={styles.searchResultName}>{result.username}</Text>
                  <Pressable
                    onPress={() => handleSendRequest(result.uid, result.username)}
                    style={styles.sendRequestButton}
                  >
                    <Text style={styles.sendRequestText}>{t.sendRequest}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.pendingRequests}</Text>
          {requests.length === 0 ? (
            <Text style={styles.emptyText}>{t.noRequests}</Text>
          ) : (
            <RequestList
              requests={requests}
              onAccept={handleAccept}
              onDecline={handleDecline}
              isRTL={isRTL}
              t={t}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.friends}</Text>
          {filteredFriends.length === 0 ? (
            <Text style={styles.emptyText}>{t.noFriends}</Text>
          ) : (
            filteredFriends.map((friend) => (
              <View key={friend.uid} style={styles.friendRow}>
                <View style={styles.friendInfo}>
                  <Text style={styles.avatarText}>{friend.avatar}</Text>
                  <View>
                    <Text style={styles.friendName}>{friend.username}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, friend.isOnline ? styles.statusOnline : styles.statusOffline]} />
                      <Text style={styles.statusText}>{friend.isOnline ? t.online : t.offline}</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={() => handleRemoveFriend(friend.uid)} style={styles.removeButton}>
                  <Text style={styles.removeText}>{t.remove}</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// Component for request list (to handle async profile loading)
function RequestList({
  requests,
  onAccept,
  onDecline,
  isRTL,
  t,
}: {
  requests: FriendRequest[];
  onAccept: (request: FriendRequest) => void;
  onDecline: (requestId: string) => void;
  isRTL: boolean;
  t: any;
}) {
  const [profiles, setProfiles] = useState<Record<string, { username: string; avatar: string }>>({});

  useEffect(() => {
    const loadProfiles = async () => {
      const profileMap: Record<string, { username: string; avatar: string }> = {};
      for (const request of requests) {
        const profile = await getUserProfile(request.from);
        if (profile) {
          profileMap[request.from] = { username: profile.username, avatar: profile.avatar };
        }
      }
      setProfiles(profileMap);
    };
    loadProfiles();
  }, [requests]);

  return (
    <>
      {requests.map((request) => {
        const profile = profiles[request.from];
        if (!profile) {
          return (
            <View key={request.id} style={styles.requestRow}>
              <ActivityIndicator size="small" color="#F5E6D3" />
            </View>
          );
        }
        return (
          <View key={request.id} style={styles.requestRow}>
            <View style={styles.requestInfo}>
              <Text style={styles.avatarText}>{profile.avatar}</Text>
              <View>
                <Text style={styles.requestName}>{profile.username}</Text>
                <Text style={styles.requestTime}>
                  {request.createdAt &&
                    (() => {
                      try {
                        const timestamp = request.createdAt as any;
                        const millis = timestamp?.toMillis?.() || timestamp?.seconds * 1000 || Date.now();
                        return new Date(millis).toLocaleTimeString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      } catch {
                        return '';
                      }
                    })()}
                </Text>
              </View>
            </View>
            <View style={styles.requestActions}>
              <Pressable onPress={() => onAccept(request)} style={[styles.actionPill, styles.acceptPill]}>
                <Text style={styles.actionText}>{t.accept}</Text>
              </Pressable>
              <Pressable onPress={() => onDecline(request.id)} style={[styles.actionPill, styles.declinePill]}>
                <Text style={styles.actionText}>{t.decline}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#F5E6D3',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    marginTop: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    backgroundColor: '#5C4A32',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  headerTitle: { 
    color: '#F5E6D3', 
    fontSize: 20, 
    fontWeight: '700' 
  },
  iconButton: { 
    backgroundColor: '#5C4A32', 
    padding: 10, 
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  content: { padding: 20, paddingBottom: 40 },
  codeCard: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  codeHeader: { alignItems: 'center', gap: 6, marginBottom: 10 },
  codeTitle: { color: 'rgba(245, 230, 211, 0.7)', fontWeight: '600' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeValue: { fontSize: 20, fontWeight: '700', color: '#F5E6D3', letterSpacing: 1 },
  copyButton: {
    backgroundColor: '#5B8A72',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#3D5E4A',
  },
  copyText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  searchCard: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  searchHeader: { alignItems: 'center', gap: 6, marginBottom: 10 },
  searchTitle: { fontWeight: '700', color: '#F5E6D3' },
  searchRow: { gap: 10 },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F5E6D3',
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
  },
  searchInputRtl: { textAlign: 'right' },
  requestButton: {
    backgroundColor: '#5B8A72',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3D5E4A',
  },
  requestButtonDisabled: { backgroundColor: 'rgba(92, 74, 50, 0.5)', borderColor: '#8B7355' },
  requestButtonText: { color: '#fff', fontWeight: '700' },
  errorText: { marginTop: 8, color: '#EF4444', fontSize: 12 },
  successText: { marginTop: 8, color: '#5B8A72', fontSize: 12 },
  searchResults: { marginTop: 12, gap: 8 },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  searchResultName: { flex: 1, fontWeight: '600', color: '#F5E6D3' },
  sendRequestButton: {
    backgroundColor: '#5B8A72',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3D5E4A',
  },
  sendRequestText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  section: { marginBottom: 20 },
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
  requestRow: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestName: { fontWeight: '700', color: '#F5E6D3' },
  requestTime: { fontSize: 12, color: 'rgba(245, 230, 211, 0.5)' },
  requestActions: { flexDirection: 'row', gap: 8 },
  actionPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  acceptPill: { backgroundColor: '#5B8A72', borderWidth: 1, borderColor: '#3D5E4A' },
  declinePill: { backgroundColor: '#9B4444', borderWidth: 1, borderColor: '#7A3333' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  friendRow: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  friendInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarText: { fontSize: 26 },
  friendName: { fontWeight: '700', color: '#F5E6D3' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusOnline: { backgroundColor: '#22c55e' },
  statusOffline: { backgroundColor: 'rgba(245, 230, 211, 0.4)' },
  statusText: { fontSize: 12, color: 'rgba(245, 230, 211, 0.6)' },
  removeButton: { 
    backgroundColor: 'rgba(92, 74, 50, 0.5)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  removeText: { color: 'rgba(245, 230, 211, 0.7)', fontWeight: '700', fontSize: 12 },
});
