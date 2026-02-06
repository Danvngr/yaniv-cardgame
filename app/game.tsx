import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Copy, Crown, Plus, RefreshCw, Share2, Trophy, Users, X, Zap } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, Dimensions, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ClientRoom, socketService } from '../lib/socketService';
import { getFriends, sendGameInvite, setUserInRoom, subscribeToFriends, type Friend } from '../lib/userService';

const { width } = Dimensions.get('window');

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [copied, setCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitedAiCount, setInvitedAiCount] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [pendingInvites, setPendingInvites] = useState<Set<string>>(new Set());
  const inviteTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorNavigateToLobby, setErrorNavigateToLobby] = useState(false);
  
  // Online mode state from server
  const isOnlineMode = params.isOnline === 'true';
  const [room, setRoom] = useState<ClientRoom | null>(null);
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [missingRoomWarning, setMissingRoomWarning] = useState(false);

  useEffect(() => {
  }, []);

  const isRTL = language === 'he';
  const maxPlayers = 4;

  // Convert server players to local format
  const players = useMemo(() => {
    if (isOnlineMode && room) {
      return room.players.map(p => ({
        id: p.odId,
        name: p.name,
        avatar: p.avatar,
        isHost: p.isHost,
        isAi: p.isAi,
        isConnected: p.isConnected,
        status: 'active' as const
      }));
    }
    return [];
  }, [room, isOnlineMode]);

  const emptySlots = maxPlayers - players.length;
  const canStartGame = players.length >= 2;
  const myPlayerId = isOnlineMode ? socketService.getMyPlayerId() : user?.uid;
  const isHost = isOnlineMode ? socketService.amIHost() : true;

  // Room settings
  const roomCode = isOnlineMode ? (room?.code || params.roomCode) : (params.roomName || 'LOCAL');
  const gameSettings = {
    scoreLimit: isOnlineMode ? (room?.settings.scoreLimit || 200) : (params.limit ? parseInt(params.limit as string) : 200),
    sticking: isOnlineMode ? (room?.settings.allowSticking ?? true) : (params.assaf === 'yes')
  };

  const text = {
    en: {
      title: 'Waiting Room',
      roomCode: 'Room Code',
      shareCode: 'Share Code',
      copy: 'Copy',
      copied: 'Copied!',
      sendToFriends: 'Send to friends to join',
      waiting: 'Waiting...',
      settings: 'Settings',
      upTo: 'Up to',
      stickingAllowed: 'Sticking ON',
      stickingNotAllowed: 'Sticking OFF',
      startGame: 'Start Game 🚀',
      waitingForPlayers: 'Waiting for players...',
      players: 'Players',
      addFriend: 'Invite Friend',
      inviteFriends: 'Invite Friends',
      invite: 'Invite',
      noOnlineFriends: 'No friends online',
      inviteSent: 'Invite sent',
      onlineFriendsTitle: 'Friends online',
      aiPlayersTitle: 'AI players',
      aiHuman: 'AI (Human)',
      aiHumanDesc: 'Balanced level like a real player',
      addAi: 'Add AI',
      hostOnly: 'Host only',
      loading: 'Loading...',
      disconnected: 'Disconnected',
      reconnecting: 'Reconnecting...',
      refresh: 'Refresh',
    },
    he: {
      title: 'חדר המתנה',
      roomCode: 'קוד החדר',
      shareCode: 'שתף קוד',
      copy: 'העתק',
      copied: 'הועתק!',
      sendToFriends: 'שלח לחברים כדי שיצטרפו',
      waiting: 'ממתין...',
      settings: 'הגדרות',
      upTo: 'עד',
      stickingAllowed: 'הדבקות מופעלת',
      stickingNotAllowed: 'ללא הדבקות',
      startGame: 'התחל משחק 🚀',
      waitingForPlayers: 'ממתין לשחקנים...',
      players: 'שחקנים',
      addFriend: 'הזמן חבר',
      inviteFriends: 'הזמן חברים',
      invite: 'הזמן',
      noOnlineFriends: 'אין חברים באונליין',
      inviteSent: 'הזמנה נשלחה',
      onlineFriendsTitle: 'חברים באונליין',
      aiPlayersTitle: 'שחקני AI',
      aiHuman: 'AI בדרגת אדם',
      aiHumanDesc: 'רמה מאוזנת כמו שחקן אמיתי',
      addAi: 'הוסף AI',
      hostOnly: 'רק מארח',
      loading: 'טוען...',
      disconnected: 'מנותק',
      reconnecting: 'מתחבר מחדש...',
      refresh: 'רענן',
    }
  };

  const t = text[language];
  const onlineFriends = friends.filter((friend) => friend.isOnline);

  // Setup socket callbacks for online mode
  useEffect(() => {
    if (!isOnlineMode) return;

    socketService.onConnected = () => {
      setIsConnected(true);
    };

    socketService.onDisconnected = () => {
      setIsConnected(false);
    };
    
    socketService.onReconnected = () => {
      console.log('[Game] Successfully reconnected to room');
      setIsConnected(true);
      // Refresh room data
      const currentRoom = socketService.getRoom();
      if (currentRoom) {
        setRoom(currentRoom);
      }
    };
    
    socketService.onReconnectFailed = (reason) => {
      console.log('[Game] Reconnection failed:', reason);
      setErrorMessage('החיבור נכשל. חוזר ללובי...');
      setErrorNavigateToLobby(true);
    };

    socketService.onRoomUpdated = (updatedRoom) => {
      setRoom(updatedRoom);
    };

    socketService.onRoomClosed = (reason) => {
      if (user) setUserInRoom(user.uid, false).catch(() => {});
      setErrorMessage(reason);
      setErrorNavigateToLobby(true);
    };

    socketService.onError = (message) => {
      setErrorMessage(message);
      setErrorNavigateToLobby(false);
    };

    socketService.onGameStateUpdated = (gameState) => {
      if (gameState.status === 'playing') {
        console.log('[Game] Game started!');
        router.replace({
          pathname: '/game-table',
          params: {
            roomCode: room?.code || params.roomCode,
            scoreLimit: gameSettings.scoreLimit.toString(),
            allowSticking: gameSettings.sticking ? 'yes' : 'no',
            isOnline: 'true'
          }
        });
      }
    };

    // Initialize room from socket service
    const currentRoom = socketService.getRoom();
    if (currentRoom) {
      setRoom(currentRoom);
    }

    // Debug: detect missing room when arriving from play-again
    if (!currentRoom && params.roomCode) {
      setMissingRoomWarning(true);
    }

    return () => {
      socketService.onConnected = undefined;
      socketService.onDisconnected = undefined;
      socketService.onReconnected = undefined;
      socketService.onReconnectFailed = undefined;
      socketService.onRoomUpdated = undefined;
      socketService.onRoomClosed = undefined;
      socketService.onError = undefined;
      socketService.onGameStateUpdated = undefined;
    };
  }, [isOnlineMode, room?.code, user]);

  // Load friends list
  useEffect(() => {
    if (!user) return;
    
    const loadFriends = async () => {
      setLoadingFriends(true);
      try {
        const friendsList = await getFriends(user.uid);
        setFriends(friendsList);
      } catch (e) {
        console.error('Failed to load friends:', e);
      } finally {
        setLoadingFriends(false);
      }
    };

    loadFriends();
  }, [user]);

  // כשהמודל "הזמן חברים" פתוח – מנוי בזמן אמת לרשימת החברים (כולל inRoom)
  useEffect(() => {
    if (!showInviteModal || !user) return;
    setLoadingFriends(true);
    const unsubscribe = subscribeToFriends(user.uid, (list) => {
      setFriends(list);
      setLoadingFriends(false);
    });
    return () => {
      unsubscribe();
    };
  }, [showInviteModal, user]);

  // Cleanup invite timeouts on unmount
  useEffect(() => {
    return () => {
      inviteTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      inviteTimeoutsRef.current.clear();
    };
  }, []);

  const removePlayer = (playerId: string) => {
    if (!isHost) return;
    
    const playerToRemove = players.find(p => p.id === playerId);
    if (playerToRemove?.isHost) return;

    Alert.alert(
      'הסרת שחקן',
      `האם להסיר את ${playerToRemove?.name} מהחדר?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'הסר', 
          style: 'destructive', 
          onPress: () => {
            if (isOnlineMode) {
              socketService.removePlayer(playerId);
            }
          }
        }
      ]
    );
  };

  const startGame = () => {
    if (!canStartGame) return;
    if (!isOnlineMode) return;
    socketService.startGame();
  };

  const handleCopy = () => {
    Clipboard.setString(roomCode.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `בוא לשחק איתי יניב! קוד החדר: *${roomCode}*`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleAddAiPlayer = () => {
    if (!isHost) return;
    if (players.length >= maxPlayers) return;
    if (!isOnlineMode) return;
    socketService.addAiPlayer();
    
    setInvitedAiCount(prev => prev + 1);
    setShowInviteModal(false);
  };

  const refreshFriendsList = async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const friendsList = await getFriends(user.uid);
      setFriends(friendsList);
    } catch (e) {
      console.error('Failed to refresh friends:', e);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleLeave = () => {
    if (isOnlineMode) {
      socketService.leaveRoom();
      if (user) setUserInRoom(user.uid, false).catch(() => {});
    }
    router.replace('/lobby');
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/lobby-background.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      {/* Header */}
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={handleLeave} style={styles.iconButton}>
          <X color="#F5E6D3" size={24} />
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {isOnlineMode && !isConnected && (
            <View style={styles.disconnectedBadge}>
              <Text style={styles.disconnectedText}>{t.disconnected}</Text>
            </View>
          )}
          <View style={{ width: 50 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Title Area */}
        <View style={styles.titleContainer}>
          <View style={styles.titleBadge}>
            <Text style={styles.screenTitle}>{t.title}</Text>
          </View>
        </View>

        {/* Room Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.cardLabel}>{t.roomCode}</Text>
          <View style={styles.codeDisplay}>
            <Text style={styles.roomCode}>{roomCode}</Text>
          </View>
          <Text style={styles.helperText}>{t.sendToFriends}</Text>

          <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable style={[styles.actionBtn, styles.shareBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} onPress={handleShare}>
               <Share2 size={20} color="#fff" />
               <Text style={styles.btnTextWhite}>{t.shareCode}</Text>
            </Pressable>

            <Pressable style={[styles.actionBtn, styles.copyBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} onPress={handleCopy}>
               {copied ? <Check size={20} color="#fff" /> : <Copy size={20} color="#fff" />}
               <Text style={styles.btnTextWhite}>{copied ? t.copied : t.copy}</Text>
            </Pressable>
          </View>
        </View>

        {/* Players Grid Section */}
        <View style={styles.playersSection}>
            {missingRoomWarning && (
              <View style={styles.missingRoomBanner}>
                <Text style={styles.missingRoomText}>אין חדר פעיל — צריך ליצור חדר חדש</Text>
              </View>
            )}
            <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8}}>
                    <Users size={24} color="#F5E6D3" />
                    <Text style={styles.sectionTitle}>{t.players}</Text>
                </View>
                <View style={styles.counterBadge}>
                    <Text style={styles.counterText}>{players.length}/{maxPlayers}</Text>
                </View>
            </View>

            {(() => {
              type PlayerSlot = { type: 'player'; key: string; data: (typeof players)[0] };
              type EmptySlot = { type: 'empty'; key: string };
              const allSlots: (PlayerSlot | EmptySlot)[] = [
                ...players.map((p) => ({ type: 'player' as const, key: p.id, data: p })),
                ...Array.from({ length: emptySlots }, (_, i) => ({ type: 'empty' as const, key: `empty-${i}` })),
              ];
              const row1 = allSlots.slice(0, 2);
              const row2 = allSlots.slice(2, 4);
              const renderCard = (slot: PlayerSlot | EmptySlot) => {
                if (slot.type === 'player') {
                  const p = slot.data;
                  return (
                    <View key={p.id} style={styles.playerCard}>
                      {isHost && !p.isHost && (
                        <Pressable onPress={() => removePlayer(p.id)} style={styles.kickButton} hitSlop={10}>
                          <X size={12} color="#fff" />
                        </Pressable>
                      )}
                      <View style={styles.avatarContainer}>
                        <Text style={{ fontSize: 30 }}>{p.avatar}</Text>
                        {p.isHost && (
                          <View style={styles.crownBadge}>
                            <Crown size={14} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.playerName}>{p.name}</Text>
                      {p.isHost && <Text style={styles.hostLabel}>{isRTL ? 'מארח' : 'Host'}</Text>}
                      {p.isAi && <Text style={styles.aiLabel}>🤖 AI</Text>}
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={slot.key}
                    onPress={() => setShowInviteModal(true)}
                    style={({ pressed }) => [styles.playerCard, styles.emptyCard, pressed && styles.emptyPressed]}
                  >
                    <View style={styles.emptyAddButton}>
                      <Plus size={26} color="#fff" />
                    </View>
                    <Text style={styles.waitingText}>{t.addFriend}</Text>
                  </Pressable>
                );
              };
              return (
                <View style={[styles.grid, { direction: isRTL ? 'rtl' : 'ltr' }]}>
                  <View style={styles.gridRow}>
                    {row1.map((slot) => renderCard(slot))}
                    {row1.length < 2 && <View style={styles.gridSpacer} />}
                  </View>
                  <View style={styles.gridRow}>
                    {row2.map((slot) => renderCard(slot))}
                    {row2.length < 2 && <View style={styles.gridSpacer} />}
                  </View>
                </View>
              );
            })()}
        </View>

        {/* Settings Info */}
        <View style={styles.settingsPill}>
             <View style={[styles.settingItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Trophy size={16} color="#FFD700" />
                <Text style={styles.settingText}>{t.upTo} {gameSettings.scoreLimit}</Text>
             </View>
             <View style={styles.divider} />
             <View style={[styles.settingItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Zap size={16} color="#5B8A72" />
                <Text style={styles.settingText}>
                    {gameSettings.sticking ? t.stickingAllowed : t.stickingNotAllowed}
                </Text>
             </View>
        </View>

      </ScrollView>

      {/* Footer / Start Button */}
      <View style={styles.footer}>
        <Pressable 
            disabled={!canStartGame || !isHost}
            onPress={startGame}
            style={[
                styles.startBtn, 
                canStartGame && isHost ? styles.activeBtn : styles.disabledBtn
            ]}
        >
            <Text style={[styles.startBtnText, (!canStartGame || !isHost) && {color: 'rgba(245, 230, 211, 0.5)'}]}>
                {!isHost ? (t.waiting) : (canStartGame ? t.startGame : t.waitingForPlayers)}
            </Text>
        </Pressable>
      </View>

      {/* Decorations */}
      <View style={styles.decorations}>
        <Text style={styles.cardSuit}>♠</Text>
        <Text style={[styles.cardSuit, styles.redSuit]}>♥</Text>
        <Text style={[styles.cardSuit, styles.redSuit]}>♦</Text>
        <Text style={styles.cardSuit}>♣</Text>
      </View>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowInviteModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.modalTitle}>{t.inviteFriends}</Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={refreshFriendsList}
                  disabled={loadingFriends}
                  style={({ pressed }) => [styles.modalRefreshBtn, pressed && { opacity: 0.7 }]}
                  accessibilityLabel={t.refresh}
                >
                  <RefreshCw size={18} color="#8B7355" />
                </Pressable>
                <Pressable onPress={() => setShowInviteModal(false)} style={styles.modalClose}>
                  <X size={16} color="#8B7355" />
                </Pressable>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>{t.onlineFriendsTitle}</Text>
              {loadingFriends ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color="#F5E6D3" />
                  <Text style={styles.modalEmpty}>{t.loading}</Text>
                </View>
              ) : onlineFriends.length === 0 ? (
                <Text style={styles.modalEmpty}>{t.noOnlineFriends}</Text>
              ) : (
                onlineFriends.map((friend) => {
                  const isPending = pendingInvites.has(friend.uid);
                  const isBusy = friend.inRoom;
                  const cannotInvite = isPending || isBusy;
                  const statusText = isBusy
                    ? (language === 'he' ? 'במשחק' : 'In game')
                    : isPending
                    ? (language === 'he' ? 'נשלח' : 'Sent')
                    : t.invite;
                  return (
                    <View key={friend.uid} style={[styles.modalRow, cannotInvite && styles.modalRowPending]}>
                      <View style={styles.modalRowInfo}>
                        <Text style={[styles.modalAvatar, cannotInvite && styles.modalAvatarPending]}>{friend.avatar}</Text>
                        <Text style={[styles.modalName, cannotInvite && styles.modalNamePending]}>{friend.username}</Text>
                      </View>
                      <Pressable
                        disabled={cannotInvite}
                        onPress={async () => {
                          if (!user || !profile || !room || cannotInvite) return;
                          try {
                            await sendGameInvite(
                              user.uid,
                              friend.uid,
                              room.code,
                              profile.username,
                              profile.avatar
                            );
                            setPendingInvites(prev => new Set(prev).add(friend.uid));
                            const timeoutId = setTimeout(() => {
                              setPendingInvites(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(friend.uid);
                                return newSet;
                              });
                              inviteTimeoutsRef.current.delete(friend.uid);
                            }, 30000);
                            inviteTimeoutsRef.current.set(friend.uid, timeoutId);
                            Alert.alert(
                              language === 'he' ? 'הזמנה נשלחה' : 'Invite Sent',
                              language === 'he' 
                                ? `הזמנה נשלחה ל-${friend.username}` 
                                : `Invite sent to ${friend.username}`
                            );
                          } catch (error: any) {
                            if (error.message === 'Invite already sent') {
                              Alert.alert(
                                language === 'he' ? 'הזמנה כבר נשלחה' : 'Invite Already Sent',
                                language === 'he' 
                                  ? 'הזמנה כבר נשלחה לחבר זה' 
                                  : 'Invite already sent to this friend'
                              );
                            } else {
                              Alert.alert(
                                language === 'he' ? 'שגיאה' : 'Error',
                                language === 'he' ? 'לא הצלחנו לשלוח הזמנה' : 'Failed to send invite'
                              );
                            }
                          }
                        }}
                        style={[styles.inviteButton, cannotInvite && styles.inviteButtonDisabled]}
                      >
                        <Text style={styles.inviteButtonText}>{statusText}</Text>
                      </Pressable>
                    </View>
                  );
                })
              )}

              <View style={styles.modalSectionDivider} />
              <Text style={styles.modalSectionTitle}>{t.aiPlayersTitle}</Text>
              <Pressable 
                onPress={isHost ? handleAddAiPlayer : undefined} 
                style={[styles.modalRow, !isHost && styles.modalRowDisabled]}
              >
                <View style={styles.modalRowInfo}>
                  <Text style={styles.modalAvatar}>🤖</Text>
                  <View>
                    <Text style={styles.modalName}>{t.aiHuman}</Text>
                    <Text style={styles.modalSubText}>{t.aiHumanDesc}</Text>
                  </View>
                </View>
                <View style={[styles.aiAddButton, !isHost && styles.aiAddButtonDisabled]}>
                  <Text style={[styles.aiAddText, !isHost && styles.aiAddTextDisabled]}>
                    {isHost ? t.addAi : t.hostOnly}
                  </Text>
                </View>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {errorMessage && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>שגיאה</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              style={styles.errorButton}
              onPress={() => {
                setErrorMessage(null);
                if (errorNavigateToLobby) {
                  router.replace('/lobby');
                }
              }}
            >
              <Text style={styles.errorButtonText}>סגור</Text>
            </Pressable>
          </View>
        </View>
      )}

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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: { 
    padding: 10, 
    backgroundColor: '#5C4A32', 
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  disconnectedBadge: { 
    backgroundColor: '#9B4444', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7A3333',
  },
  disconnectedText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  content: { padding: 20, paddingBottom: 100 },
  
  titleContainer: { alignItems: 'center', marginBottom: 30 },
  titleBadge: {
    backgroundColor: '#5C4A32',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  screenTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#F5E6D3', 
    textShadowColor: 'rgba(0,0,0,0.3)', 
    textShadowRadius: 4 
  },

  codeCard: { 
    backgroundColor: 'rgba(75, 55, 40, 0.95)', 
    borderRadius: 24, 
    padding: 24, 
    alignItems: 'center', 
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 15, 
    elevation: 10, 
    marginBottom: 30 
  },
  cardLabel: { color: 'rgba(245, 230, 211, 0.7)', fontSize: 14, marginBottom: 8 },
  codeDisplay: { 
    backgroundColor: 'rgba(92, 74, 50, 0.5)', 
    paddingHorizontal: 30, 
    paddingVertical: 10, 
    borderRadius: 16, 
    marginBottom: 10, 
    borderWidth: 2, 
    borderColor: '#8B7355' 
  },
  roomCode: { fontSize: 36, fontWeight: 'bold', color: '#FFD700', letterSpacing: 2 },
  helperText: { color: 'rgba(245, 230, 211, 0.6)', fontSize: 14, marginBottom: 20 },
  
  actionRow: { width: '100%', gap: 12 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 2 },
  shareBtn: { backgroundColor: '#5B8A72', borderWidth: 2, borderColor: '#3D5E4A' }, 
  copyBtn: { backgroundColor: '#A855F7', borderWidth: 2, borderColor: '#7C3AED' }, 
  btnTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  playersSection: { 
    backgroundColor: 'rgba(75, 55, 40, 0.8)', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  missingRoomBanner: {
    backgroundColor: 'rgba(155, 68, 68, 0.9)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#7A3333',
  },
  missingRoomText: {
    color: '#F5E6D3',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  sectionHeader: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#F5E6D3', fontSize: 20, fontWeight: 'bold' },
  counterBadge: { 
    backgroundColor: 'rgba(92, 74, 50, 0.8)', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  counterText: { color: '#F5E6D3', fontWeight: 'bold' },
  
  grid: { width: '100%', flexDirection: 'column', gap: 12 },
  gridRow: { flexDirection: 'row', width: '100%', gap: 12 },
  gridSpacer: { flex: 1, minWidth: 0 },
  playerCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(92, 74, 50, 0.9)',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B7355',
    elevation: 3,
    position: 'relative'
  },
  
  kickButton: {
    position: 'absolute',
    top: -6,
    left: -6, 
    backgroundColor: '#9B4444',
    borderRadius: 50,
    padding: 5,
    borderWidth: 1,
    borderColor: '#7A3333',
    elevation: 5,
    zIndex: 10
  },

  emptyCard: { 
    backgroundColor: 'rgba(92, 74, 50, 0.4)', 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: 'rgba(139, 115, 85, 0.6)', 
    elevation: 0 
  },
  emptyPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  
  avatarContainer: { marginBottom: 8, position: 'relative' },
  crownBadge: { 
    position: 'absolute', 
    top: -5, 
    right: -5, 
    backgroundColor: '#FFD700', 
    padding: 3, 
    borderRadius: 50 
  },
  playerName: { fontWeight: 'bold', color: '#F5E6D3', fontSize: 16, textAlign: 'center' },
  hostLabel: { fontSize: 12, color: '#FFD700', fontWeight: 'bold' },
  aiLabel: { fontSize: 11, color: 'rgba(245, 230, 211, 0.7)', fontWeight: '600' },
  
  emptyAddButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5B8A72',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#3D5E4A',
  },
  waitingText: { color: '#F5E6D3', fontSize: 14, fontWeight: '600' },

  settingsPill: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(75, 55, 40, 0.9)', 
    alignSelf: 'center', 
    borderRadius: 20, 
    padding: 4, 
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  settingItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  settingText: { color: '#F5E6D3', fontWeight: '600', fontSize: 14 },
  divider: { width: 1, backgroundColor: 'rgba(139, 115, 85, 0.5)', marginVertical: 6 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30 },
  startBtn: { padding: 18, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  activeBtn: { 
    backgroundColor: '#5B8A72',
    borderWidth: 3,
    borderColor: '#3D5E4A',
  },
  disabledBtn: { 
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  startBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  decorations: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 16, 
    position: 'absolute', 
    bottom: 90, 
    width: '100%', 
    zIndex: -1 
  },
  cardSuit: {
    fontSize: 28,
    color: '#1C1810',
  },
  redSuit: {
    color: '#DC2626',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: 'rgba(75, 55, 40, 0.98)',
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 16,
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#F5E6D3' },
  modalSectionTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(245, 230, 211, 0.7)', marginBottom: 6 },
  modalSectionDivider: { height: 1, backgroundColor: 'rgba(139, 115, 85, 0.3)', marginVertical: 10 },
  modalRefreshBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  modalClose: { 
    padding: 6, 
    borderRadius: 20, 
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  modalEmpty: { color: 'rgba(245, 230, 211, 0.6)', textAlign: 'center', paddingVertical: 20 },
  modalLoading: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  modalList: { gap: 10, paddingBottom: 6 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(92, 74, 50, 0.5)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  modalRowDisabled: { opacity: 0.5 },
  modalRowPending: { opacity: 0.7 },
  modalRowInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalAvatar: { fontSize: 22 },
  modalAvatarPending: { opacity: 0.7 },
  modalName: { fontWeight: 'bold', color: '#F5E6D3' },
  modalNamePending: { color: 'rgba(245, 230, 211, 0.6)' },
  modalSubText: { color: 'rgba(245, 230, 211, 0.6)', fontSize: 11, marginTop: 2 },
  inviteButton: { 
    backgroundColor: '#5B8A72', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3D5E4A',
  },
  inviteButtonDisabled: { backgroundColor: 'rgba(91, 138, 114, 0.4)', opacity: 0.8 },
  inviteButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  aiAddButton: { 
    backgroundColor: '#5C4A32', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  aiAddButtonDisabled: { backgroundColor: 'rgba(92, 74, 50, 0.5)' },
  aiAddText: { color: '#FFD700', fontWeight: '700', fontSize: 12 },
  aiAddTextDisabled: { color: 'rgba(245, 230, 211, 0.4)' },

  errorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  errorCard: { 
    width: 280, 
    backgroundColor: 'rgba(75, 55, 40, 0.98)', 
    borderRadius: 16, 
    padding: 18, 
    borderWidth: 3, 
    borderColor: '#8B7355', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.45, 
    shadowRadius: 12, 
    elevation: 12 
  },
  errorTitle: { color: '#F5E6D3', fontSize: 18, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  errorText: { color: 'rgba(245, 230, 211, 0.85)', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  errorButton: { 
    backgroundColor: '#5B8A72', 
    paddingVertical: 10, 
    borderRadius: 10, 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3D5E4A',
  },
  errorButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' }
});
