import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import "./LibraryCardLostRequest.css";

const PATRON_TYPES = [
  "Student",
  "Faculty",
  "NTP",
];

const STATUS_OPTIONS = [
  "Pending",
  "Printed",
  "Claimed",
];

export default function LibraryCardLostRequest() {
  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  /* =====================================================
     FORM
  ===================================================== */

  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    grade: "",
    section: "",
    patronType: "Student",
  });

  /* =====================================================
     FILTER
  ===================================================== */

  const [statusFilter, setStatusFilter] =
    useState("All");

  /* =====================================================
     FETCH REQUESTS
  ===================================================== */

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: fetchError } =
        await supabase
          .from("library_card_requests")
          .select("*")
          .order("created_at", {
            ascending: false,
          });

      if (fetchError) {
        throw fetchError;
      }

      setRequests(data || []);
    } catch (err) {
      console.error(
        "Error fetching library card requests:",
        err
      );

      setError(
        "Unable to load library card requests."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  /* =====================================================
     FORM CHANGE
  ===================================================== */

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =====================================================
     SUBMIT FORM
  ===================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccessMessage("");

    /* -----------------------------------------------
       VALIDATION
    ------------------------------------------------ */

    if (
      !formData.lastName.trim() ||
      !formData.firstName.trim() ||
      !formData.grade.trim() ||
      !formData.section.trim()
    ) {
      setError(
        "Please complete all required fields."
      );

      return;
    }

    try {
      setSubmitting(true);

      const { data, error: insertError } =
        await supabase
          .from("library_card_requests")
          .insert([
            {
              last_name:
                formData.lastName.trim(),

              first_name:
                formData.firstName.trim(),

              middle_name:
                formData.middleName.trim() ||
                null,

              grade:
                formData.grade.trim(),

              section:
                formData.section.trim(),

              patron_type:
                formData.patronType,

              status: "Pending",
            },
          ])
          .select()
          .single();

      if (insertError) {
        throw insertError;
      }

      /* -----------------------------------------------
         ADD NEW REQUEST TO LIST
      ------------------------------------------------ */

      setRequests((previous) => [
        data,
        ...previous,
      ]);

      /* -----------------------------------------------
         CLEAR FORM
      ------------------------------------------------ */

      setFormData({
        lastName: "",
        firstName: "",
        middleName: "",
        grade: "",
        section: "",
        patronType: "Student",
      });

      setSuccessMessage(
        "Library card request added successfully."
      );

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      console.error(
        "Error adding library card request:",
        err
      );

      setError(
        "Unable to add the request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =====================================================
     UPDATE STATUS
  ===================================================== */

  const updateStatus = async (
    requestId,
    newStatus
  ) => {
    try {
      setUpdatingId(requestId);

      setError("");

      const { error: updateError } =
        await supabase
          .from("library_card_requests")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);

      if (updateError) {
        throw updateError;
      }

      /* -----------------------------------------------
         UPDATE LOCAL LIST
      ------------------------------------------------ */

      setRequests((previous) =>
        previous.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: newStatus,
              }
            : request
        )
      );
    } catch (err) {
      console.error(
        "Error updating status:",
        err
      );

      setError(
        "Unable to update the request status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  /* =====================================================
     FILTERED REQUESTS
  ===================================================== */

  const filteredRequests = useMemo(() => {
    if (statusFilter === "All") {
      return requests;
    }

    return requests.filter(
      (request) =>
        request.status === statusFilter
    );
  }, [requests, statusFilter]);

  /* =====================================================
     COUNTS
  ===================================================== */

  const pendingCount = requests.filter(
    (request) =>
      request.status === "Pending"
  ).length;

  const printedCount = requests.filter(
    (request) =>
      request.status === "Printed"
  ).length;

  const claimedCount = requests.filter(
    (request) =>
      request.status === "Claimed"
  ).length;

  /* =====================================================
     NAME FORMAT
  ===================================================== */

  const formatName = (request) => {
    const middleName =
      request.middle_name
        ? ` ${request.middle_name}`
        : "";

    return `${request.last_name}, ${request.first_name}${middleName}`;
  };

  /* =====================================================
     DATE FORMAT
  ===================================================== */

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  /* =====================================================
     STATUS CLASS
  ===================================================== */

  const getStatusClass = (status) => {
    switch (status) {
      case "Pending":
        return "library-status-pending";

      case "Printed":
        return "library-status-printed";

      case "Claimed":
        return "library-status-claimed";

      default:
        return "";
    }
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="library-card-page">

        <div className="library-card-loading">

          <div className="library-card-spinner"></div>

          <p>
            Loading library card requests...
          </p>

        </div>

      </div>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <div className="library-card-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="library-card-page-header">

        <div>

          <h1>
            Library Card Lost Request
          </h1>

          <p>
            Manage requests for replacement
            library cards.
          </p>

        </div>

        <button
          className="library-card-refresh"
          onClick={fetchRequests}
        >
          ↻ Refresh
        </button>

      </div>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="library-card-message error">
          {error}
        </div>
      )}


      {/* =================================================
          SUCCESS
      ================================================= */}

      {successMessage && (
        <div className="library-card-message success">
          {successMessage}
        </div>
      )}


      {/* =================================================
          REQUEST FORM
      ================================================= */}

      <div className="library-card-panel">

        <div className="library-card-panel-header">

          <div>

            <h2>
              New Lost Card Request
            </h2>

            <p>
              Enter the patron information
              to create a request.
            </p>

          </div>

        </div>


        <form
          className="library-card-form"
          onSubmit={handleSubmit}
        >

          {/* -------------------------------------------
              LAST NAME
          -------------------------------------------- */}

          <div className="library-card-form-group">

            <label>
              Last Name
              <span>*</span>
            </label>

            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Enter last name"
              required
            />

          </div>


          {/* -------------------------------------------
              FIRST NAME
          -------------------------------------------- */}

          <div className="library-card-form-group">

            <label>
              First Name
              <span>*</span>
            </label>

            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="Enter first name"
              required
            />

          </div>


          {/* -------------------------------------------
              MIDDLE NAME
          -------------------------------------------- */}

          <div className="library-card-form-group">

            <label>
              Middle Name
            </label>

            <input
              type="text"
              name="middleName"
              value={formData.middleName}
              onChange={handleInputChange}
              placeholder="Enter middle name"
            />

          </div>


          {/* -------------------------------------------
              GRADE
          -------------------------------------------- */}

          <div className="library-card-form-group">

            <label>
              Grade
              <span>*</span>
            </label>

            <input
              type="text"
              name="grade"
              value={formData.grade}
              onChange={handleInputChange}
              placeholder="e.g. Grade 6"
              required
            />

          </div>


          {/* -------------------------------------------
              SECTION
          -------------------------------------------- */}

          <div className="library-card-form-group">

            <label>
              Section
              <span>*</span>
            </label>

            <input
              type="text"
              name="section"
              value={formData.section}
              onChange={handleInputChange}
              placeholder="e.g. St. Benedict"
              required
            />

          </div>


          {/* -------------------------------------------
              PATRON TYPE
          -------------------------------------------- */}

          <div className="library-card-form-group">

            <label>
              Patron Type
              <span>*</span>
            </label>

            <select
              name="patronType"
              value={formData.patronType}
              onChange={handleInputChange}
              required
            >

              {PATRON_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}

            </select>

          </div>


          {/* -------------------------------------------
              SUBMIT
          -------------------------------------------- */}

          <div className="library-card-form-action">

            <button
              type="submit"
              disabled={submitting}
              className="library-card-submit"
            >
              {submitting
                ? "Adding..."
                : "+ Add Request"}
            </button>

          </div>

        </form>

      </div>


      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="library-card-summary">

        <div
          className={`library-card-summary-card ${
            statusFilter === "All"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setStatusFilter("All")
          }
        >

          <span>
            All Requests
          </span>

          <strong>
            {requests.length}
          </strong>

        </div>


        <div
          className={`library-card-summary-card pending ${
            statusFilter === "Pending"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setStatusFilter("Pending")
          }
        >

          <span>
            Pending
          </span>

          <strong>
            {pendingCount}
          </strong>

        </div>


        <div
          className={`library-card-summary-card printed ${
            statusFilter === "Printed"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setStatusFilter("Printed")
          }
        >

          <span>
            Printed
          </span>

          <strong>
            {printedCount}
          </strong>

        </div>


        <div
          className={`library-card-summary-card claimed ${
            statusFilter === "Claimed"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setStatusFilter("Claimed")
          }
        >

          <span>
            Claimed
          </span>

          <strong>
            {claimedCount}
          </strong>

        </div>

      </div>


      {/* =================================================
          REQUEST LIST
      ================================================= */}

      <div className="library-card-panel">

        <div className="library-card-list-header">

          <div>

            <h2>
              Library Card Requests
            </h2>

            <p>
              View and manage submitted
              replacement card requests.
            </p>

          </div>


          {/* -------------------------------------------
              STATUS FILTER
          -------------------------------------------- */}

          <div className="library-card-filter">

            <label>
              Filter by Status
            </label>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="All">
                All
              </option>

              {STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}

            </select>

          </div>

        </div>


        {/* =================================================
            TABLE
        ================================================= */}

        {filteredRequests.length === 0 ? (

          <div className="library-card-empty">

            <div className="library-card-empty-icon">
              📋
            </div>

            <h3>
              No Requests Found
            </h3>

            <p>
              There are no{" "}
              {statusFilter !== "All"
                ? statusFilter.toLowerCase()
                : ""}{" "}
              library card requests.
            </p>

          </div>

        ) : (

          <div className="library-card-table-wrapper">

            <table className="library-card-table">

              <thead>

                <tr>

                  <th>
                    #
                  </th>

                  <th>
                    Name
                  </th>

                  <th>
                    Grade
                  </th>

                  <th>
                    Section
                  </th>

                  <th>
                    Patron Type
                  </th>

                  <th>
                    Date Requested
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredRequests.map(
                  (request, index) => (

                    <tr
                      key={request.id}
                    >

                      {/* NUMBER */}

                      <td>
                        {index + 1}
                      </td>


                      {/* NAME */}

                      <td>

                        <div className="library-card-name">

                          <strong>
                            {formatName(
                              request
                            )}
                          </strong>

                        </div>

                      </td>


                      {/* GRADE */}

                      <td>
                        {request.grade ||
                          "—"}
                      </td>


                      {/* SECTION */}

                      <td>
                        {request.section ||
                          "—"}
                      </td>


                      {/* PATRON TYPE */}

                      <td>

                        <span className="library-patron-type">

                          {request.patron_type}

                        </span>

                      </td>


                      {/* DATE */}

                      <td>

                        {formatDate(
                          request.created_at
                        )}

                      </td>


                      {/* STATUS */}

                      <td>

                        <span
                          className={`library-card-status ${getStatusClass(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>

                      </td>


                      {/* ACTION */}

                      <td>

                        <div className="library-card-actions">

                          {/* PENDING */}

                          {request.status ===
                            "Pending" && (

                            <button
                              className="library-action-button printed"
                              disabled={
                                updatingId ===
                                request.id
                              }
                              onClick={() =>
                                updateStatus(
                                  request.id,
                                  "Printed"
                                )
                              }
                            >
                              {updatingId ===
                              request.id
                                ? "Updating..."
                                : "Mark Printed"}
                            </button>

                          )}


                          {/* PRINTED */}

                          {request.status ===
                            "Printed" && (

                            <button
                              className="library-action-button claimed"
                              disabled={
                                updatingId ===
                                request.id
                              }
                              onClick={() =>
                                updateStatus(
                                  request.id,
                                  "Claimed"
                                )
                              }
                            >
                              {updatingId ===
                              request.id
                                ? "Updating..."
                                : "Mark Claimed"}
                            </button>

                          )}


                          {/* CLAIMED */}

                          {request.status ===
                            "Claimed" && (

                            <span className="library-completed-label">
                              Completed
                            </span>

                          )}

                        </div>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}