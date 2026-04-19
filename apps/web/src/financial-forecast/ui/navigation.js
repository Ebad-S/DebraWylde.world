import { STEP_DEFINITIONS } from "./step-router.js";

function stepItemClass(isActive, status) {
  if (isActive) return "is-active";
  if (status?.complete) return "is-completed";
  return "is-inactive";
}

export function renderSidebar(currentStepIndex, stepStatusMap, companyName) {
  const progressPct = ((currentStepIndex + 1) / STEP_DEFINITIONS.length) * 100;
  const stepList = STEP_DEFINITIONS.map((step, index) => {
    const status = stepStatusMap[step.id];
    return `
      <button class="ff-sidebar-step ${stepItemClass(index === currentStepIndex, status)}" data-action="go-step" data-step-index="${index}">
        <span class="ff-sidebar-step__number">${index + 1}</span>
        <span class="ff-sidebar-step__name">${step.title}</span>
        ${status?.complete ? `<span class="ff-sidebar-step__badge">Completed</span>` : ""}
      </button>
    `;
  }).join("");

  return `
    <aside class="ff-sidebar" aria-label="Forecast steps">
      <div class="ff-company-card">
        <p class="ff-company-card__label">Company Name</p>
        <p class="ff-company-card__name">${companyName || "Set Company Name"}</p>
      </div>
      <div class="ff-progress-wrap">
        <p class="ff-progress-meta">Step ${currentStepIndex + 1} of ${STEP_DEFINITIONS.length}</p>
        <div class="ff-progress-line"><span style="width:${progressPct}%;"></span></div>
      </div>
      <div class="ff-sidebar-steps">${stepList}</div>
    </aside>
  `;
}
