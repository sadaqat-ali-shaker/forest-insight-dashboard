import { useMemo } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { computeGrowth, speciesSummary, scanAverages } from "@/lib/analysis";
import { TreePine, Leaf, Ruler, BarChart2, CircleDot, Sprout } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
  PieChart, Pie, Legend,
} from "recharts";

const COLORS = [
  "#2d8a57","#d4883b","#3b7fd4","#9b59b6",
  "#d93b3b","#c9b30a","#1a9999","#c0392b",
  "#27ae60","#e67e22","#2980b9",
];

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="stat-card flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color }}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xl font-display font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Custom label renderer — only show label if slice is big enough
const RADIAN = Math.PI / 180;
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  if (percent < 0.03) return null; // skip slices < 3%
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central"
      fontSize={11} fill="#555">
      {`${name.split(" ").pop()} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
}

const OverviewPage = () => {
  const { trees } = useCsvData();

  const growthDf  = useMemo(() => computeGrowth(trees), [trees]);
  const speciesDf = useMemo(() => speciesSummary(trees), [trees]);
  const scans     = useMemo(() => scanAverages(trees), [trees]);

  // ── Metrics ────────────────────────────────────────────────────────────────

  const totalTrees   = growthDf.length;
  const totalSpecies = speciesDf.length;

  // Average metrics across ALL records
  const avgHeight = (trees.reduce((s, t) => s + t.Height, 0) / trees.length).toFixed(2);
  const avgCrown  = (trees.reduce((s, t) => s + t.CrownDiameter, 0) / trees.length).toFixed(2);
  const avgDBH    = (trees.reduce((s, t) => s + t.Predicted_DBH, 0) / trees.length).toFixed(2);

  // Latest scan total biomass (most recent date)
  const latestBiomass = useMemo(() => {
    if (!trees.length) return 0;
    const maxTs = Math.max(...trees.map(t => t.Date.getTime()));
    return trees
      .filter(t => t.Date.getTime() === maxTs)
      .reduce((s, t) => s + t.Biomass_kg, 0);
  }, [trees]);

  // ── Height over time (mean per scan) ──────────────────────────────────────
  const heightData = scans.map(s => ({
    date: s.label,
    "Avg Height (m)": +s.Height.toFixed(3),
  }));

  // ── Total Biomass per scan month (SUM not mean) ────────────────────────────
  const biomassData = useMemo(() => {
    const byDate = new Map<number, { label: string; total: number }>();
    for (const t of trees) {
      const k = t.Date.getTime();
      if (!byDate.has(k)) {
        byDate.set(k, {
          label: t.Date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          total: 0,
        });
      }
      byDate.get(k)!.total += t.Biomass_kg;
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        date: v.label,
        "Total Biomass (kg)": Math.round(v.total),
      }));
  }, [trees]);

  // ── Pie data (species distribution by unique tree count) ──────────────────
  const pieData = speciesDf.map((s, i) => ({
    name: s.Species,
    value: s.Count,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">🌲 AI Based Forest Inventory — Overview</h1>
        <p className="text-muted-foreground mt-1">Summary statistics and key forest metrics</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={TreePine}  label="Total Trees"         value={String(totalTrees)}   color="hsl(152,45%,32%)" />
        <StatCard icon={Sprout}    label="Total Species"       value={String(totalSpecies)} color="hsl(210,60%,50%)" />
        <StatCard icon={Ruler}     label="Avg Height (m)"      value={avgHeight}            color="hsl(38,75%,45%)" />
        <StatCard icon={CircleDot} label="Avg Crown Dia (m)"   value={avgCrown}             color="hsl(280,45%,50%)" />
        <StatCard icon={BarChart2} label="Avg DBH (cm)"        value={avgDBH}               color="hsl(0,60%,50%)" />
        <StatCard icon={Leaf}      label="Latest Biomass (kg)" value={latestBiomass.toLocaleString("en", { maximumFractionDigits: 0 })} color="hsl(152,55%,38%)" />
      </div>

      {/* Species Distribution Pie */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-4">Species Distribution</h3>
        <ResponsiveContainer width="100%" height={380}>
          <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={130}
              labelLine={false}
              label={renderCustomLabel}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
            />
            <Tooltip formatter={(value: number, name: string) => [
              `${value} trees (${((value / totalTrees) * 100).toFixed(0)}%)`, name
            ]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Time series charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-1">Average Height Over Time</h3>
          <p className="text-xs text-muted-foreground mb-4">Mean tree height per scan date</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={heightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" m" domain={["auto","auto"]} />
              <Tooltip formatter={(v: number) => [`${v} m`, "Avg Height"]} />
              <Line type="monotone" dataKey="Avg Height (m)" stroke="hsl(152,45%,32%)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-1">Total Biomass Per Scan Month</h3>
          <p className="text-xs text-muted-foreground mb-4">Sum of all tree biomass at each scan date</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={biomassData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} kg`, "Total Biomass"]} />
              <Bar dataKey="Total Biomass (kg)" radius={[4,4,0,0]}>
                {biomassData.map((_, i) => (
                  <Cell key={i} fill={i === biomassData.length - 1 ? "hsl(152,55%,38%)" : "hsl(38,75%,45%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
