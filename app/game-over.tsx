import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, Home, Medal, RotateCcw, Trophy } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { saveGameResult, setUserInRoom } from '../lib/userService';
import { socketService } from '../lib/socketService';

const { width, height } = Dimensions.get('window');

type PlayerResult = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isMe: boolean;
};

// --- קונפטי ---
const ConfettiPiece = ({ delay, startX }: { delay: number; startX: number }) => {
  const fallAnim = useRef(new Animated.Value(-50)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;

  const colors = ['#facc15', '#ec4899', '#8b5cf6', '#22c55e', '#3b82f6', '#ef4444'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 8 + Math.random() * 8;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(fallAnim, {
            toValue: height + 100,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(swayAnim, { toValue: 30, duration: 500, useNativeDriver: true }),
            Animated.timing(swayAnim, { toValue: -30, duration: 500, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        borderRadius: 2,
        transform: [{ translateY: fallAnim }, { translateX: swayAnim }, { rotate }],
      }}
    />
  );
};

const Confetti = () => {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 2000,
    startX: Math.random() * width,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} delay={p.delay} startX={p.startX} />
      ))}
    </View>
  );
};

// --- גביע מונפש ---
const AnimatedTrophy = () => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.trophyContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Animated.View style={[styles.trophyGlow, { opacity: glowAnim }]} />
      <LinearGradient colors={['#fbbf24', '#f59e0b', '#d97706']} style={styles.trophyCircle}>
        <Trophy size={60} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
};

