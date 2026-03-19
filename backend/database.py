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

# Forcar SQLite para funcionar local route proxy e ignorar .env
DEFAULT_URL = f"sqlite:///{os.path.join(DATA_DIR, 'portal.db')}"
SQLALCHEMY_DATABASE_URL = DEFAULT_URL

is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

# Create the Engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} if is_sqlite else {}
)

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
