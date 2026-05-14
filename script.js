mapboxgl.accessToken = 'pk.eyJ1IjoicGVtOTg2NCIsImEiOiJjbW5pMnV5cGYwOTFiMnJwa2NyYWU3YXh1In0.BWPtfe9Zo5Oe5WUpglzvYw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  config: {
    basemap: {
      lightPreset: "day",
      theme: "faded",
      showAdminBoundaries: false,
      showRoadLabels: false,
      showPlaceLabels: false,
      showPointOfInterestLabels: false,
      font: "Roboto",
    }
  },
  center: [-74.01755, 40.70304],
  zoom: 10,
  minZoom: 10,
  maxZoom: 15,
  maxBounds: [[-75, 40], [-73.5, 41]],
  bearing: 0.00,
  pitch: 0.00,
});

const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false });

// Header fades out as the user zooms in past the 50% mark of the zoom range (10–15)
function updateHeaderOpacity() {
  const MIN_ZOOM = 10;
  const FADE_END_ZOOM = 12.5; // 50% of the 10–15 range
  const zoom = map.getZoom();
  const opacity = Math.max(0, Math.min(1, 1 - (zoom - MIN_ZOOM) / (FADE_END_ZOOM - MIN_ZOOM)));
  const header = document.getElementById('map-header');
  if (header) {
    header.style.opacity = opacity;
  }
}

map.on('zoom', updateHeaderOpacity);

