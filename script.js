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

  // Outside CitiBike fill — 'middle' slot avoids night-mode atmospheric darkening
  insertLayer({
    id: 'outside-citibike-fill',
    type: 'fill',
    source: 'outside-citibike',
    slot: 'middle',
    layout: { visibility: 'visible' },
    paint: {
      'fill-color': '#ffe566',
      'fill-opacity': 0.16,
      'fill-antialias': true
    }
  });

  // Outside CitiBike border — bright amber, clearly visible against the dark basemap
  insertLayer({
    id: 'outside-citibike-line',
    type: 'line',
    source: 'outside-citibike',
    slot: 'middle',
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#ffe066',
      'line-width': 2.5,
      'line-opacity': 0.90
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

  // Land-use filter: NYC validation + explicit exclusions for out-of-borough ZIPs
  const landUseFilter = [
    'all',
    nycZipcodeFilter,
    ['!=', ['get', 'zipcode'], '10803'],
    ['!=', ['get', 'zipcode'], '11021'],
    ['!=', ['get', 'zipcode'], '11040']
  ];

  // Bike routes — bright green, pops well against the dark night basemap
  insertLayer({
    id: 'bike-routes-line',
    type: 'line',
    source: 'bike-routes',
    slot: 'middle',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#44ff6b',
      'line-width': 1.25,
      'line-opacity': 0.88,
      'line-join': 'round',
      'line-cap': 'round'
    }
  });

  // Land use density — warm orange→red gradient; opacity increases with density so
  // high-value areas are most visible against the dark basemap.
  insertLayer({
    id: 'land-use-fill',
    type: 'fill',
    source: 'land-use',
    filter: landUseFilter,
    slot: 'middle',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'interpolate', ['exponential', 1.2], ['get', 'avg_far'],
        0,     '#fffce8',
        0.5,   '#fff176',
        1.0,   '#ffee58',
        2.0,   '#ffb300',
        4.0,   '#ff8f00',
        7.0,   '#f4511e',
        12.0,  '#ef5350',
        18.0,  '#e53935',
        31.51, '#d32f2f'
      ],
      'fill-opacity': [
        'interpolate', ['exponential', 1.2], ['get', 'avg_far'],
        0,     0.05,
        0.5,   0.20,
        1.0,   0.35,
        2.0,   0.50,
        4.0,   0.62,
        7.0,   0.70,
        12.0,  0.76,
        18.0,  0.80,
        31.51, 0.85
      ],
      'fill-outline-color': 'rgba(255, 255, 255, 0.35)',
      'fill-antialias': true
    }
  });

  // CitiBike stations — original gray style
  insertLayer({
    id: 'citibike-stations-circle',
    type: 'circle',
    source: 'citibike-stations',
    slot: 'top',
    layout: { visibility: 'none' },
    paint: {
      'circle-color': 'rgba(220, 215, 215, 0.95)',
      'circle-radius': 2.5,
      'circle-stroke-color': 'rgba(255, 255, 255, 0.9)',
      'circle-stroke-width': 0.5,
      'circle-opacity': 0.88
    }
  });

  // Bike trips — cyan gradient; opacity increases with demand so high-demand areas
  // are most visible against the dark basemap.
  insertLayer({
    id: 'bike-trips',
    type: 'fill',
    source: 'bike-trips',
    slot: 'middle',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'interpolate', ['exponential', 1.5], ['get', 'distributed_trips'],
        0,    '#e8ffff',
        8,    '#80ffff',
        16,   '#40e0ff',
        32,   '#00e5ff',
        64,   '#00d4e6',
        128,  '#00b8d9',
        256,  '#0099b0',
        512,  '#007a8c',
        1024, '#00627a'
      ],
      'fill-opacity': [
        'interpolate', ['exponential', 1.5], ['get', 'distributed_trips'],
        0,    0.05,
        8,    0.15,
        16,   0.28,
        32,   0.42,
        64,   0.55,
        128,  0.65,
        256,  0.72,
        512,  0.78,
        1024, 0.84
      ],
      'fill-outline-color': 'rgba(255, 255, 255, 0.35)',
      'fill-antialias': true
    }
  });

  // Selected zip code highlight outline (gold — high contrast on dark background)
  map.addLayer({
    id: 'selected-zip-outline',
    type: 'line',
    source: 'selected-zip',
    slot: 'top',
    paint: {
      'line-color': '#FFEC3D',
      'line-width': 3.5,
      'line-opacity': 0.98
    }
  });

  // --- Legend / Layer Control ---
  const control = document.createElement('div');
  control.className = 'mapboxgl-ctrl mapboxgl-ctrl-group legend-control';
  map.getContainer().appendChild(control);

  control.innerHTML = `
    <strong class="legend-title">Map Layers</strong>

    <label class="legend-row">
      <input type="checkbox" id="toggle-bike-routes" class="legend-checkbox" style="accent-color:#44ff6b;" />
      <span class="legend-swatch" style="height:5px; background:#44ff6b;"></span>
      Bike Routes
    </label>

    <label class="legend-row">
      <input type="checkbox" id="toggle-citibike-stations" class="legend-checkbox" style="accent-color:#dcdcdc;" />
      <span class="legend-swatch" style="width:13px;height:13px;border-radius:50%;background:rgba(220,215,215,0.95);box-shadow:0 0 0 1.5px #bbb;"></span>
      CitiBike Stations
    </label>

    <label class="legend-row">
      <input type="checkbox" id="toggle-land-use" class="legend-checkbox" style="accent-color:#ff8f00;" />
      <span class="legend-swatch" style="background:linear-gradient(to right,#fffce8,#d32f2f);border:1px solid #ccc;"></span>
      Land Use Density
      <span class="layer-info-icon">?<span class="tooltip-text">Placeholder text — fill in later about land use density.</span></span>
    </label>
    <div class="legend-range-grid">
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#fff176;"></span><span>Avg FAR &lt; 1</span></div>
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#ff8f00;"></span><span>Avg FAR 1 – 4</span></div>
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#ef5350;"></span><span>Avg FAR 4 – 12</span></div>
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#d32f2f;"></span><span>Avg FAR &gt; 12</span></div>
    </div>

    <label class="legend-row">
      <input type="checkbox" id="toggle-bike-trips" class="legend-checkbox" style="accent-color:#00d4e6;" />
      <span class="legend-swatch" style="background:linear-gradient(to right,#e8ffff,#00627a);border:1px solid #ccc;"></span>
      Bike Trip Demand
      <span class="layer-info-icon">?<span class="tooltip-text">Placeholder text — fill in later about bike trip demand.</span></span>
    </label>
    <div class="legend-range-grid">
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#80ffff;"></span><span>&lt; 16 trips</span></div>
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#00e5ff;"></span><span>16 – 64 trips</span></div>
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#00b8d9;"></span><span>64 – 256 trips</span></div>
      <div class="legend-range-row"><span class="legend-range-swatch" style="background:#00627a;"></span><span>&gt; 256 trips</span></div>
    </div>

    <div class="legend-static">
      <span class="legend-swatch" style="background:#ffe566;border:2px solid #ffe066;flex-shrink:0;"></span>
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
    map.setPaintProperty('outside-citibike-fill', 'fill-opacity', anyActive ? 0.06 : 0.16);
    map.setPaintProperty('outside-citibike-line', 'line-opacity', anyActive ? 0.30 : 0.90);
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
    // bike-trips features use 'zcta5ce20'; land-use features use 'zipcode'
    const zipcode = primaryFeature.properties.zipcode || primaryFeature.properties.zcta5ce20 || 'Unknown';

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
