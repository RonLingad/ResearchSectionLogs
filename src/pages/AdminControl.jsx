
import React from "react";

export default function Admin() {
  return (
    <>
      <style>{`
        .maintenance-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
          font-family: Arial, Helvetica, sans-serif;
          background: #fff;
        }

        .maintenance-icon {
          font-size: 40px;
          color: #dc2626;
          margin-bottom: 20px;
        }

        .maintenance-badge {
          color: #b91c1c;
          background: #fee2e2;
          padding: 7px 14px;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 1px;
          border-radius: 4px;
        }

        .maintenance-page h1 {
          color: #991b1b;
          font-size: 26px;
          margin: 20px 0 10px;
        }

        .maintenance-page p {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.7;
          max-width: 550px;
        }

        .maintenance-notice {
          margin-top: 20px;
          padding: 15px;
          max-width: 550px;
          background: #fef2f2;
          border-left: 3px solid #dc2626;
          text-align: left;
        }

        .maintenance-notice strong {
          color: #991b1b;
          font-size: 13px;
        }

        .maintenance-notice p {
          margin-bottom: 0;
        }

        .maintenance-footer {
          margin-top: 25px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          width: 100%;
          max-width: 350px;
        }

        .maintenance-footer .footer-message {
          font-size: 13px;
        }

        .developer-signature {
          margin-top: 15px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        @media (max-width: 600px) {
          .maintenance-page h1 {
            font-size: 22px;
          }
        }
      `}</style>

      <div className="maintenance-page">

        <div className="maintenance-icon">
          ⚙
        </div>

        <span className="maintenance-badge">
          SYSTEM MAINTENANCE
        </span>

        <h1>System Temporarily Unavailable</h1>

        <p>
          Administrative access is temporarily disabled.
          The system is currently undergoing maintenance and
          migration to a locally hosted environment to strengthen
          data security and improve system reliability.
        </p>

        <div className="maintenance-notice">
          <strong>Maintenance Notice</strong>
          <p>
            Administrative services will remain unavailable
            while system updates and security improvements
            are being implemented.
          </p>
        </div>

        <p style={{ marginTop: "20px" }}>
          We apologize for the inconvenience. Please wait for
          further notice regarding system availability.
        </p>

        <div className="maintenance-footer">
          <p className="footer-message">
            Thank you for your patience and cooperation.
          </p>

          <div className="developer-signature">
            <u style={{
              color: "#111827",
              textUnderlineOffset: "3px"
            }}>
              Airon Lingad
            </u>

            <span style={{
              color: "#6b7280",
              fontSize: "12px"
            }}>
              System Developer
            </span>
          </div>
        </div>

      </div>
    </>
  );
}
