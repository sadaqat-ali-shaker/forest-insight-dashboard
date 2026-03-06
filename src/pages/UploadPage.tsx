import { useState, useCallback } from "react";
import { Upload, FileCheck, AlertCircle, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sampleTrees } from "@/lib/mock-data";

const VALID_EXTENSIONS = [".las", ".laz", ".pcd", ".csv"];

const UploadPage = () => {
  const [files, setFiles] = useState<{ name: string; valid: boolean }[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const results = Array.from(fileList).map((f) => {
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      return { name: f.name, valid: VALID_EXTENSIONS.includes(ext) };
    });
    setFiles((prev) => [...prev, ...results]);
  }, []);

  const preview = sampleTrees.slice(0, 15);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Upload Data</h1>
        <p className="text-muted-foreground mt-1">Upload LiDAR point cloud or CSV tree data files</p>
      </div>

      {/* Drop zone */}
      <label className="stat-card flex flex-col items-center justify-center py-14 cursor-pointer border-dashed border-2 border-primary/30 hover:border-primary/60 transition-colors">
        <Upload className="h-10 w-10 text-primary mb-3" />
        <p className="font-semibold text-foreground">Drop files here or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">Accepted: .las, .laz, .pcd, .csv</p>
        <input
          type="file"
          className="hidden"
          multiple
          accept=".las,.laz,.pcd,.csv"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display font-semibold text-foreground">Uploaded Files</h3>
          {files.map((f, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${f.valid ? "bg-emerald-light border-primary/20" : "bg-destructive/10 border-destructive/30"}`}>
              {f.valid ? <FileCheck className="h-5 w-5 text-primary" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
              <span className="text-sm font-medium text-foreground">{f.name}</span>
              {!f.valid && <span className="text-xs text-destructive ml-auto">Invalid file type</span>}
            </div>
          ))}
        </div>
      )}

      {/* Dataset preview */}
      <div className="space-y-3">
        <Button
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-2"
        >
          <Table2 className="h-4 w-4" />
          {showPreview ? "Hide" : "Show"} Dataset Preview
        </Button>

        {showPreview && (
          <div className="stat-card space-y-3 overflow-auto">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Rows: <strong className="text-foreground">{sampleTrees.length}</strong></span>
              <span>Columns: <strong className="text-foreground">11</strong></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {Object.keys(preview[0]).map((k) => (
                      <th key={k} className="text-left py-2 px-3 font-semibold text-foreground whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/40">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="py-1.5 px-3 text-muted-foreground whitespace-nowrap">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
