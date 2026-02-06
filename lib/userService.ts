import type { User } from 'firebase/auth';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export type UserStats = {
  wins: number;
  losses: number;
  gamesPlayed: number;
  yanivCalls?: number;
  assafSuccess?: number;
  totalPoints?: number; // Total points accumulated across all games
  avgScore?: number; // Average score per game
};

export type GameResult = {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar: string;
  place: number; // 1 = winner, 2 = second, etc.
  totalPlayers: number;
  finalScore: number;
  gameDate: unknown;
  roomCode?: string;
};

export type UserProfile = {
  username: string;
  usernameLower?: string;
  avatar: string;
  coins: number;
  createdAt?: unknown;
  stats: UserStats;
  lastSeen?: unknown; // Timestamp for online status
  inRoom?: boolean; // true when user is in a room or in a game
};

export type FriendRequest = {
  id: string;
  from: string; // UID
  to: string; // UID
  status: 'pending' | 'accepted' | 'declined';
  createdAt: unknown;
};

export type Friend = {
  uid: string;
  username: string;
  avatar: string;
  isOnline: boolean;
  inRoom?: boolean; // true when friend is in a room or in a game (not inviteable)
};

export type GameInvite = {
  id: string;
  from: string; // UID
  to: string; // UID
  fromName: string;
  fromAvatar: string;
  roomCode: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: unknown;
  expiresAt?: unknown;
};

export const buildDefaultProfile = (user: User): UserProfile => ({
  username: user.displayName ?? `Player-${user.uid.slice(0, 4)}`,
  usernameLower: (user.displayName ?? `Player-${user.uid.slice(0, 4)}`).toLowerCase(),
  avatar: '👤',
  coins: 0,
  stats: { wins: 0, losses: 0, gamesPlayed: 0 },
});

export const getUserProfile = async (uid: string) => {
  const ref = doc(db, 'users', uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return snapshot.data() as UserProfile;
};

export const createUserProfile = async (uid: string, profile: UserProfile) => {
  const ref = doc(db, 'users', uid);
  const usernameLower = profile.username?.trim().toLowerCase();
  await setDoc(ref, {
    ...profile,
    usernameLower,
    createdAt: serverTimestamp(),
  });
  if (usernameLower) {
    const usernameRef = doc(db, 'usernames', usernameLower);
    await setDoc(usernameRef, { uid }, { merge: true });
  }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  const ref = doc(db, 'users', uid);
  const updateData: Partial<UserProfile> = { ...data };
  if (typeof data.username === 'string') {
    updateData.usernameLower = data.username.trim().toLowerCase();
  }
  await updateDoc(ref, updateData);
};

/** Set whether the user is currently in a room/game (so friends see them as busy) */
export const setUserInRoom = async (uid: string, inRoom: boolean) => {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { inRoom });
};

export const updateUsername = async (uid: string, username: string) => {
  const trimmed = username.trim();
  const usernameLower = trimmed.toLowerCase();
  const userRef = doc(db, 'users', uid);
  const usernameRef = doc(db, 'usernames', usernameLower);

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('user-not-found');
    }

    const userData = userSnap.data() as UserProfile;
    const currentLower = (userData.username ?? '').trim().toLowerCase();

    if (currentLower === usernameLower) {
      tx.update(userRef, { username: trimmed, usernameLower });
      tx.set(usernameRef, { uid }, { merge: true });
      return;
    }

    const usernameSnap = await tx.get(usernameRef);
    if (usernameSnap.exists()) {
      const owner = (usernameSnap.data() as { uid?: string })?.uid;
      if (owner && owner !== uid) {
        throw new Error('username-taken');
      }
    }

    tx.set(usernameRef, { uid });
    tx.update(userRef, { username: trimmed, usernameLower });

    if (currentLower) {
      const oldUsernameRef = doc(db, 'usernames', currentLower);
      tx.delete(oldUsernameRef);
    }
  });
};

// Update last seen timestamp (for online status)
export const updateLastSeen = async (uid: string) => {
  const ref = doc(db, 'users', uid);
  const snapshot = await getDoc(ref);
  
  // Only update if profile exists
  if (!snapshot.exists()) {
    // Profile doesn't exist yet - don't update (will be created by ensureProfile)
    return;
  }
  
  await updateDoc(ref, { lastSeen: serverTimestamp() });
};

