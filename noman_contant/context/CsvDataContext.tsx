import React, {
  createContext, useContext, useState, useCallback,
  useEffect, ReactNode,
} from "react";

// ── CONFIG ───────────────────────────────────────────────────────────────────
//
//  The app reads and writes tree data through a small Express backend.
//  The backend reads/writes public/Final_Presentation.csv on disk.
//
//  Backend must be running:
//    cd backend && node server.js   →  http://localhost:4000
//
//  To change the backend URL (e.g. for deployment), edit API_BASE below.
//
const API_BASE = "http://localhost:4000/api";

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
  // Derived (not stored in CSV)
  Sector: string;
  Date: Date;
}

// Raw record as returned by the backend (all strings, no derived fields)
type RawRecord = Record<string, string>;

interface CsvDataContextValue {
  trees: TreeRecord[];
  isLoaded: boolean;
  fileName: string;
  loadCsv: (file: File) => Promise<void>;
  error: string | null;
  isSaving: boolean;
  // CRUD
  addRecord: (record: TreeRecord) => Promise<void>;
  updateRecord: (record: TreeRecord, oldKey: { Tree_ID: string; Month: string; Year: number }) => Promise<void>;
  deleteScan: (treeId: string, month: string, year: number) => Promise<void>;
  deleteTree: (treeId: string) => Promise<void>;
  resetToOriginal: () => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseMonth(raw: string): number {
  return MONTH_MAP[raw?.slice(0, 3).toLowerCase()] ?? 1;
}

function extractSector(treeId: string): string {
  return treeId.split("_")[1] ?? "Unknown";
}

/** Convert raw backend record (all strings) → typed TreeRecord */
function hydrate(r: RawRecord): TreeRecord {
  const monthNum = parseMonth(r["Month"] ?? "Jan");
  const year     = parseInt(r["Year"] ?? "2020", 10) || 2020;
  const treeId   = r["Tree_ID"] ?? "";
  return {
    Tree_ID:          treeId,
    Species:          r["Species"]          ?? "Unknown",
    Latitude:         parseFloat(r["Latitude"])          || 0,
    Longitude:        parseFloat(r["Longitude"])         || 0,
    Month:            r["Month"]            ?? "Jan",
    Year:             year,
    Height:           parseFloat(r["Height"])            || 0,
    CrownDiameter:    parseFloat(r["CrownDiameter"])     || 0,
    CrownAreaConvex:  parseFloat(r["CrownAreaConvex"])   || 0,
    CrownAreaConcave: parseFloat(r["CrownAreaConcave"])  || 0,
    CrownBaseHeight:  parseFloat(r["CrownBaseHeight"])   || 0,
    Predicted_DBH:    parseFloat(r["Predicted_DBH"])     || 0,
    Biomass_kg:       parseFloat(r["Biomass_kg"])        || 0,
    Sector:           extractSector(treeId),
    Date:             new Date(year, monthNum - 1, 15),
  };
}

/** Convert TreeRecord → plain object safe to send to backend */
function dehydrate(t: TreeRecord): RawRecord {
  return {
    Tree_ID:          t.Tree_ID,
    Species:          t.Species,
    Latitude:         String(t.Latitude),
    Longitude:        String(t.Longitude),
    Month:            t.Month,
    Year:             String(t.Year),
    Height:           String(t.Height),
    CrownDiameter:    String(t.CrownDiameter),
    CrownAreaConvex:  String(t.CrownAreaConvex),
    CrownAreaConcave: String(t.CrownAreaConcave),
    CrownBaseHeight:  String(t.CrownBaseHeight),
    Predicted_DBH:    String(t.Predicted_DBH),
    Biomass_kg:       String(t.Biomass_kg),
  };
}

/** Parse a CSV text string into raw records */
function parseCsvText(text: string): RawRecord[] {
  const lines   = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals: Record<string, string> = {};
    line.split(",").map((v) => v.trim()).forEach((v, i) => {
      vals[headers[i]] = v;
    });
    return vals;
  }).filter((r) => r["Tree_ID"]);
}

// ── API helpers ───────────────────────────────────────────────────────────────

/** Fetch all records from backend */
async function apiFetchAll(): Promise<TreeRecord[]> {
  const res = await fetch(`${API_BASE}/trees`);
  if (!res.ok) throw new Error(`Backend error ${res.status}: ${await res.text()}`);
  const data: RawRecord[] = await res.json();
  return data.map(hydrate);
}

/** Save all records to backend (overwrites CSV) */
async function apiSaveAll(trees: TreeRecord[]): Promise<void> {
  const res = await fetch(`${API_BASE}/trees`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(trees.map(dehydrate)),
  });
  if (!res.ok) throw new Error(`Backend save error ${res.status}: ${await res.text()}`);
}

// ── Context ──────────────────────────────────────────────────────────────────

const CsvDataContext = createContext<CsvDataContextValue | null>(null);

export function CsvDataProvider({ children }: { children: ReactNode }) {
  const [trees,    setTrees]    = useState<TreeRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState("Final_Presentation.csv");
  const [error,    setError]    = useState<string | null>(null);

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetchAll()
      .then((records) => {
        setTrees(records);
        setIsLoaded(true);
      })
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? `${e.message} — is the backend running? (cd backend && node server.js)`
            : "Failed to load data from backend."
        );
        setIsLoaded(true);
      });
  }, []);

  // ── Persist: update state + write to CSV via backend ─────────────────────
  const persist = useCallback(async (next: TreeRecord[]) => {
    setTrees(next);
    setIsSaving(true);
    try {
      await apiSaveAll(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save to backend.");
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ── Manual CSV upload (replaces everything) ───────────────────────────────
  const loadCsv = useCallback(async (file: File) => {
    setError(null);
    try {
      const text    = await file.text();
      const raw     = parseCsvText(text);
      if (raw.length === 0) throw new Error("CSV parsed 0 rows — check column headers.");
      const records = raw.map(hydrate);
      await persist(records);
      setFileName(file.name);
      setIsLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV.");
    }
  }, [persist]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addRecord = useCallback(async (record: TreeRecord) => {
    await persist([...trees, record]);
  }, [trees, persist]);

  const updateRecord = useCallback(async (
    record: TreeRecord,
    oldKey: { Tree_ID: string; Month: string; Year: number },
  ) => {
    const next = trees.map((t) =>
      t.Tree_ID === oldKey.Tree_ID &&
      t.Month   === oldKey.Month   &&
      t.Year    === oldKey.Year
        ? record : t,
    );
    await persist(next);
  }, [trees, persist]);

  const deleteScan = useCallback(async (treeId: string, month: string, year: number) => {
    await persist(trees.filter(
      (t) => !(t.Tree_ID === treeId && t.Month === month && t.Year === year),
    ));
  }, [trees, persist]);

  const deleteTree = useCallback(async (treeId: string) => {
    await persist(trees.filter((t) => t.Tree_ID !== treeId));
  }, [trees, persist]);

  // ── Reset: re-fetch current CSV from disk via backend ─────────────────────
  const resetToOriginal = useCallback(async () => {
    setError(null);
    setIsLoaded(false);
    try {
      const records = await apiFetchAll();
      setTrees(records);
      setFileName("Final_Presentation.csv");
      setIsLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reload from backend.");
      setIsLoaded(true);
    }
  }, []);

  return (
    <CsvDataContext.Provider value={{
      trees, isLoaded, fileName, loadCsv, error, isSaving,
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
