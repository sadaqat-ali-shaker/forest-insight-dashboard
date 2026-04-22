import { useMemo, useState } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import { computeGrowth, speciesSummary, scanAverages, computeRisk } from "@/lib/analysis";
import { TreePine, Leaf, Ruler, BarChart2, CircleDot, Sprout, Play, ChevronDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import type { TreeRecord } from "@/context/CsvDataContext";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = [
  "#2d8a57","#d4883b","#3b7fd4","#9b59b6",
  "#d93b3b","#c9b30a","#1a9999","#c0392b",
  "#27ae60","#e67e22","#2980b9","#8e44ad",
];

// ─────────────────────────────────────────────────────────────────────────────
// QUERY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface QueryDef {
  id: string;
  label: string;
  group: string;
  description: string;
  icon: string;
}

const QUERY_GROUPS: { group: string; icon: string; queries: QueryDef[] }[] = [
  {
    group: " Tree Rankings",
    icon: "",
    queries: [
      { id: "top5_tallest",     label: "Top 5 Tallest Trees",              group: "Tree Rankings", description: "Trees with the greatest recorded height",                icon: "" },
      { id: "top5_shortest",    label: "Top 5 Shortest Trees",             group: "Tree Rankings", description: "Trees with the smallest recorded height",                icon: "" },
      { id: "top5_crown",       label: "Top 5 Widest Crown Diameter",      group: "Tree Rankings", description: "Trees with the largest crown spread",                   icon: "" },
      { id: "top5_biomass",     label: "Top 5 Highest Biomass Trees",      group: "Tree Rankings", description: "Trees storing the most carbon biomass (latest scan)",   icon: "" },
      { id: "top5_dbh",         label: "Top 5 Thickest DBH Trees",         group: "Tree Rankings", description: "Trees with the largest diameter at breast height",      icon: "" },
      { id: "bottom5_biomass",  label: "Bottom 5 Lowest Biomass Trees",    group: "Tree Rankings", description: "Trees with the least biomass (latest scan)",            icon: "" },
    ],
  },
  {
    group: " Growth & Health",
    icon: "",
    queries: [
      { id: "fastest_growth",   label: "Fastest Growing Trees (Height)",   group: "Growth & Health", description: "Trees with the largest height increase across all scans",    icon: "" },
      { id: "declining_trees",  label: "Declining Trees (Height Loss)",    group: "Growth & Health", description: "Trees that have lost height between first and last scan",     icon: "" },
      { id: "at_risk",          label: "Trees at Risk (High / Critical)",  group: "Growth & Health", description: "Trees classified as High or Critical risk based on decline indicators", icon: "" },
      { id: "biomass_gainers",  label: "Top 5 Biomass Gainers",           group: "Growth & Health", description: "Trees with the greatest absolute biomass increase",            icon: "" },
      { id: "biomass_losers",   label: "Top 5 Biomass Losers",            group: "Growth & Health", description: "Trees with the greatest absolute biomass decrease",            icon: "" },
      { id: "stable_growers",   label: "Most Consistent Growers",         group: "Growth & Health", description: "Trees with positive growth in every scan interval",            icon: "" },
    ],
  },
  {
    group: " Temporal Analysis",
    icon: "",
    queries: [
      { id: "all_scans",        label: "Trees Present in All Scans",      group: "Temporal Analysis", description: "Trees recorded in every single scan date",                   icon: "" },
      { id: "first_scan_only",  label: "Trees Only in First Scan",        group: "Temporal Analysis", description: "Trees that appeared in the earliest scan but never again (potential deforestation)", icon: "" },
      { id: "latest_scan_only", label: "Trees Only in Latest Scan",       group: "Temporal Analysis", description: "Trees that appear only in the most recent scan (newly added)", icon: "" },
      { id: "most_scans",       label: "Trees with Most Scan Records",    group: "Temporal Analysis", description: "Trees tracked across the highest number of scan dates",        icon: "" },
    ],
  },
  {
    group: " Sector / Spatial",
    icon: "",
    queries: [
      { id: "height_by_sector", label: "Average Height by Sector",        group: "Sector / Spatial", description: "Mean tree height broken down by sector/plot",               icon: "" },
      { id: "biomass_by_sector",label: "Total Biomass by Sector",         group: "Sector / Spatial", description: "Total carbon biomass per sector (latest scan)",              icon: "" },
      { id: "species_by_sector",label: "Species Count by Sector",         group: "Sector / Spatial", description: "How many unique species are present in each sector",         icon: "" },
      { id: "density_by_sector",label: "Tree Density by Sector",          group: "Sector / Spatial", description: "Number of unique trees recorded per sector",                 icon: "" },
    ],
  },
  {
    group: " Forest Summary",
    icon: "",
    queries: [
      { id: "biomass_trend",    label: "Biomass Trend Across Scans",      group: "Forest Summary", description: "How total forest biomass changed across each scan date",       icon: "" },
      { id: "species_richest",  label: "Species with Most Trees",         group: "Forest Summary", description: "Which species dominates the forest by tree count",            icon: "" },
      { id: "species_biomass",  label: "Species by Average Biomass",      group: "Forest Summary", description: "Which species has the highest average biomass per tree",      icon: "" },
      { id: "scan_coverage",    label: "Scan Coverage Summary",           group: "Forest Summary", description: "How many trees and species were recorded in each scan",       icon: "" },
    ],
  },
];

