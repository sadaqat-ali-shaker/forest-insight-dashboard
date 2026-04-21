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

export type ChangeStatus = "Stable" | "New Tree" | "Missing Tree" | "Monitoring";

export interface ForestChangeRecord {
  Tree_ID: string;
  Latitude: number;
  Longitude: number;
  Species: string;
  Status: ChangeStatus;
  /**
   * Number of scan dates this tree appears in.
   * Useful for UI tooltips and debugging.
   */
  ScanCount: number;
  /**
   * The scan-date labels this tree appears in, e.g. ["Jun 2019", "Mar 2020"]
   */
  ScanLabels: string[];
  /**
   * Human-readable explanation of why this status was assigned.
   * Helps the user understand partial-update scenarios.
   */
  Reason: string;
  /** The sector this tree belongs to (used for per-sector change detection). */
  Sector: string;
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
  if (ch < 0.5)   return "Low";
  if (ch < 2.0)   return "Moderate";
  return "High";
}

function scanLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
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
//
// DESIGN GOALS — handles every CRUD + multi-sector scenario:
//
//  1. Normal multi-scan dataset (original 5 scans, one sector):
//     Per-sector comparison: each tree is compared against its OWN sector's
//     first and last dense scan date.  Stable / New Tree / Missing Tree as before.
//
//  2. NEW SECTOR ADDED (e.g. Sector A/B run Jun 2019–Jun 2020, Sector C starts
//     Jul 2020):
//     Sector C's Jul 2020 scan does NOT become the global "last snapshot".
//     Each sector has its own timeline.  A/B trees are compared against their
//     own sector's Jun 2019 → Jun 2020 range and remain Stable.  Sector C trees
//     are compared against Jul 2020 → Jul 2020 (single-scan → Monitoring until
//     a second Sector C scan exists).
//
//  3. Single tree added via Data Manager with a new date (thin scan):
//     Thin dates (< THIN_THRESHOLD trees) are partial updates.  They shift
//     neither the sector's refFirst nor refLast.  The added tree is Monitoring.
//
//  4. Tree deleted via Data Manager:
//     Disappears from all records.  If it was in its sector's first scan and
//     not in the last → Missing Tree.  If only in later scans → vanishes cleanly.
//
//  5. New tree added into an existing scan month:
//     Classified against its sector's existing first/last range.  No impact on
//     other sectors.
//
//  6. Tree with only one scan record:
//     Monitoring unless it was in sector's first scan only → Missing Tree.
//
//  7. Single-sector, single-date dataset:
//     All trees → Monitoring.
//
// ALGORITHM:
//   For each sector independently:
//     a. Collect all dense scan dates for that sector.
//     b. refFirst = earliest dense date, refLast = latest dense date.
//     c. Classify every tree in that sector against those sector-local refs.
//   Trees from different sectors never affect each other's classification.

const THIN_THRESHOLD = 5;

