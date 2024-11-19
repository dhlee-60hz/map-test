import mapLibreGl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new mapLibreGl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [127.7669, 35.9078],
    zoom: 4,
});

map.on('load', () => {
    map.addSource('cloud_data', {
        type: 'vector',
        tiles: ['http://localhost:8080/data/cloud_data/{z}/{x}/{y}.pbf']
    });
    map.addLayer({
        id: 'cloud_layer',
        type: 'circle',
        source: 'cloud_data',
        'source-layer': 'cloud_layer',
        paint: {
            'circle-color': [
                'interpolate',
                ['linear'],
                ['get', 'cloud_status'],
                0, 'blue',
                1, 'yellow',
                2, 'green',
                3, 'gray',
            ],
            'circle-radius': 1 // 반지름 설정
        }
    });
});

map.showTileBoundaries = true;


map.addControl(new mapLibreGl.NavigationControl());