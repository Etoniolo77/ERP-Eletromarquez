from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

# Carrega variáveis do arquivo .env
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Prioriza Supabase se disponível no ambiente (Vercel/Local .env)
SQLALCHEMY_DATABASE_URL = os.environ.get("SUPABASE_DB_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Fallback para SQLite local
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'portal.db')}"
    print(f"[DB] Usando SQLite Local: {SQLALCHEMY_DATABASE_URL}")
else:
    # Ajuste para SQLAlchemy se o driver não estiver explícito
    if SQLALCHEMY_DATABASE_URL.startswith("postgresql://") and "postgresql+psycopg2://" not in SQLALCHEMY_DATABASE_URL:
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://")
    print(f"[DB] Conectando ao Supabase (PostgreSQL)")

is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

# Configuração do Engine com Fallback Robusto
def create_resilient_engine(url):
    try:
        # Se for PostgreSQL, testa a conexão primária
        if url.startswith("postgresql"):
            temp_engine = create_engine(url, connect_args={"connect_timeout": 5})
            with temp_engine.connect() as conn:
                pass
            print(f"[DB] Conexão com Supabase estabelecida com sucesso.")
            return create_engine(url, pool_pre_ping=True)
    except Exception as e:
        print(f"[DB] ERRO CRÍTICO: Falha ao conectar ao Supabase: {e}")
        print(f"[DB] Acionando Fallback Automático para SQLite...")
    
    return create_engine(
        f"sqlite:///{os.path.join(DATA_DIR, 'portal.db')}", 
        pool_pre_ping=True,
        connect_args={"check_same_thread": False}
    )

engine = create_resilient_engine(SQLALCHEMY_DATABASE_URL)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for the models
Base = declarative_base()

# Dependency to be used by FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
