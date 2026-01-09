#!/usr/bin/env python3
"""
Script pour pre-calculer les sorties de groupe a partir des activites Strava.
Detecte les activites faites ensemble (meme heure, meme duree, meme type de sport).
"""

import json
import sys
import os
from datetime import datetime
from collections import defaultdict
from math import radians, sin, cos, sqrt, atan2
import time
import urllib.request
import urllib.parse

# Configuration
INPUT_FILE = '../public/data/all_activities_2025.json'
OUTPUT_FILE = '../public/data/activities_with_groups.json'
COUNTRY_CACHE_FILE = 'country_cache.json'

MAX_START_TIME_DIFF_MINUTES = 60
MAX_DURATION_DIFF_SECONDS = 7200
POLYLINE_CORRIDOR_WIDTH_METERS = 150
POLYLINE_MIN_SIMILARITY = 0.5
POLYLINE_SAMPLE_RATE = 30
MAX_DISTANCE_DEVIATION_PERCENT = 0.20
MAX_ELEVATION_DEVIATION_PERCENT = 0.20
MIN_GROUP_SIZE = 2

# Seuils stricts pour le fallback sans polyline ou avec polyline faible
STRICT_TIME_DIFF_MINUTES = 15
STRICT_DURATION_DIFF_SECONDS = 600  # 10 min
STRICT_DISTANCE_DEVIATION_PERCENT = 0.10

EXCLUDED_SPORTS = [
    'AlpineSki', 'Snowboard', 'EBikeRide', 'EMountainBikeRide',
    'VirtualRide', 'VirtualRun', 'Sail', 'Kitesurf', 'Swim',
    'Yoga', 'WeightTraining', 'Rowing', 'StandUpPaddling',
    'Crossfit', 'HighIntensityIntervalTraining', 'Workout',
    'IceSkate', 'Surfing','Skateboard','Pilates'
]

SPORT_MAPPING = {
    'Run': 'Run', 'TrailRun': 'Run', 'VirtualRun': 'Run',
    'Ride': 'Bike', 'MountainBikeRide': 'Bike', 'GravelRide': 'Bike',
    'EBikeRide': 'Bike', 'EMountainBikeRide': 'Bike', 'VirtualRide': 'Bike',
    'Hike': 'Hike', 'Walk': 'Hike', 'Snowshoe': 'Hike',
    'BackcountrySki': 'Ski mountaineering', 'NordicSki': 'Ski mountaineering',
    'AlpineSki': 'Ski', 'Snowboard': 'Ski',
    'RockClimbing': 'Climb'
}

ATHLETE_NAMES = {
    3953180: 'Clement D', 6635902: 'Bapt I', 3762537: 'Bapt M',
    68391361: 'Elo F', 5231535: 'Franck P', 87904944: 'Guillaume B',
    1841009: 'Mana S', 106477520: 'Matt X', 119310419: 'Max 2Peuf',
    19523416: 'Morguy D', 110979265: 'Pef B', 84388438: 'Remi S',
    25332977: 'Thomas G'
}

# Cache pour stocker les résultats de géocodage
country_cache = {}


def load_country_cache():
    """Charge le cache des pays depuis un fichier."""
    global country_cache
    if os.path.exists(COUNTRY_CACHE_FILE):
        try:
            with open(COUNTRY_CACHE_FILE, 'r', encoding='utf-8') as f:
                country_cache = json.load(f)
            print(f"  Cache de pays charge: {len(country_cache)} entrees")
        except:
            country_cache = {}


