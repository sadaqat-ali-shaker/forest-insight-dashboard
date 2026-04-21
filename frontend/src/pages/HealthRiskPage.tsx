import { useMemo, useState } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { computeGrowth, computeRisk } from "@/lib/analysis";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RISK_COLORS = { Low: "hsl(152,45%,38%)", Medium: "hsl(38,75%,55%)", High: "hsl(30,85%,50%)", Critical: "hsl(0,72%,51%)" };

const HealthRiskPage = () => {
  const { trees } = useCsvData();
  const growthDf = useMemo(() => computeGrowth(trees), [trees]);
  const riskDf   = useMemo(() => computeRisk(growthDf), [growthDf]);

  const riskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of riskDf) counts[r.Risk_Level] = (counts[r.Risk_Level] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [riskDf]);

  const treeIds = useMemo(() => growthDf.map(g => g.Tree_ID), [growthDf]);
  const [chosenTree, setChosenTree] = useState(treeIds[0] || "");

  const trace = useMemo(() =>
    trees.filter(t => t.Tree_ID === chosenTree).sort((a, b) => a.Date.getTime() - b.Date.getTime())
      .map(t => ({
        date: t.Date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
        Height: +t.Height.toFixed(3),
        Biomass: +t.Biomass_kg.toFixed(1),
      })),
    [trees, chosenTree]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">📌 Health & Risk Assessment</h1>
        <p className="text-muted-foreground mt-1">Composite risk scoring based on growth, DBH, and biomass changes</p>
      </div>

      {/* Risk summary pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Risk Level Summary</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={riskCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                {riskCounts.map((entry, i) => (
                  <Cell key={i} fill={RISK_COLORS[entry.name as keyof typeof RISK_COLORS] || "hsl(200,40%,50%)"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card flex flex-col gap-3 justify-center">
          {Object.entries(RISK_COLORS).map(([level, color]) => {
            const count = riskDf.filter(r => r.Risk_Level === level).length;
            const pct = ((count / riskDf.length) * 100).toFixed(1);
            return (
              <div key={level} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <span className="font-medium text-foreground w-16 text-sm">{level}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="text-sm text-muted-foreground w-20 text-right">{count} trees ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk table */}
      <div className="stat-card overflow-auto">
        <h3 className="font-display font-semibold text-foreground mb-4">Risk Table</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Tree ID","Species","Height Δ","DBH Δ","Biomass Δ","Risk Score","Risk Level"].map(h => (
                <th key={h} className="text-left py-2 px-3 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riskDf.map(r => (
              <tr key={r.Tree_ID} className="border-b border-border/30 hover:bg-muted/40">
                <td className="py-1.5 px-3 font-medium">{r.Tree_ID}</td>
                <td className="py-1.5 px-3 text-muted-foreground">{r.Species}</td>
                <td className={`py-1.5 px-3 ${r.Height_Change >= 0 ? "text-emerald-600" : "text-red-500"}`}>{r.Height_Change.toFixed(3)}</td>
                <td className={`py-1.5 px-3 ${r.DBH_Change >= 0 ? "text-emerald-600" : "text-red-500"}`}>{r.DBH_Change.toFixed(3)}</td>
                <td className={`py-1.5 px-3 ${r.Biomass_Change >= 0 ? "text-emerald-600" : "text-red-500"}`}>{r.Biomass_Change.toFixed(1)}</td>
                <td className="py-1.5 px-3 font-medium">{r.Risk_Score}</td>
                <td className="py-1.5 px-3">
                  <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
                    style={{ background: RISK_COLORS[r.Risk_Level] }}>
                    {r.Risk_Level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Individual tree inspector */}
      <div className="space-y-4">
        <h3 className="font-display font-semibold text-foreground">Inspect Tree — Time Series</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Select Tree:</span>
          <Select value={chosenTree} onValueChange={setChosenTree}>
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {treeIds.map(id => <SelectItem key={id} value={id}>{id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {trace.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="stat-card">
              <h4 className="font-semibold text-sm mb-3">Height over time</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trace}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="m" />
                  <Tooltip />
                  <Line type="monotone" dataKey="Height" stroke="hsl(152,45%,32%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="stat-card">
              <h4 className="font-semibold text-sm mb-3">Biomass over time</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trace}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} kg`]} />
                  <Line type="monotone" dataKey="Biomass" stroke="hsl(38,75%,45%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthRiskPage;
