import sqlite3
import psycopg2
from psycopg2 import extras
import os
import time

# Dados do Postgres Cloud - VIA POOLER IPV4 (aws-1)
DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.sesspgrbxkfighymxxio:Eletromarquez2024@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require")

# Caminho do banco local
DB_PATH = "backend/data/portal.db"

def sync_table_to_pg(table_name):
    print(f"\n[POSTGRES] Sincronizando: {table_name}")
    
    # 1. Ler os dados locais
    try:
        conn_sqlite = sqlite3.connect(DB_PATH)
        conn_sqlite.row_factory = sqlite3.Row
        cursor_sqlite = conn_sqlite.cursor()
        
        cursor_sqlite.execute(f"PRAGMA table_info({table_name})")
        cols = [col["name"] for col in cursor_sqlite.fetchall() if col["name"] != "id"]
        
        # Filtro prod
        if table_name == "produtividade":
            allowed = ["equipe", "tipo_equipe", "setor", "data", "csd", "ocupacao", "produtividade_pct", "eficiencia_pct", "eficacia_pct", "notas_executadas", "notas_interrompidas", "notas_rejeitadas", "ociosidade_min", "desvios_min", "deslocamento_min", "hhp_min", "saida_base_min", "retorno_base_min", "hora_extra_min"]
            cols = [c for c in cols if c in allowed]

        cursor_sqlite.execute(f"SELECT {', '.join(cols)} FROM {table_name}")
        rows = cursor_sqlite.fetchall()
        data = [tuple(row) for row in rows]
        conn_sqlite.close()
        
        if not data:
            print(f"   -> [AVISO] Tabela {table_name} vazia localmente.")
            return

    except Exception as e:
        print(f"   -> [ERRO SQLITE] {e}")
        return

    # 2. Inserir no Postgres
    try:
        conn_pg = psycopg2.connect(DB_URL)
        cursor_pg = conn_pg.cursor()
        
        # TRUNCATE first to clean up
        print(f"   -> Limpando {table_name} na nuvem...")
        cursor_pg.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE;")
        
        # BULK INSERT using execute_values
        print(f"   -> Inserindo {len(data)} registros...")
        query = f"INSERT INTO {table_name} ({', '.join(cols)}) VALUES %s"
        extras.execute_values(cursor_pg, query, data)
        
        conn_pg.commit()
        cursor_pg.close()
        conn_pg.close()
        print(f"   -> [SUCESSO] Sincronizacao de {table_name} concluida.")
        
    except Exception as e:
        print(f"   -> [ERRO POSTGRES] {e}")

if __name__ == "__main__":
    start = time.time()
    for table in ["apr_records", "auditorias_5s", "produtividade", "frota_custos", "saida_base_records", "itens_estoque", "movimentacoes"]:
        try:
              sync_table_to_pg(table)
        except Exception as e:
              print(f"   -> [FALHA TOTAL NO SYNC DE {table}]: {e}")
    print(f"\n[FINALIZADO] Tempo total: {round(time.time() - start, 2)}s")
