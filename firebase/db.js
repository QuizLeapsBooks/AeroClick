// ============================================================
// Firebase Auth and Firestore Database Abstraction Layer
// Supports both Cloud (Firebase) and Mock (localStorage) modes
// ============================================================
import { firebaseReady } from "./config.js";

// Lazy getters so we always read the CURRENT (post-init) values
function getAuth() {
  const m = import.meta;
  // We import from config at runtime after firebaseReady has settled
  return import("./config.js").then((c) => c.auth);
}
function getDb() {
  return import("./config.js").then((c) => c.db);
}
function getIsMock() {
  return import("./config.js").then((c) => c.isMock);
}

// In-memory reference to the current user session
let mockCurrentUser = null;

// -------------------------------------------------------
// Default achievements issued to all new accounts
// -------------------------------------------------------
const DEFAULT_ACHIEVEMENTS = [
  {
    id: "first_game",
    title: "First Click",
    description: "Complete your first game",
    unlocked: false,
    icon: "🎯"
  },
  {
    id: "accuracy_90",
    title: "Sharp Shooter",
    description: "Achieve over 90% accuracy in a game",
    unlocked: false,
    icon: "👁️"
  },
  {
    id: "perfect_100",
    title: "Deadeye",
    description: "Achieve 100% accuracy (min 10 hits) in a game",
    unlocked: false,
    icon: "💎"
  },
  {
    id: "cps_10",
    title: "Speed Demon",
    description: "Reach a CPS of 10 or higher",
    unlocked: false,
    icon: "⚡"
  },
  {
    id: "games_50",
    title: "Click Fanatic",
    description: "Play 50 total games",
    unlocked: false,
    icon: "🏆"
  },
  {
    id: "streak_25",
    title: "On Fire",
    description: "Get a hit streak of 25 targets in one game",
    unlocked: false,
    icon: "🔥"
  }
];

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const getFormattedDate = () =>
  new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

function calculateRank(bestScore) {
  if (bestScore >= 150) return "Grandmaster";
  if (bestScore >= 100) return "Master";
  if (bestScore >= 70) return "Diamond";
  if (bestScore >= 45) return "Platinum";
  if (bestScore >= 25) return "Gold";
  if (bestScore >= 10) return "Silver";
  return "Bronze";
}

/* ==========================================================
   AUTHENTICATION FUNCTIONS
   ========================================================== */

export async function signUpUser(username, password) {
  // Wait for Firebase to finish initialising before doing anything
  await firebaseReady;
  const { auth, db, isMock } = await import("./config.js");

  const cleanUsername = username.trim().toLowerCase();

  if (cleanUsername.length < 3) {
    throw new Error("Username must be at least 3 characters long.");
  }
  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    throw new Error("Username can only contain letters, numbers, and underscores.");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  if (isMock) {
    /* ----- MOCK MODE ----- */
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    if (users[cleanUsername]) {
      throw new Error("That username is already taken. Please choose another.");
    }
    const countryInfo = await detectCountry();
    const newProfile = buildDefaultProfile(username.trim(), null, countryInfo.country, countryInfo.countryCode);
    users[cleanUsername] = { password, profile: newProfile };
    localStorage.setItem("mock_users", JSON.stringify(users));
    mockCurrentUser = newProfile;
    localStorage.setItem("mock_current_user", JSON.stringify(newProfile));
    return newProfile;
  } else {
    /* ----- CLOUD MODE ----- */
    const { doc, getDoc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );
    const { setPersistence, browserLocalPersistence, createUserWithEmailAndPassword } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
    );

    await setPersistence(auth, browserLocalPersistence);

    const usernameDocRef = doc(db, "usernames", cleanUsername);
    const usernameSnap = await getDoc(usernameDocRef);
    if (usernameSnap.exists()) {
      throw new Error("That username is already taken. Please choose another.");
    }

    try {
      const dummyEmail = `${cleanUsername}@aeroclick.app`;
      const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
      const uid = userCredential.user.uid;

      const countryInfo = await detectCountry();
      const newProfile = buildDefaultProfile(username.trim(), uid, countryInfo.country, countryInfo.countryCode);

      await setDoc(doc(db, "users", uid), {
        ...newProfile,
        createdAt: serverTimestamp()
      });

      await setDoc(usernameDocRef, { uid });

      return newProfile;
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        throw new Error("That username is already taken. Please choose another.");
      }
      if (error.code === "auth/weak-password") {
        throw new Error("Password must be at least 6 characters long.");
      }
      throw error;
    }
  }
}

