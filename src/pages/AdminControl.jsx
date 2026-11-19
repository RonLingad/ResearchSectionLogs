
import React from "react";

export default function Admin() {
  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .maintenance-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: #f8fafc;
          font-family: Arial, Helvetica, sans-serif;
        }

        .maintenance-card {
          width: 100%;
          max-width: 580px;
          padding: 45px 35px;
          text-align: center;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }

        .maintenance-icon {
          width: 70px;
          height: 70px;
          margin: 0 auto 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fef2f2;
          border-radius: 50%;
          color: #dc2626;
          font-size: 32px;
        }

        .maintenance-badge {
          display: inline-block;
          padding: 7px 14px;
          color: #b91c1c;
          background: #fee2e2;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .maintenance-card h1 {
          margin: 22px 0 12px;
          color: #991b1b;
          font-size: 28px;
          font-weight: 700;
        }

        .maintenance-subtitle {
          margin-bottom: 18px;
          color: #374151;
          font-size: 15px;
          font-weight: 600;
        }

        .maintenance-description {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.7;
        }

        .maintenance-notice {
          margin-top: 25px;
          padding: 18px;
          background: #fef2f2;
          border-left: 3px solid #dc2626;
          text-align: left;
        }

        .maintenance-notice strong {
          display: block;
          margin-bottom: 7px;
          color: #991b1b;
          font-size: 13px;
        }

        .maintenance-notice p {
          margin: 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.7;
        }

        .maintenance-thanks {
          margin-top: 22px;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.7;
        }

        .maintenance-footer {
          margin-top: 25px;
          padding-top: 18px;
          border-top: 1px solid #e5e7eb;
          color: #b91c1c;
          font-size: 13px;
          font-weight: 600;
        }

        @media (max-width: 600px) {
          .maintenance-card {
            padding: 35px 22px;
          }

          .maintenance-card h1 {
            font-size: 24px;
          }
        }
      `}</style>

      <div className="maintenance-container">
        <div className="maintenance-card">

          <div className="maintenance-icon">
            ⚙
          </div>

          <span className="maintenance-badge">
            SYSTEM MAINTENANCE
          </span>

          <h1>System Temporarily Unavailable</h1>

          <p className="maintenance-subtitle">
            Administrative access is temporarily disabled.
          </p>

          <p className="maintenance-description">
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

          <p className="maintenance-thanks">
            We apologize for any inconvenience. Please wait for
            further notice regarding system availability.
          </p>


        <div className="maintenance-footer">
          <p className="footer-message">
            Thank you for your patience and cooperation.
          </p>

          <div className="developer-signature">
            <br />
            <u style={{ color: "#111827", textUnderlineOffset: "3px" }}>
              Airon Lingad
            </u> <br />
            <span style={{ color: "#6b7280", fontSize: "12px" }}>
              System Developer
            </span>
          </div>
        </div>


        </div>
      </div>
    </>
  );
}

