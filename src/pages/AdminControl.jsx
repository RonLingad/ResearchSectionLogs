import "./AdminControl.css";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import Purpose from "./Purpose";
import LibraryCardLostRequest from "./LibraryCardLostRequest";
import UsageData from "./UsageData";
import RecordsData from "./RecordsData";


const ADMIN_USERNAME = "libraryadmin";
const ADMIN_PASSWORD = "imcpassword";


function cleanName(value) {
  if (!value) return "N/A";

  return String(value)
    // Convert special characters to spaces
    .replace(/[.,;:'"`!?()[\]{}<>/\\|@#$%^&*_+=~`-]/g, " ")

    // Keep letters and numbers
    .replace(/[^\p{L}\p{N}\s]/gu, "")

    // Remove extra spaces
    .replace(/\s+/g, " ")

    // Remove spaces at beginning/end
    .trim()

    // Convert to uppercase
    .toUpperCase();
}

// ==========================================
// CLEAN GRADE
// ==========================================

function cleanGrade(value) {
  if (!value) return "N/A";

  return String(value)
    .replace(/[.,;:'"`!?()[\]{}<>/\\|@#$%^&*_+=~`-]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export default function AdminControl() {


  const [isLoggedIn, setIsLoggedIn] = useState(
    sessionStorage.getItem("libraryAdminLoggedIn") === "true"
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  function handleLogin(e) {
    e.preventDefault();

    if (
      username === ADMIN_USERNAME &&
      password === ADMIN_PASSWORD
    ) {
      sessionStorage.setItem(
        "libraryAdminLoggedIn",
        "true"
      );

      setIsLoggedIn(true);
      setUsername("");
      setPassword("");
      setLoginError("");
    } else {
      setLoginError(
        "Invalid username or password."
      );
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(
      "libraryAdminLoggedIn"
    );

    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
    setLoginError("");
  }

  // ==========================================
  // ACTIVE SECTION
  // ==========================================

  const [activePage, setActivePage] =
    useState("records");

  // ==========================================
  // DATA
  // ==========================================

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // FILTERS
  // ==========================================

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] =
    useState("All");
  const [monthFilter, setMonthFilter] =
    useState("All");
  const [yearFilter, setYearFilter] =
    useState("All");

  // ==========================================
  // PAGINATION
  // ==========================================

  const [currentPage, setCurrentPage] =
    useState(1);

  const itemsPerPage = 15;

  // ==========================================
  // FETCH DATA
  // ==========================================

  useEffect(() => {
    if (isLoggedIn) {
      fetchLogs();
    }
  }, [isLoggedIn]);

  async function fetchLogs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .order("session_in", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Error fetching logs:",
        error
      );
    } else {
      setLogs(data || []);
    }

    setLoading(false);
  }

  // ==========================================
  // AVAILABLE YEARS
  // ==========================================

  const availableYears = useMemo(() => {
    const years = new Set();

    logs.forEach((log) => {
      const dateValue =
        log.session_in ||
        log.created_at;

      if (!dateValue) return;

      const year =
        new Date(dateValue).getFullYear();

      years.add(year);
    });

    return Array.from(years).sort(
      (a, b) => b - a
    );
  }, [logs]);

  // ==========================================
  // FILTER LOGS
  // ==========================================

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // CLEAN NAME BEFORE SEARCH
      const studentName =
        cleanName(log.fullname)
          .toLowerCase();

      const searchText =
        search
          .toLowerCase()
          .trim();

      const matchesSearch =
        studentName.includes(searchText);

      const matchesGrade =
        gradeFilter === "All" ||
        log.grade?.toLowerCase() ===
          gradeFilter.toLowerCase();

      const dateValue =
        log.session_in ||
        log.created_at;

      let matchesMonth = true;
      let matchesYear = true;

      if (dateValue) {
        const date =
          new Date(dateValue);

        const month =
          date.getMonth() + 1;

        const year =
          date.getFullYear();

        if (monthFilter !== "All") {
          matchesMonth =
            month ===
            Number(monthFilter);
        }

        if (yearFilter !== "All") {
          matchesYear =
            year ===
            Number(yearFilter);
        }
      }

      return (
        matchesSearch &&
        matchesGrade &&
        matchesMonth &&
        matchesYear
      );
    });
  }, [
    logs,
    search,
    gradeFilter,
    monthFilter,
    yearFilter,
  ]);

  // ==========================================
  // PAGINATION
  // ==========================================

  const totalPages =
    Math.ceil(
      filteredLogs.length /
        itemsPerPage
    ) || 1;

  const currentTableData =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        itemsPerPage;

      return filteredLogs.slice(
        start,
        start + itemsPerPage
      );
    }, [
      filteredLogs,
      currentPage,
    ]);

  function changePage(page) {
    if (
      page >= 1 &&
      page <= totalPages
    ) {
      setCurrentPage(page);
    }
  }

  // ==========================================
  // FILTER HANDLER
  // ==========================================

  function updateFilter(
    setter,
    value
  ) {
    setter(value);
    setCurrentPage(1);
  }

  function resetFilters() {
    setSearch("");
    setGradeFilter("All");
    setMonthFilter("All");
    setYearFilter("All");
    setCurrentPage(1);
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  const analytics = useMemo(() => {
    const today = new Date();

    let todayCount = 0;
    let monthCount = 0;

    const hourlyUsage = {};

    logs.forEach((log) => {
      const dateValue =
        log.session_in ||
        log.created_at;

      if (!dateValue) return;

      const date =
        new Date(dateValue);

      // TODAY
      if (
        date.toDateString() ===
        today.toDateString()
      ) {
        todayCount++;
      }

      // THIS MONTH
      if (
        date.getMonth() ===
          today.getMonth() &&
        date.getFullYear() ===
          today.getFullYear()
      ) {
        monthCount++;
      }

      // PEAK HOUR
      const hour =
        date.getHours();

      hourlyUsage[hour] =
        (hourlyUsage[hour] || 0) + 1;
    });

    let peakHour = null;
    let peakCount = 0;

    Object.entries(
      hourlyUsage
    ).forEach(
      ([hour, count]) => {
        if (count > peakCount) {
          peakHour =
            Number(hour);

          peakCount =
            count;
        }
      }
    );

    let peakText = "N/A";

    if (peakHour !== null) {
      const startHour =
        peakHour % 12 === 0
          ? 12
          : peakHour % 12;

      const endHourValue =
        (peakHour + 1) % 24;

      const endHour =
        endHourValue % 12 === 0
          ? 12
          : endHourValue % 12;

      const startPeriod =
        peakHour >= 12
          ? "PM"
          : "AM";

      const endPeriod =
        endHourValue >= 12
          ? "PM"
          : "AM";

      peakText =
        `${startHour}:00 ${startPeriod} - ${endHour}:00 ${endPeriod}`;
    }

    return {
      total: logs.length,
      today: todayCount,
      month: monthCount,
      filtered: filteredLogs.length,
      peakText,
      peakCount,
    };
  }, [
    logs,
    filteredLogs,
  ]);

  // ==========================================
  // DATE FORMAT
  // ==========================================

  function formatDate(value) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }

  // ==========================================
  // TIME FORMAT
  // ==========================================

  function formatTime(value) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleTimeString(
      "en-PH",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    );
  }

  // ==========================================
  // EXCEL EXPORT
  // ==========================================

  function exportExcel() {
    if (
      filteredLogs.length === 0
    ) {
      alert(
        "No data available to export."
      );

      return;
    }

    const data =
      filteredLogs.map(
        (log) => {
          const sessionIn =
            log.session_in ||
            log.created_at;

          return {
            "Student Name":
              cleanName(
                log.fullname
              ),

            Grade:
              cleanGrade(
                log.grade
              ),

            Date:
              formatDate(
                sessionIn
              ),

            "Session In":
              formatTime(
                sessionIn
              ),

            "Session Out":
              formatTime(
                log.session_out
              ),
          };
        }
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        data
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Usage Logs"
    );

    XLSX.writeFile(
      workbook,
      "Internet_Research_Logs.xlsx"
    );
  }

  // ==========================================
  // PDF EXPORT
  // ==========================================

 
