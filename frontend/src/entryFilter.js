import {
  buildEntryFeatures,
  featureVector,
  FEATURE_NAMES,
} from "./entryFeatures.js";
import { DEFAULT_REGIME, passesRegimeGate } from "./regimeGate.js";

function sigmoid(z) {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function normalizeFeatures(raw, model) {
  const means = model.means ?? [];
  const stds = model.stds ?? [];
  return raw.map((v, i) => {
    const s = stds[i] || 1;
    return s > 1e-9 ? (v - (means[i] ?? 0)) / s : 0;
  });
}

export function predictWinProb(features, model) {
  if (!model?.weights) return 0.5;
  const raw = featureVector(features);
  const x = normalizeFeatures(raw, model);
  let z = model.weights.bias ?? 0;
  for (let i = 0; i < x.length; i++) {
    z += x[i] * (model.weights[FEATURE_NAMES[i]] ?? 0);
  }
  return sigmoid(z);
}

export function shouldAllowEntry(features, { model = null, regime = DEFAULT_REGIME } = {}) {
  if (!passesRegimeGate(features, regime)) return false;
  if (!model) return true;
  const threshold = model.threshold ?? 0.5;
  return predictWinProb(features, model) >= threshold;
}

export function createEntryAllowFn(model = null, regime = DEFAULT_REGIME) {
  return function allowEntry({ bars, barIndex, eFast, eSlow, maSlow }) {
    const features = buildEntryFeatures(bars, barIndex, eFast, eSlow, maSlow);
    return shouldAllowEntry(features, { model, regime });
  };
}

export function trainLogistic(samples, { epochs = 300, lr = 0.1 } = {}) {
  const dim = FEATURE_NAMES.length;
  const means = new Array(dim).fill(0);
  const stds = new Array(dim).fill(1);

  for (let j = 0; j < dim; j++) {
    let sum = 0;
    let sumSq = 0;
    for (const s of samples) {
      sum += s.x[j];
      sumSq += s.x[j] * s.x[j];
    }
    means[j] = sum / samples.length;
    const variance = sumSq / samples.length - means[j] * means[j];
    stds[j] = Math.sqrt(Math.max(variance, 1e-6));
  }

  const xs = samples.map((s) => ({
    y: s.y,
    x: s.x.map((v, j) => (v - means[j]) / stds[j]),
  }));

  const weights = { bias: 0 };
  for (const name of FEATURE_NAMES) weights[name] = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const { x, y } of xs) {
      let z = weights.bias;
      for (let j = 0; j < dim; j++) {
        z += x[j] * weights[FEATURE_NAMES[j]];
      }
      const err = sigmoid(z) - y;
      weights.bias -= lr * err;
      for (let j = 0; j < dim; j++) {
        weights[FEATURE_NAMES[j]] -= lr * err * x[j];
      }
    }
  }

  return { weights, means, stds, threshold: 0.5, featureNames: FEATURE_NAMES };
}
