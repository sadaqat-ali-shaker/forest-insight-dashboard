import { useMemo } from "react";
import { sampleTrees } from "@/lib/mock-data";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Leaf, Weight, Atom } from "lucide-react";

const BiomassPage = () => {
  const stats = useMemo(() => {
    const totalBiomass = sampleTrees.reduce((s, t) => s + t.Biomass, 0);
    const totalCarbon = sampleTrees.reduce((s, t) => s + t.Carbon, 0);
    return {
      totalBiomass: totalBiomass.toFixed(1),
      totalCarbon: totalCarbon.toFixed(1),
      avgBiomass: (totalBiomass / sampleTrees.length).toFixed(1),
    };
  }, []);

  // Height histogram bins
  const heightBins = useMemo(() => {
    const bins: Record<string, number> = {};
    sampleTrees.forEach((t) => {
      const bin = `${Math.floor(t.Height / 5) * 5}-${Math.floor(t.Height / 5) * 5 + 5}`;
      bins[bin] = (bins[bin] || 0) + 1;
    });
    return Object.entries(bins).map(([range, count]) => ({ range, count })).sort((a, b) => parseInt(a.range) - parseInt(b.range));
  }, []);

  // Biomass distribution bins
  const biomassBins = useMemo(() => {
    const bins: Record<string, number> = {};
    sampleTrees.forEach((t) => {
      const bin = `${Math.floor(t.Biomass / 50) * 50}-${Math.floor(t.Biomass / 50) * 50 + 50}`;
      bins[bin] = (bins[bin] || 0) + 1;
    });
    return Object.entries(bins).map(([range, count]) => ({ range, count })).sort((a, b) => parseInt(a.range) - parseInt(b.range));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Biomass & Carbon Estimation</h1>
        <p className="text-muted-foreground mt-1">Calculated using allometric equations (Biomass = 0.0673 × DBH²·⁰⁷⁷³)</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Weight, label: "Total Biomass", value: `${stats.totalBiomass} kg`, gradient: "gradient-forest" },
          { icon: Atom, label: "Total Carbon", value: `${stats.totalCarbon} kg`, gradient: "gradient-amber" },
          { icon: Leaf, label: "Avg Biomass/Tree", value: `${stats.avgBiomass} kg`, gradient: "gradient-forest" },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${s.gradient} flex items-center justify-center`}>
              <s.icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Tree Height Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={heightBins}>
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(140 15% 88%)", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="count" fill="hsl(152, 45%, 28%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Biomass Distribution (kg)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={biomassBins}>
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(140 15% 88%)", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="count" fill="hsl(38, 75%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default BiomassPage;
