
import pandas as pd
import os
import shutil
import tempfile

def check_frota_empty_plates():
    original_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    shutil.copy2(original_path, temp_path)
    
    try:
        df = pd.read_excel(temp_path, sheet_name='FROTA', header=1, usecols=['PLACA', 'DT SOLICITAÇÃO'])
        total = len(df)
        empty = df['PLACA'].isna().sum()
        hyphen = (df['PLACA'].astype(str).str.strip() == '-').sum()
        
        print(f"Total registros em FROTA: {total}")
        print(f"Placas vazias (NaN): {empty}")
        print(f"Placas com '-': {hyphen}")
        
        # Check by year
        df['DATA'] = pd.to_datetime(df['DT SOLICITAÇÃO'], errors='coerce')
        df['ANO'] = df['DATA'].dt.year
        print("\n--- Placas vazias ou '-' por Ano ---")
        mask = df['PLACA'].isna() | (df['PLACA'].astype(str).str.strip() == '-')
        print(df[mask]['ANO'].value_counts(dropna=False))

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    check_frota_empty_plates()
