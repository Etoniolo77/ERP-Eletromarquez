
import pandas as pd
import os

def check_excel():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    try:
        xl = pd.ExcelFile(file_path, engine='openpyxl')
        print(f"Abas encontradas: {xl.sheet_names}")
        
        for sheet in xl.sheet_names:
            if 'FROTA' in sheet.upper():
                df = pd.read_excel(xl, sheet, nrows=0, header=1)
                print(f"\n--- Colunas na aba '{sheet}' (header=1) ---")
                print(df.columns.tolist())
                
                df0 = pd.read_excel(xl, sheet, nrows=0, header=0)
                print(f"\n--- Colunas na aba '{sheet}' (header=0) ---")
                print(df0.columns.tolist())

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_excel()
