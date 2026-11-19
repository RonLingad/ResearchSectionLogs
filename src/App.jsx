
import { Routes, Route } from "react-router-dom";

import Registration from "./pages/Registration";
import AdminControl from "./pages/AdminControl";
import Admin from "./pages/Admin";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Registration />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admincontrol" element={<AdminControl />} />

    </Routes>
  );
}

export default App;
