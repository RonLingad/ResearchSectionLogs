import "./Registration.css";
import background from "../assets/hfabg.jpg";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Registration() {
  const [fullname, setFullname] = useState("");
  const [grade, setGrade] = useState("");
  const [purposes, setPurposes] = useState([]);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [endTime, setEndTime] = useState("");

  const availablePurposes = [
    "Aralinks",
    "Research",
    "Epic Reading",
    "Reading",
    "Trivia Search",
    "Print",
    "Others",
  ];

  // Toggle checkbox state
  const handlePurposeChange = (purpose) => {
    setPurposes((prev) =>
      prev.includes(purpose)
        ? prev.filter((p) => p !== purpose)
        : [...prev, purpose]
    );
  };

  // Live Clock & Date
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

      setCurrentDate(
        now.toLocaleDateString("en-PH", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Register Student
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!fullname.trim() || !grade) {
      alert("Please enter your name and select a grade level.");
      return;
    }

    if (purposes.length === 0) {
      alert("Please select at least one purpose for your visit.");
      return;
    }

    setLoading(true);

    const sessionIn = new Date();
    const sessionOut = new Date(sessionIn.getTime() + 15 * 60 * 1000);

    const { error } = await supabase.from("logs").insert([
      {
        fullname: fullname.trim(),
        grade: grade,
        purposes: purposes, // Array of strings (or user purposes.join(', ') if storing as text)
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
    setPurposes([]);
  };

  return (
    <div
      className="registration-page"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="overlay"></div>

      <div className="registration-container">
        {/* Header Section */}
        <div className="registration-header">
          <div className="clock-pill">
            <div className="live-indicator">
              <span className="dot"></span>
              LIVE
            </div>
            <div className="clock-details">
              <span className="clock-time">{currentTime}</span>
              <span className="clock-date">{currentDate}</span>
            </div>
          </div>

          <h1 className="title">Internet & Research Section</h1>
          <p className="subtitle">Student Computer Access Registration</p>
        </div>

        {/* Content Layout */}
        <div className="registration-content">
          {/* Form Side */}
          <div className="form-card">
            <h3>Usage Registration</h3>
            <p className="form-instruction">
              Please complete your details to initiate a computer workstation session.
            </p>

            <form onSubmit={handleRegister}>
              <div className="input-group">
                <label htmlFor="fullname">Full Name</label>
                <div className="input-field-wrapper">
                  <svg
                    className="input-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <input
                    id="fullname"
                    type="text"
                    placeholder="Juan De La Cruz"
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="grade">Grade / Role</label>
                <div className="input-field-wrapper">
                  <svg
                    className="input-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <select
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                  >
                    <option value="">Select Option...</option>
                    <option value="Grade 1">Grade 1</option>
                    <option value="Grade 2">Grade 2</option>
                    <option value="Grade 3">Grade 3</option>
                    <option value="Grade 4">Grade 4</option>
                    <option value="Grade 5">Grade 5</option>
                    <option value="Grade 6">Grade 6</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Non-Teaching Personnel">
                      Non-Teaching Personnel
                    </option>
                  </select>
                </div>
              </div>

              {/* Purpose Checkboxes */}
              <div className="input-group">
                <label>Purpose of Visit</label>
                <div className="checkbox-grid">
                  {availablePurposes.map((item) => (
                    <label key={item} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={purposes.includes(item)}
                        onChange={() => handlePurposeChange(item)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading">
                    <span className="btn-spinner"></span> Processing...
                  </span>
                ) : (
                  <>
                    <span>Register Workstation</span>
                    <svg
                      className="btn-arrow"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Laboratory Guidelines Side */}
          <div className="reminders-card">
            <div className="reminders-header">
              <svg
                className="reminder-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h4>Laboratory Guidelines</h4>
            </div>

            <ul className="reminder-list">
              <li>
                <span className="rule-num">1</span>
                <span>Register at the station before using any computer.</span>
              </li>
              <li>
                <span className="rule-num">2</span>
                <span>Let the officer-in-charge assign your workstation.</span>
              </li>
              <li>
                <span className="rule-num">3</span>
                <span>Handle all equipment with care and cleanliness.</span>
              </li>
              <li>
                <span className="rule-num">4</span>
                <span>Strictly no food or drinks inside the laboratory.</span>
              </li>
              <li>
                <span className="rule-num">5</span>
                <span>Save files to cloud storage before leaving.</span>
              </li>
              <li>
                <span className="rule-num">6</span>
                <span>Log out and clean your work area when finished.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Success Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="success-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="checkmark-wrapper">
              <svg
                className="checkmark-svg"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2>Registration Successful!</h2>
            <p className="modal-subtext">
              You may now proceed to your assigned workstation.
            </p>

            <div className="session-card">
              <span className="session-label">Your Session Expires At</span>
              <span className="session-time">{endTime}</span>
            </div>

            <button
              className="modal-close-btn"
              onClick={() => setShowModal(false)}
            >
              Start Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}