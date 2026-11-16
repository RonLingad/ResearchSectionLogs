
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";

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
  "Online Research",
  "Epic Reading",
  "Reading",
  "Trivia Search",
  "Print",
  "Investigatory Project",
];

const PURPOSE_COLORS = {
  Aralinks: "#1565c0",
  "Online Research": "#16803c",
  "Epic Reading": "#7b1fa2",
  Reading: "#00838f",
  "Trivia Search": "#ef6c00",
  Print: "#d32f2f",
  "Investigatory Project": "#795548",
};

/* =========================================================
   SCHOOL YEARS
========================================================= */

const SCHOOL_YEAR_STARTS = [
  2026,
  2027,
  2028,
  2029,
  2030,
];

/* =========================================================
   MONTHS - JUNE TO MAY
========================================================= */

const MONTHS = [
  { value: 6, label: "June", short: "Jun" },
  { value: 7, label: "July", short: "Jul" },
  { value: 8, label: "August", short: "Aug" },
  { value: 9, label: "September", short: "Sep" },
  { value: 10, label: "October", short: "Oct" },
  { value: 11, label: "November", short: "Nov" },
  { value: 12, label: "December", short: "Dec" },
  { value: 1, label: "January", short: "Jan" },
  { value: 2, label: "February", short: "Feb" },
  { value: 3, label: "March", short: "Mar" },
  { value: 4, label: "April", short: "Apr" },
  { value: 5, label: "May", short: "May" },
];

/* =========================================================
   FETCH SETTINGS
========================================================= */

const PAGE_SIZE = 1000;

/* =========================================================
   DATE HELPERS
========================================================= */

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function getSchoolYearStart(date) {
  const month = date.getMonth() + 1;

  return month >= 6
    ? date.getFullYear()
    : date.getFullYear() - 1;
}

function getSchoolYearLabel(year) {
  return `SY ${year}-${year + 1}`;
}

/* =========================================================
   PURPOSE HELPERS
========================================================= */

function getPurposeList(purposes) {
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
}

function getMatchedPurpose(purpose) {
  const normalized = String(purpose || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "research" ||
    normalized === "online research"
  ) {
    return "Online Research";
  }

  if (
    normalized === "others" ||
    normalized === ""
  ) {
    return "Aralinks";
  }

  return (
    PURPOSE_CATEGORIES.find(
      (category) =>
        category.toLowerCase() === normalized
    ) || "Aralinks"
  );
}

/* =========================================================
   PURPOSE COUNTS
========================================================= */

function calculatePurposeCounts(logs) {
  const counts = Object.fromEntries(
    PURPOSE_CATEGORIES.map((purpose) => [
      purpose,
      0,
    ])
  );

  logs.forEach((log) => {
    const purposes = getPurposeList(log.purposes);

    if (purposes.length === 0) {
      counts.Aralinks += 1;
      return;
    }

    purposes.forEach((purpose) => {
      const matched = getMatchedPurpose(purpose);
      counts[matched] += 1;
    });
  });

  return counts;
}

/* =========================================================
   MONTHLY PURPOSE DATA
========================================================= */

function calculateMonthlyPurposeData(logs) {
  const monthlyData = MONTHS.map((month) => {
    const item = {
      month: month.label,
      short: month.short,
      monthNumber: month.value,
      total: 0,
    };

    PURPOSE_CATEGORIES.forEach((purpose) => {
      item[purpose] = 0;
    });

    return item;
  });

  logs.forEach((log) => {
    const date = parseDate(
      log.session_in || log.created_at
    );

    if (!date) return;

    const monthNumber = date.getMonth() + 1;

    const monthData = monthlyData.find(
      (month) =>
        month.monthNumber === monthNumber
    );

    if (!monthData) return;

    const purposes = getPurposeList(log.purposes);

    if (purposes.length === 0) {
      monthData.Aralinks += 1;
      monthData.total += 1;
      return;
    }

    purposes.forEach((purpose) => {
      const matchedPurpose =
        getMatchedPurpose(purpose);

      monthData[matchedPurpose] += 1;
      monthData.total += 1;
    });
  });

  return monthlyData;
}

/* =========================================================
   PDF COLOR HELPER
========================================================= */

