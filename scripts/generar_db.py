# scripts/generar_db.py
import csv, sqlite3, os

CSV_FILE = "datos.csv"
DB_OUTPUT = "../assets/database/app.db"

os.makedirs(os.path.dirname(DB_OUTPUT), exist_ok=True)

conn = sqlite3.connect(DB_OUTPUT)
cur = conn.cursor()

with open(CSV_FILE, newline="", encoding="utf-8-sig") as f:  # ← utf-8-sig elimina el BOM automáticamente
    reader = csv.DictReader(f, delimiter=";")
    headers = reader.fieldnames

    # Limpia posibles BOM residuales en los nombres de columnas
    headers = [h.strip().replace('\ufeff', '') for h in headers]
    
    print(f"Columnas limpias: {headers}")

    cols = ", ".join(f'"{h}" TEXT' for h in headers)
    cur.execute(f"CREATE TABLE IF NOT EXISTS datos ({cols})")

    placeholders = ", ".join("?" * len(headers))
    for row in reader:
        cur.execute(
            f"INSERT INTO datos VALUES ({placeholders})",
            [row[h] for h in reader.fieldnames]
        )

conn.commit()
conn.close()
print(f"✅ Base de datos creada: {DB_OUTPUT}")
print(f"   Filas insertadas: {cur.rowcount}")