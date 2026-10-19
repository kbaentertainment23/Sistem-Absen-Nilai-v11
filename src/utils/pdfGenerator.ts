/**
 * Module PDF Generator Mandiri (Direct Vector PDF Engine)
 * Menggunakan jsPDF & jspdf-autotable.
 * 
 * Modul ini menggambar seluruh dokumen laporan secara langsung ke koordinat PDF (millimeter)
 * tanpa bergantung pada window.print() atau dialog cetak browser.
 * 
 * Hasil PDF dijamin 100% konsisten di semua sistem operasi (Windows, Mac, Linux, iOS, Android),
 * tidak bergantung pada resolusi layar, zoom browser, atau perbedaan rendering CSS.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureDataUrl } from './imageHelper';
import { 
  Student, 
  AttendanceRecord, 
  GradeFormative, 
  GradeSummative, 
  MonthlyRecap, 
  GradeColumn, 
  StudentNote,
  JurnalHarianRecord,
  ExtraTikPeserta,
  ExtraTikAbsensi,
  ExtraTikNilai,
  GradeAttitude,
  GradeWeightConfig
} from '../types';
import { 
  calculateStudentGradeBreakdown, 
  DEFAULT_GRADE_WEIGHTS 
} from './gradeCalculator';

export interface PDFReportConfig {
  govName?: string;
  deptName?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  cityName?: string;
  teacherSubject?: string;
  teacherName?: string;
  teacherNip?: string;
  headmasterName?: string;
  headmasterNip?: string;
  logoKiri?: string | null;
  logoKanan?: string | null;
  parafMode?: 'digital' | 'custom_image' | 'stamp' | 'manual';
  customParafImg?: string | null;
  semester?: string;
  academicYear?: string;
  activeClassName?: string;
  orientation?: 'portrait' | 'landscape';
}

export interface PDFGeneratorParams {
  reportType: 'collective' | 'individual' | 'journal' | 'extra_tik';
  config: PDFReportConfig;
  includeAttendance?: boolean;
  includeGrades?: boolean;
  includeNotes?: boolean;
  students?: Student[];
  selectedStudentNis?: string;
  attendance?: AttendanceRecord[];
  formativeGrades?: GradeFormative[];
  summativeGrades?: GradeSummative[];
  recap?: MonthlyRecap[];
  formativeCols?: GradeColumn[];
  summativeCols?: GradeColumn[];
  attitudeGrades?: GradeAttitude[];
  gradeWeights?: GradeWeightConfig;
  notes?: StudentNote[];
  journals?: JurnalHarianRecord[];
  extraTikPeserta?: ExtraTikPeserta[];
  extraTikAbsensi?: ExtraTikAbsensi[];
  extraTikNilai?: ExtraTikNilai[];
}

/**
 * Format tanggal hari ini menjadi format DD-MM-YYYY untuk penamaan file & tanggal cetak
 */
const getFormattedDate = (): string => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Helper untuk menghitung rata-rata nilai dari array angka
 */
const calculateAvg = (scores: (number | null | undefined)[]): number => {
  const validScores = scores.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  if (validScores.length === 0) return 0;
  const total = validScores.reduce((acc, curr) => acc + curr, 0);
  return parseFloat((total / validScores.length).toFixed(1));
};

/**
 * Menggambar Kop Surat Resmi Sekolah Indonesia di bagian atas dokumen PDF
 */
const drawKopSurat = (
  doc: jsPDF, 
  config: PDFReportConfig, 
  pageWidth: number, 
  startY: number = 10
): number => {
  const marginX = 14;
  const logoSize = 18; // 18mm x 18mm

  let logoKiriX = marginX;
  let logoKananX = pageWidth - marginX - logoSize;
  let textCenterX = pageWidth / 2;

  // Gambar Logo Kiri jika ada
  if (config.logoKiri) {
    try {
      const format = config.logoKiri.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(config.logoKiri, format, logoKiriX, startY, logoSize, logoSize);
    } catch (e) {
      console.warn('Gagal memuat logo kiri:', e);
    }
  }

  // Gambar Logo Kanan jika ada
  if (config.logoKanan) {
    try {
      const format = config.logoKanan.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(config.logoKanan, format, logoKananX, startY, logoSize, logoSize);
    } catch (e) {
      console.warn('Gagal memuat logo kanan:', e);
    }
  }

  // Teks Kop Surat
  doc.setTextColor(15, 23, 42); // Slate-900
  let currentY = startY + 4;

  // Nama Pemerintah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text((config.govName || 'PEMERINTAH PROVINSI / KABUPATEN').toUpperCase(), textCenterX, currentY, { align: 'center' });

  // Nama Dinas
  currentY += 4.5;
  doc.setFontSize(9);
  doc.text((config.deptName || 'DINAS PENDIDIKAN DAN KEBUDAYAAN').toUpperCase(), textCenterX, currentY, { align: 'center' });

  // Nama Satuan Pendidikan
  currentY += 5.5;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75); // Indigo-950
  doc.text((config.schoolName || 'SATUAN PENDIDIKAN').toUpperCase(), textCenterX, currentY, { align: 'center' });

  // Alamat Sekolah
  currentY += 4.5;
  doc.setTextColor(51, 65, 85); // Slate-700
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(config.schoolAddress || 'Alamat Sekolah', textCenterX, currentY, { align: 'center' });

  // Telepon / Email
  if (config.schoolPhone) {
    currentY += 3.5;
    doc.setFontSize(7.5);
    doc.text(config.schoolPhone, textCenterX, currentY, { align: 'center' });
  }

  // Garis Ganda Modern Kop Surat (Utama Navy/Indigo + Akses Tipis Indigo Accent)
  const lineY = Math.max(startY + logoSize + 2, currentY + 3);
  
  // Garis Utama Tebal
  doc.setDrawColor(30, 27, 75); // Indigo-950
  doc.setLineWidth(0.8);
  doc.line(marginX, lineY, pageWidth - marginX, lineY);

  // Garis Akses Tipis Accent
  doc.setDrawColor(99, 102, 241); // Indigo-500 Accent
  doc.setLineWidth(0.3);
  doc.line(marginX, lineY + 1.1, pageWidth - marginX, lineY + 1.1);

  return lineY + 5; // Kembalikan koordinat Y untuk isi dokumen
};

/**
 * Menggambar Blok Tanda Tangan Resmi di akhir dokumen
 */
