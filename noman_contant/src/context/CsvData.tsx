import React, {
  createContext, useContext, useState, useCallback,
  useEffect, ReactNode,
} from "react";
import { forestData } from "@/lib/forest-data";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TreeRecord {
  Tree_ID: string;
  Species: string;
  Latitude: number;
  Longitude: number;
  Month: string;
  Year: number;
  Height: number;
  CrownDiameter: number;
  CrownAreaConvex: number;
  CrownAreaConcave: number;
  CrownBaseHeight: number;
  Predicted_DBH: number;
  Biomass_kg: number;
  // Derived
  Sector: string;
  Date: Date;
}

interface CsvDataContextValue {
  trees: TreeRecord[];
  isLoaded: boolean;
  fileName: string;
  loadCsv: (file: File) => Promise<void>;
  error: string | null;
  // CRUD
  addRecord: (record: TreeRecord) => void;
  /** Match on oldKey (original Tree_ID + Month + Year), replace with record. */
  updateRecord: (record: TreeRecord, oldKey: { Tree_ID: string; Month: string; Year: number }) => void;
  /** Remove exactly ONE scan row matched by Tree_ID + Month + Year. */
  deleteScan: (treeId: string, month: string, year: number) => void;
  /** Remove ALL scan rows for a given Tree_ID. */
  deleteTree: (treeId: string) => void;
  resetToOriginal: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = "forest_inventory_data_v1";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseMonth(raw: string): number {
  return MONTH_MAP[raw?.slice(0, 3).toLowerCase()] ?? 1;
}

function extractSector(treeId: string): string {
  const parts = treeId.split("_");
  return parts[1] ?? "Unknown";
}

function parseCsvText(text: string): TreeRecord[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });

    const monthNum = parseMonth(row["Month"] ?? "Jan");
    const year     = parseInt(row["Year"] ?? "2020", 10) || 2020;
    const treeId   = row["Tree_ID"] ?? "";

    return {
      Tree_ID:          treeId,
      Species:          row["Species"] ?? "Unknown",
      Latitude:         parseFloat(row["Latitude"])   || 0,
      Longitude:        parseFloat(row["Longitude"])  || 0,
      Month:            row["Month"] ?? "Jan",
      Year:             year,
      Height:           parseFloat(row["Height"])          || 0,
      CrownDiameter:    parseFloat(row["CrownDiameter"])   || 0,
      CrownAreaConvex:  parseFloat(row["CrownAreaConvex"]) || 0,
      CrownAreaConcave: parseFloat(row["CrownAreaConcave"])|| 0,
      CrownBaseHeight:  parseFloat(row["CrownBaseHeight"]) || 0,
      Predicted_DBH:    parseFloat(row["Predicted_DBH"])   || 0,
      Biomass_kg:       parseFloat(row["Biomass_kg"])      || 0,
      Sector:           extractSector(treeId),
      Date:             new Date(year, monthNum - 1, 15),
    };
  }).filter((r) => r.Tree_ID !== "");
}

function seedFromStatic(): TreeRecord[] {
  return (forestData as any[]).map((r) => {
    const monthNum = parseMonth(r.Month ?? "Jun");
    const treeId   = r.Tree_ID ?? "";
    return {
      ...r,
      Sector: extractSector(treeId),
      Date:   new Date(r.Year ?? 2019, monthNum - 1, 15),
    } as TreeRecord;
  });
}

function saveToStorage(records: TreeRecord[]): void {
  try {
    const serializable = records.map((r) => ({ ...r, Date: r.Date.toISOString() }));
    localStorage.setItem(LS_KEY, JSON.stringify(serializable));
  } catch (e) {
    console.warn("localStorage write failed", e);
  }
}

function loadFromStorage(): TreeRecord[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed as any[]).map((r) => ({ ...r, Date: new Date(r.Date) }));
  } catch {
    return null;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const CsvDataContext = createContext<CsvDataContextValue | null>(null);

export function CsvDataProvider({ children }: { children: ReactNode }) {
  const [trees, setTrees]       = useState<TreeRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fileName, setFileName] = useState("forest_data.ts (built-in)");
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored && stored.length > 0) {
      setTrees(stored);
      setIsLoaded(true);
      return;
    }
    const seeded = seedFromStatic();
    setTrees(seeded);
    setIsLoaded(true);
    saveToStorage(seeded);
  }, []);

  const persist = useCallback((next: TreeRecord[]) => {
    setTrees(next);
    saveToStorage(next);
  }, []);

  const loadCsv = useCallback(async (file: File) => {
    setError(null);
    try {
      const text   = await file.text();
      const parsed = parseCsvText(text);
      if (parsed.length === 0) throw new Error("CSV parsed 0 rows — check column headers.");
      persist(parsed);
      setFileName(file.name);
      setIsLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV.");
    }
  }, [persist]);

  const addRecord = useCallback((record: TreeRecord) => {
    persist([...trees, record]);
  }, [trees, persist]);

  const updateRecord = useCallback((
    record: TreeRecord,
    oldKey: { Tree_ID: string; Month: string; Year: number },
  ) => {
    // Match on the ORIGINAL key so renaming Tree_ID parts works correctly.
    const next = trees.map((t) =>
      t.Tree_ID === oldKey.Tree_ID &&
      t.Month   === oldKey.Month   &&
      t.Year    === oldKey.Year
        ? record : t,
    );
    persist(next);
  }, [trees, persist]);

  /** Remove exactly ONE scan row (Tree_ID + Month + Year). */
  const deleteScan = useCallback((treeId: string, month: string, year: number) => {
    persist(trees.filter(
      (t) => !(t.Tree_ID === treeId && t.Month === month && t.Year === year),
    ));
  }, [trees, persist]);

  /** Remove ALL scan rows for a Tree_ID (entire tree history). */
  const deleteTree = useCallback((treeId: string) => {
    persist(trees.filter((t) => t.Tree_ID !== treeId));
  }, [trees, persist]);

  const resetToOriginal = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    const seeded = seedFromStatic();
    setTrees(seeded);
    setFileName("forest_data.ts (built-in)");
    saveToStorage(seeded);
  }, []);

  return (
    <CsvDataContext.Provider value={{
      trees, isLoaded, fileName, loadCsv, error,
      addRecord, updateRecord, deleteScan, deleteTree, resetToOriginal,
    }}>
      {children}
    </CsvDataContext.Provider>
  );
}

export function useCsvData(): CsvDataContextValue {
  const ctx = useContext(CsvDataContext);
  if (!ctx) throw new Error("useCsvData must be used inside CsvDataProvider");
  return ctx;
}
