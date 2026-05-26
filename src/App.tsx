import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { applyTheme, getInitialTheme, type Theme } from "./theme";
import { LoginPage } from "./components/LoginPage";
import { CockpitView } from "./components/CockpitView";
import { BriefingView } from "./components/BriefingView";
import { SettingsPanel } from "./components/SettingsPanel";
import { ReleaseNotesModal } from "./components/ReleaseNotesModal";
import { ActivityLogPanel } from "./components/ActivityLogPanel";
import { AboutPanel } from "./components/AboutPanel";
import { LandingPanel } from "./components/LandingPanel";
import RunwayDiagramPreview from "./dev/RunwayDiagramPreview";
import { UpdateButton } from "./components/UpdateButton";
import { UpdateBanner } from "./components/UpdateBanner";
import { ErrorReportingFirstRunBanner } from "./components/ErrorReportingFirstRunBanner";
import { useDiscordRpcPush } from "./hooks/useDiscordRpcPush";
import { LiveRecordingIndicator } from "./components/LiveRecordingIndicator";
import { useSimSession } from "./hooks/useSimSession";
import { useUpdateChecker } from "./hooks/useUpdateChecker";
import type { ActiveFlightInfo, LoginResult, Profile } from "./types";

type SessionStatus =
  | { kind: "loading" }
  | { kind: "loggedOut" }
  | { kind: "loggedIn"; session: LoginResult };

type Tab = "cockpit" | "briefing" | "landing" | "log" | "settings" | "about" | "devpreview";

const DEBUG_STORAGE_KEY = "asa-acars.debug";
const AUTO_FILE_STORAGE_KEY = "asa-acars.autoFile";
const AUTO_START_STORAGE_KEY = "asa-acars.autoStart";
const AUTO_DELETE_LOGS_STORAGE_KEY = "asa-acars.autoDeleteFlightLogs";
/** Days threshold for the auto-purge sweep. Mirrors the wording of the
 *  Settings hint — keep both in sync if you ever change it. */
const AUTO_DELETE_LOGS_DAYS = 30;

/** Tracks the version for which the "What's new" modal was last
 *  shown. App start compares this against the running version and
 *  pops the modal once when they differ. Stays sticky through
 *  re-launches so we don't re-show on every startup. */
const RELEASE_NOTES_LAST_SEEN_KEY = "asa-acars.releaseNotes.lastSeenVersion";

const MINIMIZE_TO_TRAY_KEY = "asa-acars.minimizeToTray";
const APPROACH_ADVISORIES_KEY = "asa-acars.approachAdvisories";

/** v0.5.38: Stable-Approach-Banner im Cockpit-Tab. Default ON ("1"
 *  bedeutet aktiv; nur explizites "0" oder leerer Storage-Wert beim
 *  ersten Run setzt OFF — wir wollen Default ON für Safety). */
function loadApproachAdvisories(): boolean {
  const v = localStorage.getItem(APPROACH_ADVISORIES_KEY);
  return v === null ? true : v === "1";
}

function saveApproachAdvisories(value: boolean): void {
  localStorage.setItem(APPROACH_ADVISORIES_KEY, value ? "1" : "0");
}

/** Default OFF on both platforms — most pilots expect "X = quit"
 *  even on Mac. The setting hint explains why someone might want it
 *  on (long flights / heartbeat keep-alive). Persisted "1" → on,
 *  anything else (incl. unset) → off. */
function loadMinimizeToTray(): boolean {
  return localStorage.getItem(MINIMIZE_TO_TRAY_KEY) === "1";
}

function saveMinimizeToTray(value: boolean): void {
  localStorage.setItem(MINIMIZE_TO_TRAY_KEY, value ? "1" : "0");
}

function loadLastSeenReleaseNotesVersion(): string | null {
  return localStorage.getItem(RELEASE_NOTES_LAST_SEEN_KEY);
}

function saveLastSeenReleaseNotesVersion(version: string): void {
  localStorage.setItem(RELEASE_NOTES_LAST_SEEN_KEY, version);
}

