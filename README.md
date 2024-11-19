# NetCDF 데이터에서 MapLibre GL JS를 사용한 Heatmap 시각화 과정

아래는 NetCDF 데이터를 MapLibre GL JS를 사용하여 Heatmap으로 시각화하는 과정을 단계별로 정리한 문서입니다.

---

## 1. NetCDF 데이터 준비

### 1.1 NetCDF 파일 형식 확인
- 파일이 `.nc` 형식인지 확인합니다.
- NetCDF 파일의 구조를 점검합니다:
    - `dimensions`, `variables` 정보 확인.
    - `grid_mapping`이나 좌표 체계(EPSG 코드) 확인.

### 1.2 NetCDF 파일 내용 예시
(2024.11.10. 14:00 천리안 2A 위성 구름 데이터)
```nc
{
  dimensions:
    dim_y = 900;
    dim_x = 900;
  variables:
    ubyte CLD(dim_y=900, dim_x=900);
      :_FillValue = 255UB; // ubyte
      :ancillary_variables = "TTF1, TTF2, TTF3";
      :grid_mapping = "gk2a_imager_projection";
      :long_name = "AMI L2 Scene Analysis";
      :product_meanings = "0: cloud(Confidance), 1: cloud(Low Confidence), 2: clear(Confidence), 3: TBD";
      :units = ;
      :valid_max = 3UB; // ubyte
      :valid_min = 0UB; // ubyte

    ushort TTF1(dim_y=900, dim_x=900);
      :valid_min = 0US; // ushort
      :long_name = "AMI L2 Cloud Mask Threshold Tests Flag1";
      :valid_max = 2US; // ushort
      :_FillValue = 65535US; // ushort
      :flag_meanings = "see note";
      :units = ;

    ushort TTF2(dim_y=900, dim_x=900);
      :valid_max = 2US; // ushort
      :valid_min = 0US; // ushort
      :flag_meanings = "see note";
      :long_name = "AMI L2 Cloud Mask Threshold Tests Flag2";
      :units = ;
      :_FillValue = 65535US; // ushort

    ushort TTF3(dim_y=900, dim_x=900);
      :valid_min = 0US; // ushort
      :flag_meanings = "see note";
      :long_name = "AMI L2 Cloud Mask Threshold Tests Flag3";
      :units = ;
      :valid_max = 2US; // ushort
      :_FillValue = 65535US; // ushort

    int gk2a_imager_projection;
      :grid_mapping_name = "lambert_conformal_conic";
      :standard_parallel1 = 30.0; // double
      :standard_parallel2 = 60.0; // double
      :origin_latitude = 38.0; // double
      :central_meridian = 126.0; // double
      :false_easting = 0.0; // double
      :false_northing = 0.0; // double
      :image_width = 900U; // uint
      :image_height = 900U; // uint
      :pixel_size = 2000.0; // double
      :upper_left_easting = -899000.0; // double
      :upper_left_northing = 899000.0; // double
      :upper_right_easting = 899000.0; // double
      :upper_right_northing = 899000.0; // double
      :lower_left_easting = -899000.0; // double
      :lower_left_northing = -899000.0; // double
      :lower_right_easting = 899000.0; // double
      :lower_right_northing = -899000.0; // double

  // global attributes:
  :file_creation_time = "2024-11-10T05:02:27.796Z";
  :origianl_sourece_file = "gk2a_ami_le2_cld_ela020ge_202411100500.nc";
  :algorithm_version = "GK2A_CLD_v1.2022.01.3";
  :comment = "TBD";
  :conventions = "CF-1.7";
  :institution = "KMA/NMSC> Korea Meteorological Administration, National Meteorological Satellite Center";
  :instrument = "GK-2A Advanced Meteorological Imager";
  :license = "Access is restricted to approved users only";
  :metadata_conventions = "Unidata Dataset Discovery v1.0";
  :names_of_product = "CLD, TTF1, TTF2, TTF3";
  :number_of_product = "4";
  :observation_mode = "ELA";
  :processing_area = "ELA";
  :processing_environment = "operation";
  :references = "RAP03 CLD mask v1.0";
  :title = "AMI L2 CLD";
}
```

## 2. NetCDF 데이터 처리

#### 2.1 Python 환경 설정
NetCDF 데이터를 처리하기 위해 Python 환경을 설정합니다:
```bash
pip install netCDF4 xarray pyproj numpy
```

#### 2.2 NetCDF 데이터를 GeoJSON으로 변환
아래 코드를 사용해 NetCDF 데이터를 GeoJSON 형식으로 변환합니다:

