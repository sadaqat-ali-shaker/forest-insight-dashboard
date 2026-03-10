import { useState } from "react";
import { Upload, FileCheck, AlertCircle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processForestFile, getDownloadUrl, type ProcessResponse } from "@/lib/api";

const VALID_EXTENSIONS = [".las", ".laz"];

const UploadPage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValid, setFileValid] = useState<boolean | null>(null);
  const [plotNumber, setPlotNumber] = useState("");
  const [surveyDate, setSurveyDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProcessResponse | null>(null);

  const handleFileChange = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isValid = VALID_EXTENSIONS.includes(ext);

    setSelectedFile(file);
    setFileValid(isValid);
    setError("");
    setResult(null);

    if (!isValid) {
      setError("Only .las and .laz files are allowed.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!selectedFile) {
      setError("Please select a .las or .laz file.");
      return;
    }

    if (!fileValid) {
      setError("Selected file type is invalid.");
      return;
    }

    if (!plotNumber.trim()) {
      setError("Please enter plot number.");
      return;
    }

    if (!surveyDate) {
      setError("Please select survey date.");
      return;
    }

    try {
      setLoading(true);
      const data = await processForestFile(selectedFile, plotNumber, surveyDate);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Processing failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Upload Data</h1>
        <p className="text-muted-foreground mt-1">
          Upload a LiDAR .las or .laz file, send it to Flask backend, and view real results.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File upload */}
        <label className="stat-card flex flex-col items-center justify-center py-14 cursor-pointer border-dashed border-2 border-primary/30 hover:border-primary/60 transition-colors">
          <Upload className="h-10 w-10 text-primary mb-3" />
          <p className="font-semibold text-foreground">Click to browse file</p>
          <p className="text-sm text-muted-foreground mt-1">Accepted: .las, .laz</p>
          <input
            type="file"
            className="hidden"
            accept=".las,.laz"
            onChange={(e) => handleFileChange(e.target.files)}
          />
        </label>

        {/* Selected file */}
        {selectedFile && (
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              fileValid
                ? "bg-emerald-50 border-emerald-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            {fileValid ? (
              <FileCheck className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-sm font-medium text-foreground">{selectedFile.name}</span>
            {!fileValid && (
              <span className="text-xs text-red-600 ml-auto">Invalid file type</span>
            )}
          </div>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Plot Number</label>
            <input
              type="text"
              value={plotNumber}
              onChange={(e) => setPlotNumber(e.target.value)}
              placeholder="Enter plot number"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Survey Date</label>
            <input
              type="date"
              value={surveyDate}
              onChange={(e) => setSurveyDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {loading ? "Processing..." : "Upload & Process"}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          <div className="stat-card space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-xl font-display font-semibold text-foreground">Processing Summary</h2>

              <a
                href={getDownloadUrl(result.summary.plot_number)}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Plot Number</p>
                <p className="text-lg font-semibold">{result.summary.plot_number}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Survey Date</p>
                <p className="text-lg font-semibold">{result.summary.survey_date}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Trees Detected</p>
                <p className="text-lg font-semibold">{result.summary.trees_detected}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Average Height</p>
                <p className="text-lg font-semibold">{result.summary.avg_height}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Average DBH</p>
                <p className="text-lg font-semibold">{result.summary.avg_dbh}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Biomass</p>
                <p className="text-lg font-semibold">{result.summary.total_biomass}</p>
              </div>
            </div>
          </div>

          <div className="stat-card space-y-4 overflow-auto">
            <h2 className="text-xl font-display font-semibold text-foreground">Detected Tree Records</h2>

            {result.records.length === 0 ? (
              <p className="text-muted-foreground">No records returned.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">Temp_ID</th>
                      <th className="text-left py-2 px-3">Easting</th>
                      <th className="text-left py-2 px-3">Northing</th>
                      <th className="text-left py-2 px-3">Tree_Height</th>
                      <th className="text-left py-2 px-3">Crown_Diameter</th>
                      <th className="text-left py-2 px-3">Predicted_DBH</th>
                      <th className="text-left py-2 px-3">Biomass</th>
                      <th className="text-left py-2 px-3">Tree_UUID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.records.map((row, i) => (
                      <tr key={row.Tree_UUID || row.Temp_ID || i} className="border-b border-border/40 hover:bg-muted/40">
                        <td className="py-2 px-3">{row.Temp_ID ?? "-"}</td>
                        <td className="py-2 px-3">{row.Easting ?? "-"}</td>
                        <td className="py-2 px-3">{row.Northing ?? "-"}</td>
                        <td className="py-2 px-3">{row.Tree_Height ?? "-"}</td>
                        <td className="py-2 px-3">{row.Crown_Diameter ?? "-"}</td>
                        <td className="py-2 px-3">{row.Predicted_DBH ?? "-"}</td>
                        <td className="py-2 px-3">{row.Biomass ?? "-"}</td>
                        <td className="py-2 px-3">{row.Tree_UUID ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;