// Search users by username (case-insensitive)
export const searchUsersByUsername = async (searchTerm: string, excludeUid?: string) => {
  const usersRef = collection(db, 'users');
  // Firestore doesn't support case-insensitive search, so we use range query and filter client-side
  const searchLower = searchTerm.toLowerCase();
  const searchUpper = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase() + '\uf8ff';
  const q = query(usersRef, where('username', '>=', searchTerm), where('username', '<=', searchUpper));
  const snapshot = await getDocs(q);
  const results: Array<{ uid: string; username: string; avatar: string }> = [];
  snapshot.forEach((doc) => {
    const data = doc.data() as UserProfile;
    if (doc.id !== excludeUid && data.username.toLowerCase().includes(searchLower)) {
      results.push({ uid: doc.id, username: data.username, avatar: data.avatar });
    }
  });
  return results.slice(0, 20); // Limit to 20 results
};

// Send friend request
export const sendFriendRequest = async (fromUid: string, toUid: string) => {
  // Check if request already exists
  const requestsRef = collection(db, 'friendRequests');
  const existingQuery = query(
    requestsRef,
    where('from', '==', fromUid),
    where('to', '==', toUid),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error('Friend request already sent');
  }

  // Check if already friends
  const friendsRef = collection(db, 'users', fromUid, 'friends');
  const friendDoc = await getDoc(doc(friendsRef, toUid));
  if (friendDoc.exists()) {
    throw new Error('Already friends');
  }

  await addDoc(requestsRef, {
    from: fromUid,
    to: toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
};

// Get friend requests (incoming)
export const getIncomingFriendRequests = async (toUid: string): Promise<FriendRequest[]> => {
  const requestsRef = collection(db, 'friendRequests');
  const q = query(requestsRef, where('to', '==', toUid), where('status', '==', 'pending'));
  const snapshot = await getDocs(q);
  const requests: FriendRequest[] = [];
  snapshot.forEach((doc) => {
    requests.push({ id: doc.id, ...(doc.data() as Omit<FriendRequest, 'id'>) });
  });
  return requests;
};

// Accept friend request
export const acceptFriendRequest = async (requestId: string, fromUid: string, toUid: string) => {
  const requestRef = doc(db, 'friendRequests', requestId);
  await updateDoc(requestRef, { status: 'accepted' });

  // Add to both users' friends lists
  const fromFriendsRef = doc(db, 'users', fromUid, 'friends', toUid);
  const toFriendsRef = doc(db, 'users', toUid, 'friends', fromUid);
  
  const fromProfile = await getUserProfile(fromUid);
  const toProfile = await getUserProfile(toUid);
  
  if (fromProfile && toProfile) {
    await setDoc(fromFriendsRef, {
      uid: toUid,
      username: toProfile.username,
      avatar: toProfile.avatar,
      addedAt: serverTimestamp(),
    });
    await setDoc(toFriendsRef, {
      uid: fromUid,
      username: fromProfile.username,
      avatar: fromProfile.avatar,
      addedAt: serverTimestamp(),
    });
  }
};

// Decline friend request
export const declineFriendRequest = async (requestId: string) => {
  const requestRef = doc(db, 'friendRequests', requestId);
  await updateDoc(requestRef, { status: 'declined' });
};

// Get friends list
export const getFriends = async (uid: string): Promise<Friend[]> => {
  const friendsRef = collection(db, 'users', uid, 'friends');
  const snapshot = await getDocs(friendsRef);
  const friends: Friend[] = [];
  
  for (const friendDoc of snapshot.docs) {
    const friendData = friendDoc.data();
    const friendUid = friendData.uid;
    const friendProfile = await getUserProfile(friendUid);
    
    if (friendProfile) {
      // Check if online (last seen within 5 minutes)
      const lastSeen = friendProfile.lastSeen;
      let isOnline = false;
      if (lastSeen) {
        const timestamp = lastSeen as Timestamp;
        const lastSeenMillis = timestamp.toMillis ? timestamp.toMillis() : Date.now();
        isOnline = Date.now() - lastSeenMillis < 5 * 60 * 1000;
      }
      
      friends.push({
        uid: friendUid,
        username: friendProfile.username,
        avatar: friendProfile.avatar,
        isOnline,
        inRoom: !!friendProfile.inRoom,
      });
    }
  }
  
  return friends;
};

// Remove friend
export const removeFriend = async (uid: string, friendUid: string) => {
  const myFriendsRef = doc(db, 'users', uid, 'friends', friendUid);
  const friendFriendsRef = doc(db, 'users', friendUid, 'friends', uid);
  await deleteDoc(myFriendsRef);
  await deleteDoc(friendFriendsRef);
};

// Subscribe to friend requests (real-time)
export const subscribeToFriendRequests = (
  toUid: string,
  callback: (requests: FriendRequest[]) => void
): Unsubscribe => {
  const requestsRef = collection(db, 'friendRequests');
  const q = query(requestsRef, where('to', '==', toUid), where('status', '==', 'pending'));
  return onSnapshot(q, (snapshot) => {
    const requests: FriendRequest[] = [];
    snapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...(doc.data() as Omit<FriendRequest, 'id'>) });
    });
    callback(requests);
  });
};

