
import pandas as pd
import os

def check_frota_bd_sectors():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    try:
        df = pd.read_excel(file_path, sheet_name='Frota BD', header=0)
        print("--- Frota BD Sectors Unique Values ---")
        print(df['SETOR'].unique())

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_frota_bd_sectors()
