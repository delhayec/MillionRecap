#!/usr/bin/env python3
"""
Script pour pré-calculer les sorties de groupe à partir des activités Strava.
Détecte les activités faites ensemble (même heure, même durée, même type de sport).
Supporte les groupes de 2+ personnes.

Usage: python precompute_groups.py input.json output.json
"""

import json
import sys
from datetime import datetime
from collections import defaultdict
from math import radians, sin, cos, sqrt, atan2

# Mapping des sports vers catégories
SPORT_MAPPING = {
    'Run': 'Run', 'TrailRun': 'Run', 'VirtualRun': 'Run',
    'Ride': 'Bike', 'MountainBikeRide': 'Bike', 'GravelRide': 'Bike',
    'EBikeRide': 'Bike', 'EMountainBikeRide': 'Bike', 'VirtualRide': 'Bike',
    'Hike': 'Hike', 'Walk': 'Hike',
    'BackcountrySki': 'Ski', 'NordicSki': 'Ski', 'AlpineSki': 'Ski',
    'Snowboard': 'Ski', 'Snowshoe': 'Ski',
    'RockClimbing': 'Climb', 'IceSkate': 'Other',
    'Swim': 'Other', 'Rowing': 'Other', 'Kayaking': 'Other',
    'Yoga': 'Other', 'Workout': 'Other'
}

ATHLETE_NAMES = {
    3953180: 'Clement D', 6635902: 'Bapt I', 3762537: 'Bapt M', 68391361: 'Elo F',
    5231535: 'Franck P', 87904944: 'Guillaume B', 1841009: 'Mana S', 106477520: 'Matt X',
    119310419: 'Max 2Peuf', 19523416: 'Morguy D', 110979265: 'Pef B', 84388438: 'Remi S',
    25332977: 'Thomas G'
}


def decode_polyline(encoded):
    """Décode une polyline Google encodée en liste de [lat, lng]."""
    if not encoded:
        return []

    decoded = []
    index = 0
    lat = 0
    lng = 0

    while index < len(encoded):
        # Décoder latitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if result & 1 else result >> 1
        lat += dlat

        # Décoder longitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if result & 1 else result >> 1
        lng += dlng

        decoded.append([lat / 1e5, lng / 1e5])

    return decoded


