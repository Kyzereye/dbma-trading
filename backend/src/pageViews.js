import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_VIEWS_PATH = path.join(__dirname, "..", "..", "data", "pageviews.json");

const BOT_UA =
  /bot|crawler|spider|slurp|googlebot|bingbot|yandex|baidu|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|discordbot|slackbot|telegrambot|whatsapp|curl\/|wget\/|python-requests|scrapy|headlesschrome|puppeteer|phantomjs|semrush|ahrefs|petalbot|bytespider/i;

function isObviousBot(userAgent) {
  const ua = String(userAgent ?? "").trim();
  if (ua.length < 20) return true;
  return BOT_UA.test(ua);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function readCounts() {
  try {
    const raw = await readFile(PAGE_VIEWS_PATH, "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

/** Increment today's count when user accepts the disclaimer. No PII stored. */
export async function recordDisclaimerAccept(userAgent) {
  if (isObviousBot(userAgent)) return;
  const date = todayDate();
  const counts = await readCounts();
  counts[date] = (Number(counts[date]) || 0) + 1;
  await mkdir(path.dirname(PAGE_VIEWS_PATH), { recursive: true });
  await writeFile(PAGE_VIEWS_PATH, `${JSON.stringify(counts, null, 2)}\n`);
}
