import sqlite3
import os

db_path = 'backend/data/portal.db'
if not os.path.exists(db_path):
    # Try another one
    db_path = 'backend/database.db'

print(f"Checking DB: {db_path}")
if not os.path.exists(db_path):
    print("Database not found!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]
print('Tables:', tables)
for t in tables:
    cursor.execute(f'SELECT count(*) FROM {t}')
    print(f'{t}: {cursor.fetchone()[0]}')
conn.close()