def map_sport(sport_type):
    return SPORT_MAPPING.get(sport_type, 'Other')


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calcule la distance en mètres entre deux points GPS."""
    R = 6371000  # Rayon de la Terre en mètres

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def compare_polylines(poly1, poly2, corridor_width=150):
    """Compare deux polylines et retourne un score de similarité (0-1)."""
    if not poly1 or not poly2 or len(poly1) < 2 or len(poly2) < 2:
        return 0

    # Échantillonner pour accélérer
    sample_rate = max(1, min(len(poly1), len(poly2)) // 30)
    sampled1 = poly1[::sample_rate]
    sampled2 = poly2[::sample_rate]

    match_count = 0
    for p1 in sampled1:
        for p2 in sampled2:
            dist = haversine_distance(p1[0], p1[1], p2[0], p2[1])
            if dist <= corridor_width:
                match_count += 1
                break

    return match_count / len(sampled1) if sampled1 else 0


def activities_match(a1, a2):
    """Vérifie si deux activités correspondent à une sortie commune."""
    # 1. Même catégorie de sport
    if map_sport(a1['sport_type']) != map_sport(a2['sport_type']):
        return False

    # 2. Heure de départ proche (< 60 min)
    t1 = datetime.fromisoformat(a1['start_date'].replace('Z', '+00:00'))
    t2 = datetime.fromisoformat(a2['start_date'].replace('Z', '+00:00'))
    time_diff = abs((t1 - t2).total_seconds()) / 60
    if time_diff > 600:
        return False

    # 3. Durée similaire (< 2h d'écart)
    dur1 = a1.get('moving_time', 0) or 0
    dur2 = a2.get('moving_time', 0) or 0
    if abs(dur1 - dur2) > 7200:
        return False

    # 4. Comparer les polylines si disponibles
    poly1_encoded = a1.get('map', {}).get('summary_polyline')
    poly2_encoded = a2.get('map', {}).get('summary_polyline')

    if poly1_encoded and poly2_encoded:
        poly1 = decode_polyline(poly1_encoded)
        poly2 = decode_polyline(poly2_encoded)
        similarity = compare_polylines(poly1, poly2)
        if similarity < 0.5:
            return False
    else:
        # Sans polyline, vérifier distance et D+ plus strictement
        dist1 = a1.get('distance', 0) or 0
        dist2 = a2.get('distance', 0) or 0
        elev1 = a1.get('total_elevation_gain', 0) or 0
        elev2 = a2.get('total_elevation_gain', 0) or 0

        avg_dist = (dist1 + dist2) / 2
        avg_elev = (elev1 + elev2) / 2

        if avg_dist > 0 and abs(dist1 - dist2) / avg_dist > 0.2:
            return False
        if avg_elev > 0 and abs(elev1 - elev2) / avg_elev > 0.2:
            return False

    return True


def detect_group_activities(activities):
    """Détecte les sorties de groupe (2+ personnes)."""
    # Grouper par jour
    by_day = defaultdict(list)
    for a in activities:
        day = a['start_date'][:10]
        by_day[day].append(a)

    groups = []
    processed_ids = set()

    for day, day_activities in by_day.items():
        if len(day_activities) < 2:
            continue

        # Pour chaque activité, trouver tous les matchs
        activity_matches = defaultdict(set)  # activity_id -> set of matching activity_ids

        for i, a1 in enumerate(day_activities):
            for j, a2 in enumerate(day_activities):
                if i >= j:
                    continue
                if a1['athlete_id'] == a2['athlete_id']:
                    continue

                if activities_match(a1, a2):
                    activity_matches[a1['activity_id']].add(a2['activity_id'])
                    activity_matches[a2['activity_id']].add(a1['activity_id'])

        # Construire les groupes (cliques)
        # Utiliser une approche simple : pour chaque activité avec des matchs,
        # trouver le groupe maximal d'activités qui matchent toutes entre elles

        activity_by_id = {a['activity_id']: a for a in day_activities}
        used_in_group = set()

        for a_id, matches in sorted(activity_matches.items(), key=lambda x: -len(x[1])):
            if a_id in used_in_group:
                continue

            # Commencer un groupe avec cette activité
            group_ids = {a_id}

            # Ajouter les activités qui matchent avec TOUTES les activités du groupe
            for match_id in matches:
                if match_id in used_in_group:
                    continue

                # Vérifier que match_id matche avec tous les membres du groupe
                matches_all = True
                for gid in group_ids:
                    if gid != match_id and match_id not in activity_matches.get(gid, set()):
                        # Vérification directe
                        if not activities_match(activity_by_id[gid], activity_by_id[match_id]):
                            matches_all = False
                            break

                if matches_all:
                    group_ids.add(match_id)

            if len(group_ids) >= 2:
                # Créer le groupe
                group_activities_list = [activity_by_id[gid] for gid in group_ids]

                # Calculer les moyennes
                avg_elevation = sum(a.get('total_elevation_gain', 0) or 0 for a in group_activities_list) / len(
                    group_activities_list)
                avg_duration = sum(a.get('moving_time', 0) or 0 for a in group_activities_list) / len(
                    group_activities_list)
                avg_distance = sum(a.get('distance', 0) or 0 for a in group_activities_list) / len(
                    group_activities_list)

                group = {
                    'id': f"group_{day}_{len(groups)}",
                    'date': day,
                    'athletes': [a['athlete_id'] for a in group_activities_list],
                    'activity_ids': list(group_ids),
                    'sport': group_activities_list[0]['sport_type'],
                    'sport_category': map_sport(group_activities_list[0]['sport_type']),
                    'name': group_activities_list[0].get('name', 'Sortie en groupe'),
                    'elevation': round(avg_elevation),
                    'duration': round(avg_duration),
                    'distance': round(avg_distance),
                    'athlete_count': len(group_ids)
                }

                groups.append(group)
                used_in_group.update(group_ids)

    return groups


def main():
    if len(sys.argv) < 3:
        print("Usage: python precompute_groups.py input.json output.json")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    print(f"Lecture de {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        activities = json.load(f)

    print(f"  {len(activities)} activités chargées")

    # Filtrer les sports exclus
    excluded = ['AlpineSki', 'Snowboard', 'EBikeRide', 'EMountainBikeRide', 'VirtualRide',
                'VirtualRun', 'Sail', 'Kitesurf', 'Swim', 'Yoga', 'WeightTraining',
                'Rowing', 'StandUpPaddling', 'Crossfit', 'HighIntensityIntervalTraining',
                'Workout', 'IceSkate', 'Surfing']

    filtered = [a for a in activities if a.get('sport_type') not in excluded]
    print(f"  {len(filtered)} activités après filtrage")

    print("Détection des sorties de groupe...")
    groups = detect_group_activities(filtered)
    print(f"  {len(groups)} sorties de groupe détectées")

    # Stats
    pairs = sum(1 for g in groups if g['athlete_count'] == 2)
    trios = sum(1 for g in groups if g['athlete_count'] == 3)
    more = sum(1 for g in groups if g['athlete_count'] > 3)
    print(f"  - Duos: {pairs}")
    print(f"  - Trios: {trios}")
    print(f"  - 4+ personnes: {more}")

    # Créer le fichier de sortie avec activités + groupes
    output_data = {
        'activities': activities,  # Garder les activités originales
        'group_activities': groups
    }

    print(f"Écriture de {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False)

    print("Terminé!")

    # Afficher quelques exemples de groupes de 3+
    big_groups = [g for g in groups if g['athlete_count'] >= 3]
    if big_groups:
        print("\nExemples de groupes de 3+ personnes:")
        for g in big_groups[:5]:
            names = [ATHLETE_NAMES.get(aid, str(aid)) for aid in g['athletes']]
            print(f"  - {g['date']}: {', '.join(names)} ({g['sport_category']}) - {g['name'][:40]}")


if __name__ == '__main__':
    main()