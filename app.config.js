// app.config.js
// This file extends app.json and adds environment variables

export default ({ config }) => {
  const productionServerUrl = 'https://yaniv-game-server.fly.dev';
  const envServerUrl = process.env.SERVER_URL;
  const serverUrl = envServerUrl && !envServerUrl.includes('localhost')
    ? envServerUrl
    : productionServerUrl;

  return {
    ...config,
    extra: {
      ...config.extra,
      // Firebase Configuration
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      // Server
      serverUrl,
    },
  };
};
