
import sqlite3

def check_distribution():
    try:
        conn = sqlite3.connect('portal.db')
        cursor = conn.cursor()
        
        sectors = ['ADM', 'CCM', 'STC']
        for s in sectors:
            print(f"\n--- Setor: {s} ---")
            cursor.execute("SELECT regional, COUNT(*) FROM frota_custos WHERE setor = ? GROUP BY regional", (s,))
            for row in cursor.fetchall():
                print(f"Regional: {row[0]} | Count: {row[1]}")
                
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_distribution()
