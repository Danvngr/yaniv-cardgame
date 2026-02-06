import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, X, Trophy, ArrowRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

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
  totalScore: number;
  isEliminated: boolean;
}

interface RoundResult {
  winner: { id: string; name: string; type: 'yaniv' | 'assaf' };
  players: PlayerResult[];
  scoreLimit: number;
}

const MINI_CARD_WIDTH = width * 0.08;
const MINI_CARD_HEIGHT = MINI_CARD_WIDTH * 1.4;

// Mini playing card component
const MiniCard = ({ card }: { card: Card }) => {
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const color = isRed ? '#DC2626' : '#0F172A';
    
    const suitSymbol: Record<Suit, string> = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠',
        joker: '★'
    };

    return (
        <View style={styles.miniCard}>
            <Text style={[styles.miniCardText, { color }]}>{card.rank}</Text>
            <Text style={[styles.miniCardSuit, { color }]}>{suitSymbol[card.suit]}</Text>
        </View>
    );
};

// Animated score counter
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

// Player result card
const PlayerResultCard = ({ player, isWinner, index }: { player: PlayerResult; isWinner: boolean; index: number }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 150, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 150, useNativeDriver: true })
        ]).start();
    }, []);

    const handValue = player.cards.reduce((sum, c) => sum + c.value, 0);

    return (
        <Animated.View style={[
            styles.playerCard,
            isWinner && styles.winnerCard,
            player.isEliminated && styles.eliminatedCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
            <View style={styles.playerHeader}>
                <View style={styles.avatarRow}>
                    <View style={[styles.avatar, isWinner && styles.winnerAvatar]}>
                        <Text style={styles.avatarText}>{player.avatar}</Text>
                    </View>
                    <View style={styles.playerInfo}>
                        <Text style={[styles.playerName, isWinner && styles.winnerName]}>{player.name}</Text>
                        <Text style={styles.handValueText}>יד: {handValue}</Text>
                    </View>
                </View>
                <View style={styles.scoreColumn}>
                    {player.pointsAdded > 0 && (
                        <AnimatedScore value={player.pointsAdded} delay={index * 150 + 300} />
                    )}
                    {player.pointsAdded === 0 && isWinner && (
                        <View style={styles.winnerBadge}>
                            <Trophy size={16} color="#FBBF24" />
                        </View>
                    )}
                    <Text style={[styles.totalScore, player.isEliminated && styles.eliminatedScore]}>
                        {player.totalScore}
                    </Text>
                </View>
            </View>
            
            <View style={styles.cardsRow}>
                {player.cards.map(card => (
                    <MiniCard key={card.id} card={card} />
                ))}
            </View>

            {isWinner && (
                <View style={styles.winnerRibbon}>
                    <Crown size={14} color="#92400E" fill="#FBBF24" />
                    <Text style={styles.winnerRibbonText}>מנצח הסיבוב</Text>
                </View>
            )}

            {player.isEliminated && (
                <View style={styles.eliminatedBadge}>
                    <X size={16} color="white" />
                    <Text style={styles.eliminatedText}>הודח!</Text>
                </View>
            )}
        </Animated.View>
    );
};

export default function RoundSummaryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [timeLeft, setTimeLeft] = useState(10);
    const [autoAdvanced, setAutoAdvanced] = useState(false);
    const hasNavigatedRef = useRef(false);

    // Parse round result from params
    let roundResult: RoundResult | null = null;
    try {
        if (params.roundResult) {
            roundResult = JSON.parse(params.roundResult as string);
        }
    } catch (e) {
        console.error('Failed to parse round result:', e);
    }

    // Fallback data for testing
    if (!roundResult) {
        roundResult = {
            winner: { id: 'me', name: 'אתה', type: 'yaniv' },
            players: [
                { id: 'me', name: 'אתה', avatar: '😎', cards: [{ id: '1', suit: 'hearts', rank: '2', value: 2 }, { id: '2', suit: 'spades', rank: '3', value: 3 }], pointsAdded: 0, totalScore: 15, isEliminated: false },
                { id: 'o1', name: 'דני', avatar: '🎮', cards: [{ id: '3', suit: 'clubs', rank: 'K', value: 10 }, { id: '4', suit: 'diamonds', rank: 'Q', value: 10 }, { id: '5', suit: 'hearts', rank: '5', value: 5 }], pointsAdded: 25, totalScore: 57, isEliminated: false },
                { id: 'o2', name: 'ירדן', avatar: '🎯', cards: [{ id: '6', suit: 'spades', rank: '9', value: 9 }, { id: '7', suit: 'clubs', rank: '7', value: 7 }], pointsAdded: 16, totalScore: 61, isEliminated: false },
                { id: 'o3', name: 'שרון', avatar: '🌟', cards: [{ id: '8', suit: 'hearts', rank: 'J', value: 10 }, { id: '9', suit: 'diamonds', rank: '10', value: 10 }, { id: '10', suit: 'spades', rank: 'A', value: 1 }], pointsAdded: 21, totalScore: 49, isEliminated: false }
            ],
            scoreLimit: 100
        };
    }

    // Sort players by total score (lowest wins)
    const sortedPlayers = [...roundResult.players].sort((a, b) => a.totalScore - b.totalScore);
    const hasEliminated = sortedPlayers.some(p => p.isEliminated);
    
    // Game is over when someone exceeds score limit OR only 1 player left
    const someoneExceededLimit = sortedPlayers.some(p => p.totalScore >= roundResult.scoreLimit);
    const onlyOneLeft = sortedPlayers.filter(p => !p.isEliminated).length <= 1;
    const gameOver = someoneExceededLimit || onlyOneLeft;

    // Timer for next round
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
        if (gameOver) {
            // Navigate to game-over screen with final standings
            const finalPlayers = sortedPlayers.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                score: p.totalScore,
                isMe: p.id === 'me'
            }));
            router.replace({
                pathname: '/game-over',
                params: { 
                    players: JSON.stringify(finalPlayers),
                    roomCode: params.roomCode as string | undefined,
                    roomName: params.roomName as string | undefined,
                    scoreLimit: params.scoreLimit as string | undefined,
                    allowSticking: params.allowSticking as string | undefined,
                    playersConfig: params.players as string | undefined
                }
            });
        } else {
            // Online mode - just go back to game table (server will send next round state)
            router.replace({
                pathname: '/game-table',
                params: {
                    roomCode: params.roomCode as string | undefined,
                    scoreLimit: params.scoreLimit as string | undefined,
                    allowSticking: params.allowSticking as string | undefined,
                    isOnline: 'true'
                }
            });
        }
    }, [gameOver, sortedPlayers, params, router]);

    useEffect(() => {
        if (gameOver || autoAdvanced || hasNavigatedRef.current) return;
        if (timeLeft <= 0) {
            setAutoAdvanced(true);
            handleContinue();
        }
    }, [timeLeft, gameOver, autoAdvanced, handleContinue]);

    const titleText = roundResult.winner.type === 'yaniv' ? 'יניב!' : 'אסף!';
    const titleColors = roundResult.winner.type === 'yaniv' 
        ? ['#FBBF24', '#F59E0B', '#EF4444'] as const
        : ['#EF4444', '#DC2626', '#991B1B'] as const;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
            
            {/* Header */}
            <View style={styles.header}>
                <LinearGradient colors={titleColors} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.titleBadge}>
                    <Text style={styles.titleEmoji}>{roundResult.winner.type === 'yaniv' ? '🎉' : '💥'}</Text>
                    <Text style={styles.titleText}>{titleText}</Text>
                </LinearGradient>
                <Text style={styles.winnerSubtitle}>{roundResult.winner.name} {roundResult.winner.type === 'yaniv' ? 'קרא יניב' : 'עשה אסף'}</Text>
            </View>

            {/* Players list */}
            <ScrollView style={styles.playersContainer} contentContainerStyle={styles.playersContent}>
                {sortedPlayers.map((player, index) => (
                    <PlayerResultCard 
                        key={player.id} 
                        player={player} 
                        isWinner={player.id === roundResult!.winner.id}
                        index={index}
                    />
                ))}
            </ScrollView>

            {/* Score limit indicator */}
            <View style={styles.scoreLimitContainer}>
                <Text style={styles.scoreLimitText}>גבול ניקוד: {roundResult.scoreLimit}</Text>
            </View>

            {/* Continue button / Game over */}
            <View style={styles.footer}>
                {gameOver ? (
                    <View style={styles.gameOverContainer}>
                        <Text style={styles.gameOverText}>🏆 המשחק נגמר! 🏆</Text>
                        <Text style={styles.finalWinnerText}>לחץ להמשך לתוצאות הסופיות</Text>
                    </View>
                ) : (
                    <View style={styles.timerContainer}>
                        <Text style={styles.timerText}>סיבוב הבא בעוד {timeLeft} שניות</Text>
                    </View>
                )}
                
                <Pressable style={styles.continueButton} onPress={handleContinue}>
            <LinearGradient colors={['#22C55E', '#16A34A', '#15803D']} style={styles.continueGradient}>
                        <Text style={styles.continueText}>{gameOver ? 'לתוצאות הסופיות' : 'המשך'}</Text>
                        <ArrowRight size={20} color="white" />
                    </LinearGradient>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    
    header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
    titleBadge: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
    titleEmoji: { fontSize: 32 },
    titleText: { fontSize: 36, fontWeight: '900', color: 'white', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 },
    winnerSubtitle: { marginTop: 12, fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

    playersContainer: { flex: 1 },
    playersContent: { padding: 16, gap: 12 },

    playerCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    winnerCard: { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderColor: '#FBBF24' },
    eliminatedCard: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444', opacity: 0.7 },

    playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#8B5CF6' },
    winnerAvatar: { borderColor: '#FBBF24', borderWidth: 3 },
    avatarText: { fontSize: 24 },
    playerInfo: { gap: 2 },
    playerName: { fontSize: 16, fontWeight: '700', color: 'white' },
    winnerName: { color: '#FBBF24' },
    handValueText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

    scoreColumn: { alignItems: 'flex-end', gap: 4 },
    pointsAddedText: { fontSize: 18, fontWeight: '700', color: '#EF4444' },
    winnerBadge: { backgroundColor: 'rgba(251, 191, 36, 0.2)', padding: 6, borderRadius: 12 },
    totalScore: { fontSize: 24, fontWeight: '900', color: 'white' },
    eliminatedScore: { color: '#EF4444', textDecorationLine: 'line-through' },

    cardsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    miniCard: { width: MINI_CARD_WIDTH, height: MINI_CARD_HEIGHT, backgroundColor: 'white', borderRadius: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    miniCardText: { fontSize: 10, fontWeight: '700' },
    miniCardSuit: { fontSize: 8 },

    winnerRibbon: { position: 'absolute', top: -1, right: 16, backgroundColor: '#FBBF24', paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
    winnerRibbonText: { fontSize: 10, fontWeight: '700', color: '#92400E' },

    eliminatedBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
    eliminatedText: { fontSize: 12, fontWeight: '700', color: 'white' },

    scoreLimitContainer: { alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    scoreLimitText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

    footer: { padding: 16, gap: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
    
    gameOverContainer: { alignItems: 'center', gap: 4 },
    gameOverText: { fontSize: 24, fontWeight: '900', color: '#FBBF24' },
    finalWinnerText: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },

    timerContainer: { alignItems: 'center' },
    timerText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },

    continueButton: { borderRadius: 16, overflow: 'hidden' },
    continueGradient: { paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    continueText: { fontSize: 18, fontWeight: '700', color: 'white' },
});
