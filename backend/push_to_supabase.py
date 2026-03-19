import sqlite3
import os
import math
import requests
from dotenv import load_dotenv

load_dotenv()

# Usa credenciais localizadas no ambiente
SUPABASE_URL = "https://sesspgrbxkfighymxxio.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc3NwZ3JieGtmaWdoeW14eGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODgzMTQsImV4cCI6MjA4Nzc2NDMxNH0.BZAJyBLbhjYC8cFDee-a9aiWPvbjGE5W-_jhoXMfEiY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "portal.db")

def push_table(table_name, chunk_size=500):
    print(f"\\n[PUSH] Sincronizando tabela: {table_name}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Auto-descobrimento de colunas
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns_info = cursor.fetchall()
    columns = [col["name"] for col in columns_info if col["name"] != "id"]
    
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    
    if not rows:
        print(f"[PUSH] Tabela vazia localmente.")
        conn.close()
        return

    payloads = []
    for row in rows:
        item = {}
        for col in columns:
            val = row[col]
            if isinstance(val, bytes):
                val = val.decode()
            item[col] = val
        payloads.append(item)
    
    conn.close()
    
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    
    # 1. Limpar tabela destino na nuvem via REST (DELETE com match na ID <> -1)
    try:
         print(f"[PUSH] Limpando tabela {table_name} remota...")
         requests.delete(f"{url}?id=neq.-1", headers=HEADERS)
    except Exception as e:
         print(f"Erro ao limpar: {e}")

    # 2. Inserir em chunks
    total_records = len(payloads)
    total_chunks = math.ceil(total_records / chunk_size)
    print(f"[PUSH] Subindo {total_records} registros em {total_chunks} lotes de {chunk_size}...")

    inserted = 0
    for i in range(0, total_records, chunk_size):
        chunk = payloads[i:i+chunk_size]
        try:
             res = requests.post(url, json=chunk, headers=HEADERS)
             if res.status_code in [200, 201]:
                 inserted += len(chunk)
                 print(f"   -> Lote {i//chunk_size + 1}/{total_chunks} enviado.")
             else:
                 print(f"[PUSH ERROR] Falha no lote {i//chunk_size + 1}. Codigo HTTP: {res.status_code} - {res.text}")
        except Exception as e:
             print(f"[PUSH ERROR] Falha no lote {i//chunk_size + 1}: {e}")
             
    print(f"[PUSH] {table_name} concluido. Inseridos: {inserted}/{total_records}")

def run_all_pushes():
    push_table("apr_records")
    push_table("saida_base_records")
    push_table("auditorias_5s")
    push_table("produtividade")

if __name__ == "__main__":
    print("=== INICIANDO PUSH REST NATIVO PARA SUPABASE CLOUD ===")
    run_all_pushes()
    print("=== PUSH FINALIZADO ===")
