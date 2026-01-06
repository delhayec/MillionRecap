import json
from pathlib import Path
import pandas as pd
from collections import Counter


def get_country_from_segments(data):
    """Extrait le pays à partir des segments Strava"""
    if "segment_efforts" in data and len(data["segment_efforts"]) > 0:
        # Compter les pays dans tous les segments
        countries = []
        for effort in data["segment_efforts"]:
            if "segment" in effort and "country" in effort["segment"]:
                country = effort["segment"]["country"]
                if country:
                    countries.append(country)

        # Retourner le pays le plus fréquent
        if countries:
            country_counts = Counter(countries)
            return country_counts.most_common(1)[0][0]

    return None


# ========================================
# EXTRACTION DES DONNÉES
# ========================================

rows = []
DATA_DIR = Path("../rawdata/All_metadata")
files = list(DATA_DIR.glob("*.json"))
print(f"📁 Nombre de fichiers trouvés : {len(files)}")

for i, file in enumerate(files):
    if i % 100 == 0:
        print(f"⏳ Traitement: {i}/{len(files)}")

    with open(file, encoding="utf-8") as f:
        data = json.load(f)

    # Déterminer le pays via les segments
    country = get_country_from_segments(data)

    # Construction de la ligne
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
        "country": country
    }

    rows.append(row)

print("\n✅ Extraction terminée !")
print(f"📊 Total d'activités : {len(rows)}")

# ========================================
# TRAITEMENT DU DATAFRAME
# ========================================

df = pd.DataFrame(rows)

# Déduplication
df = df.drop_duplicates(subset=['activity_id'], keep='first')
print(f"🔄 Nombre de lignes après déduplication : {len(df)}")

# Extraction année/mois
df["date"] = pd.to_datetime(df["date"])
df["year"] = df["date"].dt.year
df["month"] = df["date"].dt.to_period("M")

# Filtrer 2025
df_2025 = df[df["date"].dt.year == 2025]

# Compter les activités avec/sans pays
with_country = len(df_2025[df_2025['country'].notna()])
without_country = len(df_2025[df_2025['country'].isna()])
print(f"🌍 Activités 2025 avec pays : {with_country}")
print(f"❓ Activités 2025 sans pays : {without_country}")

# ========================================
# EXPORT
# ========================================

output_dir = Path("../public/data")
output_dir.mkdir(parents=True, exist_ok=True)

# Préparer l'export
df_export = df_2025[['athlete_id', 'activity_id', 'name', 'date', 'sport', 'tracemap',
                     'distance_m', 'moving_time_s', 'elevation_gain_m', 'calories',
                     'year', 'country']].copy()  # 🌍 Ajout du pays

# Nettoyage
df_export['distance_m'] = df_export['distance_m'].fillna(0).astype(float)
df_export['moving_time_s'] = df_export['moving_time_s'].fillna(0).astype(float)
df_export['elevation_gain_m'] = df_export['elevation_gain_m'].fillna(0).astype(float)
df_export['calories'] = df_export['calories'].fillna(0).astype(float)
df_export['date'] = df_export['date'].dt.strftime('%Y-%m-%dT%H:%M:%S')
df_export['athlete_id'] = df_export['athlete_id'].astype(int)
df_export['activity_id'] = df_export['activity_id'].astype(int)
df_export['year'] = df_export['year'].astype(int)

# Export JSON principal
output_path = Path("../public/data/activities_2025.json")
df_export.to_json(output_path, orient="records", indent=2)
print(f"\n✅ Fichier JSON généré : {output_path.absolute()}")
print(f"📊 Nombre d'activités 2025 exportées : {len(df_export)}")