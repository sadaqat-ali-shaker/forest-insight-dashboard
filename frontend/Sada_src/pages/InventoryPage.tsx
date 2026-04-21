import { sampleTrees } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Download, Map } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#d4a373", "#e9c46a"];

const InventoryPage = () => {
  const exportCSV = () => {
    const headers = "Tree_ID,Height,DBH,Biomass,Crown_Diameter\n";
    const rows = sampleTrees.map((t) => `${t.Tree_ID},${t.Height},${t.DBH},${t.Biomass},${t.Crown_Diameter}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forest_inventory.csv";
    a.click();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Forest Inventory Dashboard</h1>
          <p className="text-muted-foreground mt-1">Complete tree inventory with all measured attributes</p>
        </div>
        <Button onClick={exportCSV} className="gradient-forest text-primary-foreground border-0 gap-2">
          <Download className="h-4 w-4" /> Download Inventory
        </Button>
      </div>

      {/* Distribution map */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-4">
          <Map className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Tree Distribution Map</h3>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
            <XAxis type="number" dataKey="X" name="X" unit="m" tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="Y" name="Y" unit="m" tick={{ fontSize: 11 }} />
            <ZAxis type="number" dataKey="Biomass" range={[30, 300]} name="Biomass" unit="kg" />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                    <p className="font-semibold text-foreground">{d.Tree_ID}</p>
                    <p className="text-muted-foreground">{d.Species} • {d.Height}m</p>
                    <p className="text-muted-foreground">Biomass: {d.Biomass}kg</p>
                  </div>
                );
              }}
            />
            <Scatter data={sampleTrees}>
              {sampleTrees.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory table */}
      <div className="stat-card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Tree ID", "Species", "Height (m)", "DBH (cm)", "Biomass (kg)", "Crown Diameter (m)"].map((h) => (
                <th key={h} className="text-left py-2.5 px-4 font-semibold text-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleTrees.map((t) => (
              <tr key={t.Tree_ID} className="border-b border-border/30 hover:bg-muted/40 transition-colors">
                <td className="py-2 px-4 font-medium text-foreground">{t.Tree_ID}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.Species}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.Height}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.DBH}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.Biomass}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.Crown_Diameter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryPage;
