import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

const storageKey = "emberserve.theme-preference";
const legacyStorageKey = "emberserve.theme";
const eventName = "emberserve:theme-preference";

const isThemePreference = (value: string | null): value is ThemePreference => value === "light" || value === "dark" || value === "system";

export const getThemePreference = (): ThemePreference => {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (isThemePreference(saved)) return saved;
    const legacy = window.localStorage.getItem(legacyStorageKey);
    if (legacy === "light" || legacy === "dark") return legacy;
  } catch {
    // Storage can be unavailable in private browsing; system is still safe.
  }
  return "system";
};

export const resolveTheme = (preference: ThemePreference): ResolvedTheme => preference === "system"
  ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  : preference;

export const applyThemePreference = (preference: ThemePreference) => {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  try {
    window.localStorage.setItem(storageKey, preference);
    window.localStorage.removeItem(legacyStorageKey);
  } catch {
    // The preference remains active for the current session.
  }
  window.dispatchEvent(new CustomEvent<ThemePreference>(eventName, { detail: preference }));
  return resolved;
};

export const useThemePreference = () => {
  const [preference, setPreferenceState] = useState<ThemePreference>(getThemePreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setResolvedTheme(applyThemePreference(nextPreference));
    setPreferenceState(nextPreference);
  }, []);

  useEffect(() => {
    const sync = (nextPreference = getThemePreference()) => {
      setPreferenceState(nextPreference);
      setResolvedTheme(resolveTheme(nextPreference));
      document.documentElement.dataset.theme = resolveTheme(nextPreference);
      document.documentElement.dataset.themePreference = nextPreference;
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => { if (getThemePreference() === "system") sync("system"); };
    const onPreferenceChange = (event: Event) => sync((event as CustomEvent<ThemePreference>).detail);
    sync();
    media.addEventListener("change", onSystemChange);
    window.addEventListener(eventName, onPreferenceChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener(eventName, onPreferenceChange);
    };
  }, []);

  return { preference, resolvedTheme, setPreference };
};
