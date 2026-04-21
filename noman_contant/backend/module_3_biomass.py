import pandas as pd
import sqlite3
import joblib
import uuid
import numpy as np
import warnings
from pathlib import Path
import re
from config import CONFIG

warnings.filterwarnings("ignore", category=UserWarning)

SCRIPT_DIR = Path(__file__).parent
MODEL_PATH = SCRIPT_DIR / "trained_models" / "specie_classificaton.pkl"
DB_PATH = SCRIPT_DIR / "forest_inventory.db"

SPECIES_MAP = {
    0: "Acer campestre", 1: "Acer platanoides", 2: "Acer pseudoplatanus",
    3: "Alnus glutinosa", 4: "Betula pendula", 5: "Carpinus betulus",
    6: "Fagus sylvatica", 7: "Fraxinus excelsior", 8: "Prunus avium",
    9: "Quercus robur", 10: "Tilia cordata"
}

def get_species_prefix(name):
    parts = name.split()
    if len(parts) >= 2:
        return parts[0][:3].capitalize() + parts[1][:3].capitalize()
    return name[:6].capitalize()


def integrate_with_database(df_extracted, plot_code):

    if df_extracted is None or df_extracted.empty:
        raise ValueError("Input DataFrame is empty")

    conn = sqlite3.connect(str(DB_PATH), timeout=20)
    cursor = conn.cursor()

    # --- Plot ---
    cursor.execute("SELECT plot_id FROM Plots WHERE plot_code = ?", (plot_code,))
    res_plot = cursor.fetchone()

    if res_plot:
        p_id = res_plot[0]
    else:
        cursor.execute("INSERT INTO Plots (plot_code) VALUES (?)", (plot_code,))
        conn.commit()
        p_id = cursor.lastrowid

    # --- Existing Trees ---
    cursor.execute("""
        SELECT tree_uuid, easting, northing, species_id, tree_id 
        FROM Trees WHERE plot_id = ?
    """, (p_id,))
    existing_trees = cursor.fetchall()

    # --- FIX 1: Extract existing T numbers safely ---
    existing_numbers = []
    for _, _, _, _, tree_id in existing_trees:
        match = re.search(r'T(\d+)', tree_id)
        if match:
            existing_numbers.append(int(match.group(1)))

    new_tree_counter = max(existing_numbers, default=0) + 1

    # --- Load Model ---
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Species model not found: {MODEL_PATH}")

    model = joblib.load(str(MODEL_PATH))

    try:
        expected_features = model.feature_names_in_
    except AttributeError:
        expected_features = ['CrownDiameter', 'Height', 'Predicted_DBH']

    processed_results = []

    # --- Stats (optional but useful) ---
    matched_count = 0
    new_count = 0

    # --- Loop ---
    for _, row in df_extracted.iterrows():

        x_new = row['easting']
        y_new = row['northing']
        h = row['height']
        crown = row['crown_diameter']
        dbh = row['dbh']
        scan_date = row['scan_date']

        if any(pd.isna(v) for v in [x_new, y_new, h, crown, dbh]):
            print("[Module 3] Skipping invalid row")
            continue

        matched_uuid, s_id, existing_custom_id = None, None, None

        # --- FIX 2: Improved Spatial Matching ---
        threshold = CONFIG["matching_threshold"]
        best_match = None
        min_dist = float('inf')

        for t_uuid, x_old, y_old, old_s_id, old_custom_id in existing_trees:
            dist = np.sqrt((x_new - x_old)**2 + (y_new - y_old)**2)

            if dist < min_dist:
                min_dist = dist
                best_match = (t_uuid, old_s_id, old_custom_id)

        # --- Decision ---
        if best_match and min_dist <= threshold:
            matched_uuid, s_id, existing_custom_id = best_match
            confidence = round(1 - (min_dist / threshold), 3)
            matched_count += 1
        else:
            matched_uuid = None
            confidence = 0
            new_count += 1

        # --- Existing ---
        if matched_uuid:
            t_uuid, custom_id = matched_uuid, existing_custom_id

        # --- New ---
        else:
            t_uuid = str(uuid.uuid4())[:8]

            val_map = {
                'Height': h, 'Height [m]': h,
                'CrownDiameter': crown, 'Crown diameter [m]': crown,
                'Predicted_DBH': dbh, 'DBH [cm]': dbh
            }

            input_list = [val_map.get(feat, 0) for feat in expected_features]
            features_df = pd.DataFrame([input_list], columns=expected_features)

            pred_idx = model.predict(features_df)[0]
            s_name = SPECIES_MAP.get(pred_idx, "Unknown")

            prefix = get_species_prefix(s_name)

            # --- FIXED ID ---
            custom_id = f"{prefix}_{plot_code}_T{new_tree_counter}"
            new_tree_counter += 1

            cursor.execute("SELECT species_id FROM Species WHERE species_name = ?", (s_name,))
            s_res = cursor.fetchone()
            s_id = s_res[0] if s_res else 1

            cursor.execute("""
                INSERT INTO Trees (tree_uuid, tree_id, plot_id, species_id, easting, northing)
                VALUES (?,?,?,?,?,?)
            """, (t_uuid, custom_id, p_id, s_id, x_new, y_new))

        # --- Biomass ---
        cursor.execute("SELECT wood_density, species_name FROM Species WHERE species_id = ?", (s_id,))
        wd_res = cursor.fetchone()
        wd, s_name = (wd_res[0], wd_res[1]) if wd_res else (0.6, "Unknown")

        biomass = round(0.0673 * ((wd * (dbh**2) * h)**0.976), 3)

        # --- Measurement ---
        cursor.execute("""
            INSERT OR REPLACE INTO Measurements 
            (tree_uuid, scan_date, height, dbh, biomass, crown_diameter) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (t_uuid, scan_date, h, dbh, biomass, crown))

        processed_results.append({
            "Tree_ID": custom_id,
            "Species": s_name,
            "Height": h,
            "DBH": dbh,
            "Crown": crown,
            "Biomass": biomass,
            "Match_Confidence": confidence
        })

    conn.commit()
    conn.close()

    print(f"[Module 3] Matched: {matched_count}, New: {new_count}")

    return processed_results