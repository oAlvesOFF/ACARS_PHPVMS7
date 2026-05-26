import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "../locales/en/common.json";
import deCommon from "../locales/de/common.json";
import itCommon from "../locales/it/common.json";

export const SUPPORTED_LANGUAGES = ["en", "de", "it"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  de: "Deutsch",
  it: "Italiano",
};

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
      de: { common: deCommon },
      it: { common: itCommon },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });

// Force language in localStorage to always be en
const STORAGE_KEY = "asa-acars.lang";
if (typeof localStorage !== "undefined") {
  try { localStorage.setItem(STORAGE_KEY, "en"); } catch { /* noop */ }
}

/** Setzt die Sprache explizit und schreibt in localStorage. (Locked to English) */
export function setLanguage(_lang: SupportedLanguage): void {
  void i18n.changeLanguage("en");
  try { localStorage.setItem(STORAGE_KEY, "en"); } catch { /* noop */ }
}

export default i18n;
