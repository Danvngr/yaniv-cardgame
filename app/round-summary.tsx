import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, X, Trophy, ArrowRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Dimensions, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import { CARD_IMAGES } from '../lib/assetPreloader';
import { socketService } from '../lib/socketService';
import { TropicalBackground } from '../components/TropicalBackground';
import { TropicalWoodButton } from '../components/TropicalWoodButton';
import { tropicalColors, tropicalGradients } from '../lib/tropicalTheme';

const { width } = Dimensions.get('window');

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';

interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

interface PlayerResult {
  id: string;
  name: string;
  avatar: string;
  cards: Card[];
  pointsAdded: number;
  previousScore?: number;
  totalScore: number;
  isEliminated: boolean;
}

interface RoundResult {
  winner: { id: string; name: string; type: 'yaniv' | 'assaf' };
  players: PlayerResult[];
  scoreLimit: number;
}

const MINI_CARD_WIDTH = width * 0.075;
const MINI_CARD_HEIGHT = MINI_CARD_WIDTH * 1.45;

const getCardImage = (suit: Suit, rank: Rank) => {
  if (rank === 'Joker' || suit === 'joker') return CARD_IMAGES['joker'];
  const key = `${suit}-${rank}`;
  return (CARD_IMAGES as Record<string, number>)[key] ?? null;
};

