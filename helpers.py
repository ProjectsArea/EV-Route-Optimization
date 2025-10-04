import requests
import math
from geopy.geocoders import Nominatim
import time

geolocator = Nominatim(user_agent="ev_route_app")

TOMTOM_API_KEY = "UdQFxUibHzEsShySuY96wlJAK6BhzJvX"
ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjlmZGUxMmNmNWU3YjQxNWNiOGM4NTI3NDhjOGM2NzA0IiwiaCI6Im11cm11cjY0In0="
OCM_API_KEY = "931d4ae3-014a-4ac1-8c4c-d1aa244c42de"

# ---------------- Safe coordinate parsing ----------------
def safe_float_coords(pt):
    """Converts pt to [lat, lon] floats, returns None if invalid"""
    if isinstance(pt, (list, tuple)) and len(pt) == 2:
        try:
            lat = float(pt[0])
            lon = float(pt[1])
            return [lat, lon]
        except:
            return None
    return None

# ---------------- Parse start/end location ----------------
def parse_location(value):
    if isinstance(value, list) and len(value) == 2:
        return safe_float_coords(value)
    if "," in value:
        try:
            parts = [float(x.strip()) for x in value.split(",")]
            if len(parts) == 2:
                return parts
        except:
            pass
    loc = geolocator.geocode(value, timeout=10)
    if loc:
        return [float(loc.latitude), float(loc.longitude)]
    raise ValueError(f"Could not resolve location: {value}")

# ---------------- Haversine distance ----------------
def haversine(a, b):
    a = safe_float_coords(a)
    b = safe_float_coords(b)
    if a is None or b is None:
        return 0
    R = 6371.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    aa = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(aa), math.sqrt(1-aa))

# ---------------- Mock route (always valid) ----------------
def mock_route(start, end, n=20):
    start = safe_float_coords(start)
    end = safe_float_coords(end)
    if not start or not end:
        return []
    lat_step = (end[0] - start[0]) / (n + 1)
    lon_step = (end[1] - start[1]) / (n + 1)
    route = [start] + [[start[0]+i*lat_step, start[1]+i*lon_step] for i in range(1,n+1)] + [end]
    dist = sum(haversine(route[i], route[i+1])*1000 for i in range(len(route)-1))
    dur = dist / (40*1000/3600)
    return [{"coords": route, "distance": dist, "duration": dur}]

# ---------------- TomTom route ----------------
def tomtom_route(start, end):
    try:
        url = f"https://api.tomtom.com/routing/1/calculateRoute/{start[0]},{start[1]}:{end[0]},{end[1]}/json?key={TOMTOM_API_KEY}&routeType=fastest&traffic=true&alternatives=2"
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        routes = []
        for route in data.get("routes", []):
            coords = []
            for leg in route.get("legs", []):
                for pt in leg.get("points", []):
                    c = safe_float_coords([pt.get("latitude"), pt.get("longitude")])
                    if c:
                        coords.append(c)
            if coords:
                routes.append({
                    "coords": coords,
                    "distance": float(route.get("summary", {}).get("lengthInMeters",0)),
                    "duration": float(route.get("summary", {}).get("travelTimeInSeconds",0))
                })
        return routes if routes else None
    except:
        return None

# ---------------- ORS route ----------------
def ors_route(start, end):
    try:
        url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
        headers = {"Authorization": ORS_API_KEY, "Content-Type": "application/json"}
        body = {"coordinates": [[float(start[1]), float(start[0])], [float(end[1]), float(end[0])]]}
        r = requests.post(url, json=body, headers=headers, timeout=10)
        r.raise_for_status()
        data = r.json()
        routes = []
        for feat in data.get("features", []):
            coords = [safe_float_coords([c[1], c[0]]) for c in feat.get("geometry", {}).get("coordinates", [])]
            coords = [c for c in coords if c is not None]
            if coords:
                segs = feat.get("properties", {}).get("segments", [])
                distance = float(segs[0].get("distance",0)) if segs else 0
                duration = float(segs[0].get("duration",0)) if segs else 0
                routes.append({"coords": coords, "distance": distance, "duration": duration})
        return routes if routes else None
    except:
        return None

# ---------------- Get routes safely ----------------
def get_routes(start, end):
    routes = tomtom_route(start, end)
    if routes: return routes
    routes = ors_route(start, end)
    if routes: return routes
    return mock_route(start, end)

# ---------------- OpenChargeMap ----------------
charging_cache = {}
def find_nearby_charging(lat, lon, max_distance_km=5):
    c = safe_float_coords([lat, lon])
    if not c: return []
    lat, lon = c
    try:
        url = f"https://api.openchargemap.io/v3/poi/?key={OCM_API_KEY}&latitude={lat}&longitude={lon}&distance={max_distance_km}&distanceunit=KM&maxresults=5"
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        stations = []
        for st in data:
            c = safe_float_coords([st["AddressInfo"]["Latitude"], st["AddressInfo"]["Longitude"]])
            if c:
                stations.append({
                    "name": st.get("AddressInfo", {}).get("Title", "Unknown"),
                    "coords": c,
                    "power": float(st.get("Connections", [{}])[0].get("PowerKW", 0))
                })
        return stations
    except:
        return []

def find_nearby_charging_cached(lat, lon, max_distance_km=5):
    key = (round(float(lat),4), round(float(lon),4))
    if key in charging_cache:
        return charging_cache[key]
    stations = find_nearby_charging(lat, lon, max_distance_km)
    charging_cache[key] = stations
    time.sleep(0.2)
    return stations