export async function loginUser(username, password) {
  await firebaseReady;
  const { auth, db, isMock } = await import("./config.js");

  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  if (isMock) {
    /* ----- MOCK MODE ----- */
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    const entry = users[cleanUsername];
    if (!entry || entry.password !== password) {
      throw new Error("Invalid username or password.");
    }
    mockCurrentUser = entry.profile;
    localStorage.setItem("mock_current_user", JSON.stringify(mockCurrentUser));
    return mockCurrentUser;
  } else {
    /* ----- CLOUD MODE ----- */
    const { setPersistence, browserLocalPersistence, signInWithEmailAndPassword } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
    );
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    try {
      await setPersistence(auth, browserLocalPersistence);
      const dummyEmail = `${cleanUsername}@aeroclick.app`;
      const userCredential = await signInWithEmailAndPassword(auth, dummyEmail, password);
      const uid = userCredential.user.uid;

      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) {
        throw new Error("User profile not found. Please contact support.");
      }

      return userSnap.data();
    } catch (error) {
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        throw new Error("Invalid username or password.");
      }
      throw error;
    }
  }
}

export async function logoutUser() {
  await firebaseReady;
  const { auth, isMock } = await import("./config.js");

  if (isMock) {
    mockCurrentUser = null;
    localStorage.removeItem("mock_current_user");
    return true;
  } else {
    const { signOut } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
    );
    await signOut(auth);
    return true;
  }
}

export async function updateUserSettings(settings) {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to update settings.");
  }

  const nextSettings = {
    ...(currentUser.settings || {}),
    ...settings
  };

  const updatedProfile = {
    ...currentUser,
    settings: nextSettings
  };

  if (isMock) {
    const cleanUsername = currentUser.username.toLowerCase();
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    if (users[cleanUsername]) {
      users[cleanUsername].profile = updatedProfile;
      localStorage.setItem("mock_users", JSON.stringify(users));
    }
    mockCurrentUser = updatedProfile;
    localStorage.setItem("mock_current_user", JSON.stringify(updatedProfile));
    return updatedProfile;
  }

  const { doc, updateDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
  );

  await updateDoc(doc(db, "users", currentUser.uid), {
    settings: nextSettings
  });

  return updatedProfile;
}

export async function getCurrentUser() {
  await firebaseReady;
  const { auth, db, isMock } = await import("./config.js");

  if (isMock) {
    if (!mockCurrentUser) {
      const stored = localStorage.getItem("mock_current_user");
      if (stored) {
        try {
          mockCurrentUser = JSON.parse(stored);
        } catch {
          mockCurrentUser = null;
        }
      }
    }
    return mockCurrentUser;
  } else {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        unsubscribe();
        if (!firebaseUser) {
          resolve(null);
          return;
        }
        try {
          const { doc, getDoc } = await import(
            "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
          );
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          resolve(snap.exists() ? snap.data() : null);
        } catch (err) {
          console.error("[AeroClick] Error fetching current user profile:", err);
          resolve(null);
        }
      });
    });
  }
}

/* ==========================================================
   GAMEPLAY & PROGRESSION FUNCTIONS
   ========================================================== */

