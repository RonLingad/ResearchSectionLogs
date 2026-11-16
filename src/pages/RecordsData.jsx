
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./RecordsData.css";

/* =========================================================
   SCHOOL YEAR SETTINGS
========================================================= */

const SCHOOL_YEAR_STARTS = [2026, 2027, 2028, 2029];

const MONTHS = [
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
  "April",
  "May",
];

const MONTH_INDICES = [
  5, 6, 7, 8, 9, 10,
  11, 0, 1, 2, 3, 4,
];

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getSchoolYearStart(date) {
  return date.getMonth() >= 5
    ? date.getFullYear()
    : date.getFullYear() - 1;
}

function getSchoolYearLabel(startYear) {
  return `${startYear}-${startYear + 1}`;
}

function getSchoolYearCycle(startYear) {
  return `June ${startYear} - May ${startYear + 1}`;
}

function formatHour(hour) {
  const formatTime = (value) => {
    const suffix = value >= 12 ? "PM" : "AM";
    const displayHour = value % 12 || 12;

    return `${displayHour}:00 ${suffix}`;
  };

  const nextHour = (hour + 1) % 24;

  return `${formatTime(hour)} - ${formatTime(nextHour)}`;
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function RecordsData() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [viewMode, setViewMode] = useState("month");

  const [selectedSchoolYear, setSelectedSchoolYear] =
    useState("2026");

  /* =========================================================
     FETCH ALL RECORDS FROM SUPABASE
  ========================================================= */

  async function fetchLogs() {
    try {
      setLoading(true);

      const pageSize = 1000;

      let from = 0;
      let allLogs = [];

      while (true) {
        const { data, error } = await supabase
          .from("logs")
          .select("session_in, session_out")
          .order("session_in", {
            ascending: true,
          })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error(
            "Error fetching records:",
            error
          );

          setLogs([]);
          return;
        }

        allLogs = allLogs.concat(data || []);

        if (!data || data.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      setLogs(allLogs);

      console.log(
        "Total Records Data fetched:",
        allLogs.length
      );

    } catch (error) {
      console.error(
        "Unexpected error fetching records:",
        error
      );

      setLogs([]);

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  /* =========================================================
     SCHOOL YEAR FILTER
  ========================================================= */

  const selectedStartYear = Number(selectedSchoolYear);

  const selectedSchoolYearLabel =
    getSchoolYearLabel(selectedStartYear);

  const selectedCycle =
    getSchoolYearCycle(selectedStartYear);

  /* =========================================================
     GRAPH DATA
  ========================================================= */

  const graphData = useMemo(() => {
    // MONTHLY VIEW: JUNE TO MAY

    if (viewMode === "month") {
      const counts = MONTHS.map((month) => ({
        label: month,
        value: 0,
      }));

      logs.forEach((log) => {
        const date = parseDate(log.session_in);

        if (!date) return;

        const schoolYear = getSchoolYearStart(date);

        if (schoolYear !== selectedStartYear) return;

        const calendarMonth = date.getMonth();

        const schoolMonthIndex =
          MONTH_INDICES.indexOf(calendarMonth);

        if (schoolMonthIndex !== -1) {
          counts[schoolMonthIndex].value += 1;
        }
      });

      return counts;
    }

    // SCHOOL YEAR COMPARISON

    const counts = SCHOOL_YEAR_STARTS.map((year) => ({
      label: getSchoolYearLabel(year),
      value: 0,
    }));

    logs.forEach((log) => {
      const date = parseDate(log.session_in);

      if (!date) return;

      const schoolYear = getSchoolYearStart(date);

      const found = counts.find(
        (item) =>
          item.label === getSchoolYearLabel(schoolYear)
      );

      if (found) {
        found.value += 1;
      }
    });

    return counts;
  }, [logs, viewMode, selectedStartYear]);

  /* =========================================================
     PEAK HOURS
  ========================================================= */

  const peakHours = useMemo(() => {
    const hourlyCounts = Array(24).fill(0);

    logs.forEach((log) => {
      const date = parseDate(log.session_in);

      if (!date) return;

      const schoolYear = getSchoolYearStart(date);

      const included =
        viewMode === "month"
          ? schoolYear === selectedStartYear
          : SCHOOL_YEAR_STARTS.includes(schoolYear);

      if (!included) return;

      hourlyCounts[date.getHours()] += 1;
    });

    return hourlyCounts
      .map((value, hour) => ({
        hour,
        label: formatHour(hour),
        value,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => {
        if (b.value !== a.value) {
          return b.value - a.value;
        }

        return a.hour - b.hour;
      })
      .slice(0, 3);
  }, [logs, viewMode, selectedStartYear]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary = useMemo(() => {
    const total = graphData.reduce(
      (sum, item) => sum + item.value,
      0
    );

    const highest = graphData.reduce(
      (highest, current) =>
        current.value > highest.value
          ? current
          : highest,
      graphData[0] || {
        label: "—",
        value: 0,
      }
    );

    const activePeriods = graphData.filter(
      (item) => item.value > 0
    );

    const lowest =
      activePeriods.length > 0
        ? activePeriods.reduce(
            (lowest, current) =>
              current.value < lowest.value
                ? current
                : lowest,
            activePeriods[0]
          )
        : {
            label: "—",
            value: 0,
          };

    const average =
      graphData.length > 0
        ? total / graphData.length
        : 0;

    return {
      total,
      highest,
      lowest,
      average,
    };
  }, [graphData]);

  /* =========================================================
     CONCLUSION
  ========================================================= */

  const conclusion = useMemo(() => {
    if (summary.total === 0) {
      return viewMode === "month"
        ? `No registered usage records were recorded for School Year ${selectedSchoolYearLabel}.`
        : "No registered usage records were recorded for the selected school years.";
    }

    if (viewMode === "month") {
      return (
        `For School Year ${selectedSchoolYearLabel}, the highest recorded ` +
        `usage occurred in ${summary.highest.label} with ` +
        `${summary.highest.value} ${summary.highest.value === 1 ? "record" : "records"}. ` +
        `The lowest recorded usage among active months was in ` +
        `${summary.lowest.label} with ${summary.lowest.value} ` +
        `${summary.lowest.value === 1 ? "record" : "records"}. ` +
        `A total of ${summary.total} registered sessions was recorded, ` +
        `with an average of ${summary.average.toFixed(1)} sessions per month.`
      );
    }

    return (
      `In the school year comparison, the highest recorded usage occurred ` +
      `during School Year ${summary.highest.label} with ` +
      `${summary.highest.value} ${summary.highest.value === 1 ? "record" : "records"}. ` +
      `The lowest recorded usage among active school years was during ` +
      `School Year ${summary.lowest.label} with ${summary.lowest.value} ` +
      `${summary.lowest.value === 1 ? "record" : "records"}. ` +
      `A total of ${summary.total} registered sessions was recorded, ` +
      `with an average of ${summary.average.toFixed(1)} sessions per school year.`
    );
  }, [
    summary,
    viewMode,
    selectedSchoolYearLabel,
  ]);

  /* =========================================================
     PDF EXPORT
  ========================================================= */

  function exportPDF() {
    if (summary.total === 0) {
      alert("No record data available to export.");
      return;
    }

    try {
      setExporting(true);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      /* =====================================================
         HEADER
      ===================================================== */

      pdf.setTextColor(0, 0, 0);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);

      pdf.text(
        "Holy Family Academy",
        pageWidth / 2,
        11,
        { align: "center" }
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      pdf.text(
        "Angeles City",
        pageWidth / 2,
        17,
        { align: "center" }
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);

      pdf.text(
        "STATISTICAL REPRESENTATION ON THE ACTIVITY ON INTERNET",
        pageWidth / 2,
        25,
        { align: "center" }
      );

      pdf.text(
        "AND RESEARCH SECTION",
        pageWidth / 2,
        31,
        { align: "center" }
      );

      const reportPeriod =
        viewMode === "month"
          ? `SCHOOL YEAR ${selectedSchoolYearLabel}`
          : "SCHOOL YEAR COMPARISON";

      pdf.text(
        reportPeriod,
        pageWidth / 2,
        37,
        { align: "center" }
      );

      // Removed the separate Cycle and School Year header lines.

      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.4);

      pdf.line(
        margin,
        44,
        pageWidth - margin,
        44
      );

      /* =====================================================
         GRAPH TITLE
      ===================================================== */

      let y = 51;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);

      pdf.text(
        viewMode === "month"
          ? "Monthly Usage"
          : "School Year Comparison",
        margin,
        y
      );

      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      pdf.text(
        "Number of Registered Sessions",
        margin,
        y
      );

      y += 5;

      /* CYCLE DATE RANGE */

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(70, 70, 70);

      const cycleDescription =
        viewMode === "month"
          ? selectedCycle
          : "June 2026 - May 2030";

      pdf.text(
        cycleDescription,
        margin,
        y
      );

      y += 7;

      /* =====================================================
         VERTICAL GRAPH
      ===================================================== */

      const chartLeft = margin + 15;
      const chartRight = pageWidth - margin - 5;
      const chartWidth = chartRight - chartLeft;

      const chartHeight = 100;

      const chartTop = y;
      const chartBottom = chartTop + chartHeight;

      const maxValue = Math.max(
        ...graphData.map((item) => item.value),
        1
      );

      const tickCount = 5;

      const roundedMax =
        Math.ceil(maxValue / tickCount) * tickCount || 5;

      /* Y-AXIS AND GRID */

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(65, 65, 65);

      for (let i = 0; i <= tickCount; i++) {
        const value =
          (roundedMax / tickCount) * i;

        const gridY =
          chartBottom -
          (chartHeight / tickCount) * i;

        pdf.setDrawColor(220, 225, 230);
        pdf.setLineWidth(0.25);

        pdf.line(
          chartLeft,
          gridY,
          chartRight,
          gridY
        );

        pdf.text(
          String(Math.round(value)),
          chartLeft - 3,
          gridY + 1.5,
          { align: "right" }
        );
      }

      /* AXES */

      pdf.setDrawColor(65, 65, 65);
      pdf.setLineWidth(0.4);

      pdf.line(
        chartLeft,
        chartTop,
        chartLeft,
        chartBottom
      );

      pdf.line(
        chartLeft,
        chartBottom,
        chartRight,
        chartBottom
      );

      /* BARS */

      const slotWidth = chartWidth / graphData.length;

      const barWidth = Math.min(
        viewMode === "month" ? 10 : 22,
        slotWidth * 0.68
      );

      graphData.forEach((item, index) => {
        const centerX =
          chartLeft +
          slotWidth * index +
          slotWidth / 2;

        const barHeight =
          (item.value / roundedMax) * chartHeight;

        const barX = centerX - barWidth / 2;
        const barY = chartBottom - barHeight;

        if (item.value > 0) {
          pdf.setFillColor(21, 101, 192);

          pdf.rect(
            barX,
            barY,
            barWidth,
            barHeight,
            "F"
          );
        }

        /* VALUE */

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);

        const valueY =
          item.value > 0
            ? Math.max(chartTop - 1, barY - 2)
            : chartBottom - 2;

        pdf.text(
          String(item.value),
          centerX,
          valueY,
          { align: "center" }
        );

        /* LABEL */

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(
          viewMode === "month" ? 8.5 : 9
        );

        const label =
          viewMode === "month"
            ? item.label.substring(0, 3)
            : item.label;

        pdf.text(
          label,
          centerX,
          chartBottom + 6,
          { align: "center" }
        );
      });

      y = chartBottom + 14;

      /* =====================================================
         PEAK HOURS
      ===================================================== */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);

      pdf.text("Peak Hours", margin, y);

      y += 3;

      const peakRows =
        peakHours.length > 0
          ? peakHours.map((item, index) => [
              index + 1,
              item.label,
              item.value,
            ])
          : [["—", "No available data", 0]];

      autoTable(pdf, {
        startY: y,

        margin: {
          left: margin,
          right: margin,
        },

        head: [
          [
            "Rank",
            "Time Period",
            "Total Records",
          ],
        ],

        body: peakRows,

        theme: "grid",

        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 1.5,
          minCellHeight: 6,
          textColor: [0, 0, 0],
          lineColor: [190, 190, 190],
          lineWidth: 0.2,
        },

        headStyles: {
          fillColor: [11, 42, 74],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },

        columnStyles: {
          0: {
            cellWidth: 25,
            halign: "center",
          },
          1: {
            cellWidth: 100,
          },
          2: {
            cellWidth: 43,
            halign: "center",
          },
        },
      });

      y = pdf.lastAutoTable.finalY + 6;

      /* =====================================================
         CONCLUSION
      ===================================================== */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);

      pdf.text("Conclusion", margin, y);

      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);

      const conclusionLines = pdf.splitTextToSize(
        conclusion,
        contentWidth
      );

      const lineHeight = 4.5;

      conclusionLines.forEach((line) => {
        pdf.text(line, margin, y);
        y += lineHeight;
      });

      /* =====================================================
         SIGNATORIES
      ===================================================== */

      const signatureY = pageHeight - 30;

      const signatureWidth = 65;
      const signatureGap = 25;

      const totalSignatureWidth =
        signatureWidth * 2 + signatureGap;

      const signatureStartX =
        (pageWidth - totalSignatureWidth) / 2;

      const signatures = [
        {
          name: "Airon Lingad",
          position: "Library IT Staff",
        },
        {
          name: "Ms. Remedios Baking",
          position: "IMC Coordinator",
        },
      ];

      signatures.forEach((person, index) => {
        const x =
          signatureStartX +
          index * (signatureWidth + signatureGap);

        const centerX = x + signatureWidth / 2;

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.35);

        pdf.line(
          x,
          signatureY + 4,
          x + signatureWidth,
          signatureY + 4
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);

        pdf.text(
          person.name,
          centerX,
          signatureY + 3,
          { align: "center" }
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        pdf.text(
          person.position,
          centerX,
          signatureY + 11,
          { align: "center" }
        );
      });

      /* =====================================================
         FOOTER
      ===================================================== */

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90, 90, 90);

      pdf.text(
        "Grade School IMC - Record Data Report",
        pageWidth / 2,
        pageHeight - 7,
        { align: "center" }
      );

      /* =====================================================
         SAVE
      ===================================================== */

      const filename =
        viewMode === "month"
          ? `Record_Data_SY_${selectedSchoolYearLabel}.pdf`
          : "Record_Data_School_Year_Comparison.pdf";

      pdf.save(filename);

    } catch (error) {
      console.error("PDF export error:", error);
      alert("Unable to export the PDF report.");
    } finally {
      setExporting(false);
    }
  }

  /* =========================================================
     DASHBOARD GRAPH
  ========================================================= */

  const maxGraphValue = Math.max(
    ...graphData.map((item) => item.value),
    1
  );

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="records-data-page">

      {/* FILTER BAR */}

      <div className="records-data-filter-bar">

        <div className="records-data-filter-group">
          <label>View By</label>

          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="month">Monthly</option>

            <option value="schoolYear">
              School Year Comparison
            </option>
          </select>
        </div>

        {viewMode === "month" && (
          <div className="records-data-filter-group">
            <label>School Year</label>

            <select
              value={selectedSchoolYear}
              onChange={(e) =>
                setSelectedSchoolYear(e.target.value)
              }
            >
              {SCHOOL_YEAR_STARTS.map((year) => (
                <option key={year} value={year}>
                  {getSchoolYearLabel(year)}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          className="records-data-refresh"
          onClick={fetchLogs}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>

        <div className="records-data-filter-spacer" />

        <div className="records-data-showing">
          <span>Showing</span>

          <strong>
            {viewMode === "month"
              ? `SY ${selectedSchoolYearLabel}`
              : "All School Years"}
          </strong>
        </div>

      </div>

      {/* GRAPH */}

      <section className="records-data-panel">

        <div className="records-data-panel-header">
          <div>
            <h1>Record Data</h1>

            <p>
              {viewMode === "month"
                ? `Monthly usage for School Year ${selectedSchoolYearLabel} (June - May)`
                : "Comparison of registered usage across school years"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="records-data-empty">
            Loading record data...
          </div>
        ) : summary.total === 0 ? (
          <div className="records-data-empty">
            No usage records found for the selected period.
          </div>
        ) : (
          <div className="records-data-chart">

            {graphData.map((item) => {
              const width =
                (item.value / maxGraphValue) * 100;

              return (
                <div
                  className="records-data-chart-row"
                  key={item.label}
                >
                  <div className="records-data-chart-label">
                    {item.label}
                  </div>

                  <div className="records-data-chart-track">
                    <div
                      className="records-data-chart-bar"
                      style={{
                        width: `${width}%`,
                      }}
                    />
                  </div>

                  <div className="records-data-chart-value">
                    {item.value}
                  </div>
                </div>
              );
            })}

          </div>
        )}

      </section>

      {/* SUMMARY */}

      <section className="records-data-summary-section">

        <div className="records-data-section-heading">
          <h2>Summary</h2>

          <span>
            {viewMode === "month"
              ? `SY ${selectedSchoolYearLabel}`
              : "School Year Comparison"}
          </span>
        </div>

        <div className="records-data-summary">

          <div className="records-data-summary-card">
            <span>Total Records</span>
            <strong>{summary.total}</strong>
          </div>

          <div className="records-data-summary-card">
            <span>Highest Period</span>

            <strong className="records-data-summary-text">
              {summary.highest.label}
            </strong>
          </div>

          <div className="records-data-summary-card">
            <span>Highest Total</span>
            <strong>{summary.highest.value}</strong>
          </div>

          <div className="records-data-summary-card">
            <span>Lowest Period</span>

            <strong className="records-data-summary-text">
              {summary.lowest.label}
            </strong>
          </div>

          <div className="records-data-summary-card">
            <span>Average</span>
            <strong>{summary.average.toFixed(1)}</strong>
          </div>

        </div>

      </section>

      {/* EXPORT */}

      <div className="records-data-export-section">

        <div>
          <strong>Export Report</strong>

          <span>
            Generate a PDF report of the displayed school year data.
          </span>
        </div>

        <button
          type="button"
          className="records-data-export-button"
          onClick={exportPDF}
          disabled={
            loading ||
            exporting ||
            summary.total === 0
          }
        >
          {exporting ? "Exporting..." : "Export PDF"}
        </button>

      </div>

    </div>
  );
}
