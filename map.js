document.addEventListener('DOMContentLoaded', function () {
    var mymap = L.map('mapid').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mymap);
    var drawnItems = new L.FeatureGroup();
    mymap.addLayer(drawnItems);
    var drawControl = new L.Control.Draw({ edit: { featureGroup: drawnItems } });
    mymap.addControl(drawControl);

    var satellitePaths = {};
    var satelliteMarkers = {};
    var updateInterval = 30000; // 30 seconds

    mymap.on(L.Draw.Event.CREATED, function (event) {
        var layer = event.layer;
        drawnItems.addLayer(layer);
        if (event.layerType === 'polygon') {
            var latlngs = layer.getLatLngs()[0];
            var area = L.GeometryUtil.geodesicArea(latlngs);
            alert(`Area: ${area.toFixed(2)} square meters`);
            fetchWeatherDataByCoordinates(latlngs[0].lat, latlngs[0].lng);
        }
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            var satId = this.getAttribute('data-satid');
            var isChecked = this.checked;
            if (isChecked) {
                addSatellite(satId);
            } else {
                removeSatellite(satId);
            }
        });
    });

    async function addSatellite(satId) {
        if (satelliteMarkers[satId]) {
            clearInterval(satelliteMarkers[satId].interval);
        }
        var positions = await fetchSatellitePositions(satId);
        if (positions) {
            drawSatellitePath(positions, satId);
            await updateSatellitePosition(satId); // Fetch the initial position
            satelliteMarkers[satId].interval = setInterval(() => updateSatellitePosition(satId), updateInterval);
        }
    }

    function removeSatellite(satId) {
        if (satelliteMarkers[satId]) {
            clearInterval(satelliteMarkers[satId].interval);
            mymap.removeLayer(satelliteMarkers[satId].marker);
            mymap.removeLayer(satellitePaths[satId]);
            delete satelliteMarkers[satId];
            delete satellitePaths[satId];
        }
    }

    async function fetchSatellitePositions(satId) {
        try {
            var response = await fetch(`/api/satellite-positions/${satId}`);
            var data = await response.json();
            if (data.error) {
                console.error(data.error);
                return null;
            }
            return data.map(pos => [pos.latitude, pos.longitude]);
        } catch (error) {
            console.error('Error fetching satellite positions:', error);
            return null;
        }
    }

    async function updateSatellitePosition(satId) {
        try {
            var response = await fetch(`/api/satellite-positions/${satId}`);
            var data = await response.json();
            if (data.error) {
                console.error(data.error);
                return;
            }

            var latestPosition = data[0];
            var latLng = [latestPosition.latitude, latestPosition.longitude];

            if (satelliteMarkers[satId]) {
                satelliteMarkers[satId].marker.setLatLng(latLng);
            } else {
                var marker = L.marker(latLng).addTo(mymap).bindPopup(satId);
                satelliteMarkers[satId] = { marker: marker };
            }
        } catch (error) {
            console.error('Error fetching satellite position:', error);
        }
    }

    function drawSatellitePath(positions, satId) {
        if (satellitePaths[satId]) {
            mymap.removeLayer(satellitePaths[satId]);
        }
        const path = L.polyline(positions, { color: getRandomColor() }).addTo(mymap);
        mymap.fitBounds(path.getBounds());
        satellitePaths[satId] = path;
    }

    function getRandomColor() {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    document.getElementById('get-weather-btn').addEventListener('click', function() {
        var city = document.getElementById('city-input').value;
        if (city) {
            fetchWeatherDataByCity(city);
        }
    });

    function fetchWeatherDataByCoordinates(lat, lon) {
        const urls = [
            `http://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=civillight&output=json`,
            `http://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=meteo&output=json`
        ];
        Promise.all(urls.map(url => fetch(url).then(response => response.json()))).then(values => {
            const [civillight, meteo] = values;
            let forecastHTML = '<h3 style="color: white;">Weather Forecast</h3>';
            for (let i = 0; i < 3; i++) {
                const maxTemp = civillight.dataseries[i].temp2m.max;
                const minTemp = civillight.dataseries[i].temp2m.min;
                const cloudCover = meteo.dataseries[i].cloudcover;
                forecastHTML += `<p style="color: white;">Day ${i + 1}: Cloud Cover: ${cloudCover}%, Max Temp: ${maxTemp}°C, Min Temp: ${minTemp}°C</p>`;
            }
            document.getElementById('weather-info').innerHTML = forecastHTML;
        }).catch(error => {
            console.error('Error fetching weather data:', error);
        });
    }

    function fetchWeatherDataByCity(city) {
        const apiKey = 'YOUR_API_KEY'; // Replace with your actual API key
        const url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                displayWeather(data);
            })
            .catch(error => {
                console.error('Error fetching weather data:', error);
            });
    }

    function displayWeather(data) {
        const weatherInfo = document.getElementById('weather-info');
        weatherInfo.innerHTML = `
            <h3 style="color: white;">Weather in ${data.name}</h3>
            <p style="color: white;">Temperature: ${data.main.temp}°C</p>
            <p style="color: white;">Weather: ${data.weather[0].description}</p>
            <p style="color: white;">Humidity: ${data.main.humidity}%</p>
            <p style="color: white;">Wind Speed: ${data.wind.speed} m/s</p>
        `;
    }
});