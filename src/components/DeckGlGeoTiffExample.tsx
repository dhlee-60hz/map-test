import { useEffect, useState, useCallback } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import { DeckProps } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { BitmapLayer, GeoJsonLayer } from "@deck.gl/layers";
import { load } from "@loaders.gl/core";
import { GeoTIFFLoader } from "@loaders.gl/geotiff";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * deck.gl Overlay Wrapper
 */
function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

/**
 * 만약 netCDF에서 LCC→WGS84로 이미 변환된 GeoTIFF라면
 * geotiffImage.bounds는 WGS84(경위도) 범위가 되어 있음.
 */
// type GeoTIFFData = (typeof GeoTIFFLoader)["dataType"];

export function DeckGlGeoTiffExample() {
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [geoBounds, setGeoBounds] = useState<
    [number, number, number, number] | null
  >(null);
  const [mergedLineData, setMergedLineData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 데이터 로딩 함수
  const loadTimeData = useCallback(async (timeIndex: number) => {
    setLoading(true);
    try {
      const paddedHour = Math.floor((timeIndex * 10) / 60)
        .toString()
        .padStart(2, "0");
      const paddedMinute = ((timeIndex * 10) % 60).toString().padStart(2, "0");
      const fileName = `swrad_20240808${paddedHour}${paddedMinute}_jet.tif`;

      const response = await fetch(`../../data/swrad_20240807/${fileName}`);

      const arrayBuffer = await response.arrayBuffer();
      const geotiffImage = await load(arrayBuffer, GeoTIFFLoader);

      const { width, height, data } = geotiffImage;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
        alpha: true,
      });
      if (!ctx) return;

      // RGB -> RGBA 변환
      const rgbaData = new Uint8ClampedArray(width * height * 4);

      // RGB를 RGBA로 변환하면서 특정 색상을 투명하게 처리
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // RGB가 모두 0이거나 거의 0에 가까운 경우 완전 투명하게 처리
        const isBackground = r <= 1 && g <= 1 && b <= 1;

        rgbaData[j] = r;
        rgbaData[j + 1] = g;
        rgbaData[j + 2] = b;
        rgbaData[j + 3] = isBackground ? 0 : 255; // 배경이면 투명, 아니면 불투명
      }

      const imageData = new ImageData(rgbaData, width, height);
      ctx.putImageData(imageData, 0, 0);

      const bitmapImg = await createImageBitmap(canvas);
      setBitmap(bitmapImg);

      // 만약 GeoTIFF에 bounds 있으면 그대로 사용
      setGeoBounds(geotiffImage.bounds as [number, number, number, number]);

      // 2. 경계선 GeoJSON 데이터 Fetch
      try {
        const [boundaryResponse, coastlineResponse] = await Promise.all([
          fetch("../../data/boundary_data.geojson"),
          fetch("../../data/coastline_data.geojson"),
        ]);

        const boundaryJson = await boundaryResponse.json();
        const coastlineJson = await coastlineResponse.json();

        // 두 데이터를 하나의 FeatureCollection으로 통합
        const mergedData = {
          type: "FeatureCollection",
          features: [
            ...boundaryJson.features.map((f: any) => ({
              ...f,
              properties: { ...f.properties, lineType: "boundary" },
            })),
            ...coastlineJson.features.map((f: any) => ({
              ...f,
              properties: { ...f.properties, lineType: "coastline" },
            })),
          ],
        };

        setMergedLineData(mergedData);
      } catch (err) {
        console.error("GeoJSON 데이터 로딩 오류:", err);
      }
    } catch (error) {
      console.error("데이터 로딩 에러:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 재생 제어
  useEffect(() => {
    let intervalId: number;

    if (isPlaying) {
      intervalId = window.setInterval(() => {
        setCurrentTimeIndex((prev) => {
          const next = prev + 1;
          return next >= 144 ? 0 : next;
        });
      }, 1000); // 1초마다 다음 프레임
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPlaying]);

  // 시간 인덱스가 변경될 때마다 데이터 로드
  useEffect(() => {
    loadTimeData(currentTimeIndex);
  }, [currentTimeIndex, loadTimeData]);

  // deck.gl 레이어 정의
  const layers = [];
  if (bitmap && geoBounds) {
    const layer = new BitmapLayer({
      id: "bitmap-layer",
      image: bitmap,
      bounds: geoBounds,
      opacity: 1.0,
      pickable: false,
    });
    layers.push(layer);
  }

  // 통합된 경계선 레이어
  if (mergedLineData) {
    layers.push(
      new GeoJsonLayer({
        id: "merged-lines-layer",
        data: mergedLineData,
        stroked: true,
        filled: false,
        lineWidthMinPixels: 2,
        getLineColor: [0, 0, 0, 255],
      })
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ marginRight: "1rem" }}
        >
          {isPlaying ? "일시정지" : "재생"}
        </button>
        <input
          type="range"
          min={0}
          max={143}
          value={currentTimeIndex}
          onChange={(e) => {
            setCurrentTimeIndex(Number(e.target.value));
          }}
          style={{ width: "300px" }}
        />
        <span style={{ marginLeft: "1rem" }}>
          {formatTimeString(currentTimeIndex)}
        </span>
        {loading && <span style={{ marginLeft: "1rem" }}>로딩중...</span>}
      </div>

      <Map
        initialViewState={{
          longitude: 126.1256,
          latitude: 38.1774,
          zoom: 5.59,
        }}
        maxBounds={[
          [116.6543, 32.3836], // 남서쪽 경계 [경도, 위도]
          [135.597, 43.5449], // 북동쪽 경계 [경도, 위도]
        ]}
        minZoom={5.59} // 현재 줌 레벨을 최소값으로 설정
        maxZoom={8} // 최대 줌 레벨
        onMove={(evt) => {
          const { longitude, latitude, zoom } = evt.viewState;
          const bounds = evt.target.getBounds();

          console.log("Map moved:", {
            longitude: longitude.toFixed(4),
            latitude: latitude.toFixed(4),
            zoom: zoom.toFixed(2),
            bounds: {
              west: bounds.getWest().toFixed(4),
              south: bounds.getSouth().toFixed(4),
              east: bounds.getEast().toFixed(4),
              north: bounds.getNorth().toFixed(4),
            },
          });
        }}
        style={{
          width: "100%",
          aspectRatio: "4 / 3",
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json"
      >
        <DeckGLOverlay layers={layers} />
      </Map>
    </div>
  );
}

// 시간 포맷팅 함수
const formatTimeString = (index: number) => {
  const baseDate = new Date(2024, 7, 7); // 2024-08-07
  const minutes = index * 10; // 10분 단위
  const currentDate = new Date(baseDate.getTime() + minutes * 60000);

  return currentDate.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};
