import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import "./Purpose.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const PURPOSE_CATEGORIES = [
  "Aralinks",
  "Research",
  "Epic Reading",
  "Reading",
  "Trivia Search",
  "Print",
  "Others",
];

const PURPOSE_COLORS = {
  Aralinks: "#1565c0",
  Research: "#16803c",
  "Epic Reading": "#7b1fa2",
  Reading: "#00838f",
  "Trivia Search": "#ef6c00",
  Print: "#d32f2f",
  Others: "#6b7280",
};

const YEARS = [2026, 2027, 2028, 2029, 2030];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const ITEMS_PER_PAGE = 15;

/* =====================================================
   SHARED UTILITIES
===================================================== */

const cleanName = (name) => {
  if (!name) return "";

  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
};

const parseDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getMonthName = (monthNumber) => {
  const month = MONTHS.find(
    (item) => item.value === Number(monthNumber)
  );

  return month ? month.label : "";
};

const getPurposeList = (purposes) => {
  if (!purposes) return [];

  if (Array.isArray(purposes)) {
    return purposes
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof purposes === "string") {
    return purposes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const getMatchedPurpose = (purpose) => {
  const cleanPurpose = String(purpose || "").trim();

  const matched = PURPOSE_CATEGORIES.find(
    (category) =>
      category.toLowerCase() === cleanPurpose.toLowerCase()
  );

  return matched || "Others";
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = parseDate(value);

  if (!date) return "—";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/* =====================================================
   PURPOSE ANALYTICS
===================================================== */

const calculateAnalytics = (logs) => {
  const counts = {};

  PURPOSE_CATEGORIES.forEach((category) => {
    counts[category] = 0;
  });

  logs.forEach((log) => {
    const purposes = getPurposeList(log.purposes);

    purposes.forEach((purpose) => {
      const matchedPurpose = getMatchedPurpose(purpose);
      counts[matchedPurpose] += 1;
    });
  });

  const total = Object.values(counts).reduce(
    (sum, value) => sum + value,
    0
  );

  const breakdown = PURPOSE_CATEGORIES.map((name, index) => {
    const count = counts[name];

    return {
      name,
      count,
      percentage:
        total > 0
          ? Number(((count / total) * 100).toFixed(1))
          : 0,
      order: index,
    };
  }).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return a.order - b.order;
  });

  return {
    total,
    sessions: logs.length,
    breakdown,
  };
};

/* =====================================================
   CHART VALUE LABELS
===================================================== */

const barValuePlugin = {
  id: "usageBarValueLabels",

  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const dataset = chart.data.datasets[0];

    if (!dataset) return;

    const meta = chart.getDatasetMeta(0);

    meta.data.forEach((bar, index) => {
      const value = dataset.data[index];

      if (
        value === null ||
        value === undefined ||
        Number(value) === 0
      ) {
        return;
      }

      ctx.save();
      ctx.fillStyle = "#000000";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), bar.x + 7, bar.y);
      ctx.restore();
    });
  },
};

/* =====================================================
   COMPONENT
===================================================== */

