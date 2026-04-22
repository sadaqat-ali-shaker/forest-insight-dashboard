import pandas as pd
import joblib
from pathlib import Path


MODEL_PATH = Path(__file__).parent / "trained_models" / "dbh_geometry_model.joblib"

def predict_dbh(df_input): 
    """
    Module 1 ke DataFrame ko leta hai, AI model apply karta hai, 
    aur DBH column ke saath updated DataFrame wapas bhejta hai.
    """

    print(f"\n[Module 2] DBH Prediction shuru ho rahi hai {len(df_input)} trees ke liye...")

    if df_input is None or df_input.empty:
        raise ValueError("Input DataFrame is empty or None")

    df = df_input.copy()

    # --- Step 1: Adapt to model expected column names ---
    df_model = df.rename(columns={
        "height": "Tree_Height",
        "crown_diameter": "Crown_Diameter"
    })

    # Validate required columns
    required_cols = ["Tree_Height", "Crown_Diameter"]
    for col in required_cols:
        if col not in df_model.columns:
            raise ValueError(f"Missing required column: {col}")

    # Remove invalid values
    df_model = df_model[(df_model["Tree_Height"] > 0) & (df_model["Crown_Diameter"] > 0)]

    if df_model.empty:
        raise ValueError("No valid data for DBH prediction")

    # --- Step 2: Model or fallback ---
    if not Path(MODEL_PATH).exists():
        print(f"[WARNING] Model file '{MODEL_PATH}' nahi mili!")
        print("[Module 2] Dummy Formula use kiya ja raha hai (Demo Mode)...")

        df.loc[df_model.index, 'dbh'] = round(
            (df_model['Tree_Height'] * 0.8) + (df_model['Crown_Diameter'] * 2.0), 3
        )
    else:
        print(f"[Module 2] Loading AI Model: {MODEL_PATH}")
        model = joblib.load(MODEL_PATH)

        # Model features
        features_for_model = pd.DataFrame()
        features_for_model['Height [m]'] = df_model['Tree_Height']
        features_for_model['Crown diameter [m]'] = df_model['Crown_Diameter']

        print("[Module 2] Predicting DBH values...")
        predictions = model.predict(features_for_model)

        df.loc[df_model.index, 'dbh'] = [round(p, 3) for p in predictions]

    print(f"[Module 2] DBH Prediction Mukammal. (Sample: {df['dbh'].iloc[0]} cm)")

    return df