function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");

  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function UsageData() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [selectedYear, setSelectedYear] = useState(2026);
  const [searchTerm, setSearchTerm] = useState("");

  /* =======================================================
     FETCH ALL LOGS - PAGINATION
  ======================================================= */

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      let allLogs = [];
      let from = 0;

      while (true) {
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("logs")
          .select(
            "id, fullname, purposes, session_in, session_out, created_at"
          )
          .order("session_in", {
            ascending: false,
            nullsFirst: false,
          })
          .order("id", {
            ascending: true,
          })
          .range(from, to);

        if (error) {
          throw error;
        }

        const currentPage = data || [];

        allLogs = allLogs.concat(currentPage);

        console.log(
          `Fetched ${currentPage.length} records. Total: ${allLogs.length}`
        );

        if (currentPage.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      setLogs(allLogs);

      console.log(
        "TOTAL LOGS SUCCESSFULLY FETCHED:",
        allLogs.length
      );

    } catch (err) {
      console.error(
        "Error fetching usage data:",
        err
      );

      setLogs([]);
      setError(
        err.message ||
          "Unable to load usage records."
      );

    } finally {
      setLoading(false);
    }
  }, []);

  /* =======================================================
     INITIAL FETCH + REALTIME UPDATES
  ======================================================= */

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel("usage-data-live-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "logs",
        },
        (payload) => {
          console.log(
            "Supabase log update detected:",
            payload.eventType
          );

          fetchLogs();
        }
      )
      .subscribe((status) => {
        console.log(
          "Usage Data Realtime Status:",
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  /* =======================================================
     FILTER BY SCHOOL YEAR AND SEARCH
  ======================================================= */

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const date = parseDate(
        log.session_in || log.created_at
      );

      if (!date) return false;

      const schoolYear = getSchoolYearStart(date);

      const yearMatches =
        selectedYear === "all" ||
        schoolYear === Number(selectedYear);

      const search = searchTerm
        .trim()
        .toLowerCase();

      const purposes = getPurposeList(log.purposes)
        .join(" ")
        .toLowerCase();

      const searchMatches =
        !search ||
        String(log.fullname || "")
          .toLowerCase()
          .includes(search) ||
        purposes.includes(search);

      return yearMatches && searchMatches;
    });
  }, [logs, selectedYear, searchTerm]);

  /* =======================================================
     MONTHLY DATA
  ======================================================= */

  const monthlyPurposeData = useMemo(
    () => calculateMonthlyPurposeData(filteredLogs),
    [filteredLogs]
  );

  /* =======================================================
     PURPOSE COUNTS
  ======================================================= */

  const purposeCounts = useMemo(
    () => calculatePurposeCounts(filteredLogs),
    [filteredLogs]
  );

  const purposeBreakdown = useMemo(() => {
    const total = Object.values(
      purposeCounts
    ).reduce((sum, value) => sum + value, 0);

    return PURPOSE_CATEGORIES.map(
      (purpose, index) => ({
        name: purpose,
        count: purposeCounts[purpose],

        percentage:
          total > 0
            ? Number(
                (
                  (purposeCounts[purpose] / total) *
                  100
                ).toFixed(1)
              )
            : 0,

        order: index,
      })
    ).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.order - b.order;
    });
  }, [purposeCounts]);

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
     MONTHLY TOTALS
  ======================================================= */

  const monthlyTotals = useMemo(() => {
    return monthlyPurposeData.map((month) => ({
      ...month,

      total: PURPOSE_CATEGORIES.reduce(
        (sum, purpose) =>
          sum + month[purpose],
        0
      ),
    }));
  }, [monthlyPurposeData]);

  /* =======================================================
     HIGHEST PURPOSE
  ======================================================= */

  const highestPurpose = useMemo(() => {
    if (totalVisits === 0) {
      return {
        name: "—",
        count: 0,
      };
    }

    return purposeBreakdown[0];
  }, [purposeBreakdown, totalVisits]);

  /* =======================================================
     HIGHEST MONTH
  ======================================================= */

  const highestMonth = useMemo(() => {
    const monthsWithData = monthlyTotals.filter(
      (month) => month.total > 0
    );

    if (monthsWithData.length === 0) {
      return {
        month: "—",
        total: 0,
      };
    }

    return [...monthsWithData].sort(
      (a, b) => b.total - a.total
    )[0];
  }, [monthlyTotals]);

  /* =======================================================
     HIGHEST MONTH AND PURPOSE
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
     AVERAGE MONTHLY VISITS
  ======================================================= */

  const averageMonthlyVisits = useMemo(() => {
    if (!monthlyTotals.length) return 0;

    return Number(
      (
        monthlyTotals.reduce(
          (sum, month) => sum + month.total,
          0
        ) / 12
      ).toFixed(1)
    );
  }, [monthlyTotals]);

  /* =======================================================
     CONCLUSION
  ======================================================= */

  const conclusion = useMemo(() => {
    const schoolYearLabel =
      selectedYear === "all"
        ? "all available school years"
        : getSchoolYearLabel(
            Number(selectedYear)
          );

    if (totalVisits === 0) {
      return `No registered usage records were recorded for ${schoolYearLabel}.`;
    }

    return (
      `For ${schoolYearLabel}, the highest recorded usage occurred in ` +
      `${highestMonthPurpose.month} under ${highestMonthPurpose.purpose}, ` +
      `with ${highestMonthPurpose.count} recorded visits. ` +
      `The most frequently used purpose was ${highestPurpose.name}, ` +
      `with ${highestPurpose.count} visits. A total of ${totalVisits} ` +
      `purpose visits was recorded during the selected period, ` +
      `with an average of ${averageMonthlyVisits} visits per month.`
    );
  }, [
    selectedYear,
    totalVisits,
    highestMonthPurpose,
    highestPurpose,
    averageMonthlyVisits,
  ]);

  /* =======================================================
     CHART DATA
  ======================================================= */

  const chartData = useMemo(
    () => ({
      labels: monthlyPurposeData.map(
        (month) => month.short
      ),

      datasets: PURPOSE_CATEGORIES.map(
        (purpose) => ({
          label: purpose,

          data: monthlyPurposeData.map(
            (month) => month[purpose]
          ),

          backgroundColor:
            PURPOSE_COLORS[purpose],

          borderWidth: 0,
          borderSkipped: false,
          borderRadius: 0,
          maxBarThickness: 44,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
          stack: "visits",
        })
      ),
    }),
    [monthlyPurposeData]
  );

  /* =======================================================
     CHART OPTIONS
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
          display: (context) =>
            Number(
              context.dataset.data[
                context.dataIndex
              ]
            ) > 0,

          color: "#ffffff",
          anchor: "center",
          align: "center",
          clamp: true,
          clip: true,

          font: {
            size: 10,
            weight: "bold",
          },

          formatter: (value) =>
            Number(value) > 0 ? value : "",
        },
      },

      scales: {
        x: {
          stacked: true,

          title: {
            display: true,
            text: "Month",

            font: {
              size: 12,
            },
          },

          ticks: {
            font: {
              size: 12,
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

            font: {
              size: 12,
            },
          },

          title: {
            display: true,
            text: "Number of Visits",

            font: {
              size: 12,
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
     PDF GRAPH - INCREASED HEIGHT
  ======================================================= */

  function drawPDFGraph(pdf, startY) {
    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const margin = 14;

    const chartLeft = margin + 15;
    const chartRight = pageWidth - margin - 4;

    const chartWidth = chartRight - chartLeft;

    // Increased from 88 mm to 105 mm
    const chartHeight = 105;

    const chartTop = startY;
    const chartBottom = chartTop + chartHeight;

    const maxValue = Math.max(
      ...monthlyTotals.map(
        (month) => month.total
      ),
      1
    );

    const tickStep = Math.max(
      1,
      Math.ceil(maxValue / 5)
    );

    const roundedMax = tickStep * 5;

    /* Y-AXIS AND GRID */

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(70, 70, 70);

    for (let i = 0; i <= 5; i++) {
      const value = tickStep * i;

      const gridY =
        chartBottom -
        (chartHeight / 5) * i;

      pdf.setDrawColor(220, 225, 230);
      pdf.setLineWidth(0.25);

      pdf.line(
        chartLeft,
        gridY,
        chartRight,
        gridY
      );

      pdf.text(
        String(value),
        chartLeft - 3,
        gridY + 1.5,
        { align: "right" }
      );
    }

    /* AXES */

    pdf.setDrawColor(70, 70, 70);
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

    const slotWidth =
      chartWidth / monthlyTotals.length;

    const barWidth = Math.min(
      11,
      slotWidth * 0.72
    );

    monthlyTotals.forEach((month, index) => {
      const centerX =
        chartLeft +
        slotWidth * index +
        slotWidth / 2;

      let currentY = chartBottom;

      PURPOSE_CATEGORIES.forEach((purpose) => {
        const value = month[purpose];

        if (value <= 0) return;

        const segmentHeight =
          (value / roundedMax) * chartHeight;

        const segmentY =
          currentY - segmentHeight;

        const { r, g, b } = hexToRgb(
          PURPOSE_COLORS[purpose]
        );

        pdf.setFillColor(r, g, b);

        pdf.rect(
          centerX - barWidth / 2,
          segmentY,
          barWidth,
          segmentHeight,
          "F"
        );

        if (segmentHeight >= 7) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(255, 255, 255);

          pdf.text(
            String(value),
            centerX,
            segmentY + segmentHeight / 2 + 1.2,
            { align: "center" }
          );
        }

        currentY = segmentY;
      });

      /* MONTHLY TOTAL ABOVE BAR */

      if (month.total > 0) {
        const totalY =
          chartBottom -
          (month.total / roundedMax) *
            chartHeight;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);

        pdf.text(
          String(month.total),
          centerX,
          Math.max(chartTop - 2, totalY - 2),
          { align: "center" }
        );
      }

      /* MONTH LABEL */

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      pdf.text(
        month.short,
        centerX,
        chartBottom + 6,
        { align: "center" }
      );
    });

    return chartBottom + 11;
  }

  /* =======================================================
     PDF GRAPH LEGEND - SMALLER AND ALIGNED
  ======================================================= */

  function drawPDFLegend(pdf, startY) {
    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const margin = 14;
    const availableWidth =
      pageWidth - margin * 2;

    // Smaller legend typography and color squares
    const fontSize = 9;
    const squareSize = 3;
    const squareTextGap = 2.2;
    const itemGap = 5;
    const rowHeight = 6.5;

    const textY = startY;

    let x = margin;
    let y = textY;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);

    PURPOSE_CATEGORIES.forEach((purpose) => {
      const labelWidth =
        pdf.getTextWidth(purpose);

      const itemWidth =
        squareSize +
        squareTextGap +
        labelWidth +
        itemGap;

      // Move to the next row if there is not enough space
      if (
        x + itemWidth - itemGap >
        margin + availableWidth
      ) {
        x = margin;
        y += rowHeight;
      }

      const { r, g, b } = hexToRgb(
        PURPOSE_COLORS[purpose]
      );

      // Draw smaller color square
      pdf.setFillColor(r, g, b);

      pdf.rect(
        x,
        y - 2.5,
        squareSize,
        squareSize,
        "F"
      );

      // Align label vertically with color square
      pdf.setTextColor(40, 40, 40);

      pdf.text(
        purpose,
        x + squareSize + squareTextGap,
        y
      );

      x += itemWidth;
    });

    // Return the correct position after all legend rows
    const totalRows =
      Math.floor((y - textY) / rowHeight) + 1;

    return textY + totalRows * rowHeight + 1;
  }

  /* =======================================================
     PDF EXPORT
  ======================================================= */

  function exportPDF() {
    if (totalVisits === 0) {
      alert(
        "No usage data available to export."
      );
      return;
    }

    try {
      setExporting(true);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margin = 14;
      const contentWidth =
        pageWidth - margin * 2;

      const yearTitle =
        selectedYear === "all"
          ? "FOR ALL SCHOOL YEARS"
          : `FOR THE SCHOOL YEAR ${selectedYear}-${Number(selectedYear) + 1}`;

      /* HEADER */

      pdf.setTextColor(0, 0, 0);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);

      pdf.text(
        "Holy Family Academy",
        pageWidth / 2,
        13,
        { align: "center" }
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);

      pdf.text(
        "Angeles City",
        pageWidth / 2,
        19,
        { align: "center" }
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);

      pdf.text(
        "STATISTICAL REPRESENTATION ON THE ACTIVITY ON INTERNET",
        pageWidth / 2,
        27,
        { align: "center" }
      );

      pdf.text(
        "AND RESEARCH SECTION",
        pageWidth / 2,
        33,
        { align: "center" }
      );

      pdf.setFontSize(12);

      pdf.text(
        yearTitle,
        pageWidth / 2,
        40,
        { align: "center" }
      );

      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.4);

      pdf.line(
        margin,
        45,
        pageWidth - margin,
        45
      );

      /* GRAPH TITLE */

      let y = 54;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);

      pdf.text(
        selectedYear === "all"
          ? "Monthly Usage - All School Years"
          : `Monthly Usage - SY ${selectedYear}-${Number(selectedYear) + 1}`,
        margin,
        y
      );

      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(75, 75, 75);

      const graphDescription =
        "Monthly visits by purpose, arranged from June to May. Values above the bars indicate monthly totals.";

      const descriptionLines =
        pdf.splitTextToSize(
          graphDescription,
          contentWidth
        );

      descriptionLines.forEach((line) => {
        pdf.text(line, margin, y);
        y += 5;
      });

      y += 5;

      /* ENLARGED GRAPH */

      y = drawPDFGraph(pdf, y);

      /* LEGEND */

      y += 3;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      pdf.text(
        "Purpose Categories",
        margin,
        y
      );

      y += 6;

      y = drawPDFLegend(pdf, y);

      /* CONCLUSION */

      y += 3;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      pdf.text(
        "Conclusion",
        margin,
        y
      );

      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);

      const conclusionLines =
        pdf.splitTextToSize(
          conclusion,
          contentWidth
        );

      const lineHeight = 4.5;

      conclusionLines.forEach((line) => {
        pdf.text(line, margin, y);
        y += lineHeight;
      });

      /* SIGNATURES */

      const signatureY = pageHeight - 28;

      if (y > signatureY - 15) {
        console.warn(
          "Conclusion is too long for the preferred one-page layout."
        );
      }

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

        const centerX =
          x + signatureWidth / 2;

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.35);

        pdf.line(
          x,
          signatureY + 4,
          x + signatureWidth,
          signatureY + 4
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
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

      /* FOOTER */

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90, 90, 90);

      pdf.text(
        "Grade School IMC - Usage Data Report",
        pageWidth / 2,
        pageHeight - 7,
        { align: "center" }
      );

      /* SAVE */

      const filename =
        selectedYear === "all"
          ? "IMC_Usage_Data_All_School_Years.pdf"
          : `IMC_Usage_Data_SY_${selectedYear}-${Number(selectedYear) + 1}.pdf`;

      pdf.save(filename);

    } catch (err) {
      console.error(
        "PDF export error:",
        err
      );

      alert(
        "Unable to export the PDF report."
      );

    } finally {
      setExporting(false);
    }
  }

  /* =======================================================
     LOADING STATE
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
     ERROR STATE
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
            View monthly visits by school year, from June
            through May, and identify the most frequently
            used IMC services and purposes.
          </p>
        </div>

        <button
          className="usage-data-refresh"
          onClick={fetchLogs}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {/* FILTER BAR */}

      <div className="usage-data-filter-bar">

        <div className="usage-data-filter-group">
          <label htmlFor="usage-year">
            School Year
          </label>

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
            <option value="all">
              All School Years
            </option>

            {SCHOOL_YEAR_STARTS.map((year) => (
              <option key={year} value={year}>
                {getSchoolYearLabel(year)}
              </option>
            ))}
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
              setSearchTerm(e.target.value)
            }
          />
        </div>

        <div className="usage-data-showing">
          Showing{" "}
          <strong>{filteredLogs.length}</strong>{" "}
          registered records
        </div>

      </div>

      {/* MONTHLY GRAPH */}

      <div className="usage-data-panel">

        <div className="usage-data-panel-header">
          <div>
            <h2>Monthly Usage by Purpose</h2>

            <p>
              School-year view runs from June through May.
              Each color represents a different purpose.
            </p>
          </div>
        </div>

        <div className="usage-data-chart">
          {totalVisits === 0 ? (
            <div className="usage-data-empty">
              No usage records found for the selected
              school year.
            </div>
          ) : (
            <Bar
              data={chartData}
              options={chartOptions}
            />
          )}
        </div>

      </div>

      {/* MONTHLY HIGHLIGHTS */}

      <div className="usage-data-month-highlights">

        <div className="usage-data-highlight-header">
          <div>
            <h2>Monthly Highlights</h2>

            <p>
              The highest recorded purpose for each month.
            </p>
          </div>
        </div>

        <div className="usage-data-month-grid">

          {monthlyTotals.map((month) => {
            const highestForMonth =
              PURPOSE_CATEGORIES.reduce(
                (highest, purpose) => {
                  if (
                    month[purpose] > highest.count
                  ) {
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

            return (
              <div
                className="usage-data-month-card"
                key={month.monthNumber}
              >

                <div className="usage-data-month-name">
                  {month.month}
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
                      />

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
                  Total:{" "}
                  <strong>{month.total}</strong>
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

            <p>
              Overview of registered IMC usage.
            </p>
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
            <small>
              {highestPurpose.count} visits
            </small>
          </div>

          <div className="usage-data-summary-card">
            <span>Highest Usage Month</span>
            <strong>{highestMonth.month}</strong>
            <small>
              {highestMonth.total} total visits
            </small>
          </div>

          <div className="usage-data-summary-card">
            <span>Highest Month-Purpose</span>
            <strong>
              {highestMonthPurpose.purpose}
            </strong>
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
              Recorded purpose visits for the selected
              school year.
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
                    />

                    {" "}

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

      {/* EXPORT */}

      <div className="usage-data-export-section">

        <div>
          <h2>Export Report</h2>

          <p>
            Generate a one-page PDF report with the enlarged
            monthly graph, conclusion, and signatures.
          </p>
        </div>

        <div className="usage-data-export-buttons">

          <button
            className="usage-data-export-button pdf"
            onClick={exportPDF}
            disabled={exporting || totalVisits === 0}
          >
            {exporting
              ? "Exporting..."
              : "Export PDF"}
          </button>

        </div>

      </div>

    </div>
  );
}
