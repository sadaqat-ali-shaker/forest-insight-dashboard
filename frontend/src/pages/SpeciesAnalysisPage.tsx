import { useMemo } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { speciesSummary } from "@/lib/analysis";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BoxPlot } from "recharts";
import { BarChart2 } from "lucide-react";

const SpeciesAnalysisPage = () => {
  const { trees } = useCsvData();
  const speciesDf = useMemo(() => speciesSummary(trees), [trees]);

  const heightData = speciesDf.map(s => ({ Species: s.Species.split(" ").pop(), Avg_Height: +s.Avg_Height.toFixed(2) }));
  const dbhData    = speciesDf.map(s => ({ Species: s.Species.split(" ").pop(), Avg_DBH: +s.Avg_DBH.toFixed(2) }));
  const bioData    = speciesDf.map(s => ({ Species: s.Species.split(" ").pop(), Total_Biomass: +s.Total_Biomass.toFixed(0) }));

  // Box data for height distribution
  const bySpecies: Record<string, number[]> = {};
  for (const t of trees) {
    if (!bySpecies[t.Species]) bySpecies[t.Species] = [];
    bySpecies[t.Species].push(t.Height);
  }
  const boxData = Object.entries(bySpecies).map(([sp, vals]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.floor(p * sorted.length)];
    return {
      Species: sp.split(" ").pop(),
      min: +sorted[0].toFixed(2),
      q1: +q(0.25).toFixed(2),
      median: +q(0.5).toFixed(2),
      q3: +q(0.75).toFixed(2),
      max: +sorted[sorted.length - 1].toFixed(2),
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground"> Species Analysis</h1>
        <p className="text-muted-foreground mt-1">Per-species breakdown of height, DBH, and biomass</p>
      </div>

      {/* Summary table */}
      <div className="stat-card overflow-auto">
        <h3 className="font-display font-semibold text-foreground mb-4">Species Summary Table</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Species","Count","Avg Height (m)","Avg Crown Dia","Avg DBH (cm)","Avg Biomass (kg)","Total Biomass (kg)"].map(h => (
                <th key={h} className="text-left py-2.5 px-3 font-semibold text-foreground whitespace-nowrap text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {speciesDf.map(s => (
              <tr key={s.Species} className="border-b border-border/30 hover:bg-muted/40">
                <td className="py-2 px-3 font-medium text-foreground text-xs">{s.Species}</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">{s.Count}</td>
                <td className="py-2 px-3 text-xs">{s.Avg_Height.toFixed(2)}</td>
                <td className="py-2 px-3 text-xs">{s.Avg_CrownDia.toFixed(2)}</td>
                <td className="py-2 px-3 text-xs">{s.Avg_DBH.toFixed(2)}</td>
                <td className="py-2 px-3 text-xs">{s.Avg_Biomass.toFixed(0)}</td>
                <td className="py-2 px-3 text-xs font-medium">{s.Total_Biomass.toLocaleString("en", { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Average Height per Species</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={heightData} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
              <XAxis dataKey="Species" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} unit="m" />
              <Tooltip formatter={(v: number) => [`${v} m`]} />
              <Bar dataKey="Avg_Height" fill="hsl(152,45%,32%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Average DBH per Species</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dbhData} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
              <XAxis dataKey="Species" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} unit="cm" />
              <Tooltip formatter={(v: number) => [`${v} cm`]} />
              <Bar dataKey="Avg_DBH" fill="hsl(210,60%,50%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Total Biomass per Species</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bioData} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
              <XAxis dataKey="Species" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} kg`]} />
              <Bar dataKey="Total_Biomass" fill="hsl(38,75%,45%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Height Distribution by Species (Min / Q1 / Median / Q3 / Max)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={boxData} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
              <XAxis dataKey="Species" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} unit="m" />
              <Tooltip />
              <Bar dataKey="min"    name="Min"    stackId="a" fill="hsl(210,60%,75%)" />
              <Bar dataKey="q1"     name="Q1"     stackId="a" fill="hsl(152,45%,50%)" />
              <Bar dataKey="median" name="Median" stackId="a" fill="hsl(152,45%,32%)" />
              <Bar dataKey="q3"     name="Q3"     stackId="a" fill="hsl(38,75%,55%)" />
              <Bar dataKey="max"    name="Max"    stackId="a" fill="hsl(0,60%,60%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SpeciesAnalysisPage;
