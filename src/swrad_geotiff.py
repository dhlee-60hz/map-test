import xarray as xr
import rioxarray
import numpy as np
import rasterio
from matplotlib import  colors, colormaps
import os

def process_swrad(input_file, output_raw, output_colored):
    """
    단일 SWRAD NC 파일을 처리하는 함수
    """
    #------------------------------------------------------------
    # 1. netCDF 파일 로딩
    #------------------------------------------------------------
    # 기존 주석: 아래는 GK-2A 위성 NetCDF 파일을 xarray로 로딩하는 예시입니다.
    ds = xr.open_dataset(input_file)

    # dim_y, dim_x -> y, x로 변경
    # 기존 주석: rioxarray가 인식하는 표준 차원명으로 rename
    ds = ds.rename({'dim_y': 'y', 'dim_x': 'x'})


    #------------------------------------------------------------
    # LCC 투영 정보 추출
    #------------------------------------------------------------
    # 기존 주석: netCDF 내부의 투영 변수를 통해 pixel_size 등 메타데이터 추출
    proj_var = ds["gk2a_imager_projection"]
    pixel_size = proj_var.pixel_size.item()        # 2000.0 meter
    image_width = proj_var.image_width.item()      # 900
    image_height = proj_var.image_height.item()    # 900
    upper_left_easting = proj_var.upper_left_easting.item()     # -899000.0
    upper_left_northing = proj_var.upper_left_northing.item()   # 899000.0

    #------------------------------------------------------------
    # 2. x,y 좌표 생성
    #   - x: 왼 -> 오른쪽(서->동), y: 위->아래(북->남)
    #------------------------------------------------------------
    # 기존 주석: 가로방향(x) 좌표는 pixel_size만큼 증가
    x = np.linspace(
        upper_left_easting,
        upper_left_easting + pixel_size * (image_width - 1),
        image_width
    )

    # 기존 주석: 세로방향(y) 좌표는 북에서 남으로 감소
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
    # 기존 주석: Lambert Conformal Conic 투영 proj4 문자열
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

    # 기존 주석: scale_factor(=0.1) 적용
    if 'scale_factor' in asr_data.attrs:
        sf = float(asr_data.attrs['scale_factor'])
        asr_data = asr_data * sf

    # 기존 주석: 품질관리(DQF) - Bad(0) 픽셀 마스킹
    asr_dqf = ds['ASR_DQF1']  # 0: Bad, 1: Good
    sw_dqf = ds['SW_DQF']     # 0: Bad, 1: Good
    mask = (asr_dqf == 1) & (sw_dqf == 1)

    # CRS 백업
    current_crs = asr_data.rio.crs
    # 마스킹
    asr_data = asr_data.where(mask)
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

    #------------------------------------------------------------
    # 7. 단일 밴드 GeoTIFF 저장 (분석용)
    #------------------------------------------------------------
    # 기존 주석: 컬러 적용 전, 단일 밴드(실제 W/m²) GeoTIFF
    asr_data.rio.to_raster(output_raw)

    #------------------------------------------------------------
    # 8. 컬러맵 적용 → RGBA(8bit) GeoTIFF 생성
    #------------------------------------------------------------
    # matplotlib 컬러맵으로 RGBA 변환
    data = asr_data.values
    norm = colors.Normalize(vmin=data_min, vmax=data_max)
    colormap = colormaps['jet']
    rgba = colormap(norm(data))   # shape: (height, width, 4)
    rgba = (rgba * 255).astype(np.uint8)

    # NaN 픽셀 완전 투명 처리
    mask_nans = np.isnan(data)
    rgba[mask_nans, 3] = 0  # 알파 채널을 0으로 설정하여 완전 투명하게 처리

    height, width = data.shape
    transform = asr_data.rio.transform()
    crs = asr_data.rio.crs

    print("--------------------------------")
    print(crs)
    print(rgba.dtype)
    print("--------------------------------")

    ### NEW COMMENT:
    # photometric='RGB'를 문자열로 지정하여 deck.gl에서 바로 해석 가능한
    # 3밴드 8비트 RGB GeoTIFF를 생성. 만약 photometric 파라미터 없이 저장하면
    # 브라우저에서 팔레트/밴드 해석에 문제가 발생할 수 있음.

    with rasterio.open(
        output_colored,
        'w',
        driver='GTiff',
        height=height,
        width=width,
        count=4,
        dtype=rgba.dtype,
        crs=crs,
        transform=transform,
        # photometric='RGB',
        extra_tags={
            'TIFFTAG_EXTRASAMPLES': [2],  # 2는 연관된 알파 데이터를 의미
        }
    ) as dst:
        # RGBA 4채널 모두 저장
        for i in range(4):
            dst.write(rgba[:, :, i], i + 1)
        
        # 알파 채널 메타데이터 설정
        dst.update_tags(TIFFTAG_EXTRASAMPLES=[2])
        
        # 알파 채널이 있음을 명시적으로 설정
        dst.colorinterp = [
            rasterio.enums.ColorInterp.red,
            rasterio.enums.ColorInterp.green,
            rasterio.enums.ColorInterp.blue,
            rasterio.enums.ColorInterp.alpha
        ]

    print(f"처리 완료: {os.path.basename(output_colored)}")
