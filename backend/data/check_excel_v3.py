
import pandas as pd
import os

def check_excel():
    file_path = r'C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx'
    
    with open('excel_report.txt', 'w', encoding='utf-8') as f:
        try:
            xl = pd.ExcelFile(file_path, engine='openpyxl')
            f.write(f"Abas encontradas: {xl.sheet_names}\n")
            
            for sheet in xl.sheet_names:
                f.write(f"\n--- Aba: {sheet} ---\n")
                try:
                    df = pd.read_excel(xl, sheet, nrows=1, header=None)
                    f.write(f"Linha 0: {df.values[0].tolist()}\n")
                    
                    df1 = pd.read_excel(xl, sheet, nrows=1, header=1)
                    f.write(f"Colunas (header=1): {df1.columns.tolist()}\n")
                except:
                    f.write("Erro ao ler aba\n")

        except Exception as e:
            f.write(f"Error: {e}\n")

if __name__ == "__main__":
    check_excel()