def save_country_cache():
    """Sauvegarde le cache des pays dans un fichier."""
    with open(COUNTRY_CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(country_cache, f, ensure_ascii=False, indent=2)


def translate_country_to_french(country_name):
    """
    Traduit le nom d'un pays en français.
    """
    translations = {
        # Noms anglais vers français
        'France': 'France', 'Switzerland': 'Suisse', 'Italy': 'Italie', 'Spain': 'Espagne',
        'Germany': 'Allemagne', 'Belgium': 'Belgique', 'Netherlands': 'Pays-Bas',
        'United Kingdom': 'Royaume-Uni', 'Austria': 'Autriche', 'Portugal': 'Portugal',
        'Norway': 'Norvège', 'Sweden': 'Suède', 'Greece': 'Grèce', 'Poland': 'Pologne',
        'Czech Republic': 'Tchéquie', 'Czechia': 'Tchéquie', 'Slovakia': 'Slovaquie',
        'Slovenia': 'Slovénie', 'Croatia': 'Croatie', 'Serbia': 'Serbie',
        'Bosnia and Herzegovina': 'Bosnie-Herzégovine', 'Montenegro': 'Monténégro',
        'Albania': 'Albanie', 'North Macedonia': 'Macédoine du Nord', 'Romania': 'Roumanie',
        'Bulgaria': 'Bulgarie', 'Hungary': 'Hongrie', 'Finland': 'Finlande',
        'Denmark': 'Danemark', 'Iceland': 'Islande', 'Ireland': 'Irlande',
        'Luxembourg': 'Luxembourg', 'Estonia': 'Estonie', 'Latvia': 'Lettonie',
        'Lithuania': 'Lituanie',
        # Asie
        'China': 'Chine', 'India': 'Inde', 'Japan': 'Japon', 'South Korea': 'Corée du Sud',
        'Thailand': 'Thaïlande', 'Vietnam': 'Vietnam', 'Indonesia': 'Indonésie',
        'Malaysia': 'Malaisie', 'Philippines': 'Philippines', 'Nepal': 'Népal',
        'नेपाल': 'Népal', 'Bhutan': 'Bhoutan', 'Myanmar': 'Myanmar', 'Cambodia': 'Cambodge',
        'Laos': 'Laos', 'Singapore': 'Singapour', 'Bangladesh': 'Bangladesh',
        'Pakistan': 'Pakistan', 'Afghanistan': 'Afghanistan', 'Sri Lanka': 'Sri Lanka',
        'Maldives': 'Maldives', 'Taiwan': 'Taïwan', 'Mongolia': 'Mongolie',
        # Amérique du Nord
        'United States': 'États-Unis', 'USA': 'États-Unis', 'Canada': 'Canada',
        'Mexico': 'Mexique',
        # Amérique centrale
        'Guatemala': 'Guatemala', 'Belize': 'Belize', 'El Salvador': 'Salvador',
        'Honduras': 'Honduras', 'Nicaragua': 'Nicaragua', 'Costa Rica': 'Costa Rica',
        'Panama': 'Panama',
        # Amérique du Sud
        'Brazil': 'Brésil', 'Argentina': 'Argentine', 'Chile': 'Chili', 'Peru': 'Pérou',
        'Colombia': 'Colombie', 'Venezuela': 'Venezuela', 'Ecuador': 'Équateur',
        'Bolivia': 'Bolivie', 'Paraguay': 'Paraguay', 'Uruguay': 'Uruguay',
        'Guyana': 'Guyana', 'Suriname': 'Suriname', 'French Guiana': 'Guyane française',
        # Océanie
        'Australia': 'Australie', 'New Zealand': 'Nouvelle-Zélande',
        'Papua New Guinea': 'Papouasie-Nouvelle-Guinée', 'Fiji': 'Fidji',
        'New Caledonia': 'Nouvelle-Calédonie', 'French Polynesia': 'Polynésie française',
        # Afrique
        'South Africa': 'Afrique du Sud', 'Egypt': 'Égypte', 'Morocco': 'Maroc',
        'Algeria': 'Algérie', 'Tunisia': 'Tunisie', 'Libya': 'Libye', 'Kenya': 'Kenya',
        'Tanzania': 'Tanzanie', 'Uganda': 'Ouganda', 'Ethiopia': 'Éthiopie',
        'Ghana': 'Ghana', 'Nigeria': 'Nigeria', 'Senegal': 'Sénégal',
        "Ivory Coast": "Côte d'Ivoire", 'Cameroon': 'Cameroun',
        'Democratic Republic of the Congo': 'RD Congo', 'Zimbabwe': 'Zimbabwe',
        'Botswana': 'Botswana', 'Namibia': 'Namibie', 'Mozambique': 'Mozambique',
        'Madagascar': 'Madagascar', 'Réunion': 'La Réunion', 'Mauritius': 'Maurice',
        # Moyen-Orient
        'Turkey': 'Turquie', 'Israel': 'Israël', 'Jordan': 'Jordanie', 'Lebanon': 'Liban',
        'Syria': 'Syrie', 'Iraq': 'Irak', 'Iran': 'Iran', 'Saudi Arabia': 'Arabie saoudite',
        'United Arab Emirates': 'Émirats arabes unis', 'Oman': 'Oman', 'Yemen': 'Yémen',
        'Kuwait': 'Koweït', 'Qatar': 'Qatar', 'Bahrain': 'Bahreïn',
        'Armenia': 'Arménie', 'Azerbaijan': 'Azerbaïdjan', 'Georgia': 'Géorgie',
        # Caraïbes
        'Cuba': 'Cuba', 'Jamaica': 'Jamaïque', 'Haiti': 'Haïti',
        'Dominican Republic': 'République dominicaine', 'Puerto Rico': 'Porto Rico',
        'Trinidad and Tobago': 'Trinité-et-Tobago', 'Barbados': 'Barbade',
        'Guadeloupe': 'Guadeloupe', 'Martinique': 'Martinique',
    }

    # Retourner la traduction ou le nom original si pas de correspondance
    return translations.get(country_name, country_name)


def get_country_from_coords(lat, lon):
    """
    Détermine le pays à partir des coordonnées GPS en utilisant Nominatim.
    Utilise un cache local pour éviter les appels répétés.
    """
    if lat is None or lon is None:
        return None

    # Arrondir les coordonnées pour le cache (précision de ~1km)
    cache_key = f"{round(lat, 2)},{round(lon, 2)}"

    # Vérifier le cache
    if cache_key in country_cache:
        return country_cache[cache_key]

    try:
        # Utiliser l'API Nominatim d'OpenStreetMap (gratuite, pas de clé nécessaire)
        # Ajouter accept-language=fr pour obtenir les noms en français
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=3&accept-language=fr"

        # Ajouter un User-Agent requis par Nominatim
        req = urllib.request.Request(url, headers={'User-Agent': 'StravaGroupDetector/1.0'})

        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))

            country = data.get('address', {}).get('country')

            # Traduire le nom du pays en français si nécessaire
            if country:
                country = translate_country_to_french(country)

            # Mettre en cache
            country_cache[cache_key] = country

            # Respecter les limites de taux (1 requête par seconde)
            time.sleep(1)

            return country
    except Exception as e:
        # En cas d'erreur, essayer le fallback avec des bounding boxes
        print(f"  Erreur geocoding pour ({lat}, {lon}): {e}")
        return get_country_fallback(lat, lon)


