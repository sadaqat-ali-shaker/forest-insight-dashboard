import sys
import module_1_extraction
import module_2_dbh
import module_3_biomass


def main():
    print("=========================================")
    print("   🌳 AUTOMATED FOREST INVENTORY SYSTEM   ")
    print("       (ULS -> AI -> Biomass)            ")
    print("=========================================")

    # --- STEP 1: INPUT ---
    print("\n--- STEP 1: CONFIGURATION ---")
    laz_file = "demo.laz"

    plot_num = input("Enter Plot Number (e.g., BR01): ").strip()
    date_in  = input("Enter Survey Date (YYYY-MM-DD): ").strip()

    if not plot_num:
        plot_num = "BR04"
    if not date_in:
        date_in = "2023-12-10"

    try:
        # --- STEP 2: MODULE 1 ---
        print("\n--- STEP 2: MODULE 1 (EXTRACTION) ---")
        df_m1 = module_1_extraction.process_uls_data(
            laz_file,
            plot_num,
            date_in,
            output_dir="Final_Output",
            save_csv=True  # keep for safety
        )

        print(f"[DEBUG] Module 1 Output Shape: {df_m1.shape}")
        print(df_m1.head())

        if df_m1.empty:
            raise ValueError("Module 1 returned empty DataFrame")

        # --- STEP 3: MODULE 2 ---
        print("\n--- STEP 3: MODULE 2 (DBH PREDICTION) ---")
        df_m2 = module_2_dbh.predict_dbh(df_m1)

        print(f"[DEBUG] Module 2 Output Shape: {df_m2.shape}")
        print(df_m2.head())

        if "dbh" not in df_m2.columns:
            raise ValueError("DBH column missing after Module 2")

        # --- STEP 4: MODULE 3 ---
        print("\n--- STEP 4: MODULE 3 (INTEGRATION & DATABASE) ---")
        display_data = module_3_biomass.integrate_with_database(df_m2, plot_num)

        print(f"[DEBUG] Module 3 Output Count: {len(display_data)}")

        if not display_data:
            print("[WARNING] No records inserted into database")

        else:
            print("\n--- SAMPLE OUTPUT ---")
            for item in display_data[:5]:
                print(item)

        print("\n=========================================")
        print("✅ Pipeline Completed Successfully!")
        print("=========================================")

    except Exception as e:
        print("\n=========================================")
        print(f"[CRITICAL ERROR] Pipeline failed: {e}")
        print("=========================================")


if __name__ == "__main__":
    main()