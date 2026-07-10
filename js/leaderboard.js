// Leaderboard Page Controller
import { getLeaderboard, getCurrentUser } from "../firebase/db.js";
import { isMock } from "../firebase/config.js";

const countryNameMap = {
  "US": "United States",
  "GB": "United Kingdom",
  "UK": "United Kingdom",
  "CA": "Canada",
  "IN": "India",
  "DE": "Germany",
  "FR": "France",
  "JP": "Japan",
  "AU": "Australia",
  "BR": "Brazil",
  "RU": "Russia",
  "CN": "China",
  "IT": "Italy",
  "ES": "Spain",
  "KR": "South Korea",
  "NL": "Netherlands",
  "SE": "Sweden",
  "CH": "Switzerland",
  "SG": "Singapore"
};

function getFlagEmoji(code) {
  if (!code || code === "Unknown" || code.length !== 2) return "🌐";
  const codePoints = code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const authActions = document.getElementById("auth-actions");
  const userRankContainer = document.getElementById("user-rank-container");
  const searchInput = document.getElementById("search-input");
  const countryFilter = document.getElementById("country-filter");
  const tableBody = document.getElementById("leaderboard-body");

  // State
  let currentUserProfile = null;
  let allRankings = [];

  // Check login state
  currentUserProfile = await getCurrentUser();
  updateNavbarState();

  // Load Leaderboard data
  await loadLeaderboard();

  // Search/Filter Handlers
  searchInput.addEventListener("input", filterTable);
  if (countryFilter) {
    countryFilter.addEventListener("change", filterTable);
  }

  // 1. Update Navbar UI based on Auth
  function updateNavbarState() {
    if (currentUserProfile) {
      authActions.innerHTML = `
        <a href="dashboard.html" class="btn btn-secondary">Dashboard</a>
        <a href="setup.html" class="btn btn-primary">Start Training</a>
      `;
    } else {
      authActions.innerHTML = `
        <a href="auth.html" class="btn btn-secondary">Login</a>
        <a href="auth.html?signup=true" class="btn btn-primary">Sign Up</a>
      `;
    }
  }

  function populateCountryDropdown(rankings) {
    if (!countryFilter) return;
    const uniqueCountries = new Set();
    rankings.forEach(p => {
      const code = p.countryCode || p.country || "US";
      if (code && code.length === 2) {
        uniqueCountries.add(code.toUpperCase());
      }
    });

    let optionsHtml = `<option value="all">🌍 Global (All Countries)</option>`;
    const sortedCodes = Array.from(uniqueCountries).sort((a, b) => {
      const nameA = countryNameMap[a] || a;
      const nameB = countryNameMap[b] || b;
      return nameA.localeCompare(nameB);
    });

    sortedCodes.forEach(code => {
      const name = countryNameMap[code] || `Country (${code})`;
      const flag = getFlagEmoji(code);
      optionsHtml += `<option value="${code}">${flag} ${name}</option>`;
    });

    countryFilter.innerHTML = optionsHtml;
  }

  // 2. Load and render leaderboard database
  async function loadLeaderboard() {
    try {
      allRankings = await getLeaderboard();

      // Only seed demo competitors in mock mode when the leaderboard is empty.
      if (isMock && allRankings.length === 0) {
        seedMockCompetitors();
        allRankings = await getLeaderboard();
      }

      populateCountryDropdown(allRankings);
      renderLeaderboard(allRankings);
      renderUserStandingCard();

    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--danger); padding: 40px 0;">
            ⚠️ Error loading leaderboard data: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  // Seed mock competitors for immediate gameplay immersion
  // Only adds missing entries — never overwrites existing users
  function seedMockCompetitors() {
    const existingUsers = JSON.parse(localStorage.getItem("mock_users") || "{}");

    const mockCompetitors = {
      aimbot_clone: {
        password: "password123",
        profile: {
          username: "AimBotClone",
          joinDate: "May 14, 2026",
          bestScore: 165,
          bestAccuracy: 100,
          bestReactionTime: 142,
          totalGamesPlayed: 142,
          totalClicks: 23512,
          totalHits: 23512,
          totalMisses: 0,
          totalPlayTime: 4260,
          rank: "Grandmaster",
          country: "CA",
          achievements: [],
          matchHistory: []
        }
      },
      shroud_disciple: {
        password: "password123",
        profile: {
          username: "ShroudDisciple",
          joinDate: "Jun 02, 2026",
          bestScore: 124,
          bestAccuracy: 96,
          bestReactionTime: 184,
          totalGamesPlayed: 84,
          totalClicks: 12410,
          totalHits: 11913,
          totalMisses: 497,
          totalPlayTime: 2520,
          rank: "Master",
          country: "US",
          achievements: [],
          matchHistory: []
        }
      },
      casualclicker: {
        password: "password123",
        profile: {
          username: "CasualClicker",
          joinDate: "Jul 01, 2026",
          bestScore: 42,
          bestAccuracy: 84,
          bestReactionTime: 260,
          totalGamesPlayed: 12,
          totalClicks: 840,
          totalHits: 705,
          totalMisses: 135,
          totalPlayTime: 360,
          rank: "Gold",
          country: "UK",
          achievements: [],
          matchHistory: []
        }
      },
      tokyo_drifter: {
        password: "password123",
        profile: {
          username: "TokyoDrifter",
          joinDate: "Jul 05, 2026",
          bestScore: 142,
          bestAccuracy: 92,
          bestReactionTime: 160,
          totalGamesPlayed: 112,
          totalClicks: 9400,
          totalHits: 8705,
          totalMisses: 695,
          totalPlayTime: 3360,
          rank: "Master",
          country: "JP",
          achievements: [],
          matchHistory: []
        }
      }
    };

    // Merge: only add competitors that don't conflict with existing usernames
    const merged = { ...mockCompetitors };
    Object.keys(existingUsers).forEach((key) => {
      merged[key] = existingUsers[key]; // existing users take priority
    });

    localStorage.setItem("mock_users", JSON.stringify(merged));
  }

  // 3. Render Rankings Table
  function renderLeaderboard(data) {
    tableBody.innerHTML = "";

    if (data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">
            No scores registered yet. Be the first to train!
          </td>
        </tr>
      `;
      return;
    }

    data.forEach((player, index) => {
      const rank = index + 1;
      const row = document.createElement("tr");

      // Set styles for top 3
      if (rank === 1) row.className = "rank-1";
      else if (rank === 2) row.className = "rank-2";
      else if (rank === 3) row.className = "rank-3";

      // Highlight logged-in user row
      const isSelf = currentUserProfile && currentUserProfile.username.toLowerCase() === player.username.toLowerCase();
      if (isSelf) {
        row.classList.add("row-highlight");
      }

      // Rank Badge/Number column
      let rankContent = `<span class="rank-pill">${rank}</span>`;
      if (rank === 1) rankContent = `<span class="rank-pill">👑</span>`;

      // Username column content
      let userBadgeContent = "";
      if (isSelf) {
        userBadgeContent = `<span class="user-badge" style="background: var(--accent-primary); color: white;">You</span>`;
      } else if (player.bestScore >= 150) {
        userBadgeContent = `<span class="user-badge" style="background: rgba(239,68,68,0.15); color: var(--danger);">GM</span>`;
      }

      const playerCountry = player.countryCode || player.country || "US";
      row.setAttribute("data-country", playerCountry);
      const playerFlag = getFlagEmoji(playerCountry);

      row.innerHTML = `
        <td class="rank-col">${rankContent}</td>
        <td>
          <div class="user-cell">
            <span style="margin-right: 4px;">${playerFlag}</span>
            <span style="font-family: var(--font-heading);">${player.username}</span>
            ${userBadgeContent}
          </div>
        </td>
        <td style="font-weight: 700; color: var(--accent-primary);">${player.bestScore}</td>
        <td>${player.bestAccuracy}%</td>
        <td>${player.bestReactionTime === 9999 ? "N/A" : player.bestReactionTime + "ms"}</td>
        <td style="color: var(--text-muted);">${player.totalGamesPlayed}</td>
      `;

      tableBody.appendChild(row);
    });
  }

  // 4. Render User Placement Box
  function renderUserStandingCard() {
    if (!currentUserProfile) return; // Kept default unauthenticated banner

    const username = currentUserProfile.username;
    const cleanUsername = username.toLowerCase();
    
    // Find index in rankings array
    const rankIndex = allRankings.findIndex(p => p.username.toLowerCase() === cleanUsername);
    const hasRank = rankIndex !== -1;
    const rankNum = hasRank ? rankIndex + 1 : null;
    const rankTotal = allRankings.length;

    const avatarInitial = username.substring(0, 2).toUpperCase();

    // Map rank to colors
    let badgeColor = "var(--accent-primary)";
    if (rankNum === 1) badgeColor = "#ffd700";
    else if (rankNum === 2) badgeColor = "#c0c0c0";
    else if (rankNum === 3) badgeColor = "#cd7f32";

    // Build rank display text
    const rankDisplay = hasRank
      ? `#${rankNum} <span style="font-size: 1rem; color: var(--text-muted); font-weight: 500;">/ ${rankTotal}</span>`
      : `<span style="font-size: 1.2rem; color: var(--text-muted);">Unranked</span>`;
    const statsLine = hasRank
      ? `Personal Best: <strong>${currentUserProfile.bestScore} pts</strong> (Accuracy: ${currentUserProfile.bestAccuracy}%)`
      : `Play a game to get ranked on the leaderboard!`;

    userRankContainer.innerHTML = `
      <div class="user-rank-card">
        <div class="user-rank-info">
          <div class="user-rank-avatar" style="background: ${badgeColor}; box-shadow: 0 0 15px ${badgeColor}50;">
            ${avatarInitial}
          </div>
          <div class="user-rank-details">
            <h4>${username}</h4>
            <p>${statsLine}</p>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Global Standing</div>
          <div class="user-rank-number">${rankDisplay}</div>
        </div>
      </div>
    `;
  }

  // 5. Search & Country Filter function
  function filterTable() {
    const query = searchInput.value.toLowerCase();
    const selectedCountry = countryFilter ? countryFilter.value : "all";
    const rows = tableBody.getElementsByTagName("tr");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Skip error or loading rows
      if (row.cells.length < 2) continue;

      const usernameCell = row.cells[1].innerText.toLowerCase();
      const rowCountry = row.getAttribute("data-country");
      
      const matchesSearch = usernameCell.includes(query);
      const matchesCountry = selectedCountry === "all" || rowCountry === selectedCountry;

      if (matchesSearch && matchesCountry) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    }
  }
});
