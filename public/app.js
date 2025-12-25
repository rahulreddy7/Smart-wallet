const categoryOptions = [
  "dining",
  "groceries",
  "travel",
  "gas",
  "online",
  "transit",
  "other",
];

const form = document.getElementById("transactionForm");
const recommendation = document.getElementById("recommendation");
const cardList = document.getElementById("cardList");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");
const copyDetailsButton = document.getElementById("copyDetails");
const handoffButton = document.getElementById("handoffButton");
const platformLabel = document.getElementById("platformLabel");
const cardForm = document.getElementById("cardForm");
const defaultWalletButton = document.getElementById("defaultWalletButton");
const defaultWalletStatus = document.getElementById("defaultWalletStatus");
const autofillPreview = document.getElementById("autofillPreview");
const merchantAppSelect = document.getElementById("merchantApp");

let lastRecommendation = null;
let platform = "desktop";
let apps = [];

const detectPlatform = () => {
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes("android")) {
    return "android";
  }
  if (agent.includes("iphone") || agent.includes("ipad")) {
    return "apple";
  }
  return "desktop";
};

const apiFetch = async (path, options) => {
  const response = await fetch(path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }
  return response.json();
};

const buildCardTile = (card) => {
  const utilizationPercent = Math.round(card.utilization * 100);
  const wallets = card.supportedWallets?.length ? card.supportedWallets.join(", ") : "None";
  const offers = card.offers?.length ? card.offers.join(", ") : "No offers";

  return `
    <div class="card-tile">
      <strong>${card.name}</strong>
      <span>${card.network}</span>
      <span class="tag">${card.baseRate}x base</span>
      <span>Utilization: ${utilizationPercent}% of $${card.limit.toLocaleString()}</span>
      <span>Mandatory tx left: ${card.mandatoryTransactionsLeft}</span>
      <span>Statement due in ${card.statementDueInDays} days</span>
      <span>Wallets: ${wallets}</span>
      <span>Offers: ${offers}</span>
    </div>
  `;
};

const renderCards = (cards) => {
  cardList.innerHTML = cards.map(buildCardTile).join("");
};

const renderRecommendation = (result) => {
  const { topChoice, fallback, warnings, prioritizeMandatory, autofill } = result;
  if (!topChoice) {
    recommendation.innerHTML = "<p>No eligible card found.</p>";
    return;
  }

  const top = topChoice.card;
  const effectiveRate = (topChoice.score / result.input.amount).toFixed(2);
  const fallbackName = fallback?.card?.name || "None";
  const warningList = warnings.length
    ? `<ul>${warnings.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : "<p>No warnings.</p>";

  recommendation.innerHTML = `
    <h3>${top.name}</h3>
    <p><strong>${result.input.category.toUpperCase()}</strong> · $${result.input.amount}</p>
    <p>Merchant: ${result.input.merchant || "Auto-detected"}</p>
    <p>Location: ${result.input.location || "Network assisted"}</p>
    <ul>
      <li>Effective rewards: ${effectiveRate}x</li>
      <li>Mandatory spend priority: ${prioritizeMandatory ? "Enabled" : "Rewards first"}</li>
      <li>Fallback: ${fallbackName}</li>
    </ul>
    ${warningList}
  `;

  lastRecommendation = top;
  copyDetailsButton.disabled = false;
  handoffButton.disabled = false;
  autofillPreview.innerHTML = autofill
    ? `
      <h4>Autofill Preview</h4>
      <p>${autofill.cardName} · ${autofill.network}</p>
      <p>${autofill.maskedPan} · ${autofill.expiry}</p>
    `
    : "<p>No autofill data available.</p>";
};

const loadCards = async () => {
  const { cards } = await apiFetch("/api/cards");
  renderCards(cards);
  return cards;
};

const loadRules = async () => {
  const { rules } = await apiFetch("/api/rules");
  return rules;
};

const loadApps = async () => {
  const response = await apiFetch("/api/apps");
  apps = response.apps;
  merchantAppSelect.innerHTML = [
    "<option value=\"\">None</option>",
    ...apps.map((app) => `<option value=\"${app.id}\">${app.name}</option>`),
  ].join("");
};

const populateCategories = () => {
  const categorySelect = document.getElementById("category");
  categorySelect.innerHTML = categoryOptions
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");
};

