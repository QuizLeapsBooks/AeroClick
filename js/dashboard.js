// Dashboard Page Controller
import { getCurrentUser, logoutUser, getUserGlobalRank, updateUserSettings, getLeaderboard, addFriend, getFriendsData, sendChallenge, getChallenges, updateUserCountry } from "../firebase/db.js";
import { showToast } from "./main.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth Guard check
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  // 2. Element Selectors
  const profileAvatar   = document.getElementById("profile-avatar");
  const profileUsername = document.getElementById("profile-username");
  const profileJoined   = document.getElementById("profile-joined");
  const profileRank     = document.getElementById("profile-rank");
  const rankIcon        = document.getElementById("rank-icon");
  const rankName        = document.getElementById("rank-name");

  const tabButtons = document.querySelectorAll(".sidebar-menu-btn");
  const panels     = document.querySelectorAll(".dashboard-panel");

  const statPBScore       = document.getElementById("stat-pb-score");
  const statPBAccuracy    = document.getElementById("stat-pb-accuracy");
  const statPBReaction    = document.getElementById("stat-pb-reaction");
  const statTotalGames    = document.getElementById("stat-total-games");
  const statTotalClicks   = document.getElementById("stat-total-clicks");
  const statTotalHits     = document.getElementById("stat-total-hits");
  const statTotalMisses   = document.getElementById("stat-total-misses");
  const statTotalPlaytime = document.getElementById("stat-total-playtime");

  const logoutBtn         = document.getElementById("logout-btn");
  const settingsLogoutBtn = document.getElementById("settings-logout-btn");
  const achievementsList  = document.getElementById("achievements-list");
  const historyTableBody  = document.getElementById("history-table-body");
  
  // Social
  const addFriendInput = document.getElementById("add-friend-input");
  const addFriendBtn   = document.getElementById("add-friend-btn");
  const friendsList    = document.getElementById("friends-list");

  // Settings
  const settingsThemeToggle = document.getElementById("settings-theme-toggle");
  const resetCacheBtn       = document.getElementById("btn-reset-cache");

  // ── 3. Render Profile Sidebar ──────────────────────────────────────────────
  profileUsername.innerText = user.username;
  profileJoined.innerText   = `Joined: ${user.joinDate || "N/A"}`;
  profileAvatar.innerText   = user.username.substring(0, 2).toUpperCase();

  const rank = user.rank || "Bronze";
  rankName.innerText = `${rank} Rank`;
  profileRank.className = "rank-badge-container";
  switch (rank.toLowerCase()) {
    case "bronze":      profileRank.classList.add("rank-bronze");      rankIcon.innerText = "🥉"; break;
    case "silver":      profileRank.classList.add("rank-silver");      rankIcon.innerText = "🥈"; break;
    case "gold":        profileRank.classList.add("rank-gold");        rankIcon.innerText = "🥇"; break;
    case "platinum":    profileRank.classList.add("rank-platinum");    rankIcon.innerText = "🛡️"; break;
    case "diamond":     profileRank.classList.add("rank-diamond");     rankIcon.innerText = "💎"; break;
    case "master":      profileRank.classList.add("rank-master");      rankIcon.innerText = "🔮"; break;
    case "grandmaster": profileRank.classList.add("rank-grandmaster"); rankIcon.innerText = "👑"; break;
  }

  // ── 4. Stats Overview ─────────────────────────────────────────────────────
  statPBScore.innerText    = user.bestScore || 0;
  statPBAccuracy.innerText = `${user.bestAccuracy || 0}%`;

  const matchHistory = user.matchHistory || [];
  const validReactionGames = matchHistory.filter(g => g.avgReactionTime > 0);
  const avgReactionTime = validReactionGames.length > 0
    ? Math.round(validReactionGames.reduce((s, g) => s + g.avgReactionTime, 0) / validReactionGames.length)
    : null;
  statPBReaction.innerText = avgReactionTime ? `${avgReactionTime}ms` : "N/A";

  statTotalGames.innerText   = user.totalGamesPlayed || 0;
  statTotalClicks.innerText  = user.totalClicks || 0;
  statTotalHits.innerText    = user.totalHits || 0;
  statTotalMisses.innerText  = user.totalMisses || 0;
  if (statTotalPlaytime) statTotalPlaytime.innerText = formatPlayTime(user.totalPlayTime || 0);

  try {
    const globalRank = await getUserGlobalRank(user.username);
    const rankPositionEl = document.getElementById("profile-global-rank");
    if (rankPositionEl) {
      rankPositionEl.innerText = globalRank ? `Global Rank: #${globalRank}` : "Unranked — Play a game!";
      rankPositionEl.style.display = "block";
    }
  } catch (e) {
    console.warn("[AeroClick] Could not fetch global rank:", e.message);
  }

  // ── 5. Achievements ───────────────────────────────────────────────────────
  renderAchievements(user.achievements || []);

  // ── 6. Match History ──────────────────────────────────────────────────────
  renderMatchHistory(matchHistory);

  // ── 7. Analytics ──────────────────────────────────────────────────────────
  let activeFilter = "all";
  renderAnalytics(matchHistory, activeFilter);

  document.querySelectorAll(".analytics-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".analytics-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.dataset.filter;
      renderAnalytics(matchHistory, activeFilter);
    });
  });

  // ── 7.5 Social & Friends & Challenges ───────────────────────────────────────
  async function refreshFriendsList() {
    try {
      const friendsData = await getFriendsData();
      renderFriendsList(friendsData);
    } catch (err) {
      console.warn("Could not refresh friends list:", err);
    }
  }

  const receivedListEl = document.getElementById("received-challenges-list");
  const sentListEl = document.getElementById("sent-challenges-list");

  async function refreshChallengesList() {
    if (!receivedListEl || !sentListEl) return;
    try {
      const list = await getChallenges();
      const received = list.filter(c => c.receiver.toLowerCase() === user.username.toLowerCase());
      const sent = list.filter(c => c.sender.toLowerCase() === user.username.toLowerCase());

      if (received.length === 0) {
        receivedListEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No active challenges from friends.</p>`;
      } else {
        receivedListEl.innerHTML = received.map(c => {
          const statusColor = c.status === "completed" ? "var(--success)" : (c.status === "failed" ? "var(--danger)" : "var(--warning)");
          const actions = c.status === "pending"
            ? `<button class="btn btn-primary play-challenge-btn" data-id="${c.id}" data-sender="${c.sender}" data-score="${c.targetScore}" data-diff="${c.difficulty}" style="padding: 4px 8px; font-size: 0.8rem; margin-top: 6px;">⚔️ Accept & Play</button>`
            : `<span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Result: ${c.status === "completed" ? "Beaten 🎉" : "Failed ❌"} (${c.achievedScore} pts)</span>`;

          return `
            <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 4px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                <strong style="color: var(--accent-secondary);">${c.sender}</strong>
                <span style="color: ${statusColor}; font-weight: bold; font-size: 0.75rem; text-transform: uppercase;">${c.status}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                Target: <strong style="color:var(--accent-primary);">${c.targetScore}</strong> on <strong style="text-transform: uppercase; color:var(--accent-tertiary);">${c.difficulty}</strong>
              </div>
              ${actions}
            </div>
          `;
        }).join("");
      }

      if (sent.length === 0) {
        sentListEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">You haven't sent any challenges yet.</p>`;
      } else {
        sentListEl.innerHTML = sent.map(c => {
          const statusColor = c.status === "completed" ? "var(--success)" : (c.status === "failed" ? "var(--danger)" : "var(--warning)");
          let statusDetail = "";
          if (c.status === "completed") {
            statusDetail = ` (${c.achievedScore} pts)`;
          } else if (c.status === "failed") {
            statusDetail = ` (${c.achievedScore} pts)`;
          }
          return `
            <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 4px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                <strong>To: ${c.receiver}</strong>
                <span style="color: ${statusColor}; font-weight: bold; font-size: 0.75rem; text-transform: uppercase;">${c.status}${statusDetail}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                Target: <strong style="color:var(--accent-primary);">${c.targetScore}</strong> on <strong style="text-transform: uppercase; color:var(--accent-tertiary);">${c.difficulty}</strong>
              </div>
            </div>
          `;
        }).join("");
      }

      document.querySelectorAll(".play-challenge-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const sender = btn.getAttribute("data-sender");
          const score = btn.getAttribute("data-score");
          const diff = btn.getAttribute("data-diff");

          sessionStorage.setItem("active_challenge_id", id);
          sessionStorage.setItem("active_challenge_sender", sender);
          sessionStorage.setItem("active_challenge_target", score);
          sessionStorage.setItem("active_challenge_difficulty", diff);

          showToast("Starting challenge play...", "info");
          setTimeout(() => {
            window.location.href = `setup.html?difficulty=${diff}`;
          }, 800);
        });
      });

    } catch (err) {
      console.warn("Could not load challenges:", err);
    }
  }

  await refreshFriendsList();
  await refreshChallengesList();

  if (addFriendBtn) {
    addFriendBtn.addEventListener("click", async () => {
      const friendName = addFriendInput.value.trim();
      if (!friendName) return;

      try {
        await addFriend(friendName);
        showToast(`Added ${friendName} to friends!`, "success");
        addFriendInput.value = "";
        await refreshFriendsList();
      } catch (err) {
        showToast("Failed to add friend: " + err.message, "danger");
      }
    });
  }

  // ── 8. Tab Switching ──────────────────────────────────────────────────────
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.classList.add("active");
        // Redraw charts when panel becomes visible (canvas needs visible parent)
        if (btn.dataset.target === "panel-analytics") {
          renderAnalytics(matchHistory, activeFilter);
        }
      }
    });
  });

  // ── 9. Achievements renderer ──────────────────────────────────────────────
  function renderAchievements(list) {
    achievementsList.innerHTML = "";
    if (!list.length) {
      achievementsList.innerHTML = `<p style="color:var(--text-secondary);">No achievements config found.</p>`;
      return;
    }
    list.forEach(ach => {
      const card = document.createElement("div");
      card.className = `achievement-card${ach.unlocked ? "" : " locked"}`;
      card.innerHTML = `
        <div class="achievement-icon-box">${ach.unlocked ? ach.icon : "🔒"}</div>
        <div class="achievement-info">
          <h4>${ach.title}</h4>
          <p>${ach.description}</p>
          ${ach.unlocked
            ? `<div class="achievement-date">Unlocked: ${ach.date}</div>`
            : `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Locked</div>`
          }
        </div>
      `;
      achievementsList.appendChild(card);
    });
  }

  // ── 10. Match history renderer ────────────────────────────────────────────
  function renderMatchHistory(history) {
    if (!history.length) return;
    historyTableBody.innerHTML = "";
    history.slice(0, 25).forEach(game => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="color:var(--text-secondary);">${game.date}</td>
        <td style="font-weight:700;color:var(--accent-primary);">${game.score}</td>
        <td>${game.accuracy}%</td>
        <td>${Number(game.cps || 0).toFixed(1)}</td>
        <td>${game.avgReactionTime === 0 ? "N/A" : game.avgReactionTime + "ms"}</td>
        <td style="text-transform:uppercase;font-size:0.8rem;font-weight:600;">
          <span style="color:${getDifficultyColor(game.difficulty)};">${game.difficulty}</span>
        </td>
      `;
      historyTableBody.appendChild(row);
    });
  }

  // ── 10.5 Friends List renderer ────────────────────────────────────────────
  function renderFriendsList(friendsData) {
    if (!friendsList) return;
    friendsList.innerHTML = "";
    if (!friendsData || !friendsData.length) {
      friendsList.innerHTML = `<p style="color:var(--text-secondary); grid-column: 1 / -1;">You haven't added any friends yet.</p>`;
      return;
    }

    friendsData.forEach(friend => {
      const card = document.createElement("div");
      card.className = `achievement-card`;
      card.style.flexDirection = "column";
      card.style.alignItems = "stretch";
      card.style.gap = "12px";
      
      const avatarStr = friend.username.substring(0, 2).toUpperCase();
      const flag = getFlagEmoji(friend.countryCode || friend.country || "US");
      
      const statsHtml = `
        <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.85rem;">
          <span style="color:var(--text-secondary);">Best Score:</span>
          <strong style="color:var(--accent-primary);">${friend.bestScore || 0}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.85rem;">
          <span style="color:var(--text-secondary);">Accuracy:</span>
          <strong style="color:var(--accent-tertiary);">${friend.bestAccuracy || 0}%</strong>
        </div>
      `;

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="achievement-icon-box" style="background:var(--bg-secondary); border-color:var(--glass-border); font-size:1.1rem; font-weight:bold; color:var(--text-primary);">${avatarStr}</div>
          <div class="achievement-info" style="flex:1;">
            <h4 style="margin:0; font-size:1.1rem;">${friend.username}</h4>
            <span style="font-size:0.75rem; color:var(--text-muted);">${flag} ${friend.country || "United States"}</span>
          </div>
        </div>
        <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px;">
          ${statsHtml}
        </div>
        <button class="btn btn-secondary challenge-btn" data-friend="${friend.username}" style="margin-top:auto; padding:6px; font-size:0.85rem;">⚔️ Send Challenge</button>
      `;
      friendsList.appendChild(card);
    });

    // Attach send challenge events
    document.querySelectorAll(".challenge-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const friend = btn.getAttribute("data-friend");
        const targetScore = user.bestScore || 50;
        const difficulty = user.settings?.lastDifficulty || "medium";

        try {
          await sendChallenge(friend, targetScore, difficulty);
          showToast(`Challenged ${friend} to beat your score of ${targetScore}!`, "success");
          await refreshChallengesList();
        } catch (err) {
          showToast(`Challenge failed: ${err.message}`, "danger");
        }
      });
    });
  }

  function getDifficultyColor(diff) {
    switch ((diff || "").toLowerCase()) {
      case "easy":   return "var(--success)";
      case "medium": return "var(--accent-primary)";
      case "hard":   return "var(--warning)";
      case "expert": return "var(--accent-secondary)";
      case "insane": return "var(--danger)";
      default:       return "var(--text-secondary)";
    }
  }

  // ── 11. Settings ──────────────────────────────────────────────────────────
  if (settingsThemeToggle) {
    settingsThemeToggle.addEventListener("click", () => {
      document.getElementById("theme-toggle")?.click();
      showToast("Theme preference updated.", "success");
    });
  }

  if (resetCacheBtn) {
    resetCacheBtn.addEventListener("click", () => {
      if (confirm("⚠️ This will permanently delete ALL offline user records. Continue?")) {
        localStorage.removeItem("mock_users");
        localStorage.removeItem("mock_current_user");
        showToast("Local user profiles cleared! Logging out...", "warning");
        setTimeout(() => { window.location.href = "../index.html"; }, 1200);
      }
    });
  }

  const countrySelect = document.getElementById("settings-country-select");
  const countryFlag = document.getElementById("settings-country-flag");

  const COUNTRIES_LIST = [
    { code: "US", name: "United States" },
    { code: "IN", name: "India" },
    { code: "GB", name: "United Kingdom" },
    { code: "CA", name: "Canada" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "JP", name: "Japan" },
    { code: "AU", name: "Australia" },
    { code: "BR", name: "Brazil" },
    { code: "RU", name: "Russia" },
    { code: "CN", name: "China" },
    { code: "IT", name: "Italy" },
    { code: "ES", name: "Spain" },
    { code: "KR", name: "South Korea" },
    { code: "NL", name: "Netherlands" },
    { code: "SE", name: "Sweden" },
    { code: "CH", name: "Switzerland" },
    { code: "SG", name: "Singapore" }
  ];

  function getFlagEmoji(code) {
    if (!code || code === "Unknown" || code.length !== 2) return "🌐";
    const codePoints = code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0));
    try {
      return String.fromCodePoint(...codePoints);
    } catch {
      return "🌐";
    }
  }

  if (countrySelect) {
    let selectHtml = "";
    COUNTRIES_LIST.forEach(c => {
      selectHtml += `<option value="${c.code}">${getFlagEmoji(c.code)} ${c.name}</option>`;
    });
    countrySelect.innerHTML = selectHtml;

    const userCountryCode = user.countryCode || "US";
    countrySelect.value = userCountryCode.toUpperCase();
    if (countryFlag) countryFlag.innerText = getFlagEmoji(userCountryCode);

    countrySelect.addEventListener("change", async (e) => {
      const code = e.target.value;
      const selected = COUNTRIES_LIST.find(c => c.code === code);
      const name = selected ? selected.name : "United States";
      try {
        await updateUserCountry(name, code);
        if (countryFlag) countryFlag.innerText = getFlagEmoji(code);
        showToast(`Country updated to ${name}!`, "success");
      } catch (err) {
        showToast(`Failed to update country: ${err.message}`, "danger");
      }
    });
  }

  async function handleLogout() {
    if (confirm("Are you sure you want to sign out?")) {
      try {
        await logoutUser();
        showToast("Logged out successfully. Goodbye!", "success");
        setTimeout(() => { window.location.href = "../index.html"; }, 1000);
      } catch (err) {
        showToast("Logout failed: " + err.message, "danger");
      }
    }
  }

  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (settingsLogoutBtn) settingsLogoutBtn.addEventListener("click", handleLogout);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS ENGINE — pure Canvas 2D, zero external dependencies
// ═══════════════════════════════════════════════════════════════════════════════

function filterHistory(history, filter) {
  if (filter === "all") return history;
  const now = Date.now();
  const ms  = filter === "weekly" ? 7 * 86400000 : 30 * 86400000;
  return history.filter(g => !g.timestamp || (now - g.timestamp) <= ms);
}

function renderAnalytics(rawHistory, filter) {
  const history = filterHistory(rawHistory, filter);
  drawScoreTrendChart(history);
  drawAccuracyPie(history);
  renderBestVsAverage(history);
}

// ── Score Trend Line Chart ────────────────────────────────────────────────────
function drawScoreTrendChart(history) {
  const canvas = document.getElementById("chart-score-trend");
  const empty  = document.getElementById("chart-score-empty");
  if (!canvas) return;

  const ctx  = canvas.getContext("2d");
  // oldest → newest, limit to 10
  const data = [...history].reverse().slice(-10);

  if (data.length < 2) {
    canvas.style.display = "none";
    if (empty) empty.style.display = "block";
    return;
  }
  canvas.style.display = "block";
  if (empty) empty.style.display = "none";

  const W = canvas.width, H = canvas.height;
  const pad = { top: 24, right: 24, bottom: 38, left: 50 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  const scores = data.map(g => g.score);
  const minV   = Math.max(0, Math.min(...scores) - 2);
  const maxV   = Math.max(...scores) + 2;
  const range  = maxV - minV || 1;

  const toX = i => pad.left + (i / (data.length - 1)) * cW;
  const toY = v => pad.top  + cH - ((v - minV) / range) * cH;

  const isDark     = document.documentElement.getAttribute("data-theme") !== "light";
  const gridColor  = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  const labelColor = isDark ? "#64748b" : "#94a3b8";
  const textColor  = isDark ? "#f8fafc" : "#0f172a";

  // Horizontal grid lines + Y-axis labels
  ctx.strokeStyle = gridColor;
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.font      = "11px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(Math.round(maxV - (i / 4) * range), pad.left - 8, y + 4);
  }

  // X-axis date labels
  data.forEach((g, i) => {
    ctx.fillStyle = labelColor;
    ctx.font      = "10px Outfit, sans-serif";
    ctx.textAlign = "center";
    const label = g.date ? g.date.replace(/,?\s*\d{4}/, "").trim() : `G${i + 1}`;
    ctx.fillText(label, toX(i), H - 8);
  });

  // Area gradient
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0, "rgba(99,102,241,0.28)");
  grad.addColorStop(1, "rgba(99,102,241,0)");

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(scores[0]));
  scores.forEach((s, i) => { if (i > 0) ctx.lineTo(toX(i), toY(s)); });
  ctx.lineTo(toX(scores.length - 1), pad.top + cH);
  ctx.lineTo(toX(0), pad.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = "round";
  ctx.moveTo(toX(0), toY(scores[0]));
  scores.forEach((s, i) => { if (i > 0) ctx.lineTo(toX(i), toY(s)); });
  ctx.stroke();

  // Dots + value labels
  scores.forEach((s, i) => {
    const x = toX(i), y = toY(s);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle   = "#a855f7";
    ctx.strokeStyle = isDark ? "#12131c" : "#ffffff";
    ctx.lineWidth   = 2;
    ctx.fill(); ctx.stroke();
    ctx.fillStyle   = textColor;
    ctx.font        = "bold 11px Outfit, sans-serif";
    ctx.textAlign   = "center";
    ctx.fillText(s, x, y - 10);
  });
}

// ── Accuracy Pie Chart ────────────────────────────────────────────────────────
function drawAccuracyPie(history) {
  const canvas = document.getElementById("chart-accuracy-pie");
  const legend = document.getElementById("pie-legend");
  if (!canvas || !legend) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  if (!history.length) {
    ctx.fillStyle   = "#64748b";
    ctx.font        = "13px Outfit, sans-serif";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No data yet", W / 2, H / 2);
    legend.innerHTML = "";
    return;
  }

  const brackets = [
    { label: "90–100%",  color: "#10b981", min: 90, max: 101 },
    { label: "70–89%",   color: "#6366f1", min: 70, max: 90  },
    { label: "50–69%",   color: "#f59e0b", min: 50, max: 70  },
    { label: "0–49%",    color: "#ef4444", min: 0,  max: 50  }
  ];

  const counts = brackets.map(b => history.filter(g => g.accuracy >= b.min && g.accuracy < b.max).length);
  const total  = counts.reduce((a, b) => a + b, 0) || 1;

  const cx = W / 2, cy = H / 2;
  const r  = Math.min(W, H) / 2 - 10;
  let angle = -Math.PI / 2;

  counts.forEach((count, i) => {
    if (!count) return;
    const slice = (count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle   = brackets[i].color;
    ctx.strokeStyle = isDark ? "#12131c" : "#ffffff";
    ctx.lineWidth   = 2;
    ctx.fill(); ctx.stroke();
    angle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? "#12131c" : "#f8fafc";
  ctx.fill();

  // Center label
  const hits = history.reduce((s, g) => s + (g.hits || 0), 0);
  const all  = history.reduce((s, g) => s + (g.clicks || 0), 0);
  const overallAcc = all > 0 ? Math.round((hits / all) * 100) : 0;
  ctx.fillStyle    = isDark ? "#f8fafc" : "#0f172a";
  ctx.font         = "bold 18px Outfit, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${overallAcc}%`, cx, cy - 7);
  ctx.font      = "11px Outfit, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("avg hit rate", cx, cy + 11);
  ctx.textBaseline = "alphabetic";

  // Legend
  legend.innerHTML = brackets.map((b, i) => counts[i] > 0 ? `
    <div class="pie-legend-item">
      <span class="pie-dot" style="background:${b.color};"></span>
      <span>${b.label} <strong>(${counts[i]})</strong></span>
    </div>
  ` : "").join("");
}

// ── Best vs Average comparison ────────────────────────────────────────────────
function renderBestVsAverage(history) {
  const container = document.getElementById("bva-grid");
  if (!container) return;

  if (!history.length) {
    container.innerHTML = `<p style="color:var(--text-secondary);font-size:0.9rem;">Play some games to see your stat comparison.</p>`;
    return;
  }

  const avg = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;

  const scores = history.map(g => g.score);
  const accs   = history.map(g => g.accuracy);
  const cpss   = history.map(g => Number(g.cps) || 0);
  const reacts = history.filter(g => g.avgReactionTime > 0).map(g => g.avgReactionTime);

  const rows = [
    { label: "Score",    icon: "🎯", best: Math.max(...scores),          avgV: avg(scores),          unit: "",   color: "var(--accent-primary)",   higherBetter: true },
    { label: "Accuracy", icon: "👁️", best: Math.max(...accs),            avgV: Math.round(avg(accs)), unit: "%",  color: "var(--accent-tertiary)", higherBetter: true },
    { label: "CPS",      icon: "⚡", best: Math.max(...cpss).toFixed(1), avgV: avg(cpss),             unit: "",   color: "var(--accent-secondary)", higherBetter: true },
    { label: "Reaction", icon: "⏱️",
      best: reacts.length ? Math.min(...reacts) + "ms" : "N/A",
      avgV: reacts.length ? Math.round(avg(reacts)) + "ms" : "N/A",
      unit: "", color: "var(--warning)", higherBetter: false, raw: true }
  ];

  container.innerHTML = rows.map(row => `
    <div class="bva-row">
      <div class="bva-label">${row.icon} ${row.label}</div>
      <div class="bva-values">
        <div class="bva-cell">
          <span class="bva-tag best-tag">BEST</span>
          <span class="bva-num" style="color:${row.color};">${row.raw ? row.best : row.best + row.unit}</span>
        </div>
        <div class="bva-sep">vs</div>
        <div class="bva-cell">
          <span class="bva-tag avg-tag">AVG</span>
          <span class="bva-num">${row.raw ? row.avgV : row.avgV + row.unit}</span>
        </div>
      </div>
    </div>
  `).join("");
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatPlayTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "0s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || !parts.length) parts.push(`${s}s`);
  return parts.join(" ");
}
