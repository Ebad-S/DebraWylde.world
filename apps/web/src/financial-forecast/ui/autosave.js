const STORAGE_KEY = "dw_forecast_phase4_v1";

export function loadAutosave(storage = window.localStorage) {
  try {
    const payload = storage.getItem(STORAGE_KEY);
    if (!payload) return null;
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosave(storage = window.localStorage) {
  storage.removeItem(STORAGE_KEY);
}

export function createAutosave(store, debounceMs = 400, storage = window.localStorage, getExtraState = null) {
  let timeoutId = null;

  function writeNow() {
    const snapshot = store.getState();
    if (!snapshot.meta?.dirty) return;
    const payload = {
      version: 2,
      savedAt: new Date().toISOString(),
      currentStep: snapshot.currentStep,
      visitedSteps: snapshot.visitedSteps,
      data: snapshot.data,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };
    if (typeof getExtraState === "function") {
      Object.assign(payload, getExtraState(snapshot));
    }
    const beforeX = window.scrollX;
    const beforeY = window.scrollY;
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    store.markSaved();
    console.debug("[ff] autosave persisted", { currentStep: payload.currentStep, scrollY: payload.scrollY });
    window.scrollTo(beforeX, beforeY);
  }

  function scheduleSave() {
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(writeNow, debounceMs);
  }

  function flushSave() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    writeNow();
  }

  function onBeforeUnload() {
    flushSave();
  }

  function onVisibility() {
    if (document.visibilityState === "hidden") {
      flushSave();
    }
  }

  function onFocus() {
    if (store.getState().meta?.dirty) {
      scheduleSave();
    }
  }

  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onFocus);

  return {
    scheduleSave,
    flushSave,
    dispose() {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };
}
