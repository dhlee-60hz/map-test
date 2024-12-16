
# 1. 프로젝트 개요

## 1.1 원본 데이터: NetCDF 파일

- **NetCDF (nc) 파일**: 과학·기상 분야에서 널리 쓰이는 포맷. 2D(또는 그 이상) 격자 데이터를 저장하며, 각 변수(ASR, DSR, RSR, 구름 등)는 `dim_y × dim_x` 형태로 구성됨.
- 현재 가지고 있는 파일: `gk2a_ami_le2_swrad_ko020lc_202412110800.nc`  
  - Lambert Conformal Conic(LCC) 투영 좌표, 900×900 격자  
  - 각 픽셀에 일사량(ASR, DSR, RSR) 및 품질 플래그(DQF)가 저장.

## 1.2 최종 목표

- **구름/일사량 데이터를 MapLibre + deck.gl로 웹 지도에 고성능 시각화**  
- MapLibre: 베이스맵(행정구역, 지형 등)  
- deck.gl: 대량의 래스터(또는 벡터) 데이터를 WebGL로 빠르게 그려줌.  
- 프로젝트 요구사항:
  - **인터랙션(픽셀 단위 클릭)은 중요치 않음**  
  - **대용량(900×900) 처리**  
  - 폐쇄망 환경 → 타일 서버 등 외부 인프라 구축이 제한적

## 1.3 접근 방식: 래스터 vs. 벡터

1. **Vector 방식**  
   - 포인트(점)나 폴리곤으로 각 픽셀을 표현(GeoJSON, MVT 등).  
   - 단일 픽셀마다 상호작용 가능, 무한 줌시 해상도 손실 없음.  
   - **단점**: 900×900=810,000개의 점이 브라우저에 로드 → 성능 부담 큼.

2. **Raster 방식**  
   - 픽셀 그리드를 **GeoTIFF**나 PNG 등 이미지로 표현.  
   - 브라우저 GPU에서 텍스처처럼 렌더링 → 대규모 데이터도 효율적.  
   - 픽셀 단위 상호작용은 제한적이지만, 현재 요구사항엔 맞음.  
   - 폐쇄망이므로 서버 타일링(WMTS) 대신 **단일 GeoTIFF**를 브라우저에 로드해도 OK.

**결론**: 구름·일사량 데이터처럼 대규모 격자이고 픽셀별 상호작용이 불필요한 경우, **래스터 접근**(NC → GeoTIFF → MapLibre+deck.gl)은 성능상 이점이 큼.

---

# 2. 전체 흐름 (NC파일 → GeoTIFF → 이미지 → MapLibre 렌더)

1. **NetCDF (LCC 좌표계)**  
   - 원본 Lambert Conformal Conic 투영 데이터.  
2. **GeoTIFF 변환 (Python)**  
   - LCC → WGS84 재투영  
   - scale_factor와 DQF(품질 플래그) 처리  
   - 컬러맵(0~1200 W/m²) 적용하여 RGB GeoTIFF 생성  
3. **웹 지도 렌더링**  
   - 브라우저에서 GeoTIFF(이미 WGS84 좌표)를 loaders.gl로 로딩  
   - deck.gl `BitmapLayer`(또는 `TileLayer`)로 지도(베이스맵) 위에 렌더.

폐쇄망이라 **래스터 타일 서버**(Z/X/Y) 구축은 어렵지만, 단일 GeoTIFF 로딩 접근은 충분히 가능함.

---

# 3. 래스터 vs. 벡터 방식의 성능 비교

**질문**: “NC → GeoTIFF → 이미지 변환 → MapLibre 렌더” 순서가 정말 성능상 이점이 있는가?

### 3.1 래스터 방식 이점

- **한 번 이미지로 만들면** GPU 텍스처로 처리하기 때문에 **렌더링이 빠름**.  
- 수십~수백만 픽셀을 브라우저에서 1장의 이미지로 표시하는 것은 매우 효율적.  
- **데이터 크기**: GeoTIFF 내에 압축을 쓰면 대용량도 효율적으로 저장/전송 가능.

### 3.2 벡터 방식일 경우

- 픽셀 당 하나의 포인트(=810,000개 Feature) → 브라우저가 이를 GeoJSON 등으로 로딩하면 파싱·렌더링에 엄청난 부하.  
- 확대/축소 시 선명도를 유지하는 장점이 있지만, 현재 프로젝트 요구에서 픽셀 단위 상호작용은 필요 없음 → 오버엔지니어링이 됨.  
- **서버-사이드 벡터 타일**(MVT)로 변환도 가능하지만, 준비 과정(등치선 추출 등)이 복잡하고 성능 이점도 낮음.

**결론**: **대규모 격자 데이터를 단순히 시각화**하는 목적에서는 래스터 방식이 월등히 낫다.