const MiniCard = ({ card }: { card: Card }) => {
  const cardImage = getCardImage(card.suit, card.rank);
  if (cardImage) {
    return (
      <View style={styles.miniCardFrame}>
        <Image source={cardImage} style={styles.miniCardImage} resizeMode="cover" />
      </View>
    );
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const color = isRed ? '#DC2626' : '#0F172A';
  const suitSymbol: Record<Suit, string> = {
    hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★',
  };
  return (
    <View style={[styles.miniCardFrame, styles.miniCardFallback]}>
      <Text style={[styles.miniCardText, { color }]}>{card.rank}</Text>
      <Text style={[styles.miniCardSuit, { color }]}>{suitSymbol[card.suit]}</Text>
    </View>
  );
};

const AnimatedScore = ({ value, delay = 0 }: { value: number; delay?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const step = Math.max(1, Math.ceil(value / 20));
      const interval = setInterval(() => {
        current += step;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(interval);
        } else {
          setDisplayValue(current);
        }
      }, 50);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return <Text style={styles.pointsAddedText}>+{displayValue}</Text>;
};

type RoundSummaryLabels = {
  hand: string;
  roundWinner: string;
  eliminated: string;
};

const PlayerResultCard = ({ player, isWinner, index, labels }: { player: PlayerResult; isWinner: boolean; index: number; labels: RoundSummaryLabels }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const handValue = player.cards.reduce((sum, c) => sum + c.value, 0);
  const scoreBefore = player.previousScore ?? (player.totalScore - player.pointsAdded);

  return (
    <Animated.View style={[
      styles.playerCardOuter,
      isWinner && styles.winnerCardOuter,
      player.isEliminated && styles.eliminatedCardOuter,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
    ]}>
      <LinearGradient colors={[...tropicalGradients.wicker]} style={styles.playerCardInner}>
        <View style={styles.playerHeader}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, isWinner && styles.winnerAvatar]}>
              <Text style={styles.avatarText}>{player.avatar}</Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={[styles.playerName, isWinner && styles.winnerName]}>{player.name}</Text>
              <Text style={styles.handValueText}>{labels.hand}: {handValue}</Text>
            </View>
          </View>
          <View style={styles.scoreColumn}>
            {player.pointsAdded > 0 && (
              <AnimatedScore value={player.pointsAdded} delay={index * 150 + 300} />
            )}
            {player.pointsAdded === 0 && isWinner ? (
              <LinearGradient colors={[...tropicalGradients.gold]} style={styles.coconutScore}>
                <Trophy size={18} color="#fff" />
                <Text style={styles.coconutScoreText}>{player.totalScore}</Text>
              </LinearGradient>
            ) : player.pointsAdded > 0 ? (
              <View style={styles.scoreBadge}>
                <Text style={[styles.scoreBeforeAfter, player.isEliminated && styles.eliminatedScore]}>
                  {scoreBefore} → {player.totalScore}
                </Text>
              </View>
            ) : (
              <View style={styles.scoreBadge}>
                <Text style={[styles.totalScore, player.isEliminated && styles.eliminatedScore]}>
                  {player.totalScore}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardsRow}>
          {player.cards.map(card => (
            <MiniCard key={card.id} card={card} />
          ))}
        </View>

        {isWinner && (
          <View style={styles.winnerRibbon}>
            <Crown size={14} color={tropicalColors.goldDark} fill={tropicalColors.gold} />
            <Text style={styles.winnerRibbonText}>{labels.roundWinner}</Text>
          </View>
        )}

        {player.isEliminated && (
          <View style={styles.eliminatedBadge}>
            <X size={16} color="white" />
            <Text style={styles.eliminatedText}>{labels.eliminated}</Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

export default function RoundSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(10);
  const [autoAdvanced, setAutoAdvanced] = useState(false);
  const hasNavigatedRef = useRef(false);
  const text = {
    he: {
      me: 'אתה',
      yaniv: 'יניב!',
      assaf: 'אסף!',
      didYaniv: 'עשה יניב',
      didAssaf: 'עשה אסף',
      winnerAction: (name: string, type: 'yaniv' | 'assaf') =>
        type === 'yaniv' ? `${name}\u200F ${'עשה יניב'}` : `${name}\u200F ${'עשה אסף'}`,
      hand: 'יד',
      roundWinner: 'מנצח הסיבוב',
      eliminated: 'הודח!',
      scoreLimit: 'גבול ניקוד',
      gameOver: 'המשחק נגמר!',
      finalResultsHint: 'לחץ להמשך לתוצאות הסופיות',
      nextRoundIn: (seconds: number) => `סיבוב הבא בעוד ${seconds} שניות`,
      finalResults: 'לתוצאות הסופיות',
      continue: 'המשך',
    },
    en: {
      me: 'You',
      yaniv: 'Yaniv!',
      assaf: 'Assaf!',
      didYaniv: 'called Yaniv',
      didAssaf: 'made Assaf',
      winnerAction: (name: string, type: 'yaniv' | 'assaf') =>
        type === 'yaniv' ? `${name} called Yaniv` : `${name} made Assaf`,
      hand: 'Hand',
      roundWinner: 'Round winner',
      eliminated: 'Eliminated!',
      scoreLimit: 'Score limit',
      gameOver: 'Game over!',
      finalResultsHint: 'Tap to continue to the final results',
      nextRoundIn: (seconds: number) => `Next round in ${seconds} seconds`,
      finalResults: 'Final results',
      continue: 'Continue',
    },
  };
  const t = text[language];

  let roundResult: RoundResult | null = null;
  try {
    if (params.roundResult) {
      roundResult = JSON.parse(params.roundResult as string);
    }
  } catch (e) {
    console.error('Failed to parse round result:', e);
  }

  if (!roundResult) {
    roundResult = {
      winner: { id: 'me', name: t.me, type: 'yaniv' },
      players: [
        { id: 'me', name: t.me, avatar: '😎', cards: [{ id: '1', suit: 'hearts', rank: '2', value: 2 }, { id: '2', suit: 'spades', rank: '3', value: 3 }], pointsAdded: 0, totalScore: 15, isEliminated: false },
        { id: 'o1', name: 'Dana', avatar: '🎮', cards: [{ id: '3', suit: 'clubs', rank: 'K', value: 10 }, { id: '4', suit: 'diamonds', rank: 'Q', value: 10 }, { id: '5', suit: 'hearts', rank: '5', value: 5 }], pointsAdded: 25, totalScore: 57, isEliminated: false },
        { id: 'o2', name: 'Jordan', avatar: '🎯', cards: [{ id: '6', suit: 'spades', rank: '9', value: 9 }, { id: '7', suit: 'clubs', rank: '7', value: 7 }], pointsAdded: 16, totalScore: 61, isEliminated: false },
        { id: 'o3', name: 'Sharon', avatar: '🌟', cards: [{ id: '8', suit: 'hearts', rank: 'J', value: 10 }, { id: '9', suit: 'diamonds', rank: '10', value: 10 }, { id: '10', suit: 'spades', rank: 'A', value: 1 }], pointsAdded: 21, totalScore: 49, isEliminated: false },
      ],
      scoreLimit: 100,
    };
  }

  const sortedPlayers = [...roundResult.players].sort((a, b) => a.totalScore - b.totalScore);
  const someoneExceededLimit = sortedPlayers.some(p => p.totalScore >= roundResult!.scoreLimit);
  const onlyOneLeft = sortedPlayers.filter(p => !p.isEliminated).length <= 1;
  const gameOver = someoneExceededLimit || onlyOneLeft;

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameOver]);

  const handleContinue = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    const isOnline = (params.isOnline as string | undefined) === 'true';
    if (gameOver) {
      const finalPlayers = sortedPlayers.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.totalScore,
        isMe: p.id === 'me',
      }));
      router.replace({
        pathname: '/game-over',
        params: {
          players: JSON.stringify(finalPlayers),
          roomCode: params.roomCode as string | undefined,
          roomName: params.roomName as string | undefined,
          scoreLimit: params.scoreLimit as string | undefined,
          allowSticking: params.allowSticking as string | undefined,
          playersConfig: params.players as string | undefined,
        },
      });
    } else {
      if (isOnline) {
        socketService.readyForNextRound();
        router.replace({
          pathname: '/game-table',
          params: {
            roomCode: params.roomCode as string | undefined,
            scoreLimit: params.scoreLimit as string | undefined,
            allowSticking: params.allowSticking as string | undefined,
            isOnline: 'true',
          },
        });
      } else {
        const scores = Object.fromEntries(roundResult!.players.map(p => [p.id, p.totalScore]));
        router.replace({
          pathname: '/game-table',
          params: {
            roomName: params.roomName as string | undefined,
            scoreLimit: params.scoreLimit as string | undefined,
            allowSticking: params.allowSticking as string | undefined,
            players: params.players as string | undefined,
            isOnline: 'false',
            prevWinnerId: roundResult!.winner.id,
            roundId: `${Date.now()}`,
            scores: JSON.stringify(scores),
          },
        });
      }
    }
  }, [gameOver, sortedPlayers, params, router, roundResult]);

  useEffect(() => {
    if (gameOver || autoAdvanced || hasNavigatedRef.current) return;
    if (timeLeft <= 0) {
      setAutoAdvanced(true);
      handleContinue();
    }
  }, [timeLeft, gameOver, autoAdvanced, handleContinue]);

  const titleText = roundResult.winner.type === 'yaniv' ? t.yaniv : t.assaf;
  const titleColors = roundResult.winner.type === 'yaniv'
    ? tropicalGradients.titleYaniv
    : tropicalGradients.titleAssaf;
  const winnerSubtitleText = t.winnerAction(roundResult.winner.name, roundResult.winner.type);

  return (
    <TropicalBackground>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        {/* Header — bamboo sign */}
        <View style={styles.header}>
          <View style={styles.titleSignOuter}>
            <LinearGradient colors={[...tropicalGradients.wicker]} style={styles.titleSignInner}>
              <LinearGradient colors={[...titleColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleBadge}>
                <Text style={styles.titleText}>{titleText}</Text>
              </LinearGradient>
            </LinearGradient>
          </View>
          <Text style={[styles.winnerSubtitle, language === 'he' && styles.winnerSubtitleRtl]}>
            {winnerSubtitleText}
          </Text>
        </View>

        <ScrollView style={styles.playersContainer} contentContainerStyle={styles.playersContent}>
          {sortedPlayers.map((player, index) => (
            <PlayerResultCard
              key={player.id}
              player={player}
              isWinner={player.id === roundResult!.winner.id}
              index={index}
              labels={{ hand: t.hand, roundWinner: t.roundWinner, eliminated: t.eliminated }}
            />
          ))}
        </ScrollView>

        <View style={styles.scoreLimitContainer}>
          <Text style={styles.scoreLimitText}>{t.scoreLimit}: {roundResult.scoreLimit}</Text>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 28) }]}>
          {gameOver ? (
            <View style={styles.gameOverContainer}>
              <Text style={styles.gameOverText}>{t.gameOver}</Text>
              <Text style={styles.finalWinnerText}>{t.finalResultsHint}</Text>
            </View>
          ) : (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>{t.nextRoundIn(timeLeft)}</Text>
            </View>
          )}

          <TropicalWoodButton
            label={gameOver ? t.finalResults : t.continue}
            onPress={handleContinue}
            icon={<ArrowRight size={20} color={tropicalColors.cream} />}
          />
        </View>
      </View>
    </TropicalBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { alignItems: 'center', paddingTop: 12, paddingBottom: 16, paddingHorizontal: 20 },
  titleSignOuter: {
    borderWidth: 4,
    borderColor: tropicalColors.bamboo,
    borderRadius: 16,
    padding: 4,
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
  titleBadge: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  titleText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  winnerSubtitle: {
    marginTop: 12,
    fontSize: 16,
    color: tropicalColors.cream,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
  },
  winnerSubtitleRtl: {
    writingDirection: 'rtl',
  },

  playersContainer: { flex: 1 },
  playersContent: { padding: 16, gap: 14, paddingBottom: 8 },

  playerCardOuter: {
    borderRadius: 16,
    borderWidth: 3,
    borderColor: tropicalColors.bamboo,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  winnerCardOuter: {
    borderColor: tropicalColors.gold,
    borderWidth: 4,
  },
  eliminatedCardOuter: {
    borderColor: tropicalColors.danger,
    opacity: 0.75,
  },
  playerCardInner: {
    borderRadius: 13,
    padding: 14,
    borderWidth: 1,
    borderColor: tropicalColors.wickerDark,
  },

  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tropicalColors.woodDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: tropicalColors.woodMid,
  },
  winnerAvatar: { borderColor: tropicalColors.gold, borderWidth: 3 },
  avatarText: { fontSize: 24 },
  playerInfo: { gap: 2 },
  playerName: { fontSize: 16, fontWeight: '800', color: tropicalColors.woodDeep },
  winnerName: { color: tropicalColors.goldDark },
  handValueText: { fontSize: 12, color: tropicalColors.woodMid, fontWeight: '600' },

  scoreColumn: { alignItems: 'flex-end', gap: 4 },
  pointsAddedText: { fontSize: 18, fontWeight: '800', color: tropicalColors.danger },
  coconutScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: tropicalColors.goldDark,
  },
  coconutScoreText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  scoreBadge: {
    backgroundColor: 'rgba(92, 74, 50, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tropicalColors.woodMid,
  },
  totalScore: { fontSize: 22, fontWeight: '900', color: tropicalColors.woodDeep },
  scoreBeforeAfter: { fontSize: 18, fontWeight: '800', color: tropicalColors.woodDeep },
  eliminatedScore: { color: tropicalColors.danger, textDecorationLine: 'line-through' },

  cardsRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  miniCardFrame: {
    width: MINI_CARD_WIDTH,
    height: MINI_CARD_HEIGHT,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tropicalColors.woodMid,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  miniCardImage: { width: '100%', height: '100%' },
  miniCardFallback: { justifyContent: 'center', alignItems: 'center' },
  miniCardText: { fontSize: 10, fontWeight: '700' },
  miniCardSuit: { fontSize: 8 },

  winnerRibbon: {
    position: 'absolute',
    top: -1,
    right: 14,
    backgroundColor: tropicalColors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: tropicalColors.goldDark,
  },
  winnerRibbonText: { fontSize: 10, fontWeight: '800', color: tropicalColors.goldDark },

  eliminatedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: tropicalColors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eliminatedText: { fontSize: 12, fontWeight: '700', color: 'white' },

  scoreLimitContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 230, 211, 0.25)',
  },
  scoreLimitText: {
    fontSize: 13,
    color: tropicalColors.creamMuted,
    fontWeight: '600',
  },

  footer: { padding: 16, gap: 12 },

  gameOverContainer: { alignItems: 'center', gap: 4 },
  gameOverText: { fontSize: 22, fontWeight: '900', color: tropicalColors.gold },
  finalWinnerText: { fontSize: 14, color: tropicalColors.creamMuted },

  timerContainer: { alignItems: 'center' },
  timerText: { fontSize: 14, color: tropicalColors.cream, fontWeight: '600' },
});