function loadDebugMode(): boolean {
  return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

function saveDebugMode(value: boolean) {
  localStorage.setItem(DEBUG_STORAGE_KEY, value ? "1" : "0");
}

/** Auto-file the PIREP when the FSM reaches Arrived. Default ON —
 *  removes one click from the happy path. Disabling forces the
 *  pilot to hit "Flug beenden" manually, useful when they want to
 *  inspect mass / fuel / activity log before submitting. */
function loadAutoFile(): boolean {
  const v = localStorage.getItem(AUTO_FILE_STORAGE_KEY);
  // Default true: only persisted "0" disables.
  return v !== "0";
}

function saveAutoFile(value: boolean) {
  localStorage.setItem(AUTO_FILE_STORAGE_KEY, value ? "1" : "0");
}

/** Auto-start a flight when the aircraft is parked at the departure
 *  airport of one of the user's bids. Default OFF — opt-in feature.
 *  Backend watcher polls every 3 s while enabled. */
function loadAutoStart(): boolean {
  return localStorage.getItem(AUTO_START_STORAGE_KEY) === "1";
}

function saveAutoStart(value: boolean) {
  localStorage.setItem(AUTO_START_STORAGE_KEY, value ? "1" : "0");
}

/** Sweep stale per-flight JSONL recorder files at app start. Default
 *  ON — keeps the app data dir from accumulating gigabytes over years
 *  of flying. Pilots who want every flight retained forever can flip
 *  the toggle off in Settings → Speicher. Only persisted "0" disables. */
function loadAutoDeleteFlightLogs(): boolean {
  return localStorage.getItem(AUTO_DELETE_LOGS_STORAGE_KEY) !== "0";
}

function saveAutoDeleteFlightLogs(value: boolean) {
  localStorage.setItem(AUTO_DELETE_LOGS_STORAGE_KEY, value ? "1" : "0");
}


function App() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [status, setStatus] = useState<SessionStatus>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("briefing");
  const [debugMode, setDebugMode] = useState<boolean>(() => loadDebugMode());
  const [autoFile, setAutoFile] = useState<boolean>(() => loadAutoFile());
  const [autoStart, setAutoStart] = useState<boolean>(() => loadAutoStart());
  const [autoDeleteFlightLogs, setAutoDeleteFlightLogs] = useState<boolean>(
    () => loadAutoDeleteFlightLogs(),
  );
  const [minimizeToTray, setMinimizeToTray] = useState<boolean>(
    () => loadMinimizeToTray(),
  );
  const [approachAdvisoriesEnabled, setApproachAdvisoriesEnabled] = useState<boolean>(
    () => loadApproachAdvisories(),
  );

  // Sync the minimize-to-tray flag to the Rust backend whenever it
  // changes, plus on first mount. Backend default is `false`;
  // localStorage is the source of truth across restarts. The actual
  // close-handler in Rust just reads this atomic flag.
  useEffect(() => {
    void invoke("set_minimize_to_tray", { enabled: minimizeToTray }).catch(() => {});
  }, [minimizeToTray]);
  /** Version we should pop the release-notes modal for. Set on first
   *  mount when the running version differs from the lastSeen
   *  localStorage entry, AND when the user manually triggers it via
   *  the About panel. Cleared by ReleaseNotesModal.onClose. */
  const [releaseNotesVersion, setReleaseNotesVersion] = useState<string | null>(
    null,
  );
  const { status: simStatus, snapshot: simSnapshot } = useSimSession();

  // One-shot: if the app version has changed since the user last saw
  // the release-notes modal, fire it on next mount. New installs
  // (no lastSeen) silently set lastSeen=current to avoid greeting
  // first-timers with a "what changed since v0.0.0" message.
  useEffect(() => {
    void (async () => {
      try {
        const info = await invoke<{ version: string } | null>("app_info");
        if (!info?.version) return;
        const lastSeen = loadLastSeenReleaseNotesVersion();
        if (lastSeen === null) {
          // First launch ever on this device — don't pop, just remember.
          saveLastSeenReleaseNotesVersion(info.version);
          return;
        }
        if (lastSeen !== info.version) {
          setReleaseNotesVersion(info.version);
        }
      } catch {
        // app_info missing or errored — silently skip
      }
    })();
  }, []);

  // Auto-purge stale flight log files once per app launch when the
  // toggle is on. Fires on mount only — re-toggling at runtime doesn't
  // re-sweep (next launch will). 30-day threshold matches the Settings
  // hint copy.
  useEffect(() => {
    if (!loadAutoDeleteFlightLogs()) return;
    void invoke("flight_logs_purge_older_than", {
      olderThanDays: AUTO_DELETE_LOGS_DAYS,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync the persisted auto-start flag to the Rust backend on every
  // mount/change. Backend default is OFF; ab v0.3.0 ist der Backend-
  // Wert (persistiert in app_config_dir/auto_start.json) die Source
  // of truth — localStorage wäre im Tauri-Dev-Mode / nach Force-Kill
  // unzuverlässig. Beim ersten Mount fragen wir den Backend-Wert ab
  // und überschreiben den lokalen State falls der abweicht.
  useEffect(() => {
    let cancelled = false;
    void invoke<boolean>("auto_start_get_enabled")
      .then((backendValue) => {
        if (cancelled) return;
        if (backendValue !== autoStart) {
          // Backend-State zählt — Frontend nachziehen UND localStorage
          // aktualisieren damit's beim nächsten Frontend-Reload sofort
          // konsistent ist.
          setAutoStart(backendValue);
          saveAutoStart(backendValue);
        }
      })
      .catch(() => {
        // IPC-Fehler beim ersten Mount nicht tragisch — fallback auf
        // den localStorage-Wert. Wird beim nächsten Toggle korrigiert.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync localStorage + Backend bei jeder Änderung. Backend persistiert
  // selbst (siehe write_auto_start_persisted), localStorage ist nur
  // schneller Frontend-Cache fürs nächste Mount.
  useEffect(() => {
    void invoke("auto_start_set_enabled", { enabled: autoStart }).catch(() => {});
  }, [autoStart]);
  const simState = simStatus?.state ?? "disconnected";
  const [activeFlight, setActiveFlight] = useState<ActiveFlightInfo | null>(
    null,
  );

  // v0.5.48: Zentraler Update-Checker. Beide UI-Komponenten — der
  // Header-Button und das große Banner — konsumieren denselben State,
  // damit nicht doppelt gegen GitHub gepollt wird.
  const updateChecker = useUpdateChecker();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await invoke<LoginResult | null>("phpvms_load_session");
        if (cancelled) return;
        setStatus(
          result ? { kind: "loggedIn", session: result } : { kind: "loggedOut" },
        );
      } catch {
        if (!cancelled) setStatus({ kind: "loggedOut" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Centralised active-flight polling. Lives at the top so both the
  // v0.7.8: Beim Login-Mount localStorage → Backend syncen damit
  // SimBrief-Settings nach App-Restart sofort verfuegbar sind, ohne
  // dass der Pilot Settings oeffnen muss. Spec §4.2 P2-Korrektur.
  useEffect(() => {
    if (status.kind !== "loggedIn") return;
    const username = localStorage.getItem("simbrief_username") ?? null;
    const userId = localStorage.getItem("simbrief_user_id") ?? null;
    if (username || userId) {
      void invoke("set_simbrief_settings", {
        username: username && username.trim() ? username.trim() : null,
        userId: userId && userId.trim() ? userId.trim() : null,
      }).catch(() => null);
    }
  }, [status.kind]);

  // Cockpit and the Briefing tab see the same state without duplicate
  // IPC calls. Cockpit auto-becomes the default tab once a flight
  // shows up; Briefing is the default while idle.
  useEffect(() => {
    if (status.kind !== "loggedIn") return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function poll() {
      try {
        const flight = await invoke<ActiveFlightInfo | null>("flight_status");
        if (cancelled) return;
        setActiveFlight(flight);
      } catch {
        // ignore
      }
    }
    void poll();
    timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [status.kind]);

  // Auto-switch to the cockpit tab the first time an active flight
  // appears (resume on startup, or just-started flight). The user can
  // still manually switch back to briefing afterwards — we only force
  // the switch on the rising edge.
  const [hadActiveFlight, setHadActiveFlight] = useState(false);
  useEffect(() => {
    if (activeFlight && !hadActiveFlight) {
      setTab("cockpit");
      setHadActiveFlight(true);
    }
    if (!activeFlight && hadActiveFlight) {
      setHadActiveFlight(false);
      // Flight just ended (filed / cancelled / discarded). PhpVMS
      // updates the pilot's `curr_airport` server-side as part of an
      // accepted PIREP, but our cached LoginResult never sees it
      // unless we re-fetch. Without this, the dashboard "Aktueller
      // Airport" stays at the old value until the next app restart.
      void invoke<Profile | null>("phpvms_refresh_profile")
        .then((fresh) => {
          if (!fresh) return;
          setStatus((prev) =>
            prev.kind === "loggedIn"
              ? {
                  kind: "loggedIn",
                  session: { ...prev.session, profile: fresh },
                }
              : prev,
          );
        })
        .catch(() => {});
    }
  }, [activeFlight, hadActiveFlight]);

  // v0.9.0 (#Discord-RPC): bei jedem activeFlight/simStatus-Update die
  // Presence ans Rust-Backend pushen. Backend dedupliziert (= no-op wenn
  // Settings.enabled=false oder nichts geaendert), also billig bei jedem
  // Render. Bei null/null wird die Activity sauber gecleart.
  useDiscordRpcPush({ activeFlight, simStatus });

  async function handleLogout() {
    try {
      await invoke("phpvms_logout");
    } catch {
      // Drop in-memory session even if the keyring call fails.
    }
    setStatus({ kind: "loggedOut" });
    setTab("briefing");
  }

  function handleDebugModeChange(next: boolean) {
    setDebugMode(next);
    saveDebugMode(next);
  }

  function handleAutoFileChange(next: boolean) {
    setAutoFile(next);
    saveAutoFile(next);
  }

  function handleAutoStartChange(next: boolean) {
    setAutoStart(next);
    saveAutoStart(next);
    // The useEffect on autoStart will sync the toggle to the Rust
    // watcher. setState alone won't fire it (React batches), so we
    // also pre-emptively call here for snappier UX.
    void invoke("auto_start_set_enabled", { enabled: next }).catch(() => {});
  }

  function handleAutoDeleteFlightLogsChange(next: boolean) {
    setAutoDeleteFlightLogs(next);
    saveAutoDeleteFlightLogs(next);
  }

  const phpvmsConnected = status.kind === "loggedIn";
  const simConnected = simState === "connected";
  const simConnecting = simState === "connecting";
  const showTabs = status.kind === "loggedIn";

  // Human-readable page titles shown in the top bar (Stratos-style breadcrumb)
  const pageTitles: Record<Tab, string> = {
    cockpit:    "Flight Tracking",
    briefing:   "Flight Bookings",
    landing:    "Landing Analyser",
    log:        "Activity Log",
    settings:   "Settings",
    about:      "About",
    devpreview: "Dev Preview",
  };

  // Full simulator name for the topbar connection label
  const simFullLabel =
    simStatus?.kind === "msfs2024" ? "Microsoft Flight Simulator 2024" :
    simStatus?.kind === "msfs2020" ? "Microsoft Flight Simulator 2020" :
    simStatus?.kind === "xplane12" ? "X-Plane 12" :
    simStatus?.kind === "xplane11" ? "X-Plane 11" :
    "Simulator";

  return (
    <div className="app-shell">
      {/* ── Full-screen overlays (always rendered) ─────────────────── */}
      <UpdateBanner checker={updateChecker} activePhase={activeFlight?.phase ?? null} />
      <ErrorReportingFirstRunBanner />

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
      {showTabs && (
        <aside className="sidebar">
          {/* Brand mark — yellow square with "A" */}
          <div className="sidebar__brand">
            <span className="sidebar__brand-mark">A</span>
          </div>

          {/* Primary navigation */}
          <nav className="sidebar__nav" role="tablist">

            {/* Cockpit / Flight Tracking */}
            <button
              type="button" role="tab"
              aria-selected={tab === "cockpit"}
              className={`sidebar__item${tab === "cockpit" ? " sidebar__item--active" : ""}`}
              onClick={() => setTab("cockpit")}
              title={t("tabs.cockpit")}
            >
              {activeFlight && <span className="sidebar__badge" aria-hidden="true" />}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 4s-3.5 1.5-4.5 1.5L11 11 3 9.2l-1 1 7 4L4.5 18.5H2.5L2 20l1.5-.5L8 15l4 7 1-1-1.2-2.8z" />
              </svg>
            </button>

            {/* Briefing / Flight Bookings */}
            <button
              type="button" role="tab"
              aria-selected={tab === "briefing"}
              className={`sidebar__item${tab === "briefing" ? " sidebar__item--active" : ""}`}
              onClick={() => setTab("briefing")}
              title={t("tabs.briefing")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2" width="6" height="4" rx="1" />
                <path d="M8 3H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-3" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="15" y2="16" />
              </svg>
            </button>

            {/* Landing Analyser */}
            <button
              type="button" role="tab"
              aria-selected={tab === "landing"}
              className={`sidebar__item${tab === "landing" ? " sidebar__item--active" : ""}`}
              onClick={() => setTab("landing")}
              title={t("tabs.landing")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
              </svg>
            </button>

            {/* Activity Log */}
            <button
              type="button" role="tab"
              aria-selected={tab === "log"}
              className={`sidebar__item${tab === "log" ? " sidebar__item--active" : ""}`}
              onClick={() => setTab("log")}
              title={t("tabs.log")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </button>

            {/* Dev-only preview */}
            {import.meta.env.DEV && (
              <button
                type="button" role="tab"
                aria-selected={tab === "devpreview"}
                className={`sidebar__item${tab === "devpreview" ? " sidebar__item--active" : ""}`}
                onClick={() => setTab("devpreview")}
                title="Dev Preview"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="16,18 22,12 16,6" />
                  <polyline points="8,6 2,12 8,18" />
                </svg>
              </button>
            )}
          </nav>

          {/* Bottom: Settings + About */}
          <div className="sidebar__bottom">
            <button
              type="button" role="tab"
              aria-selected={tab === "settings"}
              className={`sidebar__item${tab === "settings" ? " sidebar__item--active" : ""}`}
              onClick={() => setTab("settings")}
              title={t("tabs.settings")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>

            <button
              type="button" role="tab"
              aria-selected={tab === "about"}
              className={`sidebar__item${tab === "about" ? " sidebar__item--active" : ""}`}
              onClick={() => setTab("about")}
              title={t("tabs.about")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </div>
        </aside>
      )}

      {/* ── CONTENT WRAPPER ──────────────────────────────────────────── */}
      <div className="content-wrapper">

        {/* ── TOP BAR ───────────────────────────────────────────────── */}
        <header className="topbar">
          {/* Page title (breadcrumb) */}
          <span className="topbar__page">
            {showTabs ? pageTitles[tab] : "ASA-ACARS"}
          </span>

          {/* Simulator connection status */}
          <div className="topbar__status">
            <span
              className={`topbar__conn${
                simConnected   ? " topbar__conn--ok"   :
                simConnecting  ? " topbar__conn--warn"  : ""
              }`}
            >
              <span className="topbar__conn-dot" />
              {simConnected
                ? `Connected to ${simFullLabel}`
                : simConnecting
                  ? `Connecting to ${simFullLabel}…`
                  : "Not connected"}
            </span>
          </div>

          {/* Right side: update button + live-rec + phpVMS pill */}
          <div className="topbar__right">
            <UpdateButton checker={updateChecker} />
            {activeFlight && (
              <LiveRecordingIndicator
                lastPositionAt={activeFlight.last_position_at}
                queuedCount={activeFlight.queued_position_count}
                positionCount={activeFlight.position_count}
                connectionState={
                  activeFlight.connection_state === "blocked"  ? "blocked"  :
                  activeFlight.connection_state === "failing"  ? "failing"  : "live"
                }
              />
            )}
            <span
              className={`topbar__pill${phpvmsConnected ? " topbar__pill--ok" : ""}`}
              title={phpvmsConnected ? t("status.phpvms_connected") : t("status.phpvms_disconnected")}
            >
              <span className="topbar__pill-dot" />
              phpVMS
            </span>
          </div>
        </header>

        {/* ── PAGE CONTENT ──────────────────────────────────────────── */}
        <main className="content-area">

          {status.kind === "loading" && (
            <section className="phase">
              <p>{t("status.checking_session")}</p>
            </section>
          )}

          {status.kind === "loggedOut" && (
            <LoginPage onSuccess={(s) => setStatus({ kind: "loggedIn", session: s })} />
          )}

          {status.kind === "loggedIn" && tab === "cockpit" && (
            <CockpitView
              session={status.session}
              activeFlight={activeFlight}
              setActiveFlight={setActiveFlight}
              simSnapshot={simSnapshot}
              onSwitchToBriefing={() => setTab("briefing")}
              autoFile={autoFile}
              approachAdvisoriesEnabled={approachAdvisoriesEnabled}
            />
          )}

          {status.kind === "loggedIn" && tab === "briefing" && (
            <BriefingView
              session={status.session}
              activeFlight={activeFlight}
              setActiveFlight={setActiveFlight}
              onLogout={handleLogout}
              simState={simState}
              simSnapshot={simSnapshot}
              onActiveFlightUpdated={() => {
                void invoke<ActiveFlightInfo | null>("flight_status")
                  .then(setActiveFlight)
                  .catch(() => null);
              }}
              onProfileRefreshed={(fresh) => {
                setStatus((prev) =>
                  prev.kind === "loggedIn"
                    ? { kind: "loggedIn", session: { ...prev.session, profile: fresh } }
                    : prev,
                );
              }}
            />
          )}

          {status.kind === "loggedIn" && tab === "landing" && <LandingPanel />}

          {status.kind === "loggedIn" && tab === "log" && <ActivityLogPanel />}

          {status.kind === "loggedIn" && tab === "settings" && (
            <SettingsPanel
              debugMode={debugMode}
              onDebugModeChange={handleDebugModeChange}
              autoFile={autoFile}
              onAutoFileChange={handleAutoFileChange}
              autoStart={autoStart}
              onAutoStartChange={handleAutoStartChange}
              autoDeleteFlightLogs={autoDeleteFlightLogs}
              onAutoDeleteFlightLogsChange={handleAutoDeleteFlightLogsChange}
              minimizeToTray={minimizeToTray}
              onMinimizeToTrayChange={(next) => {
                setMinimizeToTray(next);
                saveMinimizeToTray(next);
              }}
              approachAdvisoriesEnabled={approachAdvisoriesEnabled}
              onApproachAdvisoriesEnabledChange={(next) => {
                setApproachAdvisoriesEnabled(next);
                saveApproachAdvisories(next);
              }}
              theme={theme}
              onThemeChange={setTheme}
              simStatus={simStatus}
              activeFlight={activeFlight}
            />
          )}

          {status.kind === "loggedIn" && tab === "about" && (
            <AboutPanel onShowReleaseNotes={(v) => setReleaseNotesVersion(v)} />
          )}

          {import.meta.env.DEV && status.kind === "loggedIn" && tab === "devpreview" && (
            <RunwayDiagramPreview />
          )}

        </main>
      </div>

      {/* ── Release notes modal ───────────────────────────────────────── */}
      {releaseNotesVersion && (
        <ReleaseNotesModal
          version={releaseNotesVersion}
          onClose={() => {
            saveLastSeenReleaseNotesVersion(releaseNotesVersion);
            setReleaseNotesVersion(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
