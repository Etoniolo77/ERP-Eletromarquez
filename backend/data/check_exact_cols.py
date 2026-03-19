
import pandas as pd
import os

def check_exact_columns():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    try:
        df = pd.read_excel(file_path, sheet_name='Frota BD', header=0, nrows=0)
        print("--- Colunas exatas em Frota BD ---")
        for c in df.columns:
            print(f"'{c}' | len: {len(c)}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_exact_columns()
