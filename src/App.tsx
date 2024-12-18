import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MapLibreExample } from "./components/MapLibreExample";
import { OpenLayersExample } from "./components/OpenLayersExample";
import { DeckGlExample } from "./components/DeckGlExample";
import { DeckGlExample2 } from "./components/DeckGlExample2";
import { DeckGlGeoTiffExample } from "./components/DeckGlGeoTiffExample";
import "./global.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/maplibre" element={<MapLibreExample />} />
        <Route path="/openlayers" element={<OpenLayersExample />} />
        <Route path="/deckgl" element={<DeckGlExample />} />
        <Route path="/deckgl2" element={<DeckGlExample2 />} />
        <Route path="/deckgl-geotiff" element={<DeckGlGeoTiffExample />} />
      </Routes>
    </Router>
  );
}

export default App;
