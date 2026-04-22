import laspy
import numpy as np
import pandas as pd
from pathlib import Path
from skimage.feature import peak_local_max
from skimage.segmentation import watershed
from scipy import ndimage
from datetime import datetime
import os
from config import CONFIG

# --- SETTINGS (keep for now, Phase 2 will move to config) ---
# GRID_SIZE = 0.1
# MIN_TREE_HEIGHT = 2.0
# MIN_DISTANCE_PIXELS = 7
# SMOOTHING_SIGMA = 1.1


def process_uls_data(laz_path, plot_number, survey_date, output_dir, save_csv=True):

    input_path = Path(laz_path)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = output_path / f"M1_Extracted_{plot_number}_{timestamp}.csv"

    print(f"[Module 1] Loading {input_path.name}...")

    # --- Validation ---
    if not input_path.exists():
        raise FileNotFoundError(f"{input_path} not found")

    if not str(input_path).endswith((".laz", ".las")):
        raise ValueError("Invalid file format. Expected .laz or .las")

    las = laspy.read(str(input_path))

    lx = np.asarray(las.x)
    ly = np.asarray(las.y)
    lz = np.asarray(las.z)

    if len(lx) == 0:
        raise ValueError("Point cloud is empty")

    # --- 1. DTM ---
    print("[Module 1] Building Terrain Model...")

    x_min, x_max = lx.min(), lx.max()
    y_min, y_max = ly.min(), ly.max()

    res = 2.0

    cols = int((x_max - x_min) / res) + 1
    rows = int((y_max - y_min) / res) + 1

    x_idx = ((lx - x_min) / res).astype(int)
    y_idx = ((ly - y_min) / res).astype(int)

    df_grid = pd.DataFrame({'r': y_idx, 'c': x_idx, 'z': lz})
    dtm_grid = df_grid.groupby(['r', 'c'])['z'].min().reset_index()

    dtm = np.full((rows, cols), np.nan)
    dtm[dtm_grid['r'], dtm_grid['c']] = dtm_grid['z']

    global_min = np.nanmin(dtm)
    dtm[np.isnan(dtm)] = global_min

    # --- 2. CHM ---
    print("[Module 1] Segmenting Trees...")

    cp_r = ((ly - y_min) / CONFIG["grid_size"]).astype(int)
    cp_c = ((lx - x_min) / CONFIG["grid_size"]).astype(int)

    df_temp = pd.DataFrame({'r': cp_r, 'c': cp_c, 'z': lz})

    chm_max = df_temp.groupby(['r', 'c'])['z'].max().reset_index()

    chm = np.zeros((cp_r.max() + 1, cp_c.max() + 1))
    chm[chm_max['r'], chm_max['c']] = chm_max['z']

    chm_norm = chm - global_min
    chm_norm[chm_norm < 0] = 0

    chm_smooth = ndimage.gaussian_filter(chm_norm, sigma=CONFIG["smoothing_sigma"])
    # --- 3. Tree Detection ---
    local_maxi = peak_local_max(
        chm_smooth,
        min_distance=CONFIG["min_distance_pixels"],
        threshold_abs=CONFIG["min_tree_height"]
    )

    markers = np.zeros_like(chm_smooth, dtype=int)
    for i, (r, c) in enumerate(local_maxi):
        markers[r, c] = i + 1

    labels = watershed(-chm_smooth, markers, mask=chm_smooth > CONFIG["min_tree_height"])

    # --- 4. Tree Extraction ---
    point_labels = labels[cp_r, cp_c]
    inventory = []

    unique_ids = np.unique(point_labels)

    print("[Module 1] Extracting trees...")

    for tree_id in unique_ids:

        if tree_id == 0:
            continue

        mask = point_labels == tree_id

        if np.count_nonzero(mask) < 50:
            continue

        sub_las = laspy.LasData(las.header)
        sub_las.points = las.points[mask]

        tree_x = np.mean(sub_las.x)
        tree_y = np.mean(sub_las.y)

        r = int((tree_y - y_min) / res)
        c = int((tree_x - x_min) / res)

        r = max(0, min(r, dtm.shape[0] - 1))
        c = max(0, min(c, dtm.shape[1] - 1))

        local_ground = dtm[r, c]

        h = np.max(sub_las.z) - local_ground

        dx = np.max(sub_las.x) - np.min(sub_las.x)
        dy = np.max(sub_las.y) - np.min(sub_las.y)

        crown_diam = (dx + dy) / 2

        fname = f"{plot_number}_Tree_{tree_id}.laz"
        sub_las.write(str(output_path / fname))

        inventory.append({
        "tree_id": tree_id,
        "easting": round(tree_x, 3),
        "northing": round(tree_y, 3),
        "height": round(h, 2),
        "crown_diameter": round(crown_diam, 2),
        "plot_number": plot_number,
        "scan_date": survey_date
    })

    df_result = pd.DataFrame(inventory)

    # --- Handle empty case ---
    if df_result.empty:
        print("[Module 1] Warning: No trees detected")

    # --- Save CSV (optional for frontend compatibility) ---
    if save_csv:
        if csv_path.exists():
            csv_path.unlink()
        df_result.to_csv(csv_path, index=False)
        print(f"[Module 1] CSV saved → {csv_path}")

    print(f"[Module 1] {len(df_result)} trees extracted.")

    # --- RETURN DATAFRAME (MAIN OUTPUT) ---
    return df_result