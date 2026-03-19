
import sqlite3

def check_period(year, month):
    try:
        conn = sqlite3.connect('portal.db')
        cursor = conn.cursor()
        pattern = f"{year}-{month:02d}-%"
        
        print(f"--- Datos de {year}-{month:02d} ---")
        cursor.execute("SELECT setor, COUNT(*) FROM frota_custos WHERE data_solicitacao LIKE ? GROUP BY setor", (pattern,))
        for row in cursor.fetchall():
            print(f"Setor: {row[0]} | Count: {row[1]}")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_period(2025, 12)
    check_period(2026, 1)
    check_period(2026, 2)
