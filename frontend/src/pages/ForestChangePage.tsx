import { useMemo, useState } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { computeForestChange } from "@/lib/analysis";
import type { ForestChangeRecord, ChangeStatus } from "@/lib/analysis";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TreePine, PlusCircle, XCircle, Eye, Search, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ChangeStatus, { color: string; hex: string; label: string; radius: number }> = {
  Stable:         { color: "hsl(152,45%,38%)", hex: "#2d8a57", label: "Stable",       radius: 5 },
  "New Tree":     { color: "hsl(210,60%,50%)", hex: "#3b7fd4", label: "New Tree",     radius: 7 },
  "Missing Tree": { color: "hsl(0,72%,51%)",   hex: "#d93b3b", label: "Missing Tree", radius: 7 },
  Monitoring:     { color: "hsl(38,85%,52%)",  hex: "#e89d22", label: "Monitoring",   radius: 6 },
};

const TABLE_PAGE_SIZE = 50;

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChangeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-white text-[11px] font-semibold whitespace-nowrap"
      style={{ background: cfg.hex }}
    >
      {cfg.label}
    </span>
  );
}

function ReasonTooltip({ reason }: { reason: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title={reason}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {visible && (
        <span className="absolute z-20 left-5 top-0 w-72 rounded-xl bg-popover border border-border shadow-lg px-3 py-2 text-xs text-muted-foreground leading-relaxed pointer-events-none">
          {reason}
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, count, label, color, sub,
}: {
  icon: React.ElementType; count: number; label: string; color: string; sub?: string;
}) {
  return (
    <div className="stat-card flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color }}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground">{count.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const ForestChangePage = () => {
  const { trees } = useCsvData();
  const changeDf = useMemo(() => computeForestChange(trees), [trees]);

  // ── Status counts ──────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<ChangeStatus, number> = {
      Stable: 0, "New Tree": 0, "Missing Tree": 0, Monitoring: 0,
    };
    for (const r of changeDf) c[r.Status]++;
    return c;
  }, [changeDf]);

  const pieData = useMemo(
    () =>
      (Object.entries(counts) as [ChangeStatus, number][])
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value })),
    [counts],
  );

  // ── Filter for table ───────────────────────────────────────────────────────
  const [tableQuery,      setTableQuery]      = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState<"All" | ChangeStatus>("All");
  const [tableSectorFilter, setTableSectorFilter] = useState("All");
  const [tablePage,       setTablePage]       = useState(1);

  const allSectors = useMemo(
    () => ["All", ...([...new Set(changeDf.map(r => r.Sector))] as string[]).sort()],
    [changeDf],
  );

  const filteredTable = useMemo(() => {
    const q = tableQuery.toLowerCase().trim();
    return changeDf.filter(r => {
      if (tableStatusFilter !== "All" && r.Status !== tableStatusFilter) return false;
      if (tableSectorFilter !== "All" && r.Sector !== tableSectorFilter) return false;
      if (q && !r.Tree_ID.toLowerCase().includes(q) && !r.Species.toLowerCase().includes(q) && !r.Sector.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [changeDf, tableQuery, tableStatusFilter, tableSectorFilter]);

  const totalTablePages = Math.max(1, Math.ceil(filteredTable.length / TABLE_PAGE_SIZE));
  const tablePageRows   = filteredTable.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);

  // ── Filter for map ─────────────────────────────────────────────────────────
  const [mapStatusFilter, setMapStatusFilter] = useState<"All" | ChangeStatus>("All");
  const [mapSectorFilter, setMapSectorFilter] = useState("All");

  const mapPoints = useMemo(
    () =>
      changeDf.filter(r => {
        if (mapStatusFilter !== "All" && r.Status !== mapStatusFilter) return false;
        if (mapSectorFilter !== "All" && r.Sector !== mapSectorFilter) return false;
        return true;
      }),
    [changeDf, mapStatusFilter, mapSectorFilter],
  );

  // ── Per-sector breakdown ───────────────────────────────────────────────────
  const sectorBreakdown = useMemo(() => {
    const map = new Map<string, Record<ChangeStatus, number>>();
    for (const r of changeDf) {
      const sec = r.Sector;
      if (!map.has(sec)) map.set(sec, { Stable: 0, "New Tree": 0, "Missing Tree": 0, Monitoring: 0 });
      map.get(sec)![r.Status]++;
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sector, c]) => ({ sector, ...c, total: c.Stable + c["New Tree"] + c["Missing Tree"] + c.Monitoring }));
  }, [changeDf]);

  // Map center
  const center = useMemo(() => {
    if (!changeDf.length) return [49.01, 8.68] as [number, number];
    const lat = changeDf.reduce((s, r) => s + r.Latitude, 0) / changeDf.length;
    const lng = changeDf.reduce((s, r) => s + r.Longitude, 0) / changeDf.length;
    return [lat, lng] as [number, number];
  }, [changeDf]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!changeDf.length) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="stat-card flex flex-col items-center gap-4 py-20 text-center">
          <TreePine className="h-12 w-12 text-muted-foreground opacity-30" />
          <div>
            <p className="font-display font-semibold text-foreground">No Change Data Available</p>
            <p className="text-sm text-muted-foreground mt-1">
              The dataset needs at least two distinct scan months to detect forest change.
              Add more records via the Data Manager.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground"> Forest Change Detection</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Comparing scan dates within each sector independently to detect stable, new, missing, and newly-monitored trees.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={TreePine}
          count={counts.Stable}
          label="Stable Trees"
          color={STATUS_CONFIG.Stable.color}
          sub="Present in both first & last scan"
        />
        <SummaryCard
          icon={PlusCircle}
          count={counts["New Tree"]}
          label="New Trees"
          color={STATUS_CONFIG["New Tree"].color}
          sub="Appeared after first scan"
        />
        <SummaryCard
          icon={XCircle}
          count={counts["Missing Tree"]}
          label="Missing Trees"
          color={STATUS_CONFIG["Missing Tree"].color}
          sub="In first scan, absent from last"
        />
        <SummaryCard
          icon={Eye}
          count={counts.Monitoring}
          label="Monitoring"
          color={STATUS_CONFIG.Monitoring.color}
          sub="Single scan or new sector"
        />
      </div>

      {/* Algorithm explainer
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 flex gap-3 text-sm">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-muted-foreground space-y-1 text-xs leading-relaxed">
          <p>
            <span className="font-semibold text-foreground">How change is detected: </span>
            Each sector is analyzed independently. The system compares the <em>first scan</em> and <em>last scan</em>
            within each sector. Trees in both = Stable. Only in last = New. Only in first = Missing.
          </p>
          <p>
            <span className="font-semibold text-foreground">New sectors: </span>
            When you upload a new sector (e.g., Sector D), it has no baseline yet, so all trees are marked{" "}
            <span className="font-medium" style={{ color: STATUS_CONFIG.Monitoring.hex }}>Monitoring</span>{" "}
            until you upload a second scan of that same sector. Other sectors remain unaffected.
          </p>
          <p>
            <span className="font-semibold text-foreground">Adding new scans to existing sectors: </span>
            When you add a new scan for an existing sector (e.g., Sector A on a new date), only trees within 
            Sector A are compared. Trees from other sectors are never marked as missing. 
            Hover the <span className="font-medium">ⓘ</span> icon on any row for the exact reason.
          </p>
        </div>
      </div> */}

      {/* Pie chart */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-4">Forest Status Distribution</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={95}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {pieData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={STATUS_CONFIG[entry.name as ChangeStatus]?.hex ?? "#888"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [value, STATUS_CONFIG[name as ChangeStatus]?.label ?? name]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Per-Sector Breakdown */}
      {sectorBreakdown.length > 0 && (
        <div className="stat-card space-y-4">
          <div>
            <h3 className="font-display font-semibold text-foreground">Change Status by Sector</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each sector is evaluated independently — a new sector being added never affects the
              change status of existing sectors.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Sector", "Total Trees", "Stable", "New Tree", "Missing Tree", "Monitoring"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectorBreakdown.map((row, i) => (
                  <tr key={row.sector} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-2.5 font-semibold">{row.sector}</td>
                    <td className="px-4 py-2.5 tabular-nums">{row.total}</td>
                    <td className="px-4 py-2.5">
                      {row.Stable > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_CONFIG.Stable.hex }} />
                          {row.Stable}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {row["New Tree"] > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_CONFIG["New Tree"].hex }} />
                          {row["New Tree"]}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {row["Missing Tree"] > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_CONFIG["Missing Tree"].hex }} />
                          {row["Missing Tree"]}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.Monitoring > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_CONFIG.Monitoring.hex }} />
                          {row.Monitoring}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="stat-card p-0 overflow-hidden rounded-xl">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-semibold text-foreground">Spatial Change Map</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Click any marker for details</p>
          </div>

          {/* Map filters row */}
          <div className="flex flex-col gap-2 items-end">
            {/* Sector filter */}
            {sectorBreakdown.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                {["All", ...sectorBreakdown.map(s => s.sector)].map(s => (
                  <button
                    key={s}
                    onClick={() => setMapSectorFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      mapSectorFilter === s
                        ? "bg-foreground text-background border-transparent"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s === "All" ? "All Sectors" : `Sector ${s}`}
                  </button>
                ))}
              </div>
            )}
          {/* Map status filter */}
          <div className="flex flex-wrap gap-1.5">
            {(["All", "Stable", "New Tree", "Missing Tree", "Monitoring"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setMapStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  mapStatusFilter === s
                    ? "text-white border-transparent"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                }`}
                style={
                  mapStatusFilter === s && s !== "All"
                    ? { background: STATUS_CONFIG[s].hex, borderColor: "transparent" }
                    : mapStatusFilter === s
                    ? { background: "hsl(var(--foreground))", color: "hsl(var(--background))" }
                    : {}
                }
              >
                {s === "All" ? "All" : `${s} (${counts[s] ?? 0})`}
              </button>
            ))}
          </div>
          </div>{/* end flex-col wrapper around sector+status filters */}
        </div>

        {/* Legend row */}
        <div className="px-4 pb-2 flex flex-wrap gap-3">
          {(Object.entries(STATUS_CONFIG) as [ChangeStatus, typeof STATUS_CONFIG[ChangeStatus]][]).map(([k, v]) => (
            counts[k] > 0 && (
              <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: v.hex }}
                />
                {v.label}
              </span>
            )
          ))}
        </div>

        <MapContainer
          center={center}
          zoom={15}
          style={{ height: "520px", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapPoints.map((tree, i) => {
            const cfg = STATUS_CONFIG[tree.Status];
            return (
              <CircleMarker
                key={`${tree.Tree_ID}-${i}`}
                center={[tree.Latitude, tree.Longitude]}
                radius={cfg.radius}
                pathOptions={{
                  color: cfg.hex,
                  fillColor: cfg.hex,
                  fillOpacity: 0.85,
                  weight: 1.5,
                }}
              >
                <Popup maxWidth={280}>
                  <div className="space-y-1.5 text-sm p-1">
                    <p className="font-semibold font-mono text-xs">{tree.Tree_ID}</p>
                    <p className="text-muted-foreground italic">{tree.Species}</p>
                    <div>
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-semibold"
                        style={{ background: cfg.hex }}
                      >
                        {tree.Status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Sector: {tree.Sector}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tree.Latitude.toFixed(6)}, {tree.Longitude.toFixed(6)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Scans: {tree.ScanLabels.join(" → ")}
                    </p>
                    <hr className="border-border" />
                    <p className="text-[11px] text-gray-500 leading-relaxed">{tree.Reason}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Change table */}
      <div className="stat-card space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display font-semibold text-foreground">Tree Change Table</h3>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                className="rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Search Tree ID, Species, Sector…"
                value={tableQuery}
                onChange={(e) => { setTableQuery(e.target.value); setTablePage(1); }}
              />
            </div>
            {/* Status filter */}
            <select
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={tableStatusFilter}
              onChange={(e) => { setTableStatusFilter(e.target.value as any); setTablePage(1); }}
            >
              <option value="All">All Statuses</option>
              <option value="Stable">Stable</option>
              <option value="New Tree">New Tree</option>
              <option value="Missing Tree">Missing Tree</option>
              <option value="Monitoring">Monitoring</option>
            </select>
            {/* Sector filter */}
            <select
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={tableSectorFilter}
              onChange={(e) => { setTableSectorFilter(e.target.value); setTablePage(1); }}
            >
              {allSectors.map(s => (
                <option key={s} value={s}>{s === "All" ? "All Sectors" : `Sector ${s}`}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {filteredTable.length.toLocaleString()} records
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Tree ID", "Species", "Sector", "Scans", "Scan Dates", "Lat", "Lng", "Status", "Why"].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablePageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    No records match the current filters.
                  </td>
                </tr>
              ) : tablePageRows.map((r, i) => (
                <tr key={`${r.Tree_ID}-${i}`} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 font-mono font-medium whitespace-nowrap">{r.Tree_ID}</td>
                  <td className="py-2 px-3 text-muted-foreground italic whitespace-nowrap">{r.Species}</td>
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{r.Sector}</td>
                  <td className="py-2 px-3 text-center">{r.ScanCount}</td>
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{r.ScanLabels.join(", ")}</td>
                  <td className="py-2 px-3 tabular-nums">{r.Latitude.toFixed(5)}</td>
                  <td className="py-2 px-3 tabular-nums">{r.Longitude.toFixed(5)}</td>
                  <td className="py-2 px-3"><StatusBadge status={r.Status} /></td>
                  <td className="py-2 px-3"><ReasonTooltip reason={r.Reason} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table pagination */}
        {totalTablePages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {tablePage} of {totalTablePages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTablePage(p => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalTablePages) }, (_, i) => {
                let pg: number;
                if (totalTablePages <= 5)          pg = i + 1;
                else if (tablePage <= 3)           pg = i + 1;
                else if (tablePage >= totalTablePages - 2) pg = totalTablePages - 4 + i;
                else                               pg = tablePage - 2 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setTablePage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      pg === tablePage
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
                disabled={tablePage === totalTablePages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForestChangePage;
