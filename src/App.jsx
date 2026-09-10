import { Routes, Route } from "react-router-dom";
import Registration from "./pages/Registration";
import AdminControl from "./pages/AdminControl";

function App() {
  return (
    <Routes>
      {/* Registration / Login */}
      <Route
        path="/"
        element={<Registration />}
      />

      {/* Admin Panel */}
      <Route
        path="/admincontrol"
        element={<AdminControl />}
      />
    </Routes>
  );
}

export default App;