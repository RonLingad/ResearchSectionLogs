
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

  const [showRulesModal, setShowRulesModal] = useState(true);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const availablePurposes = [
    "Aralinks",
    "Research",
    "Epic Reading",
    "Reading",
    "Trivia Search",
    "Print",
    "Others",
  ];

  const internetRules = [
    "Use the internet for educational purposes only, such as searching for assignments, activities, research, balitaan, trivia, printing, Aralinks, and other school-related tasks.",
    "Using Google Maps or browsing pictures and websites unrelated to assignments is prohibited. This includes randomly searching for cars, toys, anime, and similar content.",
    "Always close all browser tabs and log out of all accounts before leaving the computer.",
    "Each computer session is limited to a maximum of 15 minutes.",
    "Browsing, searching for, or watching inappropriate content is strictly prohibited and may result in a warning.",
    "Online games and social media are strongly discouraged and must not be used during computer sessions.",
  ];

  const handlePurposeChange = (purpose) => {
    setPurposes((prev) =>
      prev.includes(purpose)
        ? prev.filter((p) => p !== purpose)
        : [...prev, purpose]
    );
  };

  // LIVE CLOCK
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

  // REGISTER WORKSTATION
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!fullname.trim() || !grade) {
      setAlertMessage(
        "Please enter your name and select a grade level."
      );
      setShowAlertModal(true);
      return;
    }

    if (purposes.length === 0) {
      setAlertMessage(
        "Please select at least one purpose for your visit."
      );
      setShowAlertModal(true);
      return;
    }

    setLoading(true);

    const sessionIn = new Date();
    const sessionOut = new Date(
      sessionIn.getTime() + 15 * 60 * 1000
    );

    try {
      const { error } = await supabase.from("logs").insert([
        {
          fullname: fullname.trim(),
          grade: grade,
          purposes: purposes,
          session_in: sessionIn.toISOString(),
          session_out: sessionOut.toISOString(),
        },
      ]);

      if (error) {
        console.error(error);
        setAlertMessage(error.message);
        setShowAlertModal(true);
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
    } catch (error) {
      console.error(error);
      setAlertMessage(
        "Something went wrong while registering. Please try again."
      );
      setShowAlertModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = () => {
    setShowModal(false);
    setShowRulesModal(true);
  };

  return (
    <div
      className="registration-page"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="overlay"></div>

      <div className="registration-container">

        {/* HEADER SECTION */}
        <div className="registration-header">
          <h1 className="title">
            Internet & Research Section
          </h1>

          <p className="subtitle">
            Student Computer Access Registration
          </p>
        </div>

        {/* CONTENT LAYOUT */}
        <div className="registration-content">

          {/* REGISTRATION FORM */}
          <div className="form-card">
            <h3>Usage Registration</h3>

            <p className="form-instruction">
              Please complete your details to initiate a
              computer workstation session.
            </p>

            <form onSubmit={handleRegister}>

              {/* FULL NAME */}
              <div className="input-group">
                <label htmlFor="fullname">
                  Full Name
                </label>

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
                    onChange={(e) =>
                      setFullname(e.target.value)
                    }
                  />
                </div>
              </div>

              {/* GRADE / ROLE */}
              <div className="input-group">
                <label htmlFor="grade">
                  Grade / Role
                </label>

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
                    onChange={(e) =>
                      setGrade(e.target.value)
                    }
                  >
                    <option value="">
                      Select Option...
                    </option>

                    <option value="Grade 1">Grade 1</option>
                    <option value="Grade 2">Grade 2</option>
                    <option value="Grade 3">Grade 3</option>
                    <option value="Grade 4">Grade 4</option>
                    <option value="Grade 5">Grade 5</option>
                    <option value="Grade 6">Grade 6</option>

                    <option value="Teacher">
                      Teacher
                    </option>

                    <option value="Non-Teaching Personnel">
                      Non-Teaching Personnel
                    </option>
                  </select>
                </div>
              </div>

              {/* PURPOSE OF VISIT */}
              <div className="input-group">
                <label>Purpose of Visit</label>

                <div className="checkbox-grid">
                  {availablePurposes.map((item) => (
                    <label
                      key={item}
                      className="checkbox-label"
                    >
                      <input
                        type="checkbox"
                        checked={purposes.includes(item)}
                        onChange={() =>
                          handlePurposeChange(item)
                        }
                      />

                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading">
                    <span className="btn-spinner"></span>
                    Processing...
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

          {/* LABORATORY GUIDELINES */}
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
                <span>
                  Register at the station before using any computer.
                </span>
              </li>

              <li>
                <span className="rule-num">2</span>
                <span>
                  Let the staff-in-charge assign your workstation.
                </span>
              </li>

              <li>
                <span className="rule-num">3</span>
                <span>
                  Handle all equipment with care and cleanliness.
                </span>
              </li>

              <li>
                <span className="rule-num">4</span>
                <span>
                  Strictly no food or drinks inside the laboratory.
                </span>
              </li>

              <li>
                <span className="rule-num">5</span>
                <span>
                  Save files to cloud storage before leaving.
                </span>
              </li>

              <li>
                <span className="rule-num">6</span>
                <span>
                  Log out and clean your work area when finished.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* INTERNET USAGE REMINDER POPUP */}
      {showRulesModal && (
        <div
          className="rules-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.70)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "12px",
            boxSizing: "border-box",
          }}
        >
          <div
            className="rules-modal"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "4px",
              padding: "24px 30px",
              width: "100%",
              maxWidth: "1150px",
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              boxSizing: "border-box",
              border: "1px solid #e5e7eb",
            }}
          >
            {/* POPUP HEADER AND LIVE CLOCK */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap",
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: "14px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.6rem",
                    fontWeight: "800",
                    color: "#111827",
                    letterSpacing: "0.3px",
                  }}
                >
                  FIRST, A REMINDER!
                </h2>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#6b7280",
                    fontSize: "0.9rem",
                  }}
                >
                  Please read and follow the internet usage
                  rules before proceeding with your registration.
                </p>
              </div>

              {/* LIVE CLOCK INSIDE POPUP */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 15px",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#16a34a",
                    fontSize: "0.72rem",
                    fontWeight: "800",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#22c55e",
                    }}
                  ></span>
                  LIVE
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: "800",
                      color: "#111827",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {currentTime}
                  </div>

                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#6b7280",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {currentDate}
                  </div>
                </div>
              </div>
            </div>

            {/* INTRODUCTION */}
            <p
              style={{
                color: "#374151",
                fontSize: "0.9rem",
                lineHeight: "1.5",
                marginBottom: "16px",
              }}
            >
              Computers and internet access are provided
              for educational purposes only. All students
              and users are expected to observe the
              following rules:
            </p>

            {/* RULES - TWO COLUMNS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "10px 16px",
                marginBottom: "18px",
              }}
            >
              {internetRules.map((rule, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 14px",
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: "700",
                      color: "#2563eb",
                      minWidth: "20px",
                    }}
                  >
                    {index + 1}.
                  </span>

                  <p
                    style={{
                      margin: 0,
                      color: "#374151",
                      fontSize: "0.88rem",
                      lineHeight: "1.5",
                    }}
                  >
                    {rule}
                  </p>
                </div>
              ))}
            </div>

            {/* WARNING FOOTER */}
            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                paddingTop: "14px",
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#dc2626",
                  fontSize: "0.9rem",
                  fontWeight: "700",
                }}
              >
                PLEASE USE THE INTERNET RESPONSIBLY!
              </p>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#6b7280",
                  fontSize: "0.82rem",
                }}
              >
                Failure to follow these rules may result
                in a warning.
              </p>
            </div>

            {/* PROCEED BUTTON */}
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              style={{
                width: "100%",
                padding: "13px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                fontSize: "0.95rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              I Understand, Proceed to Registration
            </button>
          </div>
        </div>
      )}

      {/* VALIDATION ALERT MODAL */}
      {showAlertModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setShowAlertModal(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "10px",
              padding: "28px 24px",
              maxWidth: "380px",
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid #fee2e2",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                backgroundColor: "#fef2f2",
                color: "#ef4444",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <svg
                style={{
                  width: "32px",
                  height: "32px",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "1.25rem",
                fontWeight: "700",
                color: "#111827",
              }}
            >
              Missing Information
            </h3>

            <p
              style={{
                margin: "0 0 24px 0",
                fontSize: "0.95rem",
                color: "#4b5563",
                lineHeight: "1.5",
              }}
            >
              {alertMessage}
            </p>

            <button
              type="button"
              onClick={() => setShowAlertModal(false)}
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Got it, thanks
            </button>
          </div>
        </div>
      )}

      {/* REGISTRATION SUCCESS MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >
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
              <span className="session-label">
                Your Session Expires At
              </span>

              <span className="session-time">
                {endTime}
              </span>
            </div>

            <button
              className="modal-close-btn"
              onClick={handleStartSession}
            >
              Start Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
