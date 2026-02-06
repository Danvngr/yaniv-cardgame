import { useRouter } from 'expo-router';
import { BarChart3, Bell, Settings, Trophy, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { subscribeToFriendRequests, subscribeToGameInvites } from '../lib/userService';

const { width, height } = Dimensions.get('window');

// לוגואים לבחירה (נשמר ב-Firebase + AsyncStorage)
const AVATAR_OPTIONS = [
  '👤', '😎', '🦁', '🐯', '🐻', '🐼', '🦊', '🐶', '🐱', '🦄', '🐴', '🐸',
  '🦋', '🐝', '🐙', '🦀', '🐬', '🦈', '🐳', '🦉', '🐲', '🌟', '🔥', '💎',
  '👑', '🎯', '🎮', '🎲', '⚽', '🏀', '🎸', '🎺', '🌈', '☀️', '🌙', '❤️',
];

export default function LobbyScreen() {
  const router = useRouter();
  const { user, profile, updateProfile } = useAuth();
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [gameInviteCount, setGameInviteCount] = useState(0);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  const notificationCount = useMemo(() => friendRequestCount + gameInviteCount, [friendRequestCount, gameInviteCount]);

  const handleSelectAvatar = async (avatar: string) => {
    try {
      await updateProfile({ avatar });
      setShowAvatarModal(false);
    } catch (e) {
      console.warn('Failed to save avatar', e);
    }
  };

  // Subscribe to notifications
  useEffect(() => {
    if (!user) return;

    const unsubscribeRequests = subscribeToFriendRequests(user.uid, (requests) => {
      setFriendRequestCount(requests.length);
    });

    const unsubscribeInvites = subscribeToGameInvites(user.uid, (invites) => {
      setGameInviteCount(invites.length);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeInvites();
    };
  }, [user]);

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <Image 
        source={require('../assets/images/lobby-background.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Top Bar */}
      <View style={styles.topBar}>
        {/* Friends Button - Left */}
        <Pressable
          onPress={() => router.push('/friends-list')}
          style={({pressed}) => [styles.friendsButton, pressed && styles.pressed]}
        >
          <Text style={styles.friendsButtonText}>חברים</Text>
        </Pressable>

        {/* Right Buttons */}
        <View style={styles.topRightButtons}>
          {/* Notifications Button */}
          <Pressable 
            onPress={() => router.push('/notifications')}
            style={({pressed}) => [styles.woodenIconButton, pressed && styles.pressed]}
          >
            <Bell size={24} color="#F5E6D3" />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{notificationCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Settings Button */}
          <Pressable 
            onPress={() => router.push('/settings')}
            style={({pressed}) => [styles.woodenIconButton, pressed && styles.pressed]}
          >
            <Settings size={24} color="#F5E6D3" />
          </Pressable>
        </View>
      </View>

      {/* User profile: logo + name (לחיצה על הלוגו פותחת בחירה) */}
      {user && profile && (
        <View style={styles.profileSection}>
          <Pressable
            onPress={() => setShowAvatarModal(true)}
            style={({ pressed }) => [styles.profileAvatar, pressed && styles.pressed]}
          >
            <Text style={styles.profileAvatarText}>{profile.avatar || '?'}</Text>
          </Pressable>
          <Text style={styles.profileName} numberOfLines={1}>{profile.username || 'שחקן'}</Text>
        </View>
      )}

      {/* מודל בחירת לוגו */}
      <Modal visible={showAvatarModal} transparent animationType="fade">
        <Pressable style={styles.avatarModalOverlay} onPress={() => setShowAvatarModal(false)}>
          <Pressable style={styles.avatarModalCard} onPress={() => {}}>
            <View style={styles.avatarModalHeader}>
              <Text style={styles.avatarModalTitle}>בחר לוגו</Text>
              <Pressable onPress={() => setShowAvatarModal(false)} style={styles.avatarModalClose}>
                <X size={20} color="#4B3728" />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.avatarGrid}
              showsVerticalScrollIndicator={false}
            >
              {AVATAR_OPTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleSelectAvatar(emoji)}
                  style={[
                    styles.avatarOption,
                    profile?.avatar === emoji && styles.avatarOptionSelected,
                  ]}
                >
                  <Text style={styles.avatarOptionText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Main Content */}
      <View style={styles.mainContent}>
        
        {/* Create Room Button */}
        <Pressable
          onPress={() => router.push('/create-room')}
          style={({pressed}) => [styles.mainGameButton, styles.onlineButton, pressed && styles.pressed]}
        >
          <Text style={styles.mainGameButtonText}>פתח חדר</Text>
        </Pressable>

        {/* Join Room Button */}
        <Pressable
          onPress={() => router.push('/join-room')}
          style={({pressed}) => [styles.mainGameButton, styles.joinRoomButton, pressed && styles.pressed]}
        >
          <Text style={styles.mainGameButtonText}>הצטרף לחדר</Text>
        </Pressable>

        {/* Bottom Row - Stats & Leaderboard */}
        <View style={styles.bottomRow}>
          {/* Stats Button */}
          <Pressable
            onPress={() => router.push('/stats')}
            style={({pressed}) => [styles.bottomButton, pressed && styles.pressed]}
          >
            <BarChart3 size={28} color="#FFD700" />
            <Text style={styles.bottomButtonText}>הסטטיסטיקה שלי</Text>
          </Pressable>

          {/* Leaderboard Button */}
          <Pressable
            onPress={() => router.push('/leaderboard')}
            style={({pressed}) => [styles.bottomButton, pressed && styles.pressed]}
          >
            <Trophy size={28} color="#FFD700" />
            <Text style={styles.bottomButtonText}>לוח מובילים</Text>
          </Pressable>
        </View>
      </View>

      {/* Card Suits Decoration */}
      <View style={styles.cardSuitsContainer}>
        <Text style={styles.cardSuit}>♠</Text>
        <Text style={[styles.cardSuit, styles.redSuit]}>♥</Text>
        <Text style={[styles.cardSuit, styles.redSuit]}>♦</Text>
        <Text style={styles.cardSuit}>♣</Text>
      </View>
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
  
  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  
  // Friends Button - Wooden oval style
  friendsButton: {
    backgroundColor: '#5C4A32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  friendsButtonText: {
    color: '#F5E6D3',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Top Right Buttons
  topRightButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  
  // Wooden Icon Button
  woodenIconButton: {
    backgroundColor: '#6B5344',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  
  // Notification Badge
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  
  // Main Content
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  
  // Main Game Buttons
  mainGameButton: {
    width: width * 0.85,
    paddingVertical: 22,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  onlineButton: {
    backgroundColor: '#22C55E',
    borderColor: '#8B7355',
  },
  joinRoomButton: {
    backgroundColor: '#4A8B7C',
    borderColor: '#3D6B5F',
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFBF5',
    borderWidth: 4,
    borderColor: '#D4C5B0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  profileAvatarText: {
    fontSize: 50,
  },
  profileName: {
    color: '#4B3728',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
    maxWidth: width * 0.6,
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mainGameButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  
  // Bottom Row
  bottomRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  
  // Bottom Buttons (Stats & Leaderboard)
  bottomButton: {
    backgroundColor: '#4B3728',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomButtonText: {
    color: '#F5E6D3',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Card Suits Decoration
  cardSuitsContainer: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  cardSuit: {
    fontSize: 28,
    color: '#1C1810',
  },
  redSuit: {
    color: '#DC2626',
  },
  
  // Pressed state
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  // Avatar picker modal
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  avatarModalCard: {
    backgroundColor: '#F5E6D3',
    borderRadius: 20,
    padding: 20,
    borderWidth: 3,
    borderColor: '#8B7355',
    maxWidth: width * 0.9,
    maxHeight: height * 0.6,
  },
  avatarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4B3728',
  },
  avatarModalClose: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 115, 85, 0.3)',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  avatarOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFBF5',
    borderWidth: 2,
    borderColor: '#D4C5B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionSelected: {
    borderColor: '#5B8A72',
    borderWidth: 4,
    backgroundColor: 'rgba(91, 138, 114, 0.2)',
  },
  avatarOptionText: {
    fontSize: 32,
  },
});
