import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { forestData } from "@/lib/forest-data";

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
  Sector: string;
  Date: Date;
}

interface CsvDataContextValue {
  trees: TreeRecord[];
  isLoaded: boolean;
  fileName: string;
}

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

const CsvDataContext = createContext<CsvDataContextValue | null>(null);

export function CsvDataProvider({ children }: { children: ReactNode }) {
  const trees: TreeRecord[] = useMemo(() =>
    forestData.map((r) => {
      const monthNum = parseMonth(r.Month);
      const date = new Date(r.Year, monthNum - 1, 15);
      return {
        ...r,
        Sector: extractSector(r.Tree_ID),
        Date: date,
      };
    }),
    []
  );

  return (
    <CsvDataContext.Provider value={{ trees, isLoaded: true, fileName: "Final_Presentation.csv" }}>
      {children}
    </CsvDataContext.Provider>
  );
}

export function useCsvData(): CsvDataContextValue {
  const ctx = useContext(CsvDataContext);
  if (!ctx) throw new Error("useCsvData must be used inside CsvDataProvider");
  return ctx;
}
