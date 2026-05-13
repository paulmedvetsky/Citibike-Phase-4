import pandas as pd
import geopandas as gpd

# -------------------------------------------------------------------------
# 1. LOAD AND FILTER BIKE DATA FROM MULTI-ZONE SURVEY CSV
# -------------------------------------------------------------------------
print("Loading and filtering local trip data file...")
csv_filename = "Data Processing/Citywide_Mobility_Survey_-_Trip_2024_20260513.csv" 
trip_df = pd.read_csv(csv_filename)

trip_df.columns = trip_df.columns.str.lower()

mode_col = "mode_2"
mode_bike_value = 1

# Force mode column to numeric to handle data type variations ('1' vs 1)
trip_df[mode_col] = pd.to_numeric(trip_df[mode_col], errors='coerce')

# Filter for bike trips
bike_trips = trip_df[trip_df[mode_col] == mode_bike_value].copy()
print(f"Total bike trips found in raw data: {len(bike_trips)}")

# -------------------------------------------------------------------------
# 2. DYNAMICALLY MAP RECTIFIED SURVEY ZONE STRING IDS
# -------------------------------------------------------------------------
print("Loading the survey spatial layer to build mapping dictionaries...")
shapefile_path = "Data Processing/Citywide Mobility Survey - Survey Zones_20260513/geo_export_9c75f448-7a1a-4f1f-9e12-455ff80b15f5.shp"
zones_gdf = gpd.read_file(shapefile_path)
zones_gdf.columns = zones_gdf.columns.str.lower()

# Clean spaces and force string titles for standard matching
zones_gdf["cms_zone"] = zones_gdf["cms_zone"].astype(str).str.strip().str.title()

# Generate the 12-zone lookup map dynamically from your local shapefile layout
unique_shape_names = sorted(zones_gdf["cms_zone"].unique())
zone_id_to_name = {str(i + 1): name for i, name in enumerate(unique_shape_names)}

# Clean string IDs from the raw CSV
bike_trips["d_cms_zone"] = pd.to_numeric(bike_trips["d_cms_zone"], errors='coerce').fillna(-1).astype(int).astype(str)
bike_trips["zone_name_string"] = bike_trips["d_cms_zone"].map(zone_id_to_name).fillna("Unknown")

# Tally raw trip volumes across matched zones
trip_counts = bike_trips.groupby("zone_name_string")["trip_id"].count().reset_index()
trip_counts.columns = ["zone_name_string", "bike_trips"]
trip_counts["zone_name_string"] = trip_counts["zone_name_string"].str.strip().str.title()

# Complete attribute match onto spatial zones
zones_with_trips = zones_gdf.merge(trip_counts, left_on="cms_zone", right_on="zone_name_string", how="inner")

# -------------------------------------------------------------------------
# 3. LOAD TARGET NON-CITIBIKE ZIP CODE BOUNDARIES
# -------------------------------------------------------------------------
print("Loading local target zip codes (Non-Citi Bike territory)...")
# Swap the heavy US ZCTA shapefile for your specific, pre-filtered GeoJSON target
target_zip_path = "ZIP_MINUS_CITIBIKE_4326.geojson" 
zip_gdf = gpd.read_file(target_zip_path)
zip_gdf.columns = zip_gdf.columns.str.lower()

# Dynamic check to find your ZIP code field name (handles 'zipcode', 'postalcode', 'zcta5ce20', etc.)
zip_id_col = [col for col in zip_gdf.columns if 'zip' in col or 'post' in col or 'zcta' in col][0]
print(f"Using column '{zip_id_col}' as the primary ZIP identifier.")

# Project layers to NYC Long Island coordinate system (Feet) for exact area processing
zones_with_trips = zones_with_trips.to_crs(epsg=2263) 
zip_gdf = zip_gdf.to_crs(epsg=2263)

# Log parent area measurements before overlay segmentation occurs
zones_with_trips["original_zone_area"] = zones_with_trips.geometry.area

# -------------------------------------------------------------------------
# 4. EXECUTE SPATIAL AREAL INTERPOLATION
# -------------------------------------------------------------------------
print("Slicing geometries and running spatial interpolation calculations...")
intersection = gpd.overlay(zip_gdf, zones_with_trips, how="intersection", keep_geom_type=True)

intersection["intersection_area"] = intersection.geometry.area
intersection["area_ratio"] = intersection["intersection_area"] / intersection["original_zone_area"]
intersection["distributed_trips"] = intersection["bike_trips"] * intersection["area_ratio"]

# Group data to sum overlapping slivers into single totals per target ZIP code
zip_summary = intersection.groupby(zip_id_col)["distributed_trips"].sum().reset_index()
zip_summary["distributed_trips"] = zip_summary["distributed_trips"].fillna(0).round(1)

# -------------------------------------------------------------------------
# 5. GENERATE COMPACT WEB-OPTIMIZED SPATIAL OUTPUT
# -------------------------------------------------------------------------
print("🗜️ Building lightweight, attribute-stripped geometric output layer...")

# Isolate base geometries from your local filtered file to avoid geometric corruption
base_geo_gdf = zip_gdf[[zip_id_col, "geometry"]].copy()

# Simplify layout geometry to drop micro-vertices (25 feet tolerance)
base_geo_gdf["geometry"] = base_geo_gdf["geometry"].simplify(tolerance=25, preserve_topology=False)

# Merge the tabular interpolation results directly back to the slim geometries
final_spatial_gdf = base_geo_gdf.merge(zip_summary, on=zip_id_col, how="inner")

# Project back to Mapbox standard GPS coordinates (WGS84)
final_spatial_gdf = final_spatial_gdf.to_crs(epsg=4326)

# Limit coordinate decimal precision down to 3 positions for extreme payload compression
def truncate_precision(geom):
    if geom is None:
        return None
    from shapely.wkt import loads, dumps
    return loads(dumps(geom, rounding_precision=3))

final_spatial_gdf["geometry"] = final_spatial_gdf["geometry"].apply(truncate_precision)

# Export high-performance GeoJSON map asset
geojson_output_path = "non_citibike_bike_demand.geojson"
final_spatial_gdf.to_file(geojson_output_path, driver="GeoJSON")

print(f"🗺️ Success! High-efficiency map layer saved as: '{geojson_output_path}'")
print("🎉 Pipeline complete. Ready for instant client-side web rendering!")