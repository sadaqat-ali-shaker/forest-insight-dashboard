import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { processingSteps } from "@/lib/mock-data";

const ProcessingPage = () => {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [logs, setLogs] = useState<string[]>([]);

  const runProcessing = () => {
    setRunning(true);
    setLogs([]);
    setCurrentStep(0);

    processingSteps.forEach((step, i) => {
      setTimeout(() => {
        setCurrentStep(i);
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✓ ${step.label} completed`]);
        if (i === processingSteps.length - 1) {
          setTimeout(() => {
            setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 Pipeline complete!`]);
            setRunning(false);
          }, 600);
        }
      }, (i + 1) * 800);
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Data Processing</h1>
        <p className="text-muted-foreground mt-1">LiDAR processing pipeline</p>
      </div>

      {/* Pipeline diagram */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-5">Processing Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 justify-center">
          {processingSteps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all ${
                i <= currentStep
                  ? "gradient-forest text-primary-foreground border-transparent shadow-md"
                  : "bg-muted border-border text-muted-foreground"
              }`}>
                <span className="text-2xl">{step.icon}</span>
                <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
                {i <= currentStep && <CheckCircle2 className="h-3.5 w-3.5" />}
              </div>
              {i < processingSteps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        onClick={runProcessing}
        disabled={running}
        className="gradient-forest text-primary-foreground border-0 gap-2"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? "Processing..." : "Run Processing"}
      </Button>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="stat-card bg-forest-deep text-emerald-light font-mono text-sm space-y-1 max-h-64 overflow-auto">
          {logs.map((log, i) => (
            <p key={i}>{log}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProcessingPage;
