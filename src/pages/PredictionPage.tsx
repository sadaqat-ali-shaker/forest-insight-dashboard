import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { sampleTrees } from "@/lib/mock-data";
import { Brain, Play, CheckCircle2, Target, TrendingUp, BarChart } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, CartesianGrid } from "recharts";

const PredictionPage = () => {
  const [predicted, setPredicted] = useState(false);

  // Simulated model metrics
  const metrics = { accuracy: 0.89, rmse: 2.34, r2: 0.92, mae: 1.87 };

  // Simulated predictions: predicted height vs actual
  const predictions = useMemo(() => {
    return sampleTrees.slice(0, 40).map((t) => ({
      actual: t.Height,
      predicted: Math.round((t.Height * (0.85 + Math.random() * 0.3)) * 100) / 100,
      id: t.Tree_ID,
    }));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Growth Prediction</h1>
        <p className="text-muted-foreground mt-1">Random Forest model for tree growth prediction</p>
      </div>

      <div className="stat-card flex items-center gap-4">
        <Brain className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <p className="font-semibold text-foreground">Random Forest Regressor</p>
          <p className="text-sm text-muted-foreground">Trained on 80% of forest inventory data • 100 estimators</p>
        </div>
        <Button
          onClick={() => setPredicted(true)}
          disabled={predicted}
          className="gradient-forest text-primary-foreground border-0 gap-2"
        >
          {predicted ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {predicted ? "Complete" : "Run Prediction"}
        </Button>
      </div>

      {predicted && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Target, label: "Accuracy", value: `${(metrics.accuracy * 100).toFixed(0)}%` },
              { icon: BarChart, label: "R² Score", value: metrics.r2.toFixed(2) },
              { icon: TrendingUp, label: "RMSE", value: `${metrics.rmse}m` },
              { icon: Target, label: "MAE", value: `${metrics.mae}m` },
            ].map((m) => (
              <div key={m.label} className="stat-card text-center space-y-1">
                <m.icon className="h-5 w-5 text-primary mx-auto" />
                <p className="text-xl font-display font-bold text-foreground">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Actual vs Predicted scatter */}
          <div className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-4">Actual vs Predicted Height</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
                <XAxis type="number" dataKey="actual" name="Actual" unit="m" tick={{ fontSize: 12 }} />
                <YAxis type="number" dataKey="predicted" name="Predicted" unit="m" tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                        <p className="font-semibold text-foreground">{d.id}</p>
                        <p className="text-muted-foreground">Actual: {d.actual}m</p>
                        <p className="text-muted-foreground">Predicted: {d.predicted}m</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={predictions} fill="hsl(152, 45%, 28%)" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Results table */}
          <div className="stat-card overflow-auto">
            <h3 className="font-display font-semibold text-foreground mb-3">Prediction Results</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 font-semibold text-foreground">Tree ID</th>
                  <th className="text-left py-2 px-4 font-semibold text-foreground">Actual Height (m)</th>
                  <th className="text-left py-2 px-4 font-semibold text-foreground">Predicted Height (m)</th>
                  <th className="text-left py-2 px-4 font-semibold text-foreground">Error (m)</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 15).map((p) => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-muted/40">
                    <td className="py-1.5 px-4 font-medium text-foreground">{p.id}</td>
                    <td className="py-1.5 px-4 text-muted-foreground">{p.actual}</td>
                    <td className="py-1.5 px-4 text-muted-foreground">{p.predicted}</td>
                    <td className="py-1.5 px-4 text-muted-foreground">{Math.abs(p.actual - p.predicted).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default PredictionPage;
