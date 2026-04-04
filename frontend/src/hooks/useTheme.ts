import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  type ResolvedTheme,
  type ThemePreference,
  applyTheme,
  getStoredPreference,
  resolveTheme,
  storePreference,
} from "@/lib/theme";

let listeners: Array<() => void> = [];
let current: { preference: ThemePreference; resolved: ResolvedTheme } = (() => {
  const pref = getStoredPreference();
  return { preference: pref, resolved: resolveTheme(pref) };
})();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return current;
}

export function useTheme() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    applyTheme(state.resolved);
  }, [state.resolved]);

  useEffect(() => {
    if (state.preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const resolved = resolveTheme("system");
      current = { preference: "system", resolved };
      applyTheme(resolved);
      notify();
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [state.preference]);

  const setTheme = useCallback((pref: ThemePreference) => {
    storePreference(pref);
    const resolved = resolveTheme(pref);
    current = { preference: pref, resolved };
    applyTheme(resolved);
    notify();
  }, []);

  return {
    preference: state.preference,
    resolved: state.resolved,
    isDark: state.resolved === "dark",
    setTheme,
  };
}
