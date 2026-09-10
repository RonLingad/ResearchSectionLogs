import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

/* =========================================================
   CHART.JS

   IMPORTANT:
   The custom value-label plugin is NOT globally registered.
   It is passed directly to the Bar component.

   This prevents the graph numbers from being drawn twice.
   ========================================================= */

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

/* =========================================================
   PURPOSE COLORS
   ========================================================= */

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

const YEARS = [
  2026,
  2027,
  2028,
  2029,
  2030,
];

/* =========================================================
   MONTHS
   ========================================================= */

const MONTHS = [
  {
    value: 1,
    label: "January",
  },
  {
    value: 2,
    label: "February",
  },
  {
    value: 3,
    label: "March",
  },
  {
    value: 4,
    label: "April",
  },
  {
    value: 5,
    label: "May",
  },
  {
    value: 6,
    label: "June",
  },
  {
    value: 7,
    label: "July",
  },
  {
    value: 8,
    label: "August",
  },
  {
    value: 9,
    label: "September",
  },
  {
    value: 10,
    label: "October",
  },
  {
    value: 11,
    label: "November",
  },
  {
    value: 12,
    label: "December",
  },
];

/* =========================================================
   PAGINATION
   ========================================================= */

const ITEMS_PER_PAGE = 15;

/* =========================================================
   WEB CHART VALUE LABEL PLUGIN
   =========================================================

   This plugin is ONLY supplied to the <Bar /> component.

   It is NOT passed to ChartJS.register().

   Therefore it can only execute once for this chart.
   ========================================================= */

const barValuePlugin = {
  id: "usageBarValueLabels",

  afterDatasetsDraw(chart) {
    const { ctx } = chart;

    const dataset =
      chart.data.datasets[0];

    if (!dataset) {
      return;
    }

    const meta =
      chart.getDatasetMeta(0);

    meta.data.forEach(
      (bar, index) => {
        const value =
          dataset.data[index];

        if (
          value === null ||
          value === undefined ||
          Number(value) === 0
        ) {
          return;
        }

        ctx.save();

        /* 11px readable black font */

        ctx.fillStyle =
          "#000000";

        ctx.font =
          "bold 11px Arial";

        ctx.textAlign =
          "left";

        ctx.textBaseline =
          "middle";

        /*
          Draw only ONE value for
          every bar.
        */

        ctx.fillText(
          String(value),
          bar.x + 7,
          bar.y
        );

        ctx.restore();
      }
    );
  },
};

/* =========================================================
   DATE PARSER
   ========================================================= */

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
};

/* =========================================================
   MONTH NAME
   ========================================================= */

const getMonthName = (
  monthNumber
) => {
  const month =
    MONTHS.find(
      (item) =>
        item.value ===
        Number(monthNumber)
    );

  return month
    ? month.label
    : "";
};

/* =========================================================
   PURPOSE LIST
   ========================================================= */

const getPurposeList = (
  purposes
) => {
  if (!purposes) {
    return [];
  }

  if (
    Array.isArray(purposes)
  ) {
    return purposes
      .map((item) =>
        String(item).trim()
      )
      .filter(Boolean);
  }

  if (
    typeof purposes ===
    "string"
  ) {
    return purposes
      .split(",")
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);
  }

  return [];
};

/* =========================================================
   MATCH PURPOSE
   ========================================================= */

const getMatchedPurpose = (
  purpose
) => {
  const cleanPurpose =
    String(
      purpose || ""
    ).trim();

  const matched =
    PURPOSE_CATEGORIES.find(
      (category) =>
        category.toLowerCase() ===
        cleanPurpose.toLowerCase()
    );

  return matched || "Others";
};

/* =========================================================
   DATE / TIME FORMAT
   ========================================================= */

const formatDateTime = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    parseDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );
};

/* =========================================================
   PDF DATE / TIME FORMAT
   ========================================================= */

const formatDateTimeForPDF = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    parseDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );
};

/* =========================================================
   ANALYTICS
   ========================================================= */

