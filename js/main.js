// Global utility script - Handles theme changes, toasts, and fallback banners
import { firebaseReady, isMock } from "../firebase/config.js";
import { getCurrentUser, updateUserSettings } from "../firebase/db.js";

document.addEventListener("DOMContentLoaded", () => {
  // Attach theme toggle listener immediately — no async blocking
  initTheme();
  initMobileNav();
  // Check mock mode after Firebase settles (non-blocking)
  firebaseReady.then(() => {
    import("../firebase/config.js").then(({ isMock }) => {
      checkMockMode(isMock);
    });
  });
});

// Theme Management
export function initTheme() {
  const themeToggleBtn = document.getElementById("theme-toggle");
  if (!themeToggleBtn) return;

  // Apply saved theme immediately from localStorage (no async wait)
  let currentTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  updateThemeIcon(themeToggleBtn, currentTheme);

  // Asynchronously try to sync from user profile (non-blocking)
  getCurrentUser()
    .then((user) => {
      if (user?.settings?.theme && user.settings.theme !== currentTheme) {
        currentTheme = user.settings.theme;
        document.documentElement.setAttribute("data-theme", currentTheme);
        localStorage.setItem("theme", currentTheme);
        updateThemeIcon(themeToggleBtn, currentTheme);
      }
    })
    .catch((err) => {
      console.warn("[AeroClick] Could not restore theme from profile:", err);
    });

  // Attach click listener synchronously — works even before Firebase is ready
  themeToggleBtn.addEventListener("click", async () => {
    const activeTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = activeTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(themeToggleBtn, newTheme);

    try {
      await updateUserSettings({ theme: newTheme });
    } catch (error) {
      // User may not be logged in — silently ignore
    }
  });
}

function updateThemeIcon(btn, theme) {
  if (theme === "light") {
    btn.innerHTML = '<span class="theme-toggle-icon">🌙</span>';
    btn.title = "Switch to Dark Mode";
  } else {
    btn.innerHTML = '<span class="theme-toggle-icon">☀️</span>';
    btn.title = "Switch to Light Mode";
  }
}

// Mobile Navigation
export function initMobileNav() {
  const toggle = document.querySelector(".mobile-nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (toggle && navLinks) {
    toggle.addEventListener("click", () => {
      const isVisible = navLinks.classList.contains("nav-open");
      if (isVisible) {
        navLinks.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      } else {
        navLinks.classList.add("nav-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    // Close nav when a link is clicked (mobile UX)
    navLinks.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }
}

// Alert Toast System
export function showToast(message, type = "info") {
  let container = document.querySelector(".alert-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "alert-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `alert-toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="alert-close">&times;</button>
  `;

  container.appendChild(toast);

  const closeBtn = toast.querySelector(".alert-close");
  closeBtn.addEventListener("click", () => {
    toast.remove();
  });

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.transform = "translateX(120%)";
    toast.style.transition = "transform 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Injects mock mode banner to prompt developer
function checkMockMode(isMockValue) {
  if (isMockValue && !document.querySelector(".mock-banner")) {
    const isInSubdir = window.location.pathname.includes("/html/");
    const legalPath = isInSubdir ? "legal.html#contact" : "html/legal.html#contact";

    const banner = document.createElement("div");
    banner.className = "mock-banner";
    banner.innerHTML = `
      <span>⚡ Running in <strong>Local Offline Mode</strong> (Firebase configuration uses placeholders). Your stats will save locally in your browser.</span>
      <button onclick="window.location.href='${legalPath}'">How to set up database?</button>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
  }
}
