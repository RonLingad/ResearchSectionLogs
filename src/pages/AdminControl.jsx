import "./AdminControl.css";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminControl() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");

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
      console.error(error);
    } else {
      setLogs(data || []);
    }

    setLoading(false);
  }

  // ===============================
  // FILTERS
  // ===============================

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchName = log.fullname
        ?.toLowerCase()
        .includes(search.toLowerCase());

      const matchGrade =
        gradeFilter === "All" || log.grade === gradeFilter;

      const dateVal = log.session_in || log.created_at;
      const month = dateVal ? new Date(dateVal).getMonth() + 1 : 0;

      const matchMonth =
        monthFilter === "All" || month === Number(monthFilter);

      return matchName && matchGrade && matchMonth;
    });
  }, [logs, search, gradeFilter, monthFilter]);

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
    // Peak hours computation (by hour block 0-23)
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
  // FORMAT DATE/TIME
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
    const excelData = filteredLogs.map((log) => {
      const sessionInVal = log.session_in || log.created_at;
      const sessionOutVal = log.session_out;

      return {
        Name: log.fullname ? log.fullname.toUpperCase() : "",
        Grade: log.grade ? log.grade.toUpperCase() : "",
        Date: formatDate(sessionInVal),
        "Session In": formatTime(sessionInVal),
        "Session Out": formatTime(sessionOutVal),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Logs");
    XLSX.writeFile(workbook, "Internet_Research_Section_Log.xlsx");
  }

  // ===============================
  // EXPORT TO PDF
  // ===============================

  function exportPDF() {
    const doc = new jsPDF();

    // 1. HEADER SECTION
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("HOLY FAMILY ACADEMY", 105, 15, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Angeles City, Philippines", 105, 21, { align: "center" });

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Internet Research Section Logs Report", 105, 28, {
      align: "center",
    });

    // Sub-info / Meta
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated Date: ${new Date().toLocaleDateString("en-PH")}`, 14, 36);
    doc.text(`Total Filtered Records: ${analytics.filteredTotal}`, 14, 41);
    doc.text(`Peak Usage Duration: ${analytics.peakHourText}`, 14, 46);

    // 2. MAIN LOGS TABLE
    const tableBody = filteredLogs.map((log) => {
      const sessionInVal = log.session_in || log.created_at;
      const sessionOutVal = log.session_out;

      return [
        log.fullname ? log.fullname.toUpperCase() : "",
        log.grade ? log.grade.toUpperCase() : "",
        formatDate(sessionInVal),
        formatTime(sessionInVal),
        formatTime(sessionOutVal),
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [["Student Name", "Grade", "Date", "Session In", "Session Out"]],
      body: tableBody,
      theme: "striped",
      headStyles: { fillColor: [22, 101, 192] },
      styles: { fontSize: 8 },
    });

    // 3. GRADE BREAKDOWN SUMMARY TABLE
    const summaryY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Logs Summary per Grade Level", 14, summaryY);

    const gradeSummaryData = Object.entries(analytics.gradeCounts).map(
      ([grade, count]) => [grade, count]
    );

    autoTable(doc, {
      startY: summaryY + 4,
      head: [["Grade Level", "Total Logs"]],
      body: gradeSummaryData,
      theme: "grid",
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 8 },
      tableWidth: 100, // Compact summary table width
    });

    doc.save("Internet_Research_Section_Report.pdf");
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Internet & Research Section</h1>
          <p>Student Computer Usage Logs</p>
        </div>
      </header>

      {/* ===========================
            ANALYTICS
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
            TOOLBAR
      =========================== */}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search Student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
        >
          <option value="All">All Grades</option>
          <option>Grade 1</option>
          <option>Grade 2</option>
          <option>Grade 3</option>
          <option>Grade 4</option>
          <option>Grade 5</option>
          <option>Grade 6</option>
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

        <button onClick={fetchLogs}>Refresh</button>
        <button onClick={exportExcel}>Export Excel</button>
        <button onClick={exportPDF} style={{ backgroundColor: "#dc2626" }}>
          Export PDF
        </button>
      </div>

      {/* ===========================
            TABLE
      =========================== */}

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
                <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>
                  Loading records...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>
                  No records found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const sessionInTime = log.session_in || log.created_at;
                const sessionOutTime = log.session_out;

                return (
                  <tr key={log.id}>
                    <td>{log.fullname ? log.fullname.toUpperCase() : ""}</td>
                    <td>{log.grade ? log.grade.toUpperCase() : ""}</td>
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