/**
 * CLI wrapper — same logic as UI (frontend/src/optimizeMa.js).
 *
 *   npm run optimize:ma -- AAPL
 */

import { formatPct, optimizeMa } from "../frontend/src/optimizeMa.js";

const API_BASE = process.env.API_BASE || "http://localhost:3001";

function parseArgs(argv) {
  const args = argv.slice(2);
  let symbol = "AAPL";
  let api = API_BASE;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api" && args[i + 1]) {
      api = args[++i];
    } else if (!args[i].startsWith("-")) {
      symbol = args[i].toUpperCase();
    }
  }
  return { symbol, api };
}

function pad(s, n) {
  return String(s).padStart(n);
}

async function main() {
  const { symbol, api } = parseArgs(process.argv);
  const url = `${api.replace(/\/$/, "")}/api/daily-stock-data?symbol=${encodeURIComponent(symbol)}`;

  let payload;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API error ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    payload = await res.json();
  } catch (err) {
    console.error(`Failed to fetch ${url}\n${err.message || err}`);
    console.error("\nStart the backend: npm run dev");
    process.exit(1);
  }

  const bars = payload.data || [];
  if (!bars.length) {
    console.error(`No bars for ${symbol}`);
    process.exit(1);
  }

  const { top, baseline, totalPairs, from, to, barCount } = optimizeMa(bars);

  console.log(`\nSMA optimization — ${symbol}`);
  console.log(`Bars: ${barCount} (${from} → ${to})`);
  console.log(`Rank: min(3y, 1y return) — top 3\n`);

  const header = " rank  fast  slow     3y      1y    min   tr3y  tr1y";
  console.log(header);
  console.log("-".repeat(header.length));

  if (!top.length) {
    console.log("No parameter pairs passed minimum trade counts.");
    process.exit(0);
  }

  top.forEach((row, i) => {
    console.log(
      `${pad(i + 1, 5)}  ${pad(row.fast, 4)}  ${pad(row.slow, 4)}  ${formatPct(row.r3y).padStart(7)}  ${formatPct(row.r1y).padStart(7)}  ${formatPct(row.minReturn).padStart(7)}  ${pad(row.n3y, 4)}  ${pad(row.n1y, 4)}`
    );
  });

  console.log("\nDefault 21 / 50:");
  if (baseline) {
    console.log(
      `  rank #${baseline.rank} of ${totalPairs} | 3y ${formatPct(baseline.r3y)} | 1y ${formatPct(baseline.r1y)} | min ${formatPct(baseline.minReturn)}`
    );
  } else {
    console.log("  (did not meet minimum trade counts in all windows)");
  }

  console.log(`\n${totalPairs} pairs tested.\n`);
}

main();
