import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGEVIEWS_PATH = path.join(__dirname, "..", "..", "data", "pageviews.json");

const BOT_UA =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|bingpreview/i;

function isBotUserAgent(ua) {
  return typeof ua === "string" && BOT_UA.test(ua);
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function incrementPageview(userAgent) {
  if (isBotUserAgent(userAgent)) return;

  const date = todayKey();
  let counts = {};

  try {
    const raw = await readFile(PAGEVIEWS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      counts = parsed;
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  counts[date] = (Number(counts[date]) || 0) + 1;
  await mkdir(path.dirname(PAGEVIEWS_PATH), { recursive: true });
  await writeFile(PAGEVIEWS_PATH, `${JSON.stringify(counts, null, 2)}\n`);
}
