
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

import "./UsageData.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

/* =========================================================
   PURPOSE CATEGORIES
========================================================= */

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

/* =========================================================
   YEARS
========================================================= */

const YEARS = [2026, 2027, 2028, 2029, 2030];

/* =========================================================
   MONTHS
========================================================= */

const MONTHS = [
  { value: 1, label: "January", short: "Jan" },
  { value: 2, label: "February", short: "Feb" },
  { value: 3, label: "March", short: "Mar" },
  { value: 4, label: "April", short: "Apr" },
  { value: 5, label: "May", short: "May" },
  { value: 6, label: "June", short: "Jun" },
  { value: 7, label: "July", short: "Jul" },
  { value: 8, label: "August", short: "Aug" },
  { value: 9, label: "September", short: "Sep" },
  { value: 10, label: "October", short: "Oct" },
  { value: 11, label: "November", short: "Nov" },
  { value: 12, label: "December", short: "Dec" },
];

/* =========================================================
   DATE HELPERS
========================================================= */

const parseDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = parseDate(value);

  if (!date) return "—";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/* =========================================================
   PURPOSE HELPERS
========================================================= */

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

  return (
    PURPOSE_CATEGORIES.find(
      (category) =>
        category.toLowerCase() === cleanPurpose.toLowerCase()
    ) || "Others"
  );
};

/* =========================================================
   PURPOSE COUNTS

   Each log represents one registered session.
   If a session contains multiple purposes, each purpose
   is counted separately in the purpose breakdown.
========================================================= */

const calculatePurposeCounts = (logs) => {
  const counts = Object.fromEntries(
    PURPOSE_CATEGORIES.map((purpose) => [purpose, 0])
  );

  logs.forEach((log) => {
    const purposes = getPurposeList(log.purposes);

    if (purposes.length === 0) {
      counts.Others += 1;
      return;
    }

    purposes.forEach((purpose) => {
      counts[getMatchedPurpose(purpose)] += 1;
    });
  });

  return counts;
};

/* =========================================================
   MONTHLY PURPOSE DATA
========================================================= */

const calculateMonthlyPurposeData = (logs, selectedYear) => {
  const monthlyData = MONTHS.map((month) => ({
    month: month.short,
    monthNumber: month.value,
    Aralinks: 0,
    Research: 0,
    "Epic Reading": 0,
    Reading: 0,
    "Trivia Search": 0,
    Print: 0,
    Others: 0,
  }));

  logs.forEach((log) => {
    const date = parseDate(log.session_in);

    if (!date) return;

    const year = date.getFullYear();
    const monthNumber = date.getMonth() + 1;

    if (
      selectedYear !== "all" &&
      year !== Number(selectedYear)
    ) {
      return;
    }

    const monthData = monthlyData.find(
      (month) => month.monthNumber === monthNumber
    );

    if (!monthData) return;

    const purposes = getPurposeList(log.purposes);

    if (purposes.length === 0) {
      monthData.Others += 1;
      return;
    }

    purposes.forEach((purpose) => {
      monthData[getMatchedPurpose(purpose)] += 1;
    });
  });

  return monthlyData;
};

/* =========================================================
   MONTHLY TOTALS
========================================================= */

const calculateMonthlyTotals = (monthlyData) => {
  return monthlyData.map((month) => {
    const total = PURPOSE_CATEGORIES.reduce(
      (sum, purpose) => sum + month[purpose],
      0
    );

    return { ...month, total };
  });
};

/* =========================================================
   COLOR HELPER FOR PDF
========================================================= */

