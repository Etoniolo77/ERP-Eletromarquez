import sqlite3
import os
import pandas as pd
from sqlalchemy import create_engine, MetaData, Table, insert
from dotenv import load_dotenv

load_dotenv()

# Caminhos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "portal.db")
SQL_URL = os.environ.get("SUPABASE_DB_URL")

if not SQL_URL:
    print("[ERROR] SUPABASE_DB_URL não encontrada no .env")
    exit(1)

# Ajuste do driver para SQLAlchemy
if SQL_URL.startswith("postgresql://") and "postgresql+psycopg2://" not in SQL_URL:
    SQL_URL = SQL_URL.replace("postgresql://", "postgresql+psycopg2://")

def sync_table(table_name):
    print(f"\n[SYNC] Processando tabela: {table_name}")
    
    # 1. Ler dados do SQLite
    try:
        conn_sqlite = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn_sqlite)
        conn_sqlite.close()
        
        if df.empty:
            print(f"   -> Tabela {table_name} vazia localmente. Pulando.")
            return

        if 'id' in df.columns:
            df = df.drop(columns=['id'])
            
        print(f"   -> {len(df)} registros encontrados localmente.")
    except Exception as e:
        print(f"   -> Erro ao ler SQLite: {e}")
        return

    # 2. Conectar ao Postgres (Supabase)
    try:
        engine_pg = create_engine(SQL_URL)
        
        # Limpar tabela remota antes da carga
        with engine_pg.connect() as conn_pg:
            print(f"   -> Limpando {table_name} no Supabase...")
            conn_pg.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")
            conn_pg.commit()
            
            # 3. Inserir em chunks
            print(f"   -> Inserindo dados no Supabase...")
            df.to_sql(table_name, engine_pg, if_exists='append', index=False, method='multi', chunksize=1000)
            print(f"   -> {table_name} sincronizada com sucesso!")
            
    except Exception as e:
        print(f"   -> Erro no Postgres: {e}")

if __name__ == "__main__":
    tables = [
        "apr_records",
        "saida_base_records",
        "auditorias_5s",
        "produtividade",
        "rejeicoes",
        "frota_custos",
        "indisponibilidade"
    ]
    
    for t in tables:
        sync_table(t)
    
    print("\n[FINISH] Sincronização completa finalizada.")
