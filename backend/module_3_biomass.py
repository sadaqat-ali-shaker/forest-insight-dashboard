import pandas as pd
import numpy as np
from scipy.spatial import cKDTree
from pathlib import Path

EXTERNAL_DB="species_density.csv"


def calculate_biomass_final(input_csv):

    df_ext=pd.read_csv(input_csv)

    df_ref=pd.read_csv(EXTERNAL_DB)

    # ref_coords = df_ref[['Easting [m]', 'Northing [m]']].values
    ref_coords=df_ref[['Easting [m]','Northing [m]']].values
    ext_coords=df_ext[['Easting','Northing']].values

    tree=cKDTree(ref_coords)

    dists,idxs=tree.query(ext_coords,k=1)

    MATCH_LIMIT=2.5

    results=[]

    for i,dist in enumerate(dists):

        row=df_ext.iloc[i]

        if dist<MATCH_LIMIT:

            ref=df_ref.iloc[idxs[i]]

            species=ref['Specie']
            wd = ref['Wood_Density']

        else:

            species="Unknown"
            wd=0.5

        dbh=row["Predicted_DBH"]
        h=row["Tree_Height"]

        agb=0.0673*((wd*(dbh**2)*h)**0.976)

        results.append({

            "Species":species,
            "Height":h,
            "DBH":dbh,
            "Biomass":agb,
            "Easting":row["Easting"],
            "Northing":row["Northing"]

        })

    df_final=pd.DataFrame(results)

    final_path=Path(input_csv).parent/"FINAL_INVENTORY_REPORT.csv"

    df_final.to_csv(final_path,index=False)

    print("[Module 3] Final inventory saved")

    return final_path