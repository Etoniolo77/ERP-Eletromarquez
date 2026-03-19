
import pandas as pd
import os

def check_frota_bd_stats():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    try:
        df = pd.read_excel(file_path, sheet_name='Frota BD', header=0)
        print(f"Total rows: {len(df)}")
        print(f"Empty sectors: {df['SETOR'].isna().sum()}")
        print(f"Empty regionals: {df['REGIONAL'].isna().sum()}")
        print(f"Sectors distribution:\n{df['SETOR'].value_counts(dropna=False)}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_frota_bd_stats()
