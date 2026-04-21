from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
import pandas as pd
import sqlite3

import module_1_extraction
import module_2_dbh
import module_3_biomass

app = FastAPI(title="Forest Inventory API")

# ----------------------------
# Enable CORS for React
# ----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Paths
# ----------------------------
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

OUTPUT_DIR = Path("Final_Output")
OUTPUT_DIR.mkdir(exist_ok=True)

DB_PATH = Path("forest_inventory.db")

# ----------------------------
# Root
# ----------------------------
@app.get("/")
def root():
    return {
        "message": "Forest Inventory API is running",
        "status": "OK"
    }

# ----------------------------
# Upload + Processing Pipeline
# ----------------------------
@app.post("/upload-process")
async def upload_process(
    file: UploadFile = File(...),
    plot_number: str = Form(...),
    survey_date: str = Form(...)
):

    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Module 1
    df_m1 = module_1_extraction.process_uls_data(
        str(file_path),
        plot_number,
        survey_date,
        output_dir=str(OUTPUT_DIR)
    )

    # Module 2
    df_m2 = module_2_dbh.predict_dbh(df_m1)

    # Module 3
    module_3_biomass.integrate_with_database(df_m2, plot_number)

    return {
        "status": "success",
        "trees_detected": len(df_m1),
        "plot": plot_number
    }

# ----------------------------
# Segmentation API
# ----------------------------
@app.get("/segmentation/{plot}")
def segmentation(plot: str):

    csv_path = OUTPUT_DIR / f"M1_Extracted_{plot}.csv"

    if not csv_path.exists():
        return {"trees": 0, "points": []}

    df = pd.read_csv(csv_path)

    return {
        "trees": len(df),
        "avg_height": float(df["Tree_Height"].mean()),
        "max_height": float(df["Tree_Height"].max()),
        "points": df[["Easting","Northing","Tree_Height"]].to_dict("records")
    }

# ----------------------------
# Features API
# ----------------------------
@app.get("/features/{plot}")
def features(plot: str):

    csv_path = OUTPUT_DIR / f"M1_Extracted_{plot}.csv"

    if not csv_path.exists():
        return []

    df = pd.read_csv(csv_path)

    return df.to_dict("records")

# ----------------------------
# Inventory API (FIXED)
# ----------------------------
@app.get("/inventory/{plot}")
def inventory(plot: str):

    conn = sqlite3.connect(DB_PATH)

    query = """
    SELECT
        Trees.tree_id,
        Species.species_name,
        Measurements.height,
        Measurements.dbh,
        Measurements.crown_diameter,
        Measurements.biomass,
        Trees.easting,
        Trees.northing
    FROM Trees
    JOIN Measurements ON Trees.tree_uuid = Measurements.tree_uuid
    JOIN Species ON Trees.species_id = Species.species_id
    JOIN Plots ON Trees.plot_id = Plots.plot_id
    WHERE Plots.plot_code = ?
    """

    df = pd.read_sql_query(query, conn, params=(plot,))
    conn.close()

    return df.to_dict("records")
@app.delete("/reset/{plot}")
def reset_plot(plot:str):

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    DELETE FROM Measurements
    WHERE tree_uuid IN (
        SELECT tree_uuid FROM Trees
        WHERE plot_id = (SELECT plot_id FROM Plots WHERE plot_code=?)
    )
    """,(plot,))

    cursor.execute("""
    DELETE FROM Trees
    WHERE plot_id = (SELECT plot_id FROM Plots WHERE plot_code=?)
    """,(plot,))

    conn.commit()
    conn.close()

    return {"status":"plot cleared"}