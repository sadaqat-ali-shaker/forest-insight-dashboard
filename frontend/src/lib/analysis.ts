// ── Shared analysis logic (mirrors Streamlit compute functions) ──────────────

import { TreeRecord } from "@/context/CsvDataContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GrowthRecord {
  Tree_ID: string;
  Species: string;
  Latitude: number;
  Longitude: number;
  Height_First: number; Height_Last: number; Height_Change: number;
  CrownDia_First: number; CrownDia_Last: number; CrownDia_Change: number;
  CPA_First: number; CPA_Last: number; CPA_Change: number;
  DBH_First: number; DBH_Last: number; DBH_Change: number;
  Biomass_First: number; Biomass_Last: number; Biomass_Change: number;
  Height_Slope: number | null;
  DBH_Slope: number | null;
  Biomass_Slope: number | null;
  Growth_Category: string;
}

export interface SpeciesSummary {
  Species: string;
  Count: number;
  Avg_Height: number;
  Avg_CrownDia: number;
  Avg_DBH: number;
  Avg_Biomass: number;
  Total_Biomass: number;
}

export interface RiskRecord extends GrowthRecord {
  Risk_Score: number;
  Risk_Level: "Low" | "Medium" | "High" | "Critical";
}

export interface ForestChangeRecord {
  Tree_ID: string;
  Latitude: number;
  Longitude: number;
  Species: string;
  Status: "Stable" | "New Tree" | "Missing Tree";
}

