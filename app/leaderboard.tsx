import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Trophy, Crown, Medal, Star } from 'lucide-react-native';
import { getLeaderboard } from '../lib/userService';

type LeaderboardEntry = {
  uid: string;
  username: string;
  avatar: string;
  totalPoints: number;
  wins: number;
  rank: number;
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Leaderboard',
      topPlayers: 'Top Players',
      allPlayers: 'All Players',
      points: 'pts',
      wins: 'wins',
      loading: 'Loading...',
      noPlayers: 'No players yet'
    },
    he: {
      title: 'לוח מובילים',
      topPlayers: 'הטופ 3',
      allPlayers: 'כל השחקנים',
      points: "נק׳",
      wins: 'ניצחונות',
      loading: 'טוען...',
      noPlayers: 'אין שחקנים עדיין'
    }
  };

  const t = text[language];

  // Load leaderboard
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await getLeaderboard(50);
        setLeaderboard(data);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

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

        {/* Top 3 */}
        {topThree.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t.topPlayers}</Text>
            <View style={[styles.topRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {topThree.map((player) => (
                <View key={player.uid} style={[styles.topCard, player.rank === 1 && styles.topCardGold]}>
                  <View style={styles.topAvatar}>
                    <Text style={styles.topAvatarText}>{player.avatar}</Text>
                  </View>
                  <Text style={styles.topName}>{player.username}</Text>
                  <View style={styles.topBadge}>
                    {player.rank === 1 ? <Crown size={16} color="#FFD700" /> : player.rank === 2 ? <Medal size={16} color="#C0C0C0" /> : <Star size={16} color="#CD7F32" />}
                    <Text style={styles.topRankText}>#{player.rank}</Text>
                  </View>
                  <Text style={styles.topPoints}>{player.totalPoints} {t.points}</Text>
                  <Text style={styles.topWins}>{player.wins} {t.wins}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* All Players */}
        <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t.allPlayers}</Text>
        <View style={styles.listCard}>
          {rest.length === 0 && topThree.length === 0 ? (
            <Text style={styles.emptyText}>{t.noPlayers || 'אין שחקנים עדיין'}</Text>
          ) : (
            rest.map((player) => (
              <View key={player.uid} style={styles.listRow}>
                <Text style={styles.rankText}>#{player.rank}</Text>
                <View style={[styles.listAvatar, isRTL && { marginLeft: 0, marginRight: 10 }]}>
                  <Text style={styles.listAvatarText}>{player.avatar}</Text>
                </View>
                <View style={[styles.listInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={styles.listName}>{player.username}</Text>
                  <Text style={styles.listSub}>{player.wins} {t.wins}</Text>
                </View>
                <View style={styles.listPointsBox}>
                  <Trophy size={14} color="#FFD700" />
                  <Text style={styles.listPoints}>{player.totalPoints} {t.points}</Text>
                </View>
              </View>
            ))
          )}
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
    marginBottom: 25,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5E6D3',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  topRow: {
    gap: 12,
    marginBottom: 24,
  },
  topCard: {
    flex: 1,
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  topCardGold: {
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  topAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(92, 74, 50, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  topAvatarText: {
    fontSize: 26,
  },
  topName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F5E6D3',
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  topRankText: {
    fontSize: 12,
    color: 'rgba(245, 230, 211, 0.7)',
    fontWeight: '600',
  },
  topPoints: {
    fontSize: 12,
    color: '#FFD700',
    marginTop: 6,
    fontWeight: 'bold',
  },
  topWins: {
    fontSize: 11,
    color: 'rgba(245, 230, 211, 0.6)',
    marginTop: 2,
  },
  listCard: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 20,
    paddingVertical: 6,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 115, 85, 0.3)',
  },
  rankText: {
    width: 28,
    color: 'rgba(245, 230, 211, 0.7)',
    fontWeight: 'bold',
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(92, 74, 50, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  listAvatarText: {
    fontSize: 18,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F5E6D3',
  },
  listSub: {
    fontSize: 12,
    color: 'rgba(245, 230, 211, 0.6)',
    marginTop: 2,
  },
  listPointsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listPoints: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
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
