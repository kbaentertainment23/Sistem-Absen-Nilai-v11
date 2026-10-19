import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Student } from '../types';
import { getFriendlyErrorMessage } from '../lib/errorHelper';
import { deleteStudentFromFirestore } from '../lib/firestoreService';
import { Plus, Edit2, Trash2, Check, AlertCircle, RefreshCw, Loader2, Info, Camera, User, Image, X, FileSpreadsheet, Download, Upload, FileUp, Sparkles, Link, Globe, ExternalLink, Search, ArrowUpDown, ListOrdered, Copy, CheckCheck, FileText } from 'lucide-react';
import { optimizeStudentPhoto, handleStudentPhotoError, safeSetItem } from '../lib/photoOptimizer';
import { convertGoogleDriveUrl, isGoogleDriveUrl } from '../utils/imageHelper';
import { useLazyList } from '../hooks/useLazyList';
const getStudentPhotoUrl = (foto?: string) => foto ? convertGoogleDriveUrl(foto) : undefined;
const uploadStudentPhotoToDrive = async (base64Photo: string) => base64Photo;

interface StudentsTabProps {
  students: Student[];
  allStudents?: Student[];
  onSyncRoster: (updatedStudents: Student[], nisChanges?: Record<string, string>, targetNis?: string) => Promise<void>;
  role: 'admin' | 'guru';
  classes: { id: number; name: string }[];
  selectedClassId: number;
  onSelectClassId: (id: number) => void;
  onSyncClasses: (updatedClasses: { id: number; name: string }[]) => Promise<void>;
  accessToken?: string | null;
  spreadsheetId?: string;
  onRevalidatePhotos?: () => Promise<void>;
  onDeepClean?: () => void;
  isBackgroundSyncing?: boolean;
  backgroundSyncStatus?: 'idle' | 'success' | 'error';
  syncingStudentNis?: string | null;
}

const DEFAULT_FALLBACK_ROSTER: Student[] = [
  { nis: '12001', nama: 'Andi Pratama', jenisKelamin: 'L' },
  { nis: '12002', nama: 'Budi Santoso', jenisKelamin: 'L' },
  { nis: '12003', nama: 'Citra Lestari', jenisKelamin: 'P' },
  { nis: '12004', nama: 'Dewi Sartika', jenisKelamin: 'P' },
  { nis: '12005', nama: 'Eko Prasetyo', jenisKelamin: 'L' },
  { nis: '12006', nama: 'Farhan Wijaya', jenisKelamin: 'L' },
];

