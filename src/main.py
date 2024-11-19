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