const hexToRgb = (hex) => {
  const cleanHex = hex.replace("#", "");

  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function UsageData() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [searchTerm, setSearchTerm] = useState("");

  /* =======================================================
     FETCH LOGS
  ======================================================= */

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: supabaseError } = await supabase
        .from("logs")
        .select("fullname, purposes, session_in, session_out")
        .order("session_in", { ascending: false });

      if (supabaseError) throw supabaseError;

      setLogs(data || []);
    } catch (err) {
      console.error("Error loading usage data:", err);

      setError(
        "Unable to load usage records. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  /* =======================================================
     FILTER LOGS
  ======================================================= */

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const date = parseDate(log.session_in);

      if (!date) return false;

      const yearMatches =
        selectedYear === "all" ||
        date.getFullYear() === Number(selectedYear);

      const searchValue = searchTerm.trim().toLowerCase();

      const searchMatches =
        searchValue === "" ||
        String(log.fullname || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(log.purposes || "")
          .toLowerCase()
          .includes(searchValue);

      return yearMatches && searchMatches;
    });
  }, [logs, selectedYear, searchTerm]);

  /* =======================================================
     MONTHLY DATA
  ======================================================= */

  const monthlyPurposeData = useMemo(
    () =>
      calculateMonthlyPurposeData(
        filteredLogs,
        selectedYear
      ),
    [filteredLogs, selectedYear]
  );

  const monthlyTotals = useMemo(
    () => calculateMonthlyTotals(monthlyPurposeData),
    [monthlyPurposeData]
  );

  /* =======================================================
     PURPOSE BREAKDOWN
  ======================================================= */

  const purposeCounts = useMemo(
    () => calculatePurposeCounts(filteredLogs),
    [filteredLogs]
  );

  const purposeBreakdown = useMemo(() => {
    const total = Object.values(purposeCounts).reduce(
      (sum, value) => sum + value,
      0
    );

    return PURPOSE_CATEGORIES.map((purpose, index) => {
      const count = purposeCounts[purpose];

      return {
        name: purpose,
        count,
        percentage:
          total > 0
            ? Number(((count / total) * 100).toFixed(1))
            : 0,
        order: index,
      };
    }).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.order - b.order;
    });
  }, [purposeCounts]);

  /* =======================================================
     HIGHEST PURPOSE
  ======================================================= */

  const highestPurpose = useMemo(() => {
    return purposeBreakdown[0] || {
      name: "—",
      count: 0,
    };
  }, [purposeBreakdown]);

  /* =======================================================
     HIGHEST MONTH
  ======================================================= */

  const highestMonth = useMemo(() => {
    return (
      [...monthlyTotals].sort(
        (a, b) => b.total - a.total
      )[0] || {
        month: "—",
        total: 0,
      }
    );
  }, [monthlyTotals]);

  /* =======================================================
     HIGHEST MONTH + PURPOSE
  ======================================================= */

  const highestMonthPurpose = useMemo(() => {
    let highest = {
      month: "—",
      purpose: "—",
      count: 0,
    };

    monthlyPurposeData.forEach((month) => {
      PURPOSE_CATEGORIES.forEach((purpose) => {
        if (month[purpose] > highest.count) {
          highest = {
            month: month.month,
            purpose,
            count: month[purpose],
          };
        }
      });
    });

    return highest;
  }, [monthlyPurposeData]);

  /* =======================================================
     TOTAL VISITS
  ======================================================= */

  const totalVisits = useMemo(
    () =>
      Object.values(purposeCounts).reduce(
        (sum, value) => sum + value,
        0
      ),
    [purposeCounts]
  );

  /* =======================================================
     AVERAGE MONTHLY VISITS

     Uses only months that belong to the selected period.
     For "All Years", totals are aggregated by calendar month.
  ======================================================= */

  const averageMonthlyVisits = useMemo(() => {
    if (!monthlyTotals.length) return 0;

    return Number(
      (
        monthlyTotals.reduce(
          (sum, month) => sum + month.total,
          0
        ) / monthlyTotals.length
      ).toFixed(1)
    );
  }, [monthlyTotals]);

  /* =======================================================
     DASHBOARD CHART DATA
  ======================================================= */

  const chartData = useMemo(
    () => ({
      labels: monthlyPurposeData.map(
        (month) => month.month
      ),

      datasets: PURPOSE_CATEGORIES.map((purpose) => ({
        label: purpose,

        data: monthlyPurposeData.map(
          (month) => month[purpose]
        ),

        backgroundColor: PURPOSE_COLORS[purpose],
        borderWidth: 0,
        borderSkipped: false,
        borderRadius: 0,
        maxBarThickness: 44,
        categoryPercentage: 0.8,
        barPercentage: 0.9,
        stack: "visits",
      })),
    }),
    [monthlyPurposeData]
  );

  /* =======================================================
     DASHBOARD CHART OPTIONS

     Shows the actual number inside every visible segment.
     Shows each month's total above the stacked bar.
  ======================================================= */

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false,
      },

      layout: {
        padding: {
          top: 25,
          right: 10,
          left: 5,
        },
      },

      plugins: {
        legend: {
          position: "bottom",

          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 18,

            font: {
              size: 12,
            },
          },
        },

        tooltip: {
          mode: "index",
          intersect: false,

          callbacks: {
            footer: (tooltipItems) => {
              const total = tooltipItems.reduce(
                (sum, item) =>
                  sum + Number(item.raw || 0),
                0
              );

              return `Total visits: ${total}`;
            },
          },
        },

        datalabels: {
          display: (context) => {
            return Number(context.dataset.data[context.dataIndex]) > 0;
          },

          color: "#ffffff",
          anchor: "center",
          align: "center",
          clamp: true,
          clip: true,

          font: {
            size: 10,
            weight: "bold",
          },

          formatter: (value) => {
            return Number(value) > 0 ? value : "";
          },
        },
      },

      scales: {
        x: {
          stacked: true,

          title: {
            display: true,
            text: "Month",

            font: {
              size: 13,
              weight: "600",
            },
          },

          grid: {
            display: false,
          },
        },

        y: {
          stacked: true,
          beginAtZero: true,

          ticks: {
            precision: 0,
          },

          title: {
            display: true,
            text: "Number of Visits",

            font: {
              size: 13,
              weight: "600",
            },
          },

          grid: {
            color: "#e5e7eb",
          },
        },
      },
    }),
    []
  );

  /* =======================================================
     PDF GRAPH

     Draws a stacked bar chart using the same purpose colors
     and monthly values as the dashboard.
     Each segment with enough space gets its actual count.
     Each month also gets its total above the bar.
  ======================================================= */

  const drawPurposeGraph = (doc, startY) => {
    const graphX = 25;
    const graphY = startY;
    const graphWidth = 160;
    const graphHeight = 65;
    const bottomY = graphY + graphHeight;

    const maxTotal = Math.max(
      1,
      ...monthlyTotals.map((month) => month.total)
    );

    // Round the vertical scale up to a readable whole number.
    const tickStep = Math.max(1, Math.ceil(maxTotal / 5));
    const axisMax = tickStep * 5;

    // Chart heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);

    doc.text("Number of Visits", graphX, graphY - 5);

    // Horizontal grid lines and Y-axis labels
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    for (let i = 0; i <= 5; i++) {
      const value = tickStep * i;
      const y = bottomY - (value / axisMax) * graphHeight;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(graphX, y, graphX + graphWidth, y);

      doc.setTextColor(90, 90, 90);
      doc.text(String(value), graphX - 3, y + 2, {
        align: "right",
      });
    }

    // Chart border and axis labels
    doc.setDrawColor(200, 205, 210);
    doc.line(graphX, graphY, graphX, bottomY);
    doc.line(graphX, bottomY, graphX + graphWidth, bottomY);

    const slotWidth = graphWidth / monthlyTotals.length;
    const barWidth = Math.min(8, slotWidth * 0.65);

    monthlyTotals.forEach((month, monthIndex) => {
      const centerX =
        graphX + slotWidth * monthIndex + slotWidth / 2;

      let currentY = bottomY;

      PURPOSE_CATEGORIES.forEach((purpose) => {
        const value = month[purpose];

        if (value <= 0) return;

        const segmentHeight =
          (value / axisMax) * graphHeight;

        const segmentY = currentY - segmentHeight;
        const { r, g, b } = hexToRgb(PURPOSE_COLORS[purpose]);

        doc.setFillColor(r, g, b);

        doc.rect(
          centerX - barWidth / 2,
          segmentY,
          barWidth,
          segmentHeight,
          "F"
        );

        // Label the individual segment when there is enough room.
        if (segmentHeight >= 5 && barWidth >= 5) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.setTextColor(255, 255, 255);

          doc.text(
            String(value),
            centerX,
            segmentY + segmentHeight / 2 + 1.5,
            { align: "center" }
          );
        }

        currentY = segmentY;
      });

      // Total visits above the stacked bar.
      if (month.total > 0) {
        const totalY =
          bottomY - (month.total / axisMax) * graphHeight;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(25, 25, 25);

        doc.text(
          String(month.total),
          centerX,
          Math.max(graphY + 1, totalY - 2),
          { align: "center" }
        );
      }

      // Month label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(70, 70, 70);

      doc.text(month.month, centerX, bottomY + 5, {
        align: "center",
      });
    });

    // X-axis title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);

    doc.text(
      "Month",
      graphX + graphWidth / 2,
      bottomY + 12,
      { align: "center" }
    );

    return bottomY + 17;
  };

  /* =======================================================
     PDF LEGEND

     Uses the same purpose colors as the dashboard.
  ======================================================= */

  const drawPurposeLegend = (doc, startY) => {
    const pageWidth = doc.internal.pageSize.width;
    const leftMargin = 20;
    const rightMargin = 20;
    const availableWidth = pageWidth - leftMargin - rightMargin;

    let x = leftMargin;
    let y = startY;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    PURPOSE_CATEGORIES.forEach((purpose) => {
      const labelWidth = doc.getTextWidth(purpose);
      const itemWidth = 5 + 3 + labelWidth + 8;

      if (x + itemWidth > leftMargin + availableWidth) {
        x = leftMargin;
        y += 7;
      }

      const { r, g, b } = hexToRgb(PURPOSE_COLORS[purpose]);

      doc.setFillColor(r, g, b);
      doc.rect(x, y - 3, 4, 4, "F");

      doc.setTextColor(70, 70, 70);
      doc.text(purpose, x + 7, y);

      x += itemWidth;
    });

    return y + 5;
  };

  /* =======================================================
     PDF FOOTER
  ======================================================= */

  const addFooter = (doc) => {
    const totalPages = doc.internal.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);

      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);

      doc.text(
        "Holy Family Academy Angeles City - Grade School IMC",
        20,
        pageHeight - 10
      );

      doc.text(
        `Page ${page} of ${totalPages}`,
        pageWidth - 20,
        pageHeight - 10,
        { align: "right" }
      );
    }
  };

  /* =======================================================
     PDF EXPORT ONLY
  ======================================================= */

  const exportPDF = () => {
    if (filteredLogs.length === 0) {
      alert("There are no records to export.");
      return;
    }

    const doc = new jsPDF();

    const yearLabel =
      selectedYear === "all"
        ? "All Years"
        : String(selectedYear);

    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(11, 42, 74);

    doc.text(
      "Holy Family Academy Angeles City",
      pageWidth / 2,
      18,
      { align: "center" }
    );

    doc.setFontSize(12);

    doc.text(
      "Grade School IMC",
      pageWidth / 2,
      25,
      { align: "center" }
    );

    doc.setFontSize(15);

    doc.text(
      "Usage Data Report",
      pageWidth / 2,
      35,
      { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    doc.text(`Year: ${yearLabel}`, 20, 45);

    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      20,
      51
    );

    // Monthly chart
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);

    doc.text("Monthly Usage by Purpose", 20, 62);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Stacked monthly visits by purpose. Numbers inside bars show individual purpose counts; numbers above bars show monthly totals.",
      20,
      68
    );

    const graphEndY = drawPurposeGraph(doc, 79);
    const legendEndY = drawPurposeLegend(doc, graphEndY + 5);

    // Summary
    let summaryStart = legendEndY + 5;

    if (summaryStart > 155) {
      doc.addPage();
      summaryStart = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);

    doc.text("Summary", 20, summaryStart);

    autoTable(doc, {
      startY: summaryStart + 5,
      theme: "grid",

      head: [["Metric", "Result"]],

      body: [
        ["Total Visits", String(totalVisits)],
        [
          "Most Used Purpose",
          `${highestPurpose.name} (${highestPurpose.count} visits)`,
        ],
        [
          "Highest Usage Month",
          `${highestMonth.month} (${highestMonth.total} visits)`,
        ],
        [
          "Highest Month-Purpose",
          `${highestMonthPurpose.purpose} in ${highestMonthPurpose.month} (${highestMonthPurpose.count} visits)`,
        ],
        [
          "Average Monthly Visits",
          String(averageMonthlyVisits),
        ],
      ],

      styles: {
        fontSize: 9,
        cellPadding: 3,
      },

      headStyles: {
        fillColor: [11, 42, 74],
      },

      margin: {
        left: 20,
        right: 20,
        bottom: 18,
      },
    });

    // Conclusion
    let conclusionY = doc.lastAutoTable.finalY + 10;

    if (conclusionY > 255) {
      doc.addPage();
      conclusionY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);

    doc.text("Conclusion", 20, conclusionY);

    const conclusionText =
      highestMonthPurpose.count > 0
        ? `The usage records show that ${highestMonthPurpose.purpose} had the highest number of recorded purpose visits during ${highestMonthPurpose.month}, with ${highestMonthPurpose.count} visits. This summary is based on the registered IMC usage records and the selected filters.`
        : "There are no sufficient usage records to determine the highest monthly purpose.";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const conclusionLines = doc.splitTextToSize(
      conclusionText,
      pageWidth - 40
    );

    doc.text(conclusionLines, 20, conclusionY + 7, {
      lineHeightFactor: 1.5,
    });

    // Purpose breakdown
    let purposeTableY =
      conclusionY + 10 + conclusionLines.length * 5;

    if (purposeTableY > 255) {
      doc.addPage();
      purposeTableY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    doc.text("Purpose Breakdown", 20, purposeTableY);

    autoTable(doc, {
      startY: purposeTableY + 5,
      theme: "grid",

      head: [
        ["Rank", "Purpose", "Visits", "Percentage"],
      ],

      body: purposeBreakdown.map((item, index) => [
        index + 1,
        item.name,
        item.count,
        `${item.percentage}%`,
      ]),

      styles: {
        fontSize: 9,
        cellPadding: 3,
      },

      headStyles: {
        fillColor: [11, 42, 74],
      },

      margin: {
        left: 20,
        right: 20,
        bottom: 18,
      },
    });

    addFooter(doc);

    doc.save(
      `IMC-Usage-Data-${yearLabel.replace(/\s/g, "-")}.pdf`
    );
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="usage-data-page">
        <div className="usage-data-loading">
          <div className="usage-data-spinner"></div>
          <p>Loading usage data...</p>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <div className="usage-data-page">
        <div className="usage-data-error">
          <h2>Unable to Load Usage Data</h2>
          <p>{error}</p>

          <button
            onClick={fetchLogs}
            className="usage-data-retry"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="usage-data-page">
      {/* HEADER */}

      <div className="usage-data-page-header">
        <div>
          <h1>Usage Data</h1>

          <p>
            View monthly visits and identify the most
            frequently used IMC services and purposes.
          </p>
        </div>

        <button
          className="usage-data-refresh"
          onClick={fetchLogs}
        >
          ↻ Refresh
        </button>
      </div>

      {/* FILTER BAR */}

      <div className="usage-data-filter-bar">
        <div className="usage-data-filter-group">
          <label htmlFor="usage-year">Year</label>

          <select
            id="usage-year"
            value={selectedYear}
            onChange={(e) =>
              setSelectedYear(
                e.target.value === "all"
                  ? "all"
                  : Number(e.target.value)
              )
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

        <div className="usage-data-filter-group usage-data-search-group">
          <label htmlFor="usage-search">Search</label>

          <input
            id="usage-search"
            type="text"
            placeholder="Search name or purpose..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="usage-data-showing">
          Showing <strong>{filteredLogs.length}</strong>{" "}
          registered records
        </div>
      </div>

      {/* MONTHLY GRAPH */}

      <div className="usage-data-panel">
        <div className="usage-data-panel-header">
          <div>
            <h2>Monthly Usage by Purpose</h2>

            <p>
              Numbers inside each colored bar represent visits
              for that purpose. The number above each bar is
              the monthly total.
            </p>
          </div>
        </div>

        <div className="usage-data-chart">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* MONTHLY HIGHLIGHTS */}

      <div className="usage-data-month-highlights">
        <div className="usage-data-highlight-header">
          <div>
            <h2>Monthly Highlights</h2>
            <p>The highest purpose for each month.</p>
          </div>
        </div>

        <div className="usage-data-month-grid">
          {monthlyTotals.map((month) => {
            const highestForMonth =
              PURPOSE_CATEGORIES.reduce(
                (highest, purpose) => {
                  if (month[purpose] > highest.count) {
                    return {
                      purpose,
                      count: month[purpose],
                    };
                  }

                  return highest;
                },
                {
                  purpose: "—",
                  count: 0,
                }
              );

            const fullMonth =
              MONTHS.find(
                (item) => item.value === month.monthNumber
              )?.label || month.month;

            return (
              <div
                className="usage-data-month-card"
                key={month.monthNumber}
              >
                <div className="usage-data-month-name">
                  {fullMonth}
                </div>

                <div className="usage-data-month-purpose">
                  {highestForMonth.count > 0 ? (
                    <>
                      <span
                        className="usage-data-purpose-dot"
                        style={{
                          backgroundColor:
                            PURPOSE_COLORS[
                              highestForMonth.purpose
                            ],
                        }}
                      ></span>

                      <strong>
                        {highestForMonth.purpose}
                      </strong>
                    </>
                  ) : (
                    <span>No visits</span>
                  )}
                </div>

                <div className="usage-data-month-count">
                  {highestForMonth.count > 0
                    ? `${highestForMonth.count} visits`
                    : "—"}
                </div>

                <div className="usage-data-month-total">
                  Total: <strong>{month.total}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SUMMARY */}

      <div className="usage-data-summary-section">
        <div className="usage-data-summary-header">
          <div>
            <h2>Summary</h2>
            <p>Overview of registered IMC usage.</p>
          </div>
        </div>

        <div className="usage-data-summary">
          <div className="usage-data-summary-card">
            <span>Total Visits</span>
            <strong>{totalVisits}</strong>
          </div>

          <div className="usage-data-summary-card">
            <span>Most Used Purpose</span>
            <strong>{highestPurpose.name}</strong>
            <small>{highestPurpose.count} visits</small>
          </div>

          <div className="usage-data-summary-card">
            <span>Highest Usage Month</span>
            <strong>{highestMonth.month}</strong>
            <small>{highestMonth.total} total visits</small>
          </div>

          <div className="usage-data-summary-card">
            <span>Highest Month-Purpose</span>
            <strong>{highestMonthPurpose.purpose}</strong>
            <small>
              {highestMonthPurpose.count} visits in{" "}
              {highestMonthPurpose.month}
            </small>
          </div>

          <div className="usage-data-summary-card">
            <span>Average Monthly Visits</span>
            <strong>{averageMonthlyVisits}</strong>
          </div>
        </div>
      </div>

      {/* PURPOSE BREAKDOWN */}

      <div className="usage-data-panel">
        <div className="usage-data-panel-header">
          <div>
            <h2>Purpose Breakdown</h2>
            <p>
              Actual recorded purpose visits for the selected
              period.
            </p>
          </div>
        </div>

        <div className="usage-data-breakdown-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Purpose</th>
                <th>Number of Visits</th>
                <th>Percentage</th>
              </tr>
            </thead>

            <tbody>
              {purposeBreakdown.map((item, index) => (
                <tr key={item.name}>
                  <td>{index + 1}</td>

                  <td>
                    <span
                      className="usage-data-purpose-dot"
                      style={{
                        backgroundColor:
                          PURPOSE_COLORS[item.name],
                      }}
                    ></span>{" "}
                    {item.name}
                  </td>

                  <td>
                    <strong>{item.count}</strong>
                  </td>

                  <td>{item.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPORT: PDF ONLY */}

      <div className="usage-data-export-section">
        <div>
          <h2>Export</h2>

          <p>
            Download the usage data analysis and monthly graph
            as a PDF report.
          </p>
        </div>

        <div className="usage-data-export-buttons">
          <button
            className="usage-data-export-button pdf"
            onClick={exportPDF}
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
