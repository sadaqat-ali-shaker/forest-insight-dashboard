import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TreePine, ArrowRight, Users, GraduationCap } from "lucide-react";
import { teamMembers, supervisor } from "@/lib/mock-data";

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Hero */}
      <div className="text-center space-y-5 py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-forest mb-2">
          <TreePine className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground leading-tight">
          AI Based Forest Inventory<br />& Analysis System
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-body">
          A comprehensive system that processes LiDAR point cloud data to generate
          digital forest inventories. Using machine learning for tree detection,
          segmentation, biomass estimation, and growth prediction.
        </p>
        <Button
          size="lg"
          className="gradient-forest text-primary-foreground border-0 text-base px-8 py-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
          onClick={() => navigate("/upload")}
        >
          Start Analysis <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { emoji: "📡", title: "LiDAR Processing", desc: "Process .las, .laz, .pcd point cloud files" },
          { emoji: "🌲", title: "Tree Detection", desc: "AI-powered individual tree segmentation" },
          { emoji: "📊", title: "Forest Analytics", desc: "Biomass, carbon, and growth predictions" },
        ].map((f) => (
          <div key={f.title} className="stat-card text-center space-y-2">
            <span className="text-3xl">{f.emoji}</span>
            <h3 className="font-display font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Team */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-display font-bold text-foreground">Team Members</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {teamMembers.map((m) => (
            <div key={m.name} className="stat-card text-center space-y-1">
              <div className="w-12 h-12 rounded-full gradient-forest mx-auto flex items-center justify-center text-primary-foreground font-bold text-lg">
                {m.name.charAt(0)}
              </div>
              <p className="font-semibold text-sm text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.role}</p>
            </div>
          ))}
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-14 h-14 rounded-full gradient-amber flex items-center justify-center shrink-0">
            <GraduationCap className="h-7 w-7 text-accent-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{supervisor.name}</p>
            <p className="text-sm text-muted-foreground">{supervisor.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
