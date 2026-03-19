
import pandas as pd
import os
import shutil
import tempfile

def check_overlap():
    original_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    # Copy to temp
    fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    shutil.copy2(original_path, temp_path)
    
    try:
        print("Lendo abas...")
        # Lendo apenas colunas necessárias para ser mais rápido
        df_custos = pd.read_excel(temp_path, sheet_name='FROTA', header=1, usecols=['PLACA'])
        df_bd = pd.read_excel(temp_path, sheet_name='Frota BD', header=0, usecols=['PLACA'])
        
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
            sample = [p for p in list(missing) if p not in ['NAN', 'NONE', '-', '', '0']][:20]
            print(sample)

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    check_overlap()
