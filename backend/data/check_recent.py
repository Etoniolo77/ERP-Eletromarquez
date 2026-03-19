
import sqlite3
import datetime

def check_recent():
    try:
        conn = sqlite3.connect('portal.db')
        cursor = conn.cursor()
        
        # Get max date
        cursor.execute("SELECT MAX(data_solicitacao) FROM frota_custos")
        max_date = cursor.fetchone()[0]
        print(f"Max date: {max_date}")
        
        if max_date:
            # Last month of data
            m_year = max_date[:4]
            m_month = max_date[5:7]
            pattern = f"{m_year}-{m_month}-%"
            
            print(f"--- Contagem por Setor em {m_year}-{m_month} ---")
            cursor.execute("SELECT setor, COUNT(*) FROM frota_custos WHERE data_solicitacao LIKE ? GROUP BY setor", (pattern,))
            results = cursor.fetchall()
            for row in results:
                print(f"Setor: {row[0]} | Count: {row[1]}")
                
            print(f"\n--- Contagem por Regional em {m_year}-{m_month} ---")
            cursor.execute("SELECT regional, COUNT(*) FROM frota_custos WHERE data_solicitacao LIKE ? GROUP BY regional", (pattern,))
            results = cursor.fetchall()
            for row in results:
                print(f"Regional: {row[0]} | Count: {row[1]}")
                
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_recent()
