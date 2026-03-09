/**
 * PDF export utility for financial reports.
 *
 * Uses jsPDF + jspdf-autotable for client-side PDF generation.
 * All amounts are expected in kronor (already converted from öre).
 */

import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

/** Swedish number formatting for PDF amounts */
export function pdfAmount(amount: number): string {
  return amount.toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface PdfOptions {
  /** Report title, e.g. "Resultaträkning" */
  title: string;
  /** Organization/company name */
  orgName: string;
  /** Period text, e.g. "2024-01-01 – 2024-12-31" */
  period: string;
  /** Output filename (without .pdf extension) */
  filename: string;
  /** Page orientation */
  orientation?: "portrait" | "landscape";
}

/**
 * Create a new PDF document with standard report header.
 * Returns the doc and the current Y position after the header.
 */
function createReportPdf(options: PdfOptions): { doc: jsPDF; startY: number } {
  const doc = new jsPDF({
    orientation: options.orientation ?? "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.text(options.title, pageWidth / 2, 20, { align: "center" });

  // Company name
  doc.setFontSize(11);
  doc.text(options.orgName, pageWidth / 2, 27, { align: "center" });

  // Period
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(options.period, pageWidth / 2, 33, { align: "center" });
  doc.setTextColor(0);

  return { doc, startY: 40 };
}

/** Standard table styles for financial reports */
const tableStyles = {
  headStyles: {
    fillColor: [240, 240, 240] as [number, number, number],
    textColor: [0, 0, 0] as [number, number, number],
    fontStyle: "bold" as const,
    lineColor: [200, 200, 200] as [number, number, number],
    lineWidth: 0.2,
  },
  bodyStyles: {
    textColor: [0, 0, 0] as [number, number, number],
    lineColor: [230, 230, 230] as [number, number, number],
    lineWidth: 0.1,
  },
  footStyles: {
    fillColor: [248, 248, 248] as [number, number, number],
    textColor: [0, 0, 0] as [number, number, number],
    fontStyle: "bold" as const,
    lineColor: [200, 200, 200] as [number, number, number],
    lineWidth: 0.2,
  },
  styles: {
    fontSize: 9,
    cellPadding: 2,
  },
};

/**
 * Add a footer with generation date and page numbers on all pages.
 */
function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date().toLocaleString("sv-SE");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Genererad: ${now}`, 14, pageHeight - 10);
    doc.text(`Sida ${i} av ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: "right" });
  }
}

function savePdf(doc: jsPDF, filename: string) {
  addFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ── Report-specific export functions ────────────────────────

/** Trial Balance (Råbalans) */
export function exportTrialBalancePdf(
  report: {
    rows: readonly {
      accountNumber: string;
      accountName: string;
      debit: number;
      credit: number;
      balance: number;
    }[];
    totalDebit: number;
    totalCredit: number;
  },
  orgName: string,
  period: string,
) {
  const { doc, startY } = createReportPdf({
    title: "Råbalans",
    orgName,
    period,
    filename: "rabalans",
  });

  autoTable(doc, {
    startY,
    head: [["Konto", "Namn", "Debet", "Kredit", "Saldo"]],
    body: report.rows.map((r) => [
      r.accountNumber,
      r.accountName,
      { content: pdfAmount(r.debit), styles: { halign: "right" as const } },
      { content: pdfAmount(r.credit), styles: { halign: "right" as const } },
      { content: pdfAmount(r.balance), styles: { halign: "right" as const } },
    ]),
    foot: [
      [
        { content: "Summa", colSpan: 2, styles: { halign: "left" as const } },
        { content: pdfAmount(report.totalDebit), styles: { halign: "right" as const } },
        { content: pdfAmount(report.totalCredit), styles: { halign: "right" as const } },
        "",
      ],
    ],
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: "auto" } },
    ...tableStyles,
  });

  savePdf(doc, "rabalans");
}

/** Section rows used in income statement and balance sheet */
interface ReportSection {
  title: string;
  rows: readonly { accountNumber: string; accountName: string; amount: number }[];
  total: number;
}