const calculateAnalytics = (
  logs
) => {
  const counts = {};

  PURPOSE_CATEGORIES.forEach(
    (category) => {
      counts[category] = 0;
    }
  );

  logs.forEach((log) => {
    const purposes =
      getPurposeList(
        log.purposes
      );

    purposes.forEach(
      (purpose) => {
        const matchedPurpose =
          getMatchedPurpose(
            purpose
          );

        counts[
          matchedPurpose
        ] += 1;
      }
    );
  });

  const total =
    Object.values(
      counts
    ).reduce(
      (sum, value) =>
        sum + value,
      0
    );

  const breakdown =
    PURPOSE_CATEGORIES.map(
      (name, index) => {
        const count =
          counts[name];

        return {
          name,
          count,

          percentage:
            total > 0
              ? Number(
                  (
                    (count /
                      total) *
                    100
                  ).toFixed(1)
                )
              : 0,

          order: index,
        };
      }
    ).sort((a, b) => {
      if (
        b.count !==
        a.count
      ) {
        return (
          b.count -
          a.count
        );
      }

      return (
        a.order -
        b.order
      );
    });

  return {
    total,

    sessions:
      logs.length,

    breakdown,
  };
};

/* =========================================================
   COMPONENT
   ========================================================= */

export default function Purpose() {
  const [logs, setLogs] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [exporting, setExporting] =
    useState(false);

  const [
    excelExporting,
    setExcelExporting,
  ] = useState(false);

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState("all");

  const [
    selectedYear,
    setSelectedYear,
  ] = useState("all");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  /*
    This is used only for the
    web Chart.js chart.

    The PDF does NOT use this
    canvas anymore.
  */

  const chartRef =
    useRef(null);

  /* =======================================================
     FETCH DATA
     ======================================================= */

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const {
        data,
        error,
      } = await supabase
        .from("logs")
        .select(
          "fullname, purposes, session_in, session_out"
        )
        .order(
          "session_in",
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          "Error fetching usage logs:",
          error
        );

        setLogs([]);

        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error(
        "Unexpected error:",
        error
      );

      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  /* =======================================================
     FILTERED LOGS
     ======================================================= */

  const filteredLogs =
    useMemo(() => {
      return logs.filter(
        (log) => {
          const date =
            parseDate(
              log.session_in
            );

          if (!date) {
            return false;
          }

          const month =
            date.getMonth() + 1;

          const year =
            date.getFullYear();

          const monthMatches =
            selectedMonth ===
              "all" ||
            month ===
              Number(
                selectedMonth
              );

          const yearMatches =
            selectedYear ===
              "all" ||
            year ===
              Number(
                selectedYear
              );

          return (
            monthMatches &&
            yearMatches
          );
        }
      );
    }, [
      logs,
      selectedMonth,
      selectedYear,
    ]);

  /* =======================================================
     ANALYTICS
     ======================================================= */

  const analytics =
    useMemo(() => {
      return calculateAnalytics(
        filteredLogs
      );
    }, [filteredLogs]);

  const breakdown =
    analytics.breakdown;

  const usedBreakdown =
    breakdown.filter(
      (item) =>
        item.count > 0
    );

  const highestPurpose =
    usedBreakdown.length >
    0
      ? usedBreakdown[0]
      : null;

  const lowestPurpose =
    usedBreakdown.length >
    0
      ? usedBreakdown[
          usedBreakdown.length -
            1
        ]
      : null;

  /* =======================================================
     PERIOD LABEL
     ======================================================= */

  const periodLabel =
    useMemo(() => {
      if (
        selectedMonth ===
          "all" &&
        selectedYear ===
          "all"
      ) {
        return "All Months and Years";
      }

      if (
        selectedMonth !==
          "all" &&
        selectedYear !==
          "all"
      ) {
        return `${getMonthName(
          selectedMonth
        )} ${selectedYear}`;
      }

      if (
        selectedMonth !==
        "all"
      ) {
        return getMonthName(
          selectedMonth
        );
      }

      return String(
        selectedYear
      );
    }, [
      selectedMonth,
      selectedYear,
    ]);

  /* =======================================================
     CONCLUSION
     ======================================================= */

  const summaryText =
    useMemo(() => {
      if (
        usedBreakdown.length ===
        0
      ) {
        return `The data shows no recorded internet or computer usage for ${periodLabel}.`;
      }

      const rankedPurposes =
        usedBreakdown.map(
          (item) =>
            `${item.name} recorded ${item.count} ${
              item.count === 1
                ? "visit"
                : "visits"
            } (${item.percentage}%)`
        );

      const rankingText =
        rankedPurposes.join(
          ", followed by "
        );

      const mostUsedText =
        `The data shows that ${highestPurpose.name} was the most visited purpose during ${periodLabel}, with ${highestPurpose.count} ${
          highestPurpose.count ===
          1
            ? "visit"
            : "visits"
        }, representing ${highestPurpose.percentage}% of the recorded purpose selections`;

      const endingText =
        lowestPurpose
          ? `while ${lowestPurpose.name} had the lowest recorded usage with ${lowestPurpose.count} ${
              lowestPurpose.count ===
              1
                ? "visit"
                : "visits"
            } (${lowestPurpose.percentage}%)`
          : "";

      return `${mostUsedText}. Overall, the purposes were ranked from most to least visited as follows: ${rankingText}. ${endingText}. This indicates the primary pattern of computer and internet usage among the registered users for ${periodLabel}.`;
    }, [
      usedBreakdown,
      highestPurpose,
      lowestPurpose,
      periodLabel,
    ]);

  /* =======================================================
     PAGINATION
     ======================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredLogs.length /
          ITEMS_PER_PAGE
      )
    );

  const paginatedLogs =
    useMemo(() => {
      const start =
        (currentPage -
          1) *
        ITEMS_PER_PAGE;

      return filteredLogs.slice(
        start,
        start +
          ITEMS_PER_PAGE
      );
    }, [
      filteredLogs,
      currentPage,
    ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedMonth,
    selectedYear,
  ]);

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  /* =======================================================
     CHART DATA
     ======================================================= */

  const chartData =
    useMemo(() => {
      return {
        labels:
          breakdown.map(
            (item) =>
              item.name
          ),

        datasets: [
          {
            label: "Visits",

            data:
              breakdown.map(
                (item) =>
                  item.count
              ),

            backgroundColor:
              breakdown.map(
                (item) =>
                  PURPOSE_COLORS[
                    item.name
                  ]
              ),

            borderColor:
              breakdown.map(
                (item) =>
                  PURPOSE_COLORS[
                    item.name
                  ]
              ),

            borderWidth: 1,

            borderRadius: 4,

            barThickness: 30,

            maxBarThickness: 34,
          },
        ],
      };
    }, [breakdown]);

  /* =======================================================
     CHART OPTIONS
     ======================================================= */

  const chartOptions =
    useMemo(() => {
      return {
        indexAxis: "y",

        responsive: true,

        maintainAspectRatio:
          false,

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
              label:
                (context) =>
                  ` ${context.raw} visits`,
            },
          },
        },

        scales: {
          x: {
            beginAtZero: true,

            grace: "12%",

            ticks: {
              precision: 0,

              color:
                "#000000",

              font: {
                size: 11,
                weight:
                  "600",
              },
            },

            grid: {
              color:
                "#e5e7eb",
            },
          },

          y: {
            ticks: {
              color:
                "#000000",

              font: {
                size: 11,
                weight:
                  "600",
              },

              padding: 8,
            },

            grid: {
              display: false,
            },
          },
        },
      };
    }, []);

  /* =======================================================
     EXCEL EXPORT
     ======================================================= */

  const exportExcel =
    () => {
      try {
        setExcelExporting(
          true
        );

        const rows =
          filteredLogs.map(
            (
              log,
              index
            ) => {
              const purposes =
                getPurposeList(
                  log.purposes
                );

              return {
                No:
                  index + 1,

                Name: (
                  log.fullname ||
                  "—"
                ).toUpperCase(),

                Purpose:
                  purposes.length >
                  0
                    ? purposes.join(
                        ", "
                      )
                    : "Others",

                "Session In":
                  formatDateTime(
                    log.session_in
                  ),

                "Session Out":
                  formatDateTime(
                    log.session_out
                  ),
              };
            }
          );

        const worksheet =
          XLSX.utils.json_to_sheet(
            rows
          );

        worksheet[
          "!cols"
        ] = [
          {
            wch: 7,
          },
          {
            wch: 30,
          },
          {
            wch: 32,
          },
          {
            wch: 25,
          },
          {
            wch: 25,
          },
        ];

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Usage Records"
        );

        XLSX.writeFile(
          workbook,
          `Internet_Usage_${periodLabel.replace(
            /\s+/g,
            "_"
          )}.xlsx`
        );
      } catch (error) {
        console.error(
          "Excel export error:",
          error
        );
      } finally {
        setExcelExporting(
          false
        );
      }
    };

  /* =======================================================
     PDF EXPORT
     =======================================================

     IMPORTANT:

     The PDF graph is now created manually
     using jsPDF.

     It does NOT use:

       chartRef.current.canvas

     This completely eliminates the
     duplicated-number / stretched-canvas
     problem in the PDF.
     ======================================================= */

  const exportPDF =
    async () => {
      try {
        setExporting(true);

        /*
          Letter = Short Bond Paper

          8.5 x 11 inches

          jsPDF uses millimeters:
          215.9mm x 279.4mm
        */

        const pdf =
          new jsPDF({
            orientation:
              "portrait",

            unit: "mm",

            format: "letter",
          });

        const pageWidth =
          pdf.internal.pageSize.getWidth();

        const pageHeight =
          pdf.internal.pageSize.getHeight();

        const margin = 14;

        const contentWidth =
          pageWidth -
          margin * 2;

        /* =================================================
           FOOTER
           ================================================= */

        const addFooter = (
          pageNumber
        ) => {
          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.setFontSize(8);

          pdf.setTextColor(
            0,
            0,
            0
          );

          pdf.text(
            `Page ${pageNumber}`,
            pageWidth / 2,
            pageHeight - 7,
            {
              align:
                "center",
            }
          );
        };

        /* =================================================
           PAGE 1
           ================================================= */

        /*
          Compact blue header.
        */

        const headerHeight =
          34;

        pdf.setFillColor(
          11,
          42,
          74
        );

        pdf.rect(
          0,
          0,
          pageWidth,
          headerHeight,
          "F"
        );

        /*
          LEFT ALIGNED HEADER
        */

        pdf.setTextColor(
          255,
          255,
          255
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          13
        );

        pdf.text(
          "Holy Family Academy Angeles City",
          margin,
          9
        );

        pdf.setFontSize(
          10
        );

        pdf.text(
          "Grade School IMC",
          margin,
          17
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(
          9
        );

        pdf.text(
          "Internet Usage Report",
          margin,
          24
        );

        pdf.setFontSize(
          8
        );

        pdf.text(
          periodLabel,
          margin,
          30
        );

        /*
          Return text to black.
        */

        pdf.setTextColor(
          0,
          0,
          0
        );

        let currentY =
          headerHeight + 7;

        /* =================================================
           GRAPH TITLE
           ================================================= */

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          11
        );

        pdf.setTextColor(
          0,
          0,
          0
        );

        pdf.text(
          "Purpose Breakdown",
          margin,
          currentY
        );

        currentY += 5;

        /* =================================================
           MANUAL PDF GRAPH
           ================================================= */

        /*
          Graph dimensions designed
          specifically for Letter paper.

          No canvas.
          No image.
          No scaling distortion.
        */

        const graphWidth =
          contentWidth;

        const graphHeight =
          76;

        const graphX =
          margin;

        const graphY =
          currentY;

        /*
          Calculate maximum value
          for proportional bars.
        */

        const maxValue =
          Math.max(
            ...breakdown.map(
              (item) =>
                item.count
            ),
            1
          );

        /*
          Left space for purpose names.
        */

        const labelWidth =
          43;

        /*
          Space reserved for the
          number at the right.
        */

        const valueWidth =
          20;

        const barAreaWidth =
          graphWidth -
          labelWidth -
          valueWidth;

        /*
          Seven categories.

          Use consistent vertical
          spacing so words and numbers
          are never stretched.
        */

        const rowHeight =
          graphHeight /
          PURPOSE_CATEGORIES.length;

        breakdown.forEach(
          (
            item,
            index
          ) => {
            const centerY =
              graphY +
              rowHeight *
                index +
              rowHeight /
                2;

            /*
              PURPOSE NAME
            */

            pdf.setFont(
              "helvetica",
              "normal"
            );

            pdf.setFontSize(
              11
            );

            pdf.setTextColor(
              0,
              0,
              0
            );

            pdf.text(
              item.name,
              graphX,
              centerY + 1.5
            );

            /*
              BAR
            */

            const barX =
              graphX +
              labelWidth;

            const barHeight =
              6;

            const barY =
              centerY -
              barHeight / 2;

            const barWidth =
              maxValue > 0
                ? (item.count /
                    maxValue) *
                  barAreaWidth
                : 0;

            /*
              Light background track
            */

            pdf.setFillColor(
              238,
              242,
              246
            );

            pdf.roundedRect(
              barX,
              barY,
              barAreaWidth,
              barHeight,
              1.5,
              1.5,
              "F"
            );

            /*
              Actual colored bar
            */

            const hex =
              PURPOSE_COLORS[
                item.name
              ];

            const red =
              parseInt(
                hex.substring(
                  1,
                  3
                ),
                16
              );

            const green =
              parseInt(
                hex.substring(
                  3,
                  5
                ),
                16
              );

            const blue =
              parseInt(
                hex.substring(
                  5,
                  7
                ),
                16
              );

            pdf.setFillColor(
              red,
              green,
              blue
            );

            if (
              barWidth >
              0.5
            ) {
              pdf.roundedRect(
                barX,
                barY,
                barWidth,
                barHeight,
                1.5,
                1.5,
                "F"
              );
            }

            /*
              VALUE

              11pt
              black
              only once
            */

            pdf.setFont(
              "helvetica",
              "bold"
            );

            pdf.setFontSize(
              11
            );

            pdf.setTextColor(
              0,
              0,
              0
            );

            const valueX =
              barX +
              barAreaWidth +
              5;

            pdf.text(
              String(
                item.count
              ),
              valueX,
              centerY + 1.5
            );
          }
        );

        currentY +=
          graphHeight + 7;

        /* =================================================
           CONCLUSION
           ================================================= */

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          11
        );

        pdf.setTextColor(
          0,
          0,
          0
        );

        pdf.text(
          "Conclusion",
          margin,
          currentY
        );

        currentY += 6;

        /*
          12pt font.

          jsPDF's font size is specified
          in points.

          1.5 line spacing for 12pt
          is approximately 6.35mm.
        */

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(
          12
        );

        pdf.setTextColor(
          0,
          0,
          0
        );

        const conclusionLines =
          pdf.splitTextToSize(
            summaryText,
            contentWidth
          );

        const lineHeight =
          6.35;

        /*
          Calculate how much room
          remains for the breakdown.

          If necessary, use the full
          available space while keeping
          1.5 spacing.
        */

        const availableConclusionHeight =
          68;

        const maxConclusionLines =
          Math.max(
            1,
            Math.floor(
              availableConclusionHeight /
                lineHeight
            )
          );

        conclusionLines
          .slice(
            0,
            maxConclusionLines
          )
          .forEach(
            (line) => {
              pdf.text(
                line,
                margin,
                currentY
              );

              currentY +=
                lineHeight;
            }
          );

        currentY += 1;

        /* =================================================
           BREAKDOWN TABLE
           ================================================= */

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          11
        );

        pdf.setTextColor(
          0,
          0,
          0
        );

        pdf.text(
          "Purpose Breakdown",
          margin,
          currentY
        );

        currentY += 3;

        const breakdownRows =
          breakdown.map(
            (
              item,
              index
            ) => [
              index + 1,
              item.name,
              item.count,
              `${item.percentage}%`,
            ]
          );

        autoTable(pdf, {
          startY: currentY,

          margin: {
            left: margin,
            right: margin,
          },

          tableWidth:
            contentWidth,

          head: [
            [
              "Rank",
              "Purpose",
              "Visits",
              "Percentage",
            ],
          ],

          body:
            breakdownRows,

          theme: "grid",

          styles: {
            font:
              "helvetica",

            fontSize:
              8.5,

            textColor: [
              0,
              0,
              0,
            ],

            lineColor: [
              197,
              214,
              230,
            ],

            lineWidth:
              0.2,

            cellPadding:
              2,

            valign:
              "middle",
          },

          headStyles: {
            fillColor: [
              11,
              42,
              74,
            ],

            textColor: [
              255,
              255,
              255,
            ],

            fontStyle:
              "bold",

            fontSize:
              8.5,
          },

          bodyStyles: {
            textColor: [
              0,
              0,
              0,
            ],
          },

          columnStyles: {
            0: {
              halign:
                "center",

              cellWidth:
                17,
            },

            1: {
              cellWidth:
                83,
            },

            2: {
              halign:
                "center",

              cellWidth:
                35,
            },

            3: {
              halign:
                "center",

              cellWidth:
                40,
            },
          },

          didParseCell:
            (data) => {
              if (
                data.section ===
                "body"
              ) {
                data.cell.styles.textColor =
                  [
                    0,
                    0,
                    0,
                  ];
              }
            },
        });

        addFooter(1);

        /* =================================================
           PAGE 2
           REGISTERED LOGS
           ================================================= */

        pdf.addPage();

        /* =================================================
           COMPACT PAGE 2 HEADER
           ================================================= */

        const page2HeaderHeight =
          31;

        pdf.setFillColor(
          11,
          42,
          74
        );

        pdf.rect(
          0,
          0,
          pageWidth,
          page2HeaderHeight,
          "F"
        );

        pdf.setTextColor(
          255,
          255,
          255
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          13
        );

        pdf.text(
          "Holy Family Academy Angeles City",
          margin,
          9
        );

        pdf.setFontSize(
          10
        );

        pdf.text(
          "Grade School IMC",
          margin,
          17
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(
          9
        );

        pdf.text(
          "Registered Usage Logs",
          margin,
          24
        );

        pdf.setTextColor(
          0,
          0,
          0
        );

        /* =================================================
           LOG TABLE
           ================================================= */

        const logRows =
          filteredLogs.map(
            (
              log,
              index
            ) => {
              const purposes =
                getPurposeList(
                  log.purposes
                );

              return [
                index + 1,

                (
                  log.fullname ||
                  "—"
                ).toUpperCase(),

                purposes.length >
                0
                  ? purposes.join(
                      ", "
                    )
                  : "Others",

                formatDateTimeForPDF(
                  log.session_in
                ),

                formatDateTimeForPDF(
                  log.session_out
                ),
              ];
            }
          );

        autoTable(pdf, {
          startY: 38,

          margin: {
            left: margin,
            right: margin,
            bottom: 15,
          },

          tableWidth:
            contentWidth,

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
            logRows.length >
            0
              ? logRows
              : [
                  [
                    "",
                    "No records found",
                    "",
                    "",
                    "",
                  ],
                ],

          theme: "grid",

          styles: {
            font:
              "helvetica",

            fontSize:
              8,

            textColor: [
              0,
              0,
              0,
            ],

            lineColor: [
              197,
              214,
              230,
            ],

            lineWidth:
              0.2,

            cellPadding:
              2.5,

            valign:
              "middle",
          },

          headStyles: {
            fillColor: [
              11,
              42,
              74,
            ],

            textColor: [
              255,
              255,
              255,
            ],

            fontStyle:
              "bold",

            fontSize:
              8,
          },

          bodyStyles: {
            textColor: [
              0,
              0,
              0,
            ],

            fontStyle:
              "normal",
          },

          columnStyles: {
            0: {
              cellWidth:
                10,

              halign:
                "center",
            },

            1: {
              cellWidth:
                45,
            },

            2: {
              cellWidth:
                48,
            },

            3: {
              cellWidth:
                47,
            },

            4: {
              cellWidth:
                47,
            },
          },

          didParseCell:
            (data) => {
              if (
                data.section ===
                "body"
              ) {
                data.cell.styles.textColor =
                  [
                    0,
                    0,
                    0,
                  ];

                /*
                  Keep Name and Purpose
                  simple black text.
                */

                if (
                  data.column.index ===
                    1 ||
                  data.column.index ===
                    2
                ) {
                  data.cell.styles.fontStyle =
                    "normal";
                }
              }
            },

          didDrawPage:
            () => {
              const pageNumber =
                pdf.internal.getNumberOfPages();

              addFooter(
                pageNumber
              );
            },
        });

        /* =================================================
           SAVE PDF
           ================================================= */

        pdf.save(
          `Internet_Usage_Report_${periodLabel.replace(
            /\s+/g,
            "_"
          )}.pdf`
        );
      } catch (error) {
        console.error(
          "PDF export error:",
          error
        );
      } finally {
        setExporting(
          false
        );
      }
    };

  /* =======================================================
     PAGE NUMBERS
     ======================================================= */

  const pageNumbers =
    [];

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    pageNumbers.push(
      page
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="usage-content">

      {/* =================================================
          PAGE HEADER
          ================================================= */}

      <div className="usage-header">

        <div>
          <h1>
            Usage
          </h1>

          <p>
            Internet and computer
            usage analytics and
            registered logs
          </p>
        </div>

        <div className="usage-header-actions">

          <button
            type="button"
            className="usage-btn usage-btn-refresh"
            onClick={
              fetchLogs
            }
            disabled={
              loading
            }
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            className="usage-btn usage-btn-export"
            onClick={
              exportPDF
            }
            disabled={
              exporting ||
              loading
            }
          >
            {exporting
              ? "Exporting..."
              : "Export PDF"}
          </button>

          <button
            type="button"
            className="usage-btn usage-btn-excel"
            onClick={
              exportExcel
            }
            disabled={
              excelExporting ||
              loading
            }
          >
            {excelExporting
              ? "Exporting..."
              : "Export Excel"}
          </button>

        </div>

      </div>

      {/* =================================================
          FILTER BAR
          ================================================= */}

      <div className="usage-control-bar">

        <div className="usage-filter-group">

          <label htmlFor="usage-month">
            Month
          </label>

          <select
            id="usage-month"
            value={
              selectedMonth
            }
            onChange={(
              event
            ) =>
              setSelectedMonth(
                event.target
                  .value
              )
            }
          >
            <option value="all">
              All Months
            </option>

            {MONTHS.map(
              (month) => (
                <option
                  key={
                    month.value
                  }
                  value={
                    month.value
                  }
                >
                  {
                    month.label
                  }
                </option>
              )
            )}
          </select>

        </div>

        <div className="usage-filter-group">

          <label htmlFor="usage-year">
            Year
          </label>

          <select
            id="usage-year"
            value={
              selectedYear
            }
            onChange={(
              event
            ) =>
              setSelectedYear(
                event.target
                  .value
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

        <div className="usage-period-display">

          <span>
            Showing:
          </span>

          <strong>
            {
              periodLabel
            }
          </strong>

        </div>

      </div>

      {/* =================================================
          STAT CARDS
          ================================================= */}

      <div className="usage-summary-grid">

        <div className="usage-stat-card">

          <span className="usage-stat-label">
            Total Usage
          </span>

          <span className="usage-stat-value">
            {
              analytics.total
            }
          </span>

        </div>

        <div className="usage-stat-card">

          <span className="usage-stat-label">
            Most Used
          </span>

          <span className="usage-stat-value usage-stat-purpose">
            {highestPurpose
              ? highestPurpose.name
              : "—"}
          </span>

        </div>

        <div className="usage-stat-card">

          <span className="usage-stat-label">
            Least Used
          </span>

          <span className="usage-stat-value usage-stat-purpose">
            {lowestPurpose
              ? lowestPurpose.name
              : "—"}
          </span>

        </div>

        <div className="usage-stat-card">

          <span className="usage-stat-label">
            Sessions
          </span>

          <span className="usage-stat-value">
            {
              analytics.sessions
            }
          </span>

        </div>

      </div>

      {/* =================================================
          WEB GRAPH
          ================================================= */}

      <section className="usage-section usage-chart-section">

        <div className="usage-section-header">

          <div>

            <h2>
              Purpose Breakdown
            </h2>

            <p>
              Usage ranked from
              highest to lowest
            </p>

          </div>

        </div>

        {loading ? (
          <div className="usage-empty-state">
            Loading usage data...
          </div>
        ) : analytics.total ===
          0 ? (
          <div className="usage-empty-state">
            No usage data found
            for{" "}
            {
              periodLabel
            }.
          </div>
        ) : (
          <div className="usage-chart-container">

            <Bar
              ref={
                chartRef
              }
              data={
                chartData
              }
              options={
                chartOptions
              }
              plugins={[
                barValuePlugin,
              ]}
            />

          </div>
        )}

      </section>

      {/* =================================================
          CONCLUSION
          ================================================= */}

      <section className="usage-summary-box">

        <div className="usage-summary-box-header">

          <h2>
            Conclusion
          </h2>

        </div>

        <p>
          {
            summaryText
          }
        </p>

      </section>

      {/* =================================================
          PURPOSE BREAKDOWN
          ================================================= */}

      <section className="usage-section">

        <div className="usage-section-header">

          <div>

            <h2>
              Purpose Breakdown
            </h2>

            <p>
              Detailed distribution
              of recorded purposes
            </p>

          </div>

        </div>

        <div className="usage-breakdown-list">

          {breakdown.map(
            (
              item,
              index
            ) => (
              <div
                className="usage-breakdown-item"
                key={
                  item.name
                }
              >

                <div className="usage-breakdown-rank">
                  #
                  {
                    index +
                    1
                  }
                </div>

                <div
                  className="usage-breakdown-color"
                  style={{
                    backgroundColor:
                      PURPOSE_COLORS[
                        item.name
                      ],
                  }}
                />

                <div className="usage-breakdown-main">

                  <div className="usage-breakdown-top">

                    <span className="usage-breakdown-name">
                      {
                        item.name
                      }
                    </span>

                    <span className="usage-breakdown-count">
                      {
                        item.count
                      }{" "}
                      {item.count ===
                      1
                        ? "visit"
                        : "visits"}
                    </span>

                  </div>

                  <div className="usage-progress-track">

                    <div
                      className="usage-progress-bar"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor:
                          PURPOSE_COLORS[
                            item.name
                          ],
                      }}
                    />

                  </div>

                </div>

                <div className="usage-breakdown-percentage">
                  {
                    item.percentage
                  }
                  %
                </div>

              </div>
            )
          )}

        </div>

      </section>

      {/* =================================================
          REGISTERED LOGS
          ================================================= */}

      <section className="usage-section">

        <div className="usage-section-header">

          <div>

            <h2>
              Registered Usage Logs
            </h2>

            <p>
              Individual computer
              and internet usage
              records
            </p>

          </div>

          <span className="usage-record-count">
            {
              filteredLogs.length
            }{" "}
            record
            {
              filteredLogs.length ===
              1
                ? ""
                : "s"
            }
          </span>

        </div>

        <div className="usage-table-wrapper">

          <table className="usage-table">

            <thead>

              <tr>

                <th>
                  No.
                </th>

                <th>
                  Name
                </th>

                <th>
                  Purpose
                </th>

                <th>
                  Session In
                </th>

                <th>
                  Session Out
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (
                <tr>

                  <td
                    colSpan="5"
                    className="usage-table-message"
                  >
                    Loading records...
                  </td>

                </tr>
              ) : paginatedLogs.length ===
                0 ? (
                <tr>

                  <td
                    colSpan="5"
                    className="usage-table-message"
                  >
                    No usage
                    records found.
                  </td>

                </tr>
              ) : (
                paginatedLogs.map(
                  (
                    log,
                    index
                  ) => {

                    const purposes =
                      getPurposeList(
                        log.purposes
                      );

                    return (
                      <tr
                        key={`${log.session_in}-${index}`}
                      >

                        <td>
                          {(currentPage -
                            1) *
                            ITEMS_PER_PAGE +
                            index +
                            1}
                        </td>

                        <td className="usage-name-cell">
                          {(
                            log.fullname ||
                            "—"
                          ).toUpperCase()}
                        </td>

                        <td className="usage-purpose-cell">
                          {purposes.length >
                          0
                            ? purposes.join(
                                ", "
                              )
                            : "Others"}
                        </td>

                        <td>
                          {
                            formatDateTime(
                              log.session_in
                            )
                          }
                        </td>

                        <td>
                          {
                            formatDateTime(
                              log.session_out
                            )
                          }
                        </td>

                      </tr>
                    );
                  }
                )
              )}

            </tbody>

          </table>

        </div>

        {/* =================================================
            PAGINATION
            ================================================= */}

        {!loading &&
          filteredLogs.length >
            ITEMS_PER_PAGE && (
            <div className="usage-pagination">

              <button
                type="button"
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        1,
                        page -
                          1
                      )
                  )
                }
                disabled={
                  currentPage ===
                  1
                }
              >
                Previous
              </button>

              {pageNumbers.map(
                (page) => (
                  <button
                    type="button"
                    key={
                      page
                    }
                    className={
                      currentPage ===
                      page
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setCurrentPage(
                        page
                      )
                    }
                  >
                    {
                      page
                    }
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        totalPages,
                        page +
                          1
                      )
                  )
                }
                disabled={
                  currentPage ===
                  totalPages
                }
              >
                Next
              </button>

            </div>
          )}

      </section>

    </div>
  );
}