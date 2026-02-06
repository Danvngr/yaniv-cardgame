import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Trophy, Target, Percent, Zap, TrendingDown, Gamepad2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, getUserGameHistory, type GameResult } from '../lib/userService';
import type { Timestamp } from 'firebase/firestore';

export default function StatsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    wins: 0,
    winRate: 0,
    yanivCalls: 0,
    assafSuccess: 0,
    avgScore: 0,
  });
  const [recentGames, setRecentGames] = useState<GameResult[]>([]);
  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Statistics',
      gamesPlayed: 'Games Played',
      wins: 'Wins',
      winRate: 'Win Rate',
      yanivCalls: 'Yaniv Calls',
      assafSuccess: 'Assaf Success',
      avgScore: 'Avg Score',
      recentGames: 'Recent Games',
      place: 'Place',
      points: 'pts'
    },
    he: {
      title: 'סטטיסטיקות',
      gamesPlayed: 'משחקים',
      wins: 'ניצחונות',
      winRate: 'אחוז ניצחון',
      yanivCalls: 'קריאות יניב',
      assafSuccess: 'אסף מוצלח',
      avgScore: 'ממוצע נקודות',
      recentGames: 'משחקים אחרונים',
      place: 'מקום',
      points: 'נק׳',
      loading: 'טוען...',
      noGames: 'אין משחקים עדיין'
    }
  };

  const t = text[language];

  // Load user stats and game history
  useEffect(() => {
    const loadStats = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user profile with stats
        const userProfile = await getUserProfile(user.uid);
        if (userProfile && userProfile.stats) {
          const userStats = userProfile.stats;
          const gamesPlayed = userStats.gamesPlayed || 0;
          const wins = userStats.wins || 0;
          const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
          
          setStats({
            gamesPlayed,
            wins,
            winRate,
            yanivCalls: userStats.yanivCalls || 0,
            assafSuccess: userStats.assafSuccess || 0,
            avgScore: userStats.avgScore || 0,
          });
        }

        // Get recent games
        const games = await getUserGameHistory(user.uid, 10);
        setRecentGames(games);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user]);

  const formatDate = (timestamp: unknown) => {
    const ts = timestamp as Timestamp;
    if (!ts || !ts.toDate) return '';
    const date = ts.toDate();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

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
          <Text style={styles.loadingText}>{t.loading || 'טוען...'}</Text>
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowRight size={24} color="#F5E6D3" style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
          </Pressable>
          
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>{t.title}</Text>
          </View>
          
          <View style={{ width: 50 }} />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard 
            icon={<Gamepad2 size={20} color="#fff" />} 
            label={t.gamesPlayed} 
            value={stats.gamesPlayed}
            color="#3B82F6"
          />
          <StatCard 
            icon={<Trophy size={20} color="#fff" />} 
            label={t.wins} 
            value={stats.wins}
            color="#F59E0B"
          />
          <StatCard 
            icon={<Percent size={20} color="#fff" />} 
            label={t.winRate} 
            value={`${stats.winRate}%`}
            color="#10B981"
          />
          <StatCard 
            icon={<Target size={20} color="#fff" />} 
            label={t.yanivCalls} 
            value={stats.yanivCalls}
            color="#8B5CF6"
          />
          <StatCard 
            icon={<Zap size={20} color="#fff" />} 
            label={t.assafSuccess} 
            value={stats.assafSuccess}
            color="#EF4444"
          />
          <StatCard 
            icon={<TrendingDown size={20} color="#fff" />} 
            label={t.avgScore} 
            value={stats.avgScore}
            color="#EC4899"
          />
        </View>

        {/* Recent Games */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t.recentGames}</Text>
          <View style={styles.recentGamesCard}>
            {recentGames.length === 0 ? (
              <Text style={styles.emptyText}>{t.noGames || 'אין משחקים עדיין'}</Text>
            ) : (
              recentGames.map((game, index) => (
                <View key={game.id} style={[styles.gameRow, index < recentGames.length - 1 && styles.gameRowBorder]}>
                  <Text style={styles.gameDate}>{formatDate(game.gameDate)}</Text>
                  <View style={[styles.placeBadge, game.place === 1 && styles.firstPlace]}>
                    <Text style={[styles.placeText, game.place === 1 && styles.firstPlaceText]}>
                      {t.place} {game.place}/{game.totalPlayers}
                    </Text>
                  </View>
                  <Text style={styles.gameScore}>{game.finalScore} {t.points}</Text>
                </View>
              ))
            )}
          </View>
        </View>

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
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#5C4A32',
    padding: 12,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#8B7355',
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F5E6D3',
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 25,
  },
  statCard: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    width: '31%',
    borderWidth: 2,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  statIconBox: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F5E6D3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(245, 230, 211, 0.7)',
    textAlign: 'center',
  },
  // Sections
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5E6D3',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Recent Games
  recentGamesCard: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 20,
    padding: 5,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  gameRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 115, 85, 0.3)',
  },
  gameDate: {
    fontSize: 14,
    color: 'rgba(245, 230, 211, 0.7)',
    width: 50,
  },
  placeBadge: {
    backgroundColor: 'rgba(92, 74, 50, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  firstPlace: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    borderColor: '#F59E0B',
  },
  placeText: {
    fontSize: 13,
    color: 'rgba(245, 230, 211, 0.8)',
    fontWeight: '600',
  },
  firstPlaceText: {
    color: '#FFD700',
  },
  gameScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F5E6D3',
    width: 60,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#F5E6D3',
    marginTop: 10,
    fontSize: 16,
  },
  emptyText: {
    color: 'rgba(245, 230, 211, 0.6)',
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
});
