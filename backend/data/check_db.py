
import sqlite3

def check_db():
    try:
        conn = sqlite3.connect('portal.db')
        cursor = conn.cursor()
        
        print("--- Contagem por Setor ---")
        cursor.execute("SELECT setor, COUNT(*) FROM frota_custos GROUP BY setor")
        results = cursor.fetchall()
        for row in results:
            print(f"Setor: {row[0]} | Count: {row[1]}")
            
        print("\n--- Contagem por Regional ---")
        cursor.execute("SELECT regional, COUNT(*) FROM frota_custos GROUP BY regional")
        results = cursor.fetchall()
        for row in results:
            print(f"Regional: {row[0]} | Count: {row[1]}")

        print("\n--- Amostra de Placas com N/D ---")
        cursor.execute("SELECT placa, regional, setor FROM frota_custos WHERE regional = 'N/D' OR setor = 'N/D' LIMIT 10")
        results = cursor.fetchall()
        for row in results:
            print(f"Placa: {row[0]} | Regional: {row[1]} | Setor: {row[2]}")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
