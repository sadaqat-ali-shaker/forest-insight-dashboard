import module_1_extraction
import module_2_dbh
import module_3_biomass
import pandas as pd


def run_pipeline(laz_path, plot_number, survey_date, output_dir):

    print("=== PIPELINE STARTED ===")

    # MODULE 1
    csv1 = module_1_extraction.process_uls_data(
        laz_path,
        plot_number,
        survey_date,
        output_dir
    )

    # MODULE 2
    csv2 = module_2_dbh.predict_dbh(csv1)

    # MODULE 3
    final_csv = module_3_biomass.calculate_biomass_final(csv2)

    df = pd.read_csv(final_csv)

    summary = {
        "plot_number": plot_number,
        "survey_date": survey_date,
        "trees_detected": int(len(df)),
        "avg_height": round(df["Tree_Height"].mean(), 2) if "Tree_Height" in df else 0,
        "avg_dbh": round(df["DBH"].mean(), 2) if "DBH" in df else 0,
        "total_biomass": round(df["Biomass_kg"].sum(), 2) if "Biomass_kg" in df else 0
    }

    records = df.to_dict(orient="records")

    return {
        "summary": summary,
        "records": records
    }