const ALL_QUERIES = QUERY_GROUPS.flatMap(g => g.queries);

// ─────────────────────────────────────────────────────────────────────────────
// QUERY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

type QueryResultRow = Record<string, string | number>;
interface QueryResult {
  columns: string[];
  rows: QueryResultRow[];
  summary?: string;
  chartData?: { label: string; value: number }[];
  chartType?: "bar" | "line";
  chartUnit?: string;
}

function runQuery(id: string, trees: TreeRecord[]): QueryResult {
  if (!trees.length) return { columns: [], rows: [], summary: "No data loaded." };

  const MONTH_NUM: Record<string, number> = {
    Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,
    Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
  };
  const dateKey = (t: TreeRecord) => t.Year * 100 + (MONTH_NUM[t.Month] ?? 0);

  // Latest record per tree
  const latestByTree = new Map<string, TreeRecord>();
  for (const t of trees) {
    const ex = latestByTree.get(t.Tree_ID);
    if (!ex || dateKey(t) > dateKey(ex)) latestByTree.set(t.Tree_ID, t);
  }
  const latestArr = [...latestByTree.values()];

  // First record per tree
  const firstByTree = new Map<string, TreeRecord>();
  for (const t of trees) {
    const ex = firstByTree.get(t.Tree_ID);
    if (!ex || dateKey(t) < dateKey(ex)) firstByTree.set(t.Tree_ID, t);
  }

  // All unique scan keys sorted
  const allScanKeys = [...new Set(trees.map(dateKey))].sort((a, b) => a - b);
  const firstScanKey = allScanKeys[0];
  const lastScanKey  = allScanKeys[allScanKeys.length - 1];

  // Trees per scan key
  const treesByScan = new Map<number, Set<string>>();
  for (const t of trees) {
    const k = dateKey(t);
    if (!treesByScan.has(k)) treesByScan.set(k, new Set());
    treesByScan.get(k)!.add(t.Tree_ID);
  }

  // Scan label helper
  const scanKeyLabel = (k: number): string => {
    const t = trees.find(r => dateKey(r) === k);
    return t ? `${t.Month} ${t.Year}` : String(k);
  };

  const growthDf = computeGrowth(trees);
  const riskDf   = computeRisk(growthDf);

  switch (id) {

    // ── Tree Rankings ──────────────────────────────────────────────────────

    case "top5_tallest": {
      const rows = [...latestArr]
        .sort((a, b) => b.Height - a.Height)
        .slice(0, 5)
        .map((t, i) => ({ Rank: i + 1, "Tree ID": t.Tree_ID, Species: t.Species, Sector: t.Sector, "Height (m)": +t.Height.toFixed(2) }));
      return { columns: ["Rank","Tree ID","Species","Sector","Height (m)"], rows, summary: `Tallest tree: ${rows[0]?.["Tree ID"]} at ${rows[0]?.["Height (m)"]} m` };
    }

    case "top5_shortest": {
      const rows = [...latestArr]
        .filter(t => t.Height > 0)
        .sort((a, b) => a.Height - b.Height)
        .slice(0, 5)
        .map((t, i) => ({ Rank: i + 1, "Tree ID": t.Tree_ID, Species: t.Species, Sector: t.Sector, "Height (m)": +t.Height.toFixed(2) }));
      return { columns: ["Rank","Tree ID","Species","Sector","Height (m)"], rows, summary: `Shortest tree: ${rows[0]?.["Tree ID"]} at ${rows[0]?.["Height (m)"]} m` };
    }

    case "top5_crown": {
      const rows = [...latestArr]
        .sort((a, b) => b.CrownDiameter - a.CrownDiameter)
        .slice(0, 5)
        .map((t, i) => ({ Rank: i + 1, "Tree ID": t.Tree_ID, Species: t.Species, Sector: t.Sector, "Crown Ø (m)": +t.CrownDiameter.toFixed(2) }));
      return { columns: ["Rank","Tree ID","Species","Sector","Crown Ø (m)"], rows, summary: `Widest crown: ${rows[0]?.["Tree ID"]} at ${rows[0]?.["Crown Ø (m)"]} m` };
    }

    case "top5_biomass": {
      const rows = [...latestArr]
        .sort((a, b) => b.Biomass_kg - a.Biomass_kg)
        .slice(0, 5)
        .map((t, i) => ({ Rank: i + 1, "Tree ID": t.Tree_ID, Species: t.Species, Sector: t.Sector, "Biomass (kg)": Math.round(t.Biomass_kg) }));
      return { columns: ["Rank","Tree ID","Species","Sector","Biomass (kg)"], rows, summary: `Highest biomass: ${rows[0]?.["Tree ID"]} at ${rows[0]?.["Biomass (kg)"].toLocaleString()} kg` };
    }

    case "top5_dbh": {
      const rows = [...latestArr]
        .sort((a, b) => b.Predicted_DBH - a.Predicted_DBH)
        .slice(0, 5)
        .map((t, i) => ({ Rank: i + 1, "Tree ID": t.Tree_ID, Species: t.Species, Sector: t.Sector, "DBH (cm)": +t.Predicted_DBH.toFixed(2) }));
      return { columns: ["Rank","Tree ID","Species","Sector","DBH (cm)"], rows, summary: `Thickest trunk: ${rows[0]?.["Tree ID"]} at ${rows[0]?.["DBH (cm)"]} cm DBH` };
    }

    case "bottom5_biomass": {
      const rows = [...latestArr]
        .filter(t => t.Biomass_kg > 0)
        .sort((a, b) => a.Biomass_kg - b.Biomass_kg)
        .slice(0, 5)
        .map((t, i) => ({ Rank: i + 1, "Tree ID": t.Tree_ID, Species: t.Species, Sector: t.Sector, "Biomass (kg)": Math.round(t.Biomass_kg) }));
      return { columns: ["Rank","Tree ID","Species","Sector","Biomass (kg)"], rows, summary: `Lowest biomass tree: ${rows[0]?.["Tree ID"]} at ${rows[0]?.["Biomass (kg)"]} kg` };
    }

    // ── Growth & Health ────────────────────────────────────────────────────

    case "fastest_growth": {
      const rows = [...growthDf]
        .sort((a, b) => b.Height_Change - a.Height_Change)
        .slice(0, 10)
        .map((g, i) => ({
          Rank: i + 1,
          "Tree ID": g.Tree_ID,
          Species: g.Species,
          Sector: trees.find(t => t.Tree_ID === g.Tree_ID)?.Sector ?? "—",
          "Δ Height (m)": +g.Height_Change.toFixed(3),
          Category: g.Growth_Category,
        }));
      return { columns: ["Rank","Tree ID","Species","Sector","Δ Height (m)","Category"], rows, summary: `Fastest grower: ${rows[0]?.["Tree ID"]} (+${rows[0]?.["Δ Height (m)"]} m)` };
    }

    case "declining_trees": {
      const rows = [...growthDf]
        .filter(g => g.Height_Change < 0)
        .sort((a, b) => a.Height_Change - b.Height_Change)
        .slice(0, 10)
        .map((g, i) => ({
          Rank: i + 1,
          "Tree ID": g.Tree_ID,
          Species: g.Species,
          "Δ Height (m)": +g.Height_Change.toFixed(3),
          "Δ Biomass (kg)": +g.Biomass_Change.toFixed(1),
        }));
      return {
        columns: ["Rank","Tree ID","Species","Δ Height (m)","Δ Biomass (kg)"],
        rows,
        summary: `${growthDf.filter(g => g.Height_Change < 0).length} trees show height decline. Worst: ${rows[0]?.["Tree ID"]} (${rows[0]?.["Δ Height (m)"]} m)`,
      };
    }

    case "at_risk": {
      const risky = riskDf.filter(r => r.Risk_Level === "High" || r.Risk_Level === "Critical");
      const rows = risky
        .sort((a, b) => b.Risk_Score - a.Risk_Score)
        .slice(0, 15)
        .map((r, i) => ({
          Rank: i + 1,
          "Tree ID": r.Tree_ID,
          Species: r.Species,
          "Risk Level": r.Risk_Level,
          "Risk Score": r.Risk_Score,
          "Δ Biomass (kg)": +r.Biomass_Change.toFixed(1),
        }));
      return {
        columns: ["Rank","Tree ID","Species","Risk Level","Risk Score","Δ Biomass (kg)"],
        rows,
        summary: `${risky.length} trees at High/Critical risk out of ${riskDf.length} total`,
      };
    }

    case "biomass_gainers": {
      const rows = [...growthDf]
        .sort((a, b) => b.Biomass_Change - a.Biomass_Change)
        .slice(0, 5)
        .map((g, i) => ({
          Rank: i + 1,
          "Tree ID": g.Tree_ID,
          Species: g.Species,
          "Biomass Gain (kg)": +g.Biomass_Change.toFixed(1),
          "First (kg)": +g.Biomass_First.toFixed(1),
          "Last (kg)": +g.Biomass_Last.toFixed(1),
        }));
      return { columns: ["Rank","Tree ID","Species","Biomass Gain (kg)","First (kg)","Last (kg)"], rows, summary: `Top gainer: ${rows[0]?.["Tree ID"]} +${rows[0]?.["Biomass Gain (kg)"]} kg` };
    }

    case "biomass_losers": {
      const rows = [...growthDf]
        .filter(g => g.Biomass_Change < 0)
        .sort((a, b) => a.Biomass_Change - b.Biomass_Change)
        .slice(0, 5)
        .map((g, i) => ({
          Rank: i + 1,
          "Tree ID": g.Tree_ID,
          Species: g.Species,
          "Biomass Loss (kg)": +g.Biomass_Change.toFixed(1),
          "First (kg)": +g.Biomass_First.toFixed(1),
          "Last (kg)": +g.Biomass_Last.toFixed(1),
        }));
      return { columns: ["Rank","Tree ID","Species","Biomass Loss (kg)","First (kg)","Last (kg)"], rows, summary: `Biggest loser: ${rows[0]?.["Tree ID"]} ${rows[0]?.["Biomass Loss (kg)"]} kg` };
    }

    case "stable_growers": {
      // Trees with positive height slope AND positive biomass slope
      const rows = [...growthDf]
        .filter(g => (g.Height_Slope ?? 0) > 0 && (g.Biomass_Slope ?? 0) > 0)
        .sort((a, b) => (b.Height_Slope ?? 0) - (a.Height_Slope ?? 0))
        .slice(0, 10)
        .map((g, i) => ({
          Rank: i + 1,
          "Tree ID": g.Tree_ID,
          Species: g.Species,
          "Height Slope (m/day)": +(g.Height_Slope ?? 0).toFixed(5),
          "Biomass Slope (kg/day)": +(g.Biomass_Slope ?? 0).toFixed(4),
          Category: g.Growth_Category,
        }));
      return {
        columns: ["Rank","Tree ID","Species","Height Slope (m/day)","Biomass Slope (kg/day)","Category"],
        rows,
        summary: `${growthDf.filter(g => (g.Height_Slope ?? 0) > 0 && (g.Biomass_Slope ?? 0) > 0).length} trees show consistent positive growth`,
      };
    }

    // ── Temporal ────────────────────────────────────────────────────────────

    case "all_scans": {
      const treeScanCounts = new Map<string, number>();
      for (const t of trees) {
        const ex = treeScanCounts.get(t.Tree_ID) ?? 0;
        treeScanCounts.set(t.Tree_ID, ex + 1);
      }
      // Trees present in ALL scan dates
      const totalScans = allScanKeys.length;
      const rows: QueryResultRow[] = [];
      for (const [tid, cnt] of treeScanCounts) {
        if (cnt === totalScans) {
          const lt = latestByTree.get(tid)!;
          rows.push({ "Tree ID": tid, Species: lt.Species, Sector: lt.Sector, "Scan Count": cnt });
        }
      }
      rows.sort((a, b) => (a["Tree ID"] as string).localeCompare(b["Tree ID"] as string));
      return {
        columns: ["Tree ID","Species","Sector","Scan Count"],
        rows: rows.slice(0, 20),
        summary: `${rows.length} trees present in all ${totalScans} scan dates (showing first 20)`,
      };
    }

    case "first_scan_only": {
      const inFirst = treesByScan.get(firstScanKey) ?? new Set<string>();
      const inLast  = treesByScan.get(lastScanKey)  ?? new Set<string>();
      const rows: QueryResultRow[] = [];
      for (const tid of inFirst) {
        if (!inLast.has(tid)) {
          const t = firstByTree.get(tid)!;
          rows.push({ "Tree ID": tid, Species: t.Species, Sector: t.Sector, "First Scan": scanKeyLabel(firstScanKey), "Height (m)": +t.Height.toFixed(2) });
        }
      }
      return {
        columns: ["Tree ID","Species","Sector","First Scan","Height (m)"],
        rows: rows.slice(0, 20),
        summary: `${rows.length} trees appeared only in the first scan (${scanKeyLabel(firstScanKey)}) — potentially deforested`,
      };
    }

    case "latest_scan_only": {
      const inFirst = treesByScan.get(firstScanKey) ?? new Set<string>();
      const inLast  = treesByScan.get(lastScanKey)  ?? new Set<string>();
      const rows: QueryResultRow[] = [];
      for (const tid of inLast) {
        if (!inFirst.has(tid)) {
          const t = latestByTree.get(tid)!;
          rows.push({ "Tree ID": tid, Species: t.Species, Sector: t.Sector, "Latest Scan": scanKeyLabel(lastScanKey), "Height (m)": +t.Height.toFixed(2) });
        }
      }
      return {
        columns: ["Tree ID","Species","Sector","Latest Scan","Height (m)"],
        rows: rows.slice(0, 20),
        summary: `${rows.length} trees appear only in the latest scan (${scanKeyLabel(lastScanKey)}) — newly detected`,
      };
    }

    case "most_scans": {
      const scanCountMap = new Map<string, number>();
      for (const t of trees) scanCountMap.set(t.Tree_ID, (scanCountMap.get(t.Tree_ID) ?? 0) + 1);
      const rows = [...scanCountMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tid, cnt], i) => {
          const lt = latestByTree.get(tid)!;
          return { Rank: i + 1, "Tree ID": tid, Species: lt.Species, Sector: lt.Sector, "Scan Records": cnt };
        });
      return { columns: ["Rank","Tree ID","Species","Sector","Scan Records"], rows, summary: `Most tracked tree: ${rows[0]?.["Tree ID"]} with ${rows[0]?.["Scan Records"]} records` };
    }

    // ── Sector / Spatial ────────────────────────────────────────────────────

    case "height_by_sector": {
      const bySector = new Map<string, number[]>();
      for (const t of latestArr) {
        if (!bySector.has(t.Sector)) bySector.set(t.Sector, []);
        bySector.get(t.Sector)!.push(t.Height);
      }
      const rows = [...bySector.entries()]
        .map(([s, vals]) => ({
          Sector: s,
          "Tree Count": vals.length,
          "Avg Height (m)": +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
          "Max Height (m)": +Math.max(...vals).toFixed(2),
          "Min Height (m)": +Math.min(...vals).toFixed(2),
        }))
        .sort((a, b) => (b["Avg Height (m)"] as number) - (a["Avg Height (m)"] as number));
      return {
        columns: ["Sector","Tree Count","Avg Height (m)","Max Height (m)","Min Height (m)"],
        rows,
        summary: `${rows.length} sectors analysed. Tallest sector: ${rows[0]?.Sector} (avg ${rows[0]?.["Avg Height (m)"]} m)`,
        chartData: rows.map(r => ({ label: r.Sector as string, value: r["Avg Height (m)"] as number })),
        chartType: "bar",
        chartUnit: "m",
      };
    }

    case "biomass_by_sector": {
      // Use latest scan per tree
      const bySector = new Map<string, number>();
      for (const t of latestArr) {
        bySector.set(t.Sector, (bySector.get(t.Sector) ?? 0) + t.Biomass_kg);
      }
      const rows = [...bySector.entries()]
        .map(([s, total]) => ({ Sector: s, "Total Biomass (kg)": Math.round(total) }))
        .sort((a, b) => (b["Total Biomass (kg)"] as number) - (a["Total Biomass (kg)"] as number));
      return {
        columns: ["Sector","Total Biomass (kg)"],
        rows,
        summary: `Highest biomass sector: ${rows[0]?.Sector} with ${(rows[0]?.["Total Biomass (kg)"] as number).toLocaleString()} kg`,
        chartData: rows.map(r => ({ label: r.Sector as string, value: r["Total Biomass (kg)"] as number })),
        chartType: "bar",
        chartUnit: "kg",
      };
    }

    case "species_by_sector": {
      const bySector = new Map<string, Set<string>>();
      for (const t of latestArr) {
        if (!bySector.has(t.Sector)) bySector.set(t.Sector, new Set());
        bySector.get(t.Sector)!.add(t.Species);
      }
      const rows = [...bySector.entries()]
        .map(([s, sp]) => ({ Sector: s, "Unique Species": sp.size, Species: [...sp].sort().join(", ") }))
        .sort((a, b) => (b["Unique Species"] as number) - (a["Unique Species"] as number));
      return {
        columns: ["Sector","Unique Species","Species"],
        rows,
        summary: `Most biodiverse sector: ${rows[0]?.Sector} with ${rows[0]?.["Unique Species"]} species`,
      };
    }

    case "density_by_sector": {
      const bySector = new Map<string, Set<string>>();
      for (const t of trees) {
        if (!bySector.has(t.Sector)) bySector.set(t.Sector, new Set());
        bySector.get(t.Sector)!.add(t.Tree_ID);
      }
      const rows = [...bySector.entries()]
        .map(([s, ids]) => ({ Sector: s, "Unique Trees": ids.size }))
        .sort((a, b) => (b["Unique Trees"] as number) - (a["Unique Trees"] as number));
      return {
        columns: ["Sector","Unique Trees"],
        rows,
        summary: `Densest sector: ${rows[0]?.Sector} with ${rows[0]?.["Unique Trees"]} unique trees`,
        chartData: rows.map(r => ({ label: r.Sector as string, value: r["Unique Trees"] as number })),
        chartType: "bar",
        chartUnit: "trees",
      };
    }

    // ── Forest Summary ─────────────────────────────────────────────────────

    case "biomass_trend": {
      const byKey = new Map<number, number>();
      for (const t of trees) byKey.set(dateKey(t), (byKey.get(dateKey(t)) ?? 0) + t.Biomass_kg);
      const rows = [...byKey.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([k, total]) => ({ "Scan Date": scanKeyLabel(k), "Total Biomass (kg)": Math.round(total) }));
      return {
        columns: ["Scan Date","Total Biomass (kg)"],
        rows,
        summary: `Biomass range: ${Math.min(...rows.map(r => r["Total Biomass (kg)"] as number)).toLocaleString()} – ${Math.max(...rows.map(r => r["Total Biomass (kg)"] as number)).toLocaleString()} kg across ${rows.length} scans`,
        chartData: rows.map(r => ({ label: r["Scan Date"] as string, value: r["Total Biomass (kg)"] as number })),
        chartType: "line",
        chartUnit: "kg",
      };
    }

    case "species_richest": {
      const spCount = new Map<string, Set<string>>();
      for (const t of latestArr) {
        if (!spCount.has(t.Species)) spCount.set(t.Species, new Set());
        spCount.get(t.Species)!.add(t.Tree_ID);
      }
      const rows = [...spCount.entries()]
        .map(([sp, ids]) => ({ Species: sp, "Tree Count": ids.size, "% of Forest": `${((ids.size / latestArr.length) * 100).toFixed(1)}%` }))
        .sort((a, b) => (b["Tree Count"] as number) - (a["Tree Count"] as number));
      return {
        columns: ["Species","Tree Count","% of Forest"],
        rows,
        summary: `Dominant species: ${rows[0]?.Species} with ${rows[0]?.["Tree Count"]} trees (${rows[0]?.["% of Forest"]} of forest)`,
        chartData: rows.slice(0, 8).map(r => ({ label: (r.Species as string).split(" ")[1] ?? r.Species as string, value: r["Tree Count"] as number })),
        chartType: "bar",
        chartUnit: "trees",
      };
    }

    case "species_biomass": {
      const spBio = new Map<string, number[]>();
      for (const t of latestArr) {
        if (!spBio.has(t.Species)) spBio.set(t.Species, []);
        spBio.get(t.Species)!.push(t.Biomass_kg);
      }
      const rows = [...spBio.entries()]
        .map(([sp, vals]) => ({
          Species: sp,
          "Tree Count": vals.length,
          "Avg Biomass (kg)": +( vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
          "Total Biomass (kg)": Math.round(vals.reduce((a, b) => a + b, 0)),
        }))
        .sort((a, b) => (b["Avg Biomass (kg)"] as number) - (a["Avg Biomass (kg)"] as number));
      return {
        columns: ["Species","Tree Count","Avg Biomass (kg)","Total Biomass (kg)"],
        rows,
        summary: `Highest avg biomass: ${rows[0]?.Species} at ${rows[0]?.["Avg Biomass (kg)"]} kg/tree`,
        chartData: rows.slice(0, 8).map(r => ({ label: (r.Species as string).split(" ")[1] ?? r.Species as string, value: r["Avg Biomass (kg)"] as number })),
        chartType: "bar",
        chartUnit: "kg",
      };
    }

    case "scan_coverage": {
      const rows = allScanKeys.map(k => {
        const scanTrees = treesByScan.get(k) ?? new Set<string>();
        const speciesInScan = new Set(trees.filter(t => dateKey(t) === k).map(t => t.Species));
        return {
          "Scan Date": scanKeyLabel(k),
          "Trees Recorded": scanTrees.size,
          "Species Present": speciesInScan.size,
        };
      });
      return {
        columns: ["Scan Date","Trees Recorded","Species Present"],
        rows,
        summary: `${allScanKeys.length} scan dates. Coverage ranges from ${Math.min(...rows.map(r => r["Trees Recorded"] as number))} to ${Math.max(...rows.map(r => r["Trees Recorded"] as number))} trees per scan`,
        chartData: rows.map(r => ({ label: r["Scan Date"] as string, value: r["Trees Recorded"] as number })),
        chartType: "bar",
        chartUnit: "trees",
      };
    }

    default:
      return { columns: [], rows: [], summary: "Unknown query." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK BADGE
// ─────────────────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  Critical: "#d93b3b", High: "#e89d22", Medium: "#3b7fd4", Low: "#2d8a57",
};

function CellRenderer({ col, val }: { col: string; val: string | number }) {
  if (col === "Risk Level" && typeof val === "string" && RISK_COLORS[val]) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
        style={{ background: RISK_COLORS[val] }}
      >
        {val}
      </span>
    );
  }
  if (col === "Category") {
    const catColors: Record<string, string> = {
      High: "#2d8a57", Moderate: "#3b7fd4", Low: "#9b59b6", Negative: "#d93b3b", Unknown: "#888",
    };
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
        style={{ background: catColors[val as string] ?? "#888" }}
      >
        {val}
      </span>
    );
  }
  return <>{typeof val === "number" && !Number.isInteger(val) ? val : typeof val === "number" ? val.toLocaleString() : val}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// PIE LABEL
