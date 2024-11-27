import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MapLibreExample } from "./components/MapLibreExample";
import { OpenLayersExample } from "./components/OpenLayersExample";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/maplibre" element={<MapLibreExample />} />
        <Route path="/openlayers" element={<OpenLayersExample />} />
        {/* <Route path="/deckgl" element={<DeckGlExample />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
