
import pandas as pd
import os

def check_frota_bd():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    try:
        df = pd.read_excel(file_path, sheet_name='Frota BD', header=0, nrows=10)
        print("--- Frota BD head ---")
        print(df[['PLACA', 'FROTA', 'SETOR', 'REGIONAL']].to_string())
        
        # Check for empty plates
        print(f"\nTotal rows in sample: {len(df)}")
        print(f"Empty plates: {df['PLACA'].isna().sum()}")
        print(f"Hyphen plates: {(df['PLACA'] == '-').sum()}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_frota_bd()
