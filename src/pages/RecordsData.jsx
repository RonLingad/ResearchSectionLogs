
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./RecordsData.css";

const YEARS = [2026, 2027, 2028, 2029, 2030];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatHour(hour) {
  const formatTime = (value, minute) => {
    const suffix = value >= 12 ? "PM" : "AM";
    const displayHour = value % 12 || 12;

    return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
  };

  const nextHour = (hour + 1) % 24;

  return `${formatTime(hour, 0)} - ${formatTime(nextHour, 0)}`;
}

export default function RecordsData() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [viewMode, setViewMode] = useState("month");
  const [selectedYear, setSelectedYear] = useState("2026");

  /* =========================================================
     FETCH
  ========================================================= */

  async function fetchLogs() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("logs")
        .select("session_in, session_out")
        .order("session_in", {
          ascending: true,
        });

      if (error) {
        console.error("Error fetching records:", error);
        setLogs([]);
        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error("Unexpected error:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  /* =========================================================
     GRAPH DATA
  ========================================================= */

  const graphData = useMemo(() => {
    if (viewMode === "month") {
      const counts = MONTHS.map((month) => ({
        label: month,
        value: 0,
      }));

      logs.forEach((log) => {
        const date = parseDate(log.session_in);

        if (!date) return;

        if (date.getFullYear() === Number(selectedYear)) {
          counts[date.getMonth()].value += 1;
        }
      });

      return counts;
    }

    const counts = YEARS.map((year) => ({
      label: String(year),
      value: 0,
    }));

    logs.forEach((log) => {
      const date = parseDate(log.session_in);

      if (!date) return;

      const year = date.getFullYear();

      const found = counts.find(
        (item) => Number(item.label) === year
      );

      if (found) {
        found.value += 1;
      }
    });

    return counts;
  }, [logs, viewMode, selectedYear]);

  /* =========================================================
     PEAK HOURS
  ========================================================= */

  const peakHours = useMemo(() => {
    const hourlyCounts = Array(24).fill(0);

    logs.forEach((log) => {
      const date = parseDate(log.session_in);

      if (!date) return;

      const year = date.getFullYear();

      const matchesPeriod =
        viewMode === "month"
          ? year === Number(selectedYear)
          : YEARS.includes(year);

      if (!matchesPeriod) return;

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
  }, [logs, viewMode, selectedYear]);

  /* =========================================================
     SUMMARY - DASHBOARD
  ========================================================= */

  const summary = useMemo(() => {
    const total = graphData.reduce(
      (sum, item) => sum + item.value,
      0
    );

    const highest = graphData.reduce(
      (highest, current) =>
        current.value > highest.value ? current : highest,
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
        ? `No registered usage records were recorded for ${selectedYear}.`
        : "No registered usage records were recorded from 2026 to 2030.";
    }

    if (viewMode === "month") {
      return (
        `For ${selectedYear}, the highest recorded usage occurred in ` +
        `${summary.highest.label} with ${summary.highest.value} ` +
        `${summary.highest.value === 1 ? "record" : "records"}. ` +
        `The lowest recorded usage among active months was in ` +
        `${summary.lowest.label} with ${summary.lowest.value} ` +
        `${summary.lowest.value === 1 ? "record" : "records"}. ` +
        `A total of ${summary.total} registered sessions was recorded, ` +
        `with an average of ${summary.average.toFixed(1)} sessions per month.`
      );
    }

    return (
      `From 2026 to 2030, the highest recorded usage occurred in ` +
      `${summary.highest.label} with ${summary.highest.value} ` +
      `${summary.highest.value === 1 ? "record" : "records"}. ` +
      `The lowest recorded usage among active years was in ` +
      `${summary.lowest.label} with ${summary.lowest.value} ` +
      `${summary.lowest.value === 1 ? "record" : "records"}. ` +
      `A total of ${summary.total} registered sessions was recorded, ` +
      `with an average of ${summary.average.toFixed(1)} sessions per year.`
    );
  }, [summary, viewMode, selectedYear]);

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
         COMPACT CENTERED HEADER
      ===================================================== */

      pdf.setTextColor(0, 0, 0);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);

      pdf.text(
        "Holy Family Academy",
        pageWidth / 2,
        11,
        { align: "center" }
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      pdf.text(
        "Angeles City",
        pageWidth / 2,
        16,
        { align: "center" }
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);

      pdf.text(
        "STATISTICAL REPRESENTATION ON THE ACTIVITY ON INTERNET",
        pageWidth / 2,
        24,
        { align: "center" }
      );

      pdf.text(
        "AND RESEARCH SECTION",
        pageWidth / 2,
        29,
        { align: "center" }
      );

      pdf.setFontSize(10);

      const periodTitle =
        viewMode === "month"
          ? `FOR THE YEAR ${selectedYear}`
          : "FOR THE YEARS 2026 TO 2030";

      pdf.text(
        periodTitle,
        pageWidth / 2,
        35,
        { align: "center" }
      );

      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);

      pdf.line(
        margin,
        39,
        pageWidth - margin,
        39
      );

      let y = 46;

      /* =====================================================
         VERTICAL COLUMN GRAPH
      ===================================================== */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);

      pdf.text(
        viewMode === "month"
          ? `Monthly Usage - ${selectedYear}`
          : "Yearly Usage - 2026 to 2030",
        margin,
        y
      );

      y += 6;

      const chartLeft = margin + 12;
      const chartRight = pageWidth - margin - 4;
      const chartWidth = chartRight - chartLeft;

      const chartHeight =
        viewMode === "month" ? 110 : 110;

      const chartTop = y;
      const chartBottom = chartTop + chartHeight;

      const maxValue = Math.max(
        ...graphData.map((item) => item.value),
        1
      );

      const roundedMax =
        Math.ceil(maxValue / 5) * 5 || 5;

      const tickCount = 5;

      /* Grid lines and Y-axis labels */

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(80, 80, 80);

      for (let i = 0; i <= tickCount; i++) {
        const value =
          (roundedMax / tickCount) * i;

        const gridY =
          chartBottom -
          (chartHeight / tickCount) * i;

        pdf.setDrawColor(220, 225, 230);
        pdf.setLineWidth(0.2);

        pdf.line(
          chartLeft,
          gridY,
          chartRight,
          gridY
        );

        pdf.text(
          String(Math.round(value)),
          chartLeft - 3,
          gridY + 1,
          { align: "right" }
        );
      }

      /* Axes */

      pdf.setDrawColor(70, 70, 70);
      pdf.setLineWidth(0.3);

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

      /* Vertical bars */

      const slotWidth =
        chartWidth / graphData.length;

      const barWidth =
        Math.min(
          viewMode === "month" ? 9 : 17,
          slotWidth * 0.62
        );

      graphData.forEach((item, index) => {
        const centerX =
          chartLeft +
          slotWidth * index +
          slotWidth / 2;

        const barHeight =
          (item.value / roundedMax) * chartHeight;

        const barX =
          centerX - barWidth / 2;

        const barY =
          chartBottom - barHeight;

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

        /* Values */

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.setTextColor(0, 0, 0);

        const valueY =
          item.value > 0
            ? Math.max(chartTop - 1, barY - 1.5)
            : chartBottom - 2;

        pdf.text(
          String(item.value),
          centerX,
          valueY,
          { align: "center" }
        );

        /* X-axis labels */

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(
          viewMode === "month" ? 6 : 7
        );

        const label =
          viewMode === "month"
            ? item.label.substring(0, 3)
            : item.label;

        pdf.text(
          label,
          centerX,
          chartBottom + 4,
          { align: "center" }
        );
      });

      y = chartBottom + 11;

      /* =====================================================
         COMPACT PEAK HOURS
      ===================================================== */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(0, 0, 0);

      pdf.text("Peak Hours", margin, y);

      y += 2;

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
          fontSize: 7,
          cellPadding: 1.2,
          minCellHeight: 5,
          textColor: [0, 0, 0],
          lineColor: [190, 190, 190],
          lineWidth: 0.2,
        },

        headStyles: {
          fillColor: [11, 42, 74],
          textColor: [255, 255, 255],
          fontStyle: "bold",
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

      y = pdf.lastAutoTable.finalY + 5;

      /* =====================================================
         CONCLUSION
      ===================================================== */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);

      pdf.text("Conclusion", margin, y);

      y += 5;

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
         SIGNATURES AND POSITIONS
      ===================================================== */

      y += 10;

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
          name: "Remedios Baking",
          position: "IMC Coordinator",
        },
      ];

      signatures.forEach((person, index) => {
        const x =
          signatureStartX +
          index * (signatureWidth + signatureGap);

        const centerX =
          x + signatureWidth / 2;

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.3);

        pdf.line(
          x,
          y + 4,
          x + signatureWidth,
          y + 4
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.5);
        pdf.setTextColor(0, 0, 0);

        pdf.text(
          person.name,
          centerX,
          y + 3,
          { align: "center" }
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);

        pdf.text(
          person.position,
          centerX,
          y + 9,
          { align: "center" }
        );
      });

      /* =====================================================
         FOOTER - ONE PAGE
      ===================================================== */

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
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
          ? `Record_Data_${selectedYear}.pdf`
          : "Record_Data_2026_2030.pdf";

      pdf.save(filename);
    } catch (error) {
      console.error("PDF export error:", error);

      alert("Unable to export the PDF report.");
    } finally {
      setExporting(false);
    }
  }

  /* =========================================================
     GRAPH MAX
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
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>

        {viewMode === "month" && (
          <div className="records-data-filter-group">
            <label>Year</label>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
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
              ? selectedYear
              : "2026–2030"}
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
                ? `Registered usage by month for ${selectedYear}`
                : "Registered usage by year from 2026 to 2030"}
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

      {/* DASHBOARD SUMMARY */}

      <section className="records-data-summary-section">

        <div className="records-data-section-heading">
          <h2>Summary</h2>

          <span>
            {viewMode === "month"
              ? selectedYear
              : "2026–2030"}
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
            Generate a PDF report of the displayed record data.
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
