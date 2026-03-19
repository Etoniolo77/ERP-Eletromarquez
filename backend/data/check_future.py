
import sqlite3
import datetime

def check_future():
    try:
        conn = sqlite3.connect('portal.db')
        cursor = conn.cursor()
        today = datetime.date.today().isoformat()
        
        print(f"Hoje: {today}")
        cursor.execute("SELECT COUNT(*) FROM frota_custos WHERE data_solicitacao > ?", (today,))
        count = cursor.fetchone()[0]
        print(f"Registros futuros: {count}")
        
        if count > 0:
            cursor.execute("SELECT data_solicitacao, COUNT(*) FROM frota_custos WHERE data_solicitacao > ? GROUP BY data_solicitacao", (today,))
            for row in cursor.fetchall():
                print(f"Data: {row[0]} | Count: {row[1]}")
                
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_future()
