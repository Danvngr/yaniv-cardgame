import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  console.log('[DEBUG] Starting Firebase initialization check...'); // לוג התחלה

  if (admin.apps.length > 0) {
    console.log('[DEBUG] Already initialized');
    return; 
  }

  const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  // בדיקה 1: האם המשתנה קיים בכלל?
  if (!secret) {
    console.warn('[Firebase Admin] WARNING: No FIREBASE_SERVICE_ACCOUNT env var found.');
    return;
  }

  console.log(`[DEBUG] Found secret string. Length: ${secret.length}`); // בדיקה שהמחרוזת לא ריקה

  try {
    // בדיקה 2: האם הפארס עובד?
    const serviceAccount = JSON.parse(secret);
    console.log('[DEBUG] JSON parse successful. Project ID:', serviceAccount.project_id);

    // בדיקה 3: האם פיירבייס מצליח לקבל את זה?
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase Admin] Successfully initialized!');

  } catch (error: any) {
    // כאן התיקון הגדול: אנחנו תופסים את השגיאה ולא נותנים לשרת לקרוס!
    console.error('CRITICAL ERROR parsing/initializing Firebase:', error.message);
    // אנחנו לא עושים throw error כדי שהשרת יעלה בכל זאת ונוכל לראות את הלוג
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

export const getUser = async (uid: string) => {
  if (admin.apps.length === 0) return null;
  try {
    return await admin.auth().getUser(uid);
  } catch (error) {
    console.error('[Firebase Admin] Failed to get user:', error);
    return null;
  }
};

export default admin;