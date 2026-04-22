import { useMemo, useState } from "react";
import { useCsvData, TreeRecord } from "@/context/CsvDataContext";
import { TrendingUp, TrendingDown, Minus, MapPin } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, Legend,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(oldVal: number, newVal: number): number | null {
  if (!oldVal || isNaN(oldVal) || isNaN(newVal)) return null;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

function fmt(val: number | null): string {
  if (val === null) return "N/A";
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

function growthColor(val: number | null): string {
  if (val === null) return "hsl(var(--muted-foreground))";
  if (val > 0) return "hsl(152, 45%, 32%)";
  if (val < 0) return "hsl(0, 72%, 51%)";
  return "hsl(38, 75%, 55%)";
}

function growthBg(val: number | null): string {
  if (val === null) return "bg-muted/40";
  if (val > 0) return "bg-emerald-50 border-emerald-200";
  if (val < 0) return "bg-red-50 border-red-200";
  return "bg-amber-50 border-amber-200";
}

interface ScanPair {
  label: string;
  from: Date;
  to: Date;
}

interface SectorStats {
  sector: string;
  heightGrowth: number | null;
  biomassGrowth: number | null;
  dbhGrowth: number | null;
  overallGrowth: number | null;
  treeCount: number;
}

// ── Core computation ──────────────────────────────────────────────────────────

function computeSectorGrowth(trees: TreeRecord[], fromDate: Date, toDate: Date): SectorStats[] {
  const sectors = [...new Set(trees.map((t) => t.Sector))].filter(s => s !== "ID").sort();

  return sectors.map((sector) => {
    const sectorTrees = trees.filter((t) => t.Sector === sector);

    const avg = (arr: TreeRecord[], key: keyof TreeRecord) => {
      const vals = arr.map((t) => t[key] as number).filter((v) => !isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const fromTrees = sectorTrees.filter((t) => t.Date.getTime() === fromDate.getTime());
    const toTrees   = sectorTrees.filter((t) => t.Date.getTime() === toDate.getTime());

    if (!fromTrees.length || !toTrees.length) {
      return { sector, heightGrowth: null, biomassGrowth: null, dbhGrowth: null, overallGrowth: null, treeCount: sectorTrees.length };
    }

    const hGrowth = pct(avg(fromTrees, "Height"),       avg(toTrees, "Height"));
    const bGrowth = pct(avg(fromTrees, "Biomass_kg"),   avg(toTrees, "Biomass_kg"));
    const dGrowth = pct(avg(fromTrees, "Predicted_DBH"),avg(toTrees, "Predicted_DBH"));

    const valid   = [hGrowth, bGrowth, dGrowth].filter((v) => v !== null) as number[];
    const overall = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;

    return { sector, heightGrowth: hGrowth, biomassGrowth: bGrowth, dbhGrowth: dGrowth, overallGrowth: overall, treeCount: sectorTrees.length };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GrowthIcon({ val }: { val: number | null }) {
  if (val === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (val > 0)      return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  return <TrendingDown className="h-4 w-4 text-red-500" />;
}

function SectorCard({ stats }: { stats: SectorStats }) {
  return (
    <div className={`stat-card border rounded-xl p-4 space-y-3 ${growthBg(stats.overallGrowth)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-display font-bold text-foreground text-sm">{stats.sector}</span>
        </div>
        <span className="text-xs text-muted-foreground">{stats.treeCount} records</span>
      </div>
      <div className="flex items-center gap-2">
        <GrowthIcon val={stats.overallGrowth} />
        <span className="text-2xl font-display font-bold" style={{ color: growthColor(stats.overallGrowth) }}>
          {fmt(stats.overallGrowth)}
        </span>
        <span className="text-xs text-muted-foreground">overall</span>
      </div>
      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/40">
        {[
          { label: "Height",  val: stats.heightGrowth },
          { label: "Biomass", val: stats.biomassGrowth },
          { label: "DBH",     val: stats.dbhGrowth },
        ].map(({ label, val }) => (
          <div key={label} className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-xs font-semibold" style={{ color: growthColor(val) }}>{fmt(val)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SectorGrowthPage = () => {
  const { trees, fileName } = useCsvData();

  // Sorted unique scan dates
  const scanDates = useMemo(() => {
    const unique = [...new Set(trees.map((t) => t.Date.getTime()))];
    return unique.sort().map((ts) => new Date(ts));
  }, [trees]);

  // Consecutive scan pairs
  const scanPairs = useMemo((): ScanPair[] => {
    const pairs: ScanPair[] = [];
    for (let i = 1; i < scanDates.length; i++) {
      const from = scanDates[i - 1];
      const to   = scanDates[i];
      pairs.push({
        label: `${from.toLocaleDateString("en-GB", { month: "short", year: "numeric" })} → ${to.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`,
        from,
        to,
      });
    }
    return pairs;
  }, [scanDates]);

  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const selectedPair = scanPairs[selectedPairIdx];

  const sectorStats = useMemo(() => {
    if (!selectedPair) return [];
    return computeSectorGrowth(trees, selectedPair.from, selectedPair.to);
  }, [trees, selectedPair]);

  const chartData = useMemo(() =>
    sectorStats.map((s) => ({
      sector:  s.sector,
      Height:  s.heightGrowth  !== null ? parseFloat(s.heightGrowth.toFixed(2))  : 0,
      Biomass: s.biomassGrowth !== null ? parseFloat(s.biomassGrowth.toFixed(2)) : 0,
      DBH:     s.dbhGrowth     !== null ? parseFloat(s.dbhGrowth.toFixed(2))     : 0,
      Overall: s.overallGrowth !== null ? parseFloat(s.overallGrowth.toFixed(2)) : 0,
    })),
    [sectorStats]
  );

  const growing  = sectorStats.filter((s) => (s.overallGrowth ?? 0) > 0).length;
  const declining = sectorStats.filter((s) => (s.overallGrowth ?? 0) < 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Sector Growth Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Scan-to-scan growth % per sector ·{" "}
            <span className="font-medium text-foreground">{fileName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Scan Period:</span>
          <Select value={String(selectedPairIdx)} onValueChange={(v) => setSelectedPairIdx(Number(v))}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scanPairs.map((p, i) => (
                <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-forest flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{sectorStats.length}</p>
            <p className="text-sm text-muted-foreground">Total Sectors</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{growing}</p>
            <p className="text-sm text-muted-foreground">Growing Sectors</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
            <TrendingDown className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{declining}</p>
            <p className="text-sm text-muted-foreground">Declining Sectors</p>
          </div>
        </div>
      </div>

      {/* Sector cards */}
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">
          📍 Sector Summary — {selectedPair?.label}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sectorStats.map((s) => <SectorCard key={s.sector} stats={s} />)}
        </div>
      </div>

      {/* Overall growth bar chart */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-1">Overall Growth % by Sector</h3>
        <p className="text-xs text-muted-foreground mb-4">Average of Height, Biomass and DBH growth rates</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
            <XAxis dataKey="sector" tick={{ fontSize: 12 }} />
            <YAxis unit="%" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val: number) => [`${val.toFixed(2)}%`]}
              contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(140 15% 88%)", borderRadius: "8px", fontSize: "12px" }}
            />
            <Bar dataKey="Overall" name="Overall Growth %" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.Overall >= 0 ? "hsl(152, 45%, 32%)" : "hsl(0, 72%, 51%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grouped breakdown chart */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-1">Growth Breakdown by Metric &amp; Sector</h3>
        <p className="text-xs text-muted-foreground mb-4">Height, Biomass, and DBH growth % side by side</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
            <XAxis dataKey="sector" tick={{ fontSize: 12 }} />
            <YAxis unit="%" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val: number, name: string) => [`${val.toFixed(2)}%`, name]}
              contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(140 15% 88%)", borderRadius: "8px", fontSize: "12px" }}
            />
            <Legend />
            <Bar dataKey="Height"  name="Height"  fill="hsl(152, 45%, 38%)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Biomass" name="Biomass" fill="hsl(38, 75%, 55%)"  radius={[3, 3, 0, 0]} />
            <Bar dataKey="DBH"     name="DBH"     fill="hsl(210, 60%, 50%)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <div className="stat-card overflow-auto">
        <h3 className="font-display font-semibold text-foreground mb-4">Sector Growth Table</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Sector", "Records", "Height Growth", "Biomass Growth", "DBH Growth", "Overall Growth"].map((h) => (
                <th key={h} className="text-left py-2.5 px-4 font-semibold text-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectorStats.map((s) => (
              <tr key={s.sector} className="border-b border-border/30 hover:bg-muted/40 transition-colors">
                <td className="py-2 px-4 font-medium text-foreground">{s.sector}</td>
                <td className="py-2 px-4 text-muted-foreground">{s.treeCount}</td>
                {[s.heightGrowth, s.biomassGrowth, s.dbhGrowth, s.overallGrowth].map((val, i) => (
                  <td key={i} className="py-2 px-4 font-medium" style={{ color: growthColor(val) }}>
                    <span className="flex items-center gap-1">
                      <GrowthIcon val={val} />
                      {fmt(val)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SectorGrowthPage;
