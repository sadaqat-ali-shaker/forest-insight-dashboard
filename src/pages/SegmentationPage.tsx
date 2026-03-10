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

const COLORS = [
  "#2d6a4f",
  "#40916c",
  "#52b788",
  "#74c69d",
  "#95d5b2",
  "#b7e4c7",
  "#d4a373",
  "#e9c46a"
];

type TreePoint = {
  Easting: number;
  Northing: number;
  Tree_Height: number;
};

const SegmentationPage = () => {

  const [trees, setTrees] = useState<TreePoint[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    avgHeight: 0,
    maxHeight: 0
  });

  useEffect(() => {

    const plot = localStorage.getItem("currentPlot");

    if (!plot) return;

    fetch(`http://127.0.0.1:8000/segmentation/${plot}`)
      .then(res => res.json())
      .then(data => {

        setTrees(data.points);

        setStats({
          total: data.trees,
          avgHeight: data.avg_height,
          maxHeight: data.max_height
        });

      });

  }, []);

  const scatterData = trees.map((t, i) => ({
    x: t.Easting,
    y: t.Northing,
    z: t.Tree_Height,
    id: `Tree-${i + 1}`
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Tree Segmentation
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize segmented trees and LiDAR point cloud
        </p>
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

      {/* Tree Centroid Map */}
      <div className="stat-card">

        <h3 className="font-display font-semibold text-foreground mb-4">
          Tree Centroid Map (Top View)
        </h3>

        <p className="text-xs text-muted-foreground mb-3">
          Bubble size represents tree height
        </p>

        <ResponsiveContainer width="100%" height={450}>

          <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>

            <XAxis type="number" dataKey="x" name="X" unit="m" />

            <YAxis type="number" dataKey="y" name="Y" unit="m" />

            <ZAxis type="number" dataKey="z" range={[40, 400]} name="Height" unit="m" />

            <Tooltip
              content={({ payload }) => {

                if (!payload?.length) return null;

                const d = payload[0].payload;

                return (
                  <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                    <p className="font-semibold text-foreground">{d.id}</p>
                    <p className="text-muted-foreground">
                      Height: {d.z} m
                    </p>
                    <p className="text-muted-foreground">
                      X: {d.x}, Y: {d.y}
                    </p>
                  </div>
                );

              }}
            />

            <Scatter data={scatterData}>

              {scatterData.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.75}
                />
              ))}

            </Scatter>

          </ScatterChart>

        </ResponsiveContainer>

      </div>

      {/* 3D LiDAR Viewer */}
<div className="stat-card">

  <h3 className="font-display font-semibold text-foreground mb-4">
    3D LiDAR Forest Viewer
  </h3>

  <p className="text-xs text-muted-foreground mb-3">
    Interactive LiDAR point cloud
  </p>

  <iframe
    src="http://localhost:8081/potree_output/viewer.html"
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