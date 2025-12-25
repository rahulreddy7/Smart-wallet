import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "..", "data", "cards.json");

const readJson = async () => {
  const file = await fs.readFile(dataPath, "utf-8");
  return JSON.parse(file);
};

const writeJson = async (data) => {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
};

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export const getCards = async () => readJson();

export const addCard = async (card) => {
  const cards = await readJson();
  const id = slugify(card.name || "card");
  const nextCard = {
    id,
    name: card.name,
    network: card.network,
    baseRate: Number(card.baseRate || 1),
    categoryRates: card.categoryRates || {},
    offers: card.offers || [],
    utilization: Number(card.utilization || 0),
    limit: Number(card.limit || 0),
    mandatoryTransactionsLeft: Number(card.mandatoryTransactionsLeft || 0),
    statementDueInDays: Number(card.statementDueInDays || 0),
    aprSensitive: Boolean(card.aprSensitive),
    foreignTxFee: Boolean(card.foreignTxFee),
    supportedWallets: card.supportedWallets || [],
    requiresTapToPay: Boolean(card.requiresTapToPay),
    panLast4: card.panLast4 || "0000",
    expiry: card.expiry || "01/30",
  };

  cards.push(nextCard);
  await writeJson(cards);
  return nextCard;
};
