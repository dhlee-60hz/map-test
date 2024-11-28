import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { DeckProps } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useEffect, useState } from "react";
import { Map, useControl } from "react-map-gl/maplibre";

import "maplibre-gl/dist/maplibre-gl.css";

type CloudData = {
  X: Array<Array<number>>;
  Y: Array<Array<number>>;
  CLD: Array<Array<number>>;
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

export function DeckGlExample() {
  const [cloudData, setCloudData] = useState<CloudPoint[]>([]);

  useEffect(() => {
    fetch("/data/cloud_data.json")
      .then((response) => response.json())
      .then((data: CloudData) => {
        const points: CloudPoint[] = [];
        for (let i = 0; i < data.X.length; i++) {
          for (let j = 0; j < data.X[i].length; j++) {
            if (data.CLD[i][j] > 0) {
              points.push({
                position: [data.X[i][j], data.Y[i][j]],
                cloudValue: data.CLD[i][j],
              });
            }
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
      getWeight: (d: CloudPoint) => (d.cloudValue === 2 ? 1.0 : 0.7),
      radiusPixels: 60,
      intensity: 1.0,
      threshold: 0.1,
      opacity: 0.9,
      colorRange: [
        [255, 255, 255, 0], // 투명
        [220, 220, 255, 100], // 매우 연한 파랑
        [180, 180, 255, 150], // 연한 파랑
        [140, 140, 255, 200], // 중간 파랑
        [100, 100, 255, 225], // 진한 파랑
        [60, 60, 255, 255], // 가장 진한 파랑
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