export async function saveMatchResults(matchData) {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to save scores.");
  }

  const dateStr = getFormattedDate();
  const timestamp = Date.now();

  const safeMatch = {
    score: Number(matchData.score) || 0,
    accuracy: Number(matchData.accuracy) || 0,
    cps: parseFloat(Number(matchData.cps).toFixed(2)),
    avgReactionTime: Number(matchData.avgReactionTime) || 0,
    clicks: Number(matchData.clicks) || 0,
    hits: Number(matchData.hits) || 0,
    misses: Number(matchData.misses) || 0,
    difficulty: matchData.difficulty || "medium",
    bestStreak: Number(matchData.bestStreak) || 0,
    duration: Number(matchData.duration) || 30
  };

  const gameRecord = {
    date: dateStr,
    timestamp,
    ...safeMatch
  };

  const newTotalGames = (currentUser.totalGamesPlayed || 0) + 1;
  const newTotalClicks = (currentUser.totalClicks || 0) + safeMatch.clicks;
  const newTotalHits = (currentUser.totalHits || 0) + safeMatch.hits;
  const newTotalMisses = (currentUser.totalMisses || 0) + safeMatch.misses;
  const newTotalPlayTime = (currentUser.totalPlayTime || 0) + safeMatch.duration;

  const newBestScore = Math.max(currentUser.bestScore || 0, safeMatch.score);
  const newBestAccuracy = Math.max(currentUser.bestAccuracy || 0, safeMatch.accuracy);

  let newBestReactionTime = currentUser.bestReactionTime || 9999;
  if (safeMatch.avgReactionTime > 0) {
    newBestReactionTime = Math.min(newBestReactionTime, safeMatch.avgReactionTime);
  }

  const newRank = calculateRank(newBestScore);

  const existingAchievements = currentUser.achievements || DEFAULT_ACHIEVEMENTS;
  const updatedAchievements = existingAchievements.map((ach) => {
    if (ach.unlocked) return ach;

    let shouldUnlock = false;
    if (ach.id === "first_game") shouldUnlock = true;
    if (ach.id === "accuracy_90" && safeMatch.accuracy >= 90) shouldUnlock = true;
    if (ach.id === "perfect_100" && safeMatch.accuracy === 100 && safeMatch.hits >= 10)
      shouldUnlock = true;
    if (ach.id === "cps_10" && safeMatch.cps >= 10) shouldUnlock = true;
    if (ach.id === "games_50" && newTotalGames >= 50) shouldUnlock = true;
    if (ach.id === "streak_25" && safeMatch.bestStreak >= 25) shouldUnlock = true;

    return shouldUnlock ? { ...ach, unlocked: true, date: dateStr } : ach;
  });

  const matchHistory = [gameRecord, ...(currentUser.matchHistory || [])].slice(0, 50);

  const updatedProfile = {
    ...currentUser,
    totalGamesPlayed: newTotalGames,
    totalClicks: newTotalClicks,
    totalHits: newTotalHits,
    totalMisses: newTotalMisses,
    totalPlayTime: newTotalPlayTime,
    bestScore: newBestScore,
    bestAccuracy: newBestAccuracy,
    bestReactionTime: newBestReactionTime,
    rank: newRank,
    achievements: updatedAchievements,
    matchHistory
  };

  if (isMock) {
    /* ----- MOCK MODE ----- */
    const cleanUsername = currentUser.username.toLowerCase();
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    if (users[cleanUsername]) {
      users[cleanUsername].profile = updatedProfile;
      localStorage.setItem("mock_users", JSON.stringify(users));
    }
    mockCurrentUser = updatedProfile;
    localStorage.setItem("mock_current_user", JSON.stringify(updatedProfile));
    return updatedProfile;
  } else {
    /* ----- CLOUD MODE ----- */
    const { doc, updateDoc, addDoc, setDoc, collection, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    const uid = currentUser.uid;

    await updateDoc(doc(db, "users", uid), updatedProfile);

    await addDoc(collection(db, "gameHistory"), {
      uid,
      username: currentUser.username,
      ...gameRecord,
      savedAt: serverTimestamp()
    });

    if (newBestScore > 0) {
      await setDoc(doc(db, "leaderboard", uid), {
        uid,
        username: currentUser.username,
        bestScore: newBestScore,
        bestAccuracy: newBestAccuracy,
        bestReactionTime: newBestReactionTime,
        totalGamesPlayed: newTotalGames,
        country: updatedProfile.country || "United States",
        countryCode: updatedProfile.countryCode || "US"
      });
    }

    return updatedProfile;
  }
}

/* ==========================================================
   LEADERBOARD FUNCTIONS
   ========================================================== */

export async function getLeaderboard(limitCount = 100) {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  if (isMock) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    return Object.values(users)
      .map((u) => u.profile)
      .filter((p) => p && p.bestScore > 0)
      .sort((a, b) => {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (b.bestAccuracy !== a.bestAccuracy) return b.bestAccuracy - a.bestAccuracy;
        return (a.bestReactionTime || 9999) - (b.bestReactionTime || 9999);
      })
      .slice(0, limitCount);
  } else {
    const { collection, query, orderBy, limit, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    const q = query(
      collection(db, "leaderboard"),
      orderBy("bestScore", "desc"),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const leaders = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.bestScore > 0) {
        leaders.push(data);
      }
    });

    return leaders.sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      if (b.bestAccuracy !== a.bestAccuracy) return b.bestAccuracy - a.bestAccuracy;
      return (a.bestReactionTime || 9999) - (b.bestReactionTime || 9999);
    });
  }
}

