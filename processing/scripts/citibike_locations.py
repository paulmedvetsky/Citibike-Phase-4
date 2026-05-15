import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

input_csv = "202604-citibike-tripdata-part1.csv" #I'm using the most recent complete published file to capture the fullest extent of the system as of May 10, 2026.
output_geojson = "citibike_locations.geojson" #The file I will ultimately incorporate into the map.

print("Extracting unique station locations from CSV...")
start_coords = set()
end_coords = set()

try:
    sample_df = pd.read_csv(input_csv, nrows=5)
    print(f"Available columns: {list(sample_df.columns)}")

    # Read start coordinates
    for chunk in pd.read_csv(input_csv, usecols=['start_lng', 'start_lat'], chunksize=100000):
        chunk = chunk.dropna()
        start_coords.update(zip(chunk['start_lng'], chunk['start_lat']))

    # Read end coordinates
    for chunk in pd.read_csv(input_csv, usecols=['end_lng', 'end_lat'], chunksize=100000):
        chunk = chunk.dropna()
        end_coords.update(zip(chunk['end_lng'], chunk['end_lat']))

    all_unique_coords = start_coords.union(end_coords)
    print(f"Total unique station locations: {len(all_unique_coords)}")

    geometry = [Point(xy) for xy in all_unique_coords]
    gdf = gpd.GeoDataFrame(geometry=geometry, crs="EPSG:4326") #This seems to be the CRS of the original coordinate data from the csv. Bummer.

    print("Projecting to EPSG:2263...")
    gdf_projected = gdf.to_crs(epsg=2263)

    print(f"Saving to {output_geojson}...")
    gdf_projected.to_file(output_geojson, driver='GeoJSON')
    print("Success!")

except FileNotFoundError: #Remnant from earlier chatbot output. If I remove it, the try statement fails.
    print(f"Error: File '{input_csv}' not found. Please ensure the CSV file is in the same directory.") 