map.on('load', () => {
  updateHeaderOpacity();

  map.addSource('bike-routes', {
    type: 'geojson',
    data: './New_York_City_Bike_Routes_20260512.geojson'
  });

  map.addSource('outside-citibike', {
    type: 'geojson',
    data: './ZIP_MINUS_CITIBIKE_4326.geojson'
  });

  map.addSource('citibike-stations', {
    type: 'geojson',
    data: './citibike_locations_4326.geojson'
  });

  map.addSource('land-use', {
    type: 'geojson',
    data: './land_use_by_zip.geojson'
  });

  map.addSource('bike-trips', {
    type: 'geojson',
    data: './non_citibike_bike_demand.geojson'
  });

  map.addSource('selected-zip', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  const firstSymbolLayer = map.getStyle().layers.find(l => l.type === 'symbol');
  const insertBeforeLayer = firstSymbolLayer ? firstSymbolLayer.id : undefined;
  const insertLayer = (spec) => {
    insertBeforeLayer ? map.addLayer(spec, insertBeforeLayer) : map.addLayer(spec);
  };

  // Always-visible outside CitiBike fill (subtle amber tint)
  insertLayer({
    id: 'outside-citibike-fill',
    type: 'fill',
    source: 'outside-citibike',
    slot: 'bottom',
    layout: { visibility: 'visible' },
    paint: {
      'fill-color': '#c8a000',
      'fill-opacity': 0.12,
      'fill-antialias': true
    }
  });

  // Always-visible outside CitiBike border (thick, dark amber)
  insertLayer({
    id: 'outside-citibike-line',
    type: 'line',
    source: 'outside-citibike',
    slot: 'bottom',
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#7a5e00',
      'line-width': 2.5,
      'line-opacity': 1.0
    }
  });

  // NYC zipcode validation filter
  const nycZipcodeFilter = [
    'any',
    ['>=', ['to-number', ['get', 'zipcode']], 10001],
    ['all', ['<=', ['to-number', ['get', 'zipcode']], 10282]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 10301], ['<=', ['to-number', ['get', 'zipcode']], 10314]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 10451], ['<=', ['to-number', ['get', 'zipcode']], 10475]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 11201], ['<=', ['to-number', ['get', 'zipcode']], 11256]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 11354], ['<=', ['to-number', ['get', 'zipcode']], 11428]]
  ];

  // Bike routes (toggleable, starts off)
  insertLayer({
    id: 'bike-routes-line',
    type: 'line',
    source: 'bike-routes',
    slot: 'line',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#0ee941',
      'line-width': 1.25,
      'line-opacity': 0.75,
      'line-join': 'round',
      'line-cap': 'round'
    }
  });

  // Land use fill (toggleable, starts off)
  insertLayer({
    id: 'land-use-fill',
    type: 'fill',
    source: 'land-use',
    filter: nycZipcodeFilter,
    slot: 'line',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'interpolate', ['exponential', 1.2], ['get', 'avg_far'],
        0, '#fff8e1',
        0.5, '#ffe4a6',
        1.0, '#ffd966',
        2.0, '#ffbf5d',
        4.0, '#ff9c33',
        7.0, '#ff7a14',
        12.0, '#ff5213',
        18.0, '#e63e0d',
        31.51, '#b32600'
      ],
      'fill-opacity': [
        'interpolate', ['exponential', 1.5], ['get', 'avg_far'],
        0, 0.85,
        1.0, 0.72,
        2.0, 0.58,
        4.0, 0.45,
        8.0, 0.32,
        15.0, 0.24,
        31.51, 0.18
      ],
      'fill-outline-color': '#999999',
      'fill-antialias': true
    }
  });

  // CitiBike stations (toggleable, starts off)
  insertLayer({
    id: 'citibike-stations-circle',
    type: 'circle',
    source: 'citibike-stations',
    slot: 'top',
    layout: { visibility: 'none' },
    paint: {
      'circle-color': 'rgba(176, 168, 168, 0.8)',
      'circle-radius': 2.5,
      'circle-stroke-color': 'rgba(255, 255, 255, 0.8)',
      'circle-stroke-width': 0.5,
      'circle-opacity': 0.7
    }
  });

  // Bike trips (toggleable, starts off)
  insertLayer({
    id: 'bike-trips',
    type: 'fill',
    source: 'bike-trips',
    slot: 'line',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'interpolate', ['exponential', 1.5], ['get', 'distributed_trips'],
        0, '#e0f7fa',
        8, '#b2ebf2',
        16, '#80deea',
        32, '#4dd0e1',
        64, '#26c6da',
        128, '#00bcd4',
        256, '#00acc1',
        512, '#0097a7',
        1024, '#00838f'
      ],
      'fill-opacity': [
        'interpolate', ['exponential', 1.5], ['get', 'distributed_trips'],
        0, 0.85,
        8, 0.72,
        16, 0.58,
        32, 0.45,
        64, 0.32,
        128, 0.24,
        256, 0.18,
        512, 0.12,
        1024, 0.08
      ],
      'fill-outline-color': '#999999',
      'fill-antialias': true
    }
  });

  // Selected zip code highlight outline (top of stack)
  map.addLayer({
    id: 'selected-zip-outline',
    type: 'line',
    source: 'selected-zip',
    slot: 'top',
    paint: {
      'line-color': '#FFD700',
      'line-width': 3.5,
      'line-opacity': 0.95
    }
  });

  // --- Legend / Layer Control ---
  const control = document.createElement('div');
  control.className = 'mapboxgl-ctrl mapboxgl-ctrl-group legend-control';
  map.getContainer().appendChild(control);

  control.innerHTML = `
    <strong class="legend-title">Map Layers</strong>

    <label class="legend-row">
      <input type="checkbox" id="toggle-bike-routes" class="legend-checkbox" style="accent-color:#0aa830;" />
      <span class="legend-swatch" style="height:5px; background:#0ee941;"></span>
      Bike Routes
    </label>

    <label class="legend-row">
      <input type="checkbox" id="toggle-citibike-stations" class="legend-checkbox" style="accent-color:#777;" />
      <span class="legend-swatch" style="width:13px;height:13px;border-radius:50%;background:rgba(176,168,168,0.9);box-shadow:0 0 0 1.5px #aaa;"></span>
      CitiBike Stations
    </label>

    <label class="legend-row">
      <input type="checkbox" id="toggle-land-use" class="legend-checkbox" style="accent-color:#e06000;" />
      <span class="legend-swatch" style="background:linear-gradient(to right,#fff8e1,#b32600);border:1px solid #ccc;"></span>
      Land Use Density
      <span class="layer-info-icon">?<span class="tooltip-text">Placeholder text — fill in later about land use density.</span></span>
    </label>

    <label class="legend-row">
      <input type="checkbox" id="toggle-bike-trips" class="legend-checkbox" style="accent-color:#007a9e;" />
      <span class="legend-swatch" style="background:linear-gradient(to right,#e0f7fa,#00838f);border:1px solid #ccc;"></span>
      Bike Trip Demand
    </label>

    <div class="legend-static">
      <span class="legend-swatch" style="background:#c8a000;border:2px solid #7a5e00;flex-shrink:0;"></span>
      <div>
        <strong style="font-size:1.04rem;">Outside CitiBike Network</strong>
        <div class="legend-static-sub">ZIP codes outside CitiBike coverage</div>
      </div>
    </div>
  `;

  // Update outside-citibike opacity based on whether any layer is active
  function updateOutsideCitibikeOpacity() {
    const anyActive = ['toggle-bike-routes', 'toggle-citibike-stations', 'toggle-land-use', 'toggle-bike-trips']
      .some(id => document.getElementById(id)?.checked);
    map.setPaintProperty('outside-citibike-fill', 'fill-opacity', anyActive ? 0.04 : 0.12);
    map.setPaintProperty('outside-citibike-line', 'line-opacity', anyActive ? 0.2 : 1.0);
  }

  document.getElementById('toggle-bike-routes').addEventListener('change', (e) => {
    map.setLayoutProperty('bike-routes-line', 'visibility', e.target.checked ? 'visible' : 'none');
    updateOutsideCitibikeOpacity();
  });

  document.getElementById('toggle-citibike-stations').addEventListener('change', (e) => {
    map.setLayoutProperty('citibike-stations-circle', 'visibility', e.target.checked ? 'visible' : 'none');
    updateOutsideCitibikeOpacity();
  });

  document.getElementById('toggle-land-use').addEventListener('change', (e) => {
    map.setLayoutProperty('land-use-fill', 'visibility', e.target.checked ? 'visible' : 'none');
    updateOutsideCitibikeOpacity();
  });

  document.getElementById('toggle-bike-trips').addEventListener('change', (e) => {
    map.setLayoutProperty('bike-trips', 'visibility', e.target.checked ? 'visible' : 'none');
    updateOutsideCitibikeOpacity();
  });

  // Classification helpers
  const classifyDensity = (avgFar) => {
    if (avgFar < 0.65) return 'Low';
    if (avgFar < 1.82) return 'Medium';
    return 'High';
  };

  const classifyBikeDemand = (trips) => {
    if (trips < 16) return 'Low';
    if (trips < 38) return 'Medium';
    return 'High';
  };

  // Recursively compute bounding box from any GeoJSON geometry
  function getFeatureBounds(feature) {
    const bounds = new mapboxgl.LngLatBounds();
    function extend(coords) {
      if (typeof coords[0] === 'number') {
        bounds.extend(coords);
      } else {
        coords.forEach(extend);
      }
    }
    extend(feature.geometry.coordinates);
    return bounds;
  }

  // Clear highlight when popup is closed
  popup.on('close', () => {
    map.getSource('selected-zip').setData({ type: 'FeatureCollection', features: [] });
  });

  // Unified click handler — queries whichever zip code layers are currently visible
  map.on('click', (event) => {
    const visibleQueryLayers = ['bike-trips', 'land-use-fill'].filter(id => {
      try { return map.getLayoutProperty(id, 'visibility') === 'visible'; }
      catch (e) { return false; }
    });

    if (visibleQueryLayers.length === 0) return;

    const features = map.queryRenderedFeatures(event.point, { layers: visibleQueryLayers });

    if (features.length === 0) {
      map.getSource('selected-zip').setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Keep first feature per layer (topmost rendered feature)
    const byLayer = {};
    features.forEach(f => {
      if (!byLayer[f.layer.id]) byLayer[f.layer.id] = f;
    });

    const primaryFeature = byLayer['bike-trips'] || byLayer['land-use-fill'];
    const zipcode = primaryFeature.properties.zipcode || 'Unknown';

    let html = `<div style="font-family:sans-serif;font-size:14px;min-width:160px;">
      <strong style="font-size:15px;display:block;margin-bottom:8px;">Zip Code: ${zipcode}</strong>`;

    if (byLayer['bike-trips']) {
      const trips = byLayer['bike-trips'].properties.distributed_trips || 0;
      html += `<div style="margin-bottom:6px;">
        <span style="color:#007a9e;font-weight:600;">Bike Trip Demand:</span> ${classifyBikeDemand(trips)}
        <div style="font-size:11px;color:#666;margin-top:2px;">Distributed Trips: ${trips.toFixed(2)}</div>
      </div>`;
    }

    if (byLayer['land-use-fill']) {
      const avgFar = byLayer['land-use-fill'].properties.avg_far || 0;
      html += `<div>
        <span style="color:#e06000;font-weight:600;">Land Use Density:</span> ${classifyDensity(avgFar)}
        <div style="font-size:11px;color:#666;margin-top:2px;">Avg FAR: ${avgFar.toFixed(2)}</div>
      </div>`;
    }

    html += '</div>';

    popup.setLngLat(event.lngLat).setHTML(html).addTo(map);

    // Highlight the selected zip code
    map.getSource('selected-zip').setData({
      type: 'FeatureCollection',
      features: [primaryFeature]
    });

    // Zoom to the zip code's bounding box
    const bounds = getFeatureBounds(primaryFeature);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
    }
  });

  // Pointer cursor when hovering clickable zip code layers
  ['bike-trips', 'land-use-fill'].forEach(layerId => {
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  });
});
