import React, { useEffect } from "react";
import maplibreGl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export function MapLibreExample() {
  useEffect(() => {
    const map = new maplibreGl.Map({
      container: "map",
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [127.7669, 35.9078],
      zoom: 4,
    });

    map.on("load", () => {
      console.log("Map loaded");

      // 벡터 소스 추가
      map.addSource("cloud_data", {
        type: "vector",
        tiles: ["http://localhost:8080/data/cloud_data/{z}/{x}/{y}.pbf"],
      });

      // Heatmap 레이어 추가
      map.addLayer({
        id: "cloud_heatmap",
        type: "heatmap",
        source: "cloud_data",
        "source-layer": "cloud_layer", // 실제 벡터 타일의 레이어 이름
        paint: {
          // Heatmap 가중치: 맑음(2) 데이터는 제외
          "heatmap-weight": [
            "case",
            ["==", ["get", "cloud_status"], 0],
            1, // 구름(높은 신뢰도) → 가중치 1
            ["==", ["get", "cloud_status"], 1],
            0.6, // 구름(낮은 신뢰도) → 가중치 0.6
            0, // 맑음(2) 및 기타 값은 가중치 0
          ],
          // Heatmap 반지름: 줌 레벨에 따라 조정
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            2, // 줌 레벨 0에서는 반지름 2
            10,
            20, // 줌 레벨 10에서는 반지름 20
          ],
          // Heatmap 색상: 구름 → 파랑/하늘색, 맑음은 투명
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"], // 밀도에 따라 색상 변화
            0,
            "rgba(255, 255, 255, 0)", // 낮은 밀도: 투명
            0.2,
            "rgba(128, 128, 128, 1)", // 구름(낮은 신뢰도)
            1,
            "rgba(0, 0, 255, 1)", // 구름(높은 신뢰도)
          ],
          // Heatmap 불투명도
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.5, // 줌 레벨 0에서 불투명도
            10,
            0.5, // 줌 레벨 10에서 불투명도
          ],
        },
      });
    });

    // 지도에 네비게이션 컨트롤 추가
    map.addControl(new maplibreGl.NavigationControl());

    return () => map.remove();
  }, []);

  return <div id="map" style={{ width: "100%", height: "100vh" }} />;
}
