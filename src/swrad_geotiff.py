import xarray as xr
import rioxarray
import numpy as np
import rasterio
from matplotlib import cm, colors

#------------------------------------------------------------
# 1. netCDF 파일 로딩
#------------------------------------------------------------
ds = xr.open_dataset("../data/gk2a_ami_le2_swrad_ko020lc_202407070300.nc")

# dim_y, dim_x -> y, x로 변경
ds = ds.rename({'dim_y': 'y', 'dim_x': 'x'})


#------------------------------------------------------------
# LCC 투영 정보 추출
#------------------------------------------------------------
proj_var = ds["gk2a_imager_projection"]
pixel_size = proj_var.pixel_size.item()        # 2000.0 meter
image_width = proj_var.image_width.item()      # 900
image_height = proj_var.image_height.item()    # 900
upper_left_easting = proj_var.upper_left_easting.item()     # -899000.0
upper_left_northing = proj_var.upper_left_northing.item()   # 899000.0

#------------------------------------------------------------
# 2. x,y 좌표 생성
#   - x: 왼 -> 오른쪽(서->동), y: 위->아래(북->남)
#   - 데이터가 900x900 그리드이므로 pixel_size를 곱해 좌표 배열 생성
#------------------------------------------------------------
x = np.linspace(
    upper_left_easting,
    upper_left_easting + pixel_size * (image_width - 1),
    image_width
)

y = np.linspace(
    upper_left_northing,
    upper_left_northing - pixel_size * (image_height - 1),
    image_height
)

ds = ds.assign_coords({"x": x, "y": y})
ds.rio.set_spatial_dims(x_dim="x", y_dim="y", inplace=True)

#------------------------------------------------------------
# 3. LCC 투영 정의 (proj4)
#   netCDF에 있는 attributes: lat_1=30, lat_2=60, lat_0=38, lon_0=126
#------------------------------------------------------------
lcc_proj4 = (
    "+proj=lcc "
    "+lat_1=30 +lat_2=60 +lat_0=38 +lon_0=126 "
    "+x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs"
)

ds = ds.rio.write_crs(lcc_proj4)

#------------------------------------------------------------
# 4. 원하는 변수(ASR) 추출 & 품질 플래그 적용
#------------------------------------------------------------
asr_data = ds['ASR']

# scale_factor 적용
if 'scale_factor' in asr_data.attrs:
    sf = float(asr_data.attrs['scale_factor'])
    asr_data = asr_data * sf

# 품질관리(DQF)
asr_dqf = ds['ASR_DQF1']  # 0: Bad, 1: Good
sw_dqf = ds['SW_DQF']     # 0: Bad, 1: Good
mask = (asr_dqf == 1) & (sw_dqf == 1)

# CRS 백업
current_crs = asr_data.rio.crs
# 마스킹
asr_data = asr_data.where(asr_dqf == 1)
# CRS 재적용
asr_data = asr_data.rio.write_crs(current_crs)

print("--------------------------------")
print(asr_data.rio)
print("--------------------------------")
print(asr_data.rio.crs)
print("--------------------------------")

#------------------------------------------------------------
# 5. WGS84로 재투영
#   - LCC -> EPSG:4326 변환
#   - rioxarray가 내부적으로 gdalwarp 호출
#------------------------------------------------------------
asr_data = asr_data.rio.reproject("EPSG:4326")

print("mask true pixel count:", mask.sum().item())
print("ASR min:", asr_data.min().values, "ASR max:", asr_data.max().values)

#------------------------------------------------------------
# 6. 값 범위 확인
#------------------------------------------------------------
data_min = float(asr_data.min().values)
data_max = float(asr_data.max().values)
if np.isnan(data_min) or np.isinf(data_min):
    data_min = 0
if np.isnan(data_max) or np.isinf(data_max):
    data_max = 1
if data_min == data_max:
    data_max = data_min + 1

print(f"Data range after DQF mask: [{data_min}, {data_max}]")

vmin = data_min
vmax = data_max

#------------------------------------------------------------
# 7. 단일 밴드 GeoTIFF 저장 (분석용)
#------------------------------------------------------------
asr_data.rio.to_raster("asr_data_raw.tif")

#------------------------------------------------------------
# 8. 컬러맵 적용 → RGB GeoTIFF 생성
#   (jet 컬러맵, NaN 픽셀 회색 처리)
#------------------------------------------------------------
data = asr_data.values
norm = colors.Normalize(vmin=vmin, vmax=vmax)
colormap = cm.get_cmap('jet')
rgba = colormap(norm(data))   # shape: (height, width, 4)
rgb = (rgba[:, :, :3] * 255).astype(np.uint8)

# NaN 픽셀 회색
mask_nans = np.isnan(data)
rgb[mask_nans, :] = [200, 200, 200]

height, width = data.shape
transform = asr_data.rio.transform()
crs = asr_data.rio.crs

print("--------------------------------")
print(crs)
print("--------------------------------")

with rasterio.open(
    "asr_data_jet.tif",
    'w',
    driver='GTiff',
    height=height,
    width=width,
    count=3,
    dtype=rgb.dtype,
    crs=crs,
    transform=transform
) as dst:
    dst.write(rgb[:, :, 0], 1)
    dst.write(rgb[:, :, 1], 2)
    dst.write(rgb[:, :, 2], 3)

print("RGB GeoTIFF 생성 완료: asr_data_jet.tif")