```python
import numpy as np
from netCDF4 import Dataset
from pyproj import Proj, Transformer
import geojson

# NetCDF 파일 경로
file_path = "data/gk2a_ami_le2_cld_ko020lc_202411100500.nc"

# NetCDF 파일 열기
dataset = Dataset(file_path, mode="r")

# 변수 추출
cld = dataset.variables['CLD'][:]
proj_info = dataset.variables['gk2a_imager_projection']

# 투영 변환 설정 (Lambert Conformal Conic -> WGS84)
proj_lcc = Proj(
    proj="lcc",
    lat_1=proj_info.standard_parallel1,
    lat_2=proj_info.standard_parallel2,
    lat_0=proj_info.origin_latitude,
    lon_0=proj_info.central_meridian,
    x_0=proj_info.false_easting,
    y_0=proj_info.false_northing,
    datum="WGS84",
)
proj_wgs84 = Proj(proj="latlong", datum="WGS84")
transformer = Transformer.from_proj(proj_lcc, proj_wgs84)

# GeoJSON Feature 생성
features = []
ydim, xdim = cld.shape
pixel_size = proj_info.pixel_size

for y in range(ydim):
    for x in range(xdim):
        value = cld[y, x]

        # 마스킹된 데이터 건너뛰기
        if value == 255:  # _FillValue
            continue

        # 픽셀 중심 좌표 계산
        x_coord = proj_info.upper_left_easting + (x * pixel_size)
        y_coord = proj_info.upper_left_northing - (y * pixel_size)

        # 좌표 변환
        lon, lat = transformer.transform(x_coord, y_coord)

        # GeoJSON Feature 추가
        features.append(geojson.Feature(
            geometry=geojson.Point((lon, lat)),
            properties={"cloud_status": int(value)},
        ))

# GeoJSON 저장
geojson_data = geojson.FeatureCollection(features)
with open("cloud_data.geojson", "w") as f:
    geojson.dump(geojson_data, f)

print("GeoJSON 파일 저장 완료: cloud_data.geojson")
```

## 3. GeoJSON 데이터를 벡터 타일(MVT)로 변환
#### 3.1 Tippecanoe 설치
GeoJSON 데이터를 MVT(MBTiles) 형식으로 변환하기 위해 Tippecanoe를 설치합니다:

```bash
brew install tippecanoe
```
#### 3.2 MVT 생성
GeoJSON 데이터를 벡터 타일로 변환합니다:
```bash
tippecanoe -o cloud_data.mbtiles --layer=cloud_layer --minimum-zoom=0 --maximum-zoom=8 cloud_data.geojson
```
#### 3.3 결과 확인
cloud_data.mbtiles 파일이 생성됩니다.

## 4. 타일 서버로 MBTiles 서빙
#### 4.1 TileServer GL 설치
TileServer GL을 설치합니다:

```bash
npm install -g tileserver-gl
```

#### 4.2 TileServer GL 실행
생성된 MBTiles 파일을 TileServer GL로 실행합니다:

```bash
tileserver-gl cloud_data.mbtiles
```

#### 4.3 타일 URL 확인
http://localhost:8080/에서 제공되는 타일 URL을 확인합니다:
예: http://localhost:8080/data/cloud_data/{z}/{x}/{y}.pbf.

## 5. MapLibre GL JS에서 Heatmap 표시
#### 5.1 Heatmap 구현 코드
아래 코드를 사용해 MapLibre GL JS에서 Heatmap을 구현합니다:
```javascript
import mapLibreGl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new mapLibreGl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [127.7669, 35.9078],
    zoom: 4,
});

map.on('load', () => {
    console.log('Map loaded');

    // 벡터 소스 추가
    map.addSource('cloud_data', {
        type: 'vector',
        tiles: ['http://localhost:8080/data/cloud_data/{z}/{x}/{y}.pbf']
    });

    // Heatmap 레이어 추가
    map.addLayer({
        id: 'cloud_heatmap',
        type: 'heatmap',
        source: 'cloud_data',
        'source-layer': 'cloud_layer', // 실제 벡터 타일의 레이어 이름
        paint: {
            // Heatmap 가중치: 맑음(2) 데이터는 제외
            'heatmap-weight': [
                'case',
                ['==', ['get', 'cloud_status'], 0], 1,   // 구름(높은 신뢰도) → 가중치 1
                ['==', ['get', 'cloud_status'], 1], 0.6, // 구름(낮은 신뢰도) → 가중치 0.6
                0 // 맑음(2) 및 기타 값은 가중치 0
            ],
            // Heatmap 반지름: 줌 레벨에 따라 조정
            'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 2,    // 줌 레벨 0에서는 반지름 2
                10, 20   // 줌 레벨 10에서는 반지름 20
            ],
            // Heatmap 색상: 구름 → 파랑/하늘색, 맑음은 투명
            'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'], // 밀도에 따라 색상 변화
                0, 'rgba(255, 255, 255, 0)',  // 낮은 밀도: 투명
                0.2, 'rgba(128, 128, 128, 1)', // 구름(낮은 신뢰도)
                1, 'rgba(0, 0, 255, 1)'          // 구름(높은 신뢰도)
            ],
            // Heatmap 불투명도
            'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 0.5,  // 줌 레벨 0에서 불투명도
                10, 0.5  // 줌 레벨 10에서 불투명도
            ]
        }
    });
});

// 지도에 네비게이션 컨트롤 추가
map.addControl(new mapLibreGl.NavigationControl());
```

## 6. 결과
- NetCDF 데이터를 GeoJSON으로 변환.
- GeoJSON 데이터를 MVT(MBTiles)로 변환.
- TileServer GL을 통해 MVT 데이터를 서빙.
- MapLibre GL JS에서 MVT 데이터를 기반으로 Heatmap을 표시.

#### 6.1 추가 확인 사항
- source-layer와 cloud_status 값이 올바르게 매핑되어 있는지 확인합니다.
- NetCDF의 좌표 체계와 변환 과정을 점검합니다.
- Heatmap 스타일과 설정을 조정하여 원하는 시각화를 얻습니다.

#### 실행
```bash
tileserver-gl
npm run dev
```