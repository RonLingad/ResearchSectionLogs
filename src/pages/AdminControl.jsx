import "./AdminControl.css";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminControl() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .order("session_in", { ascending: false });

    if (error) {
      console.error("Error fetching logs:", error);
    } else {
      setLogs(data || []);
    }

    setLoading(false);
  }

  // Extract unique available years from logs
  const availableYears = useMemo(() => {
    const years = new Set();
    logs.forEach((log) => {
      const dateVal = log.session_in || log.created_at;
      if (dateVal) {
        years.add(new Date(dateVal).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [logs]);

  // Reset all filters
  const resetFilters = () => {
    setSearch("");
    setGradeFilter("All");
    setMonthFilter("All");
    setYearFilter("All");
  };

  // Check if any filter is active
  const isFiltered =
    search !== "" ||
    gradeFilter !== "All" ||
    monthFilter !== "All" ||
    yearFilter !== "All";

  // ===============================
  // FILTERS LOGIC
  // ===============================

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Name match
      const matchName = log.fullname
        ?.toLowerCase()
        .includes(search.toLowerCase());

      // Grade match
      const matchGrade =
        gradeFilter === "All" ||
        log.grade?.toLowerCase() === gradeFilter.toLowerCase();

      // Date match
      const dateVal = log.session_in || log.created_at;
      const logDate = dateVal ? new Date(dateVal) : null;

      const month = logDate ? logDate.getMonth() + 1 : 0;
      const year = logDate ? logDate.getFullYear() : 0;

      const matchMonth =
        monthFilter === "All" || month === Number(monthFilter);
      const matchYear =
        yearFilter === "All" || year === Number(yearFilter);

      return matchName && matchGrade && matchMonth && matchYear;
    });
  }, [logs, search, gradeFilter, monthFilter, yearFilter]);

  // ===============================
  // ANALYTICS & PEAK HOURS LOGIC
  // ===============================

  const analytics = useMemo(() => {
    const today = new Date();

    const todayLogs = logs.filter((log) => {
      const dateVal = log.session_in || log.created_at;
      if (!dateVal) return false;
      const date = new Date(dateVal);
      return date.toDateString() === today.toDateString();
    }).length;

    const monthLogs = logs.filter((log) => {
      const dateVal = log.session_in || log.created_at;
      if (!dateVal) return false;
      const date = new Date(dateVal);
      return (
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    }).length;

    // Grade breakdown computation
    const gradeCounts = {};
    const hourCounts = {};

    filteredLogs.forEach((log) => {
      // Grade tally
      const gradeKey = log.grade ? log.grade.toUpperCase() : "UNSPECIFIED";
      gradeCounts[gradeKey] = (gradeCounts[gradeKey] || 0) + 1;

      // Peak hour tally
      const sessionInVal = log.session_in || log.created_at;
      if (sessionInVal) {
        const hour = new Date(sessionInVal).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    // Find peak hour
    let peakHour = null;
    let maxHourCount = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = Number(hour);
      }
    });

    let peakHourText = "N/A";
    if (peakHour !== null) {
      const startPeriod = peakHour >= 12 ? "PM" : "AM";
      const startFormatted = peakHour % 12 === 0 ? 12 : peakHour % 12;
      const endHour = (peakHour + 1) % 24;
      const endPeriod = endHour >= 12 ? "PM" : "AM";
      const endFormatted = endHour % 12 === 0 ? 12 : endHour % 12;

      peakHourText = `${startFormatted}:00 ${startPeriod} - ${endFormatted}:00 ${endPeriod} (${maxHourCount} logs)`;
    }

    return {
      total: logs.length,
      today: todayLogs,
      month: monthLogs,
      filteredTotal: filteredLogs.length,
      gradeCounts,
      peakHourText,
    };
  }, [logs, filteredLogs]);

  // ===============================
  // FORMAT DATE / TIME
  // ===============================

  function formatDate(dateValue) {
    if (!dateValue) return "-";
    return new Date(dateValue).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(dateValue) {
    if (!dateValue) return "-";
    return new Date(dateValue).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  // ===============================
  // EXPORT TO EXCEL
  // ===============================

  function exportExcel() {
    if (filteredLogs.length === 0) {
      alert("No data available to export!");
      return;
    }

    const excelData = filteredLogs.map((log) => {
      const sessionInVal = log.session_in || log.created_at;
      const sessionOutVal = log.session_out;

      return {
        "Student Name": log.fullname ? log.fullname.toUpperCase() : "N/A",
        "Grade Level": log.grade ? log.grade.toUpperCase() : "N/A",
        "Date": formatDate(sessionInVal),
        "Session In": formatTime(sessionInVal),
        "Session Out": formatTime(sessionOutVal),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-fit column widths
    const columnWidths = [
      { wch: 28 }, // Student Name
      { wch: 15 }, // Grade
      { wch: 15 }, // Date
      { wch: 15 }, // Session In
      { wch: 15 }, // Session Out
    ];
    worksheet["!cols"] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Logs");

    const dateStamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Internet_Research_Logs_${dateStamp}.xlsx`);
  }

  // ===============================
  // EXPORT TO PDF
  // ===============================

  function exportPDF() {
    if (filteredLogs.length === 0) {
      alert("No data available to export!");
      return;
    }

    const doc = new jsPDF();

    // Header Title Block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("HOLY FAMILY ACADEMY", 105, 14, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Angeles City, Philippines", 105, 20, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text("Internet Research Section Logs Report", 105, 26, {
      align: "center",
    });

    // Horizontal Rule
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    // Report Metadata
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleString("en-PH")}`, 14, 36);
    doc.text(`Total Records Displayed: ${analytics.filteredTotal}`, 14, 41);
    doc.text(`Peak Usage Duration: ${analytics.peakHourText}`, 14, 46);

    // Table Content Setup
    const tableBody = filteredLogs.map((log) => {
      const sessionInVal = log.session_in || log.created_at;
      const sessionOutVal = log.session_out;

      return [
        log.fullname ? log.fullname.toUpperCase() : "-",
        log.grade ? log.grade.toUpperCase() : "-",
        formatDate(sessionInVal),
        formatTime(sessionInVal),
        formatTime(sessionOutVal),
      ];
    });

    // Logs Table
    autoTable(doc, {
      startY: 51,
      head: [["Student Name", "Grade", "Date", "Session In", "Session Out"]],
      body: tableBody,
      theme: "plain",
      headStyles: {
        fillColor: [15, 23, 42], // Slate 900
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // Grade Level Breakdown Summary Block
    let finalY = doc.lastAutoTable.finalY + 10;

    // Check if new page is needed for summary table
    if (finalY > 230) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Grade Level Usage Summary", 14, finalY);

    const gradeSummaryData = Object.entries(analytics.gradeCounts).map(
      ([grade, count]) => [
        grade,
        count.toString(),
        `${((count / (analytics.filteredTotal || 1)) * 100).toFixed(1)}%`,
      ]
    );

    autoTable(doc, {
      startY: finalY + 4,
      head: [["Grade Level", "Total Logs", "Share"]],
      body: gradeSummaryData,
      theme: "plain",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 30, halign: "center" },
      },
      tableWidth: 110,
    });

    // Footer Page Numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Page ${i} of ${pageCount}`,
        196,
        287,
        { align: "right" }
      );
    }

    const dateStamp = new Date().toISOString().split("T")[0];
    doc.save(`Internet_Research_Report_${dateStamp}.pdf`);
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Internet & Research Section</h1>
          <p>Student Computer Usage Logs & Analytics Dashboard</p>
        </div>
      </header>

      {/* ===========================
            ANALYTICS DASHBOARD
      =========================== */}
      <div className="analytics">
        <div className="analytics-box">
          <h2>{analytics.total}</h2>
          <span>Total Logs</span>
        </div>

        <div className="analytics-box">
          <h2>{analytics.today}</h2>
          <span>Today's Logs</span>
        </div>

        <div className="analytics-box">
          <h2>{analytics.month}</h2>
          <span>This Month</span>
        </div>

        <div className="analytics-box">
          <h2 style={{ fontSize: "1.1rem" }}>{analytics.peakHourText}</h2>
          <span>Peak Usage Hours</span>
        </div>
      </div>

      {/* ===========================
            ENHANCED SINGLE-ROW TOOLBAR
      =========================== */}
      <div className="toolbar">
        {/* Left Side: Filter Controls */}
        <div className="toolbar-filters">
          <div className="search-wrapper">
            <svg
              className="search-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
            <input
              type="text"
              placeholder="Search by student name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option value="All">All Grades</option>
            <option value="Grade 1">Grade 1</option>
            <option value="Grade 2">Grade 2</option>
            <option value="Grade 3">Grade 3</option>
            <option value="Grade 4">Grade 4</option>
            <option value="Grade 5">Grade 5</option>
            <option value="Grade 6">Grade 6</option>
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="All">All Months</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="All">All Years</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {isFiltered && (
            <button
              type="button"
              className="btn-reset"
              onClick={resetFilters}
              title="Reset all filters"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn-action btn-refresh"
            onClick={fetchLogs}
            disabled={loading}
            title="Refresh logs"
          >
            <svg
              className={`btn-icon ${loading ? "spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>

          <button
            type="button"
            className="btn-action btn-excel"
            onClick={exportExcel}
            title="Export data to Excel"
          >
            <svg
              className="btn-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Excel
          </button>

          <button
            type="button"
            className="btn-action btn-pdf"
            onClick={exportPDF}
            title="Export data to PDF report"
          >
            <svg
              className="btn-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* ===========================
            LOGS TABLE
      =========================== */}
      <div className="table-header-info">
        <span>
          Showing <strong>{analytics.filteredTotal}</strong> of{" "}
          <strong>{analytics.total}</strong> records
        </span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Grade</th>
              <th>Date</th>
              <th>Session In</th>
              <th>Session Out</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="table-status-cell">
                  <div className="spinner"></div> Loading records...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-status-cell">
                  No records match the selected filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const sessionInTime = log.session_in || log.created_at;
                const sessionOutTime = log.session_out;

                return (
                  <tr key={log.id}>
                    <td className="student-name">
                      {log.fullname ? log.fullname.toUpperCase() : "N/A"}
                    </td>
                    <td>
                      <span className="badge-grade">
                        {log.grade ? log.grade.toUpperCase() : "N/A"}
                      </span>
                    </td>
                    <td>{formatDate(sessionInTime)}</td>
                    <td>{formatTime(sessionInTime)}</td>
                    <td>{formatTime(sessionOutTime)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}