
import pandas as pd
import os

def check_overlap():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    try:
        df_custos = pd.read_excel(file_path, sheet_name='FROTA', header=1)
        df_bd = pd.read_excel(file_path, sheet_name='Frota BD', header=0)
        
        df_custos['PLACA_KEY'] = df_custos['PLACA'].astype(str).str.strip().str.upper()
        df_bd['PLACA_KEY'] = df_bd['PLACA'].astype(str).str.strip().str.upper()
        
        plates_custos = set(df_custos['PLACA_KEY'].unique())
        plates_bd = set(df_bd['PLACA_KEY'].unique())
        
        intersection = plates_custos.intersection(plates_bd)
        missing = plates_custos - plates_bd
        
        print(f"Placas em Custos: {len(plates_custos)}")
        print(f"Placas em BD: {len(plates_bd)}")
        print(f"Interseção (Encontradas): {len(intersection)}")
        print(f"Não encontradas: {len(missing)}")
        
        if len(missing) > 0:
            print("\n--- Amostra de Placas Não Encontradas ---")
            print(list(missing)[:20])

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_overlap()
