// ============================================================
// Smart Stitch AI - front-end logic
// Talks to the Flask backend at /api (AI chat agent) and
// /recommend (plain catalog filter used by the quiz + hero box).
// ============================================================

const STORAGE_KEY = "smartStitchProfile";

// ---------- shared helpers ----------

async function askAI(message, history = []) {
  const res = await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong talking to the AI.");
  }
  return data.reply;
}

async function fetchRecommendations({ style, budget, color, category } = {}) {
  const res = await fetch("/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ style, budget, color, category }),
  });
  if (!res.ok) return [];
  return res.json();
}

function renderProductCard(product) {
  const stars = "★".repeat(product.durability) + "☆".repeat(5 - product.durability);
  return `
    <div class="result">
      <i class="fas fa-shirt"></i>
      <h3>${product.name}</h3>
      <p>${product.brand} • $${product.price}</p>
      <p>${stars} durability</p>
    </div>
  `;
}

// ============================================================
// AI Stylist chat page
// ============================================================

function initChat() {
  const chatBox = document.getElementById("chatBox");
  const input = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  if (!chatBox || !input || !sendButton) return;

  // Keep a light running history so the AI has conversational context
  const history = [];

  function addMessage(role, text) {
    const wrapper = document.createElement("div");
    wrapper.className = role === "user" ? "ai-message user-message" : "ai-message";
    wrapper.innerHTML = `<strong>${role === "user" ? "You" : "Smart Stitch AI"}</strong><p></p>`;
    wrapper.querySelector("p").textContent = text;
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
    return wrapper;
  }

  async function send(text) {
    const message = (text ?? input.value).trim();
    if (!message) return;

    input.value = "";
    addMessage("user", message);
    history.push({ role: "user", content: message });

    const thinking = addMessage("assistant", "Thinking...");

    try {
      const reply = await askAI(message, history.slice(0, -1));
      thinking.querySelector("p").textContent = reply;
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      thinking.querySelector("p").textContent =
        "Sorry, I couldn't reach the AI just now (" + err.message + ").";
    }
  }

  sendButton.addEventListener("click", () => send());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  document.querySelectorAll(".quick-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      // strip the leading emoji for a cleaner message to the AI
      const text = btn.textContent.trim().replace(/^\S+\s*/, "");
      send(text);
      window.scrollTo({ top: chatBox.offsetTop - 40, behavior: "smooth" });
    });
  });
}

// ============================================================
// Home page hero "Ask Smart Stitch AI" box
// ============================================================

function initHeroBox() {
  const input = document.getElementById("heroInput");
  const button = document.getElementById("heroAskButton");
  const answer = document.getElementById("heroAnswer");
  if (!input || !button || !answer) return;

  async function ask() {
    const message = input.value.trim();
    if (!message) return;
    answer.textContent = "Thinking...";
    try {
      const reply = await askAI(message);
      answer.textContent = reply;
    } catch (err) {
      answer.textContent = "Couldn't reach the AI: " + err.message;
    }
  }

  button.addEventListener("click", ask);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") ask();
  });
}

// ============================================================
// Style Quiz page
// ============================================================

function initQuiz() {
  const form = document.getElementById("quizForm");
  if (!form) return;

  const resultsSection = document.getElementById("resultsSection");
  const resultsGrid = document.getElementById("resultsGrid");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);

    const style = data.get("style") || "";
    const budget = data.get("budget") || "";
    const colors = data.getAll("color");
    const brands = data.getAll("brand");
    const priority = data.get("priority") || "";

    const profile = {
      style: style || "Not set",
      budget: budget ? `Up to $${budget}` : "Not set",
      brands: brands.length ? brands.join(", ") : "Not set",
      quality: priority === "Quality" || priority === "Price" ? priority : "Balanced",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

    const submitBtn = form.querySelector(".submit-btn");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Generating...";
    submitBtn.disabled = true;

    const items = await fetchRecommendations({
      style,
      budget,
      color: colors[0] || "",
    });

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    resultsGrid.innerHTML = items.length
      ? items.map(renderProductCard).join("")
      : "<p>No exact matches yet - try the AI Stylist chat for more flexible suggestions!</p>";
    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth" });
  });
}

// ============================================================
// Profile page
// ============================================================

function initProfile() {
  const styleEl = document.getElementById("profileStyle");
  if (!styleEl) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const profile = JSON.parse(saved);
    document.getElementById("profileStyle").textContent = profile.style;
    document.getElementById("profileBudget").textContent = profile.budget;
    document.getElementById("profileBrands").textContent = profile.brands;
    document.getElementById("profileQuality").textContent = profile.quality;

    const activity = document.getElementById("activitySection");
    if (activity) {
      activity.innerHTML = "<p>You completed the Style Quiz. Head to the AI Stylist for picks tailored to you!</p>";
    }
  } catch (err) {
    console.error("Could not read saved profile", err);
  }
}

// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initChat();
  initHeroBox();
  initQuiz();
  initProfile();
});
