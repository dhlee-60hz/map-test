import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { DeckProps } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useEffect, useState } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import proj4 from "proj4";

import "maplibre-gl/dist/maplibre-gl.css";

type CloudData2 = {
  CLD: Array<Array<number>>;
  from: string;
  to: string;
  image_height: number;
  image_width: number;
  lower_left_easting: number;
  lower_left_northing: number;
  lower_right_easting: number;
  lower_right_northing: number;
  upper_left_easting: number;
  upper_left_northing: number;
  upper_right_easting: number;
  upper_right_northing: number;
  pixel_size: number;
};

interface CloudPoint {
  position: [number, number];
  cloudValue: number;
}

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export function DeckGlExample2() {
  const [cloudData, setCloudData] = useState<CloudPoint[]>([]);

  useEffect(() => {
    fetch("/data/cloud_data2.json")
      .then((response) => response.json())
      .then((data: CloudData2) => {
        const points: CloudPoint[] = [];

        // proj4 변환 함수 설정
        const transform = proj4(data.from, data.to);

        // 각 픽셀의 위치 계산
        for (let i = 0; i < data.image_height; i++) {
          for (let j = 0; j < data.image_width; j++) {
            // 현재 픽셀의 좌표 계산
            const easting = data.lower_left_easting + j * data.pixel_size;
            const northing =
              data.lower_left_northing +
              (data.image_height - 1 - i) * data.pixel_size;

            // 좌표계 변환
            const [lon, lat] = transform.forward([easting, northing]);

            points.push({
              position: [lon, lat],
              cloudValue: data.CLD[i][j],
            });
          }
        }
        setCloudData(points);
      });
  }, []);

  const layers = [
    new HeatmapLayer({
      id: "cloud-layer",
      data: cloudData,
      getPosition: (d: CloudPoint) => d.position,
      getWeight: (d: CloudPoint) =>
        d.cloudValue === 0 ? 1.0 : d.cloudValue === 1 ? 0.5 : 0,
      radiusPixels: 40,
      intensity: 1.2,
      threshold: 0.2,
      opacity: 0.95,
      colorRange: [
        [204, 229, 255, 255],
        [153, 204, 255, 255],
        [102, 178, 255, 255],
        [51, 153, 255, 255],
        [0, 128, 255, 255],
        [0, 102, 204, 255],
      ],
    }),
  ];

  return (
    <Map
      initialViewState={{
        longitude: 127.5,
        latitude: 38.0,
        zoom: 5.5,
        pitch: 0,
        bearing: 0,
      }}
      style={{ width: "100%", height: "100vh" }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json"
    >
      <DeckGLOverlay
        layers={layers}
        getTooltip={({ object }: any) => {
          if (object?.points?.[0]) {
            const point = object.points[0].source;
            return {
              html: `구름 신뢰도: ${point.cloudValue === 1 ? "낮음" : "높음"}`,
            };
          }
          return null;
        }}
      />
    </Map>
  );
}