// Subscribe to friends list (real-time)
export const subscribeToFriends = (
  uid: string,
  callback: (friends: Friend[]) => void
): Unsubscribe => {
  const friendsRef = collection(db, 'users', uid, 'friends');
  return onSnapshot(friendsRef, async (snapshot) => {
    const friends: Friend[] = [];
    for (const friendDoc of snapshot.docs) {
      const friendData = friendDoc.data();
      const friendUid = friendData.uid;
      const friendProfile = await getUserProfile(friendUid);
      
      if (friendProfile) {
        const lastSeen = friendProfile.lastSeen;
        let isOnline = false;
        if (lastSeen) {
          const timestamp = lastSeen as Timestamp;
          const lastSeenMillis = timestamp.toMillis ? timestamp.toMillis() : Date.now();
          isOnline = Date.now() - lastSeenMillis < 5 * 60 * 1000;
        }
        
        friends.push({
          uid: friendUid,
          username: friendProfile.username,
          avatar: friendProfile.avatar,
          isOnline,
          inRoom: !!friendProfile.inRoom,
        });
      }
    }
    callback(friends);
  });
};

// === Game Invites ===

// Send game invite to friend
export const sendGameInvite = async (
  fromUid: string,
  toUid: string,
  roomCode: string,
  fromName: string,
  fromAvatar: string
) => {
  const invitesRef = collection(db, 'gameInvites');
  
  // Check if invite already exists
  const existingQuery = query(
    invitesRef,
    where('from', '==', fromUid),
    where('to', '==', toUid),
    where('roomCode', '==', roomCode),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error('Invite already sent');
  }

  // Set expiration to 1 hour from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await addDoc(invitesRef, {
    from: fromUid,
    to: toUid,
    fromName,
    fromAvatar,
    roomCode,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
};

// Get incoming game invites
export const getIncomingGameInvites = async (toUid: string): Promise<GameInvite[]> => {
  const invitesRef = collection(db, 'gameInvites');
  const q = query(
    invitesRef,
    where('to', '==', toUid),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  const invites: GameInvite[] = [];
  snapshot.forEach((doc) => {
    invites.push({ id: doc.id, ...(doc.data() as Omit<GameInvite, 'id'>) });
  });
  return invites;
};

// Accept game invite
export const acceptGameInvite = async (inviteId: string) => {
  const inviteRef = doc(db, 'gameInvites', inviteId);
  await updateDoc(inviteRef, { status: 'accepted' });
};

// Decline game invite
export const declineGameInvite = async (inviteId: string) => {
  const inviteRef = doc(db, 'gameInvites', inviteId);
  await updateDoc(inviteRef, { status: 'declined' });
};

// Subscribe to game invites (real-time)
export const subscribeToGameInvites = (
  toUid: string,
  callback: (invites: GameInvite[]) => void
): Unsubscribe => {
  const invitesRef = collection(db, 'gameInvites');
  const q = query(
    invitesRef,
    where('to', '==', toUid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snapshot) => {
    const invites: GameInvite[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Omit<GameInvite, 'id'>;
      // Check if invite expired
      if (data.expiresAt) {
        const expiresAt = data.expiresAt as Timestamp;
        const expiresMillis = expiresAt.toMillis ? expiresAt.toMillis() : Date.now();
        if (Date.now() > expiresMillis) {
          // Mark as expired (async, don't block)
          updateDoc(doc.ref, { status: 'expired' }).catch(() => {});
          return;
        }
      }
      invites.push({ id: doc.id, ...data });
    });
    callback(invites);
  });
};