export default function StudentsTab({
  students,
  allStudents = [],
  onSyncRoster,
  role,
  classes,
  selectedClassId,
  onSelectClassId,
  onSyncClasses,
  accessToken,
  spreadsheetId,
  onRevalidatePhotos,
  onDeepClean,
  isBackgroundSyncing = false,
  backgroundSyncStatus = 'idle',
  syncingStudentNis = null
}: StudentsTabProps) {
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editingClassNameInput, setEditingClassNameInput] = useState('');

  // Local Students state for the active class
  const [localStudents, setLocalStudents] = useState<Student[]>([]);
  const [selectedNisList, setSelectedNisList] = useState<string[]>([]);
  const [noAbsenInput, setNoAbsenInput] = useState('');
  const [nisInput, setNisInput] = useState('');
  const [namaInput, setNamaInput] = useState('');
  const [genderInput, setGenderInput] = useState<'L' | 'P'>('L');
  const [fotoInput, setFotoInput] = useState<string>('');
  const [showDriveInput, setShowDriveInput] = useState(false);
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [labelInput, setLabelInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [zoomedName, setZoomedName] = useState<string>('');
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [nisChanges, setNisChanges] = useState<Record<string, string>>({});
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [classToDelete, setClassToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // Bulk Import Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedPreview, setImportedPreview] = useState<{
    noAbsen: string;
    nis: string;
    nama: string;
    jenisKelamin: 'L' | 'P';
    kelas?: string;
    label: string;
    foto?: string;
  }[]>([]);
  const [importFileError, setImportFileError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Reorder by Name or NIS Modal States
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderMode, setReorderMode] = useState<'name' | 'nis'>('name');
  const [rawReorderText, setRawReorderText] = useState('');
  const [autoRenumber, setAutoRenumber] = useState(true);
  const [isApplyingReorder, setIsApplyingReorder] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Download Excel Template for Students Import with ExcelJS
  const downloadExcelTemplate = async () => {
    const activeClassObj = classes.find(c => c.id === selectedClassId);
    const className = activeClassObj?.name || 'Kelas';

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Jurnal Guru Pro';

      const worksheet = workbook.addWorksheet('Format Siswa', {
        views: [{ showGridLines: true }]
      });

      // Title Banner
      worksheet.mergeCells('A1:G1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `FORMAT IMPORT DATA SISWA - KELAS ${className.toUpperCase()}`;
      titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' }
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      // Subtitle Instructions
      worksheet.mergeCells('A2:G2');
      const subCell = worksheet.getCell('A2');
      subCell.value = 'Petunjuk: Isikan data siswa sesuai kolom. Kolom NIS dan Nama Siswa wajib diisi.';
      subCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF047857' } };
      subCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFECFDF5' }
      };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      worksheet.getRow(3).height = 8; // Spacer

      // Headers
      const headers = ['NIS', 'Nama Siswa', 'Jenis Kelamin (L/P)', 'Kelas', 'Label / Catatan', 'Link Foto Google Drive', 'No Absen'];
      const headerRow = worksheet.getRow(4);
      headerRow.values = headers;
      headerRow.height = 25;

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      headerRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F766E' }
        };
        cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF042F2E' } },
          left: { style: 'thin', color: { argb: 'FF134E4A' } },
          bottom: { style: 'medium', color: { argb: 'FF042F2E' } },
          right: { style: 'thin', color: { argb: 'FF134E4A' } }
        };
      });

      // Sample Data Rows
      const samples = [
        { nis: '12010', nama: 'Ahmad Dahlan', jk: 'L', kelas: className, label: 'Ketua Kelas', foto: 'https://drive.google.com/file/d/1A2B3C4D5E/view?usp=sharing', noAbsen: 1 },
        { nis: '12011', nama: 'Siti Rahma', jk: 'P', kelas: className, label: '', foto: '', noAbsen: 2 },
        { nis: '12012', nama: 'Budi Setiawan', jk: 'L', kelas: className, label: 'OMP', foto: '', noAbsen: 3 }
      ];

      samples.forEach((st, idx) => {
        const rowNum = 5 + idx;
        const row = worksheet.getRow(rowNum);
        row.values = [st.nis, st.nama, st.jk, st.kelas, st.label, st.foto, st.noAbsen];
        row.height = 22;

        const bgArgb = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF1E293B' } };
          cell.border = thinBorder;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgArgb }
          };

          if (colNum === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Consolas', size: 10.5, color: { argb: 'FF334155' } };
          } else if (colNum === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colNum === 3 || colNum === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (colNum === 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF2563EB' } };
          } else if (colNum === 7) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF334155' } };
          }
        });
      });

      worksheet.columns = [
        { width: 16 }, // NIS
        { width: 30 }, // Nama Siswa
        { width: 22 }, // Jenis Kelamin
        { width: 14 }, // Kelas
        { width: 20 }, // Label / Catatan
        { width: 45 }, // Link Foto Google Drive
        { width: 12 }  // No Absen
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
      anchor.download = `Format_Import_Siswa_${safeClassName}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template failed:', err);
    }
  };

  // Export selected class student roster to Excel (.xlsx) with ExcelJS
  const handleExportClassStudentsToExcel = async () => {
    const currentClassObj = classes.find(c => c.id === selectedClassId);
    const className = currentClassObj?.name || 'Kelas';

    if (!localStudents || localStudents.length === 0) {
      alert(`Tidak ada data siswa di kelas ${className} untuk diekspor.`);
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Jurnal Guru Pro';

      const worksheet = workbook.addWorksheet(`Siswa ${className}`, {
        views: [{ showGridLines: true }]
      });

      // Title Banner
      worksheet.mergeCells('A1:G1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `DAFTAR SISWA - KELAS ${className.toUpperCase()}`;
      titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E1B4B' }
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      // Subtitle
      worksheet.mergeCells('A2:G2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • Total Siswa: ${localStudents.length}`;
      subCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
      subCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      worksheet.getRow(3).height = 8; // Spacer

      // Headers
      const headers = ['NIS', 'Nama Siswa', 'Jenis Kelamin (L/P)', 'Kelas', 'Label / Catatan', 'Link Foto Google Drive', 'No Absen'];
      const headerRow = worksheet.getRow(4);
      headerRow.values = headers;
      headerRow.height = 26;

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      headerRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF334155' }
        };
        cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF475569' } }
        };
      });

      // Data Rows
      localStudents.forEach((student, index) => {
        const rowNum = 5 + index;
        const row = worksheet.getRow(rowNum);
        row.values = [
          student.nis || '',
          student.nama || '',
          student.jenisKelamin === 'P' ? 'P' : 'L',
          student.kelas || className,
          student.label || '',
          student.foto || '',
          student.noAbsen || (index + 1)
        ];
        row.height = 22;

        const bgArgb = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF1E293B' } };
          cell.border = thinBorder;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgArgb }
          };

          if (colNum === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Consolas', size: 10.5, color: { argb: 'FF334155' } };
          } else if (colNum === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colNum === 3 || colNum === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (colNum === 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF2563EB' } };
          } else if (colNum === 7) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF334155' } };
          }
        });
      });

      worksheet.columns = [
        { width: 16 }, // NIS
        { width: 32 }, // Nama Siswa
        { width: 22 }, // Jenis Kelamin
        { width: 14 }, // Kelas
        { width: 20 }, // Label / Catatan
        { width: 45 }, // Link Foto Google Drive
        { width: 12 }  // No Absen
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      anchor.download = `Data_Siswa_${safeClassName}_${dateStr}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export student data failed:', err);
    }
  };

  // Parse Excel / CSV File
  const handleExcelFileParse = (file: File) => {
    setImportFileError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setImportFileError('File Excel/CSV tidak memiliki sheet data.');
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to 2D array matrix to dynamically detect header row (handles banner titles in template)
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!matrix || matrix.length === 0) {
          setImportFileError('File Excel/CSV kosong, tidak ada baris data siswa.');
          return;
        }

        // Detect header row index by searching for row containing key column headers
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(matrix.length, 12); r++) {
          const rowVals = (matrix[r] || []).map(c => String(c).trim().toLowerCase());
          const hasKeyHeader = rowVals.some(v => 
            v === 'nis' || v === 'nama' || v === 'nama siswa' || v === 'no nis' || v === 'nisn' || v === 'no absen'
          );
          if (hasKeyHeader) {
            headerRowIdx = r;
            break;
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = 0; // fallback
        }

        const headerNames = (matrix[headerRowIdx] || []).map(c => String(c).trim());

        const rawRows: Record<string, any>[] = [];
        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const rowCells = matrix[r];
          if (!rowCells || rowCells.every(c => c === '' || c === null || c === undefined)) {
            continue;
          }
          const rowObj: Record<string, any> = {};
          let hasContent = false;
          headerNames.forEach((hName, colIdx) => {
            const val = rowCells[colIdx] !== undefined ? rowCells[colIdx] : '';
            if (val !== '') hasContent = true;
            if (hName) {
              rowObj[hName] = val;
            } else {
              rowObj[`__EMPTY_${colIdx}`] = val;
            }
          });
          if (hasContent) {
            rawRows.push(rowObj);
          }
        }

        if (rawRows.length === 0) {
          setImportFileError('File Excel/CSV kosong, tidak ada baris data siswa.');
          return;
        }

        const parsed = rawRows.map((row, idx) => {
          const getVal = (keys: string[]) => {
            const rowKeys = Object.keys(row);
            // First attempt: exact match
            for (const key of keys) {
              const matchKey = rowKeys.find(k => k.toString().trim().toLowerCase() === key.toLowerCase());
              if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
                return String(row[matchKey]).trim();
              }
            }
            // Second attempt: partial inclusion match
            for (const key of keys) {
              const matchKey = rowKeys.find(k => k.toString().trim().toLowerCase().includes(key.toLowerCase()));
              if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
                return String(row[matchKey]).trim();
              }
            }
            return '';
          };

          const noAbsen = getVal(['no absen', 'absen', 'no. absen', 'no', 'nomor absen']);
          const nis = getVal(['nis', 'no nis', 'nomor induk', 'id', 'nisn']);
          const nama = getVal(['nama', 'nama siswa', 'nama lengkap', 'name']);
          const jkRaw = getVal(['jenis kelamin (l/p)', 'jenis kelamin', 'jk', 'gender', 'l/p', 'p/l']);
          
          let jenisKelamin: 'L' | 'P' = 'L';
          const jkUpper = jkRaw.trim().toUpperCase();
          if (jkUpper.startsWith('P') || jkUpper.includes('PEREMPUAN') || jkUpper.includes('FEMALE')) {
            jenisKelamin = 'P';
          }

          const kelas = getVal(['kelas', 'class', 'rombel']);
          const label = getVal(['label / catatan', 'label', 'catatan', 'keterangan', 'jabatan']);
          const fotoRaw = getVal(['link foto google drive', 'link foto drive', 'foto', 'photo', 'link foto', 'drive', 'foto drive', 'url']);
          const foto = fotoRaw ? convertGoogleDriveUrl(fotoRaw) : '';

          return {
            noAbsen: noAbsen || String(idx + 1),
            nis: nis ? String(nis).replace(/\D/g, '') : '',
            nama,
            jenisKelamin,
            kelas,
            label,
            foto
          };
        }).filter(s => s.nis || s.nama);

        if (parsed.length === 0) {
          setImportFileError('Tidak ditemukan data siswa berformat valid. Pastikan ada kolom NIS dan Nama Siswa.');
        } else {
          setImportedPreview(parsed);
        }
      } catch (err: any) {
        console.error('Error reading excel file:', err);
        setImportFileError('Gagal membaca file Excel/CSV. Pastikan format file valid (.xlsx, .xls, .csv).');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Confirm and save bulk imported students
  const handleConfirmBulkImport = async () => {
    if (importedPreview.length === 0) return;
    setIsImporting(true);

    const activeClassName = classes.find(c => c.id === selectedClassId)?.name || '';

    const validImports = importedPreview.filter(item => item.nis && item.nama);
    if (validImports.length === 0) {
      setImportFileError('Semua baris data yang diimpor harus memiliki NIS dan Nama Siswa.');
      setIsImporting(false);
      return;
    }

    const existingMap = new Map<string, Student>(localStudents.map(s => [s.nis, s]));

    validImports.forEach(item => {
      const existing = existingMap.get(item.nis);
      if (existing) {
        existingMap.set(item.nis, {
          ...existing,
          noAbsen: item.noAbsen || existing.noAbsen,
          nama: item.nama || existing.nama,
          jenisKelamin: item.jenisKelamin || existing.jenisKelamin,
          kelas: item.kelas || existing.kelas || activeClassName,
          label: item.label || existing.label,
          foto: item.foto || existing.foto
        });
      } else {
        existingMap.set(item.nis, {
          nis: item.nis,
          nama: item.nama,
          noAbsen: item.noAbsen || String(existingMap.size + 1),
          jenisKelamin: item.jenisKelamin,
          kelas: item.kelas || activeClassName,
          label: item.label,
          foto: item.foto || ''
        });
      }
    });

    const updatedList = Array.from(existingMap.values());
    saveLocalStudentsState(updatedList);

    setShowImportModal(false);
    setImportedPreview([]);
    setIsImporting(false);

    await triggerAutoSync(updatedList);
  };

  // Compute reorder preview from rawReorderText and reorderMode
  const reorderPreview = React.useMemo(() => {
    if (!rawReorderText.trim()) {
      return {
        orderedStudents: localStudents,
        matchedCount: 0,
        unmatchedLocalStudents: [],
        unmatchedInputLines: [] as string[],
        totalInputLines: 0
      };
    }

    const lines = rawReorderText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const matched: Student[] = [];
    const matchedNisSet = new Set<string>();
    const unmatchedInputLines: string[] = [];

    const cleanName = (str: string) => {
      return str
        .replace(/^\s*\d+[\.\-\)\:\s\t]+/g, '') // remove leading 1. 2) etc
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    };

    const cleanNis = (str: string) => {
      const match = str.match(/\d+/g);
      return match ? match.join('') : '';
    };

    lines.forEach((line) => {
      // Split by tab or semicolon/comma if pasted from Excel
      const tokens = line.split(/[\t;,]/).map(t => t.trim()).filter(Boolean);
      let found: Student | undefined;

      if (reorderMode === 'nis') {
        const inputNis = cleanNis(tokens.find(t => /\d{3,}/.test(t)) || line);
        if (inputNis) {
          found = localStudents.find(s => cleanNis(s.nis) === inputNis && !matchedNisSet.has(s.nis));
        }
      } else {
        // Name mode
        // If line has multiple tokens, prefer non-numeric column with length >= 2
        const candidateName = tokens.find(t => !/^\d+$/.test(t) && t.length > 1) || line;
        const targetClean = cleanName(candidateName);

        if (targetClean) {
          // 1. Exact clean match
          found = localStudents.find(s => cleanName(s.nama) === targetClean && !matchedNisSet.has(s.nis));

          // 2. Exact raw match (case-insensitive)
          if (!found) {
            found = localStudents.find(s => s.nama.trim().toLowerCase() === candidateName.trim().toLowerCase() && !matchedNisSet.has(s.nis));
          }

          // 3. Substring inclusion if length >= 4
          if (!found && targetClean.length >= 4) {
            found = localStudents.find(s => {
              if (matchedNisSet.has(s.nis)) return false;
              const sClean = cleanName(s.nama);
              return sClean.includes(targetClean) || targetClean.includes(sClean);
            });
          }
        }
      }

      if (found) {
        matched.push(found);
        matchedNisSet.add(found.nis);
      } else {
        unmatchedInputLines.push(line);
      }
    });

    // Any students in local roster not mentioned in the input will be appended at the end so nothing is lost
    const unmatchedLocal = localStudents.filter(s => !matchedNisSet.has(s.nis));
    const combined = [...matched, ...unmatchedLocal];

    return {
      orderedStudents: combined,
      matchedCount: matched.length,
      unmatchedLocalStudents: unmatchedLocal,
      unmatchedInputLines,
      totalInputLines: lines.length
    };
  }, [rawReorderText, reorderMode, localStudents]);

  const handleApplyReorder = async () => {
    if (reorderPreview.orderedStudents.length === 0) return;
    setIsApplyingReorder(true);
    setErrorText('');

    try {
      const reorderedList: Student[] = reorderPreview.orderedStudents.map((s, index) => {
        if (autoRenumber) {
          return { ...s, noAbsen: String(index + 1) };
        }
        return s;
      });

      saveLocalStudentsState(reorderedList);
      setShowReorderModal(false);
      setRawReorderText('');

      await triggerAutoSync(reorderedList);
    } catch (err: any) {
      console.error('Apply reorder error:', err);
      setErrorText(`Gagal menyimpan urutan baru: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsApplyingReorder(false);
    }
  };

  const handleCopyCurrentRosterToClipboard = () => {
    let text = '';
    if (reorderMode === 'nis') {
      text = localStudents.map(s => s.nis).join('\n');
    } else {
      text = localStudents.map((s, idx) => `${idx + 1}. ${s.nama}`).join('\n');
    }
    setRawReorderText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    setErrorText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setErrorText('Tidak dapat mengakses kamera perangkat. Pastikan izin kamera telah diberikan.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      const rawWidth = video.videoWidth || 640;
      const rawHeight = video.videoHeight || 480;
      
      // Determine crop size as the minimum dimension (to form a square)
      const cropSize = Math.min(rawWidth, rawHeight);
      
      // Centered cropping coordinates
      const sx = (rawWidth - cropSize) / 2;
      const sy = (rawHeight - cropSize) / 2;
      
      // Output dimensions: standard 250x250 square for fast cloud upload & ultra-low storage (~6KB)
      const targetSize = Math.min(cropSize, 250);
      
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the canvas context horizontally to match the mirrored camera display
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        // Draw cropped center of the video frame
        ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);
        
        // Optimize camera quality to 0.65 for clear image with minimal file size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        setFotoInput(dataUrl);
        stopCamera();
      }
    }
  };

  React.useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // States for adding a new class
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);

  // Global Search state for filtering students by Name, NIS, No Absen, or Label
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = React.useMemo(() => {
    if (!searchQuery.trim()) return localStudents;
    const q = searchQuery.toLowerCase().trim();
    return localStudents.filter(s =>
      (s.nama && s.nama.toLowerCase().includes(q)) ||
      (s.nis && s.nis.toLowerCase().includes(q)) ||
      (s.noAbsen && String(s.noAbsen).toLowerCase().includes(q)) ||
      (s.label && s.label.toLowerCase().includes(q))
    );
  }, [localStudents, searchQuery]);

  // Lazy loading hook for high performance rendering of large student rosters
  const { 
    visibleItems: visibleStudents, 
    visibleCount, 
    totalCount: totalStudentsCount, 
    hasMore: hasMoreStudents, 
    loadAll: loadAllStudents, 
    sentinelRef: studentSentinelRef 
  } = useLazyList(filteredStudents, { initialCount: 40, batchSize: 40 });

  // Synchronize when active class changes or props change from outside
  React.useEffect(() => {
    setNisChanges({});
    setSelectedNisList([]);
    if (students !== undefined && students !== null) {
      const enriched = students.map(s => ({
        ...s,
        jenisKelamin: s.jenisKelamin || 'L',
        foto: s.foto || localStorage.getItem(`student_photo_${s.nis}`) || undefined
      }));
      setLocalStudents(enriched);
      localStorage.setItem(`absensi_class_students_${selectedClassId}`, JSON.stringify(enriched));
    } else {
      const cachedStudents = localStorage.getItem(`absensi_class_students_${selectedClassId}`);
      if (cachedStudents) {
        try {
          const parsed = JSON.parse(cachedStudents);
          const enriched = parsed.map((s: Student) => ({
            ...s,
            foto: s.foto || localStorage.getItem(`student_photo_${s.nis}`) || undefined
          }));
          setLocalStudents(enriched);
          return;
        } catch (e) {
          console.error(e);
        }
      }
      setLocalStudents([]);
      localStorage.setItem(`absensi_class_students_${selectedClassId}`, JSON.stringify([]));
    }
  }, [selectedClassId, students]);

  // Handle local state updates back to localStorage
  const saveLocalStudentsState = (updated: Student[]) => {
    setLocalStudents(updated);
    localStorage.setItem(`absensi_class_students_${selectedClassId}`, JSON.stringify(updated));
  };

  const handleSelectClass = (classId: number) => {
    stopCamera();
    onSelectClassId(classId);
    setSearchQuery('');
    setEditingNis(null);
    setNisInput('');
    setNamaInput('');
    setNoAbsenInput('');
    setGenderInput('L');
    setErrorText('');
  };

  const handleStartRenameClass = (cls: { id: number; name: string }) => {
    setEditingClassId(cls.id);
    setEditingClassNameInput(cls.name);
  };

  const handleSaveClassName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClassNameInput.trim()) return;

    const updated = classes.map(c =>
      c.id === editingClassId ? { ...c, name: editingClassNameInput.trim() } : c
    );
    try {
      await onSyncClasses(updated);
      setEditingClassId(null);
    } catch (err) {
      console.error(err);
      setErrorText(`Gagal memperbarui nama kelas di spreadsheet: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newClassNameInput.trim();
    if (!trimmedName) return;

    if (classes.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setErrorText('Nama kelas sudah ada.');
      return;
    }

    setIsAddingClass(true);
    setErrorText('');

    const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
    const updated = [...classes, { id: newId, name: trimmedName }];

    try {
      await onSyncClasses(updated);
      setShowAddClassModal(false);
      setNewClassNameInput('');
      onSelectClassId(newId);
    } catch (err) {
      console.error(err);
      setErrorText(`Gagal menambahkan kelas baru ke spreadsheet: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsAddingClass(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeletingClass(true);
    setErrorText('');

    const updated = classes.filter(c => c.id !== classToDelete.id);
    try {
      await onSyncClasses(updated);
      setClassToDelete(null);
    } catch (err) {
      console.error(err);
      setErrorText(`Gagal menghapus kelas dari spreadsheet: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsDeletingClass(false);
    }
  };

  const triggerAutoSync = async (updatedList: Student[], currentNisChanges?: Record<string, string>, targetNis?: string) => {
    try {
      await onSyncRoster(updatedList, currentNisChanges || nisChanges, targetNis);
      setNisChanges({});
    } catch (err) {
      console.error('Auto-sync error:', err);
    }
  };

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    const trimmedNis = nisInput.trim();
    const trimmedNama = namaInput.trim();

    if (!trimmedNis || !trimmedNama) {
      setErrorText('NIS dan Nama Siswa tidak boleh kosong.');
      return;
    }

    if (!/^\d+$/.test(trimmedNis)) {
      setErrorText('NIS harus berupa angka saja.');
      return;
    }

    let updatedList: Student[] = [];
    let currentNisChanges = { ...nisChanges };
    const lookupNis = editingNis || trimmedNis;

    let optimizedFoto = fotoInput;
    if (optimizedFoto) {
      optimizedFoto = await optimizeStudentPhoto(optimizedFoto);
    }

    if (editingNis) {
      // Editing Mode
      if (trimmedNis !== editingNis && localStudents.some(s => s.nis === trimmedNis)) {
        setErrorText('NIS sudah terdaftar untuk siswa lain.');
        return;
      }

      // If NIS changed, handle photo key migration
      if (trimmedNis !== editingNis) {
        if (optimizedFoto) {
          localStorage.setItem(`student_photo_${trimmedNis}`, optimizedFoto);
        }
        localStorage.removeItem(`student_photo_${editingNis}`);
        currentNisChanges = { ...currentNisChanges, [editingNis]: trimmedNis };
        setNisChanges(currentNisChanges);
      } else {
        if (optimizedFoto) {
          localStorage.setItem(`student_photo_${trimmedNis}`, optimizedFoto);
        } else {
          localStorage.removeItem(`student_photo_${trimmedNis}`);
        }
      }

      updatedList = localStudents.map(s =>
        s.nis === editingNis ? { ...s, noAbsen: noAbsenInput.trim(), nis: trimmedNis, nama: trimmedNama, jenisKelamin: genderInput, foto: optimizedFoto || undefined, label: labelInput.trim() } : s
      );
      saveLocalStudentsState(updatedList);
      setEditingNis(null);
    } else {
      // Add Mode
      if (localStudents.some(s => s.nis === trimmedNis)) {
        setErrorText('NIS sudah terdaftar.');
        return;
      }

      if (optimizedFoto) {
        localStorage.setItem(`student_photo_${trimmedNis}`, optimizedFoto);
      }

      updatedList = [...localStudents, { noAbsen: noAbsenInput.trim(), nis: trimmedNis, nama: trimmedNama, jenisKelamin: genderInput, foto: optimizedFoto || undefined, label: labelInput.trim() }];
      saveLocalStudentsState(updatedList);
    }

    setNisInput('');
    setNamaInput('');
    setNoAbsenInput('');
    setGenderInput('L');
    setFotoInput('');
    setShowDriveInput(false);
    setDriveUrlInput('');
    setLabelInput('');
    setShowStudentModal(false);
    stopCamera();

    // Trigger non-blocking sync (handles both Drive upload and Sheet sync in the background)
    triggerAutoSync(updatedList, currentNisChanges, lookupNis);
  };

  const startEdit = (student: Student) => {
    const existingFoto = student.foto || localStorage.getItem(`student_photo_${student.nis}`) || '';
    setEditingNis(student.nis);
    setNisInput(student.nis);
    setNamaInput(student.nama);
    setNoAbsenInput(student.noAbsen || '');
    setGenderInput(student.jenisKelamin || 'L');
    setFotoInput(existingFoto);
    setDriveUrlInput(isGoogleDriveUrl(existingFoto) ? existingFoto : '');
    setShowDriveInput(isGoogleDriveUrl(existingFoto));
    setLabelInput(student.label || '');
    setErrorText('');
    setShowStudentModal(true);
  };

  const cancelEdit = () => {
    stopCamera();
    setEditingNis(null);
    setNisInput('');
    setNamaInput('');
    setNoAbsenInput('');
    setGenderInput('L');
    setFotoInput('');
    setShowDriveInput(false);
    setDriveUrlInput('');
    setLabelInput('');
    setErrorText('');
    setShowStudentModal(false);
  };

  const handleBatchApplyLabel = async (label: string) => {
    setErrorText('');
    const targetNisString = selectedNisList.join(',');
    const updatedList = localStudents.map(student => {
      if (selectedNisList.includes(student.nis)) {
        return {
          ...student,
          label: label.trim() || undefined
        };
      }
      return student;
    });

    saveLocalStudentsState(updatedList);
    setSelectedNisList([]);

    try {
      await triggerAutoSync(updatedList, {}, targetNisString);
    } catch (err) {
      console.error('Batch sync error:', err);
      setErrorText(`Berhasil memperbarui lokal, namun sinkronisasi background gagal: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedNisList.length === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedNisList.length} siswa terpilih secara permanen?`)) return;

    setErrorText('');
    const targetNisString = selectedNisList.join(',');

    for (const nis of selectedNisList) {
      localStorage.removeItem(`student_photo_${nis}`);
      try {
        await deleteStudentFromFirestore(nis);
      } catch (err) {
        console.error(`Error deleting student ${nis}:`, err);
      }
    }

    const updatedList = localStudents.filter(student => !selectedNisList.includes(student.nis));

    saveLocalStudentsState(updatedList);
    setSelectedNisList([]);

    try {
      await triggerAutoSync(updatedList, {}, targetNisString);
    } catch (err) {
      console.error('Batch sync error:', err);
      setErrorText(`Berhasil memperbarui lokal, namun sinkronisasi background gagal: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const handleDelete = (student: Student) => {
    setStudentToDelete(student);
  };

  const confirmDeleteStudent = async () => {
    if (studentToDelete) {
      const deletedNis = studentToDelete.nis;
      localStorage.removeItem(`student_photo_${deletedNis}`);
      const updated = localStudents.filter(s => s.nis !== deletedNis);
      saveLocalStudentsState(updated);
      setStudentToDelete(null);
      
      try {
        await deleteStudentFromFirestore(deletedNis);
      } catch (err) {
        console.error(`Error deleting student ${deletedNis} from Firestore:`, err);
      }

      // Automatically sync after deletion
      await triggerAutoSync(updated, nisChanges, deletedNis);
    }
  };

  // Check if there are local unsaved modifications compared to props
  const hasUnsavedChanges = JSON.stringify(localStudents) !== JSON.stringify(students);

  return (
    <div id="students-section" className="space-y-6">
      
      {/* Classes Selection Panel */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2 h-4.5 bg-indigo-600 rounded-full inline-block" />
              Pilih & Kelola Roster Kelas
              <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase tracking-wider">
                {classes.length} Kelas
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik pada kelas untuk memuat roster siswa. Admin dapat mengedit nama atau menghapus kelas beserta rosternya.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {classes.map(cls => {
            const isSelected = selectedClassId === cls.id;
            
            // Dynamic count from allStudents loaded from Sheet, or local state for the active class, or local storage
            const studentsInThisClass = allStudents.filter(s => s.kelas === cls.name);
            let currentRoster: any[] = [];
            try {
              const raw = localStorage.getItem(`absensi_class_students_${cls.id}`);
              currentRoster = raw ? JSON.parse(raw) : [];
            } catch (e) {
              currentRoster = [];
            }
            
            const studentCount = isSelected ? localStudents.length : studentsInThisClass.length;

            return (
              <div
                key={cls.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 select-none ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-slate-50/50 shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectClass(cls.id)}
                  className="inline-flex items-center gap-1.5 cursor-pointer focus:outline-none font-bold text-xs"
                >
                  <span className={isSelected ? 'text-white' : 'text-slate-800'}>{cls.name}</span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {studentCount}
                  </span>
                </button>

                {role === 'admin' && (
                  <div className="flex items-center gap-0.5 pl-1.5 border-l border-slate-200/40 group-hover:border-slate-305">
                    <button
                      type="button"
                      onClick={() => handleStartRenameClass(cls)}
                      className={`p-0.5 rounded-full transition-colors duration-150 cursor-pointer ${
                        isSelected 
                          ? 'hover:bg-indigo-500 text-indigo-200 hover:text-white' 
                          : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'
                      }`}
                      title="Ubah nama kelas"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassToDelete(cls)}
                      className={`p-0.5 rounded-full transition-colors duration-150 cursor-pointer ${
                        isSelected 
                          ? 'hover:bg-indigo-500 text-indigo-200 hover:text-rose-200' 
                          : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                      }`}
                      title="Hapus kelas"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowAddClassModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/30 hover:bg-indigo-50/20 text-slate-500 hover:text-indigo-600 transition-all duration-200 cursor-pointer text-xs font-bold"
              title="Tambah kelas baru"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span>Tambah Kelas</span>
            </button>
          )}
        </div>
      </div>

      {/* Student Roster List Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  Daftar Roster: <span className="text-indigo-600 font-extrabold">{(classes.find(c => c.id === selectedClassId))?.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Total terdaftar: <span className="font-bold text-slate-800">{localStudents.length} siswa</span>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onRevalidatePhotos && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsRevalidating(true);
                      try {
                        await onRevalidatePhotos();
                      } finally {
                        setIsRevalidating(false);
                      }
                    }}
                    disabled={isRevalidating}
                    className="bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 disabled:opacity-50 shadow-xs"
                    title="Pemindai ulang URL foto siswa di Google Sheets dan perbarui cache localStorage agar foto langsung muncul"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRevalidating ? 'animate-spin text-indigo-600' : ''}`} />
                    <span className="hidden sm:inline">Muat Ulang Foto</span>
                  </button>
                )}

                {/* Export Student Roster per selected Class to Excel */}
                <button
                  type="button"
                  onClick={handleExportClassStudentsToExcel}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                  title="Ekspor seluruh data siswa kelas terpilih ke file Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Ekspor Excel</span>
                </button>

                {role === 'guru' && (
                  <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold">
                    Mode Lihat Saja 👁️
                  </span>
                )}

                {role === 'admin' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        cancelEdit();
                        setShowStudentModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Siswa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportedPreview([]);
                        setImportFileError('');
                        setShowImportModal(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Impor banyak siswa sekaligus via file Excel atau CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Impor Masal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRawReorderText('');
                        setReorderMode('name');
                        setAutoRenumber(true);
                        setShowReorderModal(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Sesuaikan urutan siswa dan nomor absen dengan menempelkan daftar Nama atau NIS dari sekolah"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Urutkan via Nama / NIS</span>
                    </button>
                    {isBackgroundSyncing ? (
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-indigo-200 font-bold flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {syncingStudentNis ? `Sinkronisasi NIS: ${syncingStudentNis}...` : 'Menyinkronkan otomatis...'}
                      </span>
                    ) : backgroundSyncStatus === 'success' ? (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 font-bold flex items-center gap-1.5 animate-fade-in">
                        <Check className="w-3.5 h-3.5" />
                        Tersinkron otomatis!
                      </span>
                    ) : backgroundSyncStatus === 'error' ? (
                      <span className="text-xs text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-xl border border-rose-250 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Gagal Menyinkronkan
                      </span>
                    ) : hasUnsavedChanges ? (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Ada Perubahan (Menunggu Sinkron)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-slate-400" />
                        Database Tersinkron
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Global Search Bar */}
            <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama siswa, NIS, atau no. absen..."
                  className="w-full pl-10 pr-9 py-2 bg-white text-xs rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    title="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {searchQuery.trim() !== '' && (
                <div className="text-xs text-slate-500 flex items-center justify-between sm:justify-start gap-2">
                  <span>Ditemukan <strong className="text-slate-800 font-extrabold">{filteredStudents.length}</strong> dari {localStudents.length} siswa</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer underline"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {role === 'admin' && selectedNisList.length > 0 && (
              <div className="mx-5 my-4 p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-250">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Selection info */}
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="text-sm font-bold text-indigo-950">
                      {selectedNisList.length} siswa terpilih untuk Batch Update
                    </span>
                  </div>

                  {/* Batch Actions */}
                  <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    {/* Action Selector */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-indigo-800">Berikan Label:</span>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { text: 'Ketua Kelas', bg: 'bg-white hover:bg-indigo-100 border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg py-1.5 px-3 border shadow-2xs' },
                          { text: 'OMP', bg: 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg py-1.5 px-3 border shadow-2xs' },
                          { text: 'Siswa Bermasalah', bg: 'bg-white hover:bg-rose-50 border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg py-1.5 px-3 border shadow-2xs' },
                        ].map(preset => (
                          <button
                            key={preset.text}
                            type="button"
                            onClick={() => handleBatchApplyLabel(preset.text)}
                            className={`${preset.bg} cursor-pointer transition`}
                          >
                            {preset.text}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="h-6 w-px bg-indigo-200 hidden sm:block" />
                      {/* Custom Input */}
                      <input
                        type="text"
                        placeholder="Label kustom..."
                        id="batch-custom-label"
                        className="py-1.5 px-3 bg-white text-xs rounded-lg border border-indigo-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-36"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.currentTarget as HTMLInputElement).value.trim();
                            if (val) {
                              handleBatchApplyLabel(val);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('batch-custom-label') as HTMLInputElement;
                          if (input && input.value.trim()) {
                            handleBatchApplyLabel(input.value.trim());
                            input.value = '';
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        Terapkan
                      </button>

                      <div className="h-6 w-px bg-indigo-200" />

                      {/* Clear Labels button */}
                      <button
                        type="button"
                        onClick={() => handleBatchApplyLabel('')}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                        title="Hapus label dari siswa terpilih"
                      >
                        Hapus Label
                      </button>

                      {/* Batch Delete button */}
                      <button
                        type="button"
                        onClick={handleBatchDelete}
                        className="bg-rose-600 hover:bg-rose-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                        title="Hapus siswa terpilih secara permanen dari database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus ({selectedNisList.length})
                      </button>

                      {/* Cancel selection button */}
                      <button
                        type="button"
                        onClick={() => setSelectedNisList([])}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition shrink-0 cursor-pointer"
                        title="Batalkan Pilihan"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {localStudents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  Belum ada murid dalam roster kelas ini. Gunakan formulir di samping untuk mendaftar.
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Siswa Tidak Ditemukan</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Tidak ada siswa yang cocok dengan kata kunci &quot;<span className="font-semibold text-slate-700">{searchQuery}</span>&quot; di kelas ini.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    Reset Pencarian
                  </button>
                </div>
              ) : (
                <>
                  {/* Mobile view: Roster Card List */}
                  <div className="block md:hidden space-y-3 p-4 bg-slate-50/50">
                    {visibleStudents.map((student, idx) => (
                      <div key={student.nis} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 animate-in fade-in duration-200">
                        <div className="flex items-center gap-3 min-w-0">
                          {role === 'admin' && (
                            <input
                              type="checkbox"
                              checked={selectedNisList.includes(student.nis)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedNisList(prev => [...prev, student.nis]);
                                } else {
                                  setSelectedNisList(prev => prev.filter(nis => nis !== student.nis));
                                }
                              }}
                              className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0 cursor-pointer mr-1"
                            />
                          )}
                          {/* Absen No */}
                          <span className="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-mono font-extrabold text-xs shrink-0">
                            #{student.noAbsen || (idx + 1)}
                          </span>

                          {/* Student Photo */}
                          <div className="relative shrink-0">
                            {student.foto ? (
                              <img
                                src={getStudentPhotoUrl(student.foto)}
                                alt={student.nama}
                                referrerPolicy="no-referrer"
                                onError={(e) => handleStudentPhotoError(e, student.foto)}
                                className={`w-11 h-11 object-cover rounded-full border border-slate-200 cursor-pointer ${
                                  syncingStudentNis === student.nis ? 'opacity-40 animate-pulse' : ''
                                }`}
                                onClick={() => {
                                  if (syncingStudentNis !== student.nis) {
                                    setZoomedPhoto(student.foto || null);
                                    setZoomedName(student.nama);
                                  }
                                }}
                              />
                            ) : (
                              <div className={`w-11 h-11 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 ${
                                syncingStudentNis === student.nis ? 'opacity-40' : ''
                              }`}>
                                <User className="w-5 h-5" />
                              </div>
                            )}
                            {syncingStudentNis === student.nis && (
                              <div className="absolute inset-0 flex items-center justify-center bg-indigo-50/40 rounded-full">
                                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                              </div>
                            )}
                          </div>

                          {/* Name & NIS & Gender */}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 text-sm block truncate flex items-center gap-1.5">
                              {student.nama}
                              {syncingStudentNis === student.nis && (
                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded-md animate-pulse">
                                  Sync...
                                </span>
                              )}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-400">NIS: {student.nis}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span className={`text-[10px] font-bold ${
                                student.jenisKelamin === 'P' ? 'text-pink-600' : 'text-blue-600'
                              }`}>
                                {student.jenisKelamin === 'P' ? 'P' : 'L'}
                              </span>
                            </div>
                            {student.label && (
                              <div className="mt-1 flex">
                                {(() => {
                                  let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                                  if (student.label.toLowerCase().includes("ketua kelas")) {
                                    bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                                  } else if (student.label.toLowerCase().includes("osis") || student.label.toLowerCase().includes("omp")) {
                                    bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                  } else if (student.label.toLowerCase().includes("bermasalah")) {
                                    bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                                  }
                                  const displayVal = student.label.toUpperCase() === 'OSIS' ? 'OMP' : student.label;
                                  return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${bgClass}`}>
                                      {displayVal}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {role === 'admin' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(student)}
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Edit Siswa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(student)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop view: Standard table */}
                  <div className="overflow-x-auto">
                    <table className="hidden md:table w-full min-w-[650px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold text-xs lg:text-sm tracking-wider uppercase border-b border-slate-200">
                        {role === 'admin' && (
                          <th className="py-2.5 px-4 lg:py-3.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={filteredStudents.length > 0 && selectedNisList.length === filteredStudents.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedNisList(filteredStudents.map(s => s.nis));
                                } else {
                                  setSelectedNisList([]);
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                          </th>
                        )}
                        <th className="py-2.5 px-5 lg:py-3.5">No. Absen</th>
                        <th className="py-2.5 px-5 lg:py-3.5 w-16">Foto</th>
                        <th className="py-2.5 px-5 lg:py-3.5">NIS (Angka)</th>
                        <th className="py-2.5 px-5 lg:py-3.5">Nama Lengkap</th>
                        <th className="py-2.5 px-5 lg:py-3.5">Jenis Kelamin</th>
                        {role === 'admin' && <th className="py-2.5 px-5 lg:py-3.5 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleStudents.map((student, idx) => (
                        <tr key={student.nis} className="hover:bg-slate-50/20 transition">
                          {role === 'admin' && (
                            <td className="py-3 px-4 lg:py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={selectedNisList.includes(student.nis)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedNisList(prev => [...prev, student.nis]);
                                  } else {
                                    setSelectedNisList(prev => prev.filter(nis => nis !== student.nis));
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-3 px-5 lg:py-3.5 text-slate-600 text-sm lg:text-base font-mono font-bold">{student.noAbsen || (idx + 1)}</td>
                           <td className="py-3 px-5 lg:py-3.5">
                            <div className="relative w-10 h-10 lg:w-11 lg:h-11">
                              {student.foto ? (
                                <img
                                  src={getStudentPhotoUrl(student.foto)}
                                  alt={student.nama}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => handleStudentPhotoError(e, student.foto)}
                                  className={`w-10 h-10 lg:w-11 lg:h-11 object-cover rounded-full border border-slate-200 cursor-pointer hover:scale-105 transition duration-150 ${
                                    syncingStudentNis === student.nis ? 'opacity-40 animate-pulse' : ''
                                  }`}
                                  onClick={() => {
                                    if (syncingStudentNis !== student.nis) {
                                      setZoomedPhoto(student.foto || null);
                                      setZoomedName(student.nama);
                                    }
                                  }}
                                />
                              ) : (
                                <div className={`w-10 h-10 lg:w-11 lg:h-11 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 ${
                                  syncingStudentNis === student.nis ? 'opacity-40' : ''
                                }`}>
                                  <User className="w-5 h-5 lg:w-6 lg:h-6" />
                                </div>
                              )}
                              {syncingStudentNis === student.nis && (
                                <div className="absolute inset-0 flex items-center justify-center bg-indigo-50/40 rounded-full">
                                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 lg:py-3.5 font-mono text-sm lg:text-base text-slate-600 font-bold">{student.nis}</td>
                          <td className="py-3 px-5 lg:py-3.5 text-sm lg:text-base font-bold text-slate-800">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{student.nama}</span>
                              {student.label && (
                                (() => {
                                  let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                                  if (student.label.toLowerCase().includes("ketua kelas")) {
                                    bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                                  } else if (student.label.toLowerCase().includes("osis") || student.label.toLowerCase().includes("omp")) {
                                    bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                  } else if (student.label.toLowerCase().includes("bermasalah")) {
                                    bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                                  }
                                  const displayVal = student.label.toUpperCase() === 'OSIS' ? 'OMP' : student.label;
                                  return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${bgClass}`}>
                                      {displayVal}
                                    </span>
                                  );
                                })()
                              )}
                              {syncingStudentNis === student.nis && (
                                <span className="text-[9px] font-black tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  Sinkronisasi Database...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-xs">
                            {student.jenisKelamin === 'P' ? (
                              <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 px-2.5 py-1 rounded-full font-bold border border-pink-100">
                                Perempuan (P)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold border border-blue-100">
                                Laki-laki (L)
                              </span>
                            )}
                          </td>
                          {role === 'admin' && (
                            <td className="py-3 px-5 text-right flex justify-end gap-1.5">
                              <button
                                onClick={() => startEdit(student)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Edit Siswa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(student)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>

                  {/* Lazy Loading Sentinel and Controller */}
                  {hasMoreStudents ? (
                    <div ref={studentSentinelRef} className="py-3 px-4 border-t border-slate-200 bg-slate-50/80 text-center flex flex-col sm:flex-row items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                        <span>Menampilkan <strong className="text-slate-900 font-extrabold">{visibleStudents.length}</strong> dari <strong className="text-slate-900 font-extrabold">{totalStudentsCount}</strong> siswa (Lazy Loading Aktif)</span>
                      </div>
                      <button
                        type="button"
                        onClick={loadAllStudents}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-extrabold transition cursor-pointer"
                      >
                        Tampilkan Semua ({totalStudentsCount})
                      </button>
                    </div>
                  ) : totalStudentsCount > 40 && (
                    <div className="py-2.5 px-4 border-t border-slate-200 bg-slate-50/50 text-center text-xs font-bold text-slate-500">
                      Menampilkan seluruh <strong className="text-slate-800">{totalStudentsCount}</strong> siswa di kelas ini.
                    </div>
                  )}

                </>
              )}
            </div>
          </div>
        </div>

      {/* Rename Class Modal */}
      {editingClassId !== null && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveClassName}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                <Edit2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Ubah Nama Kelas
                </h3>
                <p className="text-xs text-slate-500">
                  Ubah nama kelas yang Anda pilih di roster.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Nama Kelas Baru
              </label>
              <input
                type="text"
                required
                value={editingClassNameInput}
                onChange={e => setEditingClassNameInput(e.target.value)}
                className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-slate-800"
                placeholder="Contoh: Kelas XI IPA 2"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditingClassId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddClass}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                <Plus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Tambah Kelas Baru
                </h3>
                <p className="text-xs text-slate-500">
                  Tambahkan kelas baru ke daftar kelas roster.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Nama Kelas Baru
              </label>
              <input
                type="text"
                required
                value={newClassNameInput}
                onChange={e => setNewClassNameInput(e.target.value)}
                className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-slate-800"
                placeholder="Contoh: Kelas 8.12"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddClassModal(false);
                  setNewClassNameInput('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                disabled={isAddingClass}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isAddingClass}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isAddingClass ? 'Menyimpan...' : 'Tambah Kelas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Kelas {classToDelete.name}?
                </h3>
                <p className="text-xs text-slate-500 font-bold font-mono">
                  ID KELAS: {classToDelete.id}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-rose-50/30 border border-rose-100 rounded-xl p-3.5 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus kelas ini? Tindakan ini akan langsung menghapus kelas dari spreadsheet pada sheet <strong>Daftar Kelas</strong>.
              </p>
              <p className="text-[10px] text-rose-700 font-semibold bg-white/85 p-2 rounded-lg border border-rose-100">
                ⚠️ PERINGATAN: Semua roster siswa yang terdaftar di kelas ini juga akan otomatis dihapus dari sheet Siswa, Nilai Formatif, Nilai Sumatif, dan Rekap Bulanan untuk menjaga sinkronisasi database!
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                disabled={isDeletingClass}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteClass}
                disabled={isDeletingClass}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingClass ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  'Hapus Kelas'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Siswa dari Roster?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {studentToDelete.nama} (NIS: {studentToDelete.nis})
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-rose-50/30 border border-rose-100 rounded-xl p-3.5 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus siswa ini? Tindakan ini akan langsung menghapus data siswa dari database Google Sheets secara otomatis.
              </p>
              <p className="text-[10px] text-rose-700 font-medium bg-white/80 p-2 rounded-lg border border-rose-100">
                ⚠️ PERINGATAN: Nilai formatif, sumatif, dan rekap bulanan untuk siswa ini juga akan otomatis dibersihkan agar database tetap sinkron dan rapi.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteStudent}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Hapus Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom Modal Overlay */}
      {zoomedPhoto && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 z-50 animate-in fade-in duration-200"
          onClick={() => setZoomedPhoto(null)}
        >
          <div 
            className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl max-w-lg md:max-w-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h4 className="text-base font-extrabold text-slate-100 leading-tight">{zoomedName}</h4>
                <p className="text-[10px] text-indigo-400 font-bold mt-0.5 uppercase tracking-wider">Pratinjau Foto Kualitas HD</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPhoto(null)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 bg-slate-950 flex items-center justify-center p-4 md:p-6 min-h-[300px] md:min-h-[420px] select-none shadow-inner">
              <img 
                src={getStudentPhotoUrl(zoomedPhoto)} 
                alt={zoomedName} 
                referrerPolicy="no-referrer"
                onError={(e) => handleStudentPhotoError(e, zoomedPhoto || undefined)}
                className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl border border-slate-800/50"
              />
            </div>

            <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-400 text-center sm:text-left leading-relaxed">
                Gunakan klik kanan atau tahan layar pada ponsel untuk menyimpan foto beresolusi penuh.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={zoomedPhoto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer border border-slate-700 hover:border-slate-600"
                >
                  Buka Tab Baru ↗
                </a>
                <button
                  type="button"
                  onClick={() => setZoomedPhoto(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Add/Edit Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 relative my-8">
            <button
              type="button"
              onClick={cancelEdit}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                {editingNis ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  {editingNis ? 'Edit Detail Siswa' : 'Tambah Siswa Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingNis ? 'Perbarui data siswa yang terdaftar di roster.' : 'Tambahkan siswa baru ke roster kelas ini.'}
                </p>
              </div>
            </div>

            {role === 'guru' ? (
              <div className="space-y-4">
                <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Akses Terbatas (Mode Guru)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Anda sedang dalam <strong>Mode Guru (Hanya Baca)</strong>. Hanya pengguna dengan peran <strong>Admin</strong> yang diperbolehkan menambah, mengedit, atau menghapus data murid dalam roster kelas ini.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  💡 <strong>Tips:</strong> Klik tombol peran <strong>"Admin 🔑"</strong> di menu kanan atas untuk membuka kunci akses penuh penambahan dan pengeditan data siswa.
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddOrUpdate} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    No. Absen
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1"
                    value={noAbsenInput}
                    onChange={e => setNoAbsenInput(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nomor Induk Siswa (NIS)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 12007"
                    value={nisInput}
                    onChange={e => setNisInput(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nama Lengkap Murid
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Galih Permana"
                    value={namaInput}
                    onChange={e => setNamaInput(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Foto Siswa
                  </label>
                  {isCameraActive ? (
                    <div className="space-y-3 border border-slate-200 rounded-2xl p-3 bg-slate-50">
                      <div className="relative aspect-square max-w-[320px] mx-auto w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        {/* Elegant Guide Frame in center for perfect portrait placement */}
                        <div className="absolute inset-4 border border-dashed border-white/40 rounded-full pointer-events-none flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-white/50 rounded-full" />
                        </div>
                        <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                          Live 1:1
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs font-sans"
                        >
                          <Camera className="w-4 h-4" /> Ambil Foto
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {fotoInput ? (
                        <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                          <div className="relative shrink-0">
                            <img
                              src={getStudentPhotoUrl(fotoInput)}
                              alt="Preview"
                              referrerPolicy="no-referrer"
                              onError={(e) => handleStudentPhotoError(e, fotoInput)}
                              className="w-16 h-16 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90 shadow-2xs"
                              onClick={() => {
                                setZoomedPhoto(fotoInput);
                                setZoomedName(namaInput || 'Pratinjau Foto');
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setFotoInput('');
                                setDriveUrlInput('');
                                setShowDriveInput(false);
                              }}
                              className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition shadow-xs cursor-pointer"
                              title="Hapus Foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex-1 text-left pt-0.5 space-y-1 min-w-0">
                            {isGoogleDriveUrl(fotoInput) ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[10px] font-bold">
                                <Link className="w-3 h-3 text-blue-600 shrink-0" />
                                <span className="truncate">Tersambung Google Drive</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold">
                                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Foto Siap Disimpan</span>
                              </div>
                            )}

                            <p className="text-[10px] text-slate-500 leading-tight">
                              Klik pada foto untuk melihat ukuran penuh.
                            </p>

                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setFotoInput('');
                                  setShowDriveInput(true);
                                }}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                              >
                                Ganti Link Drive
                              </button>
                              <span className="text-slate-300">•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFotoInput('');
                                  setShowDriveInput(false);
                                }}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                              >
                                Hapus Foto
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2 w-full">
                            {/* Opsi 1: Kamera Langsung */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowDriveInput(false);
                                startCamera();
                              }}
                              className="border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 rounded-xl p-2.5 text-center transition flex flex-col items-center justify-center cursor-pointer min-h-[72px]"
                            >
                              <Camera className="w-4.5 h-4.5 text-indigo-500 mb-1" />
                              <span className="text-[10px] font-bold text-slate-700 block">Kamera</span>
                              <span className="text-[8px] text-slate-400 block leading-tight">Live 1:1</span>
                            </button>

                            {/* Opsi 2: Unggah Berkas */}
                            <label className="border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 rounded-xl p-2.5 text-center transition flex flex-col items-center justify-center cursor-pointer min-h-[72px]">
                              <Image className="w-4.5 h-4.5 text-indigo-500 mb-1" />
                              <span className="text-[10px] font-bold text-slate-700 block">Galeri</span>
                              <span className="text-[8px] text-slate-400 block leading-tight">File lokal</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setIsUploading(true);
                                    try {
                                      const compressed = await optimizeStudentPhoto(file);
                                      setFotoInput(compressed);
                                    } catch (err) {
                                      console.error(err);
                                      setErrorText('Gagal mengunggah & mengompres foto.');
                                    } finally {
                                      setIsUploading(false);
                                    }
                                  }
                                }}
                              />
                            </label>

                            {/* Opsi 3: Link Google Drive */}
                            <button
                              type="button"
                              onClick={() => setShowDriveInput(!showDriveInput)}
                              className={`border border-dashed rounded-xl p-2.5 text-center transition flex flex-col items-center justify-center cursor-pointer min-h-[72px] ${
                                showDriveInput
                                  ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-200'
                                  : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/20'
                              }`}
                            >
                              <Link className="w-4.5 h-4.5 text-blue-600 mb-1" />
                              <span className="text-[10px] font-bold text-slate-700 block">Link Drive</span>
                              <span className="text-[8px] text-blue-600 font-semibold block leading-tight">Google Drive</span>
                            </button>
                          </div>

                          {/* Input Link Google Drive */}
                          {showDriveInput && (
                            <div className="space-y-2 border border-blue-200 rounded-2xl p-3 bg-blue-50/60 transition-all animate-in fade-in duration-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                                  <Link className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  Link Gambar Google Drive
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowDriveInput(false)}
                                  className="text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer"
                                >
                                  Tutup
                                </button>
                              </div>

                              <div className="flex gap-1.5">
                                <input
                                  type="url"
                                  placeholder="Tempel link Google Drive di sini..."
                                  value={driveUrlInput}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDriveUrlInput(val);
                                    const converted = convertGoogleDriveUrl(val);
                                    if (converted) {
                                      setFotoInput(converted);
                                    }
                                  }}
                                  className="flex-1 py-1.5 px-3 text-xs rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono text-slate-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const converted = convertGoogleDriveUrl(driveUrlInput);
                                    if (converted) {
                                      setFotoInput(converted);
                                    } else {
                                      setErrorText('Format link Google Drive tidak valid.');
                                    }
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Gunakan
                                </button>
                              </div>

                              <p className="text-[10px] text-blue-800/80 leading-relaxed">
                                💡 <strong>Petunjuk:</strong> Gunakan link dari tombol <em>"Bagikan"</em> di Google Drive dengan opsi akses <em>"Siapa saja yang memiliki link"</em>.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Label / Peran Khusus Siswa
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { text: 'Ketua Kelas', activeBg: 'bg-indigo-600 border-indigo-600 text-white shadow-xs' },
                        { text: 'OMP', activeBg: 'bg-emerald-600 border-emerald-600 text-white shadow-xs' },
                        { text: 'Siswa Bermasalah', activeBg: 'bg-rose-600 border-rose-600 text-white shadow-xs' },
                      ].map((preset) => {
                        const isActive = labelInput === preset.text;
                        return (
                          <button
                            key={preset.text}
                            type="button"
                            onClick={() => setLabelInput(isActive ? '' : preset.text)}
                            className={`py-1.5 px-3 rounded-full border text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              isActive
                                ? preset.activeBg
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            {preset.text}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      placeholder="Atau masukkan label kustom... (misal: Bendahara, Sekretaris)"
                      value={labelInput}
                      onChange={e => setLabelInput(e.target.value)}
                      className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Jenis Kelamin
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setGenderInput('L')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        genderInput === 'L'
                          ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      Laki-laki (L)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenderInput('P')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        genderInput === 'P'
                          ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-xs'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      Perempuan (P)
                    </button>
                  </div>
                </div>

                {errorText && (
                  <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorText}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {editingNis ? (
                      <>
                        <Check className="w-4 h-4" /> Perbarui
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Tambah ke Daftar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 px-3 rounded-xl text-sm font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed space-y-1 text-left">
              <p className="font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                PENTING UNTUK GURU:
              </p>
              <p>
                Setiap kali Anda menambah atau mengedit nama siswa, sistem akan langsung menyinkronkan data secara otomatis ke database Google Sheets secara real-time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Excel/CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 space-y-5 relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Impor Siswa Secara Masal</h3>
                  <p className="text-xs font-medium text-slate-500">
                    Tambah banyak siswa ke <span className="font-extrabold text-indigo-600">{(classes.find(c => c.id === selectedClassId))?.name}</span> sekaligus.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto space-y-4 pr-1 text-left flex-1">
              {/* Step 1: Download Template Banner */}
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    Langkah 1: Format Excel
                  </span>
                  <p className="text-xs font-bold text-emerald-950">
                    Download format file Excel resmi untuk mengisikan data siswa.
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Format menyertakan kolom: No Absen, NIS, Nama Siswa, Jenis Kelamin (L/P), &amp; Label/Catatan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Format (.xlsx)</span>
                </button>
              </div>

              {/* Step 2: File Upload Zone */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Langkah 2: Pilih &amp; Unggah File Excel / CSV
                </label>
                <label className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition group">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleExcelFileParse(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 group-hover:border-emerald-300 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 shadow-2xs transition mb-2">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800 group-hover:text-emerald-700">
                    Klik untuk memilih file Excel (.xlsx / .csv)
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Atau seret dan lepas file ke area ini
                  </span>
                </label>
              </div>

              {/* Error Alert */}
              {importFileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importFileError}</span>
                </div>
              )}

              {/* Step 3: Parsed Data Preview */}
              {importedPreview.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Pratinjau Data ({importedPreview.length} Siswa Terbaca)
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Klik 'Proses Impor' di bawah untuk menyimpan
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">No. Absen</th>
                          <th className="py-2 px-3">NIS</th>
                          <th className="py-2 px-3">Nama Siswa</th>
                          <th className="py-2 px-3">L/P</th>
                          <th className="py-2 px-3">Label</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {importedPreview.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-600">{item.noAbsen || (index + 1)}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{item.nis || '-'}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{item.nama}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                item.jenisKelamin === 'P' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {item.jenisKelamin}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-500">{item.label || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importedPreview.length === 0 || isImporting}
                onClick={handleConfirmBulkImport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-black rounded-xl shadow-md shadow-emerald-100 transition cursor-pointer flex items-center gap-1.5"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Proses Impor ({importedPreview.length} Siswa)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reorder by Name or NIS Modal */}
      {showReorderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-purple-50/70 to-indigo-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
                  <ArrowUpDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Sesuaikan Urutan &amp; No. Absen Siswa
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Kelas: <strong className="text-purple-700 font-bold">{classes.find(c => c.id === selectedClassId)?.name}</strong> • Total <strong className="text-slate-800 font-bold">{localStudents.length} Siswa</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReorderModal(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Mode Switcher Tabs */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Metode Pencocokan Urutan
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setReorderMode('name')}
                    className={`py-2.5 px-3 rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                      reorderMode === 'name'
                        ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ListOrdered className="w-4 h-4" />
                    <span>Urutkan via Daftar Nama Siswa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReorderMode('nis')}
                    className={`py-2.5 px-3 rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                      reorderMode === 'nis'
                        ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Urutkan via Daftar NIS / NISN</span>
                  </button>
                </div>
              </div>

              {/* Instructions Guide */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl text-xs text-purple-950 space-y-1.5">
                <div className="flex items-center gap-1.5 font-black text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Petunjuk Penggunaan Cepat:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-purple-800">
                  {reorderMode === 'name' ? (
                    <>
                      Salin (*copy*) daftar nama siswa dari dokumen Word, Excel, PDF absen sekolah, atau buku induk, lalu tempelkan (*paste*) pada kotak di bawah (satu nama per baris). Sistem cerdas otomatis membersihkan nomor di depan nama (misal: <em>1. Ahmad Dahlan</em>).
                    </>
                  ) : (
                    <>
                      Salin (*copy*) daftar nomor NIS/NISN siswa dari database sekolah atau Dapodik, lalu tempelkan (*paste*) pada kotak di bawah (satu NIS per baris).
                    </>
                  )}
                </p>
              </div>

              {/* Text Input Area with Quick Copy Button */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Tempelkan Daftar {reorderMode === 'name' ? 'Nama Siswa' : 'NIS Siswa'}</span>
                    {rawReorderText.trim() && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {reorderPreview.totalInputLines} baris teks
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyCurrentRosterToClipboard}
                    className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 cursor-pointer bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition shadow-2xs"
                    title="Isi kotak teks dengan urutan siswa saat ini untuk memudahkan pengeditan manual"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-extrabold">Tersalin ke Kotak!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-purple-600" />
                        <span>Muat Urutan Saat Ini</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={rawReorderText}
                  onChange={(e) => setRawReorderText(e.target.value)}
                  placeholder={
                    reorderMode === 'name'
                      ? 'Contoh:\n1. Ahmad Dahlan\n2. Budi Santoso\n3. Citra Lestari\n(Atau salin kolom nama langsung dari Excel absen sekolah)'
                      : 'Contoh:\n12001\n12002\n12003\n(Atau salin kolom NIS langsung dari Excel/Dapodik)'
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs text-slate-800 font-mono placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition resize-y shadow-inner"
                />
              </div>

              {/* Parsing Match Statistics & Warnings */}
              {rawReorderText.trim() !== '' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                      <span className="block text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                        Siswa Cocok
                      </span>
                      <strong className="text-lg font-black text-emerald-900">
                        {reorderPreview.matchedCount} / {localStudents.length}
                      </strong>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                      <span className="block text-[10px] font-black text-amber-700 uppercase tracking-wider">
                        Di Akhir Urutan
                      </span>
                      <strong className="text-lg font-black text-amber-900">
                        {reorderPreview.unmatchedLocalStudents.length} Siswa
                      </strong>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <span className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                        Baris Teks Diinput
                      </span>
                      <strong className="text-lg font-black text-slate-900">
                        {reorderPreview.totalInputLines} Baris
                      </strong>
                    </div>
                  </div>

                  {/* Warning if some input lines couldn't be matched */}
                  {reorderPreview.unmatchedInputLines.length > 0 && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{reorderPreview.unmatchedInputLines.length} baris teks tidak ditemukan di kelas ini:</span>
                      </div>
                      <div className="max-h-20 overflow-y-auto pl-5 font-mono text-[11px] list-disc space-y-0.5 text-amber-800">
                        {reorderPreview.unmatchedInputLines.map((line, idx) => (
                          <div key={idx}>• "{line}"</div>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-700 pt-0.5">
                        *Baris yang tidak cocok diabaikan, seluruh data siswa yang ada di kelas ini tetap aman dan tidak terhapus.
                      </p>
                    </div>
                  )}

                  {/* Live Order Preview Table */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-purple-600" />
                        Pratinjau Urutan Baru Absen
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        {reorderPreview.orderedStudents.length} Siswa
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">No. Baru</th>
                            <th className="py-2 px-3">NIS</th>
                            <th className="py-2 px-3">Nama Siswa</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {reorderPreview.orderedStudents.map((student, index) => {
                            const isMatchedFromInput = index < reorderPreview.matchedCount;
                            return (
                              <tr key={student.nis} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono font-black text-purple-700">
                                  {autoRenumber ? index + 1 : (student.noAbsen || index + 1)}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">
                                  {student.nis}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  {student.nama}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isMatchedFromInput ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Cocok (#{index + 1})
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200" title="Siswa tidak tercantum di teks input, otomatis diletakkan di bagian akhir">
                                      Urutan Akhir
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Renumber Checkbox Option */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRenumber}
                    onChange={(e) => setAutoRenumber(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 transition cursor-pointer"
                  />
                  <div className="text-xs">
                    <strong className="text-slate-800 font-bold block">
                      Otomatis atur Nomor Absen menjadi 1, 2, 3, ... berurutan
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Sistem akan menyamakan No. Absen setiap siswa dengan posisi baris barunya.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowReorderModal(false)}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition cursor-pointer shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={rawReorderText.trim() === '' || isApplyingReorder || reorderPreview.orderedStudents.length === 0}
                onClick={handleApplyReorder}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-black rounded-xl shadow-md shadow-purple-100 transition cursor-pointer flex items-center gap-1.5"
              >
                {isApplyingReorder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Urutan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Terapkan &amp; Simpan Urutan Absen ({reorderPreview.orderedStudents.length} Siswa)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