/** Income Statement (Resultaträkning) */
export function exportIncomeStatementPdf(
  report: {
    revenues: ReportSection;
    expenses: ReportSection;
    financialIncome: ReportSection;
    financialExpenses: ReportSection;
    operatingResult: number;
    netResult: number;
  },
  orgName: string,
  period: string,
) {
  const { doc, startY } = createReportPdf({
    title: "Resultaträkning",
    orgName,
    period,
    filename: "resultatrakning",
  });

  const body: RowInput[] = [];

  function addSection(section: ReportSection) {
    if (section.rows.length === 0) return;
    body.push([{ content: section.title, colSpan: 3, styles: { fontStyle: "bold" as const } }]);
    for (const r of section.rows) {
      body.push([
        {
          content: r.accountNumber,
          styles: { cellPadding: { left: 6, top: 2, bottom: 2, right: 2 } },
        },
        r.accountName,
        { content: pdfAmount(r.amount), styles: { halign: "right" as const } },
      ]);
    }
    body.push([
      {
        content: `Summa ${section.title.toLowerCase()}`,
        colSpan: 2,
        styles: {
          fontStyle: "bold" as const,
          cellPadding: { left: 6, top: 2, bottom: 2, right: 2 },
        },
      },
      {
        content: pdfAmount(section.total),
        styles: { halign: "right" as const, fontStyle: "bold" as const },
      },
    ]);
  }

  addSection(report.revenues);
  addSection(report.expenses);
  body.push([
    { content: "Rörelseresultat", colSpan: 2, styles: { fontStyle: "bold" as const } },
    {
      content: pdfAmount(report.operatingResult),
      styles: { halign: "right" as const, fontStyle: "bold" as const },
    },
  ]);
  addSection(report.financialIncome);
  addSection(report.financialExpenses);
  body.push([
    { content: "Årets resultat", colSpan: 2, styles: { fontStyle: "bold" as const, fontSize: 11 } },
    {
      content: pdfAmount(report.netResult),
      styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 11 },
    },
  ]);

  autoTable(doc, {
    startY,
    head: [["Konto", "Namn", "Belopp"]],
    body,
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: "auto" } },
    ...tableStyles,
  });

  savePdf(doc, "resultatrakning");
}

/** Balance Sheet (Balansräkning) */
export function exportBalanceSheetPdf(
  report: {
    assets: ReportSection;
    equity: ReportSection;
    liabilities: ReportSection;
    totalAssets: number;
    totalLiabilitiesAndEquity: number;
    yearResult: number;
    difference: number;
  },
  orgName: string,
  period: string,
) {
  const { doc, startY } = createReportPdf({
    title: "Balansräkning",
    orgName,
    period,
    filename: "balansrakning",
  });

  const body: RowInput[] = [];

  function addSection(title: string, section: ReportSection) {
    if (section.rows.length === 0) return;
    body.push([{ content: title, colSpan: 3, styles: { fontStyle: "bold" as const } }]);
    for (const r of section.rows) {
      body.push([
        {
          content: r.accountNumber,
          styles: { cellPadding: { left: 6, top: 2, bottom: 2, right: 2 } },
        },
        r.accountName,
        { content: pdfAmount(r.amount), styles: { halign: "right" as const } },
      ]);
    }
    body.push([
      {
        content: `Summa ${title.toLowerCase()}`,
        colSpan: 2,
        styles: {
          fontStyle: "bold" as const,
          cellPadding: { left: 6, top: 2, bottom: 2, right: 2 },
        },
      },
      {
        content: pdfAmount(section.total),
        styles: { halign: "right" as const, fontStyle: "bold" as const },
      },
    ]);
  }

  // Assets
  addSection("Tillgångar", report.assets);
  body.push([
    { content: "Summa tillgångar", colSpan: 2, styles: { fontStyle: "bold" as const } },
    {
      content: pdfAmount(report.totalAssets),
      styles: { halign: "right" as const, fontStyle: "bold" as const },
    },
  ]);

  // Blank row separator
  body.push([{ content: "", colSpan: 3 }]);

  // Equity
  addSection("Eget kapital", report.equity);
  if (report.yearResult !== 0) {
    body.push([
      { content: "", styles: { cellPadding: { left: 6, top: 2, bottom: 2, right: 2 } } },
      "Årets resultat",
      { content: pdfAmount(report.yearResult), styles: { halign: "right" as const } },
    ]);
  }

  // Liabilities
  addSection("Skulder", report.liabilities);
  body.push([
    {
      content: "Summa eget kapital och skulder",
      colSpan: 2,
      styles: { fontStyle: "bold" as const, fontSize: 10 },
    },
    {
      content: pdfAmount(report.totalLiabilitiesAndEquity),
      styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 10 },
    },
  ]);

  if (report.difference !== 0) {
    body.push([
      {
        content: "Differens",
        colSpan: 2,
        styles: { textColor: [200, 0, 0] as [number, number, number] },
      },
      {
        content: pdfAmount(report.difference),
        styles: { halign: "right" as const, textColor: [200, 0, 0] as [number, number, number] },
      },
    ]);
  }

  autoTable(doc, {
    startY,
    head: [["Konto", "Namn", "Saldo"]],
    body,
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: "auto" } },
    ...tableStyles,
  });

  savePdf(doc, "balansrakning");
}

