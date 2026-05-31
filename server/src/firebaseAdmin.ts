import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  console.log('[DEBUG] Starting Firebase initialization check...');

  if (admin.apps.length > 0) {
    console.log('[DEBUG] Already initialized');
    return; 
  }

  const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  // Check 1: is the env var present?
  if (!secret) {
    console.warn('[Firebase Admin] WARNING: No FIREBASE_SERVICE_ACCOUNT env var found.');
    return;
  }

  console.log(`[DEBUG] Found secret string. Length: ${secret.length}`);

  try {
    // Check 2: does JSON parse succeed?
    const serviceAccount = JSON.parse(secret);
    console.log('[DEBUG] JSON parse successful. Project ID:', serviceAccount.project_id);

    // Check 3: can Firebase accept the credential?
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase Admin] Successfully initialized!');

  } catch (error: any) {
    // Catch errors so the process does not crash on bad config
    console.error('CRITICAL ERROR parsing/initializing Firebase:', error.message);
    // No throw: server can still start and logs remain visible
  }
};

// Initialize on import
initializeFirebaseAdmin();

export const verifyToken = async (token: string): Promise<string | null> => {
  if (admin.apps.length === 0) {
    console.warn('[Firebase Admin] Skipping verification - Admin not initialized');
    return null;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    console.error('[Firebase Admin] Token verification failed:', error);
    return null;
  }
};