const drawSignatures = (
  doc: jsPDF, 
  config: PDFReportConfig, 
  pageWidth: number, 
  startY: number,
  cols: 2 | 3 = 2
): number => {
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const cityDateText = `${config.cityName || 'Jakarta'}, ${currentDate}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  if (cols === 2) {
    // 2 Kolom: Pinggir Kiri (Kepala Sekolah) & Pinggir Kanan (Guru / Wali Kelas)
    const leftColX = marginX + 35;
    let leftY = startY + 4; // Sejajar dengan baris jabatan Guru setelah baris kota/tanggal

    doc.text('Mengetahui,', leftColX, leftY, { align: 'center' });
    leftY += 4;
    doc.text('Kepala Sekolah,', leftColX, leftY, { align: 'center' });

    leftY += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(config.headmasterName || 'Nama Kepala Sekolah', leftColX, leftY, { align: 'center' });
    leftY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(config.headmasterNip || 'NIP. -', leftColX, leftY, { align: 'center' });

    const rightColX = pageWidth - marginX - 35;
    let rightY = startY;

    doc.text(cityDateText, rightColX, rightY, { align: 'center' });
    rightY += 4;
    doc.text(`Guru Mata Pelajaran / Wali Kelas,`, rightColX, rightY, { align: 'center' });

    // Gambar Paraf jika ada
    if (config.customParafImg && config.parafMode === 'custom_image') {
      try {
        const format = config.customParafImg.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(config.customParafImg, format, rightColX - 12, rightY + 2, 24, 14);
      } catch (e) {
        console.warn('Gagal memuat gambar paraf:', e);
      }
    }

    rightY += 18; // Jarak ruang tanda tangan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(config.teacherName || 'Nama Guru, M.Pd.', rightColX, rightY, { align: 'center' });
    rightY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(config.teacherNip || 'NIP. -', rightColX, rightY, { align: 'center' });

    return Math.max(leftY, rightY) + 6;
  } else {
    // 3 Tanda Tangan: 3 Kolom Berjejer Sejajar (Pinggir Kiri: Orang Tua, Tengah: Wali Kelas/Guru, Pinggir Kanan: Kepala Sekolah)
    const colWidth = contentWidth / 3;

    // Kolom 1: Orang Tua / Wali Siswa (Pinggir Kiri)
    const col1X = marginX + colWidth / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Mengetahui,', col1X, startY + 4, { align: 'center' });
    doc.text('Orang Tua / Wali Siswa,', col1X, startY + 8, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('( .................................... )', col1X, startY + 28, { align: 'center' });

    // Kolom 2: Wali Kelas / Guru Mata Pelajaran (Tengah)
    const col2X = marginX + colWidth + colWidth / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Mengetahui,', col2X, startY + 4, { align: 'center' });
    doc.text('Guru / Wali Kelas,', col2X, startY + 8, { align: 'center' });

    if (config.customParafImg && config.parafMode === 'custom_image') {
      try {
        const format = config.customParafImg.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(config.customParafImg, format, col2X - 12, startY + 10, 24, 14);
      } catch (e) {
        console.warn('Gagal memuat gambar paraf:', e);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.text(config.teacherName || 'Nama Wali Kelas', col2X, startY + 28, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(config.teacherNip || 'NIP. -', col2X, startY + 31.5, { align: 'center' });

    // Kolom 3: Kepala Sekolah (Pinggir Kanan)
    const col3X = marginX + colWidth * 2 + colWidth / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(cityDateText, col3X, startY, { align: 'center' });
    doc.text('Kepala Sekolah,', col3X, startY + 8, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(config.headmasterName || 'Nama Kepala Sekolah', col3X, startY + 28, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(config.headmasterNip || 'NIP. -', col3X, startY + 31.5, { align: 'center' });

    return startY + 35;
  }
};

/**
 * Menerapkan footer halaman (nomor halaman, tanggal cetak, dan garis tepi) pada setiap halaman PDF
 */
const applyPageFooters = (doc: jsPDF, documentTitle: string) => {
  const pageCount = doc.getNumberOfPages();
  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const footerY = pageHeight - 8;

    // Garis tipis pembatas footer
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 3, pageWidth - marginX, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // Slate-500

    // Sisi Kiri: Metadata Cetak
    doc.text(`${documentTitle} | Dicetak pada: ${printDateStr}`, marginX, footerY);

    // Sisi Kanan: Nomor Halaman "Halaman X dari Y"
    const pageStr = `Halaman ${i} dari ${pageCount}`;
    doc.text(pageStr, pageWidth - marginX, footerY, { align: 'right' });
  }
};

/**
 * Helper untuk menggambar Header Sub-Seksi (Badge Pill Modern)
 */
const drawSectionHeader = (doc: jsPDF, title: string, marginX: number, y: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - marginX * 2;
  const boxHeight = 6.5;

  // Background Box Soft Indigo
  doc.setFillColor(238, 242, 255); // Indigo-50
  doc.roundedRect(marginX, y - 4.5, boxWidth, boxHeight, 1.2, 1.2, 'F');

  // Strip Akses Kiri Indigo Bold
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(marginX, y - 4.5, 2.5, boxHeight, 'F');

  // Teks Judul Seksi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 27, 75); // Indigo-950
  doc.text(title.toUpperCase(), marginX + 5, y, { align: 'left' });

  return y + 5;
};

/**
 * Hook autoTable untuk mewarnai badge predikat, status, dan persentase secara otomatis
 */
const applyModernTableStyles = (data: any) => {
  if (data.section === 'body') {
    const rawVal = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text || '');
    const text = rawVal.trim();

    if (!text || text === '-') return;

    // Predikat & Status Keterangan
    if (text.includes('Sangat Baik') || text.includes('Tuntas - Sangat Memuaskan') || text === 'Lengkap' || text === 'Aktif') {
      data.cell.styles.fillColor = [220, 252, 231]; // Soft Emerald
      data.cell.styles.textColor = [22, 101, 52];   // Dark Green
      data.cell.styles.fontStyle = 'bold';
    } else if (text.includes('Baik') || text.includes('Tuntas - Memuaskan') || text === 'Prestasi / Keaktifan') {
      data.cell.styles.fillColor = [224, 242, 254]; // Soft Sky Blue
      data.cell.styles.textColor = [3, 105, 161];   // Dark Blue
      data.cell.styles.fontStyle = 'bold';
    } else if (text.includes('Cukup') || text.includes('Tuntas - Cukup') || text === 'Informasi') {
      data.cell.styles.fillColor = [254, 243, 199]; // Soft Amber
      data.cell.styles.textColor = [180, 83, 9];    // Dark Amber
      data.cell.styles.fontStyle = 'bold';
    } else if (text.includes('Kurang') || text.includes('Perlu') || text.includes('Tidak Hadir') || text === 'Catatan Perhatian') {
      data.cell.styles.fillColor = [254, 226, 226]; // Soft Rose
      data.cell.styles.textColor = [159, 18, 57];   // Dark Rose
      data.cell.styles.fontStyle = 'bold';
    }

    // Highlighting Nilai Akhir / Rata-rata Tinggi (>= 88)
    if (/^\d+(\.\d+)?$/.test(text)) {
      const num = parseFloat(text);
      if (num >= 88) {
        data.cell.styles.textColor = [30, 27, 75];
        data.cell.styles.fontStyle = 'bold';
      }
    }

    // Highlighting Persentase (%)
    if (text.endsWith('%')) {
      const num = parseFloat(text.replace('%', ''));
      if (!isNaN(num)) {
        if (num >= 90) {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        } else if (num < 80) {
          data.cell.styles.textColor = [159, 18, 57];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  }
};

/**
 * FUNGSI UTAMA: generatePDF(params)
 * Menghasilkan file PDF siap unduh langsung secara spasial & skalar.
 */
export const generatePDF = async (params: PDFGeneratorParams): Promise<string> => {
  const { reportType, config: rawConfig } = params;

  // Preprocess logos and signatures to ensure Google Drive URLs or remote images are converted to base64 Data URLs
  const logoKiri = rawConfig.logoKiri ? await ensureDataUrl(rawConfig.logoKiri) : null;
  const logoKanan = rawConfig.logoKanan ? await ensureDataUrl(rawConfig.logoKanan) : null;
  const customParafImg = rawConfig.customParafImg ? await ensureDataUrl(rawConfig.customParafImg) : null;

  const config: PDFReportConfig = {
    ...rawConfig,
    logoKiri,
    logoKanan,
    customParafImg
  };
  
  // Tentukan Orientasi Dokumen (Landscape untuk Rekap Kolektif & TIK; Portrait untuk Rapor Individual & Jurnal)
  const isLandscape = config.orientation 
    ? config.orientation === 'landscape'
    : (reportType === 'collective' || reportType === 'extra_tik');

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  let docTitleForFooter = 'Laporan LHK';

  // =========================================================================
  // TYPE 1: REKAP KOLEKTIF (COLLECTIVE REPORT)
  // =========================================================================
  if (reportType === 'collective') {
    docTitleForFooter = 'Laporan Rekapitulasi Kolektif';
    let y = drawKopSurat(doc, config, pageWidth, 10);

    const contentWidth = pageWidth - marginX * 2;

    // Judul Dokumen
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('LAPORAN PERKEMBANGAN BELAJAR DAN ABSENSI KOLEKTIF', pageWidth / 2, y, { align: 'center' });

    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const subTitle = `KELAS: ${(config.activeClassName || 'I').toUpperCase()}  |  SEMESTER: ${config.semester || 'Ganjil'}  |  TAHUN AJARAN: ${config.academicYear || '2026/2027'}`;
    doc.text(subTitle, pageWidth / 2, y, { align: 'center' });

    y += 7;

    const students = params.students || [];
    const recapMap = new Map((params.recap || []).map(r => [r.nis, r]));
    const formativeGrades = params.formativeGrades || [];
    const summativeGrades = params.summativeGrades || [];
    const notes = params.notes || [];

    const incAttendance = params.includeAttendance !== undefined ? params.includeAttendance : true;
    const incGrades = params.includeGrades !== undefined ? params.includeGrades : true;
    const incNotes = params.includeNotes !== undefined ? params.includeNotes : true;
    const hasAny = incAttendance || incGrades || incNotes;
    const showAttendance = incAttendance || !hasAny;
    const showGrades = incGrades;
    const showNotes = incNotes;

    const toRoman = (num: number) => {
      const romans = ['I', 'II', 'III', 'IV', 'V'];
      return romans[num - 1] || `${num}`;
    };
    let collectiveSecCount = 1;

    // Helper untuk menggambar Badge Section Header
    const drawSectionBadge = (badgeTitle: string, startY: number): number => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const textW = doc.getTextWidth(badgeTitle);
      const boxW = textW + 8;
      const boxH = 6;
      doc.setFillColor(238, 242, 255); // Soft Indigo (Indigo-50)
      doc.setDrawColor(224, 231, 255); // Indigo-100
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, startY, boxW, boxH, 1.5, 1.5, 'FD');
      doc.setTextColor(30, 27, 75); // Indigo-950
      doc.text(badgeTitle, marginX + 4, startY + 4.2);
      return startY + boxH + 3.5;
    };

    const fontSizeTable = pageWidth > 250 ? 7.5 : 6.5;

    // -------------------------------------------------------------------------
    // SEKSI PRESENSI / KEHADIRAN SISWA
    // -------------------------------------------------------------------------
    if (showAttendance) {
      const secTitle = `${toRoman(collectiveSecCount++)}. REKAPITULASI PRESENSI / KEHADIRAN SISWA`;
      y = drawSectionBadge(secTitle, y);

      const attendanceRows = students.map((std, idx) => {
        const r = recapMap.get(std.nis);
        const stdAbs = (params.attendance || []).filter(a => a.nis === std.nis);
        const hadir = r?.hadir ?? stdAbs.filter(a => a.status === 'Hadir').length;
        const sakit = r?.sakit ?? stdAbs.filter(a => a.status === 'Sakit').length;
        const izin = r?.izin ?? stdAbs.filter(a => a.status === 'Izin').length;
        const alfa = r?.alfa ?? stdAbs.filter(a => a.status === 'Alfa').length;
        const terlambat = r?.terlambatCount ?? stdAbs.filter(a => (a.terlambat && a.terlambat > 0) || a.keterangan?.toLowerCase().includes('terlambat')).length;
        
        const pctVal = r?.persentaseKehadiran ?? (stdAbs.length > 0 ? hadir / stdAbs.length : 1);
        const pctStr = `${(pctVal * (pctVal <= 1 ? 100 : 1)).toFixed(0)}%`;

        return [
          (idx + 1).toString(),
          std.nis || '-',
          std.nama || '-',
          std.jenisKelamin || 'L',
          hadir.toString(),
          sakit.toString(),
          izin.toString(),
          alfa.toString(),
          `${terlambat}x`,
          pctStr
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [
          ['NO', 'NIS', 'NAMA LENGKAP MURID', 'L/P', 'HADIR', 'SAKIT', 'IZIN', 'ALFA', 'TERLAMBAT', 'KEHADIRAN']
        ],
        body: attendanceRows,
        theme: 'grid',
        styles: {
          fontSize: fontSizeTable,
          cellPadding: 2,
          valign: 'middle',
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [224, 231, 255], // Soft Indigo (Indigo-100)
          textColor: [30, 27, 75],    // Indigo-950
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: contentWidth * 0.04 },
          1: { halign: 'center', cellWidth: contentWidth * 0.08 },
          2: { halign: 'left', cellWidth: contentWidth * 0.36 },
          3: { halign: 'center', cellWidth: contentWidth * 0.05 },
          4: { halign: 'center', cellWidth: contentWidth * 0.07 },
          5: { halign: 'center', cellWidth: contentWidth * 0.07 },
          6: { halign: 'center', cellWidth: contentWidth * 0.07 },
          7: { halign: 'center', cellWidth: contentWidth * 0.07 },
          8: { halign: 'center', cellWidth: contentWidth * 0.08 },
          9: { halign: 'center', cellWidth: contentWidth * 0.11 }
        },
        didParseCell: (data) => {
          if (data.section === 'head') {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.textColor = [30, 27, 75];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.section === 'body') {
            const colIdx = data.column.index;
            if (colIdx === 0) {
              data.cell.styles.textColor = [100, 116, 139];
            } else if (colIdx === 1) {
              data.cell.styles.textColor = [51, 65, 85];
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 2) {
              data.cell.styles.textColor = [15, 23, 42];
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 3) {
              data.cell.styles.textColor = [71, 85, 105];
            } else if (colIdx === 4) { // HADIR
              data.cell.styles.fillColor = [236, 253, 245]; // Emerald-50
              data.cell.styles.textColor = [4, 120, 87];    // Emerald-700
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 5) { // SAKIT
              data.cell.styles.fillColor = [240, 249, 255]; // Sky-50
              data.cell.styles.textColor = [3, 105, 161];   // Sky-700
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 6) { // IZIN
              data.cell.styles.fillColor = [254, 243, 199]; // Amber-50
              data.cell.styles.textColor = [180, 83, 9];    // Amber-700
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 7) { // ALFA
              data.cell.styles.fillColor = [255, 241, 242]; // Rose-50
              data.cell.styles.textColor = [225, 29, 72];   // Rose-600
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 8) { // TERLAMBAT
              data.cell.styles.textColor = [100, 116, 139];
            } else if (colIdx === 9) { // KEHADIRAN
              data.cell.styles.fillColor = [248, 250, 252];
              data.cell.styles.textColor = [67, 56, 202];   // Indigo-700
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: marginX, right: marginX, top: 18, bottom: 18 },
        showHead: 'everyPage'
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // -------------------------------------------------------------------------
    // SEKSI TRANSKRIP NILAI AKADEMIK SISWA (RATA-RATA FORMATIF & SUMATIF)
    // -------------------------------------------------------------------------
    if (showGrades) {
      if (showAttendance && y + 35 > pageHeight - 20) {
        doc.addPage();
        y = 15;
      }

      const secTitle = `${toRoman(collectiveSecCount++)}. TRANSKRIP NILAI AKADEMIK SISWA (RATA-RATA FORMATIF & SUMATIF)`;
      y = drawSectionBadge(secTitle, y);

      const gradeRows = students.map((std, idx) => {
        const f = formativeGrades.find(g => g.nis === std.nis);
        const sum = summativeGrades.find(g => g.nis === std.nis);

        const fAvg = f
          ? (f.rataRata !== null && !isNaN(f.rataRata) && f.rataRata > 0 ? f.rataRata : calculateAvg((params.formativeCols || []).map(c => f[c.key])))
          : 0;

        const sumAvg = sum
          ? (sum.rataRata !== null && !isNaN(sum.rataRata) && sum.rataRata > 0 ? sum.rataRata : calculateAvg((params.summativeCols || []).map(c => sum[c.key])))
          : 0;

        const finalScore = (fAvg > 0 && sumAvg > 0) ? parseFloat(((fAvg + sumAvg) / 2).toFixed(1)) : (fAvg || sumAvg || 0);

        let predikat = 'Belum Berpartisipasi';
        if (finalScore >= 85) predikat = 'SANGAT BAIK (A)';
        else if (finalScore >= 75) predikat = 'BAIK (B)';
        else if (finalScore >= 65) predikat = 'CUKUP (C)';
        else if (finalScore > 0) predikat = 'PERLU BIMBINGAN (D)';

        return [
          (idx + 1).toString(),
          std.nis || '-',
          std.nama || '-',
          fAvg > 0 ? fAvg.toString() : '-',
          sumAvg > 0 ? sumAvg.toString() : '-',
          finalScore > 0 ? finalScore.toString() : '-',
          predikat
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [
          ['NO', 'NIS', 'NAMA LENGKAP MURID', 'FORMATIF (F)', 'SUMATIF (S)', 'NILAI AKHIR', 'PREDIKAT KELULUSAN']
        ],
        body: gradeRows,
        theme: 'grid',
        styles: {
          fontSize: fontSizeTable,
          cellPadding: 2,
          valign: 'middle',
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [224, 231, 255], // Soft Indigo
          textColor: [30, 27, 75],    // Indigo-950
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: contentWidth * 0.04 },
          1: { halign: 'center', cellWidth: contentWidth * 0.09 },
          2: { halign: 'left', cellWidth: contentWidth * 0.37 },
          3: { halign: 'center', cellWidth: contentWidth * 0.11 },
          4: { halign: 'center', cellWidth: contentWidth * 0.11 },
          5: { halign: 'center', cellWidth: contentWidth * 0.11 },
          6: { halign: 'left', cellWidth: contentWidth * 0.17 }
        },
        didParseCell: (data) => {
          if (data.section === 'head') {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.textColor = [30, 27, 75];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.section === 'body') {
            const colIdx = data.column.index;
            if (colIdx === 0) {
              data.cell.styles.textColor = [100, 116, 139];
            } else if (colIdx === 1) {
              data.cell.styles.textColor = [51, 65, 85];
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 2) {
              data.cell.styles.textColor = [15, 23, 42];
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 3 || colIdx === 4) {
              data.cell.styles.textColor = [30, 41, 59];
            } else if (colIdx === 5) { // NILAI AKHIR
              data.cell.styles.fillColor = [248, 250, 252];
              data.cell.styles.textColor = [49, 46, 129]; // Indigo-900
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 6) { // PREDIKAT
              const predVal = data.cell.raw as string;
              if (predVal.startsWith('SANGAT')) {
                data.cell.styles.textColor = [4, 120, 87];   // Emerald-700
                data.cell.styles.fontStyle = 'bold';
              } else if (predVal.startsWith('BAIK')) {
                data.cell.styles.textColor = [67, 56, 202];  // Indigo-700
                data.cell.styles.fontStyle = 'bold';
              } else if (predVal.startsWith('CUKUP')) {
                data.cell.styles.textColor = [180, 83, 9];   // Amber-700
                data.cell.styles.fontStyle = 'bold';
              } else if (predVal.startsWith('PERLU')) {
                data.cell.styles.textColor = [225, 29, 72];  // Rose-600
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [148, 163, 184];
              }
            }
          }
        },
        margin: { left: marginX, right: marginX, top: 18, bottom: notes.length > 0 ? 18 : 65 },
        showHead: 'everyPage'
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // -------------------------------------------------------------------------
    // SEKSI JURNAL INSIDENSIAL & CATATAN PERILAKU SISWA (Jika ada & dipilih)
    // -------------------------------------------------------------------------
    if (showNotes && notes.length > 0) {
      const sigHeightNeeded = 45;
      const sectionIIINeeded = Math.max(25, notes.length * 10 + 18);
      const totalNeeded = sectionIIINeeded + sigHeightNeeded + 6;

      if (y + totalNeeded > pageHeight - 15) {
        doc.addPage();
        y = 15;
      }

      const secTitle = `${toRoman(collectiveSecCount++)}. JURNAL INSIDENSIAL & CATATAN PERILAKU SISWA`;
      y = drawSectionBadge(secTitle, y);

      const noteRows = notes.map((n) => [
        n.tanggal || '-',
        n.nama || '-',
        n.tipe === 'aktif' ? 'PRESTASI / KEAKTIFAN' : 'CATATAN PERHATIAN',
        `"${n.catatan || '-'}"`
      ]);

      autoTable(doc, {
        startY: y,
        head: [
          ['TANGGAL', 'NAMA MURID', 'TIPE PERILAKU', 'CATATAN OBSERVASI GURU']
        ],
        body: noteRows,
        theme: 'grid',
        styles: {
          fontSize: fontSizeTable,
          cellPadding: 2,
          valign: 'middle',
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [224, 231, 255],
          textColor: [30, 27, 75],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: contentWidth * 0.12 },
          1: { halign: 'left', cellWidth: contentWidth * 0.28 },
          2: { halign: 'center', cellWidth: contentWidth * 0.16 },
          3: { halign: 'left', cellWidth: contentWidth * 0.44 }
        },
        didParseCell: (data) => {
          if (data.section === 'head') {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.textColor = [30, 27, 75];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.section === 'body') {
            const colIdx = data.column.index;
            if (colIdx === 0) {
              data.cell.styles.textColor = [100, 116, 139];
            } else if (colIdx === 1) {
              data.cell.styles.textColor = [15, 23, 42];
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 2) {
              const typeStr = data.cell.raw as string;
              if (typeStr.includes('PRESTASI')) {
                data.cell.styles.fillColor = [236, 253, 245];
                data.cell.styles.textColor = [4, 120, 87];
              } else {
                data.cell.styles.fillColor = [255, 241, 242];
                data.cell.styles.textColor = [225, 29, 72];
              }
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === 3) {
              data.cell.styles.textColor = [71, 85, 105];
              data.cell.styles.fontStyle = 'italic';
            }
          }
        },
        margin: { left: marginX, right: marginX, top: 18, bottom: 15 },
        showHead: 'everyPage'
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Cek sisa ruang halaman sebelum menggambar Tanda Tangan
    let sigY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : y + 4;
    if (sigY + 35 > pageHeight - 15) {
      doc.addPage();
      sigY = 18;
    }

    drawSignatures(doc, config, pageWidth, sigY, 2);
  }

  // =========================================================================
  // TYPE 2: RAPOR INDIVIDUAL SISWA (INDIVIDUAL RAPOR)
  // =========================================================================
  else if (reportType === 'individual') {
    docTitleForFooter = 'Rapor Hasil Belajar Individual';

    const allStudents = params.students || [];
    const selectedNis = params.selectedStudentNis || 'all';

    const incAttendance = params.includeAttendance !== undefined ? params.includeAttendance : true;
    const incGrades = params.includeGrades !== undefined ? params.includeGrades : true;
    const incNotes = params.includeNotes !== undefined ? params.includeNotes : true;
    const hasAny = incAttendance || incGrades || incNotes;
    const showAttendance = incAttendance || !hasAny;
    const showGrades = incGrades;
    const showNotes = incNotes;

    const toRoman = (num: number) => {
      const romans = ['I', 'II', 'III', 'IV', 'V'];
      return romans[num - 1] || `${num}`;
    };
    
    const targetStudents = selectedNis === 'all' 
      ? allStudents 
      : allStudents.filter(s => s.nis === selectedNis);

    if (targetStudents.length === 0) {
      doc.setFontSize(12);
      doc.text('Tidak ada data siswa yang dipilih.', marginX, 30);
    }

    for (let sIdx = 0; sIdx < targetStudents.length; sIdx++) {
      if (sIdx > 0) doc.addPage();

      const std = targetStudents[sIdx];
      let y = drawKopSurat(doc, config, pageWidth, 10);

      // Judul Dokumen
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('RAPOR RESULT & PERKEMBANGAN BELAJAR SISWA', pageWidth / 2, y, { align: 'center' });

      y += 6;

      // Box Identitas Siswa Modern dengan Accent Strip Indigo
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, y, pageWidth - marginX * 2, 22, 2, 2, 'FD');

      // Strip Akses Kiri Card Box
      doc.setFillColor(79, 70, 229); // Indigo-600
      doc.rect(marginX, y, 2.5, 22, 'F');

      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      const col1X = marginX + 6;
      const col2X = marginX + (pageWidth - marginX * 2) / 2 + 6;

      doc.setFont('helvetica', 'bold');
      doc.text(`NAMA LENGKAP`, col1X, y + 5);
      doc.text(`: ${std.nama}`, col1X + 32, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.text(`NO. INDUK (NIS)`, col1X, y + 10);
      doc.setFont('helvetica', 'normal');
      doc.text(`: ${std.nis || '-'}`, col1X + 32, y + 10);

      doc.setFont('helvetica', 'bold');
      doc.text(`JENIS KELAMIN`, col1X, y + 15);
      doc.setFont('helvetica', 'normal');
      doc.text(`: ${std.jenisKelamin === 'L' ? 'Laki-Laki (L)' : 'Perempuan (P)'}`, col1X + 32, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.text(`KELAS / ROSTER`, col2X, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(`: ${config.activeClassName || std.kelas || '-'}`, col2X + 32, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.text(`SEMESTER`, col2X, y + 10);
      doc.setFont('helvetica', 'normal');
      doc.text(`: ${config.semester || 'Semester Ganjil (1)'}`, col2X + 32, y + 10);

      doc.setFont('helvetica', 'bold');
      doc.text(`TAHUN AJARAN`, col2X, y + 15);
      doc.setFont('helvetica', 'normal');
      doc.text(`: ${config.academicYear || '2026/2027'}`, col2X + 32, y + 15);

      y += 28;

      let indSecCount = 1;

      // =========================================================================
      // SEKSI REKAPITULASI PRESENSI / KEHADIRAN INDIVIDUAL
      // =========================================================================
      if (showAttendance) {
        const stdRecap = (params.recap || []).find(r => r.nis === std.nis) || {
          hadir: 0, sakit: 0, izin: 0, alfa: 0, persentaseKehadiran: 0
        };

        const secTitle = `${toRoman(indSecCount++)}. REKAPITULASI PRESENSI / KEHADIRAN INDIVIDUAL`;
        y = drawSectionHeader(doc, secTitle, marginX, y);

        // Stat Cards Grid: 4 Cards
        const cardWidth = (pageWidth - marginX * 2 - 9) / 4; // 3 gaps of 3mm
        const cardHeight = 15;
        const cardY = y;

        const statData = [
          { label: 'HADIR', val: `${stdRecap.hadir}`, bg: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] },
          { label: 'SAKIT', val: `${stdRecap.sakit}`, bg: [240, 249, 255], border: [186, 230, 253], text: [3, 105, 161] },
          { label: 'IZIN', val: `${stdRecap.izin}`, bg: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] },
          { label: 'ALFA', val: `${stdRecap.alfa}`, bg: [255, 241, 242], border: [254, 205, 211], text: [225, 29, 72] }
        ];

        statData.forEach((st, idx) => {
          const cX = marginX + idx * (cardWidth + 3);
          doc.setFillColor(st.bg[0], st.bg[1], st.bg[2]);
          doc.setDrawColor(st.border[0], st.border[1], st.border[2]);
          doc.setLineWidth(0.3);
          doc.roundedRect(cX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(st.text[0], st.text[1], st.text[2]);
          doc.text(st.label, cX + cardWidth / 2, cardY + 3.5, { align: 'center' });

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(st.val, cX + cardWidth / 2, cardY + 9, { align: 'center' });

          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.text('Hari', cX + cardWidth / 2, cardY + 13, { align: 'center' });
        });

        y += cardHeight + 3;

        // Cumulative Attendance Box
        doc.setFillColor(238, 242, 255); // Indigo-50
        doc.setDrawColor(224, 231, 255);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 8.5, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text('Persentase Tingkat Kehadiran Kumulatif:', marginX + 4, y + 5.5);

        const totalAbsen = stdRecap.hadir + stdRecap.sakit + stdRecap.izin + stdRecap.alfa;
        const pctVal = typeof stdRecap.persentaseKehadiran === 'number' ? stdRecap.persentaseKehadiran : 0;
        const pctStr = `${(pctVal * (pctVal <= 1 ? 100 : 1)).toFixed(0)}%`;

        let badgeText = 'BELUM ADA DATA';
        let badgeBg = [241, 245, 249];
        let badgeBorder = [226, 232, 240];
        let badgeColor = [71, 85, 105];

        if (totalAbsen > 0) {
          if (pctVal >= 0.95 || (pctVal > 1 && pctVal >= 95)) {
            badgeText = 'SANGAT MEMUASKAN';
            badgeBg = [236, 253, 245];
            badgeBorder = [167, 243, 208];
            badgeColor = [4, 120, 87];
          } else if (pctVal >= 0.85 || (pctVal > 1 && pctVal >= 85)) {
            badgeText = 'CUKUP';
            badgeBg = [254, 243, 199];
            badgeBorder = [253, 230, 138];
            badgeColor = [180, 83, 9];
          } else {
            badgeText = 'PERINGATAN ABSEN';
            badgeBg = [255, 241, 242];
            badgeBorder = [254, 205, 211];
            badgeColor = [225, 29, 72];
          }
        }

        // Render Percentage text & Badge on right
        const rightX = pageWidth - marginX - 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(67, 56, 202); // Indigo-700
        doc.text(pctStr, rightX - 38, y + 5.8, { align: 'right' });

        // Badge Pill
        doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
        doc.setDrawColor(badgeBorder[0], badgeBorder[1], badgeBorder[2]);
        doc.roundedRect(rightX - 35, y + 1.8, 35, 5, 1, 1, 'FD');

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.text(badgeText, rightX - 17.5, y + 5.2, { align: 'center' });

        y += 13;
      }

      // =========================================================================
      // SEKSI CAPAIAN NILAI AKADEMIK & KOMPETENSI (NILAI AKHIR)
      // =========================================================================
      if (showGrades) {
        const secTitle = `${toRoman(indSecCount++)}. CAPAIAN NILAI AKADEMIK & KOMPETENSI (NILAI AKHIR)`;
        y = drawSectionHeader(doc, secTitle, marginX, y);

        const fRec = (params.formativeGrades || []).find(g => g.nis === std.nis);
        const sumRec = (params.summativeGrades || []).find(g => g.nis === std.nis);
        const attRec = (params.attitudeGrades || []).find(g => g.nis === std.nis);
        const formativeCols = params.formativeCols || [];
        const summativeCols = params.summativeCols || [];
        const gradeWeights = params.gradeWeights || DEFAULT_GRADE_WEIGHTS;

        const breakdown = calculateStudentGradeBreakdown(
          std,
          fRec,
          sumRec,
          formativeCols,
          summativeCols,
          gradeWeights,
          attRec,
          params.notes || [],
          params.recap || [],
          params.attendance || []
        );

        const w = breakdown.weights;

        // Nilai Akhir Components Table
        const naHeadCols = ['NO', 'KOMPONEN PENILAIAN', 'BOBOT', 'NILAI MURNI', 'NILAI TERBOBOT', 'KETERANGAN CAPAIAN'];
        const naBodyRows = [
          [
            '1',
            'Penilaian Formatif (Tugas / Latihan Harian / Kuis)',
            `${w.formatif}%`,
            breakdown.formatifAvg > 0 ? `${breakdown.formatifAvg}` : '-',
            breakdown.formatifWeighted > 0 ? `${breakdown.formatifWeighted}` : '-',
            'Capaian Pembelajaran Harian'
          ],
          [
            '2',
            'Penilaian Sumatif (Lingkup Materi / STS)',
            `${w.sumatif}%`,
            breakdown.sumatifAvg > 0 ? `${breakdown.sumatifAvg}` : '-',
            breakdown.sumatifWeighted > 0 ? `${breakdown.sumatifWeighted}` : '-',
            'Pemahaman Materi & STS'
          ],
          [
            '3',
            'Ujian Akhir Semester (UAS / SAS)',
            `${w.uas}%`,
            breakdown.uasScore > 0 ? `${breakdown.uasScore}` : '-',
            breakdown.uasWeighted > 0 ? `${breakdown.uasWeighted}` : '-',
            'Evaluasi Akhir Semester'
          ],
          [
            '4',
            'Penilaian Sikap & Karakter (Observasi / Presensi)',
            `${w.sikap}%`,
            breakdown.sikapScore > 0 ? `${breakdown.sikapScore}` : '-',
            breakdown.sikapWeighted > 0 ? `${breakdown.sikapWeighted}` : '-',
            'Observasi Budi Pekerti & Sikap'
          ]
        ];

        autoTable(doc, {
          startY: y,
          head: [naHeadCols],
          body: naBodyRows,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2.2, valign: 'middle', lineColor: [226, 232, 240] },
          headStyles: { fillColor: [238, 242, 255], textColor: [30, 27, 75], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
            2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
            3: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
            4: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
            5: { halign: 'left', cellWidth: 36 }
          },
          didParseCell: (data) => {
            if (data.section === 'body') {
              if (data.column.index === 4) {
                data.cell.styles.fillColor = [240, 249, 255];
                data.cell.styles.textColor = [3, 105, 161];
              }
            }
          },
          margin: { left: marginX, right: marginX }
        });

        y = (doc as any).lastAutoTable.finalY + 4;

        // Summary Card: Nilai Akhir Rapor & Kualifikasi Predikat
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 13, 2, 2, 'FD');

        // Left Box: Nilai Akhir
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text('NILAI AKHIR (KOMPOSIT FORMATIF, SUMATIF, UAS, SIKAP)', marginX + 5, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(49, 46, 129); // Indigo-900
        doc.text(breakdown.nilaiAkhir > 0 ? `${breakdown.nilaiAkhir}` : '-', marginX + 5, y + 10);

        // Right Box: Kualifikasi & Predikat
        const predX = pageWidth - marginX - 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`PREDIKAT & STATUS: ${breakdown.status.toUpperCase()}`, predX, y + 4.5, { align: 'right' });

        let predColor = [100, 116, 139];
        if (breakdown.nilaiAkhir >= 85) {
          predColor = [4, 120, 87];
        } else if (breakdown.nilaiAkhir >= 75) {
          predColor = [67, 56, 202];
        } else if (breakdown.nilaiAkhir >= 65) {
          predColor = [180, 83, 9];
        } else if (breakdown.nilaiAkhir > 0) {
          predColor = [225, 29, 72];
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(predColor[0], predColor[1], predColor[2]);
        doc.text(breakdown.predikatLengkap, predX, y + 9.5, { align: 'right' });

        y += 16;

        // Capaian Deskripsi Kompetensi
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 10, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Deskripsi Capaian Kompetensi:', marginX + 3, y + 3.8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        const splitDeskripsi = doc.splitTextToSize(breakdown.deskripsiKompetensi, pageWidth - marginX * 2 - 42);
        doc.text(splitDeskripsi, marginX + 38, y + 3.8);

        y += 14;
      }

      // =========================================================================
      // SEKSI CATATAN PERILAKU DAN SIKAP
      // =========================================================================
      if (showNotes) {
        const stdNotes = (params.notes || []).filter(n => n.nis === std.nis);
        
        // Hitung kebutuhan tinggi untuk Seksi Catatan + Tanda Tangan 3 Kolom agar tidak pernah ada halaman kosong berisi hanya tanda tangan
        const sigHeightNeeded = 35;
        const sectionIIINeeded = stdNotes.length === 0 ? 18 : 25;
        const totalSpaceNeeded = sectionIIINeeded + sigHeightNeeded + 5;

        if (y + totalSpaceNeeded > pageHeight - 15) {
          doc.addPage();
          y = 18;
        }

        const secTitle = `${toRoman(indSecCount++)}. CATATAN PERILAKU DAN CATATAN SIKAP DARI GURU MATA PELAJARAN`;
        y = drawSectionHeader(doc, secTitle, marginX, y);

        if (stdNotes.length === 0) {
          const defaultNote = 'Murid yang bersangkutan selalu menunjukkan perilaku teladan, budi pekerti yang luhur, sopan santun yang tinggi, serta tingkat kepatuhan dan kerja sama yang sangat baik dalam seluruh aktivitas kelas sepanjang periode semester berjalan.';
          
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.roundedRect(marginX, y, pageWidth - marginX * 2, 12, 2, 2, 'FD');

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          const splitText = doc.splitTextToSize(`"${defaultNote}"`, pageWidth - marginX * 2 - 8);
          doc.text(splitText, marginX + 4, y + 4.5);

          y += 18;
        } else {
          const noteRows = stdNotes.map(n => [
            n.tanggal || '-',
            n.tipe === 'aktif' ? 'Prestasi / Keaktifan' : 'Catatan Perhatian',
            `"${n.catatan || '-'}"`
          ]);

          autoTable(doc, {
            startY: y,
            head: [['Tanggal', 'Kategori', 'Uraian Catatan Perilaku & Perkembangan']],
            body: noteRows,
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
            headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
              0: { halign: 'center', cellWidth: 25 },
              1: { halign: 'center', cellWidth: 35, fontStyle: 'bold' },
              2: { halign: 'left', fontStyle: 'italic' }
            },
            didParseCell: applyModernTableStyles,
            margin: { left: marginX, right: marginX, top: 18, bottom: 15 }
          });

          y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : y + 25;
        }
      }

      // Cek sisa ruang halaman sebelum Tanda Tangan 3 Kolom
      let sigY = y;
      if (sigY + 35 > pageHeight - 15) {
        doc.addPage();
        sigY = 18;
      }

      drawSignatures(doc, config, pageWidth, sigY, 3);
    }
  }

  // =========================================================================
  // TYPE 3: JURNAL HARIAN KEGIATAN PEMBELAJARAN
  // =========================================================================
  else if (reportType === 'journal') {
    docTitleForFooter = 'Jurnal Harian Pembelajaran';
    let y = drawKopSurat(doc, config, pageWidth, 10);

    const contentWidth = pageWidth - marginX * 2;

    // Judul Dokumen
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('LAPORAN JURNAL KEGIATAN PEMBELAJARAN DAN ABSENSI HARIAN', pageWidth / 2, y, { align: 'center' });

    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const subTitle = `KELAS: ${(config.activeClassName || 'I').toUpperCase()}  |  SEMESTER: ${config.semester || 'Ganjil'}  |  TAHUN AJARAN: ${config.academicYear || '2026/2027'}`;
    doc.text(subTitle, pageWidth / 2, y, { align: 'center' });

    y += 7;

    // Badge Section Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const badgeTitle = 'REKAPITULASI CATATAN MENGAJAR GURU';
    const textW = doc.getTextWidth(badgeTitle);
    const boxW = textW + 8;
    const boxH = 6;
    doc.setFillColor(238, 242, 255); // Soft Indigo (Indigo-50)
    doc.setDrawColor(224, 231, 255); // Indigo-100
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, y, boxW, boxH, 1.5, 1.5, 'FD');
    doc.setTextColor(30, 27, 75); // Indigo-950
    doc.text(badgeTitle, marginX + 4, y + 4.2);

    y += boxH + 3.5;

    const journals = params.journals || [];

    const journalRows = journals.length > 0 
      ? journals.map((j, idx) => {
          let formattedDate = j.tanggal || '-';
          if (j.tanggal) {
            try {
              const d = new Date(j.tanggal);
              if (!isNaN(d.getTime())) {
                formattedDate = d.toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
              }
            } catch (e) {
              formattedDate = j.tanggal;
            }
          }

          const jamStr = Array.isArray(j.jamPelajaran) ? j.jamPelajaran.join(', ') : (j.jamPelajaran || '-');
          
          let materiStr = j.materi || '-';
          if (j.adaTugas && j.deskripsiTugas) {
            materiStr += `\n📌 PR/Tugas: ${j.deskripsiTugas}`;
          }

          let absentStr = '✓ Nihil / Semua Hadir';
          if (j.tidakHadirSnapshot && j.tidakHadirSnapshot.length > 0) {
            absentStr = j.tidakHadirSnapshot.map(s => `[${(s.status || 'Alfa')[0]}] ${s.nama}`).join('\n');
          }

          let notesStr = j.catatan || '-';
          if (j.hambatan) {
            notesStr += `\n⚠️ Hambatan: ${j.hambatan}${j.solusi ? ` (Solusi: ${j.solusi})` : ''}`;
          }
          if (j.catatanSiswaSnapshot && j.catatanSiswaSnapshot.length > 0) {
            const studentNotes = j.catatanSiswaSnapshot.map(sn => `[${sn.tipe}] ${sn.nama}: "${sn.catatan}"`).join('\n');
            notesStr += `\n${studentNotes}`;
          }

          return [
            (idx + 1).toString(),
            formattedDate,
            jamStr,
            materiStr,
            absentStr,
            notesStr,
            ''
          ];
        })
      : [
          [
            '1',
            'Sel, 4 Agu 2026',
            '3, 4',
            'sistem komputer mengenai perubahan bilangan desimal ke biner',
            '✓ Nihil / Semua Hadir',
            'pmebelajaran saudh bagus dan ini masih uji coba',
            ''
          ]
        ];

    autoTable(doc, {
      startY: y,
      head: [
        ['NO', 'HARI, TANGGAL', 'JAM KE-', 'MATERI & TUGAS PEMBELAJARAN', 'SISWA TIDAK HADIR', 'CATATAN / KENDALA / PRESTASI', 'PARAF']
      ],
      body: journalRows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        valign: 'middle',
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [224, 231, 255], // Soft Indigo (Indigo-100)
        textColor: [30, 27, 75],    // Indigo-950
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Slate-50
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: contentWidth * 0.04 },
        1: { halign: 'left', cellWidth: contentWidth * 0.15 },
        2: { halign: 'center', cellWidth: contentWidth * 0.08 },
        3: { halign: 'left', cellWidth: contentWidth * 0.28 },
        4: { halign: 'center', cellWidth: contentWidth * 0.20 },
        5: { halign: 'left', cellWidth: contentWidth * 0.17 },
        6: { halign: 'center', cellWidth: contentWidth * 0.08 }
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.fillColor = [224, 231, 255];
          data.cell.styles.textColor = [30, 27, 75];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.section === 'body') {
          const colIdx = data.column.index;
          if (colIdx === 0) {
            data.cell.styles.textColor = [100, 116, 139];
          } else if (colIdx === 1) {
            data.cell.styles.textColor = [15, 23, 42];
            data.cell.styles.fontStyle = 'bold';
          } else if (colIdx === 2) {
            data.cell.styles.textColor = [67, 56, 202]; // Indigo-700
            data.cell.styles.fontStyle = 'bold';
          } else if (colIdx === 3) {
            data.cell.styles.textColor = [15, 23, 42];
            data.cell.styles.fontStyle = 'bold';
          } else if (colIdx === 4) {
            const valStr = String(data.cell.raw || '');
            if (valStr.includes('Nihil') || valStr.includes('Semua Hadir')) {
              data.cell.styles.fillColor = [236, 253, 245]; // Emerald-50
              data.cell.styles.textColor = [4, 120, 87];    // Emerald-700
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.fillColor = [255, 241, 242]; // Rose-50
              data.cell.styles.textColor = [225, 29, 72];   // Rose-600
              data.cell.styles.fontStyle = 'bold';
            }
          } else if (colIdx === 5) {
            data.cell.styles.textColor = [71, 85, 105];
            data.cell.styles.fontStyle = 'italic';
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const cell = data.cell;
          const boxW = Math.min(cell.width - 2, 15);
          const boxH = Math.min(cell.height - 2, 8.5);
          const boxX = cell.x + (cell.width - boxW) / 2;
          const boxY = cell.y + (cell.height - boxH) / 2;

          if (config.parafMode === 'custom_image' && config.customParafImg) {
            try {
              doc.addImage(config.customParafImg, 'PNG', boxX, boxY, boxW, boxH);
            } catch (e) {
              doc.setFillColor(236, 253, 245);
              doc.setDrawColor(16, 185, 129);
              doc.setLineWidth(0.3);
              doc.roundedRect(boxX, boxY, boxW, boxH, 1, 1, 'FD');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6);
              doc.setTextColor(4, 120, 87);
              doc.text('VALID ✓', boxX + boxW / 2, boxY + 3.2, { align: 'center' });
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(5);
              doc.setTextColor(71, 85, 105);
              doc.text('Guru Mapel', boxX + boxW / 2, boxY + 6.2, { align: 'center' });
            }
          } else {
            doc.setFillColor(236, 253, 245); // Emerald-50
            doc.setDrawColor(16, 185, 129);  // Emerald-500
            doc.setLineWidth(0.3);
            doc.roundedRect(boxX, boxY, boxW, boxH, 1, 1, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(4, 120, 87); // Emerald-700
            doc.text('VALID ✓', boxX + boxW / 2, boxY + 3.2, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.setTextColor(71, 85, 105); // Slate-600
            doc.text('Guru Mapel', boxX + boxW / 2, boxY + 6.2, { align: 'center' });
          }
        }
      },
      margin: { left: marginX, right: marginX, top: 18, bottom: 15 },
      showHead: 'everyPage'
    });

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY : y + 40;

    let sigY = finalY + 8;
    if (sigY + 32 > pageHeight - 15) {
      doc.addPage();
      sigY = 18;
    }

    drawSignatures(doc, config, pageWidth, sigY, 2);
  }

  // =========================================================================
  // TYPE 4: LAPORAN EKSTRAKURIKULER TIK
  // =========================================================================
  else if (reportType === 'extra_tik') {
    docTitleForFooter = 'Laporan Ekstrakurikuler TIK';
    let y = drawKopSurat(doc, config, pageWidth, 10);

    // 1. Pill Badge "LAPORAN RESMI EKSTRAKURIKULER"
    const badgeText = 'LAPORAN RESMI EKSTRAKURIKULER';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const badgeWidth = doc.getTextWidth(badgeText) + 10;
    const badgeX = (pageWidth - badgeWidth) / 2;
    doc.setFillColor(30, 27, 75); // Indigo-950
    doc.roundedRect(badgeX, y, badgeWidth, 5.5, 2.75, 2.75, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, pageWidth / 2, y + 3.8, { align: 'center' });

    y += 9;

    // 2. Judul Utama Dokumen & Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('LAPORAN CAPAIAN & REKAPITULASI EKSTRAKURIKULER TIK', pageWidth / 2, y, { align: 'center' });

    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const subTitle = `SEMESTER: ${config.semester || 'Ganjil'}  |  TAHUN AJARAN: ${config.academicYear || '2026/2027'}  |  STATUS: SEMUA`;
    doc.text(subTitle, pageWidth / 2, y, { align: 'center' });

    y += 7;

    const peserta = params.extraTikPeserta || [];
    const absensiList = params.extraTikAbsensi || [];
    const nilaiList = params.extraTikNilai || [];

    const contentWidth = pageWidth - marginX * 2;

    // 3. Ringkasan KPI Stat Cards (5 Cards)
    const totalPeserta = peserta.length;
    const totalAktif = peserta.filter(p => (p.status || 'Aktif') === 'Aktif').length;

    const hadirPercents: number[] = [];
    const avgNilaiList: number[] = [];

    peserta.forEach(p => {
      const pAbs = absensiList.filter(a => a.nis === p.nis);
      const pNil = nilaiList.find(n => n.nis === p.nis);

      const h = pAbs.filter(a => a.statusKehadiran === 'Hadir').length;
      const totalDays = pAbs.length || 1;
      const pct = pAbs.length > 0 ? Math.round((h / totalDays) * 100) : 100;
      hadirPercents.push(pct);

      const avg = pNil?.rataRata ?? calculateAvg([pNil?.nilaiPraktik, pNil?.nilaiTeori, pNil?.nilaiTugas]);
      if (avg > 0) avgNilaiList.push(avg);
    });

    const avgKehadiran = hadirPercents.length > 0 ? Math.round(hadirPercents.reduce((a, b) => a + b, 0) / hadirPercents.length) : 0;
    const avgNilaiTotal = avgNilaiList.length > 0 ? Math.round(avgNilaiList.reduce((a, b) => a + b, 0) / avgNilaiList.length) : '-';
    const tuntasCount = avgNilaiList.filter(n => n >= 75).length;
    const persenTuntas = avgNilaiList.length > 0 ? Math.round((tuntasCount / avgNilaiList.length) * 100) : 0;

    const cardGap = 2.5;
    const cardWidth = (contentWidth - 4 * cardGap) / 5;
    const cardHeight = 13.5;

    const statCards = [
      {
        label: 'TOTAL PESERTA',
        val: `${totalPeserta} Siswa`,
        bg: [238, 242, 255], border: [199, 210, 254], labelColor: [67, 56, 202], valColor: [30, 27, 75]
      },
      {
        label: 'STATUS AKTIF',
        val: `${totalAktif} Siswa`,
        bg: [236, 253, 245], border: [167, 243, 208], labelColor: [4, 120, 87], valColor: [6, 78, 59]
      },
      {
        label: 'RATA2 KEHADIRAN',
        val: `${avgKehadiran}%`,
        bg: [240, 249, 255], border: [186, 230, 253], labelColor: [3, 105, 161], valColor: [12, 74, 110]
      },
      {
        label: 'RATA2 NILAI TIK',
        val: `${avgNilaiTotal}`,
        bg: [254, 243, 199], border: [253, 230, 138], labelColor: [180, 83, 9], valColor: [120, 53, 15]
      },
      {
        label: 'CAPAIAN (≥75)',
        val: `${persenTuntas}%`,
        bg: [250, 245, 255], border: [233, 213, 255], labelColor: [126, 34, 206], valColor: [88, 28, 135]
      }
    ];

    statCards.forEach((card, idx) => {
      const cX = marginX + idx * (cardWidth + cardGap);
      doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
      doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(cX, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      // Penyesuaian Font Size Otomatis untuk Label agar tidak keluar kotak
      let labelFontSize = 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      let labelW = doc.getTextWidth(card.label);
      if (labelW > cardWidth - 1.5) {
        labelFontSize = Math.max(4.2, (6 * (cardWidth - 1.5)) / labelW);
        doc.setFontSize(labelFontSize);
      }
      doc.setTextColor(card.labelColor[0], card.labelColor[1], card.labelColor[2]);
      doc.text(card.label, cX + cardWidth / 2, y + 4.5, { align: 'center' });

      // Penyesuaian Font Size Otomatis untuk Nilai/Angka
      let valFontSize = 9.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valFontSize);
      let valW = doc.getTextWidth(card.val);
      if (valW > cardWidth - 1.5) {
        valFontSize = Math.max(5.5, (9.5 * (cardWidth - 1.5)) / valW);
        doc.setFontSize(valFontSize);
      }
      doc.setTextColor(card.valColor[0], card.valColor[1], card.valColor[2]);
      doc.text(card.val, cX + cardWidth / 2, y + 10.2, { align: 'center' });
    });

    y += cardHeight + 5;

    // 4. Data Tabel Peserta Ekstrakurikuler TIK
    const tikRows = peserta.map((p, idx) => {
      const pAbs = absensiList.filter(a => a.nis === p.nis);
      const pNil = nilaiList.find(n => n.nis === p.nis);

      const h = pAbs.filter(a => a.statusKehadiran === 'Hadir').length;
      const s = pAbs.filter(a => a.statusKehadiran === 'Sakit').length;
      const i = pAbs.filter(a => a.statusKehadiran === 'Izin').length;
      const a = pAbs.filter(a => a.statusKehadiran === 'Alfa').length;
      const totalDays = pAbs.length || 1;
      const persentase = pAbs.length > 0 ? Math.round((h / totalDays) * 100) : 100;

      const avg = pNil?.rataRata ?? calculateAvg([pNil?.nilaiPraktik, pNil?.nilaiTeori, pNil?.nilaiTugas]);
      let predikat = pNil?.predikat || 'Baik';
      if (!pNil?.predikat) {
        if (avg >= 88) predikat = 'Sangat Baik';
        else if (avg >= 75) predikat = 'Baik';
        else if (avg >= 60) predikat = 'Cukup';
        else if (avg > 0) predikat = 'Kurang';
        else predikat = '-';
      }

      return [
        (idx + 1).toString(),
        p.nis || '-',
        p.nama,
        p.kelas || '-',
        p.status || 'Aktif',
        `${h} / ${s} / ${i} / ${a}`,
        `${persentase}%`,
        pNil?.nilaiTugas !== undefined && pNil?.nilaiTugas !== null ? pNil.nilaiTugas.toString() : '-',
        pNil?.nilaiPraktik !== undefined && pNil?.nilaiPraktik !== null ? pNil.nilaiPraktik.toString() : '-',
        pNil?.nilaiTeori !== undefined && pNil?.nilaiTeori !== null ? pNil.nilaiTeori.toString() : '-',
        avg > 0 ? avg.toString() : '-',
        predikat
      ];
    });

    const fontSizeTable = pageWidth > 250 ? 7.5 : 6.5;

    autoTable(doc, {
      startY: y,
      head: [
        [
          'No', 'NIS', 'Nama Peserta', 'Kelas', 'Status',
          'Presensi (H / S / I / A)', '% Hadir', 'Tugas', 'Praktik', 'Teori', 'Rata2', 'Predikat Akhir'
        ]
      ],
      body: tikRows,
      theme: 'grid',
      styles: { fontSize: fontSizeTable, cellPadding: 2, valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: contentWidth * 0.035 },
        1: { halign: 'center', cellWidth: contentWidth * 0.065 },
        2: { halign: 'left', cellWidth: contentWidth * 0.25 },
        3: { halign: 'center', cellWidth: contentWidth * 0.055 },
        4: { halign: 'center', cellWidth: contentWidth * 0.07 },
        5: { halign: 'center', cellWidth: contentWidth * 0.12 },
        6: { halign: 'center', cellWidth: contentWidth * 0.075 },
        7: { halign: 'center', cellWidth: contentWidth * 0.06 },
        8: { halign: 'center', cellWidth: contentWidth * 0.06 },
        9: { halign: 'center', cellWidth: contentWidth * 0.06 },
        10: { halign: 'center', cellWidth: contentWidth * 0.065 },
        11: { halign: 'center', cellWidth: contentWidth * 0.085 }
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.fillColor = [30, 27, 75]; // Indigo-950
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'center';
          if (data.column.index === 2) data.cell.styles.halign = 'left';
        } else if (data.section === 'body') {
          const colIdx = data.column.index;
          
          // Col 4: Status
          if (colIdx === 4) {
            const val = data.cell.raw as string;
            if (val === 'Aktif') {
              data.cell.styles.fillColor = [209, 250, 229]; // Emerald-100
              data.cell.styles.textColor = [6, 78, 59];     // Emerald-900
            } else if (val === 'Alumni') {
              data.cell.styles.fillColor = [219, 234, 254]; // Blue-100
              data.cell.styles.textColor = [30, 58, 138];    // Blue-900
            } else {
              data.cell.styles.fillColor = [254, 226, 226]; // Red-100
              data.cell.styles.textColor = [153, 27, 27];    // Red-900
            }
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.halign = 'center';
          }

          // Col 5: Presensi (Custom drawn in didDrawCell)
          if (colIdx === 5) {
            data.cell.styles.halign = 'center';
            data.cell.text = [''];
          }

          // Col 6: % Hadir
          if (colIdx === 6) {
            const valStr = data.cell.raw as string;
            const numVal = parseInt(valStr) || 0;
            if (numVal >= 80) {
              data.cell.styles.fillColor = [236, 253, 245]; // Emerald-50
              data.cell.styles.textColor = [6, 95, 70];     // Emerald-800
            } else {
              data.cell.styles.fillColor = [254, 243, 199]; // Amber-50
              data.cell.styles.textColor = [146, 64, 14];    // Amber-800
            }
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.halign = 'center';
          }

          // Col 10: Rata2
          if (colIdx === 10) {
            data.cell.styles.fillColor = [238, 242, 255]; // Indigo-50
            data.cell.styles.textColor = [30, 27, 75];     // Indigo-950
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.halign = 'center';
          }

          // Col 11: Predikat
          if (colIdx === 11) {
            const pred = data.cell.raw as string;
            if (pred.startsWith('Sangat')) {
              data.cell.styles.fillColor = [209, 250, 229]; // Emerald-100
              data.cell.styles.textColor = [6, 78, 59];
            } else if (pred.startsWith('Baik')) {
              data.cell.styles.fillColor = [224, 242, 254]; // Sky-100
              data.cell.styles.textColor = [12, 74, 110];
            } else if (pred.startsWith('Cukup')) {
              data.cell.styles.fillColor = [254, 243, 199]; // Amber-100
              data.cell.styles.textColor = [120, 53, 15];
            } else {
              data.cell.styles.fillColor = [255, 228, 230]; // Rose-100
              data.cell.styles.textColor = [159, 18, 57];
            }
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.halign = 'center';
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const rawVal = tikRows[data.row.index]?.[5] || '';
          const parts = rawVal.split(' / ');
          if (parts.length === 4) {
            const [hVal, sVal, iVal, aVal] = parts;
            const cell = data.cell;

            doc.setFontSize(fontSizeTable);

            doc.setFont('helvetica', 'bold');
            const wH = doc.getTextWidth(hVal);
            doc.setFont('helvetica', 'normal');
            const wS = doc.getTextWidth(sVal);
            const wI = doc.getTextWidth(iVal);
            doc.setFont('helvetica', 'bold');
            const wA = doc.getTextWidth(aVal);

            doc.setFont('helvetica', 'normal');
            const wSlash = doc.getTextWidth(' / ');

            const totalW = wH + wS + wI + wA + 3 * wSlash;
            let startX = cell.x + (cell.width - totalW) / 2;
            const textY = cell.y + cell.height / 2 + 1;

            // H (Emerald)
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(4, 120, 87);
            doc.text(hVal, startX, textY);
            startX += wH;

            // / (Slate)
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(' / ', startX, textY);
            startX += wSlash;

            // S (Blue)
            doc.setTextColor(29, 78, 216);
            doc.text(sVal, startX, textY);
            startX += wS;

            // / (Slate)
            doc.setTextColor(148, 163, 184);
            doc.text(' / ', startX, textY);
            startX += wSlash;

            // I (Amber)
            doc.setTextColor(180, 83, 9);
            doc.text(iVal, startX, textY);
            startX += wI;

            // / (Slate)
            doc.setTextColor(148, 163, 184);
            doc.text(' / ', startX, textY);
            startX += wSlash;

            // A (Rose)
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(225, 29, 72);
            doc.text(aVal, startX, textY);
          }
        }
      },
      margin: { left: marginX, right: marginX, top: 18, bottom: 15 },
      showHead: 'everyPage'
    });

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY : y + 40;

    let sigY = finalY + 8;
    if (sigY + 32 > pageHeight - 15) {
      doc.addPage();
      sigY = 18;
    }

    drawSignatures(doc, config, pageWidth, sigY, 2);
  }

  // Aplikasikan Footer (Nomor Halaman & Metadata) di Setiap Halaman
  applyPageFooters(doc, docTitleForFooter);

  // Penamaan File PDF mengikuti format: Laporan_[Nama]_[Tanggal].pdf
  const dateSuffix = getFormattedDate();
  const classNameClean = (config.activeClassName || 'KELAS').replace(/\s+/g, '_');

  let fileName = `Laporan_${classNameClean}_${dateSuffix}.pdf`;
  if (reportType === 'collective') {
    fileName = `Laporan_Rekap_Kolektif_${classNameClean}_${dateSuffix}.pdf`;
  } else if (reportType === 'individual') {
    const studentNameClean = params.selectedStudentNis && params.selectedStudentNis !== 'all'
      ? (params.students?.find(s => s.nis === params.selectedStudentNis)?.nama || 'Siswa').replace(/\s+/g, '_')
      : 'Semua_Siswa';
    fileName = `Laporan_Rapor_${studentNameClean}_${dateSuffix}.pdf`;
  } else if (reportType === 'journal') {
    fileName = `Laporan_Jurnal_Harian_${classNameClean}_${dateSuffix}.pdf`;
  } else if (reportType === 'extra_tik') {
    fileName = `Laporan_Ekstrakurikuler_TIK_${dateSuffix}.pdf`;
  }

  // Simpan dan unduh PDF secara langsung
  doc.save(fileName);
  return fileName;
};
