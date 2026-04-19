function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pathToSegments(path) {
  return String(path)
    .split(".")
    .map((segment) => (segment.match(/^\d+$/) ? Number(segment) : segment));
}

function setByPath(target, path, value) {
  const segments = pathToSegments(path);
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const next = segments[i + 1];
    if (cursor[key] == null) {
      cursor[key] = typeof next === "number" ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[segments[segments.length - 1]] = value;
}

export function createStateStore(initialCanonicalState, initialStepId = "intro") {
  const listeners = new Set();
  const initialStepIndex = Math.max(0, Number(initialStepId) || 0);
  let state = {
    data: clone(initialCanonicalState),
    currentStep: initialStepIndex,
    visitedSteps: [initialStepIndex],
    meta: {
      dirty: false,
      lastSavedAt: null,
      engine: {
        lenient: null,
        strict: null,
        running: false
      }
    }
  };

  function emit() {
    listeners.forEach((listener) => listener(getState()));
  }

  function getState() {
    return clone(state);
  }

  function patch(mutator) {
    const draft = clone(state);
    mutator(draft);
    draft.data.meta.updatedAt = new Date().toISOString();
    state = draft;
    emit();
  }

  return {
    getState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setStep(stepIndex) {
      patch((draft) => {
        const safeIndex = Math.max(0, Number(stepIndex) || 0);
        draft.currentStep = safeIndex;
        if (!draft.visitedSteps.includes(safeIndex)) {
          draft.visitedSteps.push(safeIndex);
        }
      });
    },
    updateField(path, value) {
      patch((draft) => {
        setByPath(draft.data, path, value);
        draft.meta.dirty = true;
      });
    },
    mutateCanonical(mutator) {
      patch((draft) => {
        mutator(draft.data);
        draft.meta.dirty = true;
      });
    },
    setEngineRunning(running) {
      patch((draft) => {
        draft.meta.engine.running = Boolean(running);
      });
    },
    setEngineResult(mode, result) {
      patch((draft) => {
        draft.meta.engine[mode] = result;
      });
    },
    markSaved() {
      patch((draft) => {
        draft.meta.dirty = false;
        draft.meta.lastSavedAt = new Date().toISOString();
      });
    },
    hydrateSavedState(savedPayload) {
      patch((draft) => {
        draft.data = clone(savedPayload.data || savedPayload.canonical || draft.data);
        const savedStep = Number(savedPayload.currentStep ?? savedPayload.currentStepId);
        draft.currentStep = Number.isFinite(savedStep) && savedStep >= 0 ? savedStep : draft.currentStep;
        draft.visitedSteps = Array.isArray(savedPayload.visitedSteps) && savedPayload.visitedSteps.length
          ? savedPayload.visitedSteps.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0)
          : [draft.currentStep];
        if (!draft.visitedSteps.includes(draft.currentStep)) {
          draft.visitedSteps.push(draft.currentStep);
        }
        draft.meta.lastSavedAt = savedPayload.savedAt || null;
        draft.meta.dirty = false;
      });
    }
  };
}