/** VAT Report (Momsrapport) */
export function exportVatReportPdf(
  report: {
    outputVat: readonly { accountNumber: string; accountName: string; amount: number }[];
    inputVat: readonly { accountNumber: string; accountName: string; amount: number }[];
    totalOutputVat: number;
    totalInputVat: number;
    vatPayable: number;
  },
  orgName: string,
  period: string,
) {
  const { doc, startY } = createReportPdf({
    title: "Momsrapport",
    orgName,
    period,
    filename: "momsrapport",
  });

  const body: RowInput[] = [];

  if (report.outputVat.length > 0) {
    body.push([{ content: "Utgående moms", colSpan: 3, styles: { fontStyle: "bold" as const } }]);
    for (const r of report.outputVat) {
      body.push([
        {
          content: r.accountNumber,
          styles: { cellPadding: { left: 6, top: 2, bottom: 2, right: 2 } },
        },
        r.accountName,
        { content: pdfAmount(r.amount), styles: { halign: "right" as const } },
      ]);
    }
    body.push([
      {
        content: "Summa utgående moms",
        colSpan: 2,
        styles: {
          fontStyle: "bold" as const,
          cellPadding: { left: 6, top: 2, bottom: 2, right: 2 },
        },
      },
      {
        content: pdfAmount(report.totalOutputVat),
        styles: { halign: "right" as const, fontStyle: "bold" as const },
      },
    ]);
  }

  if (report.inputVat.length > 0) {
    body.push([
      {
        content: "Ingående moms (avdragsgill)",
        colSpan: 3,
        styles: { fontStyle: "bold" as const },
      },
    ]);
    for (const r of report.inputVat) {
      body.push([
        {
          content: r.accountNumber,
          styles: { cellPadding: { left: 6, top: 2, bottom: 2, right: 2 } },
        },
        r.accountName,
        { content: pdfAmount(r.amount), styles: { halign: "right" as const } },
      ]);
    }
    body.push([
      {
        content: "Summa ingående moms",
        colSpan: 2,
        styles: {
          fontStyle: "bold" as const,
          cellPadding: { left: 6, top: 2, bottom: 2, right: 2 },
        },
      },
      {
        content: pdfAmount(report.totalInputVat),
        styles: { halign: "right" as const, fontStyle: "bold" as const },
      },
    ]);
  }

  body.push([{ content: "", colSpan: 3 }]);
  body.push([
    {
      content: report.vatPayable >= 0 ? "Moms att betala" : "Momsfordran",
      colSpan: 2,
      styles: { fontStyle: "bold" as const, fontSize: 11 },
    },
    {
      content: pdfAmount(report.vatPayable),
      styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 11 },
    },
  ]);

  autoTable(doc, {
    startY,
    head: [["Konto", "Namn", "Belopp (kr)"]],
    body,
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: "auto" } },
    ...tableStyles,
  });

  savePdf(doc, "momsrapport");
}

