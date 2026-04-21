import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { TreePine, Ruler, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const COLORS = [
  "#2d6a4f","#40916c","#52b788","#74c69d",
  "#95d5b2","#b7e4c7","#d4a373","#e9c46a"
];

type TreePoint = {
  Easting: number;
  Northing: number;
  Tree_Height: number;
};

const SegmentationPage = () => {

  const navigate = useNavigate();

  const [trees, setTrees] = useState<TreePoint[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    avgHeight: 0,
    maxHeight: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const plot = localStorage.getItem("currentPlot");

  useEffect(() => {

    if (!plot) {
      setError("No plot selected");
      setLoading(false);
      return;
    }

    fetch(`http://127.0.0.1:8081/segmentation/${plot}`)
      .then(res => res.json())
      .then(data => {

        if (data.error) {
          throw new Error(data.error);
        }

        setTrees(data.points || []);

        setStats({
          total: data.trees || 0,
          avgHeight: data.avg_height || 0,
          maxHeight: data.max_height || 0
        });

        setLoading(false);

      })
      .catch(() => {
        setError("Failed to load segmentation data");
        setLoading(false);
      });

  }, []);

  const scatterData = trees.map((t, i) => ({
    x: t.Easting,
    y: t.Northing,
    z: t.Tree_Height,
    id: `Tree-${i + 1}`
  }));

  const handleReset = async () => {
    if (!plot) return;

    await fetch(`http://127.0.0.1:8081/reset/${plot}`, {
      method: "DELETE"
    });

    localStorage.removeItem("currentPlot");
    navigate("/upload");
  };

  if (loading) {
    return <div className="p-6">Loading segmentation...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Tree Segmentation
          </h1>
          <p className="text-muted-foreground mt-1">
            Plot: {plot}
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => navigate("/features")}>
            Next → Features
          </Button>

          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-forest flex items-center justify-center">
            <TreePine className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">
              {stats.total}
            </p>
            <p className="text-sm text-muted-foreground">
              Trees Detected
            </p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-amber flex items-center justify-center">
            <Ruler className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">
              {Number(stats.avgHeight).toFixed(1)} m
            </p>
            <p className="text-sm text-muted-foreground">
              Average Height
            </p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-forest flex items-center justify-center">
            <ArrowUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">
              {Number(stats.maxHeight).toFixed(1)} m
            </p>
            <p className="text-sm text-muted-foreground">
              Maximum Height
            </p>
          </div>
        </div>

      </div>

      {/* Scatter */}
      <div className="stat-card">

        <h3 className="font-display font-semibold mb-4">
          Tree Centroid Map
        </h3>

        <ResponsiveContainer width="100%" height={450}>
          <ScatterChart>

            <XAxis type="number" dataKey="x" name="X" />
            <YAxis type="number" dataKey="y" name="Y" />
            <ZAxis type="number" dataKey="z" range={[40, 400]} />

            <Tooltip />

            <Scatter data={scatterData}>
              {scatterData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Scatter>

          </ScatterChart>
        </ResponsiveContainer>

      </div>

      {/* 3D Viewer */}
      <div className="stat-card">

        <h3 className="font-display font-semibold mb-4">
          3D LiDAR Viewer
        </h3>

        <iframe
          src="http://127.0.0.1:8081/potree_output/viewer.html"
          style={{
            width: "100%",
            height: "600px",
            border: "none",
            borderRadius: "10px"
          }}
        />

      </div>

    </div>
  );
};

export default SegmentationPage;