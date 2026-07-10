// Guest Practice Mode — No Auth, No Firebase, No Leaderboard
// Data lives only in sessionStorage for this tab and is cleared after results are shown.

import { showToast } from "./main.js";

// ── Audio Synth (same as game.js) ────────────────────────────────────────────
class SoundSynth {
  constructor() { this.ctx = null; }

  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  _play(type, freqStart, freqEnd, gainStart, duration, ramp = "exp") {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      if (ramp === "exp") osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
      else osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
      gain.gain.setValueAtTime(gainStart, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (_) {}
  }

  playHit()  { this._play("sine",     600, 1200, 0.15, 0.10); }
  playMiss() { this._play("triangle", 180,   70, 0.12, 0.15, "lin"); }
  playTick() { this._play("sine",     880,  880, 0.05, 0.05); }
  playEnd()  {
    try {
      this.init();
      if (!this.ctx) return;
      const gain = this.ctx.createGain();
      gain.connect(this.ctx.destination);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      [523.25, 659.25].forEach(freq => {
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.connect(gain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
      });
    } catch (_) {}
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const configStr = sessionStorage.getItem("guest_game_config");
  if (!configStr) {
    showToast("No practice configuration found. Redirecting home.", "warning");
    setTimeout(() => { window.location.href = "../index.html#instant-practice"; }, 1500);
    return;
  }

  const config = JSON.parse(configStr);

  // Apply theme to board
  const board = document.getElementById("gameboard");
  board.classList.add(`theme-${config.theme}`);

  // Difficulty badge
  const diffBadge = document.getElementById("game-difficulty-badge");
  if (diffBadge) diffBadge.innerText = `DIFFICULTY: ${config.difficulty.toUpperCase()}`;

  const synth   = new SoundSynth();
  const sound   = config.sound;

  // State
  let score = 0, clicks = 0, hits = 0, misses = 0;
  let currentStreak = 0, bestStreak = 0;
  let reactionTimes = [];
  let timeLeft = config.duration;
  let gameRunning = false;
  let animationId = null;
  let targets = [];
  let nextTargetId = 0;

  // HUD refs
  const hudScore    = document.getElementById("hud-score");
  const hudAccuracy = document.getElementById("hud-accuracy");
  const hudCps      = document.getElementById("hud-cps");
  const hudStreak   = document.getElementById("hud-streak");
  const hudTime     = document.getElementById("hud-time");
  const hudTimeBar  = document.getElementById("hud-time-bar");

  // Overlay refs
  const overlay       = document.getElementById("countdown-overlay");
  const numberText    = document.getElementById("countdown-number");
  const countdownText = document.getElementById("countdown-text");

  // ── Countdown ──────────────────────────────────────────────────────────────
  let countNum = 3;
  numberText.innerText = countNum;

  const countInterval = setInterval(() => {
    countNum--;
    if (countNum > 0) {
      numberText.innerText = countNum;
      try { if (sound) synth.playTick(); } catch (_) {}
    } else if (countNum === 0) {
      numberText.innerText = "GO!";
      countdownText.innerText = "TRAIN HARD";
      try { if (sound) synth.playTick(); } catch (_) {}
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

  // ── Game start ────────────────────────────────────────────────────────────
  function startGame() {
    gameRunning = true;
    board.addEventListener("mousedown", handleBoardClick);

    for (let i = 0; i < config.count; i++) spawnTarget();

    const timerInterval = setInterval(() => {
      if (!gameRunning) { clearInterval(timerInterval); return; }
      timeLeft = Math.max(0, timeLeft - 0.1);
      hudTime.innerText = `${timeLeft.toFixed(1)}s`;
      hudTimeBar.style.width = `${(timeLeft / config.duration) * 100}%`;
      if (timeLeft <= 0) { clearInterval(timerInterval); endGame(); }
    }, 100);

    if (config.moving) animationId = requestAnimationFrame(updatePhysics);
  }

  // ── Target spawn ─────────────────────────────────────────────────────────
  function spawnTarget() {
    if (!gameRunning) return;
    const W = board.clientWidth, H = board.clientHeight, S = config.size;
    const x = Math.random() * (W - S - 40) + 20;
    const y = Math.random() * (H - S - 40) + 20;

    const speed = { easy: 1.5, medium: 2.5, hard: 4.0, expert: 5.5, insane: 7.5 }[config.difficulty] || 2.5;
    const angle = Math.random() * Math.PI * 2;
    const dx = config.moving ? Math.cos(angle) * speed : 0;
    const dy = config.moving ? Math.sin(angle) * speed : 0;

    const el = document.createElement("div");
    el.className = "game-target";
    el.style.cssText = `width:${S}px;height:${S}px;left:${x}px;top:${y}px;`;
    el.appendChild(Object.assign(document.createElement("div"), { className: "game-target-dot" }));

    if (config.animations) {
      const ring = document.createElement("div");
      ring.className = "lifetime-ring";
      ring.style.animationDuration = `${config.lifetime}s`;
      el.appendChild(ring);
    }

    board.appendChild(el);
    setTimeout(() => el.classList.add("active"), 10);

    const id = nextTargetId++;
    const obj = {
      id, element: el, x, y, dx, dy,
      spawnTime: Date.now(),
      timer: setTimeout(() => handleTargetExpire(id), config.lifetime * 1000)
    };

    el.addEventListener("mousedown", (e) => { e.stopPropagation(); handleTargetHit(id); });
    targets.push(obj);
  }

  // ── Physics ───────────────────────────────────────────────────────────────
  function updatePhysics() {
    if (!gameRunning) return;
    const W = board.clientWidth, H = board.clientHeight, S = config.size;
    targets.forEach(t => {
      t.x += t.dx; t.y += t.dy;
      if (t.x <= 5 || t.x >= W - S - 5) { t.dx = -t.dx; t.x = Math.max(5, Math.min(t.x, W - S - 5)); }
      if (t.y <= 5 || t.y >= H - S - 5) { t.dy = -t.dy; t.y = Math.max(5, Math.min(t.y, H - S - 5)); }
      t.element.style.left = `${t.x}px`;
      t.element.style.top  = `${t.y}px`;
    });
    animationId = requestAnimationFrame(updatePhysics);
  }

  // ── Hit / Miss handlers ───────────────────────────────────────────────────
  const scoreWeight = { easy: 1, medium: 2, hard: 3, expert: 4, insane: 5 }[config.difficulty] || 2;

  function handleTargetHit(id) {
    if (!gameRunning) return;
    const idx = targets.findIndex(t => t.id === id);
    if (idx === -1) return;
    const t = targets[idx];

    reactionTimes.push(Date.now() - t.spawnTime);
    try { if (sound) synth.playHit(); } catch (_) {}

    score += scoreWeight;
    clicks++; hits++;
    currentStreak++;
    bestStreak = Math.max(bestStreak, currentStreak);

    spawnFloatIndicator(t.x + config.size / 2, t.y, `+${scoreWeight}`, "hit");
    clearTimeout(t.timer);
    removeTargetDOM(t.element);
    targets.splice(idx, 1);
    updateHud();
    spawnTarget();
  }

  function handleTargetExpire(id) {
    if (!gameRunning) return;
    const idx = targets.findIndex(t => t.id === id);
    if (idx === -1) return;
    const t = targets[idx];
    try { if (sound) synth.playMiss(); } catch (_) {}
    misses++;
    currentStreak = 0;
    spawnFloatIndicator(t.x + config.size / 2, t.y, "MISS", "miss");
    removeTargetDOM(t.element);
    targets.splice(idx, 1);
    updateHud();
    spawnTarget();
  }

  function handleBoardClick(e) {
    if (!gameRunning || e.target !== board) return;
    try { if (sound) synth.playMiss(); } catch (_) {}
    clicks++; misses++;
    currentStreak = 0;
    const rect = board.getBoundingClientRect();
    spawnFloatIndicator(e.clientX - rect.left, e.clientY - rect.top, "MISCLICK", "miss");
    updateHud();
  }

  function removeTargetDOM(el) {
    el.classList.remove("active");
    el.style.transform = "scale(0)";
    setTimeout(() => el.remove(), 150);
  }

  function spawnFloatIndicator(x, y, text, type) {
    const el = document.createElement("div");
    el.className = `float-indicator ${type}`;
    el.innerText = text;
    el.style.left = `${x - 20}px`;
    el.style.top  = `${y - 15}px`;
    board.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }

  function updateHud() {
    hudScore.innerText    = score;
    hudStreak.innerText   = currentStreak;
    const acc = clicks > 0 ? Math.round((hits / clicks) * 100) : 100;
    hudAccuracy.innerText = `${acc}%`;
    const elapsed = config.duration - timeLeft;
    hudCps.innerText = elapsed > 0 ? (clicks / elapsed).toFixed(1) : "0.0";
  }

  // ── End game ──────────────────────────────────────────────────────────────
  function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    try { if (sound) synth.playEnd(); } catch (_) {}

    targets.forEach(t => { clearTimeout(t.timer); t.element.remove(); });
    targets = [];
    board.removeEventListener("mousedown", handleBoardClick);

    const finalAccuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 0;
    const finalCPS      = parseFloat((clicks / config.duration).toFixed(2));
    const avgReact      = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

    const results = {
      score, accuracy: finalAccuracy, cps: finalCPS,
      avgReactionTime: avgReact, clicks, hits, misses,
      difficulty: config.difficulty, bestStreak,
      duration: config.duration
    };

    // Save ONLY to sessionStorage — never to Firebase or localStorage
    sessionStorage.setItem("guest_game_results", JSON.stringify(results));
    showToast("Practice session complete! No data was saved.", "info");

    setTimeout(() => {
      window.location.href = "guest-results.html";
    }, 1200);
  }
});
