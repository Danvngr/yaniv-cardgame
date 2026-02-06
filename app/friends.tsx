import { useRouter } from 'expo-router';
import { ArrowRight, Crown, DoorOpen, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View, Image } from 'react-native';

const { width } = Dimensions.get('window');

export default function FriendsModeScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<'he' | 'en'>('he');

  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Play with Friends',
      createRoom: 'Create Room',
      createDesc: 'Open a new private room',
      joinRoom: 'Join Room',
      joinDesc: 'Enter an existing room',
    },
    he: {
      title: 'אופליין מוד',
      createRoom: 'פתח חדר',
      createDesc: 'צור חדר פרטי חדש',
      joinRoom: 'הצטרף לחדר',
      joinDesc: 'הכנס לחדר קיים',
    }
  };

  const t = text[language];

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/lobby-background.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      {/* Header */}
      <View style={[styles.staticHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable 
          onPress={() => router.replace('/lobby')} 
          style={({pressed}) => [styles.iconButton, pressed && styles.pressed]}
          hitSlop={20}
        >
          <ArrowRight color="#F5E6D3" size={24} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
        </Pressable>

        <View style={{ width: 50 }} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        
        <View style={styles.headerContainer}>
          <View style={styles.titleBadge}>
            <Text style={styles.titleText}>{t.title}</Text>
          </View>
          <View style={styles.emojiRow}>
            <Text style={styles.emoji}>👥</Text>
            <Text style={styles.emoji}>🎴</Text>
            <Text style={styles.emoji}>🎮</Text>
          </View>
        </View>

        <View style={styles.cardsContainer}>

          {/* Create Room Card */}
          <Pressable 
            style={({pressed}) => [styles.card, styles.createCard, pressed && styles.pressed]}
            onPress={() => router.push('/create-room')} 
          >
            <View style={[styles.cardContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={styles.iconBox}>
                <Crown size={32} color="#FFD700" />
              </View>
              <View style={[styles.textContainer, isRTL ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                <Text style={styles.cardTitle}>{t.createRoom}</Text>
                <Text style={styles.cardDesc}>{t.createDesc}</Text>
              </View>
              <View style={styles.smallIconBadge}>
                <Plus size={20} color="#fff" />
              </View>
            </View>
          </Pressable>

          {/* Join Room Card */}
          <Pressable 
            style={({pressed}) => [styles.card, styles.joinCard, pressed && styles.pressed]}
            onPress={() => router.push('/join-room')}
          >
            <View style={[styles.cardContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.iconBox, styles.joinIconBox]}>
                <DoorOpen size={32} color="#A855F7" />
              </View>
              <View style={[styles.textContainer, isRTL ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                <Text style={styles.cardTitle}>{t.joinRoom}</Text>
                <Text style={styles.cardDesc}>{t.joinDesc}</Text>
              </View>
              <View style={[styles.smallIconBadge, styles.joinSmallBadge]}>
                <ArrowRight size={20} color="#fff" style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }}/>
              </View>
            </View>
          </Pressable>

        </View>
      </View>

      <View style={styles.footerDecoration}>
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
  staticHeader: { 
    paddingTop: 60, 
    paddingHorizontal: 20, 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    zIndex: 100 
  },
  iconButton: { 
    backgroundColor: '#5C4A32', 
    padding: 12, 
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -40, paddingHorizontal: 20 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  titleBadge: { 
    backgroundColor: '#5C4A32', 
    paddingHorizontal: 30, 
    paddingVertical: 15, 
    borderRadius: 30, 
    marginBottom: 20, 
    borderWidth: 3, 
    borderColor: '#8B7355' 
  },
  titleText: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#F5E6D3', 
    textShadowColor: 'rgba(0,0,0,0.3)', 
    textShadowOffset: { width: 0, height: 2 }, 
    textShadowRadius: 4 
  },
  emojiRow: { flexDirection: 'row', gap: 15, opacity: 0.6 },
  emoji: { fontSize: 32 },
  cardsContainer: { width: '100%', gap: 20 },
  card: { 
    borderRadius: 24, 
    padding: 20, 
    width: '100%', 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 5, 
    elevation: 8 
  },
  createCard: { 
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  joinCard: { 
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  cardContent: { alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  iconBox: { 
    padding: 15, 
    borderRadius: 18,
    backgroundColor: 'rgba(92, 74, 50, 0.8)',
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  joinIconBox: {
    backgroundColor: 'rgba(92, 74, 50, 0.8)',
  },
  textContainer: { flex: 1, paddingHorizontal: 10 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: '#F5E6D3', marginBottom: 4 },
  cardDesc: { fontSize: 16, color: 'rgba(245, 230, 211, 0.7)' },
  smallIconBadge: { 
    backgroundColor: '#5B8A72', 
    padding: 8, 
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#3D5E4A',
  },
  joinSmallBadge: {
    backgroundColor: 'rgba(92, 74, 50, 0.8)',
    borderColor: '#8B7355',
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  footerDecoration: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 16, 
    marginBottom: 30,
  },
  cardSuit: {
    fontSize: 28,
    color: '#1C1810',
  },
  redSuit: {
    color: '#DC2626',
  },
});
