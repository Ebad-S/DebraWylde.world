import { runForecastEngine } from "../core/engine/index.js";

export function runLenient(canonicalState) {
  return runForecastEngine(canonicalState, { mode: "lenient" });
}

export function runStrict(canonicalState) {
  return runForecastEngine(canonicalState, { mode: "strict" });
}
