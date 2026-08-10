import { Routes, Route } from "react-router-dom";
import Registration from "./pages/Registration";
import AdminControl from "./pages/AdminControl";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Registration />} />
      <Route path="/admincontrol" element={<AdminControl />} />
    </Routes>
  );
}

export default App;