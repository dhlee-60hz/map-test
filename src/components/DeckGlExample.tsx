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
            points.push({
              position: [data.X[i][j], data.Y[i][j]],
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
