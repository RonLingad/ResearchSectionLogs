
import { Routes, Route } from "react-router-dom";
import Registration from "./pages/Registration";
import AdminControl from "./pages/AdminControl";
import Admin from "./pages/Admin";

function App() {
  return (
    <Routes>
      {/* Registration Page - Remains Unchanged */}
      <Route
        path="/"
        element={<Registration />}
      />

      {/* Admin URL - Shows Maintenance Page */}
      <Route
        path="/admin"
        element={<Admin />}
      />

      {/* Admin Control - Remains Unchanged */}
      <Route
        path="/admincontrol"
        element={<AdminControl />}
      />
    </Routes>
  );
}

export default App;
