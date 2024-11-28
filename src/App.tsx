import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MapLibreExample } from "./components/MapLibreExample";
import { OpenLayersExample } from "./components/OpenLayersExample";
import { DeckGlExample } from "./components/DeckGlExample";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/maplibre" element={<MapLibreExample />} />
        <Route path="/openlayers" element={<OpenLayersExample />} />
        <Route path="/deckgl" element={<DeckGlExample />} />
      </Routes>
    </Router>
  );
}

export default App;
