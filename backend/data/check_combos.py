
import sqlite3

def check_combinations():
    try:
        conn = sqlite3.connect('portal.db')
        cursor = conn.cursor()
        
        print("--- Setor x Regional (Contagem) ---")
        cursor.execute("SELECT setor, regional, COUNT(*) FROM frota_custos GROUP BY setor, regional")
        for row in cursor.fetchall():
            print(f"Setor: {row[0]} | Regional: {row[1]} | Count: {row[2]}")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_combinations()
