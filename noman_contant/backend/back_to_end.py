import pandas as pd
import numpy as np
import math
from pyproj import Transformer
from sklearn.neighbors import BallTree

# =========================
# CONFIG
# =========================

BACKEND_FILE = r"D:\FYP\forest-insight-dashboard\backend\Final_Output\M3_Results_BR01_20260420_172650.csv"
MAIN_FILE = r"D:\FYP\forest-insight-dashboard\frontend\src\Final_Presentation.csv"
OUTPUT_FILE = "final_merged.csv"

DISTANCE_THRESHOLD = 1.0  # meters

# Coordinate transformer (UTM Zone 32N → WGS84)
transformer = Transformer.from_crs("EPSG:32632", "EPSG:4326", always_xy=True)

# =========================
# HELPER FUNCTIONS
# =========================

def utm_to_latlon(easting, northing):
    lon, lat = transformer.transform(easting, northing)
    return lat, lon


def crown_areas(diameter):
    if pd.isna(diameter):
        return None, None
    r = diameter / 2
    convex = math.pi * r**2
    concave = convex * 0.87
    return round(convex, 3), round(concave, 3)


def generate_new_id(main_df, species_prefix, plot):
    existing = main_df[
        main_df["Tree_ID"].str.startswith(f"{species_prefix}_{plot}")
    ]

    numbers = []

    for tid in existing["Tree_ID"]:
        try:
            parts = tid.split("_")
            numbers.append(int(parts[-1]))
        except:
            pass

    next_num = max(numbers) + 1 if numbers else 1

    return f"{species_prefix}_{plot}_{next_num}"


def spatial_match(new_df, main_df, threshold=1.0):
    if main_df.empty or new_df.empty:
        return new_df

    main_coords = np.radians(main_df[["Latitude", "Longitude"]].values)
    new_coords = np.radians(new_df[["Latitude", "Longitude"]].values)

    tree = BallTree(main_coords, metric="haversine")

    dist, ind = tree.query(new_coords, k=1)

    earth_radius = 6371000
    distances_m = dist.flatten() * earth_radius
    indices = ind.flatten()

    updated_ids = []

    for i, d in enumerate(distances_m):
        if d <= threshold:
            updated_ids.append(main_df.iloc[indices[i]]["Tree_ID"])
        else:
            updated_ids.append(new_df.iloc[i]["Tree_ID"])

    new_df = new_df.copy()
    new_df["Tree_ID"] = updated_ids
    return new_df


def process_with_identity(new_df, main_df, threshold=1.0):

    main_coords = np.radians(main_df[["Latitude", "Longitude"]].values)
    tree = BallTree(main_coords, metric='haversine')

    new_coords = np.radians(new_df[["Latitude", "Longitude"]].values)

    dist, ind = tree.query(new_coords, k=1)

    earth_radius = 6371000
    distances = dist.flatten() * earth_radius
    indices = ind.flatten()

    final_rows = []

    for i in range(len(new_df)):

        row = new_df.iloc[i].copy()
        d = distances[i]

        if d <= threshold:

            matched = main_df.iloc[indices[i]]
            tree_id = matched["Tree_ID"]

            exists = main_df[
                (main_df["Tree_ID"] == tree_id) &
                (main_df["Month"] == row["Month"]) &
                (main_df["Year"] == row["Year"])
            ]

            if len(exists) > 0:
                continue  # discard duplicate time entry

            row["Tree_ID"] = tree_id
            final_rows.append(row)

        else:

            species_prefix = row["Species"].split()[0][:3].capitalize()

            # safer plot extraction
            parts = row["Tree_ID"].split("_")
            plot = parts[1] if len(parts) > 1 else "XX"

            new_id = generate_new_id(main_df, species_prefix, plot)

            row["Tree_ID"] = new_id
            final_rows.append(row)

    return pd.DataFrame(final_rows)


# =========================
# LOAD DATA
# =========================

backend_df = pd.read_csv(BACKEND_FILE)
main_df = pd.read_csv(MAIN_FILE)

backend_df.columns = backend_df.columns.str.strip()
main_df.columns = main_df.columns.str.strip()

# =========================
# CLEAN BACKEND
# =========================

backend_df = backend_df.drop_duplicates(subset=["Tree_ID", "Scan_Date"])

# coordinates
backend_df[["Latitude", "Longitude"]] = backend_df.apply(
    lambda row: pd.Series(utm_to_latlon(row["Easting"], row["Northing"])),
    axis=1
)

# date
backend_df["Scan_Date"] = pd.to_datetime(
    backend_df["Scan_Date"],
    dayfirst=True,
    errors="coerce"
)

backend_df["Month"] = backend_df["Scan_Date"].dt.strftime("%b")
backend_df["Year"] = backend_df["Scan_Date"].dt.year

# rename
backend_df = backend_df.rename(columns={
    "DBH": "Predicted_DBH",
    "Crown": "CrownDiameter",
    "Biomass": "Biomass_kg"
})

# crown features
backend_df[["CrownAreaConvex", "CrownAreaConcave"]] = backend_df["CrownDiameter"].apply(
    lambda x: pd.Series(crown_areas(x))
)

backend_df["CrownBaseHeight"] = 2.0

# final format
new_df = backend_df[
    [
        "Tree_ID",
        "Species",
        "Latitude",
        "Longitude",
        "Month",
        "Year",
        "Height",
        "CrownDiameter",
        "CrownAreaConvex",
        "CrownAreaConcave",
        "CrownBaseHeight",
        "Predicted_DBH",
        "Biomass_kg"
    ]
].copy()

# =========================
# SPATIAL + ID LOGIC
# =========================

processed_df = process_with_identity(new_df, main_df, DISTANCE_THRESHOLD)

# =========================
# MERGE
# =========================

merged_df = pd.concat([main_df, processed_df], ignore_index=True)

merged_df.drop_duplicates(
    subset=["Tree_ID", "Month", "Year"],
    keep="last",
    inplace=True
)

merged_df.reset_index(drop=True, inplace=True)
# merged_df.insert(0, "Unnamed: 0", merged_df.index)


# =========================
# MONTH ORDER FIX
# =========================

month_order = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
    "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
    "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
}

merged_df["Month_Num"] = merged_df["Month"].map(month_order)

# =========================
# SMART SORTING (IMPORTANT PART)
# =========================

merged_df = merged_df.sort_values(
    by=[
        "Tree_ID",
        "Latitude",
        "Longitude",
        "Year",
        "Month_Num"
    ],
    ascending=True
)

# drop helper column
merged_df.drop(columns=["Month_Num"], inplace=True)

# reset index
merged_df.reset_index(drop=True, inplace=True)



# =========================
# SAVE
# =========================

merged_df.to_csv(OUTPUT_FILE, index=False)

