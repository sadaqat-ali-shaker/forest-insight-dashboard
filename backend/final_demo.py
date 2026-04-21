import sys
import module_1_extraction
import module_2_dbh
import module_3_biomass

def main():
    print("=========================================")
    print("   🌳 AUTOMATED FOREST INVENTORY SYSTEM   ")
    print("       (ULS -> AI -> Biomass)            ")
    print("=========================================")
    
    # 1. User Inputs
    print("\n--- STEP 1: CONFIGURATION ---")
    laz_file = "demo.laz" # Aap isay dynamic bhi bana sakte hain
    plot_num = input("Enter Plot Number (e.g., BR01): ").strip()
    date_in  = input("Enter Survey Date (YYYY-MM-DD): ").strip()
    
    if not plot_num: plot_num = "BR04"
    if not date_in: date_in = "2023-12-10"
    
    try:
        # 2. Call Module 1 (Extraction)
        print("\n--- STEP 2: MODULE 1 (EXTRACTION) ---")
        # Ab ye DataFrame return karega
        df_m1 = module_1_extraction.process_uls_data(
            laz_file, plot_num, date_in, output_dir="Final_Output"
        )
        
        # 3. Call Module 2 (DBH Prediction)
        print("\n--- STEP 3: MODULE 2 (DBH PREDICTION) ---")
        # DataFrame pass ho raha hai
        df_m2 = module_2_dbh.predict_dbh(df_m1)
        
        # 4. Call Module 3 (Biomass & SQL)
        print("\n--- STEP 4: MODULE 3 (INTEGRATION & DATABASE) ---")
        # Isay hum next step mein update karenge
        display_data = module_3_biomass.integrate_with_database(df_m2, plot_num)

        print("\n=========================================")
        print("✅ Pipeline Completed Successfully!")
        print("=========================================")

    except Exception as e:
        print(f"\n[CRITICAL ERROR] Pipeline failed: {e}")

if __name__ == "__main__":
    main()