export default function Purpose() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [excelExporting, setExcelExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const chartRef = useRef(null);

  /* =====================================================
     FETCH LOGS
  ===================================================== */

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("logs")
        .select("fullname, purposes, session_in, session_out")
        .order("session_in", { ascending: false });

      if (error) {
        console.error("Error fetching usage logs:", error);
        setLogs([]);
        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error("Unexpected error fetching usage logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  /* =====================================================
     FILTER LOGS
  ===================================================== */

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const date = parseDate(log.session_in);

      if (!date) return false;

      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const monthMatches =
        selectedMonth === "all" ||
        month === Number(selectedMonth);

      const yearMatches =
        selectedYear === "all" ||
        year === Number(selectedYear);

      return monthMatches && yearMatches;
    });
  }, [logs, selectedMonth, selectedYear]);

  /* =====================================================
     ANALYTICS
  ===================================================== */

  const analytics = useMemo(
    () => calculateAnalytics(filteredLogs),
    [filteredLogs]
  );

  const breakdown = analytics.breakdown;

  const usedBreakdown = breakdown.filter(
    (item) => item.count > 0
  );

  const highestPurpose =
    usedBreakdown.length > 0 ? usedBreakdown[0] : null;

  const lowestPurpose =
    usedBreakdown.length > 0
      ? usedBreakdown[usedBreakdown.length - 1]
      : null;

  /* =====================================================
     REPORTING PERIOD
  ===================================================== */

  const periodLabel = useMemo(() => {
    if (selectedMonth === "all" && selectedYear === "all") {
      return "All Months and Years";
    }

    if (selectedMonth !== "all" && selectedYear !== "all") {
      return `${getMonthName(selectedMonth)} ${selectedYear}`;
    }

    if (selectedMonth !== "all") {
      return getMonthName(selectedMonth);
    }

    return String(selectedYear);
  }, [selectedMonth, selectedYear]);

  /* =====================================================
     CONCLUSION
  ===================================================== */

  const summaryText = useMemo(() => {
    if (usedBreakdown.length === 0) {
      return `No internet or computer usage records were found for ${periodLabel}. Therefore, no conclusion regarding the distribution of recorded purposes can be established for this reporting period.`;
    }

    const highest = highestPurpose;
    const lowest = lowestPurpose;

    const rankingText = usedBreakdown
      .map(
        (item) =>
          `${item.name} (${item.count} ${
            item.count === 1 ? "selection" : "selections"
          }, ${item.percentage}%)`
      )
      .join("; ");

    let conclusion =
      `For ${periodLabel}, ${highest.name} was the most frequently recorded purpose, with ${highest.count} ${
        highest.count === 1 ? "selection" : "selections"
      }, representing ${highest.percentage}% of all recorded purpose selections. `;

    conclusion +=
      `The distribution of recorded purposes, ranked from highest to lowest, was as follows: ${rankingText}. `;

    if (lowest) {
      conclusion +=
        `${lowest.name} recorded the lowest usage, with ${lowest.count} ${
          lowest.count === 1 ? "selection" : "selections"
        } (${lowest.percentage}%). `;
    }

    conclusion +=
      "These results describe the recorded purposes of internet and computer use during the specified reporting period.";

    return conclusion;
  }, [
    usedBreakdown,
    highestPurpose,
    lowestPurpose,
    periodLabel,
  ]);

  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    setCurrentPage((page) =>
      Math.min(Math.max(page, 1), totalPages)
    );
  }, [totalPages]);

  const safeCurrentPage = Math.min(
    Math.max(currentPage, 1),
    totalPages
  );

  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;

    return filteredLogs.slice(
      start,
      start + ITEMS_PER_PAGE
    );
  }, [filteredLogs, safeCurrentPage]);

  const pageNumbers = useMemo(() => {
    const maxVisible = 5;

    let start = Math.max(1, safeCurrentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    start = Math.max(1, end - maxVisible + 1);

    const pages = [];

    for (let page = start; page <= end; page++) {
      pages.push(page);
    }

    return pages;
  }, [safeCurrentPage, totalPages]);

  /* =====================================================
     CHART DATA
  ===================================================== */

  const chartData = useMemo(
    () => ({
      labels: breakdown.map((item) => item.name),
      datasets: [
        {
          label: "Purpose Selections",
          data: breakdown.map((item) => item.count),
          backgroundColor: breakdown.map(
            (item) => PURPOSE_COLORS[item.name]
          ),
          borderColor: breakdown.map(
            (item) => PURPOSE_COLORS[item.name]
          ),
          borderWidth: 1,
          borderRadius: 3,
          barThickness: 30,
          maxBarThickness: 34,
        },
      ],
    }),
    [breakdown]
  );

  /* =====================================================
     CHART OPTIONS
  ===================================================== */

  const chartOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          right: 40,
          left: 5,
          top: 5,
          bottom: 5,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              ` ${context.raw} ${
                context.raw === 1 ? "selection" : "selections"
              }`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grace: "12%",
          ticks: {
            precision: 0,
            color: "#000000",
            font: {
              size: 11,
              weight: "normal",
            },
          },
          grid: {
            color: "#e5e7eb",
          },
        },
        y: {
          ticks: {
            color: "#000000",
            font: {
              size: 11,
              weight: "normal",
            },
            padding: 8,
          },
          grid: {
            display: false,
          },
        },
      },
    }),
    []
  );

  /* =====================================================
     EXCEL EXPORT
  ===================================================== */

  const exportExcel = () => {
    try {
      setExcelExporting(true);

      const rows = filteredLogs.map((log, index) => {
        const purposes = getPurposeList(log.purposes);

        return {
          No: index + 1,
          Name: cleanName(log.fullname) || "—",
          Purpose:
            purposes.length > 0
              ? purposes.map(getMatchedPurpose).join(", ")
              : "Others",
          "Session In": formatDateTime(log.session_in),
          "Session Out": formatDateTime(log.session_out),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      worksheet["!cols"] = [
        { wch: 7 },
        { wch: 30 },
        { wch: 32 },
        { wch: 24 },
        { wch: 24 },
      ];

      if (rows.length > 0) {
        worksheet["!autofilter"] = {
          ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: rows.length, c: 4 },
          }),
        };
      }

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Usage Records"
      );

      XLSX.writeFile(
        workbook,
        `Internet_Usage_${periodLabel.replace(/\s+/g, "_")}.xlsx`
      );
    } catch (error) {
      console.error("Excel export error:", error);
      window.alert(
        "Unable to export the Excel report. Please try again."
      );
    } finally {
      setExcelExporting(false);
    }
  };

  /* =====================================================
     FORMAL PDF EXPORT
  ===================================================== */

  const exportPDF = async () => {
    try {
      setExporting(true);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      const footerY = pageHeight - 9;
      const bodyBottom = pageHeight - 22;

      /* STANDARD TEXT SETTINGS */

      const setBodyFont = (size = 10) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(0, 0, 0);
      };

      /* FOOTER ON EVERY PAGE */

      const addFooter = (pageNumber, totalPages) => {
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.2);

        pdf.line(
          margin,
          pageHeight - 14,
          pageWidth - margin,
          pageHeight - 14
        );

        setBodyFont(8);

        pdf.text(
          "Holy Family Academy | Grade School IMC",
          margin,
          footerY
        );

        pdf.text(
          `Page ${pageNumber} of ${totalPages}`,
          pageWidth - margin,
          footerY,
          { align: "right" }
        );
      };

      /* =================================================
         FIRST PAGE HEADER
      ================================================= */

      const headerTop = 13;

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, 37, "F");

      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);

      pdf.text(
        "Holy Family Academy",
        pageWidth / 2,
        headerTop,
        { align: "center" }
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      pdf.text(
        "Angeles City",
        pageWidth / 2,
        headerTop + 5,
        { align: "center" }
      );

      pdf.text(
        "Grade School IMC",
        pageWidth / 2,
        headerTop + 10,
        { align: "center" }
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);

      pdf.text(
        "Internet Usage Report",
        pageWidth / 2,
        headerTop + 17,
        { align: "center" }
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      pdf.text(
        `Reporting Period: ${periodLabel}`,
        pageWidth / 2,
        headerTop + 22,
        { align: "center" }
      );

      pdf.setDrawColor(130, 130, 130);
      pdf.setLineWidth(0.35);

      pdf.line(
        margin,
        38,
        pageWidth - margin,
        38
      );

      let currentY = 45;

      /* =================================================
         PURPOSE BREAKDOWN GRAPH
      ================================================= */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      pdf.text("Purpose Breakdown", margin, currentY);

      currentY += 5;

      const graphWidth = contentWidth;
      const graphHeight = 72;
      const graphX = margin;
      const graphY = currentY;

      const maxValue = Math.max(
        ...breakdown.map((item) => item.count),
        1
      );

      const labelWidth = 38;
      const valueWidth = 12;

      const barAreaWidth = Math.max(
        20,
        graphWidth - labelWidth - valueWidth
      );

      const rowHeight =
        graphHeight / PURPOSE_CATEGORIES.length;

      breakdown.forEach((item, index) => {
        const centerY =
          graphY + rowHeight * index + rowHeight / 2;

        setBodyFont(8.5);

        pdf.text(
          item.name,
          graphX,
          centerY + 1
        );

        const barX = graphX + labelWidth;
        const barHeight = 5;
        const barY = centerY - barHeight / 2;

        pdf.setFillColor(238, 238, 238);

        pdf.rect(
          barX,
          barY,
          barAreaWidth,
          barHeight,
          "F"
        );

        const barWidth =
          (item.count / maxValue) * barAreaWidth;

        const hex =
          PURPOSE_COLORS[item.name] || "#6b7280";

        const red = parseInt(hex.slice(1, 3), 16);
        const green = parseInt(hex.slice(3, 5), 16);
        const blue = parseInt(hex.slice(5, 7), 16);

        if (barWidth > 0) {
          pdf.setFillColor(red, green, blue);

          pdf.rect(
            barX,
            barY,
            barWidth,
            barHeight,
            "F"
          );
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(0, 0, 0);

        pdf.text(
          String(item.count),
          barX + barAreaWidth + 3,
          centerY + 1
        );
      });

      currentY += graphHeight + 4;

      /* =================================================
         SUMMARY TOTAL
         Only Total Recorded Sessions
      ================================================= */

/* =================================================
   SUMMARY TOTAL
================================================= */

    pdf.setDrawColor(175, 175, 175);
    pdf.setLineWidth(0.25);

    pdf.line(
      margin,
      currentY,
      pageWidth - margin,
      currentY
    );

    currentY += 7;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);

    pdf.text("Total Purpose Selections", margin, currentY);

    pdf.setFont("helvetica", "normal");

    pdf.text(
      String(analytics.total),
      pageWidth - margin,
      currentY,
      { align: "right" }
    );

    currentY += 7;

      /* =================================================
         CONCLUSION
      ================================================= */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      pdf.text("Conclusion", margin, currentY);

      currentY += 6;

      setBodyFont(10);

      const conclusionLines = pdf.splitTextToSize(
        summaryText,
        contentWidth
      );

      const conclusionLineHeight = 7;

      conclusionLines.forEach((line) => {
        if (currentY + conclusionLineHeight > bodyBottom) {
          pdf.addPage();
          currentY = margin + 2;
        }

        pdf.text(line, margin, currentY);
        currentY += conclusionLineHeight;
      });

      /* =================================================
         SIGNATORIES
         Prepared By / Reviewed By
      ================================================= */

     /* =================================================
   SIGNATORIES
================================================= */

    const signatureBlockHeight = 28;

    if (currentY + signatureBlockHeight > bodyBottom) {
      pdf.addPage();
      currentY = margin + 5;
    } else {
      currentY += 5;
    }

    const signatureColumnWidth = contentWidth / 2;
    const leftColumnX = margin;
    const rightColumnX = margin + signatureColumnWidth;

    const signatureLabelY = currentY;
    const nameY = currentY + 10;
    const lineY = currentY + 12;
    const positionY = currentY + 16;

    /* PREPARED BY */

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);

    pdf.text("Prepared By:", leftColumnX, signatureLabelY);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);

    pdf.text("Airon Lingad", leftColumnX, nameY);

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.25);

    pdf.line(
      leftColumnX,
      lineY,
      leftColumnX + 48,
      lineY
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    pdf.text("Library IT Staff", leftColumnX, positionY);

    /* REVIEWED BY */

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    pdf.text("Reviewed By:", rightColumnX, signatureLabelY);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);

    pdf.text("Remedios Baking", rightColumnX, nameY);

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.25);

    pdf.line(
      rightColumnX,
      lineY,
      rightColumnX + 48,
      lineY
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    pdf.text("IMC Coordinator", rightColumnX, positionY);

      /* =================================================
         REGISTERED USAGE RECORDS
         START ON A SEPARATE PAGE
      ================================================= */

      pdf.addPage();

      const logRows = filteredLogs.map((log, index) => {
        const purposes = getPurposeList(log.purposes);

        return [
          index + 1,
          cleanName(log.fullname) || "—",
          purposes.length > 0
            ? purposes.map(getMatchedPurpose).join(", ")
            : "Others",
          formatDateTime(log.session_in),
          formatDateTime(log.session_out),
        ];
      });

      autoTable(pdf, {
        startY: margin,
        margin: {
          left: margin,
          right: margin,
          top: margin,
          bottom: 18,
        },
        tableWidth: contentWidth,

        head: [
          [
            "No.",
            "Name",
            "Purpose",
            "Session In",
            "Session Out",
          ],
        ],

        body:
          logRows.length > 0
            ? logRows
            : [["—", "No records found", "—", "—", "—"]],

        theme: "grid",
        showHead: "everyPage",

        styles: {
          font: "helvetica",
          fontSize: 8,
          textColor: [0, 0, 0],
          lineColor: [180, 180, 180],
          lineWidth: 0.2,
          cellPadding: 2,
          valign: "middle",
          overflow: "linebreak",
          minCellHeight: 6,
        },

        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8,
          lineColor: [130, 130, 130],
          lineWidth: 0.25,
          halign: "left",
        },

        bodyStyles: {
          textColor: [0, 0, 0],
          fontStyle: "normal",
        },

        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },

        columnStyles: {
          0: {
            cellWidth: 9,
            halign: "center",
          },
          1: {
            cellWidth: 42,
          },
          2: {
            cellWidth: 45,
          },
          3: {
            cellWidth: 44,
          },
          4: {
            cellWidth: 44,
          },
        },

        didParseCell: (data) => {
          data.cell.styles.textColor = [0, 0, 0];

          if (data.section === "body") {
            data.cell.styles.fontStyle = "normal";
          }
        },

        rowPageBreak: "avoid",
        pageBreak: "auto",
      });

      /* =================================================
         PAGE NUMBERS AND FOOTERS
      ================================================= */

      const totalPdfPages = pdf.internal.getNumberOfPages();

      for (let page = 1; page <= totalPdfPages; page++) {
        pdf.setPage(page);
        addFooter(page, totalPdfPages);
      }

      /* SAVE PDF */

      pdf.save(
        `Internet_Usage_Report_${periodLabel.replace(/\s+/g, "_")}.pdf`
      );
    } catch (error) {
      console.error("PDF export error:", error);

      window.alert(
        "Unable to export the PDF report. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  /* =====================================================
     USER INTERFACE
  ===================================================== */

  return (
    <div className="usage-content">
      {/* PAGE HEADER */}

      <div className="usage-header">
        <div>
          <h1>Usage</h1>
          <p>
            Internet and computer usage analytics and registered logs
          </p>
        </div>

        <div className="usage-header-actions">
          <button
            type="button"
            className="usage-btn usage-btn-refresh"
            onClick={fetchLogs}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="usage-btn usage-btn-export"
            onClick={exportPDF}
            disabled={exporting || loading}
          >
            {exporting ? "Exporting..." : "Export PDF"}
          </button>

          <button
            type="button"
            className="usage-btn usage-btn-excel"
            onClick={exportExcel}
            disabled={excelExporting || loading}
          >
            {excelExporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>
      </div>

      {/* FILTERS */}

      <div className="usage-control-bar">
        <div className="usage-filter-group">
          <label htmlFor="usage-month">Month</label>

          <select
            id="usage-month"
            value={selectedMonth}
            onChange={(event) =>
              setSelectedMonth(event.target.value)
            }
          >
            <option value="all">All Months</option>

            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        <div className="usage-filter-group">
          <label htmlFor="usage-year">Year</label>

          <select
            id="usage-year"
            value={selectedYear}
            onChange={(event) =>
              setSelectedYear(event.target.value)
            }
          >
            <option value="all">All Years</option>

            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="usage-period-display">
          <span>Reporting Period:</span>
          <strong>{periodLabel}</strong>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="usage-summary-grid">
        <div className="usage-stat-card">
          <span className="usage-stat-label">
            Purpose Selections
          </span>
          <span className="usage-stat-value">
            {analytics.total}
          </span>
        </div>

        <div className="usage-stat-card">
          <span className="usage-stat-label">
            Most Used Purpose
          </span>
          <span className="usage-stat-value usage-stat-purpose">
            {highestPurpose ? highestPurpose.name : "—"}
          </span>
        </div>

        <div className="usage-stat-card">
          <span className="usage-stat-label">
            Least Used Purpose
          </span>
          <span className="usage-stat-value usage-stat-purpose">
            {lowestPurpose ? lowestPurpose.name : "—"}
          </span>
        </div>

        <div className="usage-stat-card">
          <span className="usage-stat-label">
            Recorded Sessions
          </span>
          <span className="usage-stat-value">
            {analytics.sessions}
          </span>
        </div>
      </div>

      {/* CHART */}

      <section className="usage-section usage-chart-section">
        <div className="usage-section-header">
          <div>
            <h2>Purpose Breakdown</h2>
            <p>
              Distribution of recorded purpose selections, ranked by frequency
            </p>
          </div>
        </div>

        {loading ? (
          <div className="usage-empty-state">
            Loading usage data...
          </div>
        ) : analytics.total === 0 ? (
          <div className="usage-empty-state">
            No usage data found for {periodLabel}.
          </div>
        ) : (
          <div className="usage-chart-container">
            <Bar
              ref={chartRef}
              data={chartData}
              options={chartOptions}
              plugins={[barValuePlugin]}
            />
          </div>
        )}
      </section>

      {/* CONCLUSION */}

      <section className="usage-summary-box">
        <div className="usage-summary-box-header">
          <h2>Conclusion</h2>
        </div>

        <p>{summaryText}</p>
      </section>

      {/* DETAILED PURPOSE BREAKDOWN */}

      <section className="usage-section">
        <div className="usage-section-header">
          <div>
            <h2>Detailed Purpose Breakdown</h2>
            <p>
              Recorded selections and their percentage distribution
            </p>
          </div>
        </div>

        <div className="usage-breakdown-list">
          {breakdown.map((item, index) => (
            <div className="usage-breakdown-item" key={item.name}>
              <div className="usage-breakdown-rank">
                {index + 1}.
              </div>

              <div
                className="usage-breakdown-color"
                style={{
                  backgroundColor: PURPOSE_COLORS[item.name],
                }}
              />

              <div className="usage-breakdown-main">
                <div className="usage-breakdown-top">
                  <span className="usage-breakdown-name">
                    {item.name}
                  </span>

                  <span className="usage-breakdown-count">
                    {item.count}{" "}
                    {item.count === 1 ? "selection" : "selections"}
                  </span>
                </div>

                <div className="usage-progress-track">
                  <div
                    className="usage-progress-bar"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: PURPOSE_COLORS[item.name],
                    }}
                  />
                </div>
              </div>

              <div className="usage-breakdown-percentage">
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REGISTERED USAGE LOGS */}

      <section className="usage-section">
        <div className="usage-section-header">
          <div>
            <h2>Registered Usage Logs</h2>
            <p>
              Individual computer and internet usage records
            </p>
          </div>

          <span className="usage-record-count">
            {filteredLogs.length}{" "}
            {filteredLogs.length === 1 ? "record" : "records"}
          </span>
        </div>

        <div className="usage-table-wrapper">
          <table className="usage-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Purpose</th>
                <th>Session In</th>
                <th>Session Out</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="usage-table-message">
                    Loading records...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="usage-table-message">
                    No usage records found.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => {
                  const purposes = getPurposeList(log.purposes);

                  return (
                    <tr key={`${log.session_in}-${index}`}>
                      <td>
                        {(safeCurrentPage - 1) * ITEMS_PER_PAGE +
                          index +
                          1}
                      </td>

                      <td className="usage-name-cell">
                        {cleanName(log.fullname) || "—"}
                      </td>

                      <td className="usage-purpose-cell">
                        {purposes.length > 0
                          ? purposes.map(getMatchedPurpose).join(", ")
                          : "Others"}
                      </td>

                      <td>{formatDateTime(log.session_in)}</td>

                      <td>{formatDateTime(log.session_out)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}

        {!loading && filteredLogs.length > ITEMS_PER_PAGE && (
          <div className="usage-pagination">
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={safeCurrentPage === 1}
            >
              Previous
            </button>

            {pageNumbers[0] > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                >
                  1
                </button>

                {pageNumbers[0] > 2 && <span>…</span>}
              </>
            )}

            {pageNumbers.map((page) => (
              <button
                type="button"
                key={page}
                className={
                  safeCurrentPage === page ? "active" : ""
                }
                onClick={() => setCurrentPage(page)}
                aria-current={
                  safeCurrentPage === page ? "page" : undefined
                }
              >
                {page}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] <
                  totalPages - 1 && <span>…</span>}

                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              disabled={safeCurrentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
