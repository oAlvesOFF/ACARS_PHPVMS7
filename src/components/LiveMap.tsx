/**
 * LiveMap — Leaflet interactive map for the Cockpit (Stratos-style).
 *
 * Features:
 *  - Dark CartoDB "dark_all" tile layer (matches Stratos aesthetic)
 *  - Departure / Arrival airport pin markers
 *  - Dashed great-circle route line between airports
 *  - Moving aircraft marker that updates live with simSnapshot
 *  - Trailing breadcrumb path (last N positions)
 *  - Auto-pans to keep aircraft in view
 *  - Flight info overlay in bottom-right (Phase / Next WPT style)
 */

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths broken by Vite bundling
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)["_getIconUrl"];
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
});

interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

interface Props {
  dptIcao: string;
  arrIcao: string;
  currentLat?: number | null;
  currentLon?: number | null;
  currentHeading?: number | null;
  dptGate?: string | null;
  arrGate?: string | null;
  /** Current flight phase label, e.g. "boarding", "cruise", "landing" */
  phase?: string;
}

const TRAIL_MAX = 200;

// SVG aircraft icon — yellow, rotates with heading
function makeAircraftIcon(headingDeg: number): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"
         style="transform: rotate(${headingDeg}deg); filter: drop-shadow(0 0 4px rgba(255,213,0,0.8));">
      <path fill="#FFD500" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Airport pin icon
function makeAirportIcon(label: string, isArr: boolean): L.DivIcon {
  const color = isArr ? "#ef4444" : "#FFD500";
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="
        background:${color};color:#000;font-size:10px;font-weight:700;
        padding:2px 6px;border-radius:3px;white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,0.6);">
        ${label}
      </div>
      <div style="width:10px;height:10px;background:${color};border-radius:50%;
        border:2px solid #000;box-shadow:0 0 6px ${color};"></div>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [60, 30],
    iconAnchor: [30, 28],
  });
}

export function LiveMap({
  dptIcao,
  arrIcao,
  currentLat,
  currentLon,
  currentHeading,
  dptGate,
  arrGate,
  phase,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const aircraftMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const trailLineRef = useRef<L.Polyline | null>(null);
  const trailPointsRef = useRef<[number, number][]>([]);
  const dptMarkerRef = useRef<L.Marker | null>(null);
  const arrMarkerRef = useRef<L.Marker | null>(null);
  const initialFitDoneRef = useRef(false);

  const [dpt, setDpt] = useState<AirportInfo | null>(null);
  const [arr, setArr] = useState<AirportInfo | null>(null);

  // Fetch airport coords from backend
  useEffect(() => {
    let cancelled = false;
    async function fetch(icao: string, set: (a: AirportInfo) => void) {
      try {
        const data = await invoke<AirportInfo>("airport_get", { icao });
        if (!cancelled) set(data);
      } catch { /* silent */ }
    }
    if (dptIcao) void fetch(dptIcao, setDpt);
    if (arrIcao) void fetch(arrIcao, setArr);
    return () => { cancelled = true; };
  }, [dptIcao, arrIcao]);

  // Initialise Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: [39.5, -8.0], // default: Portugal
      zoom: 7,
    });

    // Dark CartoDB tiles — matches Stratos look exactly
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    // Subtle attribution
    L.control.attribution({ prefix: false, position: "bottomleft" })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>')
      .addTo(map);

    // Zoom controls bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      initialFitDoneRef.current = false;
    };
  }, []);

  // Draw/update departure & arrival markers + route line when airports load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dpt || !arr) return;

    // Remove old markers
    dptMarkerRef.current?.remove();
    arrMarkerRef.current?.remove();
    routeLineRef.current?.remove();

    // Departure marker
    dptMarkerRef.current = L.marker([dpt.lat, dpt.lon], {
      icon: makeAirportIcon(dptGate ? `${dpt.icao} · ${dptGate}` : dpt.icao, false),
      zIndexOffset: 100,
    }).addTo(map).bindTooltip(dpt.name, { direction: "top", className: "map-tooltip" });

    // Arrival marker
    arrMarkerRef.current = L.marker([arr.lat, arr.lon], {
      icon: makeAirportIcon(arrGate ? `${arr.icao} · ${arrGate}` : arr.icao, true),
      zIndexOffset: 100,
    }).addTo(map).bindTooltip(arr.name, { direction: "top", className: "map-tooltip" });

    // Dashed route line
    routeLineRef.current = L.polyline(
      [[dpt.lat, dpt.lon], [arr.lat, arr.lon]],
      {
        color: "rgba(255,213,0,0.3)",
        weight: 2,
        dashArray: "8 8",
      }
    ).addTo(map);

    // Initial fit to show both airports
    if (!initialFitDoneRef.current) {
      map.fitBounds(
        L.latLngBounds([dpt.lat, dpt.lon], [arr.lat, arr.lon]),
        { padding: [60, 60] }
      );
      initialFitDoneRef.current = true;
    }
  }, [dpt, arr, dptGate, arrGate]);

  // Update aircraft position live
  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentLat == null || currentLon == null) return;

    const heading = currentHeading ?? 0;
    const pos: [number, number] = [currentLat, currentLon];

    if (!aircraftMarkerRef.current) {
      // First time — create aircraft marker
      aircraftMarkerRef.current = L.marker(pos, {
        icon: makeAircraftIcon(heading),
        zIndexOffset: 1000,
      }).addTo(map);

      // Create trail polyline
      trailLineRef.current = L.polyline([], {
        color: "#FFD500",
        weight: 2,
        opacity: 0.7,
      }).addTo(map);
    } else {
      // Update position & icon rotation
      aircraftMarkerRef.current.setLatLng(pos);
      aircraftMarkerRef.current.setIcon(makeAircraftIcon(heading));
    }

    // Append to trail
    trailPointsRef.current.push(pos);
    if (trailPointsRef.current.length > TRAIL_MAX) {
      trailPointsRef.current = trailPointsRef.current.slice(-TRAIL_MAX);
    }
    trailLineRef.current?.setLatLngs(trailPointsRef.current);

    // Pan map gently to keep aircraft visible
    if (!map.getBounds().contains(pos)) {
      map.panTo(pos, { animate: true, duration: 1.0 });
    }
  }, [currentLat, currentLon, currentHeading]);

  return (
    <div className="live-map-wrapper">
      <div ref={containerRef} className="live-map-container" />

      {/* Phase badge — bottom right overlay like Stratos */}
      {phase && (
        <div className="live-map-phase-badge">
          <span className="live-map-phase-label">PHASE</span>
          <span className="live-map-phase-value">{phase.toUpperCase().replace("_", " ")}</span>
        </div>
      )}
    </div>
  );
}