// ─────────────────────────────────────────────────────────────────────────────

const RADIAN = Math.PI / 180;
function renderCustomLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  if (percent < 0.03) return null;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11} fill="#555">
      {`${name.split(" ").pop()} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY EXPLORER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function QueryExplorer({ trees }: { trees: TreeRecord[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [result,     setResult]     = useState<QueryResult | null>(null);
  const [ran,        setRan]        = useState(false);

  const selectedQuery = ALL_QUERIES.find(q => q.id === selectedId);

  const handleRun = () => {
    if (!selectedId) return;
    const r = runQuery(selectedId, trees);
    setResult(r);
    setRan(true);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setResult(null);
    setRan(false);
  };

  return (
    <div className="stat-card space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg"></span>
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground text-base">Data Query Explorer</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {/* Select a predefined query to instantly explore key insights from the forest dataset. */}
          </p>
        </div>
      </div>

      {/* Selector row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Custom grouped select */}
        <div className="relative flex-1">
          <select
            className="w-full appearance-none rounded-xl border border-input bg-background px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
            value={selectedId}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">— Choose a query —</option>
            {QUERY_GROUPS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.queries.map(q => (
                  <option key={q.id} value={q.id}>{q.icon} {q.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={!selectedId}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
        >
          <Play className="h-4 w-4" /> Run Query
        </button>
      </div>

      {/* Query description preview */}
      {selectedQuery && !ran && (
        <div className="rounded-xl bg-muted/40 border border-dashed border-border px-4 py-3 flex gap-3 items-start">
          <span className="text-xl shrink-0 mt-0.5">{selectedQuery.icon}</span>
          <div>
            <p className="text-sm font-medium text-foreground">{selectedQuery.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{selectedQuery.description}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {ran && result && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Summary pill */}
          {result.summary && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/8 border border-primary/20">
              <span className="text-base shrink-0">{selectedQuery?.icon}</span>
              <p className="text-sm font-medium text-foreground">{result.summary}</p>
            </div>
          )}

          {/* Mini chart (if applicable) */}
          {result.chartData && result.chartData.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/10 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Chart View
              </p>
              <ResponsiveContainer width="100%" height={180}>
                {result.chartType === "line" ? (
                  <LineChart data={result.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ${result.chartUnit}`, ""]} />
                    <Line type="monotone" dataKey="value" stroke="hsl(152,45%,32%)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                ) : (
                  <BarChart data={result.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 15% 88%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ${result.chartUnit}`, ""]} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {result.chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Results table */}
          {result.rows.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {result.columns.map(col => (
                        <th key={col} className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        {result.columns.map(col => (
                          <td key={col} className="px-4 py-2 tabular-nums whitespace-nowrap">
                            <CellRenderer col={col} val={row[col] ?? "—"} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No records matched this query.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW PAGE
// ─────────────────────────────────────────────────────────────────────────────

const OverviewPage = () => {
  const { trees } = useCsvData();

  const growthDf  = useMemo(() => computeGrowth(trees), [trees]);
  const speciesDf = useMemo(() => speciesSummary(trees), [trees]);
  const scans     = useMemo(() => scanAverages(trees), [trees]);

  const totalTrees   = growthDf.length;
  const totalSpecies = speciesDf.length;
  const avgHeight = trees.length ? (trees.reduce((s, t) => s + t.Height, 0) / trees.length).toFixed(2) : "0";
  const avgCrown  = trees.length ? (trees.reduce((s, t) => s + t.CrownDiameter, 0) / trees.length).toFixed(2) : "0";
  const avgDBH    = trees.length ? (trees.reduce((s, t) => s + t.Predicted_DBH, 0) / trees.length).toFixed(2) : "0";

  const latestBiomass = useMemo(() => {
    if (!trees.length) return 0;
    const maxTs = Math.max(...trees.map(t => t.Date.getTime()));
    return trees.filter(t => t.Date.getTime() === maxTs).reduce((s, t) => s + t.Biomass_kg, 0);
  }, [trees]);

  const heightData = scans.map(s => ({ date: s.label, "Avg Height (m)": +s.Height.toFixed(3) }));

  const biomassData = useMemo(() => {
    const byDate = new Map<number, { label: string; total: number }>();
    for (const t of trees) {
      const k = t.Date.getTime();
      if (!byDate.has(k)) byDate.set(k, { label: t.Date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }), total: 0 });
      byDate.get(k)!.total += t.Biomass_kg;
    }
    return [...byDate.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => ({ date: v.label, "Total Biomass (kg)": Math.round(v.total) }));
  }, [trees]);

  const pieData = speciesDf.map((s, i) => ({ name: s.Species, value: s.Count, color: COLORS[i % COLORS.length] }));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground"> AI Based Forest Inventory — Overview</h1>
        {/* <p className="text-muted-foreground mt-1">Summary statistics and key forest metrics</p> */}
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
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130}
              labelLine={false} label={renderCustomLabel}>
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Legend layout="horizontal" verticalAlign="bottom" align="center"
              formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
            <Tooltip formatter={(value: number, name: string) => [
              `${value} trees (${((value / totalTrees) * 100).toFixed(0)}%)`, name,
            ]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ── Query Explorer — sits right after the pie chart ── */}
      <QueryExplorer trees={trees} />

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