export default function GameOverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const [language] = useState<'he' | 'en'>('he');
  const roomName = params.roomName as string | undefined;
  const roomCode = params.roomCode as string | undefined;
  const scoreLimit = params.scoreLimit as string | undefined;
  const allowSticking = params.allowSticking as string | undefined;
  const hasSavedRef = useRef(false);

  // פרסור נתונים מהפרמטרים
  const players: PlayerResult[] = params.players
    ? JSON.parse(params.players as string)
    : [
        { id: '1', name: 'אתה', avatar: '😎', score: 45, isMe: true },
        { id: '2', name: 'דנה', avatar: '🎯', score: 102, isMe: false },
        { id: '3', name: 'נועם', avatar: '🦊', score: 88, isMe: false },
        { id: '4', name: 'אלי', avatar: '👑', score: 67, isMe: false },
      ];

  // מיון לפי ניקוד (הנמוך ביותר מנצח)
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const winner = sortedPlayers[0];
  const isViewerWinner = winner.isMe;

  // Mark user as no longer in a room when game over screen mounts
  useEffect(() => {
    if (user) setUserInRoom(user.uid, false).catch(() => {});
  }, []);

  // Save game results to Firestore
  useEffect(() => {
    if (!user || !profile || hasSavedRef.current) return;
    
    const saveResults = async () => {
      try {
        // Find the current user in the players list
        const myPlayer = sortedPlayers.find(p => p.isMe || p.id === user.uid || p.id === 'me');
        
        if (myPlayer) {
          // Find player's place (1 = winner, 2 = second, etc.)
          const place = sortedPlayers.findIndex(p => p.id === myPlayer.id) + 1;
          
          console.log('[GameOver] Saving game result:', {
            playerId: user.uid,
            place,
            totalPlayers: sortedPlayers.length,
            finalScore: myPlayer.score,
            roomCode,
          });
          
          await saveGameResult(
            user.uid,
            profile.username,
            profile.avatar,
            place,
            sortedPlayers.length,
            myPlayer.score,
            roomCode
          );
          
          console.log('[GameOver] Game result saved successfully!');
          hasSavedRef.current = true;
        } else {
          console.warn('[GameOver] Could not find current user in players list');
        }
      } catch (error) {
        console.error('[GameOver] Failed to save game result:', error);
      }
    };

    saveResults();
  }, [user, profile, sortedPlayers, roomCode]);

  const text = {
    en: {
      gameOver: 'Game Over',
      winner: 'Winner',
      youWon: 'You Won!',
      finalScores: 'Final Scores',
      playAgain: 'Play Again',
      backToLobby: 'Back to Lobby',
      points: 'pts',
    },
    he: {
      gameOver: 'המשחק נגמר',
      winner: 'מנצח',
      youWon: 'ניצחת!',
      finalScores: 'טבלת ניקוד סופית',
      playAgain: 'שחק שוב',
      backToLobby: 'חזרה ללובי',
      points: 'נק׳',
    },
  };

  const t = text[language];

  const getMedalIcon = (position: number) => {
    if (position === 0) return <Crown size={20} color="#fbbf24" />;
    if (position === 1) return <Medal size={18} color="#9ca3af" />;
    if (position === 2) return <Medal size={18} color="#b45309" />;
    return null;
  };

  const getPositionStyle = (position: number) => {
    if (position === 0) return styles.firstPlace;
    if (position === 1) return styles.secondPlace;
    if (position === 2) return styles.thirdPlace;
    return {};
  };

  return (
    <LinearGradient colors={['#1e1b4b', '#312e81', '#4c1d95']} style={styles.container}>
      <Confetti />

      <View style={styles.content}>
        {/* כותרת */}
        <Text style={styles.gameOverText}>{t.gameOver}</Text>

        {/* גביע */}
        <AnimatedTrophy />

        {/* המנצח */}
        <View style={styles.winnerSection}>
          <Text style={styles.winnerLabel}>{isViewerWinner ? t.youWon : t.winner}</Text>
          <View style={styles.winnerCard}>
            <Text style={styles.winnerAvatar}>{winner.avatar}</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <View style={styles.winnerScoreBadge}>
              <Text style={styles.winnerScore}>{winner.score} {t.points}</Text>
            </View>
          </View>
        </View>

        {/* טבלת ניקוד */}
        <View style={styles.scoresSection}>
          <Text style={styles.scoresTitle}>{t.finalScores}</Text>
          {sortedPlayers.map((player, index) => (
            <View
              key={player.id}
              style={[
                styles.playerRow,
                getPositionStyle(index),
                player.isMe && styles.myRow,
              ]}
            >
              <View style={styles.playerLeft}>
                <View style={styles.positionBadge}>
                  {getMedalIcon(index) || <Text style={styles.positionText}>{index + 1}</Text>}
                </View>
                <Text style={styles.playerAvatar}>{player.avatar}</Text>
                <Text style={[styles.playerName, player.isMe && styles.myName]}>
                  {player.name}
                </Text>
              </View>
              <Text style={[styles.playerScore, player.isMe && styles.myScore]}>
                {player.score}
              </Text>
            </View>
          ))}
        </View>

        {/* כפתורים */}
        <View style={styles.buttons}>
          <Pressable
            onPress={() => {
              if (roomCode) {
                router.replace({
                  pathname: '/game',
                  params: {
                    roomCode,
                    limit: scoreLimit ?? '200',
                    assaf: allowSticking === 'yes' ? 'yes' : 'no',
                    isOnline: 'true',
                  },
                });
              } else {
                router.replace({
                  pathname: '/create-room',
                  params: {
                    limit: scoreLimit ?? '200',
                    assaf: allowSticking === 'yes' ? 'yes' : 'no',
                    from: 'play-again',
                  },
                });
              }
            }}
            style={({ pressed }) => [styles.playAgainBtn, pressed && styles.btnPressed]}
          >
            <RotateCcw size={20} color="#fff" />
            <Text style={styles.playAgainText}>{t.playAgain}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (roomCode) {
                socketService.leaveRoom();
                if (user) setUserInRoom(user.uid, false).catch(() => {});
              }
              router.replace('/lobby');
            }}
            style={({ pressed }) => [styles.lobbyBtn, pressed && styles.btnPressed]}
          >
            <Home size={20} color="#4c1d95" />
            <Text style={styles.lobbyText}>{t.backToLobby}</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  gameOverText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 10,
  },
  trophyContainer: {
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#fbbf24',
  },
  trophyCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  winnerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  winnerLabel: {
    fontSize: 18,
    color: '#fbbf24',
    fontWeight: '600',
    marginBottom: 10,
  },
  winnerCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  winnerAvatar: {
    fontSize: 50,
    marginBottom: 8,
  },
  winnerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  winnerScoreBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  winnerScore: {
    color: '#1e1b4b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  scoresSection: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  scoresTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  firstPlace: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  secondPlace: {
    backgroundColor: 'rgba(156,163,175,0.15)',
  },
  thirdPlace: {
    backgroundColor: 'rgba(180,83,9,0.15)',
  },
  myRow: {
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionText: {
    color: '#9ca3af',
    fontWeight: 'bold',
    fontSize: 14,
  },
  playerAvatar: {
    fontSize: 24,
  },
  playerName: {
    color: '#e5e7eb',
    fontWeight: '600',
    fontSize: 15,
  },
  myName: {
    color: '#c4b5fd',
  },
  playerScore: {
    color: '#9ca3af',
    fontWeight: 'bold',
    fontSize: 16,
  },
  myScore: {
    color: '#c4b5fd',
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  playAgainBtn: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  playAgainText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  lobbyBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  lobbyText: {
    color: '#4c1d95',
    fontWeight: 'bold',
    fontSize: 18,
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