---

# 4. 벡터 방식 렌더링 시 Server - 브라우저 사이 동작

**(이 프로젝트에서는 필요치 않지만, 추가 학습용)**

1. **서버에서 벡터 타일(MVT/GeoJSON tiles)을 생성**  
   - Z/X/Y 요청 시 해당 지리 영역의 벡터 피처를 반환.
2. **브라우저**  
   - deck.gl의 `MVTLayer`나 `GeoJsonLayer`로 해당 타일(Feature collection)을 로딩 → WebGL로 렌더.
3. **장점**:  
   - 확대해도 품질 유지, 피처 단위 상호작용.  
4. **단점**:  
   - 픽셀 그리드를 벡터화하면 엄청난 Feature. 성능 부담.  
   - 서버에서 벡터 타일 생성도 복잡.

**정리**: 만약 **라벨, 경계선 등 벡터 지형** 데이터를 표현하는 경우엔 좋지만, **900×900 복사량**에는 불필요.

---

# 5. 이해를 보완할 부분 (상세)

## 5.1 어떤 Reprojection이 필요한가? (LCC → WGS84)

- **원본 Lambert Conformal Conic 좌표**: GK-2A 위성 자료, pixel_size=2000m 등 메타데이터.  
- 웹 지도 표준: **EPSG:4326(WGS84)**나 Web Mercator. 보통은 WGS84로 재투영.  
- **방법**: Python(rioxarray/gdalwarp)에서 LCC 파라미터를 PROJ4/WKT로 정의 후 `.rio.reproject("EPSG:4326")`.

## 5.2 GeoTIFF 생성 시 scale_factor, 마스킹(DQF), 컬러맵 적용

1. **scale_factor**: raw ushort × 0.1 = 실제 W/m².  
2. **DQF(품질 플래그)**: Bad(0)인 픽셀을 NaN 처리.  
3. **컬러맵(0~1200W/m²)**: Python matplotlib(`jet`, etc.)로 RGB 변환. NaN은 회색.  
4. 최종 결과: **RGB GeoTIFF** (WGS84 좌표) → 브라우저에서 손쉽게 시각화.

## 5.3 브라우저 Canvas/BitmapLayer 구현

- loaders.gl의 `GeoTIFFLoader`로 TIFF를 ArrayBuffer → 픽셀 RGBA 배열로 파싱.  
- 오프스크린 Canvas를 만들고, `ImageData`에 픽셀을 넣은 뒤 `createImageBitmap(canvas)` 수행.  
- deck.gl `BitmapLayer`에 `{image: bitmap, bounds: [minLng, minLat, maxLng, maxLat]}` 설정.

## 5.4 “벡터 타일 서버” 동작

- 서버가 Z/X/Y에 맞춰 피처(GeoJSON/MVT)를 생성.  
- 클라이언트(deck.gl)에서 타일 요청 → WebGL로 벡터 피처 렌더.  
- 기상 위성 격자는 “픽셀” 기반이라, 이 방식이 비효율적.

---

# 6. 결론

1. **NC → GeoTIFF → MapLibre** 파이프라인은 대규모 기상 격자 데이터를 웹에서 효율적으로 시각화하는 최적 방안.  
2. **래스터 접근**은 벡터 방식 대비 성능 이점이 크며, 폐쇄망에서도 단일 GeoTIFF로 동작 가능.  
3. **LCC → WGS84 reprojection** + **scale_factor** + **DQF 마스킹** + **컬러맵 적용**이 핵심 전처리.  
4. 브라우저 측에선 loaders.gl + deck.gl `BitmapLayer`로 단일 이미지를 지도에 덧씌우면 됨.  
5. 만약 전 픽셀이 Bad면 회색 박스만 표시 → 실제 데이터에 유효 픽셀이 없거나 전처리 로직 점검 필요.

---

## 최종 요약

- **프로젝트 진행 순서**:
  1. **NetCDF** (ASR, DQF, Lambert Conformal Conic 등 메타데이터)
  2. 전처리:  
     - 재투영(LCC→WGS84), scale_factor=0.1 반영, DQF=1만 남기기  
     - 0~1200 W/m² 컬러맵 → RGB GeoTIFF
  3. **브라우저**: loaders.gl로 TIFF 파싱, deck.gl `BitmapLayer`로 지도(MapLibre) 위에 오버레이.

- **벡터 방식**과 비교할 때 래스터가 성능상 유리.  
- **“벡터 타일 서버”**는 대규모 GIS 벡터 데이터(행정구역, 도로 등)에 맞지만 기상 격자에는 부적합.
- 궁극적으로 **폐쇄망 환경**에서도 단일 GeoTIFF 파일을 static hosting으로 두고, 브라우저가 fetch하여 시각화 가능.
