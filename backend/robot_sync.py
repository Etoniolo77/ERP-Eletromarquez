import os
import sys
import time
from dotenv import load_dotenv

# Carrega a URL do Supabase (ex: SUPABASE_DB_URL=postgresql://postgres.xxx:senha@xxx.supabase.com:6543/postgres)
load_dotenv()

from database import SessionLocal
import sync_engine

def run_all_syncs():
    print("="*60)
    print("🤖 INICIANDO ROBÔ DE SINCRONIZAÇÃO - PORTAL DE INDICADORES")
    print(f"📡 Destino: {os.environ.get('SUPABASE_DB_URL', 'SQLite Local')}")
    print("="*60)
    
    db = SessionLocal()
    try:
        sync_engine.sync_produtividade(db)
        sync_engine.sync_produtividade_ccm(db)
        sync_engine.sync_5s(db)
        sync_engine.sync_rejeicoes(db)
        sync_engine.sync_frota(db)
        sync_engine.sync_indisponibilidade(db)
        try:
            sync_engine.sync_logccm(db)
        except Exception as e:
            print(f"[ERROR] Falha no sync_logccm: {e}")
        try:
            sync_engine.sync_apr(db)
        except Exception as e:
            print(f"[ERROR] Falha no sync_apr: {e}")
        try:
            sync_engine.sync_saida_base(db)
        except Exception as e:
            print(f"[ERROR] Falha no sync_saida_base: {e}")
            
        print("✅ SINCRONIZAÇÃO COMPLETA COM SUCESSO!")
    except Exception as e:
        print(f"❌ ERRO GERAL NO ROBO: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    run_all_syncs()
