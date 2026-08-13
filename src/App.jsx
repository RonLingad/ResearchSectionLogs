import { Routes, Route } from "react-router-dom";
import Registration from "./pages/Registration";
import AdminControl from "./pages/AdminControl";
import Purpose from "./pages/Purpose"; // 1. Added Purpose import

function App() {
  return (
    <Routes>
      <Route path="/" element={<Registration />} />
      <Route path="/admincontrol" element={<AdminControl />} />
      <Route path="/purpose" element={<Purpose />} /> {/* 2. Removed extra quote */}
    </Routes>
  );
}

export default App;