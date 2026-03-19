
import pandas as pd
import os

def check_frota_content():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    try:
        df = pd.read_excel(file_path, sheet_name='FROTA', header=1, nrows=20)
        df.columns = [str(c).strip().upper() for c in df.columns]
        
        # Columns of interest
        cols = ['PLACA', 'FROTA', 'REGIONAL', 'BASE NO DIA', 'CENTRO DE CUSTO']
        available = [c for c in cols if c in df.columns]
        
        print(f"Colunas disponíveis: {available}")
        print("\n--- Amostra de dados ---")
        print(df[available].to_string())
        
        # Check if there is any hidden sector column
        all_cols = df.columns.tolist()
        sector_like = [c for c in all_cols if 'SETOR' in c or 'UNIDADE' in c]
        print(f"\nColunas tipo 'setor': {sector_like}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_frota_content()
