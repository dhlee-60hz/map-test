import { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import WebGLTileLayer from "ol/layer/WebGLTile";
import XYZ from "ol/source/XYZ";
import GeoTIFF from "ol/source/GeoTIFF";
import "ol/ol.css";

export function OpenLayersExample() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // OSM 베이스맵 레이어 추가
    const osmLayer = new TileLayer({
      source: new XYZ({
        url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attributions: "© OpenStreetMap contributors",
      }),
    });

    // GeoTIFF 소스 생성
    const geoTiffSource = new GeoTIFF({
      sources: [
        {
          url: "/data/cloud_data.tiff",
        },
      ],
    });

    // GeoTIFF 레이어 생성
    const geoTiffLayer = new WebGLTileLayer({
      source: geoTiffSource,
    });

    // 지도 생성
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, geoTiffLayer],
      view: new View({
        center: [127.7669, 35.9078],
        zoom: 6,
        projection: "EPSG:4326",
      }),
    });

    return () => map.setTarget(undefined);
  }, []);

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}