// ==========================================
// PDF EXPORT
// ==========================================

function exportPDF() {
  if (filteredLogs.length === 0) {
    alert("No data available to export.");
    return;
  }

  function toTitleCase(value) {
  if (!value) return "N/A";

  return cleanName(value)
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ==========================================
  // DATE PARAMETERS
  // ==========================================

  const monthNames = [
    "January", "February", "March",
    "April", "May", "June",
    "July", "August", "September",
    "October", "November", "December"
  ];

  const selectedMonth =
    monthFilter === "All"
      ? "All Months"
      : monthNames[Number(monthFilter) - 1];

  const selectedYear =
    yearFilter === "All"
      ? "All Years"
      : yearFilter;

  const selectedGrade =
    gradeFilter === "All"
      ? "All Grades"
      : gradeFilter;

  // Determine actual date coverage of exported records
  const recordDates = filteredLogs
    .map((log) => log.session_in || log.created_at)
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter((date) => !isNaN(date.getTime()))
    .sort((a, b) => a - b);

  const dateRange =
    recordDates.length > 0
      ? `${recordDates[0].toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })} - ${recordDates[recordDates.length - 1].toLocaleDateString(
          "en-PH",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        )}`
      : "No date available";

  const exportDate = new Date().toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ==========================================
  // REPORT HEADER
  // ==========================================

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);

  doc.text("HOLY FAMILY ACADEMY", pageWidth / 2, 10, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text("Internet & Research Section", pageWidth / 2, 15, {
    align: "center",
  });

  // Thin divider
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.2);
  doc.line(8, 18, pageWidth - 8, 18);

  // ==========================================
  // REPORT PARAMETERS
  // ==========================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);

  doc.text("RECORD PARAMETERS", 8, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  doc.text(`Date Range: ${dateRange}`, 8, 28);
  doc.text(`Month: ${selectedMonth}`, 85, 28);
  doc.text(`Year: ${selectedYear}`, 150, 28);

  doc.text(`Grade: ${selectedGrade}`, 8, 33);
  doc.text(`Total Records: ${filteredLogs.length}`, 85, 33);
  doc.text(`Peak Usage: ${analytics.peakText}`, 150, 33);

  doc.setTextColor(110, 110, 110);
  doc.text(`Generated: ${exportDate}`, pageWidth - 8, 33, {
    align: "right",
  });

  // ==========================================
  // TABLE DATA
  // ==========================================

  const tableData = filteredLogs.map((log, index) => {
    const sessionIn = log.session_in || log.created_at;

    return [
      index + 1,
      toTitleCase(log.fullname),
      cleanGrade(log.grade),
      formatDate(sessionIn),
      formatTime(sessionIn),
      formatTime(log.session_out),
    ];
  });

  // ==========================================
  // SIMPLE PDF TABLE
  // ==========================================

  autoTable(doc, {
    startY: 38,

    head: [[
      "#",
      "Student Name",
      "Grade",
      "Date",
      "Session In",
      "Session Out",
    ]],

    body: tableData,

    theme: "grid",

    margin: {
      top: 8,
      left: 12,
      right: 8,
      bottom: 12,
    },

    styles: {
      font: "Verdana",
      fontSize: 8,
      cellPadding: 1,
      textColor: [0, 0, 0],
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: "middle",
      overflow: "ellipsize",
      minCellHeight: 5,
    },

    headStyles: {
      fillColor: [235, 240, 245],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 1.5,
      lineColor: [200, 205, 210],
      lineWidth: 0.1,
      halign: "center",
    },

    bodyStyles: {
      fillColor: [255, 255, 255],
    },

    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },

    columnStyles: {
      0: {
        cellWidth: 10,
        halign: "center",
      },
      1: {
        cellWidth: 95,
        halign: "left",
      },
      2: {
        cellWidth: 30,
        halign: "center",
      },
      3: {
        cellWidth: 45,
        halign: "center",
      },
      4: {
        cellWidth: 40,
        halign: "center",
      },
      5: {
        cellWidth: 40,
        halign: "center",
      },
    },

    // Repeat header on every page
    showHead: "everyPage",

    // ==========================================
    // PAGE NUMBER
    // ==========================================

    didDrawPage: () => {
      const pageNumber =
        doc.internal.getCurrentPageInfo().pageNumber;

      const pageCount =
        doc.internal.getNumberOfPages();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);

      doc.text(
        `Internet & Research Records | Page ${pageNumber} of ${pageCount}`,
        pageWidth - 8,
        pageHeight - 5,
        {
          align: "right",
        }
      );
    },
  });

  // ==========================================
  // SAVE PDF
  // ==========================================

  doc.save("Internet_Research_Report.pdf");
}


  // ==========================================
  // SIDEBAR MENU ITEM CLASS
  // ==========================================

  function menuClass(page) {
    return activePage === page
      ? "menu-item active"
      : "menu-item";
  }

  // ==========================================
  // LOGIN SCREEN
  // ==========================================

  if (!isLoggedIn) {
    return (
      <div className="admin-login-page">

        <div className="admin-login-card">

          <div className="admin-login-header">

            <h1>
              Library Admin
            </h1>

            <p>
              Internet & Research Section
            </p>

          </div>

          <form
            onSubmit={handleLogin}
          >

            <div className="admin-login-field">

              <label>
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                  )
                }
                placeholder="Enter username"
                autoComplete="username"
                required
              />

            </div>

            <div className="admin-login-field">

              <label>
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />

            </div>

            {loginError && (
              <div className="admin-login-error">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="admin-login-button"
            >
              Login
            </button>

          </form>

        </div>

      </div>
    );
  }

  // ==========================================
  // MAIN ADMIN PANEL
  // ==========================================

  return (
    <div className="admin-panel">

      {/* SIDEBAR */}

      <aside className="admin-sidebar">

        <div className="sidebar-brand">

          <h1>
            Admin Panel
          </h1>

          <span>
            Internet & Research
          </span>

        </div>

        <div className="side-peak">

          <span>
            Peak Usage
          </span>

          <strong>
            {analytics.peakText}
          </strong>

          <small>
            {analytics.peakCount} records
          </small>

        </div>

        <div className="sidebar-menu">

          <button
            type="button"
            className={menuClass(
              "records"
            )}
            onClick={() =>
              setActivePage(
                "records"
              )
            }
          >
            Records
          </button>

          <button
            type="button"
            className={menuClass(
              "records-data"
            )}
            onClick={() =>
              setActivePage(
                "records-data"
              )
            }
          >
            Record Data
          </button>

          <button
            type="button"
            className={menuClass(
              "usage"
            )}
            onClick={() =>
              setActivePage(
                "usage"
              )
            }
          >
            Usage
          </button>

          <button
            type="button"
            className={menuClass(
              "usage-data"
            )}
            onClick={() =>
              setActivePage(
                "usage-data"
              )
            }
          >
            Usage Data
          </button>

          <button
            type="button"
            className={menuClass(
              "library-card-lost"
            )}
            onClick={() =>
              setActivePage(
                "library-card-lost"
              )
            }
          >
            Library Card Lost Request
          </button>

        </div>

        {/* ANALYTICS */}

        <div className="sidebar-analytics">

          <div className="menu-title">
            ANALYTICS
          </div>

          <div className="side-stat">

            <span>
              Total
            </span>

            <strong>
              {analytics.total}
            </strong>

          </div>

          <div className="side-stat">

            <span>
              Today
            </span>

            <strong>
              {analytics.today}
            </strong>

          </div>

          <div className="side-stat">

            <span>
              This Month
            </span>

            <strong>
              {analytics.month}
            </strong>

          </div>

          <div className="side-stat">

            <span>
              Showing
            </span>

            <strong>
              {analytics.filtered}
            </strong>

          </div>

        </div>

        {/* LOGOUT */}

        <div className="sidebar-logout">

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Log Out
          </button>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="admin-content">

        {/* RECORDS */}

        {activePage ===
          "records" && (
          <>

            {/* TOP BAR */}

            <div className="top-bar">

              <div className="breadcrumb">

                Home

                <span>
                  /
                </span>

                Records

              </div>

              <div className="result-count">

                Results{" "}

                <strong>
                  {
                    filteredLogs.length
                  }
                </strong>

              </div>

            </div>

            {/* FILTER BAR */}

            <div className="control-bar">

              {/* SEARCH */}

              <div className="search-box">

                <input
                  type="text"
                  placeholder="Search student name"
                  value={search}
                  onChange={(e) =>
                    updateFilter(
                      setSearch,
                      e.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="search-button"
                >
                  Search
                </button>

              </div>

              {/* GRADE */}

              <select
                value={gradeFilter}
                onChange={(e) =>
                  updateFilter(
                    setGradeFilter,
                    e.target.value
                  )
                }
              >

                <option value="All">
                  All Grades
                </option>

                <option value="Grade 1">
                  Grade 1
                </option>

                <option value="Grade 2">
                  Grade 2
                </option>

                <option value="Grade 3">
                  Grade 3
                </option>

                <option value="Grade 4">
                  Grade 4
                </option>

                <option value="Grade 5">
                  Grade 5
                </option>

                <option value="Grade 6">
                  Grade 6
                </option>

                <option value="Teacher">
                  Teacher
                </option>

                <option value="Non-Teaching Personnel">
                  Non-Teaching Personnel
                </option>

              </select>

              {/* MONTH */}

              <select
                value={monthFilter}
                onChange={(e) =>
                  updateFilter(
                    setMonthFilter,
                    e.target.value
                  )
                }
              >

                <option value="All">
                  All Months
                </option>

                <option value="1">
                  January
                </option>

                <option value="2">
                  February
                </option>

                <option value="3">
                  March
                </option>

                <option value="4">
                  April
                </option>

                <option value="5">
                  May
                </option>

                <option value="6">
                  June
                </option>

                <option value="7">
                  July
                </option>

                <option value="8">
                  August
                </option>

                <option value="9">
                  September
                </option>

                <option value="10">
                  October
                </option>

                <option value="11">
                  November
                </option>

                <option value="12">
                  December
                </option>

              </select>

              {/* YEAR */}

              <select
                value={yearFilter}
                onChange={(e) =>
                  updateFilter(
                    setYearFilter,
                    e.target.value
                  )
                }
              >

                <option value="All">
                  All Years
                </option>

                {availableYears.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}

              </select>

              {/* RESET */}

              <button
                type="button"
                className="reset-button"
                onClick={
                  resetFilters
                }
              >
                Reset
              </button>

              <div className="control-spacer" />

              {/* REFRESH */}

              <button
                type="button"
                className="action-button"
                onClick={
                  fetchLogs
                }
                disabled={
                  loading
                }
              >
                {loading
                  ? "Loading"
                  : "Refresh"}
              </button>

              {/* EXCEL */}

              <button
                type="button"
                className="export-button excel"
                onClick={
                  exportExcel
                }
              >
                Excel
              </button>

              {/* PDF */}

              <button
                type="button"
                className="export-button pdf"
                onClick={
                  exportPDF
                }
              >
                PDF
              </button>

            </div>

            {/* RECORDS TABLE */}

            <div className="records-table">

              <table>

                <thead>

                  <tr>

                    <th className="number-column">
                      #
                    </th>

                    <th>
                      Student Name
                    </th>

                    <th>
                      Grade
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Session In
                    </th>

                    <th>
                      Session Out
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {loading ? (

                    <tr>

                      <td
                        colSpan="6"
                        className="empty-row"
                      >
                        Loading records...
                      </td>

                    </tr>

                  ) : currentTableData.length ===
                    0 ? (

                    <tr>

                      <td
                        colSpan="6"
                        className="empty-row"
                      >
                        No records found.
                      </td>

                    </tr>

                  ) : (

                    currentTableData.map(
                      (
                        log,
                        index
                      ) => {

                        const sessionIn =
                          log.session_in ||
                          log.created_at;

                        return (

                          <tr
                            key={
                              log.id
                            }
                          >

                            <td className="number-column">

                              {(currentPage -
                                1) *
                                itemsPerPage +
                                index +
                                1}

                            </td>

                            {/* CLEANED NAME */}

                            <td
                              className="name-cell"
                              style={{
                                color:
                                  "#000000",
                                textTransform:
                                  "uppercase",
                                fontWeight:
                                  "500",
                              }}
                            >

                              {cleanName(
                                log.fullname
                              )}

                            </td>

                            {/* GRADE */}

                            <td>

                              <span className="grade-label">

                                {cleanGrade(
                                  log.grade
                                )}

                              </span>

                            </td>

                            <td>

                              {formatDate(
                                sessionIn
                              )}

                            </td>

                            <td className="time-cell">

                              {formatTime(
                                sessionIn
                              )}

                            </td>

                            <td className="time-cell">

                              {formatTime(
                                log.session_out
                              )}

                            </td>

                          </tr>

                        );
                      }
                    )

                  )}

                </tbody>

              </table>

            </div>

            {/* PAGINATION */}

            <div className="table-footer">

              <div className="pagination">

                <button
                  type="button"
                  disabled={
                    currentPage ===
                    1
                  }
                  onClick={() =>
                    changePage(
                      currentPage -
                        1
                    )
                  }
                >
                  Previous
                </button>

                {Array.from(
                  {
                    length:
                      totalPages,
                  },
                  (
                    _,
                    index
                  ) =>
                    index + 1
                )
                  .slice(
                    Math.max(
                      0,
                      currentPage -
                        3
                    ),
                    Math.min(
                      totalPages,
                      currentPage +
                        2
                    )
                  )
                  .map(
                    (page) => (

                      <button
                        key={
                          page
                        }
                        type="button"
                        className={
                          currentPage ===
                          page
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          changePage(
                            page
                          )
                        }
                      >
                        {
                          page
                        }
                      </button>

                    )
                  )}

                <button
                  type="button"
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  onClick={() =>
                    changePage(
                      currentPage +
                        1
                    )
                  }
                >
                  Next
                </button>

              </div>

              <div className="footer-results">

                Results{" "}

                <strong>
                  {filteredLogs.length ===
                  0
                    ? 0
                    : (currentPage -
                        1) *
                        itemsPerPage +
                      1}
                </strong>

                {" - "}

                <strong>
                  {Math.min(
                    currentPage *
                      itemsPerPage,
                    filteredLogs.length
                  )}
                </strong>

                {" of "}

                <strong>
                  {
                    filteredLogs.length
                  }
                </strong>

              </div>

            </div>

          </>
        )}

        {/* USAGE */}

        {activePage ===
          "usage" && (
          <div className="embedded-page">
            <Purpose />
          </div>
        )}

        {/* LIBRARY CARD LOST */}

        {activePage ===
          "library-card-lost" && (
          <div className="embedded-page">
            <LibraryCardLostRequest />
          </div>
        )}

        {/* USAGE DATA */}

        {activePage ===
          "usage-data" && (
          <div className="embedded-page">
            <UsageData />
          </div>
        )}

        {/* RECORD DATA */}

        {activePage ===
          "records-data" && (
          <div className="embedded-page">
            <RecordsData />
          </div>
        )}

      </main>

    </div>
  );
}