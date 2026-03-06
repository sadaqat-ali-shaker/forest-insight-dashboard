// Mock tree data for the forest inventory system
export interface TreeData {
  Tree_ID: string;
  X: number;
  Y: number;
  Z: number;
  Height: number;
  DBH: number;
  Crown_Diameter: number;
  Crown_Area: number;
  Biomass: number;
  Carbon: number;
  Species: string;
}

const species = ["Pine", "Oak", "Birch", "Spruce", "Maple", "Cedar", "Fir", "Elm"];

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

export function generateTreeData(count = 120): TreeData[] {
  return Array.from({ length: count }, (_, i) => {
    const height = rand(5, 35);
    const dbh = rand(10, 60);
    const crownD = rand(3, 12);
    const biomass = Math.round(0.0673 * Math.pow(dbh, 2.0773) * 100) / 100;
    return {
      Tree_ID: `T-${String(i + 1).padStart(4, "0")}`,
      X: rand(-50, 50),
      Y: rand(-50, 50),
      Z: rand(0, height),
      Height: height,
      DBH: dbh,
      Crown_Diameter: crownD,
      Crown_Area: Math.round(Math.PI * (crownD / 2) ** 2 * 100) / 100,
      Biomass: biomass,
      Carbon: Math.round(biomass * 0.47 * 100) / 100,
      Species: species[Math.floor(Math.random() * species.length)],
    };
  });
}

export const sampleTrees = generateTreeData(120);

export const processingSteps = [
  { label: "LiDAR Input", icon: "📡", status: "complete" as const },
  { label: "Tree Detection", icon: "🌲", status: "complete" as const },
  { label: "Segmentation", icon: "✂️", status: "complete" as const },
  { label: "Feature Extraction", icon: "📊", status: "complete" as const },
  { label: "Biomass Estimation", icon: "⚖️", status: "complete" as const },
  { label: "Prediction", icon: "🔮", status: "complete" as const },
];

export const teamMembers = [
  { name: "Dr. Sarah Chen", role: "Principal Investigator" },
  { name: "Amit Patel", role: "LiDAR Specialist" },
  { name: "Maria Gonzalez", role: "ML Engineer" },
  { name: "James Okafor", role: "Forestry Analyst" },
];

export const supervisor = { name: "Prof. David Liu", role: "Project Supervisor" };
