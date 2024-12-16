import { useEffect, useState } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import { DeckProps } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { BitmapLayer } from "@deck.gl/layers";
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
type GeoTIFFData = (typeof GeoTIFFLoader)["dataType"];

export function DeckGlGeoTiffExample() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [geoBounds, setGeoBounds] = useState<
    [number, number, number, number] | null
  >(null);

  useEffect(() => {
    (async () => {
      try {
        // 1. GeoTIFF 파일 (WGS84 좌표계) Fetch
        const response = await fetch("../../data/asr_data_jet.tif");
        const arrayBuffer = await response.arrayBuffer();
        // 2. loaders.gl로 파싱
        const geotiffImage = (await load(
          arrayBuffer,
          GeoTIFFLoader
        )) as GeoTIFFData;

        // geotiffImage.bounds가 이미 WGS84라고 가정한다면, 추가 transform 불필요.
        const wgs84Bounds = geotiffImage.bounds as [
          number,
          number,
          number,
          number
        ];

        // 3. Canvas로 픽셀 복사 -> ImageBitmap 생성 (RGBA)
        const { width, height, data } = geotiffImage;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.createImageData(width, height);
        imageData.data.set(data);
        ctx.putImageData(imageData, 0, 0);

        const bitmapImg = await createImageBitmap(canvas);
        setBitmap(bitmapImg);
        setGeoBounds(wgs84Bounds);
      } catch (err) {
        console.error("GeoTIFF 로딩 오류:", err);
      }
    })();
  }, []);

  // deck.gl 레이어 정의
  const layers = [];
  if (bitmap && geoBounds) {
    const layer = new BitmapLayer({
      id: "bitmap-layer",
      image: bitmap,
      bounds: geoBounds, // 이미 WGS84 경계
      opacity: 1.0,
    });
    layers.push(layer);
  }

  return (
    <Map
      initialViewState={{
        longitude: 127.5,
        latitude: 38.0,
        zoom: 5.5,
      }}
      style={{ width: "100%", height: "100vh" }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json"
    >
      <DeckGLOverlay layers={layers} />
    </Map>
  );
}
