import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Mail, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
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
    <LinearGradient
      colors={['#9333ea', '#ec4899', '#fb923c']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Main Card */}
          <View style={styles.card}>
            <View style={[styles.decorativeCircle, styles.circleTop]} />
            <View style={[styles.decorativeCircle, styles.circleBottom]} />

            {/* Header */}
            <View style={styles.headerContainer}>
              <LinearGradient
                colors={['#9333ea', '#db2777']}
                style={styles.logoBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.logoText}>{t.title}</Text>
              </LinearGradient>
              <Text style={styles.subtitle}>{t.subtitle}</Text>
            </View>

            {/* Buttons */}
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
                  style={({pressed}) => [styles.mainBtn, styles.guestBtn, pressed && styles.pressed]}
                  disabled={isSubmitting}
                >
                  <User size={24} color="#fff" />
                  <Text style={styles.btnTextWhite}>{t.guestBtn}</Text>
                </Pressable>

                <Pressable 
                  onPress={() => setShowEmailLogin(true)}
                  style={({pressed}) => [styles.mainBtn, styles.emailBtn, pressed && styles.pressed]}
                  disabled={isSubmitting}
                >
                  <Mail size={24} color="#fff" />
                  <Text style={styles.btnTextWhite}>{t.emailBtn}</Text>
                </Pressable>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            ) : (
              <View style={styles.formContainer}>
                <View style={styles.inputWrapper}>
                  <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                    <Mail size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChangeText={setEmail}
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                    <Lock size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChangeText={setPassword}
                    placeholderTextColor="#9ca3af"
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
                  style={({pressed}) => [styles.mainBtn, styles.emailBtn, pressed && styles.pressed]}
                  disabled={isSubmitting}
                >
                  <Text style={styles.btnTextWhite}>{t.loginBtn}</Text>
                </Pressable>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={[styles.footerRow, isRTL && {flexDirection: 'row-reverse'}]}>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  langButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 10,
  },
  langText: { color: '#fff', fontWeight: 'bold' },
  card: {
    backgroundColor: '#fff',
    width: width - 40,
    borderRadius: 30,
    paddingVertical: 40,
    paddingHorizontal: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    position: 'relative',
    marginTop: 40,
  },
  decorativeCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.2,
  },
  circleTop: { top: -30, right: -30, backgroundColor: '#d8b4fe' },
  circleBottom: { bottom: -30, left: -30, backgroundColor: '#fdba74' },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoBadge: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 20,
    transform: [{ rotate: '-3deg' }],
    marginBottom: 15,
    elevation: 5,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  subtitle: { fontSize: 18, color: '#4b5563' },
  buttonsContainer: { gap: 15 },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  guestBtn: { backgroundColor: '#10b981' },
  emailBtn: { backgroundColor: '#9333ea' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  btnTextWhite: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  formContainer: { gap: 15 },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  input: {
    width: '100%',
    paddingVertical: 16,
    paddingLeft: 45,
    paddingRight: 15,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  iconLeft: { position: 'absolute', left: 15, zIndex: 1 },
  iconRight: { position: 'absolute', right: 15, zIndex: 1 },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backBtnText: { color: '#4b5563', fontWeight: '600' },
  errorText: { color: '#ef4444', textAlign: 'center', fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#6b7280', fontSize: 14 },
  linkText: { color: '#9333ea', fontSize: 14, fontWeight: 'bold' },
});
