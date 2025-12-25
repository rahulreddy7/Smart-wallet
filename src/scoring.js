export const normalizeCategory = (category = "") => category.trim().toLowerCase() || "other";

export const resolveCategory = (input, apps = []) => {
  if (!input?.merchantApp) {
    return normalizeCategory(input?.category || "");
  }
  const appMatch = apps.find((app) => app.id === input.merchantApp);
  return normalizeCategory(appMatch?.category || input.category || "");
};

export const buildAutofillDetails = (card) => ({
  cardName: card.name,
  network: card.network,
  maskedPan: `**** **** **** ${card.panLast4 || "0000"}`,
  expiry: card.expiry || "01/30",
});

const getRateForCategory = (card, category) => {
  const normalized = normalizeCategory(category);
  return card.categoryRates?.[normalized] ?? card.baseRate ?? 1;
};

const getWalletSupportPenalty = (card, platform, rules) => {
  if (!platform) {
    return 1;
  }
  const supports = card.supportedWallets?.includes(platform);
  return supports ? 1 : rules.walletSupportPenalty;
};

export const scoreCard = ({
  card,
  amount,
  category,
  location,
  gpsUnavailable,
  platform,
  usingOtherApp,
  rules,
}) => {
  const rate = getRateForCategory(card, category);
  const rewardValue = amount * rate;
  const utilizationPenalty = card.utilization > rules.utilizationPenalty.threshold
    ? rules.utilizationPenalty.multiplier
    : 1;
  const aprPenalty = card.aprSensitive && card.utilization > rules.aprSensitivePenalty.threshold
    ? rules.aprSensitivePenalty.multiplier
    : 1;
  const locationPenalty = gpsUnavailable || !location
    ? rules.gpsConfidence.gpsUnavailableMultiplier
    : 1;
  const foreignPenalty = card.foreignTxFee && category === "travel"
    ? rules.foreignTxFeePenalty
    : 1;
  const walletPenalty = getWalletSupportPenalty(card, platform, rules);
  const autofillBoost = usingOtherApp ? rules.autofillBoost : 1;

  return {
    score: rewardValue * utilizationPenalty * aprPenalty * locationPenalty * foreignPenalty * walletPenalty * autofillBoost,
    metadata: {
      rate,
      utilizationPenalty,
      aprPenalty,
      locationPenalty,
      foreignPenalty,
      walletPenalty,
      autofillBoost,
    },
  };
};

export const buildRecommendation = ({
  cards,
  input,
  rules,
  apps = [],
}) => {
  const prioritizeMandatory = cards.some(
    (card) => card.mandatoryTransactionsLeft > 0 && card.statementDueInDays <= rules.mandatorySpend.windowDays
  );

  const resolvedCategory = resolveCategory(input, apps);
  const scored = cards.map((card) => {
    const { score, metadata } = scoreCard({
      card,
      amount: input.amount,
      category: resolvedCategory,
      location: input.location,
      gpsUnavailable: input.gpsUnavailable,
      platform: input.platform,
      usingOtherApp: input.usingOtherApp,
      rules,
    });

    const mandatoryBoost = prioritizeMandatory && card.mandatoryTransactionsLeft > 0
      ? rules.mandatorySpend.multiplier
      : 1;

    return {
      card,
      score: score * mandatoryBoost,
      metadata: {
        ...metadata,
        mandatoryBoost,
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const topChoice = scored[0];
  const fallback = scored[1];

  const warnings = [];
  if (topChoice?.card.utilization > rules.fallbackUtilizationThreshold) {
    warnings.push("Top card utilization is high; fallback may be preferred if balance increases.");
  }
  if (input.gpsUnavailable) {
    warnings.push("GPS unavailable; using network/location confidence fallback.");
  }
  if (!input.location) {
    warnings.push("Location missing; merchant categorization relies on historical data.");
  }

  return {
    input: {
      ...input,
      category: resolvedCategory,
    },
    prioritizeMandatory,
    topChoice,
    fallback,
    warnings,
    autofill: topChoice ? buildAutofillDetails(topChoice.card) : null,
  };
};
