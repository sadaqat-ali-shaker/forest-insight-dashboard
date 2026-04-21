import { useState } from "react";
import { Upload, FileCheck, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const VALID_EXTENSIONS = [".las", ".laz"];

const UploadPage = () => {

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValid, setFileValid] = useState<boolean | null>(null);
  const [plotNumber, setPlotNumber] = useState("");
  const [surveyDate, setSurveyDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);

  const handleFileChange = (fileList: FileList | null) => {

    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isValid = VALID_EXTENSIONS.includes(ext);

    setSelectedFile(file);
    setFileValid(isValid);
    setError("");
    setUploaded(false);

    if (!isValid) {
      setError("Only .las and .laz files are allowed.");
    }

  };

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!selectedFile || !fileValid) {
      setError("Please select a valid LiDAR file.");
      return;
    }

    try {

      setLoading(true);
      setProgress(10);

      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append("plot_number", plotNumber);
      formData.append("survey_date", surveyDate);

      const response = await fetch("http://127.0.0.1:8000/upload-process", {
        method: "POST",
        body: formData
      });

      setProgress(60);

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      await response.json();

      localStorage.setItem("currentPlot", plotNumber);

      setProgress(100);
      setUploaded(true);

    } catch (err:any) {

      setError(err.message || "Upload failed");

    } finally {

      setLoading(false);

    }

  };

  return (

    <div className="max-w-5xl mx-auto space-y-8">

      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Upload Data
        </h1>

        <p className="text-muted-foreground mt-1">
          Upload a LiDAR (.las or .laz) file to start forest analysis
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <label className="stat-card flex flex-col items-center justify-center py-14 cursor-pointer border-dashed border-2 border-primary/30 hover:border-primary/60 transition-colors">

          <Upload className="h-10 w-10 text-primary mb-3" />

          <p className="font-semibold text-foreground">
            Click to browse file
          </p>

          <p className="text-sm text-muted-foreground mt-1">
            Accepted formats: .las, .laz
          </p>

          <input
            type="file"
            className="hidden"
            accept=".las,.laz"
            onChange={(e)=>handleFileChange(e.target.files)}
          />

        </label>

        {selectedFile && (

          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
            fileValid ? "bg-emerald-50 border-emerald-300"
            : "bg-red-50 border-red-300"
          }`}>

            {fileValid
              ? <FileCheck className="h-5 w-5 text-green-600"/>
              : <AlertCircle className="h-5 w-5 text-red-600"/>}

            <span className="text-sm font-medium">
              {selectedFile.name}
            </span>

          </div>

        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>

            <label className="text-sm font-medium">
              Plot Number
            </label>

            <input
              type="text"
              value={plotNumber}
              onChange={(e)=>setPlotNumber(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="BR01"
            />

          </div>

          <div>

            <label className="text-sm font-medium">
              Survey Date
            </label>

            <input
              type="date"
              value={surveyDate}
              onChange={(e)=>setSurveyDate(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />

          </div>

        </div>

        <Button type="submit" disabled={loading} className="gap-2">

          {loading
            ? <Loader2 className="h-4 w-4 animate-spin"/>
            : <Upload className="h-4 w-4"/>}

          {loading ? "Uploading..." : "Upload File"}

        </Button>

      </form>

      {loading && (

        <div className="w-full bg-gray-200 rounded-full h-3">

          <div
            className="bg-green-600 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />

        </div>

      )}

      {uploaded && (

        <div className="stat-card bg-green-50 border-green-300 text-green-700">

          ✅ File uploaded successfully

        </div>

      )}

      {error && (

        <div className="text-red-600">
          {error}
        </div>

      )}

    </div>

  );

};

export default UploadPage;