def get_country_fallback(lat, lon):
    """
    Méthode de fallback utilisant des bounding boxes pour les pays principaux.
    """
    # Bounding boxes approximatives des pays les plus communs
    COUNTRY_BOXES = {
        'France': (41.0, 51.5, -5.5, 10.0),
        'Suisse': (45.7, 47.9, 5.8, 10.6),
        'Italie': (35.5, 47.2, 6.5, 18.8),
        'Espagne': (36.0, 43.9, -9.5, 3.5),
        'Allemagne': (47.2, 55.1, 5.8, 15.1),
        'Belgique': (49.4, 51.6, 2.5, 6.5),
        'Pays-Bas': (50.7, 53.7, 3.3, 7.3),
        'Royaume-Uni': (49.9, 61.0, -8.2, 2.0),
        'Autriche': (46.4, 49.1, 9.5, 17.2),
        'Portugal': (36.9, 42.2, -9.6, -6.1),
        'Norvège': (57.9, 71.3, 4.5, 31.3),
        'Suède': (55.3, 69.1, 10.9, 24.2),
        'Népal': (26.3, 30.5, 80.0, 88.3),
        'Nouvelle-Zélande': (-47.3, -34.4, 166.4, 178.6),
        'Salvador': (13.1, 14.5, -90.1, -87.7),
        'Serbie': (42.2, 46.2, 18.8, 23.0),
    }

    for country, (lat_min, lat_max, lon_min, lon_max) in COUNTRY_BOXES.items():
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return country

    return None


def decode_polyline(encoded):
    if not encoded:
        return []
    decoded = []
    index = lat = lng = 0
    while index < len(encoded):
        shift = result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lat += ~(result >> 1) if result & 1 else result >> 1
        shift = result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lng += ~(result >> 1) if result & 1 else result >> 1
        decoded.append([lat / 1e5, lng / 1e5])
    return decoded


