// Setup Page Controller
import { getCurrentUser, logoutUser } from "../firebase/db.js";
import { showToast } from "./main.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth Guard Check
  const user = await getCurrentUser();
  if (!user) {
    showToast("You must be logged in to access the Training Room.", "warning");
    setTimeout(() => {
      window.location.href = "auth.html";
    }, 1000);
    return;
  }

  // 2. Elements Selectors
  const diffButtons = document.querySelectorAll(".difficulty-btn");
  const lifetimeInput = document.getElementById("circle-lifetime");
  const sizeInput = document.getElementById("circle-size");
  const countInput = document.getElementById("circle-count");
  const durationInput = document.getElementById("session-duration");
  const movingInput = document.getElementById("moving-targets");
  const soundInput = document.getElementById("sound-effects");
  const animInput = document.getElementById("animations-enabled");
  
  const lifetimeVal = document.getElementById("lifetime-val");
  const sizeVal = document.getElementById("size-val");
  const countVal = document.getElementById("count-val");
  const durationVal = document.getElementById("duration-val");

  const previewTarget = document.getElementById("preview-target");
  const previewDot = document.getElementById("preview-dot");
  const themeSwatches = document.querySelectorAll(".theme-swatch");
  const startBtn = document.getElementById("start-training-btn");
  const logoutBtn = document.getElementById("logout-btn");

  // State configurations
  let activeDifficulty = "medium";
  let activeTheme = "neon";

  // Difficulty Preset Maps
  const presets = {
    easy: { size: 70, lifetime: 2.0, count: 2, moving: false },
    medium: { size: 50, lifetime: 1.5, count: 3, moving: false },
    hard: { size: 35, lifetime: 1.1, count: 4, moving: true },
    expert: { size: 25, lifetime: 0.8, count: 5, moving: true },
    insane: { size: 20, lifetime: 0.6, count: 6, moving: true }
  };

  // Theme Palette Maps
  const themeColors = {
    neon: { border: "#6366f1", bg: "rgba(99, 102, 241, 0.15)" },
    cyber: { border: "#eab308", bg: "rgba(234, 179, 8, 0.15)" },
    matrix: { border: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
    sunset: { border: "#f43f5e", bg: "rgba(244, 63, 94, 0.15)" }
  };

  // 3. Handlers & Updaters
  function updatePreview() {
    const size = sizeInput.value;
    previewTarget.style.width = `${size}px`;
    previewTarget.style.height = `${size}px`;

    // Apply color palette
    const colors = themeColors[activeTheme];
    previewTarget.style.borderColor = colors.border;
    previewTarget.style.background = colors.bg;
    previewTarget.style.boxShadow = `0 0 15px ${colors.border}`;
    previewDot.style.backgroundColor = colors.border;

    // Handle animations preview toggles
    if (animInput.checked) {
      previewTarget.classList.add("animate");
    } else {
      previewTarget.classList.remove("animate");
    }
  }

  function applyPreset(diff) {
    const config = presets[diff];
    if (!config) return;

    sizeInput.value = config.size;
    sizeVal.innerText = `${config.size}px`;

    lifetimeInput.value = config.lifetime;
    lifetimeVal.innerText = `${config.lifetime}s`;

    countInput.value = config.count;
    countVal.innerText = config.count;

    movingInput.checked = config.moving;

    updatePreview();
  }

  // 4. Listeners Initialization
  diffButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      diffButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeDifficulty = btn.dataset.diff;
      applyPreset(activeDifficulty);
    });
  });

  // Slider change triggers
  lifetimeInput.addEventListener("input", () => {
    lifetimeVal.innerText = `${lifetimeInput.value}s`;
    // If customized, unhighlight default presets to signify custom run
  });

  sizeInput.addEventListener("input", () => {
    sizeVal.innerText = `${sizeInput.value}px`;
    updatePreview();
  });

  countInput.addEventListener("input", () => {
    countVal.innerText = countInput.value;
  });

  durationInput.addEventListener("input", () => {
    durationVal.innerText = `${durationInput.value}s`;
  });

  animInput.addEventListener("change", updatePreview);

  // Theme Selection
  themeSwatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      themeSwatches.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      activeTheme = swatch.dataset.themeId;
      updatePreview();
    });
  });

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to sign out?")) {
        await logoutUser();
        showToast("Logged out successfully.", "success");
        setTimeout(() => {
          window.location.href = "../index.html";
        }, 1000);
      }
    });
  }

  // 5. Start Training Submit
  startBtn.addEventListener("click", () => {
    const gameConfig = {
      difficulty: activeDifficulty,
      lifetime: parseFloat(lifetimeInput.value),
      size: parseInt(sizeInput.value),
      count: parseInt(countInput.value),
      duration: parseInt(durationInput.value),
      moving: movingInput.checked,
      sound: soundInput.checked,
      animations: animInput.checked,
      theme: activeTheme
    };

    sessionStorage.setItem("active_game_config", JSON.stringify(gameConfig));
    showToast("Initializing targets... Good luck!", "success");

    setTimeout(() => {
      window.location.href = "game.html";
    }, 1000);
  });

  // Initialize preview on load
  updatePreview();
});
