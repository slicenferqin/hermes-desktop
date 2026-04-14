import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

const THEME_CHANGE_EVENT = "hermes-theme-change";

function readThemePreference() {
  if (typeof window === "undefined") {
    return false;
  }

  const saved = window.localStorage.getItem("theme");
  if (saved === "dark") {
    return true;
  }
  if (saved === "light") {
    return false;
  }

  if (document.documentElement.classList.contains("dark")) {
    return true;
  }

  return false;
}

function applyThemePreference(isDark: boolean, emit = true) {
  if (typeof window === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", isDark);
  window.localStorage.setItem("theme", isDark ? "dark" : "light");

  if (emit) {
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, {
        detail: { isDark },
      }),
    );
  }
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => readThemePreference());

  useEffect(() => {
    const syncTheme = () => {
      const next = readThemePreference();
      applyThemePreference(next, false);
      setIsDark(next);
    };

    syncTheme();

    window.addEventListener(THEME_CHANGE_EVENT, syncTheme as EventListener);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme as EventListener);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return (
    <button
      onClick={() => {
        const next = !isDark;
        applyThemePreference(next);
        setIsDark(next);
      }}
      className="relative w-14 h-7 rounded-full transition-colors duration-200 flex items-center"
      style={{
        backgroundColor: isDark ? "var(--color-bg-tertiary)" : "var(--color-border)",
      }}
      title={isDark ? "切换到亮色主题" : "切换到暗色主题"}
    >
      <span
        className="absolute w-6 h-6 rounded-full shadow-sm transition-all duration-200 flex items-center justify-center"
        style={{
          backgroundColor: "var(--color-bg)",
          left: isDark ? "2px" : "calc(100% - 26px)",
        }}
      >
        {isDark ? (
          <MoonIcon className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
        ) : (
          <SunIcon className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
        )}
      </span>
    </button>
  );
}
