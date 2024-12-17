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
// type GeoTIFFData = (typeof GeoTIFFLoader)["dataType"];

export function DeckGlGeoTiffExample() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [geoBounds, setGeoBounds] = useState<
    [number, number, number, number] | null
  >(null);

  useEffect(() => {
    (async () => {
      const response = await fetch("../../data/asr_data_jet.tif");
      const arrayBuffer = await response.arrayBuffer();
      const geotiffImage = await load(arrayBuffer, GeoTIFFLoader);
      const { width, height, data } = geotiffImage;

      console.log("GeoTIFF dimensions:", width, height);
      console.log("Data length:", data.length);

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
    })();
  }, []);

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
