import { useMemo } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { computeForestChange } from "@/lib/analysis";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TreePine, PlusCircle, XCircle } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const STATUS_COLORS = {
  Stable: "hsl(152,45%,38%)",
  "New Tree": "hsl(210,60%,50%)",
  "Missing Tree": "hsl(0,72%,51%)",
};

const STATUS_HEX = {
  Stable: "#2d8a57",
  "New Tree": "#3b7fd4",
  "Missing Tree": "#d93b3b",
};

const ForestChangePage = () => {
  const { trees } = useCsvData();
  const changeDf = useMemo(() => computeForestChange(trees), [trees]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of changeDf) counts[r.Status] = (counts[r.Status] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [changeDf]);

  const stable  = changeDf.filter(r => r.Status === "Stable");
  const newTree = changeDf.filter(r => r.Status === "New Tree");
  const missing = changeDf.filter(r => r.Status === "Missing Tree");

  // Center map on average lat/lon
  const centerLat = changeDf.reduce((s, r) => s + r.Latitude, 0) / (changeDf.length || 1);
  const centerLon = changeDf.reduce((s, r) => s + r.Longitude, 0) / (changeDf.length || 1);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">🌲 Forest Change Detection</h1>
        <p className="text-muted-foreground mt-1">Comparing first and last scans to detect stable, new, and missing trees</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: STATUS_COLORS["Stable"] }}>
            <TreePine className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{stable.length}</p>
            <p className="text-sm text-muted-foreground">Stable Trees</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: STATUS_COLORS["New Tree"] }}>
            <PlusCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{newTree.length}</p>
            <p className="text-sm text-muted-foreground">New Trees (Forestation)</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: STATUS_COLORS["Missing Tree"] }}>
            <XCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{missing.length}</p>
            <p className="text-sm text-muted-foreground">Missing Trees (Deforestation)</p>
          </div>
        </div>
      </div>

      {/* Pie chart */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-4">Forest Status Summary</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={summary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
              {summary.map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] || "#888"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Real Map */}
      <div className="stat-card p-0 overflow-hidden rounded-xl">
        <div className="px-4 pt-4 pb-2">
          <h3 className="font-display font-semibold text-foreground">Spatial Change Map</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zoom and pan on the real map.&nbsp;
            <span style={{ color: STATUS_HEX["Stable"] }}>●</span> Stable &nbsp;
            <span style={{ color: STATUS_HEX["New Tree"] }}>●</span> New Tree &nbsp;
            <span style={{ color: STATUS_HEX["Missing Tree"] }}>●</span> Missing Tree
          </p>
        </div>
        <MapContainer
          center={[centerLat, centerLon]}
          zoom={15}
          style={{ height: "520px", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {changeDf.map((tree, i) => (
            <CircleMarker
              key={i}
              center={[tree.Latitude, tree.Longitude]}
              radius={tree.Status === "Stable" ? 5 : 7}
              pathOptions={{
                color: STATUS_HEX[tree.Status],
                fillColor: STATUS_HEX[tree.Status],
                fillOpacity: 0.85,
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="text-sm space-y-0.5">
                  <p className="font-semibold">{tree.Tree_ID}</p>
                  <p className="text-muted-foreground">{tree.Species}</p>
                  <p>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-white text-xs font-medium mt-1"
                      style={{ background: STATUS_HEX[tree.Status] }}
                    >
                      {tree.Status}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {tree.Latitude.toFixed(6)}, {tree.Longitude.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Change table */}
      <div className="stat-card overflow-auto">
        <h3 className="font-display font-semibold text-foreground mb-4">Tree Change Table</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Tree ID","Species","Latitude","Longitude","Status"].map(h => (
                <th key={h} className="text-left py-2 px-3 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {changeDf.map((r, i) => (
              <tr key={i} className="border-b border-border/30 hover:bg-muted/40">
                <td className="py-1.5 px-3 font-medium">{r.Tree_ID}</td>
                <td className="py-1.5 px-3 text-muted-foreground">{r.Species}</td>
                <td className="py-1.5 px-3">{r.Latitude.toFixed(6)}</td>
                <td className="py-1.5 px-3">{r.Longitude.toFixed(6)}</td>
                <td className="py-1.5 px-3">
                  <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
                    style={{ background: STATUS_HEX[r.Status] }}>
                    {r.Status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForestChangePage;
