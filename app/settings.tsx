import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Modal, Image, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Globe, Bell, Music, Volume2, MessageCircle, LogOut, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../context/SoundContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOutUser, profile, updateProfile } = useAuth();
  const { musicOn, setMusicOn, sfxOn, setSfxOn } = useSound();
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Display name
  const [displayName, setDisplayName] = useState(profile?.username ?? '');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  useEffect(() => {
    setDisplayName(profile?.username ?? '');
  }, [profile?.username]);
  
  // Settings states (not in SoundContext)
  const [notifications, setNotifications] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);

  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Settings',
      general: 'General',
      displayName: 'Display name',
      displayNamePlaceholder: 'Your name',
      saveName: 'Save',
      nameSaved: 'Saved',
      nameTaken: 'This name is already taken',
      notifications: 'Notifications',
      music: 'Music',
      sounds: 'Sound Effects',
      chat: 'Chat Enabled',
      language: 'Language',
      languageDesc: 'Change app language',
      logout: 'Logout',
      logoutConfirm: 'Are you sure you want to logout?',
      cancel: 'Cancel',
      confirm: 'Logout'
    },
    he: {
      title: 'הגדרות',
      general: 'כללי',
      displayName: 'שם תצוגה',
      displayNamePlaceholder: 'השם שלך',
      saveName: 'שמור',
      nameSaved: 'נשמר',
      nameTaken: 'שם זה תפוס',
      notifications: 'התראות',
      music: 'מוזיקה',
      sounds: 'צלילים',
      chat: "צ'אט פעיל",
      language: 'שפה',
      languageDesc: 'שנה שפת אפליקציה',
      logout: 'התנתקות',
      logoutConfirm: 'האם אתה בטוח שברצונך להתנתק?',
      cancel: 'ביטול',
      confirm: 'התנתק'
    }
  };

  const t = text[language];

  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    if (trimmed === profile?.username) return;
    setDisplayNameError(null);
    setDisplayNameSaving(true);
    try {
      await updateProfile({ username: trimmed });
      setDisplayNameError(null);
    } catch (err: any) {
      setDisplayNameError(err?.message === 'username-taken' ? t.nameTaken : (err?.message || t.nameTaken));
    } finally {
      setDisplayNameSaving(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      await signOutUser();
      router.replace('/');
    } catch (error) {
      console.error('[Settings] Failed to sign out:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Image */}
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

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t.general}</Text>
          <View style={styles.settingsCard}>
            <View style={[styles.settingRow, styles.displayNameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.settingLabelContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <User size={20} color="#8B7355" />
                <Text style={styles.settingLabel}>{t.displayName}</Text>
              </View>
              <View style={styles.displayNameInputRow}>
                <TextInput
                  style={[styles.displayNameInput, isRTL && { textAlign: 'right' }]}
                  value={displayName}
                  onChangeText={(v) => { setDisplayName(v); setDisplayNameError(null); }}
                  placeholder={t.displayNamePlaceholder}
                  placeholderTextColor="rgba(245, 230, 211, 0.5)"
                  editable={!displayNameSaving}
                />
                <Pressable
                  onPress={handleSaveDisplayName}
                  disabled={displayNameSaving || !displayName.trim() || displayName.trim() === profile?.username}
                  style={[styles.displayNameSaveBtn, displayNameSaving && styles.displayNameSaveBtnDisabled]}
                >
                  {displayNameSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.displayNameSaveText}>{t.saveName}</Text>}
                </Pressable>
              </View>
            </View>
            {displayNameError ? <Text style={[styles.displayNameError, isRTL && { textAlign: 'right' }]}>{displayNameError}</Text> : null}
            <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.settingLabelContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Bell size={20} color="#8B7355" />
                <Text style={styles.settingLabel}>{t.notifications}</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                thumbColor={notifications ? '#5B8A72' : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: '#A8D5BA' }}
              />
            </View>

            <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.settingLabelContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Music size={20} color="#8B7355" />
                <Text style={styles.settingLabel}>{t.music}</Text>
              </View>
              <Switch
                value={musicOn}
                onValueChange={setMusicOn}
                thumbColor={musicOn ? '#5B8A72' : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: '#A8D5BA' }}
              />
            </View>

            <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.settingLabelContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Volume2 size={20} color="#8B7355" />
                <Text style={styles.settingLabel}>{t.sounds}</Text>
              </View>
              <Switch
                value={sfxOn}
                onValueChange={setSfxOn}
                thumbColor={sfxOn ? '#5B8A72' : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: '#A8D5BA' }}
              />
            </View>

            <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.settingLabelContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MessageCircle size={20} color="#8B7355" />
                <Text style={styles.settingLabel}>{t.chat}</Text>
              </View>
              <Switch
                value={chatEnabled}
                onValueChange={setChatEnabled}
                thumbColor={chatEnabled ? '#5B8A72' : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: '#A8D5BA' }}
              />
            </View>

            <View style={[styles.settingRow, styles.settingRowLast, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.settingLabelContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Globe size={20} color="#8B7355" />
                <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  <Text style={styles.settingLabel}>{t.language}</Text>
                  <Text style={styles.settingSubLabel}>{t.languageDesc}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setLanguage(language === 'en' ? 'he' : 'en')}
                style={styles.languageButton}
              >
                <Text style={styles.languageButtonText}>{language === 'he' ? 'עברית' : 'English'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Logout */}
        <Pressable 
          onPress={() => setShowLogoutModal(true)}
          style={({pressed}) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutText}>{t.logout}</Text>
        </Pressable>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.logoutConfirm}</Text>
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setShowLogoutModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable onPress={handleLogout} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>{t.confirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5E6D3',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  settingsCard: {
    backgroundColor: 'rgba(75, 55, 40, 0.95)',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  settingRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 115, 85, 0.3)',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  displayNameRow: {
    flexWrap: 'wrap',
  },
  displayNameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 120,
  },
  displayNameInput: {
    flex: 1,
    backgroundColor: '#5C4A32',
    borderWidth: 2,
    borderColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F5E6D3',
    fontSize: 16,
  },
  displayNameSaveBtn: {
    backgroundColor: '#5B8A72',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3D5E4A',
  },
  displayNameSaveBtnDisabled: {
    opacity: 0.7,
  },
  displayNameSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  displayNameError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginHorizontal: 18,
  },
  settingLabelContainer: {
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#F5E6D3',
    fontWeight: '600',
  },
  settingSubLabel: {
    fontSize: 12,
    color: 'rgba(245, 230, 211, 0.7)',
    marginTop: 2,
  },
  languageButton: {
    backgroundColor: '#5B8A72',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3D5E4A',
  },
  languageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#9B4444',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    gap: 10,
    borderWidth: 3,
    borderColor: '#7A3333',
  },
  logoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#4B3728',
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5E6D3',
    textAlign: 'center',
    marginBottom: 25,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#5C4A32',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B7355',
  },
  modalCancelText: {
    color: '#F5E6D3',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: '#9B4444',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7A3333',
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