export async function getUserGlobalRank(username) {
  const leaderboard = await getLeaderboard();
  const cleanUsername = username.toLowerCase();
  const index = leaderboard.findIndex(
    (p) => p.username && p.username.toLowerCase() === cleanUsername
  );
  return index !== -1 ? index + 1 : null;
}

/* ==========================================================
   PRIVATE HELPERS
   ========================================================== */

function buildDefaultProfile(displayUsername, uid = null, country = "United States", countryCode = "US") {
  const profile = {
    username: displayUsername,
    joinDate: getFormattedDate(),
    bestScore: 0,
    bestAccuracy: 0,
    bestReactionTime: 9999,
    totalGamesPlayed: 0,
    totalClicks: 0,
    totalHits: 0,
    totalMisses: 0,
    totalPlayTime: 0,
    rank: "Bronze",
    country: country,
    countryCode: countryCode,
    achievements: DEFAULT_ACHIEVEMENTS,
    matchHistory: [],
    friends: [],
    settings: {
      theme: "dark"
    }
  };

  if (uid) {
    profile.uid = uid;
  }

  return profile;
}

export async function detectCountry() {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (response.ok) {
      const data = await response.json();
      return {
        country: data.country_name || "United States",
        countryCode: data.country_code || "US"
      };
    }
  } catch (e) {
    console.warn("Could not geolocate country via API, falling back to timezone/locale:", e);
  }
  
  // Fallback using timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const lowerTz = tz.toLowerCase();
      if (lowerTz.includes("calcutta") || lowerTz.includes("kolkata") || lowerTz.includes("india")) return { country: "India", countryCode: "IN" };
      if (lowerTz.includes("london")) return { country: "United Kingdom", countryCode: "GB" };
      if (lowerTz.includes("berlin")) return { country: "Germany", countryCode: "DE" };
      if (lowerTz.includes("paris")) return { country: "France", countryCode: "FR" };
      if (lowerTz.includes("tokyo")) return { country: "Japan", countryCode: "JP" };
      if (lowerTz.includes("sydney")) return { country: "Australia", countryCode: "AU" };
      if (lowerTz.includes("toronto") || lowerTz.includes("vancouver") || lowerTz.includes("canada")) return { country: "Canada", countryCode: "CA" };
    }
  } catch (e) {}

  return { country: "United States", countryCode: "US" };
}

export async function addFriend(friendUsername) {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to add friends.");
  }

  const cleanFriendName = friendUsername.trim().toLowerCase();
  if (!cleanFriendName) {
    throw new Error("Friend username cannot be empty.");
  }

  if (cleanFriendName === currentUser.username.toLowerCase()) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const friendsList = currentUser.friends || [];
  if (friendsList.some(name => name.toLowerCase() === cleanFriendName)) {
    throw new Error(`${friendUsername} is already in your friends list.`);
  }

  let friendProfile = null;

  if (isMock) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    const entry = users[cleanFriendName];
    if (!entry) {
      throw new Error(`User "${friendUsername}" does not exist.`);
    }
    friendProfile = entry.profile;

    const updatedFriends = [...friendsList, friendProfile.username];
    currentUser.friends = updatedFriends;

    const cleanSelf = currentUser.username.toLowerCase();
    users[cleanSelf].profile = currentUser;
    localStorage.setItem("mock_users", JSON.stringify(users));
    localStorage.setItem("mock_current_user", JSON.stringify(currentUser));
  } else {
    const { doc, getDoc, updateDoc, arrayUnion } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    const usernameDoc = await getDoc(doc(db, "usernames", cleanFriendName));
    if (!usernameDoc.exists()) {
      throw new Error(`User "${friendUsername}" does not exist.`);
    }
    const friendUid = usernameDoc.data().uid;

    const friendSnap = await getDoc(doc(db, "users", friendUid));
    if (!friendSnap.exists()) {
      throw new Error(`Profile for "${friendUsername}" not found.`);
    }
    friendProfile = friendSnap.data();

    const selfRef = doc(db, "users", currentUser.uid);
    await updateDoc(selfRef, {
      friends: arrayUnion(friendProfile.username)
    });
  }

  return friendProfile;
}