export interface ScanAvg {
  date: Date;
  label: string;
  Height: number;
  DBH: number;
  Biomass: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  const v = arr.filter(n => !isNaN(n) && isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function sum(arr: number[]): number {
  return arr.filter(n => !isNaN(n) && isFinite(n)).reduce((a, b) => a + b, 0);
}

function linSlope(xs: number[], ys: number[]): number | null {
  if (xs.length < 2) return null;
  const n = xs.length;
  const mx = avg(xs), my = avg(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? null : num / den;
}

function growthCat(ch: number): string {
  if (isNaN(ch)) return "Unknown";
  if (ch < -0.01) return "Negative";
  if (ch < 0.5) return "Low";
  if (ch < 2.0) return "Moderate";
  return "High";
}

// ── computeGrowth ─────────────────────────────────────────────────────────────

export function computeGrowth(trees: TreeRecord[]): GrowthRecord[] {
  const byTree = new Map<string, TreeRecord[]>();
  for (const t of trees) {
    if (!byTree.has(t.Tree_ID)) byTree.set(t.Tree_ID, []);
    byTree.get(t.Tree_ID)!.push(t);
  }

  const results: GrowthRecord[] = [];
  for (const [tid, recs] of byTree) {
    const sorted = [...recs].sort((a, b) => a.Date.getTime() - b.Date.getTime());
    const first = sorted[0], last = sorted[sorted.length - 1];
    const xs = sorted.map(r => r.Date.getTime() / 86400000);
    results.push({
      Tree_ID: tid,
      Species: first.Species,
      Latitude: first.Latitude,
      Longitude: first.Longitude,
      Height_First: first.Height, Height_Last: last.Height,
      Height_Change: last.Height - first.Height,
      CrownDia_First: first.CrownDiameter, CrownDia_Last: last.CrownDiameter,
      CrownDia_Change: last.CrownDiameter - first.CrownDiameter,
      CPA_First: first.CrownAreaConvex, CPA_Last: last.CrownAreaConvex,
      CPA_Change: last.CrownAreaConvex - first.CrownAreaConvex,
      DBH_First: first.Predicted_DBH, DBH_Last: last.Predicted_DBH,
      DBH_Change: last.Predicted_DBH - first.Predicted_DBH,
      Biomass_First: first.Biomass_kg, Biomass_Last: last.Biomass_kg,
      Biomass_Change: last.Biomass_kg - first.Biomass_kg,
      Height_Slope: linSlope(xs, sorted.map(r => r.Height)),
      DBH_Slope: linSlope(xs, sorted.map(r => r.Predicted_DBH)),
      Biomass_Slope: linSlope(xs, sorted.map(r => r.Biomass_kg)),
      Growth_Category: growthCat(last.Height - first.Height),
    });
  }
  return results;
}

// ── speciesSummary ────────────────────────────────────────────────────────────

export function speciesSummary(trees: TreeRecord[]): SpeciesSummary[] {
  // Use last measurement per tree
  const byTree = new Map<string, TreeRecord>();
  for (const t of trees) {
    const existing = byTree.get(t.Tree_ID);
    if (!existing || t.Date > existing.Date) byTree.set(t.Tree_ID, t);
  }

  const bySpecies = new Map<string, TreeRecord[]>();
  for (const t of byTree.values()) {
    if (!bySpecies.has(t.Species)) bySpecies.set(t.Species, []);
    bySpecies.get(t.Species)!.push(t);
  }

  return [...bySpecies.entries()].map(([sp, recs]) => ({
    Species: sp,
    Count: recs.length,
    Avg_Height: avg(recs.map(r => r.Height)),
    Avg_CrownDia: avg(recs.map(r => r.CrownDiameter)),
    Avg_DBH: avg(recs.map(r => r.Predicted_DBH)),
    Avg_Biomass: avg(recs.map(r => r.Biomass_kg)),
    Total_Biomass: sum(recs.map(r => r.Biomass_kg)),
  })).sort((a, b) => a.Species.localeCompare(b.Species));
}

// ── computeRisk ───────────────────────────────────────────────────────────────

export function computeRisk(growth: GrowthRecord[]): RiskRecord[] {
  return growth.map(g => {
    let score = 0;
    if (g.Height_Change < 0) score += 2;
    if (g.CrownDia_Change < 0) score += 2;
    if (g.CPA_Change < 0) score += 1;
    if (g.DBH_Change < 0) score += 2;
    if (g.Biomass_Change < 0) {
      score += 3;
      const frac = g.Biomass_First !== 0 ? g.Biomass_Change / Math.abs(g.Biomass_First) : 0;
      if (frac < -0.1) score += 2;
      if (frac < -0.3) score += 2;
    }
    const level: RiskRecord["Risk_Level"] =
      score >= 7 ? "Critical" : score >= 4 ? "High" : score >= 2 ? "Medium" : "Low";
    return { ...g, Risk_Score: score, Risk_Level: level };
  });
}

// ── computeForestChange ───────────────────────────────────────────────────────

export function computeForestChange(trees: TreeRecord[], distThreshold = 0.00001): ForestChangeRecord[] {
  const sorted = [...trees].sort((a, b) => a.Date.getTime() - b.Date.getTime());
  const firstDate = sorted[0]?.Date.getTime();
  const lastDate = sorted[sorted.length - 1]?.Date.getTime();
  if (!firstDate || firstDate === lastDate) return [];

  const firstScan = trees.filter(t => t.Date.getTime() === firstDate);
  const lastScan  = trees.filter(t => t.Date.getTime() === lastDate);

  const matched = new Set<string>();
  const results: ForestChangeRecord[] = [];

  for (const lt of lastScan) {
    let minDist = Infinity;
    let bestFt: TreeRecord | null = null;
    for (const ft of firstScan) {
      const d = Math.sqrt((lt.Latitude - ft.Latitude) ** 2 + (lt.Longitude - ft.Longitude) ** 2);
      if (d < minDist) { minDist = d; bestFt = ft; }
    }
    if (minDist <= distThreshold && bestFt) {
      matched.add(bestFt.Tree_ID);
      results.push({ Tree_ID: lt.Tree_ID, Latitude: lt.Latitude, Longitude: lt.Longitude, Species: lt.Species, Status: "Stable" });
    } else {
      results.push({ Tree_ID: lt.Tree_ID, Latitude: lt.Latitude, Longitude: lt.Longitude, Species: lt.Species, Status: "New Tree" });
    }
  }
  for (const ft of firstScan) {
    if (!matched.has(ft.Tree_ID)) {
      results.push({ Tree_ID: ft.Tree_ID, Latitude: ft.Latitude, Longitude: ft.Longitude, Species: ft.Species, Status: "Missing Tree" });
    }
  }
  return results;
}

// ── scanAverages (for Seasonal Growth scan-to-scan indicators) ────────────────

export function scanAverages(trees: TreeRecord[]): ScanAvg[] {
  const byDate = new Map<number, TreeRecord[]>();
  for (const t of trees) {
    const k = t.Date.getTime();
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(t);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, recs]) => {
      const d = new Date(ts);
      return {
        date: d,
        label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
        Height: avg(recs.map(r => r.Height)),
        DBH: avg(recs.map(r => r.Predicted_DBH)),
        Biomass: avg(recs.map(r => r.Biomass_kg)),
      };
    });
}
