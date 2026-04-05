export type AppTheme = "light" | "dark"

export const APP_THEME_STORAGE_KEY = "stack.theme"

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark"
}

export function getOppositeAppTheme(theme: AppTheme): AppTheme {
  return theme === "dark" ? "light" : "dark"
}

export function resolveAppTheme(storedTheme: unknown, _prefersDark: boolean): AppTheme {
  if (isAppTheme(storedTheme)) {
    return storedTheme
  }

  return "dark"
}

export function getThemeToggleLabel(theme: AppTheme) {
  return getOppositeAppTheme(theme).toUpperCase()
}

/**
 * Runs before hydration so the active theme can be resolved without exposing
 * storage and media-query details to the layout component.
 */
export function buildThemeInitScript() {
  return `(() => {
    const storageKey = ${JSON.stringify(APP_THEME_STORAGE_KEY)};
    const root = document.documentElement;

    try {
      const storedTheme = window.localStorage.getItem(storageKey);
      const theme = storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : "dark";

      root.dataset.theme = theme;
      root.style.colorScheme = theme;
    } catch {
      root.dataset.theme = "dark";
      root.style.colorScheme = "dark";
    }
  })();`
}
