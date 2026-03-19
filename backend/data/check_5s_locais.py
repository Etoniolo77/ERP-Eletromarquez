
import sqlite3

def check_5s_locais():
    try:
        conn = sqlite3.connect('portal.db')
        cursor = conn.cursor()
        
        print("--- Locais Auditados 5S (Amostra) ---")
        cursor.execute("SELECT DISTINCT local_auditado FROM auditorias_5s ORDER BY local_auditado LIMIT 50")
        results = cursor.fetchall()
        for row in results:
            print(f"Local: {row[0]}")
            
        print("\n--- Buscando 440 e 441 ---")
        cursor.execute("SELECT DISTINCT local_auditado FROM auditorias_5s WHERE local_auditado LIKE '%440%' OR local_auditado LIKE '%441%'")
        results = cursor.fetchall()
        for row in results:
            print(f"Match: {row[0]}")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_5s_locais()
