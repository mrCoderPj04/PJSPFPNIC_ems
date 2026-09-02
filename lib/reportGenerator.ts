import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';


export interface ReportConfig {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
  generatedBy?: string;
}

const getLogoBase64 = (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = '/logo.png';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
  });
};

export const generatePDFReport = async (config: ReportConfig) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();

  // Add Company Logo Header
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);
    } catch {
      /* fallback if image fails */
    }
  }

  // Company Information Header
  const startX = logoBase64 ? 38 : 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 27, 75); // Indigo 950
  doc.text('PJSOFONIC ERP SOLUTIONS', startX, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('Enterprise Resource Planning Portal | Official Audit Report', startX, 23);
  doc.text(`Corporate Tower • Support: info@pjsofonic.com`, startX, 28);

  // Line Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(14, 34, 196, 34);

  // Report Meta Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(config.title.toUpperCase(), 14, 43);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // Slate 600
  const dateStr = new Date().toLocaleString();
  const metaText = `Generated On: ${dateStr}   |   Exported By: ${config.generatedBy || 'Administrator'}`;
  doc.text(metaText, 14, 49);

  // Data Table
  autoTable(doc, {
    startY: 54,
    head: [config.headers],
    body: config.rows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer Page Numbering
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} — Confidential • PJSOFONIC ERP`,
      105,
      287,
      { align: 'center' }
    );
  }

  doc.save(`${config.fileName}.pdf`);
};

export const generateExcelReport = (config: ReportConfig) => {
  const dateStr = new Date().toLocaleString();
  const sheetData: (string | number)[][] = [
    ['PJSOFONIC ERP SOLUTIONS'],
    ['Enterprise Resource Planning Portal | Official Audit Report'],
    [`Report Title: ${config.title}`],
    [`Generated On: ${dateStr}`, `Exported By: ${config.generatedBy || 'Administrator'}`],
    [], // Blank spacing row
    config.headers,
    ...config.rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto column widths
  const colWidths = config.headers.map((h, i) => {
    let maxLen = h.length;
    config.rows.forEach((r) => {
      const cellVal = String(r[i] ?? '');
      if (cellVal.length > maxLen) maxLen = cellVal.length;
    });
    return { wch: Math.max(maxLen + 4, 15) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, config.title.substring(0, 30));

  XLSX.writeFile(wb, `${config.fileName}.xlsx`);
};

export interface EmployeeSlipData {
  employeeId: string;
  username: string;
  password: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  department?: string | null;
  generatedBy?: string;
}

export const generateEmployeeCredentialSlipPDF = async (data: EmployeeSlipData) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 12, 22, 22);
    } catch {
      /* fallback */
    }
  }

  const startX = logoBase64 ? 40 : 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 27, 75);
  doc.text('PJSOFONIC ERP SOLUTIONS', startX, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Enterprise Resource Planning Portal • Corporate Administration', startX, 25);
  doc.text('Support & Inquiries: info@pjsofonic.com | www.pjsofonic.com', startX, 30);

  // Line Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(14, 38, 196, 38);

  // Title badge
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(14, 44, 182, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(67, 56, 202);
  doc.text('OFFICIAL EMPLOYEE ONBOARDING & CREDENTIAL SLIP', 105, 53, { align: 'center' });

  // Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const nowStr = new Date().toLocaleString();
  doc.text(`Generated On: ${nowStr}   |   Issued By: ${data.generatedBy || 'Administrator'}`, 14, 66);

  // Table with credentials
  autoTable(doc, {
    startY: 72,
    head: [['Field / Property', 'Employee Credential Details']],
    body: [
      ['Employee Full Name', data.username],
      ['Employee ID', `#${data.employeeId}`],
      ['Login Password', data.password],
      ['Official Sofo Email', data.email || `${data.username.toLowerCase().replace(/\s+/g, '')}@pjsofonic.com`],
      ['Registered Phone Number', data.phone || 'N/A'],
      ['Designation / Position', data.designation || 'Staff Member'],
      ['Assigned Department', data.department || 'General / Unassigned'],
      ['Account Status', 'ACTIVE (Direct Access Enabled)'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [30, 41, 59],
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, fillColor: [248, 250, 252] },
      1: { fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Security & Instructions Box
  doc.setFillColor(254, 243, 199); // Amber-100
  doc.setDrawColor(251, 191, 36);  // Amber-400
  doc.roundedRect(14, finalY + 8, 182, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(146, 64, 14); // Amber-800
  doc.text('Important Security Instructions:', 20, finalY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 83, 9);
  doc.text('• Use the Employee ID (or Official Email) and Password above to sign in to PJEMS & Sofo Mail.', 20, finalY + 22);
  doc.text('• Direct Login is enabled — no initial forced password reset required.', 20, finalY + 27);
  doc.text('• Keep this onboarding slip confidential. Do not share your password with unauthorized personnel.', 20, finalY + 32);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Confidential Document — PJSOFONIC ERP SOLUTIONS © 2026', 105, 287, { align: 'center' });

  const safeName = data.username.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`credentials_slip_${data.employeeId}_${safeName}.pdf`);
};
