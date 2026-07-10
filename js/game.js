// Gameplay controller script using Web Audio API synthesis and 60fps moving targets
import { saveMatchResults, getCurrentUser } from "../firebase/db.js";
import { showToast } from "./main.js";

// Web Audio API Synthesizer Class
class SoundSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playHit() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playMiss() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playTick() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playEnd() {
    this.init();
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.4);
    osc2.stop(this.ctx.currentTime + 0.4);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Load configuration from setup page
  const configStr = sessionStorage.getItem("active_game_config");
  if (!configStr) {
    showToast("No active training configuration found. Redirecting to setup.", "warning");
    setTimeout(() => { window.location.href = "setup.html"; }, 1500);
    return;
  }
  const config = JSON.parse(configStr);

  // Apply visual theme to the gameboard container
  const board = document.getElementById("gameboard");
  board.classList.add(`theme-${config.theme}`);

  // Display active difficulty on navbar
  const diffBadge = document.getElementById("game-difficulty-badge");
  if (diffBadge) {
    diffBadge.innerText = `DIFFICULTY: ${config.difficulty.toUpperCase()}`;
  }

  // Audio Synth initializer
  const synth = new SoundSynth();
  const soundEnabled = config.sound;

  // State parameters
  let score = 0;
  let clicks = 0;
  let hits = 0;
  let misses = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let reactionTimes = [];
  let timeLeft = config.duration;
  let gameRunning = false;
  let animationId = null;

  // Active targets pool
  let targets = [];
  let nextTargetId = 0;

  // DOM elements update handles
  const hudScore = document.getElementById("hud-score");
  const hudAccuracy = document.getElementById("hud-accuracy");
  const hudCps = document.getElementById("hud-cps");
  const hudStreak = document.getElementById("hud-streak");
  const hudTime = document.getElementById("hud-time");
  const hudTimeBar = document.getElementById("hud-time-bar");

  // Pre-game overlay handles
  const overlay = document.getElementById("countdown-overlay");
  const numberText = document.getElementById("countdown-number");
  const countdownText = document.getElementById("countdown-text");

  // Run Countdown — display 3, 2, 1, GO! then start
  let countNum = 3;
  numberText.innerText = countNum;

  const countInterval = setInterval(() => {
    countNum--;
    if (countNum > 0) {
      numberText.innerText = countNum;
      // Only play tick if AudioContext is available (requires prior user gesture)
      try { if (soundEnabled) synth.playTick(); } catch (_) {}
    } else if (countNum === 0) {
      numberText.innerText = "GO!";
      countdownText.innerText = "TRAIN HARD";
      try { if (soundEnabled) synth.playTick(); } catch (_) {}
    } else {
      clearInterval(countInterval);
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s ease";
      setTimeout(() => {
        overlay.style.display = "none";
        startGame();
      }, 300);
    }
  }, 1000);


  // START GAME MAIN
  function startGame() {
    gameRunning = true;
    
    // Setup background clicking misses (misclicking)
    board.addEventListener("mousedown", handleBoardClick);

    // Initial spawn round
    for (let i = 0; i < config.count; i++) {
      spawnTarget();
    }

    // Secondary timers
    // Main Countdown Timer
    const timerInterval = setInterval(() => {
      if (!gameRunning) {
        clearInterval(timerInterval);
        return;
      }

      timeLeft = Math.max(0, timeLeft - 0.1);
      hudTime.innerText = `${timeLeft.toFixed(1)}s`;

      // Update timer width ratio
      const pct = (timeLeft / config.duration) * 100;
      hudTimeBar.style.width = `${pct}%`;

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        endGame();
      }
    }, 100);

    // Physics movement frame loops
    if (config.moving) {
      animationId = requestAnimationFrame(updatePhysics);
    }
  }

  // target spawning
  function spawnTarget() {
    if (!gameRunning) return;

    const boardWidth = board.clientWidth;
    const boardHeight = board.clientHeight;
    const size = config.size;

    // Keep spawn coordinates within boundary box
    const x = Math.random() * (boardWidth - size - 40) + 20;
    const y = Math.random() * (boardHeight - size - 40) + 20;

    // Movement vectors (if enabled)
    let dx = 0;
    let dy = 0;
    if (config.moving) {
      const speedFactor = getDifficultySpeedFactor();
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle) * speedFactor;
      dy = Math.sin(angle) * speedFactor;
    }

    // Build DOM Target
    const targetEl = document.createElement("div");
    targetEl.className = "game-target";
    targetEl.style.width = `${size}px`;
    targetEl.style.height = `${size}px`;
    targetEl.style.left = `${x}px`;
    targetEl.style.top = `${y}px`;

    const innerDot = document.createElement("div");
    innerDot.className = "game-target-dot";
    targetEl.appendChild(innerDot);

    // Add lifetime animation rings
    if (config.animations) {
      const ring = document.createElement("div");
      ring.className = "lifetime-ring";
      ring.style.animationDuration = `${config.lifetime}s`;
      targetEl.appendChild(ring);
    }

    board.appendChild(targetEl);

    // Force reflow for transform entrance scale animations
    setTimeout(() => targetEl.classList.add("active"), 10);

    const targetId = nextTargetId++;
    const spawnTimestamp = Date.now();

    const targetObj = {
      id: targetId,
      element: targetEl,
      x: x,
      y: y,
      dx: dx,
      dy: dy,
      spawnTime: spawnTimestamp,
      timer: setTimeout(() => {
        // Expire target (Count as miss)
        handleTargetExpire(targetId);
      }, config.lifetime * 1000)
    };

    targetEl.addEventListener("mousedown", (e) => {
      e.stopPropagation(); // Avoid triggering background board click miss
      handleTargetHit(targetId);
    });

    targets.push(targetObj);
  }

  function getDifficultySpeedFactor() {
    switch (config.difficulty) {
      case "easy": return 1.5;
      case "medium": return 2.5;
      case "hard": return 4.0;
      case "expert": return 5.5;
      case "insane": return 7.5;
      default: return 2.5;
    }
  }

  // physics loop for moving target vectors
  function updatePhysics() {
    if (!gameRunning) return;

    const boardWidth = board.clientWidth;
    const boardHeight = board.clientHeight;
    const size = config.size;

    targets.forEach(t => {
      t.x += t.dx;
      t.y += t.dy;

      // Bounce off horizontal walls
      if (t.x <= 5 || t.x >= boardWidth - size - 5) {
        t.dx = -t.dx;
        t.x = Math.max(5, Math.min(t.x, boardWidth - size - 5));
      }

      // Bounce off vertical walls
      if (t.y <= 5 || t.y >= boardHeight - size - 5) {
        t.dy = -t.dy;
        t.y = Math.max(5, Math.min(t.y, boardHeight - size - 5));
      }

      // Update positions style
      t.element.style.left = `${t.x}px`;
      t.element.style.top = `${t.y}px`;
    });

    animationId = requestAnimationFrame(updatePhysics);
  }

  // TARGET CLICKS HANDLERS
  function handleTargetHit(id) {
    if (!gameRunning) return;

    const idx = targets.findIndex(t => t.id === id);
    if (idx === -1) return;

    const target = targets[idx];
    const clickTime = Date.now();
    const reaction = clickTime - target.spawnTime;
    reactionTimes.push(reaction);

    // Sound FX
    if (soundEnabled) synth.playHit();

    // Increment values
    score += getDifficultyScoreWeight();
    clicks++;
    hits++;
    currentStreak++;
    bestStreak = Math.max(bestStreak, currentStreak);

    // Spawns float text (+1)
    spawnFloatIndicator(target.x + config.size/2, target.y, `+${getDifficultyScoreWeight()}`, "hit");

    // Clean timer and remove elements
    clearTimeout(target.timer);
    removeTargetDOM(target.element);
    targets.splice(idx, 1);

    // Update HUD display
    updateHudStats();

    // Spawn new target replacement
    spawnTarget();
  }

  function handleTargetExpire(id) {
    if (!gameRunning) return;

    const idx = targets.findIndex(t => t.id === id);
    if (idx === -1) return;

    const target = targets[idx];

    // Sound FX for miss
    if (soundEnabled) synth.playMiss();

    // Stats updates
    misses++;
    currentStreak = 0; // Break streak

    // Spawns MISS float indicator
    spawnFloatIndicator(target.x + config.size/2, target.y, "MISS", "miss");

    removeTargetDOM(target.element);
    targets.splice(idx, 1);

    updateHudStats();

    // Spawn new target replacement
    spawnTarget();
  }

  function handleBoardClick(e) {
    if (!gameRunning) return;

    // Check if clicked the canvas board background (not target)
    if (e.target === board) {
      if (soundEnabled) synth.playMiss();
      
      clicks++;
      misses++;
      currentStreak = 0; // break streak

      // Spawn MISS indicator at cursor click coordinate
      const rect = board.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      spawnFloatIndicator(clickX, clickY, "MISCLICK", "miss");

      updateHudStats();
    }
  }

  function getDifficultyScoreWeight() {
    switch (config.difficulty) {
      case "easy": return 1;
      case "medium": return 2;
      case "hard": return 3;
      case "expert": return 4;
      case "insane": return 5;
      default: return 2;
    }
  }

  function removeTargetDOM(element) {
    element.classList.remove("active");
    element.style.transform = "scale(0)";
    setTimeout(() => {
      element.remove();
    }, 150);
  }

  // Floating text popups
  function spawnFloatIndicator(x, y, text, type) {
    const floatEl = document.createElement("div");
    floatEl.className = `float-indicator ${type}`;
    floatEl.innerText = text;
    floatEl.style.left = `${x - 20}px`;
    floatEl.style.top = `${y - 15}px`;

    board.appendChild(floatEl);

    setTimeout(() => {
      floatEl.remove();
    }, 600);
  }

  // HUD updates
  function updateHudStats() {
    hudScore.innerText = score;
    hudStreak.innerText = currentStreak;

    // Calculate accuracy percentage
    const accuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 100;
    hudAccuracy.innerText = `${accuracy}%`;

    // Calculate clicks per second (CPS)
    const elapsedSeconds = config.duration - timeLeft;
    const cps = elapsedSeconds > 0 ? (clicks / elapsedSeconds) : 0;
    hudCps.innerText = cps.toFixed(1);
  }

  // END GAME AND FINALIZE
  async function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);

    if (soundEnabled) synth.playEnd();

    // Clean any remaining active targets
    targets.forEach(t => {
      clearTimeout(t.timer);
      t.element.remove();
    });
    targets = [];

    board.removeEventListener("mousedown", handleBoardClick);

    // Calculate Final Performance metrics
    const finalAccuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 0;
    // CPS = total clicks divided by full session duration
    const finalCPS = config.duration > 0
      ? parseFloat((clicks / config.duration).toFixed(2))
      : 0;
    
    // Average Reaction Time
    const sumReact = reactionTimes.reduce((a, b) => a + b, 0);
    const avgReact = reactionTimes.length > 0 ? Math.round(sumReact / reactionTimes.length) : 0;

    const gameResults = {
      score: score,
      accuracy: finalAccuracy,
      cps: finalCPS,
      avgReactionTime: avgReact,
      clicks: clicks,
      hits: hits,
      misses: misses,
      difficulty: config.difficulty,
      bestStreak: bestStreak,
      duration: config.duration   // Required for totalPlayTime tracking
    };

    sessionStorage.setItem("last_game_results", JSON.stringify(gameResults));
    showToast("Session complete! Saving stats...", "success");

    try {
      // Save stats to Firebase database or mock localStorage
      await saveMatchResults(gameResults);
    } catch (err) {
      console.warn("Failed to cloud save match results:", err.message);
    }

    // Redirect to result screen
    setTimeout(() => {
      window.location.href = "results.html";
    }, 1200);
  }
});
