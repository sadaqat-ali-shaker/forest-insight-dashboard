import { useMemo } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const SPECIES_HEX = [
  "#2d8a57", "#d4883b", "#3b7fd4", "#9b59b6",
  "#d93b3b", "#c9b30a", "#1a9999", "#c0392b",
];

function biomassToColor(biomass: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (biomass - min) / (max - min);
  const r = Math.round(220 - 160 * t);
  const g = Math.round(60 + 150 * t);
  const b = Math.round(40);
  return `rgb(${r},${g},${b})`;
}

const SpatialMapPage = () => {
  const { trees } = useCsvData();

  // Latest measurement per tree
  const latest = useMemo(() => {
    const byTree = new Map<string, typeof trees[0]>();
    for (const t of trees) {
      const ex = byTree.get(t.Tree_ID);
      if (!ex || t.Date > ex.Date) byTree.set(t.Tree_ID, t);
    }
    return [...byTree.values()];
  }, [trees]);

  const species = useMemo(() => [...new Set(latest.map(t => t.Species))].sort(), [latest]);
  const speciesColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    species.forEach((sp, i) => { m[sp] = SPECIES_HEX[i % SPECIES_HEX.length]; });
    return m;
  }, [species]);

  const centerLat = latest.reduce((s, t) => s + t.Latitude, 0) / (latest.length || 1);
  const centerLon = latest.reduce((s, t) => s + t.Longitude, 0) / (latest.length || 1);

  const minBiomass = Math.min(...latest.map(t => t.Biomass_kg));
  const maxBiomass = Math.max(...latest.map(t => t.Biomass_kg));
  const minDBH     = Math.min(...latest.map(t => t.Predicted_DBH));
  const maxDBH     = Math.max(...latest.map(t => t.Predicted_DBH));

  function dbhToRadius(dbh: number): number {
    const t = maxDBH === minDBH ? 0.5 : (dbh - minDBH) / (maxDBH - minDBH);
    return 4 + t * 10; // 4px to 14px
  }

  const minHeight = Math.min(...latest.map(t => t.Height));
  const maxHeight = Math.max(...latest.map(t => t.Height));
  function heightToRadius(h: number): number {
    const t = maxHeight === minHeight ? 0.5 : (h - minHeight) / (maxHeight - minHeight);
    return 4 + t * 10;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">📌 Spatial Map</h1>
        <p className="text-muted-foreground mt-1">Tree locations on a real map — latest scan measurements. Click any dot for details.</p>
      </div>

      {/* MAP 1 — Biomass */}
      <div className="stat-card p-0 overflow-hidden rounded-xl">
        <div className="px-4 pt-4 pb-2">
          <h3 className="font-display font-semibold text-foreground">Map 1: Biomass Distribution</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Color = Biomass (🟤 low → 🟢 high) &nbsp;|&nbsp; Circle size = DBH
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 h-2 rounded" style={{ background: "linear-gradient(to right, rgb(220,60,40), rgb(60,210,40))" }} />
            <span className="text-[10px] text-muted-foreground">Low Biomass → High Biomass</span>
          </div>
        </div>
        <MapContainer
          center={[centerLat, centerLon]}
          zoom={15}
          style={{ height: "500px", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {latest.map((tree, i) => {
            const color = biomassToColor(tree.Biomass_kg, minBiomass, maxBiomass);
            const radius = dbhToRadius(tree.Predicted_DBH);
            return (
              <CircleMarker
                key={i}
                center={[tree.Latitude, tree.Longitude]}
                radius={radius}
                pathOptions={{ color: "#fff", weight: 0.8, fillColor: color, fillOpacity: 0.85 }}
              >
                <Popup>
                  <div className="text-sm space-y-0.5 min-w-[160px]">
                    <p className="font-semibold">{tree.Tree_ID}</p>
                    <p className="text-gray-500">{tree.Species}</p>
                    <hr className="my-1" />
                    <p>🌱 Biomass: <strong>{tree.Biomass_kg.toFixed(1)} kg</strong></p>
                    <p>🪵 DBH: <strong>{tree.Predicted_DBH.toFixed(2)} cm</strong></p>
                    <p>📏 Height: <strong>{tree.Height.toFixed(2)} m</strong></p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* MAP 2 — Species */}
      <div className="stat-card p-0 overflow-hidden rounded-xl">
        <div className="px-4 pt-4 pb-2">
          <h3 className="font-display font-semibold text-foreground">Map 2: Species Distribution</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Color = Species &nbsp;|&nbsp; Circle size = Height
          </p>
          {/* Species legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {species.map(sp => (
              <div key={sp} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: speciesColorMap[sp] }} />
                <span className="text-[11px] text-muted-foreground">{sp}</span>
              </div>
            ))}
          </div>
        </div>
        <MapContainer
          center={[centerLat, centerLon]}
          zoom={15}
          style={{ height: "500px", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {latest.map((tree, i) => {
            const color = speciesColorMap[tree.Species] || "#888";
            const radius = heightToRadius(tree.Height);
            return (
              <CircleMarker
                key={i}
                center={[tree.Latitude, tree.Longitude]}
                radius={radius}
                pathOptions={{ color: "#fff", weight: 0.8, fillColor: color, fillOpacity: 0.85 }}
              >
                <Popup>
                  <div className="text-sm space-y-0.5 min-w-[160px]">
                    <p className="font-semibold">{tree.Tree_ID}</p>
                    <p style={{ color }} className="font-medium">{tree.Species}</p>
                    <hr className="my-1" />
                    <p>📏 Height: <strong>{tree.Height.toFixed(2)} m</strong></p>
                    <p>🪵 DBH: <strong>{tree.Predicted_DBH.toFixed(2)} cm</strong></p>
                    <p>🌱 Biomass: <strong>{tree.Biomass_kg.toFixed(1)} kg</strong></p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default SpatialMapPage;
