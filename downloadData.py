import openmeteo_requests
import pandas as pd
from retry import retry

# 1. Setup the API client with retry on error
retry_session = openmeteo_requests.ClientSession(retries = 5, backoff_factor = 0.2)
openmeteo = openmeteo_requests.Client(session = retry_session)

# 2. Define coordinates (Kampala) and parameters
# We request weather, solar (light), and soil moisture in one call
url = "https://open-meteo.com"
params = {
	"latitude": 0.3163,
	"longitude": 32.5822,
	"start_date": "2020-01-01",
	"end_date": "2026-07-05",
	"hourly": [
        "temperature_2m", 
        "relative_humidity_2m", 
        "rain", 
        "surface_pressure", 
        "wind_speed_10m", 
        "wind_direction_10m", 
        "shortwave_radiation", 
        "soil_moisture_0_to_7cm"
    ],
	"timezone": "Africa/Kampala"
}

# 3. Fetch data from API
responses = openmeteo.weather_api(url, params=params)
response = responses[0]

# 4. Extract location metadata (Altitude)
altitude = response.Elevation()

# 5. Process hourly data
hourly = response.Hourly()
hourly_data = {
    "timestamp": pd.date_range(
        start = pd.to_datetime(hourly.Time(), unit = "s", utc = True),
        end = pd.to_datetime(hourly.TimeEnd(), unit = "s", utc = True),
        freq = pd.Timedelta(seconds = hourly.Interval()),
        inclusive = "left"
    )
}

# 6. Map Open-Meteo data directly to your requested fields
hourly_data["pressure"] = hourly.Variables(3).ValuesAsNumpy()      # surface_pressure
hourly_data["altitude"] = altitude                                # Static altitude for location
hourly_data["temperature"] = hourly.Variables(0).ValuesAsNumpy()   # temperature_2m
hourly_data["humidity"] = hourly.Variables(1).ValuesAsNumpy()      # relative_humidity_2m
hourly_data["light"] = hourly.Variables(6).ValuesAsNumpy()         # shortwave_radiation
hourly_data["soil_moisture"] = hourly.Variables(7).ValuesAsNumpy() # soil_moisture_0_to_7cm
hourly_data["rain"] = hourly.Variables(2).ValuesAsNumpy()          # rain
hourly_data["wind_speed"] = hourly.Variables(4).ValuesAsNumpy()    # wind_speed_10m
hourly_data["wind_direction"] = hourly.Variables(5).ValuesAsNumpy()# wind_direction_10m

# 7. Convert to DataFrame and preview
df = pd.DataFrame(data = hourly_data)

# Localize timestamp to Uganda time and remove timezone offset string for clean ML formatting
df['timestamp'] = df['timestamp'].dt.tz_convert('Africa/Kampala').dt.tz_localize(None)

# Save to CSV for your model
df.to_csv("uganda_weather_dataset.csv", index=False)
print("Dataset successfully created! Columns:")
print(df.columns.tolist())
print(df.head())




