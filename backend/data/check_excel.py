
import pandas as pd
import os

def check_excel():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    if not os.path.exists(file_path):
        print("Arquivo não encontrado")
        return
        
    try:
        xl = pd.ExcelFile(file_path, engine='openpyxl')
        print(f"Abas: {xl.sheet_names}")
        
        if 'FROTA' in xl.sheet_names:
            df = pd.read_excel(xl, 'FROTA', nrows=5, header=1)
            print("\n--- Colunas em FROTA ---")
            print(df.columns.tolist())
            print("\n--- Primeiras linhas FROTA ---")
            print(df.head())
            
        if 'Frota BD' in xl.sheet_names:
            df = pd.read_excel(xl, 'Frota BD', nrows=5)
            print("\n--- Colunas em Frota BD ---")
            print(df.columns.tolist())
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_excel()
