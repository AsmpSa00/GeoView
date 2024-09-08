from flask import Flask, jsonify
from skyfield.api import load, EarthSatellite
from datetime import timedelta, datetime
import requests

app = Flask(__name__)
ts = load.timescale()

# Headers for the API request
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
}

@app.route('/get_positions/<sat_id>')
def get_positions(sat_id):
    try:
        # Fetch TLE data from the API
        response = requests.get(f'https://tle.ivanstanojevic.me/api/tle/{sat_id}', headers=HEADERS)
        response.raise_for_status()  # Raise an error for bad status codes
        tle_data = response.json()

        # Check if TLE data contains required keys
        if 'line1' not in tle_data or 'line2' not in tle_data or 'name' not in tle_data:
            return jsonify({"error": "Invalid TLE data received"}), 500

        # Create EarthSatellite object
        satellite = EarthSatellite(tle_data['line1'], tle_data['line2'], tle_data['name'], ts)

        # Calculate satellite positions every 2 hours for the next 3 days
        t_now = ts.now()
        t_end = t_now + timedelta(days=3)

        times = []
        current_time = t_now
        while current_time < t_end:
            times.append(current_time)
            current_time = current_time + timedelta(hours=2)

        positions = [{
            'time': time.utc_iso(),
            'latitude': satellite.at(time).subpoint().latitude.degrees,
            'longitude': satellite.at(time).subpoint().longitude.degrees
        } for time in times]

        return jsonify(positions)
    except requests.RequestException as e:
        return jsonify({"error": f"Error fetching TLE data: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Error processing data: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)