export async function getFriendsData() {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const friendsList = currentUser.friends || [];
  if (friendsList.length === 0) return [];

  const list = [];

  if (isMock) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    friendsList.forEach(name => {
      const cleanName = name.toLowerCase();
      if (users[cleanName]) {
        list.push(users[cleanName].profile);
      }
    });
  } else {
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    for (const name of friendsList) {
      const cleanName = name.toLowerCase();
      try {
        const usernameDoc = await getDoc(doc(db, "usernames", cleanName));
        if (usernameDoc.exists()) {
          const uid = usernameDoc.data().uid;
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            list.push(userSnap.data());
          }
        }
      } catch (err) {
        console.error(`Error loading friend ${name}:`, err);
      }
    }
  }

  return list.sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0));
}

export async function sendChallenge(friendUsername, targetScore, difficulty) {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to send challenges.");
  }

  const cleanFriend = friendUsername.trim();
  const chalData = {
    sender: currentUser.username,
    receiver: cleanFriend,
    targetScore: Number(targetScore) || 0,
    difficulty: difficulty || "medium",
    status: "pending",
    date: getFormattedDate(),
    timestamp: Date.now()
  };

  if (isMock) {
    const challenges = JSON.parse(localStorage.getItem("mock_challenges") || "[]");
    chalData.id = "chal_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    challenges.push(chalData);
    localStorage.setItem("mock_challenges", JSON.stringify(challenges));
  } else {
    const { collection, addDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );
    await addDoc(collection(db, "challenges"), chalData);
  }

  return chalData;
}

export async function getChallenges() {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const username = currentUser.username;

  if (isMock) {
    const challenges = JSON.parse(localStorage.getItem("mock_challenges") || "[]");
    return challenges
      .filter(c => c.sender === username || c.receiver === username)
      .sort((a, b) => b.timestamp - a.timestamp);
  } else {
    const { collection, query, where, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    const q1 = query(collection(db, "challenges"), where("sender", "==", username));
    const snap1 = await getDocs(q1);
    
    const q2 = query(collection(db, "challenges"), where("receiver", "==", username));
    const snap2 = await getDocs(q2);

    const list = [];
    snap1.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    snap2.forEach(docSnap => {
      if (!list.some(item => item.id === docSnap.id)) {
        list.push({ id: docSnap.id, ...docSnap.data() });
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export async function completeChallenge(challengeId, achievedScore) {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to complete a challenge.");
  }

  if (isMock) {
    const challenges = JSON.parse(localStorage.getItem("mock_challenges") || "[]");
    const chal = challenges.find(c => c.id === challengeId);
    if (!chal) throw new Error("Challenge not found.");

    chal.status = achievedScore >= chal.targetScore ? "completed" : "failed";
    chal.achievedScore = achievedScore;
    chal.completedDate = getFormattedDate();

    localStorage.setItem("mock_challenges", JSON.stringify(challenges));
    return chal;
  } else {
    const { doc, getDoc, updateDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    const docRef = doc(db, "challenges", challengeId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Challenge not found.");

    const chal = snap.data();
    const status = achievedScore >= chal.targetScore ? "completed" : "failed";

    const updateData = {
      status,
      achievedScore,
      completedDate: getFormattedDate()
    };

    await updateDoc(docRef, updateData);
    return { id: challengeId, ...chal, ...updateData };
  }
}

export async function updateUserCountry(countryName, countryCode) {
  await firebaseReady;
  const { db, isMock } = await import("./config.js");

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to update country.");
  }

  const updatedProfile = {
    ...currentUser,
    country: countryName,
    countryCode: countryCode
  };

  if (isMock) {
    const cleanUsername = currentUser.username.toLowerCase();
    const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
    if (users[cleanUsername]) {
      users[cleanUsername].profile = updatedProfile;
      localStorage.setItem("mock_users", JSON.stringify(users));
    }
    mockCurrentUser = updatedProfile;
    localStorage.setItem("mock_current_user", JSON.stringify(updatedProfile));
  } else {
    const { doc, updateDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    const uid = currentUser.uid;
    await updateDoc(doc(db, "users", uid), {
      country: countryName,
      countryCode: countryCode
    });

    const lbRef = doc(db, "leaderboard", uid);
    try {
      await updateDoc(lbRef, {
        country: countryName,
        countryCode: countryCode
      });
    } catch (e) {
      // Doc might not exist yet if score = 0
    }
  }

  return updatedProfile;
}
