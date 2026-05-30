export function computeEma(bars, period) {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  const closes = bars.map((b) => b.close);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [{ time: bars[period - 1].date, value: ema }];
  for (let i = period; i < bars.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out.push({ time: bars[i].date, value: ema });
  }
  return out;
}

export function computeSma(bars, period) {
  if (bars.length < period) return [];
  const closes = bars.map((b) => b.close);
  let sum = closes.slice(0, period).reduce((a, b) => a + b, 0);
  const out = [{ time: bars[period - 1].date, value: sum / period }];
  for (let i = period; i < closes.length; i++) {
    sum += closes[i] - closes[i - period];
    out.push({ time: bars[i].date, value: sum / period });
  }
  return out;
}

export function computeMaSeries(bars, period, maType = "ema") {
  return maType === "sma" ? computeSma(bars, period) : computeEma(bars, period);
}

export function maByDate(bars, period, maType = "ema") {
  return new Map(computeMaSeries(bars, period, maType).map((p) => [p.time, p.value]));
}