/** General Ledger (Huvudbok) */
export function exportGeneralLedgerPdf(
  report: {
    accounts: readonly {
      accountNumber: string;
      accountName: string;
      transactions: readonly {
        date: string;
        voucherNumber: number;
        description: string;
        debit: number;
        credit: number;
        balance: number;
      }[];
      totalDebit: number;
      totalCredit: number;
      closingBalance: number;
    }[];
  },
  orgName: string,
  period: string,
) {
  const { doc, startY } = createReportPdf({
    title: "Huvudbok",
    orgName,
    period,
    filename: "huvudbok",
    orientation: "landscape",
  });

  let currentY = startY;

  for (const account of report.accounts) {
    if (account.transactions.length === 0) continue;

    // Account heading
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${account.accountNumber} – ${account.accountName}`, 14, currentY);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      head: [["Datum", "Ver.nr", "Beskrivning", "Debet", "Kredit", "Saldo"]],
      body: account.transactions.map((t) => [
        new Date(t.date).toLocaleDateString("sv-SE"),
        String(t.voucherNumber),
        t.description,
        { content: t.debit > 0 ? pdfAmount(t.debit) : "", styles: { halign: "right" as const } },
        { content: t.credit > 0 ? pdfAmount(t.credit) : "", styles: { halign: "right" as const } },
        { content: pdfAmount(t.balance), styles: { halign: "right" as const } },
      ]),
      foot: [
        [
          { content: "Summa", colSpan: 3, styles: { halign: "left" as const } },
          { content: pdfAmount(account.totalDebit), styles: { halign: "right" as const } },
          { content: pdfAmount(account.totalCredit), styles: { halign: "right" as const } },
          { content: pdfAmount(account.closingBalance), styles: { halign: "right" as const } },
        ],
      ],
      ...tableStyles,
      margin: { top: 10 },
    });

    // Get position after table for next account
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // If low on page, add a new one
    if (currentY > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      currentY = 15;
    }
  }

  savePdf(doc, "huvudbok");
}

/** Year-End Closing Preview (Bokslut-förhandsvisning) */
export function exportYearEndClosingPdf(
  preview: {
    revenues: {
      title: string;
      lines: readonly {
        accountNumber: string;
        accountName: string;
        currentBalance: number;
        closingDebit: number;
        closingCredit: number;
      }[];
      total: number;
    };
    expenses: {
      title: string;
      lines: readonly {
        accountNumber: string;
        accountName: string;
        currentBalance: number;
        closingDebit: number;
        closingCredit: number;
      }[];
      total: number;
    };
    financialIncome: {
      title: string;
      lines: readonly {
        accountNumber: string;
        accountName: string;
        currentBalance: number;
        closingDebit: number;
        closingCredit: number;
      }[];
      total: number;
    };
    financialExpenses: {
      title: string;
      lines: readonly {
        accountNumber: string;
        accountName: string;
        currentBalance: number;
        closingDebit: number;
        closingCredit: number;
      }[];
      total: number;
    };
    resultEntry: { accountNumber: string; accountName: string; debit: number; credit: number };
    netResult: number;
  },
  orgName: string,
  period: string,
) {
  const { doc, startY } = createReportPdf({
    title: "Boksluts-förhandsvisning",
    orgName,
    period,
    filename: "bokslut",
  });

  const body: RowInput[] = [];

  function addSection(section: typeof preview.revenues) {
    if (section.lines.length === 0) return;
    body.push([{ content: section.title, colSpan: 5, styles: { fontStyle: "bold" as const } }]);
    for (const l of section.lines) {
      body.push([
        {
          content: l.accountNumber,
          styles: { cellPadding: { left: 6, top: 2, bottom: 2, right: 2 } },
        },
        l.accountName,
        { content: pdfAmount(l.currentBalance), styles: { halign: "right" as const } },
        {
          content: l.closingDebit ? pdfAmount(l.closingDebit) : "",
          styles: { halign: "right" as const },
        },
        {
          content: l.closingCredit ? pdfAmount(l.closingCredit) : "",
          styles: { halign: "right" as const },
        },
      ]);
    }
    body.push([
      {
        content: "Summa",
        colSpan: 2,
        styles: {
          fontStyle: "bold" as const,
          cellPadding: { left: 6, top: 2, bottom: 2, right: 2 },
        },
      },
      {
        content: pdfAmount(section.total),
        styles: { halign: "right" as const, fontStyle: "bold" as const },
      },
      "",
      "",
    ]);
  }

  addSection(preview.revenues);
  addSection(preview.expenses);
  addSection(preview.financialIncome);
  addSection(preview.financialExpenses);

  // Result entry
  body.push([{ content: "", colSpan: 5 }]);
  body.push([
    { content: "Resultat → 2099", styles: { fontStyle: "bold" as const } },
    preview.resultEntry.accountName,
    "",
    {
      content: preview.resultEntry.debit ? pdfAmount(preview.resultEntry.debit) : "",
      styles: { halign: "right" as const },
    },
    {
      content: preview.resultEntry.credit ? pdfAmount(preview.resultEntry.credit) : "",
      styles: { halign: "right" as const },
    },
  ]);
  body.push([{ content: "", colSpan: 5 }]);
  body.push([
    { content: "Nettoresultat", colSpan: 2, styles: { fontStyle: "bold" as const, fontSize: 11 } },
    {
      content: pdfAmount(preview.netResult),
      styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 11 },
    },
    "",
    "",
  ]);

  autoTable(doc, {
    startY,
    head: [["Konto", "Kontonamn", "Saldo", "Debet", "Kredit"]],
    body,
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: "auto" } },
    ...tableStyles,
  });

  savePdf(doc, "bokslut-forhandsvisning");
}
