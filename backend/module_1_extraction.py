import laspy
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import ndimage
from skimage.feature import peak_local_max
from skimage.segmentation import watershed

# PARAMETERS
GRID_SIZE = 0.2
MIN_TREE_HEIGHT = 2.0
MIN_DISTANCE_PIXELS = 6
SMOOTHING_SIGMA = 1.2


def process_uls_data(laz_path, plot_number, survey_date, output_dir):

    input_path = Path(laz_path)
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    print(f"[Module 1] Loading {input_path}")

    las = laspy.read(input_path)

    xyz = np.vstack((np.array(las.x),
                     np.array(las.y),
                     np.array(las.z))).T

    x_min, x_max = xyz[:,0].min(), xyz[:,0].max()
    y_min, y_max = xyz[:,1].min(), xyz[:,1].max()

    # ---------- CHM ----------
    print("[Module 1] Building CHM")

    cols = int((x_max-x_min)/GRID_SIZE)+1
    rows = int((y_max-y_min)/GRID_SIZE)+1

    x_idx = ((xyz[:,0]-x_min)/GRID_SIZE).astype(int)
    y_idx = ((xyz[:,1]-y_min)/GRID_SIZE).astype(int)

    chm = np.zeros((rows,cols))

    df = pd.DataFrame({
        "r":y_idx,
        "c":x_idx,
        "z":xyz[:,2]
    })

    grid_max = df.groupby(["r","c"])["z"].max().reset_index()

    chm[grid_max["r"],grid_max["c"]] = grid_max["z"]

    # ---------- SMOOTH ----------
    chm_smooth = ndimage.gaussian_filter(chm,sigma=SMOOTHING_SIGMA)

    # ---------- TREE TOP DETECTION ----------
    local_max = peak_local_max(
        chm_smooth,
        min_distance=MIN_DISTANCE_PIXELS,
        threshold_abs=MIN_TREE_HEIGHT
    )

    markers = np.zeros_like(chm_smooth,dtype=int)

    for i,(r,c) in enumerate(local_max):
        markers[r,c] = i+1

    # ---------- WATERSHED SEGMENTATION ----------
    labels = watershed(-chm_smooth,markers,mask=chm_smooth>MIN_TREE_HEIGHT)

    print(f"[Module 1] Segmented Trees: {len(local_max)}")

    # ---------- MAP LABELS BACK TO POINTS ----------
    point_labels = labels[y_idx,x_idx]

    inventory=[]

    for tree_id in np.unique(point_labels):

        if tree_id==0:
            continue

        mask = point_labels==tree_id

        if np.count_nonzero(mask)<50:
            continue

        sub_las = laspy.LasData(las.header)
        sub_las.points = las.points[mask]

        tree_file = output_path / f"{plot_number}_Tree_{tree_id}.laz"
        sub_las.write(tree_file)

        height = np.max(las.z[mask]) - np.min(las.z)

        dx = np.max(las.x[mask]) - np.min(las.x[mask])
        dy = np.max(las.y[mask]) - np.min(las.y[mask])

        crown = (dx+dy)/2

        inventory.append({

            "Temp_ID":tree_id,
            "Easting":np.mean(las.x[mask]),
            "Northing":np.mean(las.y[mask]),
            "Tree_Height":height,
            "Crown_Diameter":crown,
            "Plot_Number":plot_number,
            "Date":survey_date

        })

    df_inventory = pd.DataFrame(inventory)

    csv_path = output_path / f"M1_Extracted_{plot_number}.csv"

    df_inventory.to_csv(csv_path,index=False)

    print(f"[Module 1] Saved inventory: {csv_path}")

    return csv_path