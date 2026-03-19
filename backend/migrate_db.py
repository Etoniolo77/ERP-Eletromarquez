import sqlalchemy
from sqlalchemy import create_engine, text
import os
import sys

# Script para criar as tabelas no Supabase remotamente
# Tentaremos as URLs mais comuns com base no ID do projeto

import urllib.parse
FILE_TO_RUN = sys.argv[1] if len(sys.argv) > 1 else "01_supabase_schema.sql"
PROJECT_REF = "sesspgrbxkfighymxxio"
PASSWORD = urllib.parse.quote(sys.argv[2] if len(sys.argv) > 2 else "586597")

# Lista de strings de conexão para tentar
urls = [
    f"postgresql://postgres.{PROJECT_REF}:{PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
    f"postgresql://postgres:{PASSWORD}@db.{PROJECT_REF}.supabase.co:5432/postgres",
]

def run_migration():
    if not os.path.exists(FILE_TO_RUN):
        print(f"❌ Erro: Arquivo {FILE_TO_RUN} não encontrado!")
        return

    with open(FILE_TO_RUN, "r", encoding="utf-8") as f:
        sql_script = f.read()

    success = False
    for url in urls:
        print(f"📡 Tentando conectar via: {url.split('@')[1]}...")
        try:
            # SQLAlchemy engine
            engine = create_engine(url, connect_args={'connect_timeout': 5})
            with engine.connect() as conn:
                # Executa o script em partes separadas por ponto e vírgula
                # Ou usa o execute normal se for um script simples
                print("🔗 Conectado! Executando SQL schema...")
                # O script contém blocos DO $$, precisamos tratar ou rodar como um todo
                # Usaremos strings de texto bruto para o script
                conn.execute(text(sql_script))
                conn.commit()
                print("✅ SUCESSO! Todas as tabelas foram criadas no Supabase.")
                success = True
                break
        except Exception as e:
            print(f"⚠️ Falha nesta URL: {str(e)}")

    if not success:
        print("\n❌ Nenhuma conexão funcionou. Verifique se o ID do projeto e a senha estão corretos.")
        print("💡 Alternativa: Copie o conteúdo do 01_supabase_schema.sql e cole no 'SQL Editor' do Supabase.")

if __name__ == "__main__":
    run_migration()
