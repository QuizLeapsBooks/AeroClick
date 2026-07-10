// ============================================================
// AeroClick — Firebase Configuration and Initialization
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyB0Vaq_9NnHQsHL_ACo_N8pJjRaxt5Wi3Y",
  authDomain: "time-table-maker-b2065.firebaseapp.com",
  projectId: "time-table-maker-b2065",
  storageBucket: "time-table-maker-b2065.firebasestorage.app",
  messagingSenderId: "1056332331740",
  appId: "1:1056332331740:web:42b8df87aa00d8f58f1219"
};

// -------------------------------------------------------
// Internal: Detects if the config still has placeholder values.
// -------------------------------------------------------
const isPlaceholder = (cfg) => {
  if (!cfg.apiKey || !cfg.projectId) return true;
  const placeholderPatterns = ["YOUR_", "PLACEHOLDER", "xxxxxxxx", "your-project"];
  const valuesStr = Object.values(cfg).join(" ").toUpperCase();
  return placeholderPatterns.some((p) => valuesStr.includes(p.toUpperCase()));
};

// Exported mutable state — set during async init below
export let app = null;
export let auth = null;
export let db = null;
export let isMock = true;

// -------------------------------------------------------
// A Promise that resolves when Firebase is fully ready.
// All consumers should await this before using auth / db.
// -------------------------------------------------------
export const firebaseReady = (async () => {
  if (isPlaceholder(firebaseConfig)) {
    console.log(
      "%c[AeroClick] Running in Local Mock Mode.",
      "color: #f59e0b; font-weight: bold;",
      "Fill in firebase/config.js with real credentials to enable cloud sync."
    );
    isMock = true;
    return;
  }

  try {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
    );
    const { getAuth } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
    );
    const { getFirestore } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isMock = false;

    console.log(
      "%c[AeroClick] Firebase initialized in Cloud Mode ✓",
      "color: #10b981; font-weight: bold;"
    );
  } catch (error) {
    console.warn(
      "[AeroClick] Firebase initialization failed — falling back to Mock Mode.",
      error
    );
    isMock = true;
  }
})();

export { firebaseConfig };
