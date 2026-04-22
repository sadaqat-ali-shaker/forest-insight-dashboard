from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
import pandas as pd
import sqlite3

import back_to_end
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
# Upload + Processing Pipeline (FINAL FIXED)
# ----------------------------
@app.post("/upload-process")
async def upload_process(
    file: UploadFile = File(...),
    plot_number: str = Form(...),
    survey_date: str = Form(...)
):
    try:
        
        for item in OUTPUT_DIR.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)

        # ----------------------------
        # 1. Validate Inputs
        # ----------------------------
        plot_number = plot_number.strip()
        survey_date = survey_date.strip()

        if not plot_number:
            return {"status": "error", "message": "Plot number is required"}

        if not survey_date:
            return {"status": "error", "message": "Survey date is required"}

        # ----------------------------
        # 2. Save Uploaded File
        # ----------------------------
        file_path = UPLOAD_DIR / file.filename

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # ----------------------------
        # 3. MODULE 1
        # ----------------------------
        df_m1 = module_1_extraction.process_uls_data(
            str(file_path),
            plot_number,
            survey_date,
            output_dir=str(OUTPUT_DIR),
            save_csv=True
        )

        if df_m1 is None or df_m1.empty:
            return {
                "status": "error",
                "message": "Module 1 failed: No trees detected"
            }

        # ----------------------------
        # 4. MODULE 2
        # ----------------------------
        df_m2 = module_2_dbh.predict_dbh(df_m1)

        if df_m2 is None or "dbh" not in df_m2.columns:
            return {
                "status": "error",
                "message": "Module 2 failed: DBH not generated"
            }

        # ----------------------------
        # 5. MODULE 3
        # ----------------------------
        results = module_3_biomass.integrate_with_database(df_m2, plot_number)

        # ----------------------------
        # 6. RUN BACK_TO_END (FIXED)
        # ----------------------------
        try:
            files = list(OUTPUT_DIR.glob(f"M3_Results_{plot_number}_*.csv"))

            if files:
                latest_m3 = max(files, key=lambda f: f.stat().st_mtime)

                back_to_end.run_back_to_end(
                    m3_file_path=str(latest_m3),

                    # 🔥 your input main file
                    main_file_path=r"C:\Users\junai\forest-insight-dashboard\frontend\src\Final_Presentation.csv",

                    # 🔥 your output file (frontend public)
                    output_path=r"C:\Users\junai\forest-insight-dashboard\frontend\public\Final_Presentation.csv"
                )

        except Exception as e:
            print(f"Back_to_end failed: {e}")

        # ----------------------------
        # 7. Response (FRONTEND SAFE)
        # ----------------------------
        return {
            "status": "success",
            "trees_detected": len(df_m1),
            "plot": plot_number,
            "message": "Pipeline completed successfully",
            "records_inserted": len(results) if results else 0,
            "sample_data": df_m2.head(5).to_dict("records")
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Pipeline failed: {str(e)}"
        }

# ----------------------------
# Segmentation API
# ----------------------------
@app.get("/segmentation/{plot}")
def segmentation(plot: str):

    files = sorted(OUTPUT_DIR.glob(f"M1_Extracted_{plot}*.csv"))

    if not files:
        return {"trees": 0, "points": []}

    latest_file = files[-1]
    df = pd.read_csv(latest_file)

    required_cols = ["easting", "northing", "height"]

    for col in required_cols:
        if col not in df.columns:
            return {
                "status": "error",
                "message": f"Missing column: {col}"
            }

    return {
        "trees": len(df),
        "avg_height": float(df["height"].mean()),
        "max_height": float(df["height"].max()),
        "points": df[["easting", "northing", "height"]].to_dict("records")
    }

# ----------------------------
# Features API
# ----------------------------
@app.get("/features/{plot}")
def features(plot: str):

    files = list(OUTPUT_DIR.glob(f"M3_Results_{plot}_*.csv"))

    if not files:
        return []

    latest_file = max(files, key=lambda f: f.stat().st_mtime)
    df = pd.read_csv(latest_file)

    return df.to_dict("records")

# ----------------------------
# Inventory API
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

# ----------------------------
# Reset API
# ----------------------------
@app.delete("/reset/{plot}")
def reset_plot(plot: str):

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    DELETE FROM Measurements
    WHERE tree_uuid IN (
        SELECT tree_uuid FROM Trees
        WHERE plot_id = (SELECT plot_id FROM Plots WHERE plot_code=?)
    )
    """, (plot,))

    cursor.execute("""
    DELETE FROM Trees
    WHERE plot_id = (SELECT plot_id FROM Plots WHERE plot_code=?)
    """, (plot,))

    conn.commit()
    conn.close()

    return {"status": "plot cleared"}