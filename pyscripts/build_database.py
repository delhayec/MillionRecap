import json
from pathlib import Path
import pandas as pd

rows = []

DATA_DIR = Path("../rawdata/All_metadata")

files = list(DATA_DIR.glob("*.json"))
print("Nombre de fichiers trouvés :", len(files))

rows = []

for file in files:
    with open(file, encoding="utf-8") as f:
        data = json.load(f)

    row = {
        "athlete_id": data["athlete"]["id"],
        "activity_id": data["id"],
        "name": data["name"],
        "date": data["start_date"],
        "sport": data["sport_type"],
        "distance_m": data.get("distance"),
        "moving_time_s": data.get("moving_time"),
        "elevation_gain_m": data.get("total_elevation_gain"),
        "calories": data.get("calories"),
        "tracemap": data.get("map"),
    }

    rows.append(row)

print("Nombre de lignes construites :", len(rows))

df = pd.DataFrame(rows)

# ========== DÉDUPLICATION ==========
# Supprimer les doublons basés sur activity_id (garde la première occurrence)
df = df.drop_duplicates(subset=['activity_id'], keep='first')
print(f"Nombre de lignes après déduplication : {len(df)}")

df["date"] = pd.to_datetime(df["date"])
df["year"] = df["date"].dt.year
df["month"] = df["date"].dt.to_period("M")
df_2025 = df[df["date"].dt.year == 2025]

# ========== CORRECTION : Nettoyage avant export ==========

# Créer le dossier data s'il n'existe pas
output_dir = Path("../public/data")
output_dir.mkdir(parents=True, exist_ok=True)

# Créer une copie sans la colonne 'month' problématique
df_export = df_2025[['athlete_id', 'activity_id', 'name', 'date', 'sport', 'tracemap',
                      'distance_m', 'moving_time_s', 'elevation_gain_m', 'calories', 'year']].copy()

# Remplacer les valeurs NaN par 0 pour les champs numériques
df_export['distance_m'] = df_export['distance_m'].fillna(0).astype(float)
df_export['moving_time_s'] = df_export['moving_time_s'].fillna(0).astype(float)
df_export['elevation_gain_m'] = df_export['elevation_gain_m'].fillna(0).astype(float)
df_export['calories'] = df_export['calories'].fillna(0).astype(float)

# Convertir la colonne date en string ISO avant l'export
df_export['date'] = df_export['date'].dt.strftime('%Y-%m-%dT%H:%M:%S')

# S'assurer que athlete_id et activity_id sont des entiers
df_export['athlete_id'] = df_export['athlete_id'].astype(int)
df_export['activity_id'] = df_export['activity_id'].astype(int)
df_export['year'] = df_export['year'].astype(int)

# Export du DataFrame vers public/data/
output_path = Path("../public/data/activities_2025.json")
df_export.to_json(output_path, orient="records", indent=2)
print(f"Fichier JSON généré : {output_path.absolute()}")
print(f"Nombre d'activités 2025 exportées : {len(df_export)}")