export function computeForestChange(trees: TreeRecord[]): ForestChangeRecord[] {
  if (!trees.length) return [];

  const MONTH_NUM: Record<string, number> = {
    Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,
    Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
  };

  function dateKey(t: TreeRecord): number {
    return t.Year * 100 + (MONTH_NUM[t.Month] ?? 0);
  }

  function keyLabel(k: number, dateObjMap: Map<number, Date>): string {
    const d = dateObjMap.get(k);
    if (d) return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    // Reconstruct from key: YYYYMM
    const yr = Math.floor(k / 100);
    const mo = k % 100;
    const months = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[mo] ?? mo} ${yr}`;
  }

  // ── Group trees by sector ──────────────────────────────────────────────────
  const treeBySector = new Map<string, TreeRecord[]>();
  for (const t of trees) {
    if (!treeBySector.has(t.Sector)) treeBySector.set(t.Sector, []);
    treeBySector.get(t.Sector)!.push(t);
  }

  const results: ForestChangeRecord[] = [];

  // ── Process each sector independently ─────────────────────────────────────
  for (const [sector, sectorTrees] of treeBySector) {

    // Date objects for this sector
    const sectorDateObj = new Map<number, Date>();
    // Scan population per date key (for this sector)
    const sectorScanPop = new Map<number, Set<string>>();
    // All scan keys each tree appears in (within this sector)
    const treeScans     = new Map<string, Set<number>>();
    // Latest record per tree in this sector
    const treeLatest    = new Map<string, TreeRecord>();

    for (const t of sectorTrees) {
      const key = dateKey(t);
      if (!sectorScanPop.has(key)) {
        sectorScanPop.set(key, new Set());
        sectorDateObj.set(key, t.Date);
      }
      sectorScanPop.get(key)!.add(t.Tree_ID);

      if (!treeScans.has(t.Tree_ID)) treeScans.set(t.Tree_ID, new Set());
      treeScans.get(t.Tree_ID)!.add(key);

      const ex = treeLatest.get(t.Tree_ID);
      if (!ex || t.Date > ex.Date) treeLatest.set(t.Tree_ID, t);
    }

    // Determine dense scan dates for THIS sector only
    const sortedKeys  = [...sectorScanPop.keys()].sort((a, b) => a - b);
    const denseKeys   = sortedKeys.filter(k => sectorScanPop.get(k)!.size >= THIN_THRESHOLD);

    // Fallback: if sector has no dense dates (e.g. user added a handful),
    // treat all its dates as its own reference — no cross-sector contamination.
    const refKeys     = denseKeys.length >= 2 ? denseKeys : sortedKeys;
    const refFirstKey = refKeys[0];
    const refLastKey  = refKeys[refKeys.length - 1];
    const singleMode  = refFirstKey === refLastKey;

    const firstSet = sectorScanPop.get(refFirstKey) ?? new Set<string>();
    const lastSet  = sectorScanPop.get(refLastKey)  ?? new Set<string>();

    // ── Classify each tree in this sector ──────────────────────────────────
    for (const [treeId, scanKeys] of treeScans) {
      const rec      = treeLatest.get(treeId)!;
      const scanArr  = [...scanKeys].sort((a, b) => a - b);
      const scanCount = scanArr.length;
      const labels   = scanArr.map(k => keyLabel(k, sectorDateObj));

      let status: ChangeStatus;
      let reason: string;

      if (singleMode) {
        // Sector has only one reference scan date — cannot compare yet
        status = "Monitoring";
        reason = `Sector ${sector}: only one scan date (${keyLabel(refFirstKey, sectorDateObj)}). ` +
                 `Add more scans for this sector to enable change detection.`;

      } else if (scanCount === 1) {
        const onlyKey = scanArr[0];
        const scanPop = sectorScanPop.get(onlyKey)!.size;

        if (onlyKey === refFirstKey && !lastSet.has(treeId)) {
          // In sector's first scan, never seen again
          status = "Missing Tree";
          reason = `Sector ${sector}: present in first scan (${keyLabel(refFirstKey, sectorDateObj)}) ` +
                   `but absent from last scan (${keyLabel(refLastKey, sectorDateObj)}).`;

        } else if (onlyKey === refLastKey && !firstSet.has(treeId)) {
          if (scanPop >= THIN_THRESHOLD) {
            status = "New Tree";
            reason = `Sector ${sector}: not in first scan (${keyLabel(refFirstKey, sectorDateObj)}). ` +
                     `First appeared in last scan (${keyLabel(refLastKey, sectorDateObj)}) ` +
                     `alongside ${scanPop} other trees.`;
          } else {
            status = "Monitoring";
            reason = `Sector ${sector}: only in ${keyLabel(onlyKey, sectorDateObj)}, ` +
                     `a partial update (${scanPop} tree${scanPop !== 1 ? "s" : ""}). Cannot confirm as New Tree.`;
          }

        } else if (onlyKey > refLastKey) {
          // This tree's only scan is BEYOND the sector's last dense scan
          if (scanPop >= THIN_THRESHOLD) {
            status = "New Tree";
            reason = `Sector ${sector}: appears only in ${keyLabel(onlyKey, sectorDateObj)}, ` +
                     `a new dense scan after ${keyLabel(refLastKey, sectorDateObj)}.`;
          } else {
            status = "Monitoring";
            reason = `Sector ${sector}: added in ${keyLabel(onlyKey, sectorDateObj)}, ` +
                     `a partial update. Awaiting more scan data to classify.`;
          }

        } else {
          status = "Monitoring";
          reason = `Sector ${sector}: only one scan record (${keyLabel(onlyKey, sectorDateObj)}). ` +
                   `More data needed to classify.`;
        }

      } else {
        // Tree has records across multiple scan dates within this sector
        const inFirst = firstSet.has(treeId);
        const inLast  = lastSet.has(treeId);

        if (inFirst && inLast) {
          status = "Stable";
          reason = `Sector ${sector}: present in both first scan (${keyLabel(refFirstKey, sectorDateObj)}) ` +
                   `and last scan (${keyLabel(refLastKey, sectorDateObj)}). ` +
                   `Recorded across ${scanCount} scan date${scanCount > 1 ? "s" : ""}.`;

        } else if (!inFirst && inLast) {
          status = "New Tree";
          reason = `Sector ${sector}: not in first scan (${keyLabel(refFirstKey, sectorDateObj)}), ` +
                   `but present in last scan (${keyLabel(refLastKey, sectorDateObj)}). ` +
                   `First appeared: ${keyLabel(scanArr[0], sectorDateObj)}.`;

        } else if (inFirst && !inLast) {
          status = "Missing Tree";
          reason = `Sector ${sector}: present in first scan (${keyLabel(refFirstKey, sectorDateObj)}) ` +
                   `but absent from last scan (${keyLabel(refLastKey, sectorDateObj)}). ` +
                   `Last recorded: ${keyLabel(scanArr[scanArr.length - 1], sectorDateObj)}.`;

        } else {
          status = "Monitoring";
          reason = `Sector ${sector}: recorded in ${scanCount} intermediate scan${scanCount > 1 ? "s" : ""} ` +
                   `(${labels.join(", ")}) but not in sector's reference first or last scan.`;
        }
      }

      results.push({
        Tree_ID:    treeId,
        Latitude:   rec.Latitude,
        Longitude:  rec.Longitude,
        Species:    rec.Species,
        Status:     status,
        ScanCount:  scanCount,
        ScanLabels: labels,
        Reason:     reason,
        Sector:     sector,
      });
    }
  }

  // Sort: Stable first, then New Tree, Missing Tree, Monitoring
  const ORDER: Record<ChangeStatus, number> = {
    Stable: 0, "New Tree": 1, "Missing Tree": 2, Monitoring: 3,
  };
  results.sort((a, b) => ORDER[a.Status] - ORDER[b.Status]);

  return results;
}

// ── scanAverages ──────────────────────────────────────────────────────────────

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
