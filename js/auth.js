// Authentication Page Controller
import { signUpUser, loginUser, getCurrentUser } from "../firebase/db.js";
import { showToast } from "./main.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Redirect if already logged in
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "setup.html";
    return;
  }

  const tabs = document.querySelectorAll(".auth-tab");
  const formTitle = document.getElementById("form-title");
  const formDesc = document.getElementById("form-desc");
  const submitBtn = document.getElementById("submit-btn");
  const switchPrompt = document.getElementById("switch-prompt");
  const signupInfo = document.getElementById("signup-info");
  const authForm = document.getElementById("auth-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("password-toggle");

  let currentMode = "login"; // 'login' or 'signup'

  // Parse URL query to check if they wanted signup directly
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("signup") === "true") {
    switchMode("signup");
  }

  // Handle Tab swapping
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      switchMode(tab.dataset.tab);
    });
  });

  // Handle Bottom Switch Links via event delegation (avoids duplicate listeners)
  switchPrompt.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      e.preventDefault();
      // Toggle to whichever mode we're NOT currently in
      switchMode(currentMode === "login" ? "signup" : "login");
    }
  });

  // Switch between Login and Signup modes
  function switchMode(mode) {
    currentMode = mode;
    tabs.forEach(t => t.classList.remove("active"));

    if (mode === "signup") {
      document.getElementById("tab-signup").classList.add("active");
      formTitle.innerText = "Create Account";
      formDesc.innerText = "Claim your unique username and start your training path.";
      submitBtn.innerText = "Register & Get Started";
      signupInfo.style.display = "flex";
      switchPrompt.innerHTML = 'Already have an account? <a href="#">Sign In</a>';
      passwordInput.autocomplete = "new-password";
    } else {
      document.getElementById("tab-login").classList.add("active");
      formTitle.innerText = "Welcome Back";
      formDesc.innerText = "Sign in to track your scores, unlock achievements, and climb the ranks.";
      submitBtn.innerText = "Sign In";
      signupInfo.style.display = "none";
      switchPrompt.innerHTML = 'Don\'t have an account? <a href="#">Create Account</a>';
      passwordInput.autocomplete = "current-password";
    }
  }

  // Password Visibility Toggle
  passwordToggle.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      passwordToggle.innerText = "🙈";
    } else {
      passwordInput.type = "password";
      passwordToggle.innerText = "👁️";
    }
  });

  // Sanitize username input in real-time (letters, numbers, underscore)
  usernameInput.addEventListener("input", () => {
    usernameInput.value = usernameInput.value.replace(/[^a-zA-Z0-9_]/g, "");
  });

  // Form Submission
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Client-side validations
    if (username.length < 3) {
      showToast("Username must be at least 3 characters long.", "danger");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters long.", "danger");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = currentMode === "signup" ? "Creating Account..." : "Signing In...";

    try {
      if (currentMode === "signup") {
        await signUpUser(username, password);
        showToast("Account created successfully! Welcome to AeroClick.", "success");
      } else {
        await loginUser(username, password);
        showToast("Logged in successfully! Ready to train.", "success");
      }

      // Redirect with a tiny delay so toast is seen
      setTimeout(() => {
        window.location.href = "setup.html";
      }, 1000);

    } catch (err) {
      showToast(err.message, "danger");
      submitBtn.disabled = false;
      submitBtn.innerText = currentMode === "signup" ? "Register & Get Started" : "Sign In";
    }
  });
});
