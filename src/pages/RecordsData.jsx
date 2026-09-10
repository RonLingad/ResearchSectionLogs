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
     SUMMARY
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
     CONCLUSION FOR PDF
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

      /* HEADER */

      pdf.setFillColor(11, 42, 74);
      pdf.rect(0, 0, pageWidth, 31, "F");

      pdf.setTextColor(255, 255, 255);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(
        "Holy Family Academy Angeles City",
        margin,
        9
      );

      pdf.setFontSize(10);
      pdf.text("Grade School IMC", margin, 16);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Record Data Report", margin, 23);

      const period =
        viewMode === "month"
          ? `Monthly Usage - ${selectedYear}`
          : "Yearly Usage - 2026 to 2030";

      pdf.setFontSize(8);
      pdf.text(period, margin, 28);

      /* SUMMARY */

      let y = 41;

      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("Summary", margin, y);

      y += 6;

      const gap = 4;

      const cardWidth =
        (contentWidth - gap * 3) / 4;

      const cardHeight = 24;

      const cards = [
        ["Total Records", String(summary.total)],
        ["Highest Period", summary.highest.label],
        ["Highest Total", String(summary.highest.value)],
        ["Average", summary.average.toFixed(1)],
      ];

      cards.forEach((card, index) => {
        const x =
          margin + index * (cardWidth + gap);

        pdf.setDrawColor(197, 214, 230);
        pdf.setFillColor(255, 255, 255);

        pdf.roundedRect(
          x,
          y,
          cardWidth,
          cardHeight,
          2,
          2,
          "FD"
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(92, 120, 146);

        pdf.text(card[0], x + 4, y + 7);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(
          card[0] === "Highest Period" ? 10 : 13
        );

        pdf.setTextColor(11, 42, 74);

        pdf.text(card[1], x + 4, y + 18);
      });

      y += cardHeight + 10;

      /* GRAPH */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      pdf.text(
        viewMode === "month"
          ? `Monthly Usage - ${selectedYear}`
          : "Yearly Usage - 2026 to 2030",
        margin,
        y
      );

      y += 7;

      const labelWidth =
        viewMode === "month" ? 34 : 22;

      const valueWidth = 15;

      const barWidth =
        contentWidth -
        labelWidth -
        valueWidth;

      const graphHeight =
        viewMode === "month" ? 78 : 48;

      const rowHeight =
        graphHeight / graphData.length;

      const maxValue = Math.max(
        ...graphData.map((item) => item.value),
        1
      );

      graphData.forEach((item, index) => {
        const centerY =
          y +
          rowHeight * index +
          rowHeight / 2;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);

        pdf.text(
          item.label,
          margin,
          centerY + 1.5
        );

        const barX =
          margin + labelWidth;

        const barHeight =
          viewMode === "month" ? 4.5 : 6;

        const barY =
          centerY - barHeight / 2;

        pdf.setFillColor(238, 242, 246);

        pdf.roundedRect(
          barX,
          barY,
          barWidth,
          barHeight,
          1,
          1,
          "F"
        );

        const actualWidth =
          (item.value / maxValue) *
          barWidth;

        if (actualWidth > 0) {
          pdf.setFillColor(21, 101, 192);

          pdf.roundedRect(
            barX,
            barY,
            actualWidth,
            barHeight,
            1,
            1,
            "F"
          );
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);

        pdf.text(
          String(item.value),
          barX + barWidth + 3,
          centerY + 1.5
        );
      });

      y += graphHeight + 9;

      /* CONCLUSION */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("Conclusion", margin, y);

      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);

      const conclusionLines =
        pdf.splitTextToSize(
          conclusion,
          contentWidth
        );

      const lineHeight = 6.35;

      conclusionLines.forEach((line) => {
        pdf.text(line, margin, y);
        y += lineHeight;
      });

      /* TABLE */

      y += 3;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);

      pdf.text(
        "Record Totals",
        margin,
        y
      );

      y += 3;

      const tableRows = graphData.map(
        (item, index) => [
          index + 1,
          item.label,
          item.value,
        ]
      );

      autoTable(pdf, {
        startY: y,

        margin: {
          left: margin,
          right: margin,
        },

        head: [
          [
            "No.",
            viewMode === "month"
              ? "Month"
              : "Year",
            "Total Records",
          ],
        ],

        body: tableRows,

        theme: "grid",

        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [197, 214, 230],
          lineWidth: 0.2,
        },

        headStyles: {
          fillColor: [11, 42, 74],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },

        columnStyles: {
          0: {
            cellWidth: 18,
            halign: "center",
          },

          1: {
            cellWidth: 100,
          },

          2: {
            cellWidth: 50,
            halign: "center",
          },
        },
      });

      /* FOOTER */

      const pageCount =
        pdf.getNumberOfPages();

      for (
        let page = 1;
        page <= pageCount;
        page++
      ) {
        pdf.setPage(page);

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(8);

        pdf.setTextColor(
          90,
          90,
          90
        );

        pdf.text(
          "Grade School IMC - Record Data Report",
          pageWidth / 2,
          pageHeight - 7,
          {
            align: "center",
          }
        );

        pdf.text(
          `Page ${page} of ${pageCount}`,
          pageWidth - margin,
          pageHeight - 7,
          {
            align: "right",
          }
        );
      }

      /* SAVE */

      const filename =
        viewMode === "month"
          ? `Record_Data_${selectedYear}.pdf`
          : "Record_Data_2026_2030.pdf";

      pdf.save(filename);
    } catch (error) {
      console.error(
        "PDF export error:",
        error
      );

      alert(
        "Unable to export the PDF report."
      );
    } finally {
      setExporting(false);
    }
  }

  /* =========================================================
     GRAPH MAX
  ========================================================= */

  const maxGraphValue = Math.max(
    ...graphData.map(
      (item) => item.value
    ),
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
            onChange={(e) =>
              setViewMode(e.target.value)
            }
          >
            <option value="month">
              Month
            </option>

            <option value="year">
              Year
            </option>
          </select>
        </div>

        {viewMode === "month" && (
          <div className="records-data-filter-group">
            <label>Year</label>

            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(e.target.value)
              }
            >
              {YEARS.map((year) => (
                <option
                  key={year}
                  value={year}
                >
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
                (item.value /
                  maxGraphValue) *
                100;

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
              ? selectedYear
              : "2026–2030"}
          </span>
        </div>

        <div className="records-data-summary">

          <div className="records-data-summary-card">
            <span>Total Records</span>

            <strong>
              {summary.total}
            </strong>
          </div>

          <div className="records-data-summary-card">
            <span>Highest Period</span>

            <strong className="records-data-summary-text">
              {summary.highest.label}
            </strong>
          </div>

          <div className="records-data-summary-card">
            <span>Highest Total</span>

            <strong>
              {summary.highest.value}
            </strong>
          </div>

          <div className="records-data-summary-card">
            <span>Lowest Period</span>

            <strong className="records-data-summary-text">
              {summary.lowest.label}
            </strong>
          </div>

          <div className="records-data-summary-card">
            <span>Average</span>

            <strong>
              {summary.average.toFixed(1)}
            </strong>
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
          {exporting
            ? "Exporting..."
            : "Export PDF"}
        </button>

      </div>

    </div>
  );
}