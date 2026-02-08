import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lock, Mail, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { user, signIn, signInAsGuest } = useAuth();
  const [language, setLanguage] = useState<'en' | 'he'>('he');
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'YANIV',
      subtitle: 'The Classic Card Game',
      guestBtn: 'Play as Guest',
      emailBtn: 'Continue with Email',
      emailPlaceholder: 'Email Address',
      passwordPlaceholder: 'Password',
      loginBtn: 'Login',
      signupBtn: 'Sign Up',
      backBtn: 'Back',
      noAccount: "Don't have an account?",
    },
    he: {
      title: 'יניב',
      subtitle: 'משחק הקלפים הקלאסי',
      guestBtn: 'שחק כאורח',
      emailBtn: 'המשך עם אימייל',
      emailPlaceholder: 'כתובת אימייל',
      passwordPlaceholder: 'סיסמה',
      loginBtn: 'התחבר',
      signupBtn: 'הרשם',
      backBtn: 'חזור',
      noAccount: 'אין לך חשבון?',
    }
  };

  const t = text[language];

  useEffect(() => {
    if (user) {
      router.replace('/lobby');
    }
  }, [user, router]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/lobby-background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.headerContainer}>
              <LinearGradient
                colors={['#8B7355', '#6B5344', '#5C4A32']}
                style={styles.logoBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.logoText}>{t.title}</Text>
              </LinearGradient>
              <Text style={styles.subtitle}>{t.subtitle}</Text>
            </View>

            {!showEmailLogin ? (
              <View style={styles.buttonsContainer}>
                <Pressable
                  onPress={async () => {
                    setError('');
                    setIsSubmitting(true);
                    try {
                      await signInAsGuest();
                    } catch (e) {
                      setError(language === 'he' ? 'התחברות כאורח נכשלה' : 'Guest sign-in failed');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  style={({ pressed }) => [styles.mainBtnWrap, pressed && styles.pressed]}
                  disabled={isSubmitting}
                >
                  <LinearGradient
                    colors={['#5B8A72', '#3D5E4A']}
                    style={styles.mainBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <User size={24} color="#F5E6D3" />
                    <Text style={styles.btnText}>{t.guestBtn}</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => setShowEmailLogin(true)}
                  style={({ pressed }) => [styles.mainBtnWrap, pressed && styles.pressed]}
                  disabled={isSubmitting}
                >
                  <LinearGradient
                    colors={['#8B7355', '#6B5344', '#5C4A32']}
                    style={styles.mainBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Mail size={24} color="#F5E6D3" />
                    <Text style={styles.btnText}>{t.emailBtn}</Text>
                  </LinearGradient>
                </Pressable>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            ) : (
              <View style={styles.formContainer}>
                <View style={styles.inputWrapper}>
                  <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                    <Mail size={20} color="#F5E6D3" />
                  </View>
                  <TextInput
                    style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChangeText={setEmail}
                    placeholderTextColor="rgba(245,230,211,0.6)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                    <Lock size={20} color="#F5E6D3" />
                  </View>
                  <TextInput
                    style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChangeText={setPassword}
                    placeholderTextColor="rgba(245,230,211,0.6)"
                    secureTextEntry
                  />
                </View>

                <Pressable
                  onPress={async () => {
                    setError('');
                    setIsSubmitting(true);
                    try {
                      await signIn(email, password);
                    } catch (e) {
                      setError(language === 'he' ? 'פרטי ההתחברות לא נכונים' : 'Invalid login details');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  style={({ pressed }) => [styles.mainBtnWrap, pressed && styles.pressed]}
                  disabled={isSubmitting}
                >
                  <LinearGradient
                    colors={['#5B8A72', '#3D5E4A']}
                    style={styles.mainBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.btnText}>{t.loginBtn}</Text>
                  </LinearGradient>
                </Pressable>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={[styles.footerRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={styles.footerText}>{t.noAccount} </Text>
                  <Pressable onPress={() => router.push('/signup')}>
                    <Text style={styles.linkText}>{t.signupBtn}</Text>
                  </Pressable>
                </View>

                <Pressable onPress={() => setShowEmailLogin(false)} style={styles.backBtn} disabled={isSubmitting}>
                  <Text style={styles.backBtnText}>{t.backBtn}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  backgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#4B3728',
    width: width - 40,
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 14,
    marginTop: 40,
  },
  headerContainer: { alignItems: 'center', marginBottom: 32 },
  logoBadge: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#6B5344',
  },
  logoText: { color: '#F5E6D3', fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 16, color: 'rgba(245,230,211,0.85)' },
  buttonsContainer: { gap: 14 },
  mainBtnWrap: { borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#4A3728' },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  btnText: { color: '#F5E6D3', fontSize: 16, fontWeight: 'bold' },
  formContainer: { gap: 14 },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  input: {
    width: '100%',
    paddingVertical: 14,
    paddingLeft: 45,
    paddingRight: 15,
    borderWidth: 2,
    borderColor: '#8B7355',
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: '#5C4A32',
    color: '#F5E6D3',
  },
  iconLeft: { position: 'absolute', left: 14, zIndex: 1 },
  iconRight: { position: 'absolute', right: 14, zIndex: 1 },
  backBtn: { alignItems: 'center', paddingVertical: 14 },
  backBtnText: { color: 'rgba(245,230,211,0.9)', fontWeight: '600', fontSize: 14 },
  errorText: { color: '#FCA5A5', textAlign: 'center', fontWeight: '600', fontSize: 14 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  footerText: { color: 'rgba(245,230,211,0.8)', fontSize: 14 },
  linkText: { color: '#D4A574', fontSize: 14, fontWeight: 'bold' },
});
