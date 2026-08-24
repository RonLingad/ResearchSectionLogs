import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function Purpose() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [analytics, setAnalytics] = useState({});
  const [totalSelections, setTotalSelections] = useState(0);

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const chartContainerRef = useRef(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("fullname, purposes, session_in")
        .order("session_in", { ascending: false });

      if (error) {
        console.error("Error fetching logs:", error);
        setLoading(false);
        return;
      }

      const safeData = data || [];
      setLogs(safeData);
      calculateAnalytics(safeData, selectedMonth);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (e) => {
    const month = e.target.value;
    setSelectedMonth(month);
    setCurrentPage(1);
    calculateAnalytics(logs, month);
  };

  const calculateAnalytics = (data, monthFilter) => {
    const counts = {
      Aralinks: 0,
      Research: 0,
      "Epic Reading": 0,
      Reading: 0,
      "Trivia Search": 0,
      Print: 0,
      Others: 0,
    };

    let grandTotal = 0;

    data.forEach((entry) => {
      let rawPurposes = entry?.purposes;
      if (!rawPurposes) return;

      if (monthFilter !== "ALL" && entry.session_in) {
        const entryMonth = new Date(entry.session_in).toLocaleString(
          "default",
          { month: "long" }
        );
        if (entryMonth !== monthFilter) return;
      }

      if (typeof rawPurposes === "string") {
        rawPurposes = rawPurposes.split(",").map((p) => p.trim());
      }

      if (Array.isArray(rawPurposes)) {
        rawPurposes.forEach((p) => {
          if (!p) return;

          if (counts[p] !== undefined) {
            counts[p] += 1;
          } else {
            counts["Others"] += 1;
          }
          grandTotal += 1;
        });
      }
    });

    setAnalytics(counts);
    setTotalSelections(grandTotal);
  };

  // Get sorted list of defined categories (excluding "Others")
  const getSortedDefinedCategories = () => {
    return Object.entries(analytics)
      .filter(([name]) => name !== "Others")
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: totalSelections > 0 ? ((count / totalSelections) * 100).toFixed(1) : "0.0",
      }));
  };

  const sortedCategories = getSortedDefinedCategories();
  const currentMonthLabel = selectedMonth === "ALL" ? "Overall Record" : selectedMonth;

  // Others details
  const othersCount = analytics["Others"] || 0;
  const othersPct =
    totalSelections > 0
      ? ((othersCount / totalSelections) * 100).toFixed(1)
      : "0.0";

  // Generate formal, insightful, multi-paragraph analysis
  const generateInsightfulConclusionParagraphs = () => {
    if (totalSelections === 0 || sortedCategories.length === 0) {
      return [
        `During the reporting period of ${currentMonthLabel}, no user activity records were registered within the Internet and Research Section. Consequently, institutional compliance and operational utilization metrics cannot be determined for this timeframe.`
      ];
    }

    const primaryActivity = sortedCategories[0];
    const secondaryActivities = sortedCategories.slice(1, -1);
    const leastActivity = sortedCategories[sortedCategories.length - 1];

    const rankedListText = sortedCategories
      .map((cat) => `${cat.name} (${cat.pct}%, ${cat.count} logs)`)
      .join(", ");

    // Paragraph 1: Executive Overview & User Intent Profile
    const p1 = `An analysis of the registered session metrics for ${currentMonthLabel} indicates that users accessing the Internet and Research Section demonstrate a strong, task-oriented focus aligned primarily with academic engagement and structured learning activities. Overall activity across all established parameters ranked from highest to lowest demand as follows: ${rankedListText}. Notably, ${primaryActivity.name} emerged as the primary driver of workstation utilization, commanding ${primaryActivity.pct}% of total recorded traffic (${primaryActivity.count} visits). This concentration underscores that patrons utilize facility workstations chiefly to fulfill core educational requirements, access designated learning management tools, and execute structured scholastic research.`;

    // Paragraph 2: Secondary Engagement & Underutilized Services
    let p2 = `Secondary operational demands were distributed among auxiliary digital services, led by ${
      secondaryActivities.map((cat) => `${cat.name} (${cat.pct}%)`).join(", ")
    }.`;
    p2 += ` Conversely, ${leastActivity.name} was recorded as the least requested service, accounting for only ${leastActivity.pct}% of overall selections (${leastActivity.count} logs). This disparity highlights a clear prioritization of digital coursework and information gathering over secondary tasks, signaling an opportunity for facility administrators to evaluate whether underutilized services require targeted promotion or resource reallocation.`;

    // Paragraph 3: Analysis of Uncategorized Activities ("Others") & Institutional Recommendations
    let p3 = "";
    if (othersCount > 0) {
      p3 = `In addition to defined options, uncategorized usage captured under "Others" represented ${othersPct}% of total user selections (${othersCount} logs). The presence of these unaccounted visits suggests that patrons are engaging in specialized, emerging, or non-standard digital activities beyond the pre-configured options. It is recommended that administrative personnel conduct periodic audits of these entries to identify recurring user requirements, refine standard activity categories, and ensure digital infrastructure continues to meet evolving institutional needs.`;
    } else {
      p3 = `Remarkably, zero unclassified entries ("Others") were logged during this period, demonstrating complete alignment between patron activities and pre-established operational categories. Continued monitoring is recommended to sustain optimal resource allocation, software provisioning, and network bandwidth distribution across all research terminals.`;
    }

    return [p1, p2, p3];
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedMonth === "ALL") return true;
    if (!log.session_in) return false;
    const logMonth = new Date(log.session_in).toLocaleString("default", {
      month: "long",
    });
    return logMonth === selectedMonth;
  });

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const chartData = {
    labels: Object.keys(analytics),
    datasets: [
      {
        label: "Number of Visits / Selections",
        data: Object.values(analytics),
        backgroundColor: "rgba(37, 99, 235, 0.85)",
        borderColor: "#000000",
        borderWidth: 1.5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: 2,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#000000",
          font: { size: 12, weight: "bold", family: "Arial" },
          padding: 16,
        },
      },
      title: {
        display: true,
        text: `USAGE FREQUENCY REPORT (${currentMonthLabel.toUpperCase()})`,
        color: "#000000",
        font: { size: 14, weight: "bold", family: "Arial" },
        padding: { top: 10, bottom: 15 },
      },
      tooltip: {
        titleFont: { size: 12, weight: "bold" },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#000000",
          font: { size: 12, weight: "bold", family: "Arial" },
          padding: 6,
        },
        grid: { color: "#d1d5db" },
        title: {
          display: true,
          text: "Activity Categories",
          color: "#000000",
          font: { size: 12, weight: "bold", family: "Arial" },
        },
      },
      y: {
        ticks: {
          color: "#000000",
          font: { size: 12, weight: "bold", family: "Arial" },
          stepSize: 1,
          precision: 0,
        },
        grid: { color: "#d1d5db" },
        title: {
          display: true,
          text: "Total Log Count",
          color: "#000000",
          font: { size: 12, weight: "bold", family: "Arial" },
        },
      },
    },
  };

  const exportPDF = async () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(0, 0, 0);
    doc.text(
      "INTERNET & RESEARCH SECTION SUMMARY REPORT",
      pageWidth / 2,
      18,
      { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Reporting Period: ${currentMonthLabel}`, pageWidth / 2, 24, {
      align: "center",
    });

    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(14, 28, pageWidth - 14, 28);

    if (chartContainerRef.current) {
      const canvas = await html2canvas(chartContainerRef.current, { scale: 3 });
      const imgData = canvas.toDataURL("image/png");
      doc.addImage(imgData, "PNG", 14, 32, 182, 82);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ANALYTICAL EVALUATION & EXECUTIVE SUMMARY", 14, 122);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const paragraphs = generateInsightfulConclusionParagraphs();
    let currentY = 127;

    paragraphs.forEach((pText) => {
      const splitLines = doc.splitTextToSize(pText, 182);
      splitLines.forEach((line) => {
        if (currentY > 280) {
          doc.addPage();
          currentY = 18;
        }
        doc.text(line, 14, currentY);
        currentY += 4.5;
      });
      currentY += 3; // Space between paragraphs
    });

    const breakdownBody = Object.entries(analytics).map(([key, count]) => {
      const pct =
        totalSelections > 0
          ? ((count / totalSelections) * 100).toFixed(1)
          : "0.0";
      return [key, `${count} visits`, `${pct}%`];
    });

    autoTable(doc, {
      startY: currentY + 2,
      head: [["Category / Purpose", "Total Visits", "Percentage Share"]],
      body: breakdownBody,
      theme: "plain",
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        fontSize: 8.5,
      },
      styles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`REGISTERED SESSION LOGS (${currentMonthLabel.toUpperCase()})`, 14, 18);

    const logRows = filteredLogs.map((log) => {
      let formattedPurposes = "N/A";
      if (Array.isArray(log.purposes)) {
        formattedPurposes = log.purposes.join(", ");
      } else if (typeof log.purposes === "string") {
        formattedPurposes = log.purposes;
      }

      const formattedDate = log.session_in
        ? new Date(log.session_in).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A";

      return [
        log.fullname || "Anonymous",
        formattedPurposes || "None",
        formattedDate,
      ];
    });

    autoTable(doc, {
      startY: 24,
      head: [["Full Name", "Purposes", "Date Registered"]],
      body: logRows,
      theme: "plain",
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        fontSize: 8.5,
      },
      styles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Purpose_Report_${currentMonthLabel}.pdf`);
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "#000000",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h3>Loading Analytics...</h3>
      </div>
    );
  }

  const conclusionParagraphs = generateInsightfulConclusionParagraphs();

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
        color: "#000000",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          borderBottom: "2px solid #000000",
          paddingBottom: "12px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: "#000000",
            }}
          >
            User Purpose Analytics Report
          </h2>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label style={{ fontWeight: "bold", fontSize: "0.875rem" }}>
            Select Month:
          </label>
          <select
            value={selectedMonth}
            onChange={handleMonthChange}
            style={{
              padding: "8px 12px",
              border: "1px solid #000000",
              borderRadius: "4px",
              fontWeight: "bold",
              fontSize: "0.875rem",
              backgroundColor: "#ffffff",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Months</option>
            <option value="January">January</option>
            <option value="February">February</option>
            <option value="March">March</option>
            <option value="April">April</option>
            <option value="May">May</option>
            <option value="June">June</option>
            <option value="July">July</option>
            <option value="August">August</option>
            <option value="September">September</option>
            <option value="October">October</option>
            <option value="November">November</option>
            <option value="December">December</option>
          </select>

          <button
            onClick={exportPDF}
            style={{
              padding: "10px 18px",
              backgroundColor: "#000000",
              color: "#ffffff",
              border: "1px solid #000000",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.875rem",
            }}
          >
            Export PDF Report
          </button>
        </div>
      </div>

      <div style={{ background: "#ffffff", color: "#000000" }}>
        <h3
          style={{
            textTransform: "uppercase",
            color: "#000000",
            textAlign: "center",
            margin: "0 0 4px 0",
            fontSize: "1.2rem",
            fontWeight: "bold",
          }}
        >
          Internet & Research Section Summary Report
        </h3>
        <p
          style={{
            textAlign: "center",
            color: "#333333",
            marginBottom: "24px",
            fontSize: "0.9rem",
          }}
        >
          Reporting Period: <strong>{currentMonthLabel}</strong>
        </p>

        {/* Bar Chart Container */}
        <div
          ref={chartContainerRef}
          style={{
            marginBottom: "30px",
            height: "380px",
            width: "100%",
            backgroundColor: "#ffffff",
            padding: "12px",
            border: "1px solid #e5e7eb",
          }}
        >
          <Bar data={chartData} options={chartOptions} />
        </div>

        {/* Analytical Conclusion Box - Formal, Multi-Paragraph Insights */}
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderLeft: "4px solid #000000",
            borderRight: "1px solid #e5e7eb",
            borderTop: "1px solid #e5e7eb",
            borderBottom: "1px solid #e5e7eb",
            padding: "20px",
            borderRadius: "2px",
            marginBottom: "30px",
          }}
        >
          <h4
            style={{
              margin: "0 0 14px 0",
              color: "#000000",
              fontWeight: "bold",
              fontSize: "1.05rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Analytical Evaluation & Executive Summary
          </h4>
          {conclusionParagraphs.map((para, idx) => (
            <p
              key={idx}
              style={{
                margin: "0 0 12px 0",
                color: "#111827",
                lineHeight: "1.6",
                fontSize: "0.93rem",
                textAlign: "justify",
              }}
            >
              {para}
            </p>
          ))}
        </div>

        {/* Percentage Breakdown Cards */}
        <h4
          style={{
            color: "#000000",
            marginBottom: "12px",
            fontWeight: "bold",
          }}
        >
          Purpose Percentage Breakdown
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "36px",
          }}
        >
          {Object.entries(analytics).map(([key, count]) => {
            const pct =
              totalSelections > 0
                ? ((count / totalSelections) * 100).toFixed(1)
                : "0.0";
            return (
              <div
                key={key}
                style={{
                  border: "1px solid #000000",
                  padding: "12px",
                  borderRadius: "4px",
                  textAlign: "center",
                  backgroundColor: "#ffffff",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#000000",
                    fontSize: "0.9rem",
                  }}
                >
                  {key}
                </div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: "#000000",
                    margin: "4px 0",
                  }}
                >
                  {pct}%
                </div>
                <div style={{ fontSize: "0.8rem", color: "#333333" }}>
                  {count} visits
                </div>
              </div>
            );
          })}
        </div>

        {/* Registered Logs Table */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h4 style={{ color: "#000000", margin: 0, fontWeight: "bold" }}>
            Registered Log Entries ({filteredLogs.length})
          </h4>
          <span style={{ fontSize: "0.85rem", color: "#333333" }}>
            Showing Page {currentPage} of {totalPages}
          </span>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
            color: "#000000",
            border: "1px solid #000000",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#000000", color: "#ffffff" }}>
              <th
                style={{
                  padding: "10px",
                  textAlign: "left",
                  borderBottom: "1px solid #000000",
                }}
              >
                Full Name
              </th>
              <th
                style={{
                  padding: "10px",
                  textAlign: "left",
                  borderBottom: "1px solid #000000",
                }}
              >
                Purposes
              </th>
              <th
                style={{
                  padding: "10px",
                  textAlign: "left",
                  borderBottom: "1px solid #000000",
                }}
              >
                Date Registered
              </th>
            </tr>
          </thead>
          <tbody>
            {currentLogs.length === 0 ? (
              <tr>
                <td
                  colSpan="3"
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: "#000000",
                  }}
                >
                  No records found for this period.
                </td>
              </tr>
            ) : (
              currentLogs.map((log, index) => {
                let formattedPurposes = "N/A";

                if (Array.isArray(log.purposes)) {
                  formattedPurposes = log.purposes.join(", ");
                } else if (typeof log.purposes === "string") {
                  formattedPurposes = log.purposes;
                }

                const formattedDate = log.session_in
                  ? new Date(log.session_in).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "N/A";

                return (
                  <tr
                    key={index}
                    style={{ borderBottom: "1px solid #e5e7eb" }}
                  >
                    <td style={{ padding: "10px" }}>
                       {log.fullname ? log.fullname.toUpperCase() : "ANONYMOUS"}
                    </td>
                    <td style={{ padding: "10px" }}>
                      {formattedPurposes || "None"}
                    </td>
                    <td style={{ padding: "10px" }}>{formattedDate}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Table Pagination Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
            fontSize: "0.875rem",
          }}
        >
          <div>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </div>
          <div>
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              style={{
                padding: "6px 12px",
                marginRight: "8px",
                border: "1px solid #000000",
                backgroundColor: currentPage === 1 ? "#f3f4f6" : "#ffffff",
                color: currentPage === 1 ? "#9ca3af" : "#000000",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                borderRadius: "4px",
                fontWeight: "bold",
              }}
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              style={{
                padding: "6px 12px",
                border: "1px solid #000000",
                backgroundColor:
                  currentPage === totalPages ? "#f3f4f6" : "#ffffff",
                color: currentPage === totalPages ? "#9ca3af" : "#000000",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                borderRadius: "4px",
                fontWeight: "bold",
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}