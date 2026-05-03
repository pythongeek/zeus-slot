import { Routes, Route } from "react-router";
import Game from "./pages/Game";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

/**
 * Standalone App — no tRPC, no backend required.
 * Use this entry when running without the API server.
 */
function AppStandalone() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppStandalone;