const applyMerchantAppPreset = () => {
  const selectedApp = apps.find((app) => app.id === merchantAppSelect.value);
  if (selectedApp) {
    document.getElementById("category").value = selectedApp.category;
  }
};

const handleRecommendation = async (event) => {
  event.preventDefault();
  const payload = {
    amount: Number(document.getElementById("amount").value || 0),
    category: document.getElementById("category").value,
    merchant: document.getElementById("merchant").value.trim(),
    merchantApp: merchantAppSelect.value,
    location: document.getElementById("location").value.trim(),
    gpsUnavailable: document.getElementById("gpsUnavailable").checked,
    usingOtherApp: document.getElementById("usingOtherApp").checked,
    platform,
  };

  try {
    const { recommendation: result } = await apiFetch("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    renderRecommendation(result);
  } catch (error) {
    recommendation.innerHTML = `<p class=\"tag\">${error.message}</p>`;
  }
};

const handleAddCard = async (event) => {
  event.preventDefault();
  const offers = document.getElementById("offers").value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const walletSupport = Array.from(document.getElementById("walletSupport").selectedOptions)
    .map((option) => option.value);

  let categoryRates = {};
  const rawCategoryRates = document.getElementById("categoryRates").value.trim();
  if (rawCategoryRates) {
    try {
      categoryRates = JSON.parse(rawCategoryRates);
    } catch (error) {
      alert("Category rates must be valid JSON.");
      return;
    }
  }

  const payload = {
    name: document.getElementById("cardName").value.trim(),
    network: document.getElementById("network").value.trim(),
    baseRate: Number(document.getElementById("baseRate").value || 1),
    utilization: Number(document.getElementById("utilization").value || 0),
    limit: Number(document.getElementById("limit").value || 0),
    statementDueInDays: Number(document.getElementById("statementDue").value || 0),
    mandatoryTransactionsLeft: Number(document.getElementById("mandatoryTransactions").value || 0),
    categoryRates,
    offers,
    supportedWallets: walletSupport,
    aprSensitive: document.getElementById("aprSensitive").checked,
    foreignTxFee: document.getElementById("foreignTxFee").checked,
    requiresTapToPay: document.getElementById("requiresTapToPay").checked,
  };

  try {
    await apiFetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    cardForm.reset();
    await loadCards();
  } catch (error) {
    alert(error.message);
  }
};

syncButton.addEventListener("click", () => {
  syncStatus.textContent = "Wallet Sync: Connected · Cards imported";
  syncButton.textContent = "Re-sync Wallets";
});

defaultWalletButton.addEventListener("click", () => {
  const enabled = defaultWalletStatus.dataset.enabled === "true";
  if (!enabled) {
    defaultWalletStatus.textContent = "Status: Enabled as default wallet";
    defaultWalletStatus.dataset.enabled = "true";
    defaultWalletButton.textContent = "Disable Default Wallet";
  } else {
    defaultWalletStatus.textContent = "Status: Not enabled";
    defaultWalletStatus.dataset.enabled = "false";
    defaultWalletButton.textContent = "Enable as Default Wallet";
  }
});

copyDetailsButton.addEventListener("click", async () => {
  if (!lastRecommendation) {
    return;
  }

  const payload = `${lastRecommendation.name} · ${lastRecommendation.network} · Rewards optimized`;
  try {
    await navigator.clipboard.writeText(payload);
    copyDetailsButton.textContent = "Copied!";
    setTimeout(() => {
      copyDetailsButton.textContent = "Copy Autofill Card Details";
    }, 2000);
  } catch (error) {
    copyDetailsButton.textContent = "Clipboard blocked";
  }
});

handoffButton.addEventListener("click", () => {
  if (!lastRecommendation) {
    return;
  }
  handoffButton.textContent = `Sent ${lastRecommendation.name} to OS wallet`;
  setTimeout(() => {
    handoffButton.textContent = "Send to OS Wallet Handoff";
  }, 2000);
});

form.addEventListener("submit", handleRecommendation);
cardForm.addEventListener("submit", handleAddCard);
merchantAppSelect.addEventListener("change", applyMerchantAppPreset);

const init = async () => {
  platform = detectPlatform();
  platformLabel.textContent = platform;
  populateCategories();
  await Promise.all([loadCards(), loadRules(), loadApps()]);
  applyMerchantAppPreset();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js");
  }
};

init();
