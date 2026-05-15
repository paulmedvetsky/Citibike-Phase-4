import pandas as pd
import geopandas as gpd
import json
import re
from pathlib import Path

PLUTO_CSV = "Data Processing/pluto_25v4.csv"
ZCTA_SHP = "Data Processing/tl_2020_us_zcta520.shp"
OUTPUT_GEOJSON = "Data Processing/land_use_by_zip.geojson"

LANDUSE_LABELS = {
    "01": "One & Two Family",
    "02": "Multi-Family Walk-Up",
    "03": "Multi-Family Elevator",
    "04": "Mixed Residential & Commercial",
    "05": "Commercial & Office",
    "06": "Industrial",
    "07": "Transportation & Utility",
    "08": "Public Facilities & Institutions",
    "09": "Open Space & Outdoor Recreation",
    "10": "Parking Facilities",
    "11": "Vacant Land",
}

def load_pluto(path: str) -> pd.DataFrame:
    print(f"Loading PLUTO data from {path}...")
    df = pd.read_csv(path, dtype=str, low_memory=False)
    
    df.columns = df.columns.str.strip()
    col_map = {c: c.lower() for c in df.columns}
    df = df.rename(columns=col_map)
    
    required = {"zipcode", "landuse", "builtfar", "bldgarea"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns in PLUTO data: {missing}")
    
    df["lotarea"] = pd.to_numeric(df["lotarea"], errors="coerce").fillna(0)
    df["bldgarea"] = pd.to_numeric(df["bldgarea"], errors="coerce").fillna(0)
    df["builtfar"] = pd.to_numeric(df["builtfar"], errors="coerce").fillna(0)
    
    df["landuse"] = (
        df["landuse"]
        .str.strip()
        .str.zfill(2)
    )
    
    print (f" {len(df):,} parcels loaded.")
    return df

def aggregate_by_zip(df: pd.DataFrame) -> pd.DataFrame:
    print("Aggregating by ZIP code...")
    
    totals = (
        df.groupby("zipcode", as_index=False)
        .agg(
            total_parcels=("lotarea", "count"),
            total_lot_area=("lotarea", "sum"),
            total_bldg_area=("bldgarea", "sum"),
            total_built_far=("builtfar", "sum")
        )
    )
    
    totals["avg_far"] = (
        totals["total_bldg_area"] / totals["total_lot_area"].replace(0, float("nan"))
    ).round(2)
    
    pivot = (
        df.groupby(["zipcode", "landuse"])["lotarea"]
        .sum()
        .unstack(fill_value=0)
        .reset_index()
    )
    
    keep_codes = [c for c in LANDUSE_LABELS if c in pivot.columns]
    rename_map = {c: f"lu_{LANDUSE_LABELS[c].lower().replace('/', '_').replace(' ', '_')}"
                  for c in keep_codes}
    pivot = pivot[["zipcode"] + keep_codes].rename(columns=rename_map)
    
    result = totals.merge(pivot, on="zipcode", how="left")
    
    lu_cols = [c for c in result.columns if c.startswith("lu_")]
    if lu_cols:
        result["dominant_landuse"] = result[lu_cols].idxmax(axis='columns').astype(str).str.replace("lu_", "", regex=False)
        
    for col in lu_cols:
        result[f"pct_{col[3:]}"] = (
            result[col] / result["total_lot_area"].replace(0, float("nan")) * 100
        ).round(4).fillna(0)
        
    print(f" {len(result):,} ZIP codes aggregated.")
    return result

def load_zcta(path: str) -> gpd.GeoDataFrame:
    print(f"Loading ZCTA shapefile from {path}...")
    gdf = gpd.read_file(path)
    
    zip_col = None
    for candidate in ["ZCTA5CE20", "ZCTA5CE10", "GEOID20", "GEOID10", "ZCTA5"]:
        if candidate in gdf.columns:
            zip_col = candidate
            break
    if zip_col is None:
        for col in gdf.columns:
            sample = gdf[col].dropna().astype(str)
            if sample.str.match(r"^\d{5}$").mean() > 0.9:
                zip_col = col
                break
    if zip_col is None:
        raise ValueError("Could not find ZIP code column in ZCTA shapefile.")
    
    gdf = gdf.rename(columns={zip_col: "zipcode"})
    gdf["zipcode"] = gdf["zipcode"].astype(str).str.strip().str.zfill(5)
    
    if gdf.crs is None or gdf.crs.to_epsg() != 4326:
        print(" Reprojecting to WGS 84...")
        gdf = gdf.to_crs(epsg=4326)
        
    gdf = gdf[["zipcode", "geometry"]].copy()
    print(f" {len(gdf):,} ZCTAs loaded.")
    return gdf

def filter_nyc_zips(gdf: gpd.GeoDataFrame, pluto_zips: set) -> gpd.GeoDataFrame:
    filtered = gdf[gdf["zipcode"].isin(pluto_zips)].copy()
    print(f"Filtered to {len(filtered):,} NYC ZIP codes.")
    return filtered

def simplify_geometry(gdf: gpd.GeoDataFrame, tolerance: float = 0.001) -> gpd.GeoDataFrame:
    gdf = gdf.copy()
    gdf["geometry"] = gdf["geometry"].simplify(tolerance, preserve_topology=True)
    return gdf

def export_geojson(gdf: gpd.GeoDataFrame, path: str) -> None:
    print(f"Exporting to GeoJSON at {path}...")
    gdf.to_file(path, driver="GeoJSON")
    
    with open(path) as f:
        raw = f.read()
        
    def round_coords(match):
        return str(round(float(match.group()), 5))

    rounded = re.sub(r"-?\d+\.\d{6,}", round_coords, raw)
    
    with open(path, "w") as f:
        f.write(rounded)
        
    size_kb = Path(path).stat().st_size / 1024
    print(f"Exported GeoJSON size: {size_kb:.2f} KB")
    
def main():
    pluto_df = load_pluto(PLUTO_CSV)
    zip_agg = aggregate_by_zip(pluto_df)
    
    zcta_gdf = load_zcta(ZCTA_SHP)
    nyc_zcta_gdf = filter_nyc_zips(zcta_gdf, set(zip_agg["zipcode"]))
    
    merged_gdf = nyc_zcta_gdf.merge(zip_agg, on="zipcode", how="left")
    
    simplified_gdf = simplify_geometry(merged_gdf, tolerance=0.001)
    
    drop_cols = [c for c in simplified_gdf.columns if c.startswith("lu_")]
    final_gdf = simplified_gdf.drop(columns=drop_cols)
    
    export_geojson(final_gdf, OUTPUT_GEOJSON)
    print("\\Done!")
    for col in final_gdf.columns:
        if col != "geometry":
            print(f" {col}")
            
if __name__ == "__main__":
    main()