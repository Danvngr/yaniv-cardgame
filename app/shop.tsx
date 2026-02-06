import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight, ShoppingBag, Check } from 'lucide-react-native';

type ShopItem = {
  id: string;
  name: string;
  preview: string;
  price: number;
  owned: boolean;
  equipped: boolean;
};

type TabKey = 'avatars' | 'backs';

export default function ShopScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [activeTab, setActiveTab] = useState<TabKey>('avatars');
  const [message, setMessage] = useState<string | null>(null);
  const [avatars, setAvatars] = useState<ShopItem[]>([
    { id: 'a1', name: 'Fox', preview: '🦊', price: 600, owned: true, equipped: true },
    { id: 'a2', name: 'Lion', preview: '🦁', price: 800, owned: false, equipped: false },
    { id: 'a3', name: 'Wolf', preview: '🐺', price: 750, owned: false, equipped: false },
    { id: 'a4', name: 'Joker', preview: '🃏', price: 900, owned: false, equipped: false },
  ]);
  const [cardBacks, setCardBacks] = useState<ShopItem[]>([
    { id: 'b1', name: 'Royal Red', preview: '#ef4444', price: 700, owned: true, equipped: true },
    { id: 'b2', name: 'Midnight', preview: '#0f172a', price: 900, owned: false, equipped: false },
    { id: 'b3', name: 'Emerald', preview: '#10b981', price: 850, owned: false, equipped: false },
    { id: 'b4', name: 'Gold', preview: '#facc15', price: 1100, owned: false, equipped: false },
  ]);

  const isRTL = language === 'he';


  const text = {
    en: {
      title: 'Shop',
      avatars: 'Avatars',
      backs: 'Card Backs',
      buy: 'Buy',
      equip: 'Equip',
      owned: 'Owned',
      popular: 'Popular',
      bestValue: 'Best Value',
      purchaseDone: 'Purchased',
      equipped: 'Equipped',
    },
    he: {
      title: 'חנות',
      avatars: 'אווטרים',
      backs: 'גב קלפים',
      buy: 'קנה',
      equip: 'הפעל',
      owned: 'נרכש',
      popular: 'פופולרי',
      bestValue: 'הכי משתלם',
      purchaseDone: 'נרכש',
      equipped: 'נבחר',
    },
  };

  const t = text[language];

  const handleItemAction = (
    item: ShopItem,
    items: ShopItem[],
    setItems: React.Dispatch<React.SetStateAction<ShopItem[]>>
  ) => {
    if (item.owned) {
      setItems((current) =>
        current.map((entry) => ({ ...entry, equipped: entry.id === item.id }))
      );
      setMessage(t.equipped);
      return;
    }

    // For now, items are free (coins removed)
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, owned: true, equipped: true } : entry
      )
    );
    setMessage(t.purchaseDone);
  };

  return (
    <LinearGradient colors={['#9333ea', '#db2777', '#fb923c']} style={styles.container}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={10}>
          <ArrowRight color="#fff" size={22} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
        </Pressable>
        <View style={styles.titleRow}>
          <ShoppingBag size={20} color="#fff" />
          <Text style={styles.headerTitle}>{t.title}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.tabs}>
          {(['avatars', 'backs'] as TabKey[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {t[tab]}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'avatars' && (
          <View style={styles.grid}>
            {avatars.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <Text style={styles.itemPreview}>{item.preview}</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>{item.owned ? t.owned : t.buy}</Text>
                <Pressable
                  onPress={() => handleItemAction(item, avatars, setAvatars)}
                  style={[styles.itemButton, item.owned ? styles.equipButton : styles.buyButton]}
                >
                  <Text style={styles.itemButtonText}>
                    {item.owned ? (item.equipped ? t.owned : t.equip) : t.buy}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'backs' && (
          <View style={styles.grid}>
            {cardBacks.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={[styles.backPreview, { backgroundColor: item.preview }]} />
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>{item.owned ? t.owned : t.buy}</Text>
                <Pressable
                  onPress={() => handleItemAction(item, cardBacks, setCardBacks)}
                  style={[styles.itemButton, item.owned ? styles.equipButton : styles.buyButton]}
                >
                  {item.equipped ? <Check size={14} color="#fff" /> : null}
                  <Text style={styles.itemButtonText}>
                    {item.owned ? (item.equipped ? t.owned : t.equip) : t.buy}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    marginTop: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 30 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  langText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  content: { padding: 20, paddingBottom: 40 },
  message: { color: 'rgba(255,255,255,0.9)', marginTop: 8, marginBottom: 8 },
  tabs: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tab: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#fff', fontWeight: '700' },
  tabTextActive: { color: '#111827' },
  section: { marginTop: 20, gap: 12 },
  buyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  buyButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  grid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  itemPreview: { fontSize: 30 },
  backPreview: { width: 46, height: 60, borderRadius: 8 },
  itemName: { fontWeight: '700', color: '#111827' },
  itemPrice: { color: '#6b7280', fontSize: 12 },
  itemButton: {
    marginTop: 6,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  itemButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  equipButton: { backgroundColor: '#7c3aed' },
});
