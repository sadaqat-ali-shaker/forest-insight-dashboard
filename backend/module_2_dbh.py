import pandas as pd
import joblib
from pathlib import Path

MODEL_PATH="dbh_geometry_model.joblib"

def predict_dbh(input_csv):

    df=pd.read_csv(input_csv)

    if Path(MODEL_PATH).exists():

        print("[Module 2] Loading ML model")

        model=joblib.load(MODEL_PATH)

        features=pd.DataFrame()

        features["Height [m]"]=df["Tree_Height"]
        features["Crown diameter [m]"]=df["Crown_Diameter"]

        df["Predicted_DBH"]=model.predict(features)

    else:

        print("[Module 2] Using fallback formula")

        df["Predicted_DBH"]=(
            df["Tree_Height"]*0.8+
            df["Crown_Diameter"]*2
        )

    out_path=Path(input_csv).parent / f"M2_With_DBH_{Path(input_csv).name}"

    df.to_csv(out_path,index=False)

    return out_path