// === Game Statistics & Leaderboard ===

// Save game result
export const saveGameResult = async (
  playerId: string,
  playerName: string,
  playerAvatar: string,
  place: number,
  totalPlayers: number,
  finalScore: number,
  roomCode?: string
) => {
  const resultsRef = collection(db, 'gameResults');
  await addDoc(resultsRef, {
    playerId,
    playerName,
    playerAvatar,
    place,
    totalPlayers,
    finalScore,
    roomCode,
    gameDate: serverTimestamp(),
  });

  // Update user stats
  const userRef = doc(db, 'users', playerId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data() as UserProfile;
    const currentStats = userData.stats || { wins: 0, losses: 0, gamesPlayed: 0 };
    
    const newStats: UserStats = {
      ...currentStats,
      gamesPlayed: (currentStats.gamesPlayed || 0) + 1,
      wins: place === 1 ? (currentStats.wins || 0) + 1 : (currentStats.wins || 0),
      losses: place > 1 ? (currentStats.losses || 0) + 1 : (currentStats.losses || 0),
      totalPoints: (currentStats.totalPoints || 0) + finalScore,
    };
    
    // Calculate average score
    if (newStats.gamesPlayed > 0) {
      newStats.avgScore = Math.round((newStats.totalPoints || 0) / newStats.gamesPlayed);
    }
    
    await updateDoc(userRef, { stats: newStats });
  }
};

// Get user game history
export const getUserGameHistory = async (playerId: string, limit: number = 10): Promise<GameResult[]> => {
  const resultsRef = collection(db, 'gameResults');
  const q = query(
    resultsRef,
    where('playerId', '==', playerId)
  );
  const snapshot = await getDocs(q);
  const results: GameResult[] = [];
  snapshot.forEach((doc) => {
    results.push({ id: doc.id, ...(doc.data() as Omit<GameResult, 'id'>) });
  });
  
  // Sort by date (newest first) and limit
  results.sort((a, b) => {
    const aDate = a.gameDate as Timestamp;
    const bDate = b.gameDate as Timestamp;
    const aMillis = aDate?.toMillis ? aDate.toMillis() : 0;
    const bMillis = bDate?.toMillis ? bDate.toMillis() : 0;
    return bMillis - aMillis;
  });
  
  return results.slice(0, limit);
};

// Get leaderboard (top players by wins and total points)
export const getLeaderboard = async (limit: number = 50): Promise<Array<{
  uid: string;
  username: string;
  avatar: string;
  wins: number;
  totalPoints: number;
  gamesPlayed: number;
  rank: number;
}>> => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  const players: Array<{
    uid: string;
    username: string;
    avatar: string;
    wins: number;
    totalPoints: number;
    gamesPlayed: number;
  }> = [];
  
  snapshot.forEach((doc) => {
    const data = doc.data() as UserProfile;
    if (data.stats && data.stats.gamesPlayed > 0) {
      players.push({
        uid: doc.id,
        username: data.username,
        avatar: data.avatar,
        wins: data.stats.wins || 0,
        totalPoints: data.stats.totalPoints || 0,
        gamesPlayed: data.stats.gamesPlayed || 0,
      });
    }
  });
  
  // Sort by wins (primary) and totalPoints (secondary)
  players.sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return b.totalPoints - a.totalPoints;
  });
  
  // Add rank
  return players.slice(0, limit).map((player, index) => ({
    ...player,
    rank: index + 1,
  }));
};
