import { useMemo } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { computeGrowth, scanAverages } from "@/lib/analysis";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const COLORS = ["hsl(152,45%,32%)","hsl(38,75%,55%)","hsl(210,60%,50%)","hsl(280,45%,50%)","hsl(0,60%,50%)","hsl(60,60%,45%)"];

function pctChange(old: number, nw: number): number | null {
  if (!old || isNaN(old) || isNaN(nw)) return null;
  return ((nw - old) / Math.abs(old)) * 100;
}

function GrowthBadge({ label, val }: { label: string; val: number | null }) {
  const isPos = val !== null && val >= 0;
  const isNeg = val !== null && val < 0;
  return (
    <div className={`stat-card border rounded-xl p-4 text-center ${isPos ? "bg-emerald-50 border-emerald-200" : isNeg ? "bg-red-50 border-red-200" : "bg-muted/40"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center justify-center gap-1">
        {isPos ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : isNeg ? <TrendingDown className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4 text-muted-foreground" />}
        <span className="text-xl font-display font-bold" style={{ color: isPos ? "hsl(152,45%,32%)" : isNeg ? "hsl(0,72%,51%)" : "inherit" }}>
          {val !== null ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}%` : "N/A"}
        </span>
      </div>
    </div>
  );
}

const SeasonalGrowthPage = () => {
  const { trees } = useCsvData();
  const growthDf = useMemo(() => computeGrowth(trees), [trees]);
  const scans    = useMemo(() => scanAverages(trees), [trees]);

  // Scatter data grouped by species
  const species = [...new Set(growthDf.map(g => g.Species))];
  const scatterBiomass = species.map((sp, i) => ({
    name: sp,
    color: COLORS[i % COLORS.length],
    data: growthDf.filter(g => g.Species === sp).map(g => ({ x: g.Biomass_First, y: g.Biomass_Last, id: g.Tree_ID })),
  }));

  // Slopes table
  const slopesData = growthDf.map(g => ({
    Tree_ID: g.Tree_ID,
    Species: g.Species,
    Height_Slope: g.Height_Slope !== null ? g.Height_Slope.toFixed(6) : "N/A",
    DBH_Slope: g.DBH_Slope !== null ? g.DBH_Slope.toFixed(6) : "N/A",
    Biomass_Slope: g.Biomass_Slope !== null ? g.Biomass_Slope.toFixed(4) : "N/A",
  }));

  // Outliers
  const changes = growthDf.map(g => g.Height_Change).filter(v => !isNaN(v)).sort((a, b) => a - b);
  const q05 = changes[Math.floor(0.05 * changes.length)];
  const q95 = changes[Math.floor(0.95 * changes.length)];
  const bottomOutliers = growthDf.filter(g => g.Height_Change <= q05);
  const topOutliers    = growthDf.filter(g => g.Height_Change >= q95);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground"> Seasonal Growth</h1>
        <p className="text-muted-foreground mt-1">Scan-to-scan growth indicators, slopes, and outliers</p>
      </div>

      {/* Scan-to-scan indicators */}
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-2">📊 Scan-to-Scan Growth Indicators</h2>
        <p className="text-sm text-muted-foreground mb-4">Average percentage change in Height, DBH, and Biomass between consecutive scans across all trees.</p>
        {scans.length < 2 ? (
          <p className="text-muted-foreground">At least 2 scan dates required.</p>
        ) : (
          <div className="space-y-4">
            {scans.slice(1).map((curr, i) => {
              const prev = scans[i];
              return (
                <div key={i}>
                  <p className="text-sm font-semibold text-foreground mb-2">🗓️ {prev.label} → {curr.label}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <GrowthBadge label="🌿 Avg Height Change"  val={pctChange(prev.Height,  curr.Height)} />
                    <GrowthBadge label="🪵 Avg DBH Change"     val={pctChange(prev.DBH,     curr.DBH)} />
                    <GrowthBadge label="🌱 Avg Biomass Change" val={pctChange(prev.Biomass, curr.Biomass)} />
                  </div>
                  {i < scans.length - 2 && <hr className="mt-4 border-border/40" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Biomass scatter */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-1">Biomass: First vs Last</h3>
        <p className="text-xs text-muted-foreground mb-4">Each dot = one tree, colored by species</p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
            <XAxis type="number" dataKey="x" name="First Biomass" unit=" kg" tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="Last Biomass" unit=" kg" tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => payload?.[0] ? (
              <div className="bg-white border border-border rounded p-2 text-xs shadow">
                <p>{payload[0].payload.id}</p>
                <p>First: {payload[0].payload.x?.toFixed(1)} kg</p>
                <p>Last: {payload[0].payload.y?.toFixed(1)} kg</p>
              </div>
            ) : null} />
            <Legend />
            {scatterBiomass.map(s => (
              <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} opacity={0.7} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Slopes table */}
      <div className="stat-card overflow-auto">
        <h3 className="font-display font-semibold text-foreground mb-4">Slopes (Growth Rates)</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Tree ID","Species","Height Slope","DBH Slope","Biomass Slope"].map(h => (
                <th key={h} className="text-left py-2 px-3 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slopesData.map(r => (
              <tr key={r.Tree_ID} className="border-b border-border/30 hover:bg-muted/40">
                <td className="py-1.5 px-3 font-medium">{r.Tree_ID}</td>
                <td className="py-1.5 px-3 text-muted-foreground">{r.Species}</td>
                <td className="py-1.5 px-3">{r.Height_Slope}</td>
                <td className="py-1.5 px-3">{r.DBH_Slope}</td>
                <td className="py-1.5 px-3">{r.Biomass_Slope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Outliers */}
      <div className="space-y-4">
        <h3 className="font-display font-semibold text-foreground">Outliers (Height Change — Bottom/Top 5%)</h3>
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Bottom 5% (height decrease / low growth)</p>
          <div className="stat-card overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">{["Tree ID","Species","Height Change","Growth Category"].map(h => <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{bottomOutliers.map(r => <tr key={r.Tree_ID} className="border-b border-border/30 hover:bg-muted/40"><td className="py-1.5 px-3">{r.Tree_ID}</td><td className="py-1.5 px-3 text-muted-foreground">{r.Species}</td><td className="py-1.5 px-3 text-red-600">{r.Height_Change.toFixed(3)} m</td><td className="py-1.5 px-3">{r.Growth_Category}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Top 5% (large height increase)</p>
          <div className="stat-card overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">{["Tree ID","Species","Height Change","Growth Category"].map(h => <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{topOutliers.map(r => <tr key={r.Tree_ID} className="border-b border-border/30 hover:bg-muted/40"><td className="py-1.5 px-3">{r.Tree_ID}</td><td className="py-1.5 px-3 text-muted-foreground">{r.Species}</td><td className="py-1.5 px-3 text-emerald-600">{r.Height_Change.toFixed(3)} m</td><td className="py-1.5 px-3">{r.Growth_Category}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonalGrowthPage;
