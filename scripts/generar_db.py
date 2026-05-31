# scripts/generar_db.py
import csv, sqlite3, os

CSV_FILE = "datos.csv"
DB_OUTPUT = "../assets/database/app.db"

os.makedirs(os.path.dirname(DB_OUTPUT), exist_ok=True)

conn = sqlite3.connect(DB_OUTPUT)
cur = conn.cursor()

# ↓ encoding latin-1 cubre español/caracteres Windows, delimiter=";" para separador punto y coma
with open(CSV_FILE, newline="", encoding="latin-1") as f:
    reader = csv.DictReader(f, delimiter=";")
    headers = reader.fieldnames

    cols = ", ".join(f'"{h}" TEXT' for h in headers)
    cur.execute(f"CREATE TABLE IF NOT EXISTS datos ({cols})")

    placeholders = ", ".join("?" * len(headers))
    for row in reader:
        cur.execute(
            f"INSERT INTO datos VALUES ({placeholders})",
            [row[h] for h in headers]
        )

conn.commit()
conn.close()
print(f"✅ Base de datos creada: {DB_OUTPUT}")
print(f"   Columnas: {headers}")
print(f"   Filas insertadas: {cur.rowcount}")