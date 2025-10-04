from flask import Flask, render_template, request, jsonify
from helpers import get_routes, haversine, parse_location

app = Flask(__name__)

# ---------------- MOCK nearby charging station generator ----------------
def generate_mock_stations(route_coords, num_stations=15):
    stations = []
    n = len(route_coords)
    for i in range(1, num_stations+1):
        idx = int(i * n / (num_stations+1))
        stations.append({
            "coords": route_coords[idx],
            "name": f"Charging Station {i}",
            "distance": 0
        })
    return stations

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/plan_route", methods=["POST"])
def plan_route():
    data = request.json
    try:
        charge = float(data.get("charge", 100))
        full_range = float(data.get("range", 300))
        start = parse_location(data.get("start"))
        end = parse_location(data.get("end"))

        routes = get_routes(start, end)
        if not routes:
            return jsonify({"error": "No valid routes"}), 400

        best = min(routes, key=lambda r: float(r["distance"]))
        coords_list = best["coords"]

        # ---------------- Required charging stops ----------------
        required_stops = []
        remaining_range = (charge / 100) * full_range
        dist_traveled = 0

        for i in range(1, len(coords_list)):
            seg = haversine(coords_list[i-1], coords_list[i])
            dist_traveled += seg
            remaining_range -= seg
            if remaining_range <= 0:
                stop_point = coords_list[i-1]
                required_stops.append({
                    "coords": stop_point,
                    "name": "Required Charging Stop",
                    "distance_from_last": dist_traveled,
                    "remaining_charge": max(0,(remaining_range/full_range)*100)
                })
                remaining_range = full_range
                dist_traveled = 0

        # ---------------- Nearby stations along route ----------------
        nearby_stations = generate_mock_stations(coords_list, num_stations=15)

        # ---------------- Battery profile for gradient ----------------
        battery_profile = []
        remaining_range = (charge / 100) * full_range
        for i, pt in enumerate(coords_list):
            if i == 0:
                battery_profile.append(remaining_range / full_range * 100)
                continue
            seg = haversine(coords_list[i-1], coords_list[i])
            remaining_range -= seg
            if remaining_range < 0:
                remaining_range = full_range  # recharge at required stop
            battery_profile.append(remaining_range / full_range * 100)

        return jsonify({
            "best_route": best,
            "all_routes": routes,
            "required_stops": required_stops or [],
            "nearby_stations": nearby_stations or [],
            "battery_profile": battery_profile
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
