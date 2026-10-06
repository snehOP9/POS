import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type Theme = "light" | "dark";

const storageKey = "emberserve.theme";

const getStoredTheme = (): Theme => {
  try {
    return window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // Private browsing can deny storage; the in-memory preference still works.
  }
};

export const ThemeToggle = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const changeTheme = () => {
    const nextTheme: Theme = isDark ? "light" : "dark";
    const canAnimate = "startViewTransition" in document
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const button = buttonRef.current;

    if (!canAnimate || !button) {
      setTheme(nextTheme);
      return;
    }

    const { x, y, width, height } = button.getBoundingClientRect();
    const startX = x + width / 2;
    const startY = y + height / 2;
    const endRadius = Math.hypot(Math.max(startX, innerWidth - startX), Math.max(startY, innerHeight - startY));
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(nextTheme));
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${startX}px ${startY}px)`, `circle(${endRadius}px at ${startX}px ${startY}px)`] },
        { duration: 430, easing: "cubic-bezier(.2, .75, .25, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => undefined);
  };

  return <button
    ref={buttonRef}
    className="theme-toggle"
    type="button"
    aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
    aria-pressed={isDark}
    title={`Switch to ${isDark ? "light" : "dark"} theme`}
    onClick={changeTheme}
  >
    <Sun aria-hidden="true" className="theme-toggle__sun" size={18} strokeWidth={2.2} />
    <Moon aria-hidden="true" className="theme-toggle__moon" size={17} strokeWidth={2.2} />
    <span className="sr-only">Use {isDark ? "light" : "dark"} theme</span>
  </button>;
};
