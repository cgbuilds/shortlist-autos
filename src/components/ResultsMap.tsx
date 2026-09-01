"use client";

import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import type { RankedRow } from "@/lib/types";
import { SEARCH_RADIUS_MILES } from "@/lib/types";
import { formatPrice, gradeCaption, milesToMeters, outboundLinks, radiusBounds, vehicleTitle } from "@/lib/format";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const OSM = "https://tile.openstreetmap.de/{z}/{x}/{y}.png";
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function TileFallback() {
  const [url, setUrl] = useState(OSM);
  const osm = url === OSM;
  return (
    <TileLayer
      key={url}
      attribution={osm ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' : "Tiles &copy; Esri"}
      url={url}
      eventHandlers={{ tileerror: () => osm && setUrl(ESRI) }}
    />
  );
}

function Invalidate({ tick }: { tick: string }) {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });
    run();
    const parent = map.getContainer().parentElement ?? map.getContainer();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(run) : null;
    ro?.observe(parent);
    const timers = [50, 200, 500, 1000].map((ms) => window.setTimeout(run, ms));
    return () => {
      ro?.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [map, tick]);
  return null;
}

function FitPoints({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [36, 36], maxZoom: 13 });
  }, [map, points]);
  return null;
}

function FitHere({ lat, lng, miles }: { lat: number; lng: number; miles: number }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(radiusBounds(lat, lng, miles), { padding: [28, 28], maxZoom: 12 });
  }, [map, lat, lng, miles]);
  return null;
}

function markerColor(failed: boolean, band: string): string {
  if (failed || band === "miss") return "#9a8f80";
  if (band === "superb" || band === "excellent") return "#2f5d50";
  if (band === "good") return "#3d6e8c";
  return "#b4532a";
}

export function ResultsMap({
  rows,
  selectedId,
  onSelect,
  layoutTick = "default",
  here = null,
  lockToHere = false,
}: {
  rows: RankedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  layoutTick?: string;
  here?: { lat: number; lng: number } | null;
  lockToHere?: boolean;
}) {
  const proto = L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: BLANK,
    iconRetinaUrl: BLANK,
    shadowUrl: BLANK,
    iconSize: [1, 1],
    shadowSize: [1, 1],
  });

  const points = rows.map((row) => [row.listing.latitude, row.listing.longitude] as [number, number]);
  const lock = !!(lockToHere && here);

  return (
    <MapContainer
      center={here ? [here.lat, here.lng] : (points[0] ?? [27.95, -82.46])}
      zoom={11}
      zoomControl={false}
      attributionControl
      className="h-full w-full max-w-full"
      scrollWheelZoom
    >
      <TileFallback />
      {lock && here ? <FitHere lat={here.lat} lng={here.lng} miles={SEARCH_RADIUS_MILES} /> : null}
      {!lock && points.length ? <FitPoints points={points} /> : null}
      <Invalidate tick={`${layoutTick}:${here ? "here" : "nohere"}`} />
      {here ? (
        <Circle
          center={[here.lat, here.lng]}
          radius={milesToMeters(SEARCH_RADIUS_MILES)}
          pathOptions={{ color: "#2f5d50", weight: 1, fillColor: "#2f5d50", fillOpacity: 0.06 }}
        />
      ) : null}
      {rows.map((row) => {
        const selected = row.listing.id === selectedId;
        const links = outboundLinks(row.listing);
        const caption = gradeCaption(row.grade);
        const color = markerColor(row.grade.mustHaveFailed, row.grade.band);
        return (
          <CircleMarker
            key={row.listing.id}
            center={[row.listing.latitude, row.listing.longitude]}
            radius={selected ? 11 : 8}
            pathOptions={{ color, fillColor: color, fillOpacity: selected ? 0.95 : 0.75, weight: selected ? 3 : 1 }}
            eventHandlers={{ click: () => onSelect(row.listing.id) }}
          >
            <Popup>
              <div className="min-w-[160px] text-sm">
                <p className="font-semibold">{vehicleTitle(row.listing)}</p>
                <p>
                  {caption.score} {caption.word} · {formatPrice(row.listing.price)}
                </p>
                <p className="mt-1 flex gap-2">
                  {links.map((link) => (
                    <a key={link.name} href={link.href} target="_blank" rel="noreferrer">
                      {link.name}
                    </a>
                  ))}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
