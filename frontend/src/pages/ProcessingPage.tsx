import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";

const steps = [
  "Loading LiDAR file",
  "Building Terrain Model",
  "Segmenting Trees",
  "Extracting Features",
  "Predicting DBH",
  "Calculating Biomass",
  "Saving to Database"
];

const ProcessingPage = () => {

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const runProcessing = () => {

    setRunning(true);
    setLogs([]);

    // ⏱️ Updated delays (Terrain Model = long step)
    const delays = [
      1000,   
      2000,  
      3000,  // Segmentation
      13000,
      14000,
      15000,
      16000
    ];

    steps.forEach((step, i) => {

      setTimeout(() => {

        setLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${step}`
        ]);

        if (i === steps.length - 1) {
          setRunning(false);
        }

      }, delays[i]);

    });

  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <h1 className="text-3xl font-bold">Data Processing</h1>

      <Button onClick={runProcessing} disabled={running} className="gap-2">

        {running ? <Loader2 className="animate-spin" /> : <Play />}

        {running ? "Processing..." : "Run Processing"}

      </Button>

      <div className="stat-card space-y-2">

        {logs.map((l, i) => (
          <p key={i}>{l}</p>
        ))}

      </div>

    </div>
  );

};

export default ProcessingPage;