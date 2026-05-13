mapboxgl.accessToken = 'pk.eyJ1IjoicGVtOTg2NCIsImEiOiJjbW5pMnV5cGYwOTFiMnJwa2NyYWU3YXh1In0.BWPtfe9Zo5Oe5WUpglzvYw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  config: {
    basemap: {
      lightPreset: "day", // For some reason, the themes and styles of the layers don't play nice with the night theme, which was the original theme I was going for.
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
  minZoom: 10, // Making sure users can't zoom out too far past the NYC area
  maxZoom: 15,
  maxBounds: [
    [-75, 40],
    [-73.5, 41]
  ],
  bearing: 0.00,
  pitch: 0.00,
});

map.on('load', () => {
  map.addSource('bike-routes', {
    type: 'geojson',
    data: './New_York_City_Bike_Routes_20260512.geojson' // From NYC Open Data: https://data.cityofnewyork.us/Transportation/New-York-City-Bike-Routes/7t3b-ywvw
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
   
  const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol');
  const insertBeforeLayer = firstSymbolLayer ? firstSymbolLayer.id : undefined;
  const insertLayer = (layerSpec) => {
    if (insertBeforeLayer) {
      map.addLayer(layerSpec, insertBeforeLayer);
    } else {
      map.addLayer(layerSpec);
    }
  };

  insertLayer({
    id: 'bike-routes-line',
    type: 'line',
    source: 'bike-routes',
    slot: 'line',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'line-color': '#0ee941',
      'line-width': 1.25,
      'line-opacity': 0.75,
      'line-join': 'round',
      'line-cap': 'round'
    }
  });

  insertLayer({
    id: 'outside-citibike-fill',
    type: 'fill',
    source: 'outside-citibike',
    slot: 'bottom',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'fill-color': 'rgba(255, 255, 0, 0.08)',
      'fill-outline-color': '#919089',
      'fill-outline-width': 20,
      'fill-antialias': true
    }
  });

  // NYC zipcode validation filter - excludes zipcodes outside NYC boundaries
  const nycZipcodeFilter = [
    'any',
    ['>=', ['to-number', ['get', 'zipcode']], 10001],
    ['all', ['<=', ['to-number', ['get', 'zipcode']], 10282]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 10301], ['<=', ['to-number', ['get', 'zipcode']], 10314]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 10451], ['<=', ['to-number', ['get', 'zipcode']], 10475]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 11201], ['<=', ['to-number', ['get', 'zipcode']], 11256]],
    ['all', ['>=', ['to-number', ['get', 'zipcode']], 11354], ['<=', ['to-number', ['get', 'zipcode']], 11428]]
  ];

  insertLayer({
    id: 'land-use-fill',
    type: 'fill',
    source: 'land-use',
    filter: nycZipcodeFilter,
    slot: 'line',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'fill-color': [
        'interpolate',
        ['exponential', 1.2],
        ['get', 'avg_far'],
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
        'interpolate',
        ['exponential', 1.5],
        ['get', 'avg_far'],
        0, 0.85,
        1.0, 0.72,
        2.0, 0.58,
        4.0, 0.45,
        8.0, 0.32,
        15.0, 0.24,
        31.51, 0.18
      ],
      'fill-outline-color': '#999999',
      'fill-outline-width': 3,
      'fill-antialias': true
    }
  });

  insertLayer({
    id: 'citibike-stations-circle',
    type: 'circle',
    source: 'citibike-stations',
    slot: 'top',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'circle-color': 'rgba(176, 168, 168, 0.8)',
      'circle-radius': 2.5,
      'circle-stroke-color': 'rgba(255, 255, 255, 0.8)',
      'circle-stroke-width': 0.5,
      'circle-opacity': 0.7
    }
  });

  insertLayer({
    id: 'bike-trips',
    type: 'fill',
    source: 'bike-trips',
    slot: 'line',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'fill-color': [
        'interpolate',
        ['exponential', 1.5],
        ['get', 'distributed_trips'],
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
        'interpolate',
        ['exponential', 1.5],
        ['get', 'distributed_trips'],
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
      'fill-outline-width': 3,
      'fill-antialias': true
    }
  })

  // insertLayer({
  //   id: 'zcta-demand-fill',
  //           type: 'fill',
  //           source: './zcta_base_boundaries.geojson',
  //           paint: {
  //               'fill-color': colorExpression,
  //               // Dynamically change opacity based on interactive feature-state hooks
  //               'fill-opacity': [
  //                   'case',
  //                   ['boolean', ['feature-state', 'hover'], false],
  //                   0.95, // Fully opaque on hover
  //                   0.70  // Translucent baseline resting rate
  //               ]
  //           }
  // });

  // insertLayer({
  //    id: 'zcta-demand-outline',
  //           type: 'line',
  //           source: 'zcta-boundaries',
  //           paint: {
  //               'line-color': [
  //                   'case',
  //                   ['boolean', ['feature-state', 'hover'], false],
  //                   '#222222', // Dark prominent stroke on hover
  //                   '#ffffff'  // Subtle white baseline border boundary
  //               ],
  //               'line-width': [
  //                   'case',
  //                   ['boolean', ['feature-state', 'hover'], false],
  //                   2.5, // Thick stroke on active hover
  //                   0.5  // Fine line resting width
  //               ]
  //           }
  // });

  const control = document.createElement('div');
  control.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
  control.style.fontFamily = 'sans-serif';
  control.style.padding = '10px';
  control.style.background = 'rgba(255, 255, 255, 0.95)';
  control.style.borderRadius = '6px';
  control.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
  control.style.maxWidth = '220px';
  control.style.position = 'absolute';
  control.style.top = '10px';
  control.style.right = '10px';
  control.style.zIndex = '1';

  control.innerHTML = `
    <strong style="display:block; margin-bottom:8px;">Map Layers</strong>
    <label style="display:flex; align-items:center; font-size:0.95rem; margin-bottom:6px;">
      <input type="checkbox" id="toggle-bike-routes" checked style="margin-right:6px;" />
      Bike Routes
    </label>
    <label style="display:flex; align-items:center; font-size:0.95rem; margin-bottom:6px;">
      <input type="checkbox" id="toggle-citibike-stations" checked style="margin-right:6px;" />
      CitiBike Stations
    </label>
    <label style="display:flex; align-items:center; font-size:0.95rem; margin-bottom:6px;">
      <input type="checkbox" id="toggle-land-use" checked style="margin-right:6px;" />
      Land Use Density
    </label>
    <div style="font-size:0.9rem; margin-top:8px;">
      <strong>Outside CitiBike Network</strong>
      <div style="font-size:0.85rem; color:#555; margin-top:2px;">ZIP Codes outside CitiBike coverage</div>
    </div>
  `;

  map.getContainer().appendChild(control);

  document.getElementById('toggle-bike-routes').addEventListener('change', (event) => {
    map.setLayoutProperty(
      'bike-routes-line',
      'visibility',
      event.target.checked ? 'visible' : 'none'
    );
  });

  document.getElementById('toggle-citibike-stations').addEventListener('change', (event) => {
    map.setLayoutProperty(
      'citibike-stations-circle',
      'visibility',
      event.target.checked ? 'visible' : 'none'
    );
  });

  document.getElementById('toggle-land-use').addEventListener('change', (event) => {
    map.setLayoutProperty(
      'land-use-fill',
      'visibility',
      event.target.checked ? 'visible' : 'none'
    );
  });

  // Classify density based on avg_far terciles
  // Top third begins around 1.82, middle third begins around 0.65
  const classifyDensity = (avgFar) => {
    if (avgFar < 0.65) return 'low';
    if (avgFar < 1.82) return 'medium';
    return 'high';
  };

  // Create a reusable popup
  const popup = new mapboxgl.Popup({
    closeButton: true,
    closeOnClick: false
  });

  // Handle click on land use layer
  map.on('click', 'land-use-fill', (event) => {
    if (event.features.length > 0) {
      const feature = event.features[0];
      const avgFar = feature.properties.avg_far || 0;
      const density = classifyDensity(avgFar);
      const densityText = density.charAt(0).toUpperCase() + density.slice(1);

      const coordinates = event.lngLat;
      const htmlContent = `
        <div style="font-family: sans-serif; font-size: 14px;">
          This zip code is <b>${densityText}</b> density.
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            Avg FAR: ${avgFar.toFixed(2)}
          </div>
        </div>
      `;

      popup.setLngLat(coordinates)
        .setHTML(htmlContent)
        .addTo(map);
    }
  });

  // Change cursor on hover
  map.on('mouseenter', 'land-use-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'land-use-fill', () => {
    map.getCanvas().style.cursor = '';
  });
});

  const classifyBikeDemand = (distributed_trips) => {
    if (distributed_trips < 16) return 'low';
    if (distributed_trips <38) return 'medium';
    return 'high';
  };

   map.on('click', 'bike-trips', (event) => {
    if (event.features.length > 0) {
      const feature = event.features[0];
      const distributedTrips = feature.properties.distributed_trips || 0;
      const demand = classifyBikeDemand(distributedTrips);
      const demandText = demand.charAt(0).toUpperCase() + demand.slice(1);

      const coordinates = event.lngLat;
      const htmlContent = `
        <div style="font-family: sans-serif; font-size: 14px;">
          This zip code is <b>${demandText}</b> bike demand.
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            Distributed Trips: ${distributedTrips.toFixed(2)}
          </div>
        </div>
      `;

      popup.setLngLat(coordinates)
        .setHTML(htmlContent)
        .addTo(map);
    }
  });