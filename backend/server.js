const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");

const app = express();

// ── Increase payload limit for large CSV datasets ──
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ── Path to your CSV in the frontend public folder ──
const CSV_PATH = path.join(
  __dirname,
  "../frontend/public/Final_Presentation.csv"
);

// ── Column order (must match your CSV headers exactly) ──
const COLUMNS = [
  "Tree_ID","Species","Latitude","Longitude","Month","Year",
  "Height","CrownDiameter","CrownAreaConvex","CrownAreaConcave",
  "CrownBaseHeight","Predicted_DBH","Biomass_kg",
];

// ── Helper: convert array of objects → CSV text ──
function toCsv(records) {
  const rows = [COLUMNS.join(",")];
  for (const r of records) {
    rows.push(COLUMNS.map((c) => r[c] ?? "").join(","));
  }
  return rows.join("\n");
}

// ── Helper: parse CSV text → array of objects ──
function parseCsv(text) {
  const lines   = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  }).filter((r) => r.Tree_ID);
}

// ── Root route: friendly message instead of "Cannot GET /" ──
app.get("/", (req, res) => {
  res.json({
    message: "✅ Forest backend is running!",
    endpoints: {
      getAllTrees:  "GET  http://localhost:4000/api/trees",
      saveAllTrees: "POST http://localhost:4000/api/trees",
    },
    csvPath: CSV_PATH,
  });
});

// ── GET /api/trees → returns all records as JSON ──
app.get("/api/trees", (req, res) => {
  try {
    const text    = fs.readFileSync(CSV_PATH, "utf8");
    const records = parseCsv(text);
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: "Could not read CSV: " + e.message });
  }
});

// ── POST /api/trees → save ALL records (replaces CSV) ──
app.post("/api/trees", (req, res) => {
  try {
    const records = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: "Body must be an array of records." });
    }
    fs.writeFileSync(CSV_PATH, toCsv(records), "utf8");
    res.json({ success: true, count: records.length });
  } catch (e) {
    res.status(500).json({ error: "Could not write CSV: " + e.message });
  }
});

app.listen(4000, () => {
  console.log("✅ Forest backend running at http://localhost:4000");
  console.log("   CSV path:", CSV_PATH);
  console.log("   Test it:  http://localhost:4000/api/trees");
});
