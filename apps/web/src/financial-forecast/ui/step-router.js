export const STEP_DEFINITIONS = [
  { id: "intro", title: "Get Started" },
  { id: "setup", title: "Business Setup" },
  { id: "sales-details", title: "Revenue Streams" },
  { id: "collections", title: "Collections" },
  { id: "year-1", title: "Year 1 Plan" },
  { id: "year-2", title: "Year 2 Plan" },
  { id: "year-3", title: "Year 3 Plan" },
  { id: "assets-loans", title: "Assets & Finance" },
  { id: "personal", title: "Owner & Personal Inputs" },
  { id: "review", title: "Review" },
  { id: "results", title: "Results Dashboard" }
];

export function getStepIndex(stepId) {
  return STEP_DEFINITIONS.findIndex((step) => step.id === stepId);
}

export function getStepByIndex(index) {
  if (index < 0 || index >= STEP_DEFINITIONS.length) return STEP_DEFINITIONS[0];
  return STEP_DEFINITIONS[index];
}

export function getStepById(stepId) {
  return STEP_DEFINITIONS.find((step) => step.id === stepId) || STEP_DEFINITIONS[0];
}

export function getPreviousStepId(stepId) {
  const currentIndex = getStepIndex(stepId);
  if (currentIndex <= 0) return stepId;
  return STEP_DEFINITIONS[currentIndex - 1].id;
}

export function getNextStepId(stepId) {
  const currentIndex = getStepIndex(stepId);
  if (currentIndex < 0 || currentIndex >= STEP_DEFINITIONS.length - 1) return stepId;
  return STEP_DEFINITIONS[currentIndex + 1].id;
}

export function getPreviousStepIndex(index) {
  return Math.max(0, index - 1);
}

export function getNextStepIndex(index) {
  return Math.min(STEP_DEFINITIONS.length - 1, index + 1);
}
