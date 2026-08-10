import "./Registration.css";
import background from "../assets/hfabg.jpg";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Registration() {
  const [fullname, setFullname] = useState("");
  const [grade, setGrade] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [endTime, setEndTime] = useState("");

  // ==========================
  // Live Clock
  // ==========================
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();

      setCurrentTime(
        now.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };

    updateClock();

    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);

  // ==========================
  // Register Student
  // ==========================
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!fullname.trim() || !grade) {
      alert("Please complete all required fields.");
      return;
    }

    setLoading(true);

    // Current local time when student hits submit
    const sessionIn = new Date();

    // Session End (+15 Minutes)
    const sessionOut = new Date(sessionIn.getTime() + 15 * 60 * 1000);

    const { error } = await supabase.from("logs").insert([
      {
        fullname: fullname.trim(),
        grade: grade,

        // Pass native Date objects or standard ISO string
        session_in: sessionIn.toISOString(),
        session_out: sessionOut.toISOString(),
      },
    ]);

    setLoading(false);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setEndTime(
      sessionOut.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );

    setShowModal(true);

    setFullname("");
    setGrade("");

    setTimeout(() => {
      setShowModal(false);
    }, 5000);
  };

  return (
    <div
      className="registration-page"
      style={{
        backgroundImage: `url(${background})`,
      }}
    >
      <div className="overlay"></div>

      <div className="registration-container">
        <div className="clock">{currentTime}</div>

        <h1>Internet and Research Section</h1>

        <h3>Usage Registration</h3>
        <p className="subtitle">
          Please enter your information before using a computer.
        </p>

        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Enter your full name"
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
          />

          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">Select Grade Level</option>
            <option>Grade 1</option>
            <option>Grade 2</option>
            <option>Grade 3</option>
            <option>Grade 4</option>
            <option>Grade 5</option>
            <option>Grade 6</option>
            <option>Teacher</option>
            <option>Non-Teaching Personel</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="reminders">
          <h4>Reminders</h4>

          <ul>
            <li>Register before using the computer.</li>
            <li>Handle all equipment with care.</li>
            <li>No food or drinks inside the laboratory.</li>
            <li>Save your files before leaving.</li>
            <li>Let the officer in charge assign a computer.</li>
            <li>Log out after using the computer.</li>
          </ul>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="checkmark">✔</div>

            <h2>Registration Successful!</h2>

            <p>You may now use the computer.</p>

            <p>Your session ends at</p>

            <h3>{endTime}</h3>

            <button onClick={() => setShowModal(false)}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}