def map_sport(sport_type):
    return SPORT_MAPPING.get(sport_type, 'Other')


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def compare_polylines(poly1, poly2):
    if not poly1 or not poly2 or len(poly1) < 2 or len(poly2) < 2:
        return 0
    sample_rate = max(1, min(len(poly1), len(poly2)) // POLYLINE_SAMPLE_RATE)
    sampled1, sampled2 = poly1[::sample_rate], poly2[::sample_rate]
    match_count = sum(1 for p1 in sampled1 if any(
        haversine_distance(p1[0], p1[1], p2[0], p2[1]) <= POLYLINE_CORRIDOR_WIDTH_METERS for p2 in sampled2
    ))
    return match_count / len(sampled1) if sampled1 else 0


def normalize_activity(activity, use_online_geocoding=True):
    """
    Normalise une activité au format attendu par le reste du script.
    """
    # Extraire l'athlete_id depuis l'objet athlete
    athlete_id = activity.get('athlete', {}).get('id')

    # Récupérer le nom de l'athlète depuis athlete_name ou athlete_full_name
    athlete_name = activity.get('athlete_name') or activity.get('athlete_full_name')

    # Déterminer le pays depuis start_latlng
    start_latlng = activity.get('start_latlng', [])
    country = None
    if start_latlng and len(start_latlng) >= 2:
        if use_online_geocoding:
            country = get_country_from_coords(start_latlng[0], start_latlng[1])
        else:
            country = get_country_fallback(start_latlng[0], start_latlng[1])

    return {
        'activity_id': activity.get('id'),
        'athlete_id': athlete_id,
        'athlete_name': athlete_name,
        'name': activity.get('name'),
        'sport_type': activity.get('sport_type'),
        'start_date': activity.get('start_date_local'),
        'moving_time': activity.get('moving_time'),
        'elapsed_time': activity.get('elapsed_time'),
        'distance': activity.get('distance'),
        'total_elevation_gain': activity.get('total_elevation_gain'),
        'map': activity.get('map'),
        'start_latlng': start_latlng,
        'country': country,
        # Conserver les autres champs qui pourraient être utiles
        'kudos_count': activity.get('kudos_count'),
        'comment_count': activity.get('comment_count'),
    }


def activities_match(a1, a2):
    # Même catégorie de sport
    if map_sport(a1['sport_type']) != map_sport(a2['sport_type']):
        return False

    # Calcul des différences
    t1 = datetime.fromisoformat(a1['start_date'].replace('Z', '+00:00'))
    t2 = datetime.fromisoformat(a2['start_date'].replace('Z', '+00:00'))
    time_diff_min = abs((t1 - t2).total_seconds()) / 60

    dur1, dur2 = a1.get('moving_time', 0) or 0, a2.get('moving_time', 0) or 0
    dur_diff = abs(dur1 - dur2)

    dist1, dist2 = a1.get('distance', 0) or 0, a2.get('distance', 0) or 0
    avg_dist = (dist1 + dist2) / 2
    dist_deviation = abs(dist1 - dist2) / avg_dist if avg_dist > 0 else 0

    elev1, elev2 = a1.get('total_elevation_gain', 0) or 0, a2.get('total_elevation_gain', 0) or 0
    avg_elev = (elev1 + elev2) / 2
    elev_deviation = abs(elev1 - elev2) / avg_elev if avg_elev > 0 else 0

    # Critères de base
    if time_diff_min > MAX_START_TIME_DIFF_MINUTES:
        return False
    if dur_diff > MAX_DURATION_DIFF_SECONDS:
        return False

    # Comparer les traces GPS si disponibles
    poly1_enc = a1.get('map', {}).get('summary_polyline')
    poly2_enc = a2.get('map', {}).get('summary_polyline')

    if poly1_enc and poly2_enc:
        similarity = compare_polylines(decode_polyline(poly1_enc), decode_polyline(poly2_enc))

        # Si bonne similarité de polyline, c'est OK
        if similarity >= POLYLINE_MIN_SIMILARITY:
            return True

        # Sinon, fallback sur critères stricts si les polylines sont partiellement similaires
        if similarity >= 0.2:
            if (time_diff_min <= STRICT_TIME_DIFF_MINUTES and
                    dur_diff <= STRICT_DURATION_DIFF_SECONDS and
                    dist_deviation <= STRICT_DISTANCE_DEVIATION_PERCENT):
                return True

        return False
    else:
        # Sans polyline, vérifier distance et D+
        if avg_dist > 0 and dist_deviation > MAX_DISTANCE_DEVIATION_PERCENT:
            return False
        if avg_elev > 0 and elev_deviation > MAX_ELEVATION_DEVIATION_PERCENT:
            return False

    return True


def detect_group_activities(activities):
    by_day = defaultdict(list)
    for a in activities:
        by_day[a['start_date'][:10]].append(a)

    groups = []
    for day, day_activities in by_day.items():
        if len(day_activities) < MIN_GROUP_SIZE:
            continue

        activity_matches = defaultdict(set)
        for i, a1 in enumerate(day_activities):
            for j, a2 in enumerate(day_activities):
                if i >= j or a1['athlete_id'] == a2['athlete_id']:
                    continue
                if activities_match(a1, a2):
                    activity_matches[a1['activity_id']].add(a2['activity_id'])
                    activity_matches[a2['activity_id']].add(a1['activity_id'])

        activity_by_id = {a['activity_id']: a for a in day_activities}
        used_in_group = set()

        for a_id, matches in sorted(activity_matches.items(), key=lambda x: -len(x[1])):
            if a_id in used_in_group:
                continue
            group_ids = {a_id}
            for match_id in matches:
                if match_id in used_in_group:
                    continue
                if all(match_id in activity_matches.get(gid, set()) or
                       activities_match(activity_by_id[gid], activity_by_id[match_id])
                       for gid in group_ids if gid != match_id):
                    group_ids.add(match_id)

            if len(group_ids) >= MIN_GROUP_SIZE:
                group_acts = [activity_by_id[gid] for gid in group_ids]
                n = len(group_acts)

                # Déterminer le pays le plus courant dans le groupe
                countries = [a.get('country') for a in group_acts if a.get('country')]
                group_country = max(set(countries), key=countries.count) if countries else None

                groups.append({
                    'id': f"group_{day}_{len(groups)}",
                    'date': day,
                    'athletes': [a['athlete_id'] for a in group_acts],
                    'activity_ids': list(group_ids),
                    'sport': group_acts[0]['sport_type'],
                    'sport_category': map_sport(group_acts[0]['sport_type']),
                    'name': group_acts[0].get('name', 'Sortie en groupe'),
                    'elevation': round(sum(a.get('total_elevation_gain', 0) or 0 for a in group_acts) / n),
                    'duration': round(sum(a.get('moving_time', 0) or 0 for a in group_acts) / n),
                    'distance': round(sum(a.get('distance', 0) or 0 for a in group_acts) / n),
                    'athlete_count': n,
                    'country': group_country
                })
                used_in_group.update(group_ids)
    return groups


def main():
    input_file = sys.argv[1] if len(sys.argv) >= 3 else INPUT_FILE
    output_file = sys.argv[2] if len(sys.argv) >= 3 else OUTPUT_FILE

    # Option pour désactiver le géocodage en ligne
    use_online_geocoding = '--offline' not in sys.argv

    print(f"Lecture de {input_file}...")

    if not os.path.exists(input_file):
        print(f"Erreur: fichier '{input_file}' introuvable")
        sys.exit(1)

    # Charger le cache de pays
    if use_online_geocoding:
        load_country_cache()
        print("Mode: geocodage en ligne avec cache (peut prendre du temps)")
    else:
        print("Mode: geocodage offline uniquement (pays limites)")

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Le nouveau format est une liste directe d'activités
    raw_activities = data if isinstance(data, list) else data.get('activities', [])
    print(f"  {len(raw_activities)} activites chargees")

    # Normaliser toutes les activités
    print("Normalisation et detection des pays...")
    activities = []
    for i, a in enumerate(raw_activities):
        if (i + 1) % 100 == 0:
            print(f"  Traitement: {i + 1}/{len(raw_activities)}")
        activities.append(normalize_activity(a, use_online_geocoding))

    # Sauvegarder le cache
    if use_online_geocoding:
        save_country_cache()
        print(f"Cache sauvegarde: {len(country_cache)} entrees")

    # Afficher quelques statistiques sur les pays
    countries_count = defaultdict(int)
    for a in activities:
        if a.get('country'):
            countries_count[a['country']] += 1

    print(f"\nRepartition par pays:")
    for country, count in sorted(countries_count.items(), key=lambda x: -x[1])[:15]:
        print(f"  {country}: {count} activites")

    filtered = [a for a in activities if a.get('sport_type') not in EXCLUDED_SPORTS]
    print(f"\n  {len(filtered)} activites apres filtrage")

    print("\nDetection des sorties de groupe...")
    groups = detect_group_activities(filtered)

    pairs = sum(1 for g in groups if g['athlete_count'] == 2)
    trios = sum(1 for g in groups if g['athlete_count'] == 3)
    more = sum(1 for g in groups if g['athlete_count'] > 3)
    print(f"  {len(groups)} sorties detectees (duos: {pairs}, trios: {trios}, 4+: {more})")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({'activities': activities, 'group_activities': groups}, f, ensure_ascii=False, indent=2)

    print(f"\nFichier cree: {output_file} ({os.path.getsize(output_file) / 1024:.1f} KB)")

    # Afficher les groupes Bike
    bike_groups = [g for g in groups if g['sport_category'] == 'Bike']
    print(f"\nGroupes velo ({len(bike_groups)}):")
    for g in sorted(bike_groups, key=lambda x: x['date'], reverse=True)[:10]:
        names = [ATHLETE_NAMES.get(aid, str(aid)) for aid in g['athletes']]
        country_str = f" ({g['country']})" if g.get('country') else ""
        print(f"  {g['date']}: {', '.join(names)}{country_str}")


if __name__ == '__main__':
    main()