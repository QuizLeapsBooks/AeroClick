// Results page controller
import { getCurrentUser } from "../firebase/db.js";
import { showToast } from "./main.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth Guard check
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  // 2. Fetch match results
  const resultsStr = sessionStorage.getItem("last_game_results");
  if (!resultsStr) {
    showToast("No match results found. Redirecting to setup.", "warning");
    setTimeout(() => {
      window.location.href = "setup.html";
    }, 1000);
    return;
  }
  const match = JSON.parse(resultsStr);

  // 3. Render current match stats
  document.getElementById("res-score").innerText = match.score;
  document.getElementById("res-accuracy").innerText = `${match.accuracy}%`;
  document.getElementById("res-cps").innerText = Number(match.cps).toFixed(1);
  document.getElementById("res-reaction").innerText = `${match.avgReactionTime}ms`;
  document.getElementById("res-streak").innerText = match.bestStreak;

  // Render Rank Badge based on current user rank
  const rankBadge = document.getElementById("rank-badge");
  const rankIcon = document.getElementById("rank-icon");
  const rankName = document.getElementById("rank-name");
  
  const rank = user.rank || "Bronze";
  rankName.innerText = `${rank} Rank`;

  // Apply visual style
  rankBadge.className = "rank-badge-container"; // reset
  switch (rank.toLowerCase()) {
    case "bronze":
      rankBadge.classList.add("rank-bronze");
      rankIcon.innerText = "🥉";
      break;
    case "silver":
      rankBadge.classList.add("rank-silver");
      rankIcon.innerText = "🥈";
      break;
    case "gold":
      rankBadge.classList.add("rank-gold");
      rankIcon.innerText = "🥇";
      break;
    case "platinum":
      rankBadge.classList.add("rank-platinum");
      rankIcon.innerText = "🛡️";
      break;
    case "diamond":
      rankBadge.classList.add("rank-diamond");
      rankIcon.innerText = "💎";
      break;
    case "master":
      rankBadge.classList.add("rank-master");
      rankIcon.innerText = "🔮";
      break;
    case "grandmaster":
      rankBadge.classList.add("rank-grandmaster");
      rankIcon.innerText = "👑";
      break;
  }

  // 4. Calculate Improvement Statistics
  // Filter history: index 0 is this match. History elements from index 1 represent previous matches.
  const history = user.matchHistory || [];
  const prevMatches = history.slice(1);

  const pbScoreDelta = document.getElementById("pb-score-delta");
  const pbAccuracyDelta = document.getElementById("pb-accuracy-delta");
  const pbReactionDelta = document.getElementById("pb-reaction-delta");
  const pbStreakDelta = document.getElementById("pb-streak-delta");

  if (prevMatches.length === 0) {
    // First game ever
    pbScoreDelta.innerText = "New PB! (First game)";
    pbScoreDelta.className = "delta positive";
    
    pbAccuracyDelta.innerText = "New PB! (First game)";
    pbAccuracyDelta.className = "delta positive";

    pbReactionDelta.innerText = "New PB! (First game)";
    pbReactionDelta.className = "delta positive";

    pbStreakDelta.innerText = "New PB! (First game)";
    pbStreakDelta.className = "delta positive";
  } else {
    // Extract previous Personal Bests
    const prevPBScore = Math.max(...prevMatches.map(m => m.score), 0);
    const prevPBAccuracy = Math.max(...prevMatches.map(m => m.accuracy), 0);
    
    // Filter out 0 reaction times (invalid/no hits matches)
    const validReactions = prevMatches.map(m => m.avgReactionTime).filter(r => r > 0);
    const prevPBReaction = validReactions.length > 0 ? Math.min(...validReactions) : 9999;
    
    const prevPBStreak = Math.max(...prevMatches.map(m => m.bestStreak), 0);

    // Calculate delta differences
    // 1. Score
    const scoreDiff = match.score - prevPBScore;
    if (scoreDiff > 0) {
      pbScoreDelta.innerText = `+${scoreDiff} (New Personal Best! 🔥)`;
      pbScoreDelta.className = "delta positive";
    } else if (scoreDiff === 0) {
      pbScoreDelta.innerText = "Tied Best! 🤝";
      pbScoreDelta.className = "delta neutral";
    } else {
      pbScoreDelta.innerText = `${scoreDiff} (Best: ${prevPBScore})`;
      pbScoreDelta.className = "delta negative";
    }

    // 2. Accuracy
    const accDiff = match.accuracy - prevPBAccuracy;
    if (accDiff > 0) {
      pbAccuracyDelta.innerText = `+${accDiff}% (New Best! 🎯)`;
      pbAccuracyDelta.className = "delta positive";
    } else if (accDiff === 0) {
      pbAccuracyDelta.innerText = "Tied Best! 🤝";
      pbAccuracyDelta.className = "delta neutral";
    } else {
      pbAccuracyDelta.innerText = `${accDiff}% (Best: ${prevPBAccuracy}%)`;
      pbAccuracyDelta.className = "delta negative";
    }

    // 3. Reaction Speed (Lower is better)
    if (match.avgReactionTime > 0) {
      if (prevPBReaction === 9999) {
        pbReactionDelta.innerText = "New PB! ⚡";
        pbReactionDelta.className = "delta positive";
      } else {
        const reactDiff = match.avgReactionTime - prevPBReaction;
        if (reactDiff < 0) {
          pbReactionDelta.innerText = `${reactDiff}ms (New Record! Faster ⚡)`;
          pbReactionDelta.className = "delta positive";
        } else if (reactDiff === 0) {
          pbReactionDelta.innerText = "Tied Best! 🤝";
          pbReactionDelta.className = "delta neutral";
        } else {
          pbReactionDelta.innerText = `+${reactDiff}ms (Best: ${prevPBReaction}ms)`;
          pbReactionDelta.className = "delta negative"; // positive diff means slower
        }
      }
    } else {
      pbReactionDelta.innerText = "No hits recorded";
      pbReactionDelta.className = "delta neutral";
    }

    // 4. Streak
    const streakDiff = match.bestStreak - prevPBStreak;
    if (streakDiff > 0) {
      pbStreakDelta.innerText = `+${streakDiff} (New Best! 🔥)`;
      pbStreakDelta.className = "delta positive";
    } else if (streakDiff === 0) {
      pbStreakDelta.innerText = "Tied Best! 🤝";
      pbStreakDelta.className = "delta neutral";
    } else {
      pbStreakDelta.innerText = `${streakDiff} (Best: ${prevPBStreak})`;
      pbStreakDelta.className = "delta negative";
    }
  }
});
