import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, Home, Medal, RotateCcw, Trophy } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { saveGameResult, setUserInRoom } from '../lib/userService';
import { socketService } from '../lib/socketService';
import { TropicalBackground } from '../components/TropicalBackground';
import { TropicalWoodButton } from '../components/TropicalWoodButton';
import { tropicalColors, tropicalGradients } from '../lib/tropicalTheme';

const { width, height } = Dimensions.get('window');

type PlayerResult = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isMe: boolean;
};

const CONFETTI_COLORS = ['#FBBF24', '#D4A574', '#22C55E', '#F59E0B', '#8B7355', '#F5E6D3'];

const ConfettiPiece = ({ delay, startX }: { delay: number; startX: number }) => {
  const fallAnim = useRef(new Animated.Value(-50)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;

  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
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
  const pieces = Array.from({ length: 40 }, (_, i) => ({
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
      <LinearGradient colors={[...tropicalGradients.gold]} style={styles.trophyCircle}>
        <Trophy size={56} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
};

export default function GameOverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const roomCode = params.roomCode as string | undefined;
  const scoreLimit = params.scoreLimit as string | undefined;
  const allowSticking = params.allowSticking as string | undefined;
  const hasSavedRef = useRef(false);

  const players: PlayerResult[] = params.players
    ? JSON.parse(params.players as string)
    : [
        { id: '1', name: language === 'he' ? 'אתה' : 'You', avatar: '😎', score: 45, isMe: true },
        { id: '2', name: 'Dana', avatar: '🎯', score: 102, isMe: false },
        { id: '3', name: 'Noam', avatar: '🦊', score: 88, isMe: false },
        { id: '4', name: 'Eli', avatar: '👑', score: 67, isMe: false },
      ];

  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const winner = sortedPlayers[0];
  const isViewerWinner = winner.isMe;

  useEffect(() => {
    if (user) setUserInRoom(user.uid, false).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || !profile || hasSavedRef.current) return;

    const saveResults = async () => {
      try {
        const myPlayer = sortedPlayers.find(p => p.isMe || p.id === user.uid || p.id === 'me');
        if (myPlayer) {
          const place = sortedPlayers.findIndex(p => p.id === myPlayer.id) + 1;
          await saveGameResult(
            user.uid,
            profile.username,
            profile.avatar,
            place,
            sortedPlayers.length,
            myPlayer.score,
            roomCode
          );
          hasSavedRef.current = true;
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
    if (position === 0) return <Crown size={20} color={tropicalColors.gold} />;
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
    <TropicalBackground>
      <Confetti />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 20) + 12, paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 24) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title sign */}
        <View style={styles.titleSignOuter}>
          <LinearGradient colors={[...tropicalGradients.wicker]} style={styles.titleSignInner}>
            <LinearGradient colors={[...tropicalGradients.panel]} style={styles.titlePanel}>
              <Text style={styles.gameOverText}>{t.gameOver}</Text>
            </LinearGradient>
          </LinearGradient>
        </View>

        <AnimatedTrophy />

        {/* Winner card */}
        <View style={styles.winnerSection}>
          <Text style={styles.winnerLabel}>{isViewerWinner ? t.youWon : t.winner}</Text>
          <View style={styles.winnerCardOuter}>
            <LinearGradient colors={[...tropicalGradients.wicker]} style={styles.winnerCard}>
              <View style={styles.winnerAvatarRing}>
                <Text style={styles.winnerAvatar}>{winner.avatar}</Text>
              </View>
              <Text style={styles.winnerName}>{winner.name}</Text>
              <LinearGradient colors={[...tropicalGradients.gold]} style={styles.winnerScoreBadge}>
                <Text style={styles.winnerScore}>{winner.score} {t.points}</Text>
              </LinearGradient>
            </LinearGradient>
          </View>
        </View>

        {/* Score table */}
        <View style={styles.scoresSectionOuter}>
          <LinearGradient colors={[...tropicalGradients.wicker]} style={styles.scoresSection}>
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
          </LinearGradient>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TropicalWoodButton
            label={t.playAgain}
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
            icon={<RotateCcw size={20} color={tropicalColors.cream} />}
          />

          <TropicalWoodButton
            label={t.backToLobby}
            variant="secondary"
            onPress={() => {
              if (roomCode) {
                socketService.leaveRoom();
                if (user) setUserInRoom(user.uid, false).catch(() => {});
              }
              router.replace('/lobby');
            }}
            icon={<Home size={20} color={tropicalColors.woodDeep} />}
          />
        </View>
      </ScrollView>
    </TropicalBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  titleSignOuter: {
    borderWidth: 4,
    borderColor: tropicalColors.bamboo,
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  titleSignInner: {
    borderRadius: 12,
    padding: 6,
    borderWidth: 2,
    borderColor: tropicalColors.wickerDark,
  },
  titlePanel: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: tropicalColors.woodBorder,
  },
  gameOverText: {
    fontSize: 26,
    fontWeight: '900',
    color: tropicalColors.cream,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },

  trophyContainer: {
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: tropicalColors.gold,
  },
  trophyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: tropicalColors.goldDark,
    shadowColor: tropicalColors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },

  winnerSection: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  winnerLabel: {
    fontSize: 20,
    color: tropicalColors.gold,
    fontWeight: '800',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  winnerCardOuter: {
    borderWidth: 4,
    borderColor: tropicalColors.gold,
    borderRadius: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  winnerCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tropicalColors.wickerDark,
  },
  winnerAvatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tropicalColors.woodDark,
    borderWidth: 3,
    borderColor: tropicalColors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  winnerAvatar: { fontSize: 40 },
  winnerName: {
    fontSize: 24,
    fontWeight: '900',
    color: tropicalColors.woodDeep,
    marginBottom: 10,
  },
  winnerScoreBadge: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tropicalColors.goldDark,
  },
  winnerScore: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },

  scoresSectionOuter: {
    width: '100%',
    borderWidth: 3,
    borderColor: tropicalColors.bamboo,
    borderRadius: 18,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  scoresSection: {
    padding: 16,
    borderWidth: 1,
    borderColor: tropicalColors.wickerDark,
    borderRadius: 15,
  },
  scoresTitle: {
    color: tropicalColors.woodDeep,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.3)',
  },
  firstPlace: {
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderColor: tropicalColors.gold,
    borderWidth: 2,
  },
  secondPlace: {
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
  },
  thirdPlace: {
    backgroundColor: 'rgba(180, 83, 9, 0.15)',
  },
  myRow: {
    borderWidth: 2,
    borderColor: tropicalColors.woodMid,
    backgroundColor: 'rgba(212, 165, 116, 0.25)',
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
    backgroundColor: tropicalColors.woodDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tropicalColors.woodMid,
  },
  positionText: {
    color: tropicalColors.cream,
    fontWeight: 'bold',
    fontSize: 13,
  },
  playerAvatar: { fontSize: 24 },
  playerName: {
    color: tropicalColors.woodDeep,
    fontWeight: '700',
    fontSize: 15,
  },
  myName: {
    color: tropicalColors.woodDeep,
    fontWeight: '900',
  },
  playerScore: {
    color: tropicalColors.woodMid,
    fontWeight: '800',
    fontSize: 17,
  },
  myScore: {
    color: tropicalColors.woodDeep,
  },

  buttons: {
    width: '100%',
    gap: 12,
  },
});
