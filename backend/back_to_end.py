import pandas as pd
import numpy as np
import math
from pyproj import Transformer
from sklearn.neighbors import BallTree

transformer = Transformer.from_crs("EPSG:32632", "EPSG:4326", always_xy=True)

DISTANCE_THRESHOLD = 1.0


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
            numbers.append(int(tid.split("_")[-1]))
        except:
            pass

    next_num = max(numbers) + 1 if numbers else 1
    return f"{species_prefix}{plot}{next_num}"


def process_with_identity(new_df, main_df, threshold=1.0):

    if main_df.empty or new_df.empty:
        return new_df

    main_coords = np.radians(main_df[["Latitude", "Longitude"]].values)
    new_coords = np.radians(new_df[["Latitude", "Longitude"]].values)

    tree = BallTree(main_coords, metric='haversine')
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
                continue

            row["Tree_ID"] = tree_id
        else:
            species_prefix = row["Species"].split()[0][:3].capitalize()
            plot = row["Tree_ID"].split("_")[1]
            row["Tree_ID"] = generate_new_id(main_df, species_prefix, plot)

        final_rows.append(row)

    return pd.DataFrame(final_rows)


# 🔥 MAIN FUNCTION FOR API
def run_back_to_end(m3_file_path, main_file_path, output_path):

    backend_df = pd.read_csv(m3_file_path)
    main_df = pd.read_csv(main_file_path)

    backend_df.columns = backend_df.columns.str.strip()
    main_df.columns = main_df.columns.str.strip()

    backend_df = backend_df.drop_duplicates(subset=["Tree_ID", "Scan_Date"])

    backend_df[["Latitude", "Longitude"]] = backend_df.apply(
        lambda row: pd.Series(utm_to_latlon(row["Easting"], row["Northing"])),
        axis=1
    )

    backend_df["Scan_Date"] = pd.to_datetime(
        backend_df["Scan_Date"], dayfirst=True, errors="coerce"
    )

    backend_df["Month"] = backend_df["Scan_Date"].dt.strftime("%b")
    backend_df["Year"] = backend_df["Scan_Date"].dt.year

    backend_df = backend_df.rename(columns={
        "DBH": "Predicted_DBH",
        "Crown": "CrownDiameter",
        "Biomass": "Biomass_kg"
    })

    backend_df[["CrownAreaConvex", "CrownAreaConcave"]] = backend_df["CrownDiameter"].apply(
        lambda x: pd.Series(crown_areas(x))
    )

    backend_df["CrownBaseHeight"] = 2.0

    new_df = backend_df[
        [
            "Tree_ID", "Species", "Latitude", "Longitude",
            "Month", "Year", "Height", "CrownDiameter",
            "CrownAreaConvex", "CrownAreaConcave",
            "CrownBaseHeight", "Predicted_DBH", "Biomass_kg"
        ]
    ].copy()

    processed_df = process_with_identity(new_df, main_df, DISTANCE_THRESHOLD)

    merged_df = pd.concat([main_df, processed_df], ignore_index=True)

    merged_df.drop_duplicates(
        subset=["Tree_ID", "Month", "Year"],
        keep="last",
        inplace=True
    )

    merged_df.to_csv(output_path, index=False)

    return output_path