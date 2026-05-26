export type Theme = "dark" | "light";

const STORAGE_KEY = "asa-acars.theme";

export function getInitialTheme(): Theme {
  return "dark"; // Stratos design is strictly dark mode
}

export function applyTheme(_theme: Theme): void {
  document.documentElement.dataset.theme = "dark";
  localStorage.setItem(STORAGE_KEY, "dark");
}
