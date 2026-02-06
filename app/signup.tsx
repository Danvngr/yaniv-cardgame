import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, updateProfile } = useAuth();
  const [language, setLanguage] = useState<'en' | 'he'>('he');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRTL = language === 'he';

  const text = {
    en: {
      title: 'Create Account',
      subtitle: 'Join Yaniv and start playing',
      usernamePlaceholder: 'Username',
      emailPlaceholder: 'Email Address',
      passwordPlaceholder: 'Password',
      confirmPlaceholder: 'Confirm Password',
      signupBtn: 'Sign Up',
      backBtn: 'Back to Login',
      mismatch: 'Passwords do not match',
      missing: 'Please fill all fields',
      weakPassword: 'Password must be at least 6 characters',
      emailInUse: 'Email already in use',
      invalidEmail: 'Invalid email address',
      networkError: 'Network error, try again',
    },
    he: {
      title: 'פתיחת חשבון',
      subtitle: 'הצטרף ל-Yaniv ותתחיל לשחק',
      usernamePlaceholder: 'שם משתמש',
      emailPlaceholder: 'כתובת אימייל',
      passwordPlaceholder: 'סיסמה',
      confirmPlaceholder: 'אימות סיסמה',
      signupBtn: 'הרשמה',
      backBtn: 'חזרה להתחברות',
      mismatch: 'הסיסמאות לא תואמות',
      missing: 'נא למלא את כל השדות',
      weakPassword: 'הסיסמה חייבת להיות לפחות 6 תווים',
      emailInUse: 'האימייל כבר רשום',
      invalidEmail: 'כתובת אימייל לא תקינה',
      networkError: 'שגיאת רשת, נסה שוב',
    },
  };

  const t = text[language];

  const getSignupError = (err: unknown) => {
    const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
    switch (code) {
      case 'auth/weak-password':
        return t.weakPassword;
      case 'auth/email-already-in-use':
        return t.emailInUse;
      case 'auth/invalid-email':
        return t.invalidEmail;
      case 'auth/network-request-failed':
        return t.networkError;
      default:
        return language === 'he' ? 'ההרשמה נכשלה' : 'Signup failed';
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t.missing);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }
    setIsSubmitting(true);
    try {
      await signUp(email, password);
      if (username.trim()) {
        await updateProfile({ username: username.trim() });
      }
      router.replace('/lobby');
    } catch (e) {
      console.log('Signup error:', e);
      setError(getSignupError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <View style={{ width: 50 }} />

          <View style={styles.card}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.subtitle}>{t.subtitle}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputWrapper}>
                <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                  <User size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                  placeholder={t.usernamePlaceholder}
                  value={username}
                  onChangeText={setUsername}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                />
              </View>

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

              <View style={styles.inputWrapper}>
                <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                  <Lock size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                  placeholder={t.confirmPlaceholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                />
              </View>

              <Pressable
                onPress={handleSignup}
                style={({ pressed }) => [styles.mainBtn, pressed && styles.pressed]}
                disabled={isSubmitting}
              >
                <Text style={styles.btnTextWhite}>{t.signupBtn}</Text>
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable onPress={() => router.replace('/')} style={styles.backBtn}>
                <ArrowLeft size={16} color="#4b5563" />
                <Text style={styles.backBtnText}>{t.backBtn}</Text>
              </Pressable>
            </View>
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  langText: { color: '#fff', fontWeight: 'bold' },
  card: {
    backgroundColor: '#fff',
    width: width - 40,
    borderRadius: 30,
    paddingVertical: 40,
    paddingHorizontal: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    position: 'relative',
    marginTop: 40,
  },
  headerContainer: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 6 },
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
  mainBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#9333ea',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  btnTextWhite: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  errorText: { color: '#ef4444', textAlign: 'center', fontWeight: '600' },
  backBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  backBtnText: { color: '#4b5563', fontWeight: '600' },
});
