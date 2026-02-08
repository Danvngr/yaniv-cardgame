import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Mail, User } from 'lucide-react-native';
import React, { useState } from 'react';
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
          <View style={{ height: 24 }} />
          <View style={styles.card}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.subtitle}>{t.subtitle}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputWrapper}>
                <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                  <User size={20} color="#F5E6D3" />
                </View>
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                  placeholder={t.usernamePlaceholder}
                  value={username}
                  onChangeText={setUsername}
                  placeholderTextColor="rgba(245,230,211,0.6)"
                  autoCapitalize="none"
                />
              </View>

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

              <View style={styles.inputWrapper}>
                <View style={isRTL ? styles.iconRight : styles.iconLeft}>
                  <Lock size={20} color="#F5E6D3" />
                </View>
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right', paddingRight: 45, paddingLeft: 15 }]}
                  placeholder={t.confirmPlaceholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor="rgba(245,230,211,0.6)"
                  secureTextEntry
                />
              </View>

              <Pressable
                onPress={handleSignup}
                style={({ pressed }) => [styles.mainBtnWrap, pressed && styles.pressed]}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={['#5B8A72', '#3D5E4A']}
                  style={styles.mainBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.btnText}>{t.signupBtn}</Text>
                </LinearGradient>
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable onPress={() => router.replace('/')} style={styles.backBtn}>
                <ArrowLeft size={16} color="#F5E6D3" />
                <Text style={styles.backBtnText}>{t.backBtn}</Text>
              </Pressable>
            </View>
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
    paddingTop: 50,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#4B3728',
    width: width - 40,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 3,
    borderColor: '#8B7355',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 14,
  },
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '900', color: '#F5E6D3' },
  subtitle: { fontSize: 15, color: 'rgba(245,230,211,0.85)', marginTop: 6 },
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
  mainBtnWrap: { borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#4A3728' },
  mainBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  btnText: { color: '#F5E6D3', fontSize: 16, fontWeight: 'bold' },
  errorText: { color: '#FCA5A5', textAlign: 'center', fontWeight: '600', fontSize: 14 },
  backBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  backBtnText: { color: 'rgba(245,230,211,0.9)', fontWeight: '600', fontSize: 14 },
});
