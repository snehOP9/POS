import { Moon, Sun } from "lucide-react";
import { useRef } from "react";
import { flushSync } from "react-dom";
import { useThemePreference, type ThemePreference } from "@/shared/lib/theme-preference";

export const ThemeToggle = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { resolvedTheme, setPreference } = useThemePreference();
  const isDark = resolvedTheme === "dark";

  const changeTheme = () => {
    const nextTheme: ThemePreference = isDark ? "light" : "dark";
    const canAnimate = "startViewTransition" in document
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const button = buttonRef.current;

    if (!canAnimate || !button) {
      setPreference(nextTheme);
      return;
    }

    const { x, y, width, height } = button.getBoundingClientRect();
    const startX = x + width / 2;
    const startY = y + height / 2;
    const endRadius = Math.hypot(Math.max(startX, innerWidth - startX), Math.max(startY, innerHeight - startY));
    const transition = document.startViewTransition(() => {
      flushSync(() => setPreference(nextTheme));
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
