import sqlite3
import os
import math
import requests
from dotenv import load_dotenv
import time
import json

load_dotenv()

# Usa credenciais localizadas no ambiente
SUPABASE_URL = "https://sesspgrbxkfighymxxio.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc3NwZ3JieGtmaWdoeW14eGlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE4ODMxNCwiZXhwIjoyMDg3NzY0MzE0fQ.O9prUWK5rhhBOD9Fpfme7dymBpvCBx40M5vZAi5vQ7E"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Caminho do banco local
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "portal.db")

# Sessão persistente para ganho de velocidade (Keep-Alive)
session = requests.Session()
session.headers.update(HEADERS)

def clean_value(v):
    """Limpa valores invalidos (NaN, Infinity) para o JSON do Supabase."""
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return 0
    if v == "nan" or v == "NaN":
        return 0
    return v

def push_table(table_name, chunk_size=1000):
    print(f"\n[PUSH] Sincronizando tabela: {table_name}")
    if not os.path.exists(DB_PATH):
        print(f"[PUSH ERROR] Arquivo {DB_PATH} nao encontrado!")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Auto-descobrimento de colunas
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns_info = cursor.fetchall()
        columns = [col["name"] for col in columns_info if col["name"] != "id"]
        
        # Filtros de colunas especificos por seguranca
        if table_name == "produtividade":
            allowed = ["equipe", "tipo_equipe", "setor", "data", "csd", "ocupacao", "produtividade_pct", "eficiencia_pct", "eficacia_pct", "notas_executadas", "notas_interrompidas", "notas_rejeitadas", "ociosidade_min", "desvios_min", "deslocamento_min", "hhp_min", "saida_base_min", "retorno_base_min", "hora_extra_min"]
            columns = [c for c in columns if c in allowed]
        
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
    except Exception as e:
        print(f"[PUSH ERROR] Erro ao ler tabela {table_name}: {e}")
        conn.close()
        return
    
    if not rows:
        print(f"[PUSH] Tabela vazia localmente.")
        conn.close()
        return

    payloads = []
    for row in rows:
        item = {}
        for col in columns:
            try:
                val = clean_value(row[col])
                if isinstance(val, bytes):
                    val = val.decode()
                item[col] = val
            except:
                continue
        payloads.append(item)
    
    conn.close()
    
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    
    # 1. Limpar tabela destino na nuvem via REST
    try:
         print(f"[PUSH] Limpando tabela {table_name} remota...")
         # Tenta deletar usando IDs ou condicao generica
         session.delete(f"{url}?id=neq.-1")
    except Exception as e:
         print(f"Erro ao limpar: {e}")

    # 2. Inserir em chunks
    total_records = len(payloads)
    total_chunks = math.ceil(total_records / chunk_size)
    print(f"[PUSH] Subindo {total_records} registros em {total_chunks} lotes de {chunk_size}...")

    inserted = 0
    start_time = time.time()
    for i in range(0, total_records, chunk_size):
        chunk = payloads[i:i+chunk_size]
        try:
             res = session.post(url, json=chunk)
             if res.status_code in [200, 201]:
                 inserted += len(chunk)
                 print(f"   -> Lote {i//chunk_size + 1}/{total_chunks} enviado ({inserted}/{total_records}).")
             else:
                 print(f"[PUSH ERROR] Falha no lote {i//chunk_size + 1}. Status: {res.status_code} - {res.text}")
        except Exception as e:
             print(f"[PUSH ERROR] Falha de conexao no lote {i//chunk_size + 1}: {e}")
             
    duration = round(time.time() - start_time, 2)
    print(f"[PUSH] {table_name} concluido em {duration}s. Inseridos: {inserted}/{total_records}")

def run_all_pushes():
    # Sincroniza tabelas core do Dashboard
    push_table("apr_records")
    push_table("auditorias_5s")
    push_table("produtividade")
    push_table("frota_custos")

if __name__ == "__main__":
    print("=== INICIANDO PUSH REST OTIMIZADO (COM LIMPEZA DE DADOS) ===")
    run_all_pushes()
    print("=== PUSH FINALIZADO ===")
