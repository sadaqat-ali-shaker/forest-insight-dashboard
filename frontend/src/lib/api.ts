const API_BASE_URL = "http://127.0.0.1:8000";

export interface InventoryRecord {
  Temp_ID?: number;
  Easting?: number;
  Northing?: number;
  Tree_Height?: number;
  Crown_Diameter?: number;
  Plot_Number?: string;
  Date?: string;
  Predicted_DBH?: number;
  Tree_UUID?: string;
  Biomass?: number;
}

export interface ProcessSummary {
  plot_number: string;
  survey_date: string;
  trees_detected: number;
  avg_height: number;
  avg_dbh: number;
  total_biomass: number;
  csv_path: string;
}

export interface ProcessResponse {
  summary: ProcessSummary;
  records: InventoryRecord[];
}

export async function processForestFile(
  file: File,
  plotNumber: string,
  surveyDate: string
): Promise<ProcessResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("plot_number", plotNumber);
  formData.append("survey_date", surveyDate);

  const response = await fetch(`${API_BASE_URL}/api/process`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to process file");
  }

  return data;
}

export function getDownloadUrl(plotNumber: string): string {
  return `${API_BASE_URL}/api/download/${encodeURIComponent(plotNumber)}`;
}