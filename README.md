<div align="center">

<br/>

```
 █████╗ ███████╗ █████╗      █████╗  ██████╗ █████╗ ██████╗ ███████╗
██╔══██╗██╔════╝██╔══██╗    ██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝
███████║███████╗███████║    ███████║██║     ███████║██████╔╝███████╗
██╔══██║╚════██║██╔══██║    ██╔══██║██║     ██╔══██║██╔══██╗╚════██║
██║  ██║███████║██║  ██║    ██║  ██║╚██████╗██║  ██║██║  ██║███████║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
```

**A professional-grade, cross-platform ACARS client for phpVMS 7**  
_Connect any Virtual Airline · Track live flights · File PIREPs automatically_

<br/>

![Version](https://img.shields.io/badge/version-0.11.3--beta-FFD500?style=for-the-badge&labelColor=0a0a0a)
![Tauri](https://img.shields.io/badge/Tauri_2-Rust_Core-FFD500?style=for-the-badge&logo=tauri&logoColor=FFD500&labelColor=0a0a0a)
![React](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&labelColor=0a0a0a)
![Platform](https://img.shields.io/badge/Windows-11%2F10-0078D4?style=for-the-badge&logo=windows&labelColor=0a0a0a)
![License](https://img.shields.io/badge/license-Private-444?style=for-the-badge&labelColor=0a0a0a)

<br/>

</div>

---

## ✦ Overview
<img width="1920" height="1038" alt="image" src="https://github.com/user-attachments/assets/426dbc9d-fd79-4c90-aef0-5aa622da92dd" />

**ASA-ACARS** is a next-generation ACARS desktop client built from the ground up in **Rust + Tauri 2**, designed specifically for **phpVMS 7** virtual airlines. It bridges your flight simulator (MSFS 2020/2024 or X-Plane 11/12) with any phpVMS 7 backend — recording your full flight, streaming your live position, analyzing your landing, and submitting a complete PIREP automatically.

The interface is built on a **terminal-dark aesthetic** (Stratos Design System) — minimal, precise, and immersive — built to sit elegantly alongside your simulator without stealing attention.

> **Beta Notice:** v0.11.x is fully functional for flight tracking and PIREP submission. Breaking changes are unlikely but possible before v1.0.

---

## ✦ Features

| Category | Feature |
|---|---|
| 🛫 **Flight Tracking** | Automatic phase detection (Taxi / Takeoff / Cruise / Approach / Landing) |
| 📡 **Live Telemetry** | Real-time position streaming to live map via MQTT |
| 🛬 **Landing Analysis** | V/S, G-Force, rollout scoring with Smooth → Severe tiers |
| 📋 **PIREP Filing** | Auto-submit to any phpVMS 7 instance on landing |
| 🗺️ **Route Map** | Embedded Leaflet map with live aircraft position |
| 🔌 **Universal VA Support** | Connects to **any** phpVMS 7 VA — just enter your URL + API Key |
| 🔐 **Secure Credentials** | API Keys stored in OS keyring — never written to disk in plaintext |
| ✈️ **SimBrief Integration** | Load OFP data directly for flight planning |
| 💬 **Activity Log** | Live, color-coded event log during every flight |
| 🔔 **Auto-Update** | Silent background updater via Tauri plugin |
| 🌐 **i18n** | Bilingual UI: English + German (extensible) |

---

## ✦ Simulator Support

| Simulator | Status | Adapter |
|---|---|---|
| Microsoft Flight Simulator 2020 | ✅ Full | SimConnect (native Windows FFI) |
| Microsoft Flight Simulator 2024 | ✅ Full | SimConnect (native Windows FFI) |
| X-Plane 11 | ✅ Full | UDP Data Refs listener |
| X-Plane 12 | ✅ Full | Web API + UDP fallback |

---

## ✦ Tech Stack

```
Frontend          Backend (Rust)
───────────────   ─────────────────────────────────────────
React 19          Tauri 2 (app shell + IPC commands)
TypeScript 5.8    api-client    → phpVMS 7 REST API
Vite 7            sim-core      → SimAdapter trait + FSM
i18next           sim-msfs      → SimConnect FFI (Windows)
Leaflet           sim-xplane    → X-Plane UDP / Web API
Sentry            recorder      → Flight log + PIREP builder
                  storage       → SQLite offline queue
                  landing-scoring → Touchdown analysis
                  geo           → Runway DB + great-circle
                  metar         → METAR fetch + parse
                  secrets       → OS keyring wrapper
                  asa-acars-mqtt → MQTT live tracking
```

---

## ✦ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ASA-ACARS Window                     │
│  ┌──────────┐  ┌────────────────────────────────────┐   │
│  │ Sidebar  │  │          Content Area               │   │
│  │  ∙ Brief │  │  BriefingView  │  CockpitView      │   │
│  │  ∙ Fly   │  │  BidsList      │  ActiveFlightPanel │   │
│  │  ∙ Land  │  │  PilotHeader   │  LiveTapes        │   │
│  │  ∙ Set   │  │                │  ActivityLog      │   │
│  └──────────┘  └────────────────────────────────────┘   │
│                          React + Vite                    │
└────────────────────────┬────────────────────────────────┘
                         │ Tauri IPC (invoke / events)
┌────────────────────────▼────────────────────────────────┐
│                    Rust Core (lib.rs)                    │
│  AppState (Mutex-guarded)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ phpVMS   │ │  Sim     │ │ Active   │ │  MQTT     │  │
│  │ Client   │ │ Adapter  │ │ Flight   │ │ Publisher │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## ✦ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable toolchain)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS
- A **phpVMS 7** virtual airline with an API Key

### Development

```powershell
# 1. Clone the repository
git clone https://github.com/oAlvesOFF/ACARS_PHPVMS7.git
cd ACARS_PHPVMS7

# 2. Install Node dependencies
npm install

# 3. Start dev server (Vite + Rust build + app window)
npm run tauri dev
```

> ⚠️ The first `cargo build` downloads and compiles all Rust crates.  
> This takes **5–10 minutes** on first run. Subsequent builds are fast and incremental.

### Production Build

```powershell
npm run tauri build
```

Outputs installers to `src-tauri/target/release/bundle/`:
- `*.msi` — Windows Installer (MSI)
- `*-setup.exe` — NSIS Setup Wizard

---

## ✦ Configuration

On first launch, the **Login** screen will ask for:

| Field | Description |
|---|---|
| **phpVMS Site URL** | The base URL of your VA, e.g. `https://your-va.com` |
| **API Key** | Found under your pilot profile on the VA website |

Credentials are stored in your **OS keyring** (Windows Credential Manager), never as plaintext files.

---

## ✦ Project Structure

```
ACARS_PHPVMS7/
├── src/                          # React + TypeScript frontend
│   ├── App.tsx                   # App shell, layout, tab routing
│   ├── App.css                   # Global design tokens + layout
│   ├── stratos.css               # Stratos Design System components
│   ├── main.tsx                  # Entry — theme + i18n init
│   ├── theme.ts                  # Dark mode manager
│   ├── types.ts                  # Shared TypeScript types
│   ├── components/
│   │   ├── BriefingView.tsx      # Pre-flight tab (bids list + pilot info)
│   │   ├── BidsList.tsx          # Flight bid cards + start gate logic
│   │   ├── CockpitView.tsx       # In-flight cockpit view
│   │   ├── ActiveFlightPanel.tsx # Live telemetry, map, log
│   │   ├── PilotHeader.tsx       # Pilot identity strip
│   │   ├── SettingsPanel.tsx     # Simulator + app configuration
│   │   ├── LandingPanel.tsx      # Post-flight landing history
│   │   ├── LoginPage.tsx         # VA URL + API Key entry
│   │   └── AboutPanel.tsx        # Version + credits
│   └── i18n/                     # Translations (EN + DE)
│
└── src-tauri/                    # Rust workspace
    ├── src/lib.rs                # 23k+ line app core: all Tauri commands
    └── crates/
        ├── api-client/           # phpVMS 7 REST client
        ├── sim-core/             # SimAdapter trait + flight phase FSM
        ├── sim-msfs/             # MSFS SimConnect adapter
        ├── sim-xplane/           # X-Plane UDP + Web API adapter
        ├── recorder/             # Flight recorder + PIREP builder
        ├── storage/              # SQLite persistence layer
        ├── landing-scoring/      # Touchdown analysis engine
        ├── geo/                  # Runway DB + great-circle geometry
        ├── metar/                # METAR fetching + parsing
        ├── secrets/              # OS keyring abstraction
        ├── asa-acars-mqtt/       # MQTT live-tracking publisher
        └── discord-presence/     # Discord Rich Presence integration
```

---

## ✦ Security

- API Keys are stored exclusively via the OS keyring (`secrets` crate) — never written to disk in plaintext.
- All phpVMS API traffic is over HTTPS.
- Tauri's CSP policy restricts frontend connections to explicitly whitelisted origins.

---

## ✦ Contributing

This project is in **private beta**. Bug reports and feature requests are welcome via the Discord server or GitHub Issues.

---

## ✦ Credits

Built with ❤️ by **Rui Alves**

---

<div align="center">

`ASA-ACARS` · `v0.11.3-beta` · `Tauri 2` · `Rust` · `React 19`

*Professional flight tracking for the modern virtual airline.*

</div>
