import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import * as XLSX from "xlsx";

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

import "./UsageData.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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
   DATE PARSER
========================================================= */

const parseDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

/* =========================================================
   FORMAT DATE
========================================================= */

const formatDateTime = (value) => {
  const date = parseDate(value);

  if (!date) {
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

/* =========================================================
   PURPOSE LIST
========================================================= */

const getPurposeList = (purposes) => {
  if (!purposes) {
    return [];
  }

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

/* =========================================================
   MATCH PURPOSE
========================================================= */

const getMatchedPurpose = (purpose) => {
  const cleanPurpose = String(purpose || "").trim();

  const matched = PURPOSE_CATEGORIES.find(
    (category) =>
      category.toLowerCase() === cleanPurpose.toLowerCase()
  );

  return matched || "Others";
};

/* =========================================================
   CALCULATE PURPOSE COUNTS
========================================================= */

const calculatePurposeCounts = (logs) => {
  const counts = {};

  PURPOSE_CATEGORIES.forEach((category) => {
    counts[category] = 0;
  });

  logs.forEach((log) => {
    const purposes = getPurposeList(log.purposes);

    if (purposes.length === 0) {
      counts.Others += 1;
      return;
    }

    purposes.forEach((purpose) => {
      const matchedPurpose = getMatchedPurpose(purpose);

      counts[matchedPurpose] += 1;
    });
  });

  return counts;
};

/* =========================================================
   MONTHLY PURPOSE DATA
========================================================= */

const calculateMonthlyPurposeData = (
  logs,
  selectedYear
) => {
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

    if (!date) {
      return;
    }

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

    if (!monthData) {
      return;
    }

    const purposes = getPurposeList(log.purposes);

    /*
      No purpose = Others
    */
    if (purposes.length === 0) {
      monthData.Others += 1;
      return;
    }

    /*
      Each purpose is counted as one visit.
    */
    purposes.forEach((purpose) => {
      const matchedPurpose = getMatchedPurpose(purpose);

      monthData[matchedPurpose] += 1;
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

    return {
      ...month,
      total,
    };
  });
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

      const { data, error: supabaseError } =
        await supabase
          .from("logs")
          .select(
            "fullname, purposes, session_in, session_out"
          )
          .order("session_in", {
            ascending: false,
          });

      if (supabaseError) {
        throw supabaseError;
      }

      setLogs(data || []);
    } catch (err) {
      console.error(
        "Error loading usage data:",
        err
      );

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

      if (!date) {
        return false;
      }

      const year = date.getFullYear();

      const yearMatches =
        selectedYear === "all" ||
        year === Number(selectedYear);

      const searchValue =
        searchTerm.trim().toLowerCase();

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
     MONTHLY PURPOSE DATA
  ======================================================= */

  const monthlyPurposeData = useMemo(() => {
    return calculateMonthlyPurposeData(
      filteredLogs,
      selectedYear
    );
  }, [filteredLogs, selectedYear]);

  /* =======================================================
     MONTHLY TOTALS
  ======================================================= */

  const monthlyTotals = useMemo(() => {
    return calculateMonthlyTotals(
      monthlyPurposeData
    );
  }, [monthlyPurposeData]);

  /* =======================================================
     PURPOSE COUNTS
  ======================================================= */

  const purposeCounts = useMemo(() => {
    return calculatePurposeCounts(filteredLogs);
  }, [filteredLogs]);

  /* =======================================================
     PURPOSE BREAKDOWN
  ======================================================= */

  const purposeBreakdown = useMemo(() => {
    const total = Object.values(
      purposeCounts
    ).reduce(
      (sum, value) => sum + value,
      0
    );

    return PURPOSE_CATEGORIES.map(
      (purpose, index) => {
        const count =
          purposeCounts[purpose];

        return {
          name: purpose,

          count,

          percentage:
            total > 0
              ? Number(
                  (
                    (count / total) *
                    100
                  ).toFixed(1)
                )
              : 0,

          order: index,
        };
      }
    ).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.order - b.order;
    });
  }, [purposeCounts]);

  /* =======================================================
     HIGHEST PURPOSE
  ======================================================= */

  const highestPurpose = useMemo(() => {
    if (!purposeBreakdown.length) {
      return {
        name: "—",
        count: 0,
      };
    }

    return purposeBreakdown[0];
  }, [purposeBreakdown]);

  /* =======================================================
     HIGHEST MONTH
  ======================================================= */

  const highestMonth = useMemo(() => {
    if (!monthlyTotals.length) {
      return {
        month: "—",
        total: 0,
      };
    }

    return [...monthlyTotals].sort(
      (a, b) => b.total - a.total
    )[0];
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

    monthlyPurposeData.forEach(
      (month) => {
        PURPOSE_CATEGORIES.forEach(
          (purpose) => {
            if (
              month[purpose] >
              highest.count
            ) {
              highest = {
                month: month.month,
                purpose,
                count:
                  month[purpose],
              };
            }
          }
        );
      }
    );

    return highest;
  }, [monthlyPurposeData]);

  /* =======================================================
     TOTAL VISITS
  ======================================================= */

  const totalVisits = useMemo(() => {
    return Object.values(
      purposeCounts
    ).reduce(
      (sum, value) => sum + value,
      0
    );
  }, [purposeCounts]);

  /* =======================================================
     AVERAGE MONTHLY VISITS
  ======================================================= */

  const averageMonthlyVisits = useMemo(() => {
    if (!monthlyTotals.length) {
      return 0;
    }

    return Number(
      (
        monthlyTotals.reduce(
          (sum, month) =>
            sum + month.total,
          0
        ) / monthlyTotals.length
      ).toFixed(1)
    );
  }, [monthlyTotals]);

  /* =======================================================
     CHART DATA
  ======================================================= */

  const chartData = {
    labels: monthlyPurposeData.map(
      (month) => month.month
    ),

    datasets:
      PURPOSE_CATEGORIES.map(
        (purpose) => ({
          label: purpose,

          data: monthlyPurposeData.map(
            (month) =>
              month[purpose]
          ),

          backgroundColor:
            PURPOSE_COLORS[
              purpose
            ],

          borderWidth: 0,
        })
      ),
  };

  /* =======================================================
     CHART OPTIONS
  ======================================================= */

  const chartOptions = {
    responsive: true,

    maintainAspectRatio: false,

    interaction: {
      mode: "index",
      intersect: false,
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
            const total =
              tooltipItems.reduce(
                (sum, item) =>
                  sum +
                  Number(
                    item.raw || 0
                  ),
                0
              );

            return `Total visits: ${total}`;
          },
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
  };

  /* =======================================================
     EXCEL EXPORT
  ======================================================= */

  const exportExcel = () => {
    if (filteredLogs.length === 0) {
      alert(
        "There are no records to export."
      );

      return;
    }

    const exportData =
      filteredLogs.map(
        (log, index) => ({
          No: index + 1,

          Name:
            log.fullname || "—",

          Purpose:
            getPurposeList(
              log.purposes
            ).join(", ") ||
            "Others",

          "Session In":
            formatDateTime(
              log.session_in
            ),

          "Session Out":
            formatDateTime(
              log.session_out
            ),
        })
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        exportData
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Usage Data"
    );

    const yearLabel =
      selectedYear === "all"
        ? "All-Years"
        : selectedYear;

    XLSX.writeFile(
      workbook,
      `IMC-Usage-Data-${yearLabel}.xlsx`
    );
  };

  /* =======================================================
     DRAW PDF GRAPH
  ======================================================= */

  const drawPurposeGraph = (
    doc,
    startY
  ) => {
    const graphX = 20;

    const graphWidth = 170;

    const graphHeight = 65;

    const bottomY =
      startY + graphHeight;

    const maxValue = Math.max(
      1,
      ...monthlyTotals.map(
        (month) => month.total
      )
    );

    /*
      Graph border
    */

    doc.setDrawColor(
      220,
      225,
      230
    );

    doc.rect(
      graphX,
      startY,
      graphWidth,
      graphHeight
    );

    /*
      Grid
    */

    const gridCount = 5;

    doc.setFontSize(7);

    for (
      let i = 0;
      i <= gridCount;
      i++
    ) {
      const y =
        bottomY -
        (graphHeight /
          gridCount) *
          i;

      doc.setDrawColor(
        230,
        234,
        238
      );

      doc.line(
        graphX,
        y,
        graphX + graphWidth,
        y
      );

      const value =
        Math.round(
          (maxValue /
            gridCount) *
            i
        );

      doc.setTextColor(
        100,
        100,
        100
      );

      doc.text(
        String(value),
        graphX - 5,
        y + 2,
        {
          align: "right",
        }
      );
    }

    /*
      Month bars
    */

    const barAreaWidth =
      graphWidth - 10;

    const barWidth =
      barAreaWidth /
      monthlyTotals.length;

    monthlyTotals.forEach(
      (month, monthIndex) => {
        const x =
          graphX +
          5 +
          monthIndex *
            barWidth;

        let currentY =
          bottomY;

        PURPOSE_CATEGORIES.forEach(
          (purpose) => {
            const value =
              month[purpose];

            if (value <= 0) {
              return;
            }

            const segmentHeight =
              (value / maxValue) *
              graphHeight;

            const hex =
              PURPOSE_COLORS[
                purpose
              ].replace(
                "#",
                ""
              );

            const r =
              parseInt(
                hex.substring(
                  0,
                  2
                ),
                16
              );

            const g =
              parseInt(
                hex.substring(
                  2,
                  4
                ),
                16
              );

            const b =
              parseInt(
                hex.substring(
                  4,
                  6
                ),
                16
              );

            doc.setFillColor(
              r,
              g,
              b
            );

            doc.rect(
              x,
              currentY -
                segmentHeight,
              Math.max(
                4,
                barWidth - 2
              ),
              segmentHeight,
              "F"
            );

            currentY -=
              segmentHeight;
          }
        );

        doc.setFontSize(7);

        doc.setTextColor(
          70,
          70,
          70
        );

        doc.text(
          month.month,
          x +
            Math.max(
              4,
              barWidth - 2
            ) /
              2,
          bottomY + 7,
          {
            align: "center",
          }
        );
      }
    );

    return bottomY + 12;
  };

  /* =======================================================
     PDF FOOTER
  ======================================================= */

  const addFooter = (doc) => {
    const totalPages =
      doc.internal.getNumberOfPages();

    for (
      let page = 1;
      page <= totalPages;
      page++
    ) {
      doc.setPage(page);

      const pageHeight =
        doc.internal.pageSize
          .height;

      doc.setFontSize(8);

      doc.setTextColor(
        110,
        110,
        110
      );

      doc.text(
        "Holy Family Academy Angeles City - Grade School IMC",
        20,
        pageHeight - 10
      );

      doc.text(
        `Page ${page} of ${totalPages}`,
        190,
        pageHeight - 10,
        {
          align: "right",
        }
      );
    }
  };

  /* =======================================================
     PDF EXPORT
  ======================================================= */

  const exportPDF = () => {
    if (filteredLogs.length === 0) {
      alert(
        "There are no records to export."
      );

      return;
    }

    const doc = new jsPDF();

    const yearLabel =
      selectedYear === "all"
        ? "All Years"
        : selectedYear;

    /*
      Header
    */

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(16);

    doc.setTextColor(
      11,
      42,
      74
    );

    doc.text(
      "Holy Family Academy Angeles City",
      105,
      18,
      {
        align: "center",
      }
    );

    doc.setFontSize(12);

    doc.text(
      "Grade School IMC",
      105,
      25,
      {
        align: "center",
      }
    );

    doc.setFontSize(15);

    doc.text(
      "Usage Data Report",
      105,
      35,
      {
        align: "center",
      }
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(10);

    doc.setTextColor(
      80,
      80,
      80
    );

    doc.text(
      `Year: ${yearLabel}`,
      20,
      46
    );

    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      20,
      52
    );

    /*
      Graph title
    */

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(12);

    doc.setTextColor(
      20,
      20,
      20
    );

    doc.text(
      "Monthly Usage by Purpose",
      20,
      64
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(9);

    doc.setTextColor(
      90,
      90,
      90
    );

    doc.text(
      "Number of visits for each purpose across the selected year.",
      20,
      70
    );

    /*
      Graph
    */

    let currentY =
      drawPurposeGraph(
        doc,
        78
      );

    /*
      Legend
    */

    let legendX = 20;

    let legendY =
      currentY + 2;

    doc.setFontSize(7);

    PURPOSE_CATEGORIES.forEach(
      (purpose, index) => {
        const hex =
          PURPOSE_COLORS[
            purpose
          ].replace(
            "#",
            ""
          );

        const r =
          parseInt(
            hex.substring(
              0,
              2
            ),
            16
          );

        const g =
          parseInt(
            hex.substring(
              2,
              4
            ),
            16
          );

        const b =
          parseInt(
            hex.substring(
              4,
              6
            ),
            16
          );

        doc.setFillColor(
          r,
          g,
          b
        );

        doc.rect(
          legendX,
          legendY - 3,
          4,
          4,
          "F"
        );

        doc.setTextColor(
          70,
          70,
          70
        );

        doc.text(
          purpose,
          legendX + 6,
          legendY
        );

        legendX +=
          25 +
          doc.getTextWidth(
            purpose
          );

        if (index === 3) {
          legendX = 20;

          legendY += 7;
        }
      }
    );

    /*
      Summary
    */

    const summaryStart =
      legendY + 12;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(12);

    doc.setTextColor(
      20,
      20,
      20
    );

    doc.text(
      "Summary",
      20,
      summaryStart
    );

    autoTable(doc, {
      startY:
        summaryStart + 5,

      theme: "grid",

      head: [
        [
          "Metric",
          "Result",
        ],
      ],

      body: [
        [
          "Total Visits",
          String(
            totalVisits
          ),
        ],

        [
          "Highest Purpose",
          `${highestPurpose.name} (${highestPurpose.count})`,
        ],

        [
          "Highest Usage Month",
          `${highestMonth.month} (${highestMonth.total})`,
        ],

        [
          "Highest Month-Purpose",
          `${highestMonthPurpose.purpose} in ${highestMonthPurpose.month} (${highestMonthPurpose.count})`,
        ],

        [
          "Average Visits per Month",
          String(
            averageMonthlyVisits
          ),
        ],
      ],

      styles: {
        fontSize: 9,
      },

      headStyles: {
        fillColor: [
          11,
          42,
          74,
        ],
      },
    });

    /*
      Conclusion
    */

    const summaryTableY =
      doc.lastAutoTable
        ? doc.lastAutoTable
            .finalY
        : summaryStart + 40;

    const conclusionY =
      summaryTableY + 12;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(12);

    doc.text(
      "Conclusion",
      20,
      conclusionY
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(12);

    const conclusionText =
      highestMonthPurpose.count >
      0
        ? `The usage records show that ${highestMonthPurpose.purpose} had the highest number of visits during ${highestMonthPurpose.month}, with ${highestMonthPurpose.count} recorded visits. This indicates that this service or purpose was the most frequently used during the month based on the registered IMC usage records.`
        : "There are no sufficient usage records to determine the highest monthly purpose.";

    const conclusionLines =
      doc.splitTextToSize(
        conclusionText,
        170
      );

    doc.text(
      conclusionLines,
      20,
      conclusionY + 8,
      {
        lineHeightFactor: 1.5,
      }
    );

    /*
      Purpose Breakdown
    */

    const purposeTableY =
      conclusionY +
      8 +
      conclusionLines.length *
        7 +
      10;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(12);

    doc.text(
      "Purpose Breakdown",
      20,
      purposeTableY
    );

    autoTable(doc, {
      startY:
        purposeTableY + 5,

      theme: "grid",

      head: [
        [
          "Rank",
          "Purpose",
          "Visits",
          "Percentage",
        ],
      ],

      body: purposeBreakdown.map(
        (item, index) => [
          index + 1,
          item.name,
          item.count,
          `${item.percentage}%`,
        ]
      ),

      styles: {
        fontSize: 9,
      },

      headStyles: {
        fillColor: [
          11,
          42,
          74,
        ],
      },
    });

    /*
      Footer
    */

    addFooter(doc);

    /*
      Save
    */

    doc.save(
      `IMC-Usage-Data-${yearLabel.replace(
        /\s/g,
        "-"
      )}.pdf`
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

          <p>
            Loading usage data...
          </p>

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

          <h2>
            Unable to Load Usage Data
          </h2>

          <p>
            {error}
          </p>

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

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="usage-data-page-header">

        <div>

          <h1>
            Usage Data
          </h1>

          <p>
            View monthly visits and identify
            the most frequently used IMC
            services and purposes.
          </p>

        </div>

        <button
          className="usage-data-refresh"
          onClick={fetchLogs}
        >
          ↻ Refresh
        </button>

      </div>

      {/* =================================================
          FILTER BAR
      ================================================= */}

      <div className="usage-data-filter-bar">

        <div className="usage-data-filter-group">

          <label htmlFor="usage-year">
            Year
          </label>

          <select
            id="usage-year"
            value={selectedYear}
            onChange={(e) =>
              setSelectedYear(
                e.target.value
              )
            }
          >

            <option value="all">
              All Years
            </option>

            {YEARS.map(
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

        </div>

        <div className="usage-data-filter-group usage-data-search-group">

          <label htmlFor="usage-search">
            Search
          </label>

          <input
            id="usage-search"
            type="text"
            placeholder="Search name or purpose..."
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(
                e.target.value
              )
            }
          />

        </div>

        <div className="usage-data-showing">

          Showing{" "}

          <strong>
            {filteredLogs.length}
          </strong>{" "}

          registered records

        </div>

      </div>

      {/* =================================================
          MONTHLY GRAPH
      ================================================= */}

      <div className="usage-data-panel">

        <div className="usage-data-panel-header">

          <div>

            <h2>
              Monthly Usage by Purpose
            </h2>

            <p>
              Compare the number of visits
              for each purpose across all
              months.
            </p>

          </div>

        </div>

        <div className="usage-data-chart">

          <Bar
            data={chartData}
            options={chartOptions}
          />

        </div>

      </div>

      {/* =================================================
          MONTHLY HIGHLIGHTS
      ================================================= */}

      <div className="usage-data-month-highlights">

        <div className="usage-data-highlight-header">

          <div>

            <h2>
              Monthly Highlights
            </h2>

            <p>
              The highest purpose for each
              month.
            </p>

          </div>

        </div>

        <div className="usage-data-month-grid">

          {monthlyPurposeData.map(
            (month) => {

              const highestForMonth =
                PURPOSE_CATEGORIES.reduce(
                  (
                    highest,
                    purpose
                  ) => {

                    if (
                      month[purpose] >
                      highest.count
                    ) {
                      return {
                        purpose,
                        count:
                          month[
                            purpose
                          ],
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
                  (item) =>
                    item.value ===
                    month.monthNumber
                )?.label ||
                month.month;

              return (
                <div
                  className="usage-data-month-card"
                  key={
                    month.monthNumber
                  }
                >

                  <div className="usage-data-month-name">
                    {fullMonth}
                  </div>

                  <div className="usage-data-month-purpose">

                    {highestForMonth.count >
                    0 ? (
                      <>

                        <span
                          className="usage-data-purpose-dot"
                          style={{
                            backgroundColor:
                              PURPOSE_COLORS[
                                highestForMonth
                                  .purpose
                              ],
                          }}
                        ></span>

                        <strong>
                          {
                            highestForMonth.purpose
                          }
                        </strong>

                      </>
                    ) : (
                      <span>
                        No visits
                      </span>
                    )}

                  </div>

                  <div className="usage-data-month-count">

                    {highestForMonth.count >
                    0
                      ? `${highestForMonth.count} visits`
                      : "—"}

                  </div>

                  <div className="usage-data-month-total">

                    Total:

                    <strong>
                      {" "}
                      {month.total}
                    </strong>

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="usage-data-summary-section">

        <div className="usage-data-summary-header">

          <div>

            <h2>
              Summary
            </h2>

            <p>
              Overview of registered IMC
              usage.
            </p>

          </div>

        </div>

        <div className="usage-data-summary">

          <div className="usage-data-summary-card">

            <span>
              Total Visits
            </span>

            <strong>
              {totalVisits}
            </strong>

          </div>

          <div className="usage-data-summary-card">

            <span>
              Most Used Purpose
            </span>

            <strong>
              {highestPurpose.name}
            </strong>

            <small>
              {highestPurpose.count} visits
            </small>

          </div>

          <div className="usage-data-summary-card">

            <span>
              Highest Usage Month
            </span>

            <strong>
              {highestMonth.month}
            </strong>

            <small>
              {highestMonth.total} total visits
            </small>

          </div>

          <div className="usage-data-summary-card">

            <span>
              Highest Month-Purpose
            </span>

            <strong>
              {highestMonthPurpose.purpose}
            </strong>

            <small>
              {highestMonthPurpose.count} visits in{" "}
              {highestMonthPurpose.month}
            </small>

          </div>

          <div className="usage-data-summary-card">

            <span>
              Average Monthly Visits
            </span>

            <strong>
              {averageMonthlyVisits}
            </strong>

          </div>

        </div>

      </div>

      {/* =================================================
          EXPORT
      ================================================= */}

      <div className="usage-data-export-section">

        <div>

          <h2>
            Export
          </h2>

          <p>
            Download the usage data and
            monthly analysis.
          </p>

        </div>

        <div className="usage-data-export-buttons">

          <button
            className="usage-data-export-button excel"
            onClick={exportExcel}
          >
            Export Excel
          </button>

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