import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ENTRY_FILTER_MODEL_PATH = path.join(
  __dirname,
  "..",
  "data",
  "entry-filter-model.json"
);

export function loadEntryFilterModel(modelPath = ENTRY_FILTER_MODEL_PATH) {
  if (!existsSync(modelPath)) return null;
  return JSON.parse(readFileSync(modelPath, "utf8"));
}
