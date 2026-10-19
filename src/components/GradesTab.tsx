import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { 
  Student, 
  GradeFormative, 
  GradeSummative, 
  GradeAttitude, 
  GradeColumn, 
  MonthlyRecap, 
  StudentNote, 
  AttendanceRecord,
  GradeWeightConfig 
} from '../types';
import { DEFAULT_GRADE_WEIGHTS, KKTP_STANDARD, calculateFairRemedialScore } from '../utils/gradeCalculator';
import AttitudeGradesView from './AttitudeGradesView';
import FinalGradesView from './FinalGradesView';
import StudentGradeHistoryModal from './StudentGradeHistoryModal';
import { getStudentPhotoUrl, handleStudentPhotoError } from '../lib/photoOptimizer';
import { isClassMatch, formatDisplayClassName } from '../utils/textHelper';
import { Search, Save, Check, AlertCircle, Sparkles, Loader2, BookOpen, GraduationCap, User, X, Copy, Send, MessageSquare, Share2, Eye, Edit3, Trash2, FileText, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, Table, HelpCircle, Info, HeartHandshake, Percent, Award, Target, Database, Users, ShieldAlert, UserX, UserCheck, Filter, XCircle } from 'lucide-react';

interface GradesTabProps {
  students: Student[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  attitudeGrades?: GradeAttitude[];
  onSave: (
    formative: GradeFormative[],
    summative: GradeSummative[],
    customFormativeCols?: GradeColumn[],
    customSummativeCols?: GradeColumn[]
  ) => Promise<void>;
  onSaveAttitude?: (records: GradeAttitude[]) => Promise<void>;
  formativeCols?: GradeColumn[];
  setFormativeCols?: React.Dispatch<React.SetStateAction<GradeColumn[]>>;
  summativeCols?: GradeColumn[];
  setSummativeCols?: React.Dispatch<React.SetStateAction<GradeColumn[]>>;
  formativeColsSem1?: GradeColumn[];
  formativeColsSem2?: GradeColumn[];
  summativeColsSem1?: GradeColumn[];
  summativeColsSem2?: GradeColumn[];
  selectedSemester?: 1 | 2;
  gradeWeights?: GradeWeightConfig;
  studentNotes?: StudentNote[];
  attendance?: AttendanceRecord[];
  recap?: MonthlyRecap[];
}

const DEFAULT_FORMATIVE_COLS: GradeColumn[] = [
  { key: 'f1', label: 'Formatif 1 (F1)' },
  { key: 'f2', label: 'Formatif 2 (F2)' },
  { key: 'f3', label: 'Formatif 3 (F3)' },
  { key: 'f4', label: 'Formatif 4 (F4)' }
];

const DEFAULT_SUMMATIVE_COLS: GradeColumn[] = [
  { key: 's1', label: 'Sumatif 1 (S1)' },
  { key: 's2', label: 'Sumatif 2 (S2)' },
  { key: 's3', label: 'Sumatif 3 (S3)' },
  { key: 'uas', label: 'UAS' }
];

const getColShortLabel = (col: GradeColumn) => {
  if (!col) return '';
  const keyLower = col.key.toLowerCase();
  const fMatch = keyLower.match(/^f(\d+)$/);
  if (fMatch) return `F${fMatch[1]}`;
  const sMatch = keyLower.match(/^s(\d+)$/);
  if (sMatch) return `S${sMatch[1]}`;
  if (keyLower === 'uas') return 'UAS';
  return col.label.match(/\(([^)]+)\)/)?.[1] || col.label;
};

export default function GradesTab({
  students,
  formativeGrades,
  summativeGrades,
  attitudeGrades = [],
  onSave,
  onSaveAttitude,
  formativeCols = [],
  setFormativeCols,
  summativeCols = [],
  setSummativeCols,
  formativeColsSem1,
  formativeColsSem2,
  summativeColsSem1,
  summativeColsSem2,
  selectedSemester = 1,
  gradeWeights = DEFAULT_GRADE_WEIGHTS,
  studentNotes = [],
  attendance = [],
  recap = []
}: GradesTabProps) {
  const [gradeType, setGradeType] = useState<'formative' | 'summative' | 'attitude' | 'final'>('formative');
  const [searchQuery, setSearchQuery] = useState('');
  const [localFormative, setLocalFormative] = useState<GradeFormative[]>([]);
  const [localSummative, setLocalSummative] = useState<GradeSummative[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [zoomedName, setZoomedName] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [showRemedial, setShowRemedial] = useState(true);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const currentClassName = students[0]?.kelas || '';

  // Helper to validate and clamp grade to [0, 100] or null
  const sanitizeGradeValue = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    if (isNaN(num)) return null;
    if (num < 0) return 0;
    if (num > 100) return 100;
    return parseFloat(num.toFixed(1));
  };

  // Helper to sanitize an entire grade record before dispatching/saving to Firebase
  const sanitizeGradeRecords = <T extends GradeFormative | GradeSummative>(records: T[]): T[] => {
    return records.map(record => {
      const sanitized: any = { ...record };
      Object.keys(sanitized).forEach(key => {
        // Only sanitize grade values (f1, f2, s1, uas, rem_*, rataRata, etc.)
        if (
          key !== 'nis' &&
          key !== 'nama' &&
          key !== 'kelas' &&
          key !== 'jenisKelamin' &&
          key !== 'semester' &&
          key !== 'createdAt' &&
          key !== 'updatedAt' &&
          key !== 'noAbsen'
        ) {
          sanitized[key] = sanitizeGradeValue(sanitized[key]);
        }
      });
      return sanitized as T;
    });
  };

  // Scroll to top when changing gradeType (Formatif / Sumatif)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [gradeType]);

  // Missing Grades Modal State
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<Student | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [selectedColKey, setSelectedColKey] = useState<string>('all');
  const [customMessageText, setCustomMessageText] = useState<string>('');
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Task Detail Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalCol, setTaskModalCol] = useState<GradeColumn | null>(null);
  const [taskModalType, setTaskModalType] = useState<'formative' | 'summative'>('formative');
  const [taskDescText, setTaskDescText] = useState<string>('');
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [saveTaskStatus, setSaveTaskStatus] = useState<'idle' | 'success'>('idle');

  // Import/Export Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetCol, setImportTargetCol] = useState<string>('all');
  const [rawImportData, setRawImportData] = useState<Record<string, any>[]>([]);
  const [importedPreview, setImportedPreview] = useState<{
    idx: number;
    nis: string;
    nama: string;
    matchedStudent?: Student;
    scores: { [colKey: string]: number | null };
    hasScores: boolean;
    status: 'matched' | 'unmatched';
    matchReason?: string;
    rowClass?: string;
  }[]>([]);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importFileWarning, setImportFileWarning] = useState<string | null>(null);
  const [importDetectedClass, setImportDetectedClass] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [excludeMismatches, setExcludeMismatches] = useState<boolean>(true);
  const [excludedRowIndices, setExcludedRowIndices] = useState<number[]>([]);
  const [rosterFilterTab, setRosterFilterTab] = useState<'all' | 'matched' | 'unexpected' | 'missing'>('all');

  const openTaskModal = (col: GradeColumn, type: 'formative' | 'summative') => {
    setTaskModalCol(col);
    setTaskModalType(type);
    setTaskDescText(col.description || '');
    setIsEditingTask(!col.description);
    setIsConfirmingDelete(false);
    setShowTaskModal(true);
  };

  const handleSaveTaskDescription = async () => {
    if (!taskModalCol) return;
    setIsSaving(true);
    const newDesc = taskDescText.trim();
    try {
      const sanitizedFormative = sanitizeGradeRecords(localFormative);
      const sanitizedSummative = sanitizeGradeRecords(localSummative);
      if (taskModalType === 'formative') {
        const currentCols = formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS;
        const updatedCols = currentCols.map(c => c.key === taskModalCol.key ? { ...c, description: newDesc } : c);
        if (setFormativeCols) setFormativeCols(updatedCols);
        await onSave(sanitizedFormative, sanitizedSummative, updatedCols, activeSummativeCols);
      } else {
        const currentCols = summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS;
        const updatedCols = currentCols.map(c => c.key === taskModalCol.key ? { ...c, description: newDesc } : c);
        if (setSummativeCols) setSummativeCols(updatedCols);
        await onSave(sanitizedFormative, sanitizedSummative, activeFormativeCols, updatedCols);
      }
      setTaskModalCol(prev => prev ? { ...prev, description: newDesc } : null);
      setIsEditingTask(false);
      setIsConfirmingDelete(false);
      setSaveTaskStatus('success');
      setTimeout(() => setSaveTaskStatus('idle'), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTaskDescription = async () => {
    if (!taskModalCol) return;
    setTaskDescText('');
    setIsSaving(true);
    try {
      const sanitizedFormative = sanitizeGradeRecords(localFormative);
      const sanitizedSummative = sanitizeGradeRecords(localSummative);
      if (taskModalType === 'formative') {
        const currentCols = formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS;
        const updatedCols = currentCols.map(c => c.key === taskModalCol.key ? { ...c, description: '' } : c);
        if (setFormativeCols) setFormativeCols(updatedCols);
        await onSave(sanitizedFormative, sanitizedSummative, updatedCols, activeSummativeCols);
      } else {
        const currentCols = summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS;
        const updatedCols = currentCols.map(c => c.key === taskModalCol.key ? { ...c, description: '' } : c);
        if (setSummativeCols) setSummativeCols(updatedCols);
        await onSave(sanitizedFormative, sanitizedSummative, activeFormativeCols, updatedCols);
      }
      setTaskModalCol(prev => prev ? { ...prev, description: '' } : null);
      setIsEditingTask(false);
      setIsConfirmingDelete(false);
      setSaveTaskStatus('success');
      setTimeout(() => setSaveTaskStatus('idle'), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const activeFormativeCols = formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS;
  const activeSummativeCols = (summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS).filter(c => c && c.key !== 'uts');
  const currentKktp = gradeWeights?.kktp ?? KKTP_STANDARD;

  // Helper untuk mendapatkan nilai efektif dengan memperhitungkan nilai remedial dan normalisasi adil
  const getRowEffectiveScore = (row: any, colKey: string): number | null => {
    if (!row) return null;
    const rawVal = row[colKey];
    const remVal = row[`${colKey}_rem`];
    const { effectiveScore } = calculateFairRemedialScore(rawVal, remVal, currentKktp);
    return effectiveScore;
  };

  // Export current grades to Excel with professional formatting and gridlines
  const handleExportExcel = async () => {
    if (students.length === 0) return;
    const activeCols = gradeType === 'formative' ? activeFormativeCols : activeSummativeCols;
    const gradeData = gradeType === 'formative' ? localFormative : localSummative;
    const gradeLabel = gradeType === 'formative' ? 'Formatif' : 'Sumatif';
    const className = students[0]?.kelas || 'Kelas';

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Jurnal Guru Pro';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(`Nilai ${gradeLabel}`, {
        views: [{ showGridLines: true }]
      });

      const totalCols = 5 + activeCols.length + 1;
      const getColLetter = (index: number) => {
        let temp, letter = '';
        while (index > 0) {
          temp = (index - 1) % 26;
          letter = String.fromCharCode(65 + temp) + letter;
          index = (index - temp - 1) / 26;
        }
        return letter;
      };
      const lastColLetter = getColLetter(totalCols);

      // Banner Header Title
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `REKAPITULASI DATA NILAI ${gradeLabel.toUpperCase()} - KELAS ${className.toUpperCase()}`;
      titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: gradeType === 'formative' ? 'FF1E1B4B' : 'FF064E3B' }
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      // Subtitle
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      const subCell = worksheet.getCell('A2');
      subCell.value = `Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • Total Siswa: ${students.length}`;
      subCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
      subCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      worksheet.getRow(3).height = 8; // Spacer

      // Table Headers
      const colHeaders = activeCols.map(c => c.label || getColShortLabel(c));
      const headers = ['NIS', 'Nama Siswa', 'L/P', 'Kelas', ...colHeaders, 'Rata-Rata', 'No Absen'];
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
        cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF475569' } }
        };
      });

      // Data Rows
      students.forEach((st, idx) => {
        const studentGrade = gradeData.find(g => g.nis === st.nis);
        const colScores = activeCols.map(c => {
          // Use getRowEffectiveScore so that students with remedial scores export their fair effective score
          const effVal = studentGrade ? getRowEffectiveScore(studentGrade, c.key) : null;
          return effVal !== undefined && effVal !== null && !isNaN(Number(effVal)) ? Number(effVal) : '';
        });

        const numericScores = colScores.filter((v): v is number => typeof v === 'number');
        const avgVal = studentGrade?.rataRata ?? calculateAverage(numericScores);
        const rowNum = 5 + idx;
        const row = worksheet.getRow(rowNum);

        row.values = [
          st.nis,
          st.nama,
          st.jenisKelamin || 'L',
          st.kelas || className,
          ...colScores,
          avgVal !== null && avgVal !== undefined && !isNaN(Number(avgVal)) ? Number(avgVal) : '',
          st.noAbsen || (idx + 1)
        ];

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

          if (colNum === 1) { // NIS
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Consolas', size: 10.5, color: { argb: 'FF334155' } };
          } else if (colNum === 2) { // Nama Siswa
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colNum === 3 || colNum === 4) { // L/P, Kelas
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 4 + activeCols.length + 1) { // Rata-Rata
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
            if (typeof cell.value === 'number') {
              cell.numFmt = '0.0';
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: cell.value < currentKktp ? 'FFFEF2F2' : 'FFEEF2FF' }
              };
            }
          } else if (colNum === totalCols) { // No Absen
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
          } else { // Scores
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            if (typeof cell.value === 'number') {
              cell.numFmt = '0.0';
              if (cell.value < currentKktp) {
                cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFDC2626' } };
              } else {
                cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF1D4ED8' } };
              }
            }
          }
        });
      });

      // Auto-fit Column Widths
      worksheet.columns.forEach((col, idx) => {
        if (idx === 0) col.width = 16; // NIS
        else if (idx === 1) { // Nama Siswa
          const maxNameLen = Math.max(26, ...students.map(s => (s.nama || '').length + 4));
          col.width = Math.min(maxNameLen, 45);
        }
        else if (idx === 2) col.width = 8; // L/P
        else if (idx === 3) col.width = 12; // Kelas
        else if (idx === totalCols - 1) col.width = 12; // No Absen
        else col.width = 14; // Score & Avg columns
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const timeStamp = new Date().toISOString().slice(0, 10);
      const safeClassName = className.replace(/[^a-zA-Z0-9]/g, '_');
      anchor.download = `Data_Nilai_${gradeLabel}_${safeClassName}_${timeStamp}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Excel failed:', err);
    }
  };

  // Download prefilled import format template with ExcelJS
  const handleDownloadTemplate = async () => {
    if (students.length === 0) return;
    const allActiveCols = gradeType === 'formative' ? activeFormativeCols : activeSummativeCols;
    const isSingleTarget = importTargetCol !== 'all';
    const targetColObj = isSingleTarget ? allActiveCols.find(c => c.key === importTargetCol) : null;
    const activeCols = (isSingleTarget && targetColObj) ? [targetColObj] : allActiveCols;
    const gradeLabel = gradeType === 'formative' ? 'Formatif' : 'Sumatif';
    const className = students[0]?.kelas || 'Kelas';

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Jurnal Guru Pro';

      const sheetName = targetColObj ? `Template ${getColShortLabel(targetColObj)}` : `Template ${gradeLabel}`;
      const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
        views: [{ showGridLines: true }]
      });

      const totalCols = 5 + activeCols.length;
      const getColLetter = (index: number) => {
        let temp, letter = '';
        while (index > 0) {
          temp = (index - 1) % 26;
          letter = String.fromCharCode(65 + temp) + letter;
          index = (index - temp - 1) / 26;
        }
        return letter;
      };
      const lastColLetter = getColLetter(totalCols);

      // Banner Header
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = worksheet.getCell('A1');
      const bannerTitle = targetColObj 
        ? `FORMAT IMPORT NILAI ${targetColObj.label.toUpperCase()} - KELAS ${className.toUpperCase()}`
        : `FORMAT IMPORT NILAI ${gradeLabel.toUpperCase()} - KELAS ${className.toUpperCase()}`;
      titleCell.value = bannerTitle;
      titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' }
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      // Subtitle Note
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      const subCell = worksheet.getCell('A2');
      subCell.value = targetColObj
        ? `Petunjuk: Isikan angka nilai (0-100) pada kolom nilai ${getColShortLabel(targetColObj)}. Jangan mengubah data NIS atau Nama Siswa.`
        : `Petunjuk: Isikan angka nilai (0-100) pada kolom nilai (${activeCols.map(c => getColShortLabel(c)).join(', ')}). Jangan mengubah data NIS atau Nama Siswa.`;
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
      const colHeaders = activeCols.map(c => getColShortLabel(c));
      const headers = ['NIS', 'Nama Siswa', 'L/P', 'Kelas', ...colHeaders, 'No Absen'];
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

      // Rows
      students.forEach((st, idx) => {
        const currentGrade = (gradeType === 'formative' ? localFormative : localSummative).find(g => g.nis === st.nis);
        const colVals = activeCols.map(c => {
          const effVal = currentGrade ? getRowEffectiveScore(currentGrade, c.key) : null;
          return effVal !== undefined && effVal !== null && !isNaN(Number(effVal)) ? Number(effVal) : '';
        });

        const rowNum = 5 + idx;
        const row = worksheet.getRow(rowNum);
        row.values = [
          st.nis,
          st.nama,
          st.jenisKelamin || 'L',
          st.kelas || className,
          ...colVals,
          st.noAbsen || (idx + 1)
        ];
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

          if (colNum === 1) { // NIS
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Consolas', size: 10.5, color: { argb: 'FF334155' } };
          } else if (colNum === 2) { // Nama Siswa
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colNum === 3 || colNum === 4) { // L/P, Kelas
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === totalCols) { // No Absen
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
          } else { // Score Columns
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            if (typeof cell.value === 'number') {
              cell.numFmt = '0.0';
              cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1D4ED8' } };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFBEB' } // Light warm accent for editable score cells
              };
            }
          }
        });
      });

      // Column widths
      worksheet.columns.forEach((col, idx) => {
        if (idx === 0) col.width = 16; // NIS
        else if (idx === 1) { // Nama Siswa
          const maxNameLen = Math.max(26, ...students.map(s => (s.nama || '').length + 4));
          col.width = Math.min(maxNameLen, 45);
        }
        else if (idx === 2) col.width = 8; // L/P
        else if (idx === 3) col.width = 12; // Kelas
        else if (idx === totalCols - 1) col.width = 12; // No Absen
        else col.width = 14; // Score Columns
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeClassName = className.replace(/[^a-zA-Z0-9]/g, '_');
      const fileNameSuffix = targetColObj ? `_${getColShortLabel(targetColObj)}` : '';
      anchor.download = `Format_Import_Nilai_${gradeLabel}${fileNameSuffix}_${safeClassName}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template failed:', err);
    }
  };

  // Process raw parsed rows into matched student preview based on chosen importTargetCol
  const processParsedImportRows = (
    rawRows: Record<string, any>[],
    targetColKey: string,
    targetType: 'formative' | 'summative' = (gradeType === 'summative' ? 'summative' : 'formative')
  ) => {
    const activeCols = targetType === 'formative' ? activeFormativeCols : activeSummativeCols;
    const targetColObj = activeCols.find(c => c.key === targetColKey);

    const parsedResults = rawRows.map((row, idx) => {
      const rowKeys = Object.keys(row);

      const getVal = (aliases: string[]) => {
        for (const alias of aliases) {
          if (!alias) continue;
          const matchKey = rowKeys.find(k => {
            const kClean = k.toString().trim().toLowerCase();
            // Never match remedial headers to prevent overwriting manual remedial entries
            if (kClean.includes('remidi') || kClean.includes('remedial') || kClean.startsWith('rem_')) {
              return false;
            }
            return kClean === alias.toLowerCase();
          });
          if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && String(row[matchKey]).trim() !== '') {
            return String(row[matchKey]).trim();
          }
        }
        for (const alias of aliases) {
          if (!alias || alias.length < 2) continue;
          const matchKey = rowKeys.find(k => {
            const kClean = k.toString().trim().toLowerCase();
            if (kClean.includes('remidi') || kClean.includes('remedial') || kClean.startsWith('rem_')) {
              return false;
            }
            const aClean = alias.toLowerCase();
            return kClean.includes(aClean) || aClean.includes(kClean);
          });
          if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && String(row[matchKey]).trim() !== '') {
            return String(row[matchKey]).trim();
          }
        }
        return '';
      };

      const nisRaw = getVal(['nis', 'no nis', 'nomor induk', 'id', 'nisn', 'no. nis', 'no. induk']).trim();
      const namaRaw = getVal(['nama', 'nama siswa', 'nama lengkap', 'name', 'nama murid']).trim();
      // Strictly specific aliases for attendance number. NEVER alias 'no' alone because it matches sequential row numbers!
      const noAbsenRaw = getVal(['no absen', 'no. absen', 'nomor absen', 'absen']).trim();
      const rowKelas = getVal(['kelas', 'class', 'rombel', 'tingkat/kelas']).trim();

      const cleanName = (str?: string) => {
        if (!str) return '';
        return str
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const nisClean = nisRaw.replace(/\D/g, '');
      const rowNamaClean = cleanName(namaRaw);

      // Check if this specific row is explicitly declared as a different class
      const isRowDifferentClass = Boolean(rowKelas && currentClassName && !isClassMatch(rowKelas, currentClassName));

      let matched: Student | undefined = undefined;
      let matchReason = '';

      if (isRowDifferentClass) {
        matched = undefined;
        matchReason = `Siswa Kelas ${rowKelas} (Bukan Kelas ${currentClassName || 'aktif'})`;
      } else {
        // Stage 1: Match by exact NIS
        if (nisRaw) {
          matched = students.find(s => {
            if (!s.nis) return false;
            const sNis = s.nis.trim().toLowerCase();
            const sNisClean = s.nis.replace(/\D/g, '');
            if (sNis === nisRaw.toLowerCase()) return true;
            if (nisClean.length >= 3 && sNisClean === nisClean) return true;
            return false;
          });

          if (matched) {
            // Verify student name if provided in Excel
            if (rowNamaClean.length >= 3) {
              const matchedNamaClean = cleanName(matched.nama);
              const isNameConsistent = matchedNamaClean === rowNamaClean ||
                matchedNamaClean.includes(rowNamaClean) ||
                rowNamaClean.includes(matchedNamaClean);
              if (isNameConsistent) {
                matchReason = 'NIS & Nama Cocok';
              } else {
                // Warning: NIS matches someone, but name in Excel belongs to someone else (prevent cross-student mixup)
                matched = undefined;
                matchReason = `NIS '${nisRaw}' terdaftar atas nama '${matched.nama}', tetapi di file Excel tertulis '${namaRaw}'`;
              }
            } else {
              matchReason = 'NIS Cocok';
            }
          }
        }

        // Stage 2: Match by Student Name (if NIS not matched or NIS is blank)
        if (!matched && rowNamaClean.length >= 3) {
          // Exact clean name match
          matched = students.find(s => cleanName(s.nama) === rowNamaClean);

          if (!matched) {
            // Normalized multi-word match (e.g. handle title, middle names)
            matched = students.find(s => {
              const sClean = cleanName(s.nama);
              if (!sClean) return false;
              if (sClean === rowNamaClean) return true;
              const sWords = sClean.split(' ').filter(w => w.length > 2);
              const rowWords = rowNamaClean.split(' ').filter(w => w.length > 2);
              if (sWords.length >= 2 && rowWords.length >= 2) {
                const commonWords = sWords.filter(w => rowWords.includes(w));
                return commonWords.length >= 2;
              }
              return false;
            });
          }

          if (matched) {
            matchReason = 'Nama Siswa Cocok';
          }
        }

        // Stage 3: Match by No Absen (STRICT SAFETY: NEVER match by No Absen if Nama in Excel does not match!)
        if (!matched && noAbsenRaw) {
          const numAbsen = parseInt(noAbsenRaw, 10);
          if (!isNaN(numAbsen)) {
            const candidateByAbsen = students.find(s => Number(s.noAbsen) === numAbsen);
            if (candidateByAbsen) {
              if (rowNamaClean.length >= 3) {
                const candNameClean = cleanName(candidateByAbsen.nama);
                const isNameConsistent = candNameClean === rowNamaClean ||
                  candNameClean.includes(rowNamaClean) ||
                  rowNamaClean.includes(candNameClean);
                if (isNameConsistent) {
                  matched = candidateByAbsen;
                  matchReason = 'No Absen & Nama Cocok';
                } else {
                  // CRITICAL GUARD: Name from other class (e.g. 8.9) with No Absen 1 will NOT match student 1 of 8.1!
                  matched = undefined;
                  matchReason = `Nama '${namaRaw}' tidak cocok dengan siswa No Absen ${numAbsen} (${candidateByAbsen.nama}) di Kelas ${currentClassName || 'aktif'}`;
                }
              } else if (!nisRaw) {
                // Only allowed if Excel row literally has NO name and NO NIS, only No Absen
                matched = candidateByAbsen;
                matchReason = `No Absen ${numAbsen} Cocok (File tanpa Nama/NIS)`;
              }
            }
          }
        }

        if (!matched && !matchReason) {
          matchReason = `Nama/NIS tidak terdaftar di Kelas ${currentClassName || 'aktif'}`;
        }
      }

      const scores: { [colKey: string]: number | null } = {};
      let scoreCount = 0;

      if (targetColKey === 'all') {
        // Parse all active columns
        activeCols.forEach(col => {
          const shortLabel = getColShortLabel(col).toLowerCase();
          const fullLabel = col.label.toLowerCase();
          const keyLower = col.key.toLowerCase();
          const labelNoParen = col.label.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
          const parenMatch = col.label.match(/\(([^)]+)\)/)?.[1]?.trim().toLowerCase() || '';

          const numMatch = keyLower.match(/\d+/)?.[0] || shortLabel.match(/\d+/)?.[0] || '';
          const extraAliases: string[] = [];
          if (numMatch) {
            if (keyLower.startsWith('f') || shortLabel.startsWith('f')) {
              extraAliases.push(
                `f${numMatch}`, `f ${numMatch}`,
                `formatif ${numMatch}`, `formatif${numMatch}`,
                `ph ${numMatch}`, `ph${numMatch}`,
                `uh ${numMatch}`, `uh${numMatch}`,
                `tugas ${numMatch}`, `tugas${numMatch}`,
                `penilaian harian ${numMatch}`
              );
            } else if (keyLower.startsWith('s') || shortLabel.startsWith('s')) {
              extraAliases.push(
                `s${numMatch}`, `s ${numMatch}`,
                `sumatif ${numMatch}`, `sumatif${numMatch}`,
                `lm ${numMatch}`, `lm${numMatch}`,
                `sts ${numMatch}`, `sts${numMatch}`,
                `pts ${numMatch}`, `pts${numMatch}`,
                `lingkup materi ${numMatch}`
              );
            }
          }
          if (keyLower === 'uas' || shortLabel === 'uas') {
            extraAliases.push('uas', 'sas', 'pas', 'pat', 'psat', 'asas', 'asesmen akhir', 'ujian akhir');
          }

          const aliases = Array.from(new Set([
            keyLower,
            shortLabel,
            fullLabel,
            labelNoParen,
            parenMatch,
            ...extraAliases,
            `nilai ${shortLabel}`,
            `nilai ${keyLower}`,
            `nilai ${fullLabel}`,
            `nilai ${labelNoParen}`,
            ...extraAliases.map(a => `nilai ${a}`),
          ].filter(Boolean)));

          const valStr = getVal(aliases);
          if (valStr !== '') {
            const numVal = parseFloat(valStr.replace(',', '.'));
            if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
              scores[col.key] = parseFloat(numVal.toFixed(1));
              scoreCount++;
            } else {
              scores[col.key] = null;
            }
          } else {
            scores[col.key] = null;
          }
        });
      } else if (targetColObj) {
        // Parse specifically for the selected column (e.g. F1, F2, F3 or S1, S2, S3, UAS)
        const shortLabel = getColShortLabel(targetColObj).toLowerCase();
        const fullLabel = targetColObj.label.toLowerCase();
        const keyLower = targetColObj.key.toLowerCase();
        const labelNoParen = targetColObj.label.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        const parenMatch = targetColObj.label.match(/\(([^)]+)\)/)?.[1]?.trim().toLowerCase() || '';

        const numMatch = keyLower.match(/\d+/)?.[0] || shortLabel.match(/\d+/)?.[0] || '';
        const extraAliases: string[] = [];
        if (numMatch) {
          if (keyLower.startsWith('f') || shortLabel.startsWith('f')) {
            extraAliases.push(
              `f${numMatch}`, `f ${numMatch}`,
              `formatif ${numMatch}`, `formatif${numMatch}`,
              `ph ${numMatch}`, `ph${numMatch}`,
              `uh ${numMatch}`, `uh${numMatch}`,
              `tugas ${numMatch}`, `tugas${numMatch}`,
              `penilaian harian ${numMatch}`
            );
          } else if (keyLower.startsWith('s') || shortLabel.startsWith('s')) {
            extraAliases.push(
              `s${numMatch}`, `s ${numMatch}`,
              `sumatif ${numMatch}`, `sumatif${numMatch}`,
              `lm ${numMatch}`, `lm${numMatch}`,
              `sts ${numMatch}`, `sts${numMatch}`,
              `pts ${numMatch}`, `pts${numMatch}`,
              `lingkup materi ${numMatch}`
            );
          }
        }
        if (keyLower === 'uas' || shortLabel === 'uas') {
          extraAliases.push('uas', 'sas', 'pas', 'pat', 'psat', 'asas', 'asesmen akhir', 'ujian akhir');
        }

        const specificAliases = Array.from(new Set([
          keyLower,
          shortLabel,
          fullLabel,
          labelNoParen,
          parenMatch,
          ...extraAliases,
          `nilai ${shortLabel}`,
          `nilai ${keyLower}`,
          `nilai ${fullLabel}`,
          `nilai ${labelNoParen}`,
          ...extraAliases.map(a => `nilai ${a}`),
        ].filter(Boolean)));

        let valStr = getVal(specificAliases);

        // If no column matches the specific label/key, check generic score headers
        if (!valStr) {
          valStr = getVal(['nilai', 'skor', 'score', 'angka', 'poin', 'nilai siswa', 'nilai tugas', 'nilai ulangan', 'nilai ujian', 'hasil']);
        }

        // If still not found, check if there is only 1 non-identifying data column in sheet
        if (!valStr) {
          const idKeywords = ['nis', 'nama', 'nama siswa', 'l/p', 'jk', 'jenis kelamin', 'kelas', 'no absen', 'absen', 'no', 'rombel'];
          const candidateKeys = rowKeys.filter(k => {
            const kLower = k.trim().toLowerCase();
            return !idKeywords.some(kw => kLower === kw || kLower.startsWith(`${kw} `) || kLower.endsWith(` ${kw}`)) &&
              !kLower.includes('remedial') && !kLower.includes('remidi') && !kLower.startsWith('rem_');
          });
          if (candidateKeys.length === 1 && candidateKeys[0]) {
            const singleVal = row[candidateKeys[0]];
            if (singleVal !== undefined && singleVal !== null && String(singleVal).trim() !== '') {
              valStr = String(singleVal).trim();
            }
          }
        }

        // Map ONLY to the chosen target column; leave all other columns null
        activeCols.forEach(col => {
          if (col.key === targetColObj.key) {
            if (valStr !== '') {
              const numVal = parseFloat(valStr.replace(',', '.'));
              if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
                scores[col.key] = parseFloat(numVal.toFixed(1));
                scoreCount++;
              } else {
                scores[col.key] = null;
              }
            } else {
              scores[col.key] = null;
            }
          } else {
            // Other columns remain null so they are never touched
            scores[col.key] = null;
          }
        });
      }

      return {
        idx: idx + 1,
        nis: nisClean || (matched ? matched.nis : (nisRaw || `ROW_${idx + 1}`)),
        nama: namaRaw || (matched ? matched.nama : `Siswa Baris ${idx + 1}`),
        matchedStudent: matched,
        scores,
        hasScores: scoreCount > 0,
        status: (matched ? 'matched' : 'unmatched') as 'matched' | 'unmatched',
        matchReason,
        rowClass: rowKelas
      };
    });

    return parsedResults.filter(p => p.matchedStudent || p.hasScores);
  };

  // Switch target column dynamically and re-process existing parsed data if available
  const handleTargetColChange = (
    newTarget: string,
    targetType: 'formative' | 'summative' = (gradeType === 'summative' ? 'summative' : 'formative')
  ) => {
    setImportTargetCol(newTarget);
    if (rawImportData.length > 0) {
      const updated = processParsedImportRows(rawImportData, newTarget, targetType);
      setImportedPreview(updated);
      if (updated.length === 0) {
        setImportFileError('Tidak ditemukan data nilai yang sesuai untuk kolom target yang dipilih.');
      } else {
        setImportFileError(null);
      }
    }
  };

  // Parse uploaded Excel file for grade import
  const handleParseImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileError(null);
    setImportFileName(file.name);
    setIsParsingImport(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setImportFileError('File Excel tidak memiliki sheet data.');
          setIsParsingImport(false);
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to 2D array matrix to dynamically detect header row (handles banner titles in template)
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!matrix || matrix.length === 0) {
          setImportFileError('File Excel kosong atau tidak memiliki baris data.');
          setIsParsingImport(false);
          return;
        }

        // Detect header row index by searching for row containing key student column headers (NIS, Nama, No Absen)
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(matrix.length, 12); r++) {
          const rowVals = (matrix[r] || []).map(c => String(c).trim().toLowerCase());
          const hasNisOrNama = rowVals.some(v => 
            v === 'nis' || v === 'nama' || v === 'nama siswa' || v === 'no nis' || v === 'nisn' || v === 'no. nis' || v === 'no. induk' || v === 'no' || v === 'no absen'
          );
          if (hasNisOrNama) {
            headerRowIdx = r;
            break;
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = 0; // fallback to first row if not detected
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
          setImportFileError('File Excel kosong atau tidak memiliki baris data.');
          setIsParsingImport(false);
          return;
        }

        // Detect Class from banner title row (e.g. "FORMAT IMPORT NILAI ... KELAS 8.9")
        let detectedClassFromBanner: string | null = null;
        for (let r = 0; r < Math.min(matrix.length, 6); r++) {
          const rowText = (matrix[r] || []).map(c => String(c)).join(' ');
          const bannerMatch = rowText.match(/kelas\s*([0-9a-zA-Z\.\-_]+)/i);
          if (bannerMatch && bannerMatch[1]) {
            const cand = bannerMatch[1].trim();
            if (cand.toLowerCase() !== 'siswa' && cand.toLowerCase() !== 'nilai') {
              detectedClassFromBanner = cand;
              break;
            }
          }
        }

        // Detect Class from data rows
        let detectedClassFromRows: string | null = null;
        const kelasColIdx = headerNames.findIndex(h => {
          const hClean = h.trim().toLowerCase();
          return hClean === 'kelas' || hClean === 'class' || hClean === 'rombel';
        });

        if (kelasColIdx !== -1) {
          const rowClassValues = rawRows
            .map(r => String(r[headerNames[kelasColIdx]] || '').trim())
            .filter(Boolean);
          if (rowClassValues.length > 0) {
            const counts: Record<string, number> = {};
            rowClassValues.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted[0]) {
              detectedClassFromRows = sorted[0][0];
            }
          }
        }

        const detectedFileClass = detectedClassFromRows || detectedClassFromBanner;
        setImportDetectedClass(detectedFileClass);

        if (detectedFileClass && currentClassName && !isClassMatch(detectedFileClass, currentClassName)) {
          setImportFileWarning(
            `File Excel ini terdeteksi untuk Kelas ${detectedFileClass}, sedangkan kelas yang sedang aktif dibuka adalah Kelas ${currentClassName}. Data nama dan NIS siswa dari kelas yang berbeda tidak akan dicocokkan demi melindungi integritas nilai.`
          );
        } else {
          setImportFileWarning(null);
        }

        setRawImportData(rawRows);
        const validParsed = processParsedImportRows(rawRows, importTargetCol);

        if (validParsed.length === 0) {
          setImportFileError('Gagal mencocokkan data. Pastikan file Excel memiliki kolom NIS/Nama dan kolom Nilai yang sesuai.');
        } else {
          setImportedPreview(validParsed);
        }
      } catch (err: any) {
        console.error('Import parse error:', err);
        setImportFileError('Terjadi kesalahan saat membaca file Excel. Pastikan file berformat .xlsx, .xls, atau .csv.');
      } finally {
        setIsParsingImport(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Apply parsed imported grades to local state & save
  const handleApplyImportedGrades = async () => {
    if (importedPreview.length === 0) return;
    setIsSaving(true);
    const activeCols = gradeType === 'formative' ? activeFormativeCols : activeSummativeCols;
    const isSingleTarget = importTargetCol !== 'all';

    try {
      // Filter only eligible matched rows that are not excluded
      const eligibleImportRows = importedPreview.filter(imp => {
        if (excludeMismatches && imp.status !== 'matched') return false;
        if (excludedRowIndices.includes(imp.idx)) return false;
        return imp.status === 'matched' && imp.matchedStudent !== undefined;
      });

      if (gradeType === 'formative') {
        const updatedFormative = localFormative.map(row => {
          const importRow = eligibleImportRows.find(imp => 
            imp.matchedStudent?.nis && imp.matchedStudent.nis.trim() === row.nis?.trim()
          );
          if (!importRow) return row;

          const newRow = { ...row };
          let updatedAny = false;

          if (!isSingleTarget) {
            activeCols.forEach(col => {
              const importedVal = importRow.scores[col.key];
              if (importedVal !== null && importedVal !== undefined && !isNaN(importedVal)) {
                newRow[col.key] = Math.min(100, Math.max(0, importedVal));
                updatedAny = true;
              }
            });
          } else {
            const importedVal = importRow.scores[importTargetCol];
            if (importedVal !== null && importedVal !== undefined && !isNaN(importedVal)) {
              newRow[importTargetCol] = Math.min(100, Math.max(0, importedVal));
              updatedAny = true;
            }
          }

          if (updatedAny) {
            const scores = activeCols.map(c => newRow[c.key]);
            newRow.rataRata = calculateAverage(scores);
          }
          return newRow;
        });

        const sanitizedFormative = sanitizeGradeRecords(updatedFormative);
        const sanitizedSummative = sanitizeGradeRecords(localSummative);

        setLocalFormative(sanitizedFormative);
        setIsDirty(true);
        await onSave(sanitizedFormative, sanitizedSummative, activeFormativeCols, activeSummativeCols);
      } else {
        const updatedSummative = localSummative.map(row => {
          const importRow = eligibleImportRows.find(imp => 
            imp.matchedStudent?.nis && imp.matchedStudent.nis.trim() === row.nis?.trim()
          );
          if (!importRow) return row;

          const newRow = { ...row };
          let updatedAny = false;

          if (!isSingleTarget) {
            activeCols.forEach(col => {
              const importedVal = importRow.scores[col.key];
              if (importedVal !== null && importedVal !== undefined && !isNaN(importedVal)) {
                newRow[col.key] = Math.min(100, Math.max(0, importedVal));
                updatedAny = true;
              }
            });
          } else {
            const importedVal = importRow.scores[importTargetCol];
            if (importedVal !== null && importedVal !== undefined && !isNaN(importedVal)) {
              newRow[importTargetCol] = Math.min(100, Math.max(0, importedVal));
              updatedAny = true;
            }
          }

          if (updatedAny) {
            const scores = activeCols.map(c => newRow[c.key]);
            newRow.rataRata = calculateAverage(scores);
          }
          return newRow;
        });

        const sanitizedFormative = sanitizeGradeRecords(localFormative);
        const sanitizedSummative = sanitizeGradeRecords(updatedSummative);

        setLocalSummative(sanitizedSummative);
        setIsDirty(true);
        await onSave(sanitizedFormative, sanitizedSummative, activeFormativeCols, activeSummativeCols);
      }

      setShowImportModal(false);
      setImportedPreview([]);
      setRawImportData([]);
      setImportFileName('');
      setExcludedRowIndices([]);
      setExcludeMismatches(true);
      setRosterFilterTab('all');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch (err) {
      console.error('Import save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to build broadcast text for students with missing grades
  const generateMissingGradesMessage = (
    type: 'formative' | 'summative' | 'attitude' | 'final',
    colKey: string,
    formativeList: GradeFormative[],
    summativeList: GradeSummative[],
    studentList: Student[],
    formativeColumns: GradeColumn[],
    summativeColumns: GradeColumn[]
  ): string => {
    const isFormative = type === 'formative';
    const currentColumns = isFormative ? formativeColumns : summativeColumns;
    const currentGrades = isFormative ? formativeList : summativeList;
    const categoryTitle = isFormative ? 'Formatif (Harian)' : 'Sumatif (Akhir Bab / UAS)';
    const kelasName = studentList[0]?.kelas || 'Kelas';

    if (colKey === 'all') {
      const missingItems = studentList.map((s, idx) => {
        const row = currentGrades.find(g => g.nis === s.nis);
        const missingCols: string[] = [];
        currentColumns.forEach(col => {
          const val = row ? row[col.key] : null;
          if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
            missingCols.push(getColShortLabel(col));
          }
        });
        const rawAbsen = s.noAbsen ? String(s.noAbsen).replace(/^no\.?\s*/i, '').trim() : String(idx + 1);
        return {
          student: s,
          noAbsen: rawAbsen,
          missingCols
        };
      }).filter(item => item.missingCols.length > 0);

      missingItems.sort((a, b) => parseInt(a.noAbsen || '999', 10) - parseInt(b.noAbsen || '999', 10));

      if (missingItems.length === 0) {
        return `📢 *INFORMASI KELENGKAPAN NILAI*\n` +
               `Kelas: *${kelasName}*\n` +
               `Kategori: *Nilai ${categoryTitle}*\n\n` +
               `✨ *Luar biasa! Seluruh siswa (${studentList.length} siswa) sudah tuntas dan memiliki nilai lengkap.* 🎉`;
      }

      const lines = missingItems.map((item, i) => {
        const absen = item.noAbsen ? `(No. Absen ${item.noAbsen})` : '';
        return `${i + 1}. ${item.student.nama} ${absen}\n   └ Belum: [${item.missingCols.join(', ')}]`;
      }).join('\n\n');

      return `📢 *INFORMASI KELENGKAPAN NILAI ${categoryTitle.toUpperCase()}*\n` +
             `Kelas: *${kelasName}*\n\n` +
             `Berikut adalah daftar *${missingItems.length} siswa* yang masih memiliki nilai belum tuntas / kosong:\n\n` +
             `${lines}\n\n` +
             `Mohon bagi siswa yang bersangkutan untuk dapat segera menghubungi guru mapel / mengumpulkan tugas. Terima kasih! 🙏`;
    } else {
      const colObj = currentColumns.find(c => c.key === colKey) || currentColumns[0];
      const colName = colObj?.label || getColShortLabel(colObj);

      const missingStudents = studentList.map((s, idx) => {
        const row = currentGrades.find(g => g.nis === s.nis);
        const val = row ? row[colObj.key] : null;
        const isMissing = val === null || val === undefined || val === '' || isNaN(Number(val));
        const rawAbsen = s.noAbsen ? String(s.noAbsen).replace(/^no\.?\s*/i, '').trim() : String(idx + 1);
        return {
          student: s,
          noAbsen: rawAbsen,
          isMissing
        };
      }).filter(x => x.isMissing);

      missingStudents.sort((a, b) => parseInt(a.noAbsen || '999', 10) - parseInt(b.noAbsen || '999', 10));

      if (missingStudents.length === 0) {
        return `📢 *INFORMASI KELENGKAPAN NILAI*\n` +
               `Kelas: *${kelasName}*\n` +
               `Penilaian: *${colName}*\n\n` +
               `✨ *Selamat! Semua siswa (${studentList.length} siswa) sudah memiliki nilai untuk ${colName}.* 👍`;
      }

      const lines = missingStudents.map((item, i) => {
        const absen = item.noAbsen ? `(No. Absen ${item.noAbsen})` : '';
        return `${i + 1}. ${item.student.nama} ${absen}`;
      }).join('\n');

      return `📢 *INFORMASI PENGUMPULAN / KELENGKAPAN NILAI*\n` +
             `Kelas: *${kelasName}*\n` +
             `Penilaian: *${colName}*\n\n` +
             `Berikut daftar *${missingStudents.length} siswa* yang *BELUM* memiliki nilai / belum mengumpulkan:\n\n` +
             `${lines}\n\n` +
             `Mohon siswa di atas segera menyelesaikan dan mengumpulkan tugasnya. Terima kasih! 🙏`;
    }
  };

  // Sync modal message text whenever selection or data changes
  useEffect(() => {
    if (showMissingModal) {
      const text = generateMissingGradesMessage(
        gradeType,
        selectedColKey,
        localFormative,
        localSummative,
        students,
        activeFormativeCols,
        activeSummativeCols
      );
      setCustomMessageText(text);
      setCopiedStatus(false);
    }
  }, [showMissingModal, selectedColKey, gradeType, localFormative, localSummative, students, activeFormativeCols, activeSummativeCols]);

  // Freeze background screen scrolling when any modal in GradesTab is open
  useEffect(() => {
    const isAnyModalOpen = showTaskModal || showMissingModal || !!zoomedPhoto || showImportModal;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.userSelect = '';
    };
  }, [showTaskModal, showMissingModal, zoomedPhoto, showImportModal]);

  const buildFormativeList = (studentList: Student[], grades: GradeFormative[]): GradeFormative[] => {
    return studentList.map(s => {
      const existing = grades.find(g => g.nis === s.nis);
      if (existing) {
        return {
          ...existing,
          nama: s.nama,
          kelas: s.kelas || existing.kelas,
          jenisKelamin: s.jenisKelamin || existing.jenisKelamin
        };
      }
      return {
        nis: s.nis,
        nama: s.nama,
        kelas: s.kelas,
        jenisKelamin: s.jenisKelamin,
        rataRata: null
      };
    });
  };

  const buildSummativeList = (studentList: Student[], grades: GradeSummative[]): GradeSummative[] => {
    return studentList.map(s => {
      const existing = grades.find(g => g.nis === s.nis);
      if (existing) {
        return {
          ...existing,
          nama: s.nama,
          kelas: s.kelas || existing.kelas,
          jenisKelamin: s.jenisKelamin || existing.jenisKelamin
        };
      }
      return {
        nis: s.nis,
        nama: s.nama,
        kelas: s.kelas,
        jenisKelamin: s.jenisKelamin,
        rataRata: null
      };
    });
  };

  // Sync local state when the student roster (class) changes
  useEffect(() => {
    setLocalFormative(buildFormativeList(students, formativeGrades));
    setLocalSummative(buildSummativeList(students, summativeGrades));
    setIsDirty(false);
    setSaveStatus('idle');
  }, [students]);

  // Sync local state with fresh props when they change, but ONLY if not dirty (no unsaved changes)
  useEffect(() => {
    if (!isDirty) {
      setLocalFormative(buildFormativeList(students, formativeGrades));
      setLocalSummative(buildSummativeList(students, summativeGrades));
    }
  }, [formativeGrades, summativeGrades, isDirty, students]);

  const calculateAverage = (scores: (number | null | undefined)[]): number | null => {
    const validScores = scores
      .map(s => (s !== null && s !== undefined ? Number(s) : null))
      .filter((s): s is number => s !== null && !isNaN(s));
    if (validScores.length === 0) return null;
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / validScores.length;
    return isNaN(avg) ? null : parseFloat(avg.toFixed(1));
  };

  const formatAvgPlaceholder = (scores: (number | null | undefined)[]): string => {
    const avg = calculateAverage(scores);
    if (avg === null || isNaN(avg)) return '0.0';
    return avg.toFixed(1);
  };

  const handleGradeChange = (
    nis: string,
    field: string,
    value: string
  ) => {
    setIsDirty(true);
    // If empty string, set as null
    if (value.trim() === '') {
      if (gradeType === 'formative') {
        setLocalFormative(prev =>
          prev.map(g => {
            if (g.nis === nis) {
              const updated = { ...g, [field]: null };
              if (field !== 'rataRata') {
                const scores = activeFormativeCols.map(c => getRowEffectiveScore(updated, c.key));
                updated.rataRata = calculateAverage(scores);
              }
              return updated;
            }
            return g;
          })
        );
      } else {
        setLocalSummative(prev =>
          prev.map(g => {
            if (g.nis === nis) {
              const updated = { ...g, [field]: null };
              if (field !== 'rataRata') {
                const scores = activeSummativeCols.map(c => getRowEffectiveScore(updated, c.key));
                updated.rataRata = calculateAverage(scores);
              }
              return updated;
            }
            return g;
          })
        );
      }
      return;
    }

    // Validate numeric value: reject negative or > 100
    const cleanStr = value.replace(',', '.');
    const parsed = parseFloat(cleanStr);
    
    if (isNaN(parsed)) return;

    if (parsed < 0) {
      setValidationWarning('Nilai tidak boleh berupa angka negatif (< 0)! Nilai disesuaikan menjadi 0.');
      setTimeout(() => setValidationWarning(null), 4000);
    } else if (parsed > 100) {
      setValidationWarning('Nilai tidak boleh melebihi batas maksimal 100! Nilai disesuaikan menjadi 100.');
      setTimeout(() => setValidationWarning(null), 4000);
    }

    // Strictly clamp the value between 0 and 100
    const clamped = Math.min(100, Math.max(0, parsed));

    if (gradeType === 'formative') {
      setLocalFormative(prev =>
        prev.map(g => {
          if (g.nis === nis) {
            const updated = { ...g, [field]: clamped };
            if (field !== 'rataRata') {
              const scores = activeFormativeCols.map(c => getRowEffectiveScore(updated, c.key));
              updated.rataRata = calculateAverage(scores);
            }
            return updated;
          }
          return g;
        })
      );
    } else {
      setLocalSummative(prev =>
        prev.map(g => {
          if (g.nis === nis) {
            const updated = { ...g, [field]: clamped };
            if (field !== 'rataRata') {
              const scores = activeSummativeCols.map(c => getRowEffectiveScore(updated, c.key));
              updated.rataRata = calculateAverage(scores);
            }
            return updated;
          }
          return g;
        })
      );
    }
  };

  const handleAddColumn = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const sanitizedFormative = sanitizeGradeRecords(localFormative);
      const sanitizedSummative = sanitizeGradeRecords(localSummative);
      if (gradeType === 'formative') {
        if (!setFormativeCols) return;
        const nextIndex = activeFormativeCols.length + 1;
        const newCol = {
          key: `f${nextIndex}`,
          label: `Formatif ${nextIndex} (F${nextIndex})`
        };
        const updatedCols = [...(formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS), newCol];
        setFormativeCols(updatedCols);
        
        const updatedGrades = sanitizedFormative.map(r => {
          const updated = { ...r, [newCol.key]: null };
          // Recalculate average using effective scores (respecting existing remidi)
          const scores = updatedCols.map(c => getRowEffectiveScore(updated, c.key));
          updated.rataRata = calculateAverage(scores);
          return updated;
        });
        setLocalFormative(updatedGrades);

        await onSave(updatedGrades, sanitizedSummative, updatedCols, activeSummativeCols);
      } else {
        if (!setSummativeCols) return;
        const sCols = activeSummativeCols.filter(c => c.key.startsWith('s'));
        const nextSIndex = sCols.length + 1;
        const newCol = {
          key: `s${nextSIndex}`,
          label: `Sumatif ${nextSIndex} (S${nextSIndex})`
        };

        let updatedCols: GradeColumn[] = [];
        const cols = (summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS).filter(c => c.key !== 'uts');
        const uasIndex = cols.findIndex(c => c.key === 'uas');
        if (uasIndex !== -1) {
          const updated = [...cols];
          updated.splice(uasIndex, 0, newCol);
          updatedCols = updated;
        } else {
          updatedCols = [...cols, newCol];
        }
        setSummativeCols(updatedCols);

        const updatedGrades = sanitizedSummative.map(r => {
          const updated = { ...r, [newCol.key]: null };
          // Recalculate average using effective scores (respecting existing remidi)
          const scores = updatedCols.map(c => getRowEffectiveScore(updated, c.key));
          updated.rataRata = calculateAverage(scores);
          return updated;
        });
        setLocalSummative(updatedGrades);

        await onSave(sanitizedFormative, updatedGrades, activeFormativeCols, updatedCols);
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveColumn = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const sanitizedFormative = sanitizeGradeRecords(localFormative);
      const sanitizedSummative = sanitizeGradeRecords(localSummative);
      if (gradeType === 'formative') {
        if (!setFormativeCols || activeFormativeCols.length <= 1) return;
        const colToRemove = activeFormativeCols[activeFormativeCols.length - 1];
        const updatedCols = (formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS).slice(0, -1);
        setFormativeCols(updatedCols);

        const updatedGrades = sanitizedFormative.map(r => {
          const updated = { ...r };
          delete updated[colToRemove.key];
          delete (updated as any)[`${colToRemove.key}_rem`];
          const scores = updatedCols.map(c => getRowEffectiveScore(updated, c.key));
          updated.rataRata = calculateAverage(scores);
          return updated;
        });
        setLocalFormative(updatedGrades);

        await onSave(updatedGrades, sanitizedSummative, updatedCols, activeSummativeCols);
      } else {
        if (!setSummativeCols) return;
        const sCols = activeSummativeCols.filter(c => c.key.startsWith('s'));
        if (sCols.length <= 1) return;
        const lastSCol = sCols[sCols.length - 1];

        const updatedCols = (summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS).filter(c => c.key !== lastSCol.key);
        setSummativeCols(updatedCols);

        const updatedGrades = sanitizedSummative.map(r => {
          const updated = { ...r };
          delete updated[lastSCol.key];
          delete (updated as any)[`${lastSCol.key}_rem`];
          const scores = updatedCols.map(c => getRowEffectiveScore(updated, c.key));
          updated.rataRata = calculateAverage(scores);
          return updated;
        });
        setLocalSummative(updatedGrades);

        await onSave(sanitizedFormative, updatedGrades, activeFormativeCols, updatedCols);
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      // Validate and sanitize all grades strictly before dispatching to Firebase
      const sanitizedFormative = sanitizeGradeRecords(localFormative);
      const sanitizedSummative = sanitizeGradeRecords(localSummative);
      
      // Update local state to reflect sanitized values
      setLocalFormative(sanitizedFormative);
      setLocalSummative(sanitizedSummative);

      await onSave(sanitizedFormative, sanitizedSummative);
      setSaveStatus('success');
      setIsDirty(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Get filtered records based on search query
  const filteredFormative = localFormative.filter(
    g =>
      g.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.nis.includes(searchQuery)
  );

  const filteredSummative = localSummative.filter(
    g =>
      g.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.nis.includes(searchQuery)
  );

  // Helper to color grade value
  const getGradeColor = (score: number | null | undefined) => {
    if (score === null || score === undefined || isNaN(Number(score))) return 'text-slate-400';
    if (score >= 80) return 'text-indigo-600 font-bold';
    if (score >= 65) return 'text-amber-600 font-bold';
    return 'text-rose-600 font-bold';
  };

  return (
    <div id="grades-section" className="space-y-6">
      {/* Grade Selector & Info */}
      <div className="sticky top-28 sm:top-[112px] z-40 bg-white/95 backdrop-blur-md p-3 lg:p-4 rounded-2xl border border-slate-200 shadow-md transition-all duration-200 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-row items-center p-1 sm:p-1.5 bg-slate-100/90 border border-slate-200/90 rounded-2xl gap-1 sm:gap-1.5 shadow-2xs">
          <button
            onClick={() => setGradeType('formative')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer ${
              gradeType === 'formative'
                ? 'bg-indigo-600 text-white shadow-xs font-black ring-1 ring-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 font-semibold'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">Formatif</span>
            <span className={`text-[10px] sm:text-[11px] font-mono font-black px-1.5 py-0.5 rounded-md shrink-0 ${
              gradeType === 'formative' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {gradeWeights.formatif}%
            </span>
          </button>
          <button
            onClick={() => setGradeType('summative')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer ${
              gradeType === 'summative'
                ? 'bg-indigo-600 text-white shadow-xs font-black ring-1 ring-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 font-semibold'
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span className="truncate">Sumatif &amp; UAS</span>
            <span className={`text-[10px] sm:text-[11px] font-mono font-black px-1.5 py-0.5 rounded-md shrink-0 ${
              gradeType === 'summative' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {gradeWeights.sumatif + gradeWeights.uas}%
            </span>
          </button>
          <button
            onClick={() => setGradeType('attitude')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer ${
              gradeType === 'attitude'
                ? 'bg-indigo-600 text-white shadow-xs font-black ring-1 ring-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 font-semibold'
            }`}
          >
            <HeartHandshake className="w-4 h-4 shrink-0" />
            <span className="truncate">Nilai Sikap</span>
            <span className={`text-[10px] sm:text-[11px] font-mono font-black px-1.5 py-0.5 rounded-md shrink-0 ${
              gradeType === 'attitude' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {gradeWeights.sikap}%
            </span>
          </button>
          <button
            onClick={() => setGradeType('final')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer ${
              gradeType === 'final'
                ? 'bg-indigo-600 text-white shadow-xs font-black ring-1 ring-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 font-semibold'
            }`}
          >
            <Percent className="w-4 h-4 shrink-0" />
            <span className="truncate">Nilai Akhir &amp; Rapor</span>
            <span className={`text-[10px] sm:text-[11px] font-mono font-black px-1.5 py-0.5 rounded-md shrink-0 ${
              gradeType === 'final' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
            }`}>
              100%
            </span>
          </button>
        </div>

        <div className="w-full lg:w-auto flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          {validationWarning && (
            <span className="w-full sm:w-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-bold flex items-center justify-center sm:justify-start gap-1.5 animate-bounce">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{validationWarning}</span>
            </span>
          )}
          {saveStatus === 'success' && (
            <span className="w-full sm:w-auto text-xs sm:text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold flex items-center justify-center sm:justify-start gap-1.5 animate-pulse">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" /> Nilai Berhasil Disinkronkan!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="w-full sm:w-auto text-xs sm:text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl font-semibold flex items-center justify-center sm:justify-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> Gagal sinkronisasi nilai.
            </span>
          )}

          {(gradeType === 'formative' || gradeType === 'summative') && (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportTargetCol('all');
                  setRawImportData([]);
                  setImportFileError(null);
                  setImportedPreview([]);
                  setImportFileName('');
                  setShowImportModal(true);
                }}
                disabled={students.length === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-2xs transition-all duration-150 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
                title={`Import nilai ${gradeType === 'formative' ? 'Formatif' : 'Sumatif'} dari file Excel (.xlsx / .csv)`}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>Import Excel</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={students.length === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold text-white bg-slate-800 hover:bg-slate-900 active:scale-[0.98] shadow-2xs transition-all duration-150 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
                title={`Ekspor nilai ${gradeType === 'formative' ? 'Formatif' : 'Sumatif'} ke file Excel (.xlsx)`}
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving || students.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-xs shadow-indigo-600/20 ring-1 ring-indigo-600/30 transition-all duration-150 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 shrink-0" />
                    <span>Simpan Semua Nilai</span>
                  </>
                )}
              </button>
            </>
          )}

          {gradeType === 'final' && (
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={students.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold text-white bg-slate-800 hover:bg-slate-900 active:scale-[0.98] shadow-2xs transition-all duration-150 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
              title="Ekspor rekapitulasi nilai akhir ke Excel"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export Rapor Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Render Attitude Grades View */}
      {gradeType === 'attitude' && (
        <AttitudeGradesView
          students={students}
          attitudeGrades={attitudeGrades}
          recap={recap}
          studentNotes={studentNotes}
          attendance={attendance}
          gradeWeights={gradeWeights}
          onSaveAttitude={onSaveAttitude}
          selectedSemester={selectedSemester}
          activeClassName={students[0]?.kelas || 'Kelas'}
          onSelectStudent={(st) => setSelectedHistoryStudent(st)}
        />
      )}

      {/* Render Final Grades View */}
      {gradeType === 'final' && (
        <FinalGradesView
          students={students}
          formativeGrades={localFormative}
          summativeGrades={localSummative}
          attitudeGrades={attitudeGrades}
          formativeCols={activeFormativeCols}
          summativeCols={activeSummativeCols}
          studentNotes={studentNotes}
          attendance={attendance}
          recap={recap}
          gradeWeights={gradeWeights}
          selectedSemester={selectedSemester}
          activeClassName={students[0]?.kelas || 'Kelas'}
          onSelectStudent={(st) => setSelectedHistoryStudent(st)}
        />
      )}

      {/* Formative & Summative Grade Table Card */}
      {(gradeType === 'formative' || gradeType === 'summative') && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search header with add/remove controls */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Cari Siswa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedColKey('all');
                setShowMissingModal(true);
              }}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Salin daftar siswa yang belum memiliki nilai untuk dikirim ke grup siswa / WA"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Belum Ada Nilai</span>
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handleRemoveColumn}
                disabled={gradeType === 'formative' ? activeFormativeCols.length <= 1 : activeSummativeCols.filter(c => c.key.startsWith('s')).length <= 1}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg text-[11px] transition border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Hapus kolom penilaian terakhir"
              >
                <span>- Kurang</span>
              </button>
              <span className="text-[10px] font-bold text-slate-500 px-2.5 select-none font-mono">
                {gradeType === 'formative'
                  ? `${activeFormativeCols.length} Kolom`
                  : `${activeSummativeCols.filter(c => c.key.startsWith('s')).length} Bab + UAS`}
              </span>
              <button
                type="button"
                onClick={handleAddColumn}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Tambah kolom penilaian baru"
              >
                <span>+ Tambah</span>
              </button>
            </div>

            {/* Toggle Mode Remedial */}
            <button
              type="button"
              onClick={() => setShowRemedial(!showRemedial)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-2xs border select-none ${
                showRemedial 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 ring-2 ring-rose-200' 
                  : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300'
              }`}
              title={showRemedial ? 'Klik untuk menyembunyikan kolom input Nilai Remedial' : `Klik untuk menampilkan kolom input Nilai Remedial (KKTP < ${currentKktp})`}
            >
              <span className={`w-2 h-2 rounded-full ${showRemedial ? 'bg-white animate-pulse' : 'bg-rose-600'}`}></span>
              <span>{showRemedial ? 'Tutup Kolom Remedial' : 'Buka Kolom Remedial'}</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              Kalkulasi Otomatis (KKTP {currentKktp})
            </div>
          </div>
        </div>

        {/* Content table */}
        {students.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">Belum ada siswa.</p>
          </div>
        ) : gradeType === 'formative' ? (
          <div>
            {/* Formative Mobile View: Cards */}
            <div className="block md:hidden space-y-4 p-4 bg-slate-50/50">
              {filteredFormative.map(row => {
                const matchingStudent = students.find(s => s.nis === row.nis);
                const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                const noAbsen = matchingStudent?.noAbsen || '';
                return (
                  <div key={row.nis} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      {studentPhoto ? (
                        <img
                          src={getStudentPhotoUrl(studentPhoto)}
                          alt={row.nama}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleStudentPhotoError(e, studentPhoto)}
                          className="w-9 h-9 object-cover rounded-full border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const found = matchingStudent || students.find(s => s.nis === row.nis);
                              if (found) setSelectedHistoryStudent(found);
                            }}
                            className="font-bold text-slate-800 text-sm block truncate text-left hover:text-indigo-600 hover:underline transition cursor-pointer"
                            title="Klik untuk melihat Profil Riwayat Nilai Siswa (Sem 1 & Sem 2)"
                          >
                            {row.nama}
                          </button>
                          {matchingStudent?.label && (
                            (() => {
                              let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                              if (matchingStudent.label.toLowerCase().includes("ketua kelas")) {
                                bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                              } else if (matchingStudent.label.toLowerCase().includes("osis") || matchingStudent.label.toLowerCase().includes("omp")) {
                                bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                              } else if (matchingStudent.label.toLowerCase().includes("bermasalah")) {
                                bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                              }
                              const displayVal = matchingStudent.label.toUpperCase() === 'OSIS' ? 'OMP' : matchingStudent.label;
                              return (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-wider ${bgClass}`}>
                                  {displayVal}
                                </span>
                              );
                            })()
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 block select-all">
                          NIS: {row.nis} {noAbsen ? `• Absen #${noAbsen}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                      {activeFormativeCols.map(col => {
                        const rawVal = row[col.key];
                        const remKey = `${col.key}_rem`;
                        const remVal = row[remKey];
                        const numRaw = rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '' && !isNaN(Number(rawVal)) ? Number(rawVal) : null;
                        const isUnderKKTP = numRaw !== null && numRaw < currentKktp;
                        const hasRemedial = remVal !== null && remVal !== undefined && String(remVal).trim() !== '' && !isNaN(Number(remVal));
                        const shouldShowRemedialInput = showRemedial && (isUnderKKTP || hasRemedial);
                        const effectiveScore = getRowEffectiveScore(row, col.key);

                        return (
                          <div key={col.key} className={`space-y-1 p-2 rounded-lg border transition ${isUnderKKTP ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-150'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={`block text-[10px] font-bold truncate ${isUnderKKTP ? 'text-rose-700' : 'text-slate-500'}`} title={col.label}>
                                  {getColShortLabel(col)}
                                </span>
                                {isUnderKKTP && (
                                  <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1 py-0.2 rounded shrink-0">
                                    &lt;{currentKktp}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 bg-slate-200/70 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => openTaskModal(col, 'formative')}
                                  className={`p-1.5 rounded-md transition cursor-pointer flex items-center justify-center active:scale-95 min-w-[28px] min-h-[28px] ${
                                    col.description ? 'text-indigo-700 font-bold bg-indigo-100 shadow-2xs' : 'text-slate-600 hover:text-indigo-700 hover:bg-white bg-transparent'
                                  }`}
                                  title={col.description ? `Lihat/Edit detail tugas ${getColShortLabel(col)}` : `Tambah detail tugas ${getColShortLabel(col)}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedColKey(col.key);
                                    setShowMissingModal(true);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-white rounded-md transition cursor-pointer flex items-center justify-center active:scale-95 min-w-[28px] min-h-[28px]"
                                  title={`Salin daftar siswa belum ada nilai ${getColShortLabel(col)}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Nilai Asli */}
                            <div>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="--"
                                value={row[col.key] === null || row[col.key] === undefined || isNaN(Number(row[col.key])) ? '' : row[col.key]}
                                onFocus={(e) => e.target.select()}
                                onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                                className={`w-full text-center py-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white bg-white transition ${
                                  isUnderKKTP 
                                    ? 'border-rose-300 text-rose-700 font-black bg-rose-50/40' 
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              />
                            </div>

                            {/* Input Remedial (Hanya muncul jika nilai asli terisi dan < KKTP, atau sudah ada nilai remedial) */}
                            {shouldShowRemedialInput && (
                              <div className="pt-1 mt-1 border-t border-dashed border-rose-200">
                                <div className="flex items-center justify-between text-[9px] font-bold text-rose-600 mb-0.5">
                                  <span>Remedial:</span>
                                  {hasRemedial && (
                                    <span className="text-[8px] text-slate-400 font-mono">
                                      Efektif: {effectiveScore != null ? Number(effectiveScore).toFixed(1) : '-'}
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="Nilai Rem..."
                                  value={row[remKey] === null || row[remKey] === undefined || isNaN(Number(row[remKey])) ? '' : row[remKey]}
                                  onFocus={(e) => e.target.select()}
                                  onChange={e => handleGradeChange(row.nis, remKey, e.target.value)}
                                  className="w-full text-center py-1 rounded-md border border-rose-300 bg-white text-rose-800 text-[11px] font-bold focus:ring-2 focus:ring-rose-400 placeholder:text-rose-300"
                                  title="Nilai Remedial (dinormalisasi secara adil jika melampaui KKTP)"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Rata-Rata Card */}
                      <div className="space-y-1 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 col-span-2 sm:col-span-1">
                        <span className="block text-[10px] font-bold text-indigo-600 truncate">
                          Rata-Rata
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder={formatAvgPlaceholder(activeFormativeCols.map(c => row[c.key]))}
                          value={row.rataRata === null || row.rataRata === undefined || isNaN(Number(row.rataRata)) ? '' : row.rataRata}
                          onFocus={(e) => e.target.select()}
                          onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                          className={`w-full text-center py-1.5 rounded-lg border border-indigo-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${getGradeColor(row.rataRata)}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formative Desktop View: Standard Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-xs lg:text-sm tracking-wider uppercase border-b border-slate-200">
                    <th className="py-3 px-5 lg:py-4">Siswa</th>
                    {activeFormativeCols.map(col => (
                      <th key={col.key} className="py-3 px-3 lg:py-4 text-center min-w-[135px] lg:w-40" title={col.label}>
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <span className="font-bold text-slate-700 text-xs lg:text-sm">{getColShortLabel(col)}</span>
                          <div className="flex items-center gap-2.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTaskModal(col, 'formative');
                              }}
                              className={`p-2 rounded-lg transition cursor-pointer flex items-center justify-center min-w-[34px] min-h-[34px] active:scale-95 ${
                                col.description
                                  ? 'text-indigo-700 bg-indigo-100/90 hover:bg-indigo-200 shadow-2xs font-bold'
                                  : 'text-slate-600 hover:text-indigo-700 hover:bg-white bg-transparent'
                              }`}
                              title={col.description ? `Lihat/Edit detail tugas ${col.label}` : `Tambah detail tugas ${col.label}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedColKey(col.key);
                                setShowMissingModal(true);
                              }}
                              className="p-2 hover:bg-white rounded-lg text-slate-600 hover:text-indigo-700 transition cursor-pointer flex items-center justify-center min-w-[34px] min-h-[34px] active:scale-95"
                              title={`Salin daftar siswa yang belum ada nilai ${getColShortLabel(col)}`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImportTargetCol(col.key);
                                setRawImportData([]);
                                setImportFileError(null);
                                setImportedPreview([]);
                                setImportFileName('');
                                setShowImportModal(true);
                              }}
                              className="p-2 hover:bg-white rounded-lg text-slate-600 hover:text-emerald-700 transition cursor-pointer flex items-center justify-center min-w-[34px] min-h-[34px] active:scale-95"
                              title={`Import khusus nilai ${getColShortLabel(col)} dari Excel`}
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-5 lg:py-4 text-center w-36 lg:w-40 bg-indigo-50/10">Rata-Rata Formatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFormative.map(row => (
                    <tr key={row.nis} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-5 lg:py-3.5">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const matchingStudent = students.find(s => s.nis === row.nis);
                            const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                            const noAbsen = matchingStudent?.noAbsen || '';
                            return (
                              <>
                                {studentPhoto ? (
                                  <img
                                    src={getStudentPhotoUrl(studentPhoto)}
                                    alt={row.nama}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleStudentPhotoError(e, studentPhoto)}
                                    className="w-10 h-10 lg:w-11 lg:h-11 object-cover rounded-full border border-slate-200 cursor-pointer hover:scale-105 transition duration-150 shrink-0"
                                    onClick={() => {
                                      setZoomedPhoto(studentPhoto);
                                      setZoomedName(row.nama);
                                    }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 lg:w-11 lg:h-11 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                    <User className="w-5 h-5 lg:w-6 lg:h-6" />
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const matchingStudent = students.find(s => s.nis === row.nis);
                                  if (matchingStudent) setSelectedHistoryStudent(matchingStudent);
                                }}
                                className="font-bold text-slate-800 block text-sm lg:text-base text-left hover:text-indigo-600 hover:underline transition cursor-pointer"
                                title="Klik untuk melihat Profil Riwayat Nilai Siswa (Sem 1 & Sem 2)"
                              >
                                {row.nama}
                              </button>
                              {(() => {
                                const matchingStudent = students.find(s => s.nis === row.nis);
                                if (!matchingStudent?.label) return null;
                                let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                                if (matchingStudent.label.toLowerCase().includes("ketua kelas")) {
                                  bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                                } else if (matchingStudent.label.toLowerCase().includes("osis") || matchingStudent.label.toLowerCase().includes("omp")) {
                                  bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                } else if (matchingStudent.label.toLowerCase().includes("bermasalah")) {
                                  bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                                }
                                const displayVal = matchingStudent.label.toUpperCase() === 'OSIS' ? 'OMP' : matchingStudent.label;
                                return (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] lg:text-[11px] font-black border uppercase tracking-wider ${bgClass}`}>
                                    {displayVal}
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="font-mono text-xs text-slate-500">
                              NIS: {row.nis} {(() => {
                                const st = students.find(s => s.nis === row.nis);
                                return st?.noAbsen ? `• Absen #${st.noAbsen}` : '';
                              })()}
                            </span>
                          </div>
                        </div>
                      </td>
                      {activeFormativeCols.map(col => {
                        const rawVal = row[col.key];
                        const remKey = `${col.key}_rem`;
                        const remVal = row[remKey];
                        const numRaw = rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '' && !isNaN(Number(rawVal)) ? Number(rawVal) : null;
                        const isUnderKKTP = numRaw !== null && numRaw < currentKktp;
                        const hasRemedial = remVal !== null && remVal !== undefined && String(remVal).trim() !== '' && !isNaN(Number(remVal));
                        const shouldShowRemedialInput = showRemedial && (isUnderKKTP || hasRemedial);
                        const effectiveScore = getRowEffectiveScore(row, col.key);

                        return (
                          <td key={col.key} className={`py-3.5 px-3 text-center transition ${isUnderKKTP ? 'bg-rose-50/20' : ''}`}>
                            <div className="flex flex-col items-center justify-center gap-1">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="--"
                                  value={row[col.key] === null || row[col.key] === undefined || isNaN(Number(row[col.key])) ? '' : row[col.key]}
                                  onFocus={(e) => e.target.select()}
                                  onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                                  className={`w-16 lg:w-20 text-center py-1.5 lg:py-2 rounded-xl border text-sm lg:text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition ${
                                    isUnderKKTP 
                                      ? 'border-rose-300 bg-rose-50/50 text-rose-700 font-black ring-1 ring-rose-200' 
                                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                                  }`}
                                />
                                {isUnderKKTP && (
                                  <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                                    &lt;{currentKktp}
                                  </span>
                                )}
                              </div>

                              {/* Input Nilai Remedial (Hanya muncul jika nilai asli terisi dan < KKTP, atau sudah ada nilai remedial) */}
                              {shouldShowRemedialInput && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[9px] font-black text-rose-600">Rem:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="--"
                                    value={row[remKey] === null || row[remKey] === undefined || isNaN(Number(row[remKey])) ? '' : row[remKey]}
                                    onFocus={(e) => e.target.select()}
                                    onChange={e => handleGradeChange(row.nis, remKey, e.target.value)}
                                    className="w-14 lg:w-16 text-center py-1 rounded-lg border border-rose-300 bg-white text-xs font-bold text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-400 placeholder:text-rose-300 shadow-2xs"
                                    title={`Nilai Remedial (Nilai efektif: ${effectiveScore != null ? Number(effectiveScore).toFixed(1) : '-'})`}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-5 text-center bg-indigo-50/5 font-mono text-sm lg:text-base font-bold">
                        <span className={getGradeColor(row.rataRata)}>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder={formatAvgPlaceholder(activeFormativeCols.map(c => row[c.key]))}
                            value={row.rataRata === null || row.rataRata === undefined || isNaN(Number(row.rataRata)) ? '' : row.rataRata}
                            onFocus={(e) => e.target.select()}
                            onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                            className={`w-16 lg:w-20 text-center py-1.5 lg:py-2 rounded-xl border border-slate-200 text-sm lg:text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs ${getGradeColor(row.rataRata)}`}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            {/* Summative Mobile View: Cards */}
            <div className="block md:hidden space-y-4 p-4 bg-slate-50/50">
              {filteredSummative.map(row => {
                const matchingStudent = students.find(s => s.nis === row.nis);
                const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                const noAbsen = matchingStudent?.noAbsen || '';
                return (
                  <div key={row.nis} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      {studentPhoto ? (
                        <img
                          src={getStudentPhotoUrl(studentPhoto)}
                          alt={row.nama}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleStudentPhotoError(e, studentPhoto)}
                          className="w-9 h-9 object-cover rounded-full border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const found = matchingStudent || students.find(s => s.nis === row.nis);
                              if (found) setSelectedHistoryStudent(found);
                            }}
                            className="font-bold text-slate-800 text-sm block truncate text-left hover:text-indigo-600 hover:underline transition cursor-pointer"
                            title="Klik untuk melihat Profil Riwayat Nilai Siswa (Sem 1 & Sem 2)"
                          >
                            {row.nama}
                          </button>
                          {matchingStudent?.label && (
                            (() => {
                              let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                              if (matchingStudent.label.toLowerCase().includes("ketua kelas")) {
                                bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                              } else if (matchingStudent.label.toLowerCase().includes("osis") || matchingStudent.label.toLowerCase().includes("omp")) {
                                bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                              } else if (matchingStudent.label.toLowerCase().includes("bermasalah")) {
                                bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                              }
                              const displayVal = matchingStudent.label.toUpperCase() === 'OSIS' ? 'OMP' : matchingStudent.label;
                              return (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-wider ${bgClass}`}>
                                  {displayVal}
                                </span>
                              );
                            })()
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 block select-all">
                          NIS: {row.nis} {noAbsen ? `• Absen #${noAbsen}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                      {activeSummativeCols.map(col => {
                        const rawVal = row[col.key];
                        const remKey = `${col.key}_rem`;
                        const remVal = row[remKey];
                        const numRaw = rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '' && !isNaN(Number(rawVal)) ? Number(rawVal) : null;
                        const isUnderKKTP = numRaw !== null && numRaw < currentKktp;
                        const hasRemedial = remVal !== null && remVal !== undefined && String(remVal).trim() !== '' && !isNaN(Number(remVal));
                        const shouldShowRemedialInput = showRemedial && (isUnderKKTP || hasRemedial);
                        const effectiveScore = getRowEffectiveScore(row, col.key);

                        return (
                          <div key={col.key} className={`space-y-1 p-2 rounded-lg border transition ${isUnderKKTP ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-150'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={`block text-[10px] font-bold truncate ${isUnderKKTP ? 'text-rose-700' : 'text-slate-500'}`} title={col.label}>
                                  {getColShortLabel(col)}
                                </span>
                                {isUnderKKTP && (
                                  <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1 py-0.2 rounded shrink-0">
                                    &lt;{currentKktp}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 bg-slate-200/70 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => openTaskModal(col, 'summative')}
                                  className={`p-1.5 rounded-md transition cursor-pointer flex items-center justify-center active:scale-95 min-w-[28px] min-h-[28px] ${
                                    col.description ? 'text-indigo-700 font-bold bg-indigo-100 shadow-2xs' : 'text-slate-600 hover:text-indigo-700 hover:bg-white bg-transparent'
                                  }`}
                                  title={col.description ? `Lihat/Edit detail tugas ${getColShortLabel(col)}` : `Tambah detail tugas ${getColShortLabel(col)}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedColKey(col.key);
                                    setShowMissingModal(true);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-white rounded-md transition cursor-pointer flex items-center justify-center active:scale-95 min-w-[28px] min-h-[28px]"
                                  title={`Salin daftar siswa belum ada nilai ${getColShortLabel(col)}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Nilai Asli */}
                            <div>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="--"
                                value={row[col.key] === null || row[col.key] === undefined || isNaN(Number(row[col.key])) ? '' : row[col.key]}
                                onFocus={(e) => e.target.select()}
                                onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                                className={`w-full text-center py-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white bg-white transition ${
                                  isUnderKKTP 
                                    ? 'border-rose-300 text-rose-700 font-black bg-rose-50/40' 
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              />
                            </div>

                            {/* Input Remedial (Hanya muncul jika nilai asli terisi dan < KKTP, atau sudah ada nilai remedial) */}
                            {shouldShowRemedialInput && (
                              <div className="pt-1 mt-1 border-t border-dashed border-rose-200">
                                <div className="flex items-center justify-between text-[9px] font-bold text-rose-600 mb-0.5">
                                  <span>Remedial:</span>
                                  {hasRemedial && (
                                    <span className="text-[8px] text-slate-400 font-mono">
                                      Efektif: {effectiveScore != null ? Number(effectiveScore).toFixed(1) : '-'}
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="Nilai Rem..."
                                  value={row[remKey] === null || row[remKey] === undefined || isNaN(Number(row[remKey])) ? '' : row[remKey]}
                                  onFocus={(e) => e.target.select()}
                                  onChange={e => handleGradeChange(row.nis, remKey, e.target.value)}
                                  className="w-full text-center py-1 rounded-md border border-rose-300 bg-white text-rose-800 text-[11px] font-bold focus:ring-2 focus:ring-rose-400 placeholder:text-rose-300"
                                  title="Nilai Remedial (dinormalisasi secara adil jika melampaui KKTP)"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Rata-Rata Card */}
                      <div className="space-y-1 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 col-span-2 sm:col-span-1">
                        <span className="block text-[10px] font-bold text-indigo-600 truncate">
                          Rata-Rata
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder={formatAvgPlaceholder(activeSummativeCols.map(c => row[c.key]))}
                          value={row.rataRata === null || row.rataRata === undefined || isNaN(Number(row.rataRata)) ? '' : row.rataRata}
                          onFocus={(e) => e.target.select()}
                          onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                          className={`w-full text-center py-1.5 rounded-lg border border-indigo-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${getGradeColor(row.rataRata)}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summative Desktop View: Standard Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-xs lg:text-sm tracking-wider uppercase border-b border-slate-200">
                    <th className="py-3 px-5 lg:py-4">Siswa</th>
                    {activeSummativeCols.map(col => (
                      <th key={col.key} className="py-3 px-3 lg:py-4 text-center min-w-[135px] lg:w-40" title={col.label}>
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <span className="font-bold text-slate-700 text-xs lg:text-sm">{getColShortLabel(col)}</span>
                          <div className="flex items-center gap-2.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTaskModal(col, 'summative');
                              }}
                              className={`p-2 rounded-lg transition cursor-pointer flex items-center justify-center min-w-[34px] min-h-[34px] active:scale-95 ${
                                col.description
                                  ? 'text-indigo-700 bg-indigo-100/90 hover:bg-indigo-200 shadow-2xs font-bold'
                                  : 'text-slate-600 hover:text-indigo-700 hover:bg-white bg-transparent'
                              }`}
                              title={col.description ? `Lihat/Edit detail tugas ${col.label}` : `Tambah detail tugas ${col.label}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedColKey(col.key);
                                setShowMissingModal(true);
                              }}
                              className="p-2 hover:bg-white rounded-lg text-slate-600 hover:text-indigo-700 transition cursor-pointer flex items-center justify-center min-w-[34px] min-h-[34px] active:scale-95"
                              title={`Salin daftar siswa yang belum ada nilai ${getColShortLabel(col)}`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImportTargetCol(col.key);
                                setRawImportData([]);
                                setImportFileError(null);
                                setImportedPreview([]);
                                setImportFileName('');
                                setShowImportModal(true);
                              }}
                              className="p-2 hover:bg-white rounded-lg text-slate-600 hover:text-emerald-700 transition cursor-pointer flex items-center justify-center min-w-[34px] min-h-[34px] active:scale-95"
                              title={`Import khusus nilai ${getColShortLabel(col)} dari Excel`}
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-5 lg:py-4 text-center w-36 lg:w-40 bg-indigo-50/10">Rata-Rata Sumatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummative.map(row => (
                    <tr key={row.nis} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-5 lg:py-3.5">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const matchingStudent = students.find(s => s.nis === row.nis);
                            const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                            const noAbsen = matchingStudent?.noAbsen || '';
                            return (
                              <>
                                {studentPhoto ? (
                                  <img
                                    src={getStudentPhotoUrl(studentPhoto)}
                                    alt={row.nama}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleStudentPhotoError(e, studentPhoto)}
                                    className="w-10 h-10 lg:w-11 lg:h-11 object-cover rounded-full border border-slate-200 cursor-pointer hover:scale-105 transition duration-150 shrink-0"
                                    onClick={() => {
                                      setZoomedPhoto(studentPhoto);
                                      setZoomedName(row.nama);
                                    }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 lg:w-11 lg:h-11 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                    <User className="w-5 h-5 lg:w-6 lg:h-6" />
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const matchingStudent = students.find(s => s.nis === row.nis);
                                  if (matchingStudent) setSelectedHistoryStudent(matchingStudent);
                                }}
                                className="font-bold text-slate-800 block text-sm lg:text-base text-left hover:text-indigo-600 hover:underline transition cursor-pointer"
                                title="Klik untuk melihat Profil Riwayat Nilai Siswa (Sem 1 & Sem 2)"
                              >
                                {row.nama}
                              </button>
                              {(() => {
                                const matchingStudent = students.find(s => s.nis === row.nis);
                                if (!matchingStudent?.label) return null;
                                let bgClass = "bg-slate-100 text-slate-700 border-slate-200";
                                if (matchingStudent.label.toLowerCase().includes("ketua kelas")) {
                                  bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                                } else if (matchingStudent.label.toLowerCase().includes("osis") || matchingStudent.label.toLowerCase().includes("omp")) {
                                  bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                } else if (matchingStudent.label.toLowerCase().includes("bermasalah")) {
                                  bgClass = "bg-rose-50 text-rose-700 border-rose-200";
                                }
                                const displayVal = matchingStudent.label.toUpperCase() === 'OSIS' ? 'OMP' : matchingStudent.label;
                                return (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] lg:text-[11px] font-black border uppercase tracking-wider ${bgClass}`}>
                                    {displayVal}
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="font-mono text-xs text-slate-500">
                              NIS: {row.nis} {(() => {
                                const st = students.find(s => s.nis === row.nis);
                                return st?.noAbsen ? `• Absen #${st.noAbsen}` : '';
                              })()}
                            </span>
                          </div>
                        </div>
                      </td>
                      {activeSummativeCols.map(col => {
                        const rawVal = row[col.key];
                        const remKey = `${col.key}_rem`;
                        const remVal = row[remKey];
                        const numRaw = rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '' && !isNaN(Number(rawVal)) ? Number(rawVal) : null;
                        const isUnderKKTP = numRaw !== null && numRaw < currentKktp;
                        const hasRemedial = remVal !== null && remVal !== undefined && String(remVal).trim() !== '' && !isNaN(Number(remVal));
                        const shouldShowRemedialInput = showRemedial && (isUnderKKTP || hasRemedial);
                        const effectiveScore = getRowEffectiveScore(row, col.key);

                        return (
                          <td key={col.key} className={`py-3.5 px-3 text-center transition ${isUnderKKTP ? 'bg-rose-50/20' : ''}`}>
                            <div className="flex flex-col items-center justify-center gap-1">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="--"
                                  value={row[col.key] === null || row[col.key] === undefined || isNaN(Number(row[col.key])) ? '' : row[col.key]}
                                  onFocus={(e) => e.target.select()}
                                  onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                                  className={`w-16 lg:w-20 text-center py-1.5 lg:py-2 rounded-xl border text-sm lg:text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition ${
                                    isUnderKKTP 
                                      ? 'border-rose-300 bg-rose-50/50 text-rose-700 font-black ring-1 ring-rose-200' 
                                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                                  }`}
                                />
                                {isUnderKKTP && (
                                  <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                                    &lt;{currentKktp}
                                  </span>
                                )}
                              </div>

                              {/* Input Nilai Remedial (Hanya muncul jika nilai asli terisi dan < KKTP, atau sudah ada nilai remedial) */}
                              {shouldShowRemedialInput && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[9px] font-black text-rose-600">Rem:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="--"
                                    value={row[remKey] === null || row[remKey] === undefined || isNaN(Number(row[remKey])) ? '' : row[remKey]}
                                    onFocus={(e) => e.target.select()}
                                    onChange={e => handleGradeChange(row.nis, remKey, e.target.value)}
                                    className="w-14 lg:w-16 text-center py-1 rounded-lg border border-rose-300 bg-white text-xs font-bold text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-400 placeholder:text-rose-300 shadow-2xs"
                                    title={`Nilai Remedial (Nilai efektif: ${effectiveScore != null ? Number(effectiveScore).toFixed(1) : '-'})`}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-5 text-center bg-indigo-50/5 font-mono text-sm lg:text-base font-bold">
                        <span className={getGradeColor(row.rataRata)}>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder={formatAvgPlaceholder(activeSummativeCols.map(c => row[c.key]))}
                            value={row.rataRata === null || row.rataRata === undefined || isNaN(Number(row.rataRata)) ? '' : row.rataRata}
                            onFocus={(e) => e.target.select()}
                            onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                            className={`w-16 lg:w-20 text-center py-1.5 lg:py-2 rounded-xl border border-slate-200 text-sm lg:text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs ${getGradeColor(row.rataRata)}`}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Task Description / Assignment Modal Overlay */}
      {showTaskModal && taskModalCol && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200 pointer-events-auto overscroll-none"
          onClick={() => setShowTaskModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 select-text relative z-10"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base leading-tight">
                    Detail Penilaian {taskModalCol.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {taskModalType === 'formative' ? 'Penilaian Formatif (Harian)' : 'Penilaian Sumatif'} • Semester {selectedSemester} ({selectedSemester === 1 ? 'Ganjil' : 'Genap'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {!isEditingTask ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-h-[120px]">
                    {taskModalCol.description ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                          <BookOpen className="w-3.5 h-3.5" />
                          Rincian Tugas / Materi / Instruksi:
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                          {taskModalCol.description}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-6 text-slate-400 space-y-2">
                        <FileText className="w-8 h-8 stroke-1 text-slate-300" />
                        <p className="text-xs font-medium max-w-xs">
                          Belum ada deskripsi tugas atau rincian materi yang ditambahkan untuk <strong>{taskModalCol.label}</strong>.
                        </p>
                      </div>
                    )}
                  </div>

                  {saveTaskStatus === 'success' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Rincian tugas berhasil diperbarui dan tersimpan!
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Rincian Tugas / Instruksi / Materi KD:
                    </label>
                    <textarea
                      rows={6}
                      value={taskDescText}
                      onChange={e => setTaskDescText(e.target.value)}
                      placeholder={`Masukkan instruksi atau rincian tugas untuk ${taskModalCol.label}.\nContoh: Tugas Praktikum Bab 1 - Membuat Diagram Jaringan & Soal Latihan Halaman 45.`}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-sans"
                    />
                  </div>

                  {/* Template Presets */}
                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Preset Cepat:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Latihan Soal Bab 1',
                        'Praktikum & Unjuk Kerja',
                        'Tugas Kelompok Proyek',
                        'Ulangan Harian Bab 1',
                        'Ujian Akhir Semester (UAS)'
                      ].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTaskDescText(prev => prev ? `${prev}\n• ${preset}` : preset)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg transition cursor-pointer border border-slate-200"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              {!isEditingTask ? (
                <>
                  {taskModalCol.description ? (
                    isConfirmingDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-rose-600 font-semibold">Hapus detail?</span>
                        <button
                          type="button"
                          onClick={handleDeleteTaskDescription}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Ya, Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDelete(false)}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingDelete(true)}
                        disabled={isSaving}
                        className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Detail
                      </button>
                    )
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingTask(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {taskModalCol.description ? 'Edit Detail Tugas' : 'Tambah Detail Tugas'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-end gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTask(false);
                      setTaskDescText(taskModalCol.description || '');
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTaskDescription}
                    disabled={isSaving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Simpan Detail Tugas
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Missing Grades Copy Modal Overlay */}
      {showMissingModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200 pointer-events-auto overscroll-none"
          onClick={() => setShowMissingModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 select-text relative z-10"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base leading-tight">Salin Siswa Belum Ada Nilai</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Redaksi pesan siap dikirim ke WhatsApp / Grup Kelas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMissingModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Column Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pilih Penilaian / Kolom:
                </label>
                <select
                  value={selectedColKey}
                  onChange={e => setSelectedColKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">
                    📌 Semua Kolom {gradeType === 'formative' ? 'Formatif' : 'Sumatif'} (Rangkuman Lengkap)
                  </option>
                  {(gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(col => (
                    <option key={col.key} value={col.key}>
                      {col.label || getColShortLabel(col)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message Editable Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Redaksi Pesan (Bisa Edit Bebas):
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400 font-mono">
                    {customMessageText.length} Karakter
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={customMessageText}
                  onChange={e => setCustomMessageText(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                  placeholder="Redaksi pesan akan otomatis dibuat..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(customMessageText)}`;
                  window.open(url, '_blank');
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
                Kirim via WhatsApp
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(customMessageText);
                    setCopiedStatus(true);
                    setTimeout(() => setCopiedStatus(false), 2500);
                  }}
                  className={`w-full sm:w-auto px-5 py-2.5 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                    copiedStatus
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {copiedStatus ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      Teks Berhasil Disalin!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Salin Teks Pesan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Grade Excel Modal Overlay */}
      {showImportModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-[9999] animate-in fade-in duration-200 pointer-events-auto overscroll-none"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 select-text relative z-10"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base leading-tight">
                    Import Nilai Excel ({gradeType === 'formative' ? 'Formatif / Harian' : 'Sumatif / Ujian'})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Memudahkan input nilai masal untuk seluruh siswa secara cepat lewat spreadsheet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Important Safety Notice */}
              <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-2xl flex items-center gap-3 text-xs text-blue-800">
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="leading-relaxed">
                  <span className="font-bold">Keamanan Data Nilai:</span> Proses impor Excel ini <span className="font-semibold underline">hanya</span> memperbarui nilai asesmen yang Anda pilih ({gradeType === 'formative' ? 'Formatif' : 'Sumatif'}) dan <span className="font-semibold">tidak akan menimpa kolom lain yang tidak dipilih maupun nilai remidi</span> yang sudah tersimpan.
                </div>
              </div>

              {/* Assessment Category Switcher: Formatif vs Sumatif */}
              <div className="bg-slate-100/90 p-1 sm:p-1.5 rounded-2xl flex items-center gap-1.5 sm:gap-2 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setGradeType('formative');
                    setImportTargetCol('all');
                    if (rawImportData.length > 0) {
                      const updated = processParsedImportRows(rawImportData, 'all', 'formative');
                      setImportedPreview(updated);
                    }
                  }}
                  className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    gradeType === 'formative'
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100 ring-2 ring-indigo-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">Formatif (Harian / TP)</span>
                  <span className="hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {activeFormativeCols.map(c => getColShortLabel(c)).join(', ')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGradeType('summative');
                    setImportTargetCol('all');
                    if (rawImportData.length > 0) {
                      const updated = processParsedImportRows(rawImportData, 'all', 'summative');
                      setImportedPreview(updated);
                    }
                  }}
                  className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    gradeType === 'summative'
                      ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100 ring-2 ring-emerald-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">Sumatif (Lingkup Materi / UAS)</span>
                  <span className="hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {activeSummativeCols.map(c => getColShortLabel(c)).join(', ')}
                  </span>
                </button>
              </div>

              {/* Target Column Selection Filter Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-indigo-600" />
                      Filter & Pilih Kolom Penilaian Target:
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Klik kolom tertentu ({gradeType === 'formative' ? 'Formatif F1, F2, F3...' : 'Sumatif S1, S2, S3...'}) yang ingin diimpor, atau pilih semua kolom sekaligus
                    </p>
                  </div>
                  {/* Synced Dropdown for Compact / Mobile View */}
                  <div className="shrink-0 w-full sm:w-auto">
                    <select
                      value={importTargetCol}
                      onChange={e => handleTargetColChange(e.target.value)}
                      aria-label="Pilih kolom target impor"
                      className="w-full sm:w-auto px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                    >
                      <option value="all">
                        📑 Semua Kolom Sekaligus ({gradeType === 'formative' ? 'Formatif' : 'Sumatif'})
                      </option>
                      {(gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(col => (
                        <option key={col.key} value={col.key}>
                          🎯 Hanya {getColShortLabel(col)} - {col.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Interactive Filter Pills / Buttons Grid */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {/* All columns pill */}
                  <button
                    type="button"
                    onClick={() => handleTargetColChange('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      importTargetCol === 'all'
                        ? 'bg-slate-800 text-white shadow-sm ring-2 ring-slate-400/50 ring-offset-1 scale-[1.02]'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-2xs'
                    }`}
                  >
                    <span>📑</span>
                    <span>Semua Kolom</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                      importTargetCol === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {(gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).length} Asesmen
                    </span>
                  </button>

                  {/* Individual Column Filter Pills */}
                  {(gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(col => {
                    const isSelected = importTargetCol === col.key;
                    const shortLabel = getColShortLabel(col);
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => handleTargetColChange(col.key)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? gradeType === 'formative'
                              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 ring-offset-1 scale-[1.02]'
                              : 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300 ring-offset-1 scale-[1.02]'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-2xs'
                        }`}
                      >
                        <span className={`px-1.5 py-0.5 rounded-md font-black font-mono text-[11px] ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : gradeType === 'formative'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {shortLabel}
                        </span>
                        <span className="truncate max-w-[140px] sm:max-w-[200px]">
                          {col.label}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Target Column Active Banner */}
                <div className={`flex items-start sm:items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs border ${
                  importTargetCol === 'all'
                    ? 'bg-white border-slate-200/90 text-slate-600 shadow-2xs'
                    : 'bg-emerald-50/90 border-emerald-200 text-emerald-800 shadow-2xs'
                }`}>
                  <span className="font-extrabold shrink-0 flex items-center gap-1">
                    {importTargetCol === 'all' ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-indigo-700">Mode Impor:</span>
                      </>
                    ) : (
                      <>
                        <Target className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-800">Target Kolom Terpilih:</span>
                      </>
                    )}
                  </span>
                  {importTargetCol === 'all' ? (
                    <span className="text-slate-600">
                      Mengimpor seluruh kolom penilaian yang ditemukan di file Excel ({(gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(c => getColShortLabel(c)).join(', ')}).
                    </span>
                  ) : (
                    (() => {
                      const curTargetObj = (gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).find(c => c.key === importTargetCol);
                      return (
                        <span className="font-medium">
                          Hanya memetakan dan memperbarui nilai ke kolom <strong>{curTargetObj?.label || getColShortLabel(curTargetObj!) || importTargetCol} ({getColShortLabel(curTargetObj!)})</strong>. Kolom asesmen lainnya dan catatan remidi dijamin tetap aman tidak tersentuh.
                        </span>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Step 1: Download Template */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-extrabold text-emerald-800 text-sm">
                    <Download className="w-4 h-4 text-emerald-600" />
                    Langkah 1: Unduh Format Template Excel
                  </div>
                  <p className="text-xs text-emerald-700/90 leading-relaxed">
                    {importTargetCol === 'all' ? (
                      <>Format lengkap berisi NIS, Nama Siswa ({students.length} siswa), dan semua kolom penilaian ({(gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(c => getColShortLabel(c)).join(', ')}).</>
                    ) : (
                      (() => {
                        const curTargetObj = (gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).find(c => c.key === importTargetCol);
                        return (
                          <>Format khusus untuk <strong>{curTargetObj?.label}</strong> ({getColShortLabel(curTargetObj!)}) berisi NIS, Nama Siswa ({students.length} siswa), dan 1 kolom nilai {getColShortLabel(curTargetObj!)}.</>
                        );
                      })()
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={students.length === 0}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-xs shrink-0 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  {importTargetCol === 'all'
                    ? 'Unduh Format Lengkap (.xlsx)'
                    : `Unduh Format ${getColShortLabel((gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).find(c => c.key === importTargetCol)!)} (.xlsx)`}
                </button>
              </div>

              {/* Step 2: Upload File */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Langkah 2: Pilih atau Unggah File Excel (.xlsx / .csv)
                </label>
                <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50 hover:bg-emerald-50/20 group cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleParseImportExcel}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs group-hover:scale-105 transition">
                      <Upload className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {importFileName ? importFileName : 'Klik atau seret file Excel ke sini'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Mendukung format file .xlsx, .xls, atau .csv
                      </p>
                    </div>
                  </div>
                </div>

                {isParsingImport && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-xs font-bold animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    Membaca dan memproses struktur file Excel...
                  </div>
                )}

                {importFileError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>{importFileError}</div>
                  </div>
                )}

                {importFileWarning && (
                  <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-800 text-xs font-medium space-y-2.5 shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-2 font-black text-rose-900 text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      Peringatan: Perbedaan Kelas Terdeteksi
                    </div>
                    <p className="leading-relaxed">
                      {importFileWarning}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 font-bold text-xs">
                      <span className="px-3 py-1 bg-white border border-rose-200 text-rose-800 rounded-lg shadow-2xs font-mono">
                        File Excel: Kelas {importDetectedClass}
                      </span>
                      <span className="text-rose-500 font-black">≠</span>
                      <span className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg shadow-2xs font-mono">
                        Kelas Aktif: Kelas {currentClassName}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700 italic">
                      Sistem memproteksi nilai siswa di Kelas {currentClassName}. Siswa dari kelas {importDetectedClass} otomatis berstatus <strong>Tidak Cocok</strong> dan nilainya tidak akan diterapkan ke siswa kelas ini.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 3: Interactive Roster Comparison Preview Table */}
              {importedPreview.length > 0 && (() => {
                const matchedPreview = importedPreview.filter(p => p.status === 'matched');
                const unexpectedPreview = importedPreview.filter(p => p.status === 'unmatched');

                const matchedStudentKeys = new Set(
                  matchedPreview
                    .map(p => (p.matchedStudent?.nis ? p.matchedStudent.nis.trim() : (p.matchedStudent?.nama ? p.matchedStudent.nama.trim().toLowerCase() : '')))
                    .filter(Boolean)
                );

                const missingRosterStudents = students.filter(s => {
                  const sKey = s.nis ? s.nis.trim() : s.nama.trim().toLowerCase();
                  return !matchedStudentKeys.has(sKey);
                });

                const countMatched = matchedPreview.length;
                const countUnexpected = unexpectedPreview.length;
                const countMissing = missingRosterStudents.length;
                const totalRoster = students.length;

                type ComparisonRow =
                  | { kind: 'imported'; data: typeof importedPreview[0] }
                  | { kind: 'missing'; student: Student };

                const rowsToRender: ComparisonRow[] = [];

                if (rosterFilterTab === 'all') {
                  importedPreview.forEach(p => rowsToRender.push({ kind: 'imported', data: p }));
                  missingRosterStudents.forEach(s => rowsToRender.push({ kind: 'missing', student: s }));
                } else if (rosterFilterTab === 'matched') {
                  matchedPreview.forEach(p => rowsToRender.push({ kind: 'imported', data: p }));
                } else if (rosterFilterTab === 'unexpected') {
                  unexpectedPreview.forEach(p => rowsToRender.push({ kind: 'imported', data: p }));
                } else if (rosterFilterTab === 'missing') {
                  missingRosterStudents.forEach(s => rowsToRender.push({ kind: 'missing', student: s }));
                }

                const handleToggleExcludeRow = (rowIdx: number) => {
                  setExcludedRowIndices(prev => 
                    prev.includes(rowIdx) ? prev.filter(i => i !== rowIdx) : [...prev, rowIdx]
                  );
                };

                return (
                  <div className="space-y-3.5">
                    {/* Header Step 3 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-extrabold text-slate-800 text-sm">
                        <Table className="w-4 h-4 text-indigo-600" />
                        Langkah 3: Pratinjau Perbandingan Roster & Validasi Nilai
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Roster Kelas Aktif: <strong>{totalRoster} Siswa</strong> | File Excel: <strong>{importedPreview.length} Baris</strong>
                      </div>
                    </div>

                    {/* Mismatch Exclusion & Protection Checkbox Banner */}
                    <div className="bg-amber-50/90 border-2 border-amber-300/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                      <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={excludeMismatches}
                          onChange={(e) => setExcludeMismatches(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-0.5 sm:mt-0 accent-emerald-600"
                        />
                        <div>
                          <div className="font-extrabold text-xs text-amber-950 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                            Keluarkan / Lewati Baris Tidak Cocok (Skip / Exclude Mismatches)
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                            Mencegah kerusakan data: Siswa tak terduga (oranye) dan beda kelas otomatis dilewati saat proses simpan ke Firebase. Hanya siswa cocok yang akan diperbarui.
                          </p>
                        </div>
                      </label>
                      <span className={`text-[11px] font-bold px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-1.5 shadow-2xs ${
                        excludeMismatches 
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        {excludeMismatches ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Proteksi Aktif (Aman)
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            Proteksi Dimatikan
                          </>
                        )}
                      </span>
                    </div>

                    {/* Comparison Category Tabs */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setRosterFilterTab('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          rosterFilterTab === 'all'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        Semua ({importedPreview.length + countMissing})
                      </button>

                      <button
                        type="button"
                        onClick={() => setRosterFilterTab('matched')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          rosterFilterTab === 'matched'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cocok ({countMatched})
                      </button>

                      <button
                        type="button"
                        onClick={() => setRosterFilterTab('unexpected')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          rosterFilterTab === 'unexpected'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Tak Terduga di File ({countUnexpected})
                      </button>

                      <button
                        type="button"
                        onClick={() => setRosterFilterTab('missing')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          rosterFilterTab === 'missing'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
                        }`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Hilang dari File ({countMissing})
                      </button>
                    </div>

                    {/* Comparison Preview Table */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[340px] overflow-y-auto shadow-inner bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100/90 sticky top-0 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">
                              {excludeMismatches ? 'Status' : 'Pilih'}
                            </th>
                            <th className="py-2.5 px-3">No</th>
                            <th className="py-2.5 px-3">NIS</th>
                            <th className="py-2.5 px-3">Nama Siswa & Status Roster</th>
                            <th className="py-2.5 px-3 text-center">Status Validasi</th>
                            {importTargetCol === 'all' ? (
                              (gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(col => (
                                <th key={col.key} className="py-2.5 px-3 text-center">
                                  {getColShortLabel(col)}
                                </th>
                              ))
                            ) : (
                              (() => {
                                const curTargetObj = (gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).find(c => c.key === importTargetCol);
                                return (
                                  <th className="py-2.5 px-3 text-center bg-emerald-100/80 text-emerald-900 border-x border-emerald-200 font-black">
                                    🎯 {getColShortLabel(curTargetObj!)} ({curTargetObj?.label || importTargetCol})
                                  </th>
                                );
                              })()
                            )}
                            <th className="py-2.5 px-3 text-center">Aksi Impor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rowsToRender.map((row, idx) => {
                            if (row.kind === 'missing') {
                              // Missing student from uploaded file (registered in current class but absent in Excel)
                              const st = row.student;
                              return (
                                <tr key={`missing-${st.nis || idx}`} className="bg-rose-50/70 border-l-4 border-l-rose-500 hover:bg-rose-100/50 transition">
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" title="Siswa tidak ada di file" />
                                  </td>
                                  <td className="py-2.5 px-3 text-rose-500 font-mono text-[11px] font-bold">-</td>
                                  <td className="py-2.5 px-3 font-mono font-medium text-rose-900">
                                    <div>{st.nis || '-'}</div>
                                    <span className="text-[10px] text-rose-600 font-bold font-sans">
                                      Kelas {currentClassName || 'aktif'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-extrabold text-rose-950 flex items-center gap-1.5">
                                      <UserX className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                      {st.nama}
                                    </div>
                                    <div className="text-[10px] text-rose-700 font-medium mt-0.5 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                                      Terdaftar di Kelas {currentClassName}, namun tidak ditemukan di file Excel.
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                      <UserX className="w-3 h-3 text-rose-600" /> Hilang dari File
                                    </span>
                                  </td>
                                  {importTargetCol === 'all' ? (
                                    (gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(col => (
                                      <td key={col.key} className="py-2.5 px-3 text-center font-mono text-rose-400 italic text-[11px]">
                                        -
                                      </td>
                                    ))
                                  ) : (
                                    <td className="py-2.5 px-3 text-center font-mono text-rose-600 italic text-[11px] bg-rose-50/90 border-x border-rose-200">
                                      Tidak ada data
                                    </td>
                                  )}
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className="text-[11px] font-semibold text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                                      Nilai Lama Aman
                                    </span>
                                  </td>
                                </tr>
                              );
                            }

                            // Imported row from Excel file
                            const item = row.data;
                            const isExcluded = excludedRowIndices.includes(item.idx);
                            const isUnexpected = item.status === 'unmatched';
                            const isEffectivelyExcluded = isUnexpected ? excludeMismatches || isExcluded : isExcluded;

                            return (
                              <tr
                                key={`item-${item.idx}`}
                                className={
                                  isUnexpected
                                    ? 'bg-amber-50/80 border-l-4 border-l-amber-500 hover:bg-amber-100/60 transition'
                                    : isExcluded
                                    ? 'bg-slate-50/90 opacity-60'
                                    : 'hover:bg-slate-50 transition'
                                }
                              >
                                <td className="py-2.5 px-3 text-center">
                                  {isUnexpected ? (
                                    <input
                                      type="checkbox"
                                      disabled={excludeMismatches}
                                      checked={!isEffectivelyExcluded}
                                      onChange={() => handleToggleExcludeRow(item.idx)}
                                      title={excludeMismatches ? 'Otomatis dilewati karena proteksi aktif' : 'Pilih untuk menyertakan'}
                                      className="w-4 h-4 rounded text-amber-600 border-amber-300 focus:ring-amber-500 cursor-pointer disabled:opacity-40"
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={!isExcluded}
                                      onChange={() => handleToggleExcludeRow(item.idx)}
                                      title="Centang untuk menyertakan dalam proses simpan"
                                      className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                    />
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{item.idx}</td>
                                <td className="py-2.5 px-3 font-mono font-medium text-slate-600">
                                  <div>{item.nis}</div>
                                  {item.rowClass && !isClassMatch(item.rowClass, currentClassName) ? (
                                    <span className="text-[10px] text-amber-700 font-bold font-sans px-1.5 py-0.5 bg-amber-100 rounded">
                                      Kelas {item.rowClass}
                                    </span>
                                  ) : item.rowClass ? (
                                    <span className="text-[10px] text-slate-500 font-sans">
                                      Kelas {item.rowClass}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className={`font-bold ${isUnexpected ? 'text-amber-950' : 'text-slate-800'}`}>
                                    {item.nama}
                                  </div>
                                  {item.matchedStudent && item.matchedStudent.nama.toLowerCase() !== item.nama.toLowerCase() && (
                                    <div className="text-[10px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                      Cocok di Roster: <strong>{item.matchedStudent.nama}</strong>
                                    </div>
                                  )}
                                  {isUnexpected && (
                                    <div className="text-[10px] text-amber-800 font-semibold mt-0.5 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                      {item.matchReason || `Bukan siswa Kelas ${currentClassName || 'aktif'}`}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {item.status === 'matched' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shadow-2xs">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cocok
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Tak Terduga di File
                                    </span>
                                  )}
                                </td>
                                {importTargetCol === 'all' ? (
                                  (gradeType === 'formative' ? activeFormativeCols : activeSummativeCols).map(col => {
                                    const score = item.scores[col.key];
                                    return (
                                      <td key={col.key} className="py-2.5 px-3 text-center font-mono font-bold">
                                        {score !== null && score !== undefined ? (
                                          <span className={score >= currentKktp ? 'text-indigo-600' : 'text-amber-600'}>
                                            {score}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    );
                                  })
                                ) : (
                                  (() => {
                                    const score = item.scores[importTargetCol];
                                    return (
                                      <td className="py-2.5 px-3 text-center font-mono font-bold bg-emerald-50/50 border-x border-emerald-100">
                                        {score !== null && score !== undefined ? (
                                          <span className={`text-sm ${score >= currentKktp ? 'text-emerald-700' : 'text-rose-600 font-black'}`}>
                                            {score}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 italic text-[11px] font-normal">Kosong / -</span>
                                        )}
                                      </td>
                                    );
                                  })()
                                )}
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {isEffectivelyExcluded ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                      Dilewati
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Siap Diimpor
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
                );
              })()}

              {/* Step 4: Summary View Before Confirmation / Save to Firebase */}
              {importedPreview.length > 0 && (() => {
                const currentCols = gradeType === 'formative' ? activeFormativeCols : activeSummativeCols;
                const isSingleTarget = importTargetCol !== 'all';
                const curTargetObj = currentCols.find(c => c.key === importTargetCol);
                const columnKey = isSingleTarget && curTargetObj ? getColShortLabel(curTargetObj) : (isSingleTarget ? importTargetCol.toUpperCase() : 'Semua Kolom');
                const columnLabel = isSingleTarget && curTargetObj ? curTargetObj.label : 'Seluruh Kolom Penilaian';

                const matchedItems = importedPreview.filter(p => p.status === 'matched');
                const unexpectedItems = importedPreview.filter(p => p.status === 'unmatched');
                const matchedStudentKeys = new Set(
                  matchedItems.map(p => (p.matchedStudent?.nis ? p.matchedStudent.nis.trim() : (p.matchedStudent?.nama ? p.matchedStudent.nama.trim().toLowerCase() : ''))).filter(Boolean)
                );
                const missingStudents = students.filter(s => {
                  const sKey = s.nis ? s.nis.trim() : s.nama.trim().toLowerCase();
                  return !matchedStudentKeys.has(sKey);
                });

                const eligibleItems = matchedItems.filter(p => {
                  if (excludeMismatches && p.status !== 'matched') return false;
                  return !excludedRowIndices.includes(p.idx);
                });

                const studentsWithScore = isSingleTarget
                  ? eligibleItems.filter(p => p.scores[importTargetCol] !== null && p.scores[importTargetCol] !== undefined && !isNaN(p.scores[importTargetCol] as number))
                  : eligibleItems.filter(p => Object.values(p.scores).some(v => v !== null && v !== undefined && !isNaN(v as number)));

                const countUpdating = studentsWithScore.length;
                const totalMatched = matchedItems.length;
                const countSkipped = Math.max(0, totalMatched - countUpdating);
                const countUnmatched = unexpectedItems.length;

                return (
                  <div className="bg-gradient-to-br from-indigo-50/80 via-emerald-50/70 to-slate-50 border-2 border-indigo-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-indigo-100">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-800 text-sm">
                              Ringkasan Impor Sebelum Simpan ke Firebase
                            </h4>
                            <span className="font-mono px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[11px] font-black rounded-md">
                              Key: {columnKey}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Harap verifikasi ringkasan kolom dan jumlah siswa sebelum mengonfirmasi penyimpanan permanen.
                          </p>
                        </div>
                      </div>
                      {countUpdating > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full text-xs font-bold self-start sm:self-auto shrink-0 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Siap Disimpan ke Firebase
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 border border-rose-300 text-rose-800 rounded-full text-xs font-bold self-start sm:self-auto shrink-0 shadow-2xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          Tidak Ada Data yang Cocok
                        </span>
                      )}
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Metric 1: Specific Column Key */}
                      <div className="bg-white/95 border border-indigo-100/80 rounded-xl p-3.5 shadow-2xs space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-indigo-600" />
                          Target Kolom Asesmen
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-indigo-600 text-white font-mono font-black text-sm rounded-lg shadow-2xs tracking-wide">
                            {columnKey}
                          </span>
                          <span className="font-bold text-slate-800 text-xs truncate">
                            {columnLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          {isSingleTarget
                            ? `Hanya kolom '${columnKey}' yang akan di-update di Firebase. Kolom lain tidak berubah.`
                            : `Seluruh kolom (${currentCols.map(c => getColShortLabel(c)).join(', ')}) akan di-update sekaligus.`}
                        </p>
                      </div>

                      {/* Metric 2: Number of Students Being Updated */}
                      <div className="bg-white/95 border border-emerald-100/80 rounded-xl p-3.5 shadow-2xs space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          Siswa yang Diperbarui
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black font-mono tracking-tight ${countUpdating > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {countUpdating}
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            dari {totalMatched} siswa cocok ({students.length} total roster)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          {countUpdating > 0
                            ? `${countUpdating} siswa cocok memiliki skor valid yang siap disimpan ke Firebase.`
                            : totalMatched === 0
                            ? `0 siswa cocok dengan Kelas ${currentClassName || 'aktif'}. File dari kelas lain tidak dapat disimpan ke sini.`
                            : `Belum ada nilai valid yang terisi pada kolom '${columnKey}'.`}
                        </p>
                      </div>

                      {/* Metric 3: Target Database & Protection */}
                      <div className="bg-white/95 border border-slate-200/80 rounded-xl p-3.5 shadow-2xs space-y-1.5 sm:col-span-2 lg:col-span-1">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-teal-600" />
                          Proteksi Integritas Data
                        </div>
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          {excludeMismatches ? 'Proteksi Ketat Aktif' : 'Peringatan: Proteksi Manual'}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          {countUnmatched} siswa tak terduga dilewati | {missingStudents.length} siswa hilang tetap aman.
                        </p>
                      </div>
                    </div>

                    {/* Context alerts if needed */}
                    {(countSkipped > 0 || countUnmatched > 0 || missingStudents.length > 0) && (
                      <div className="space-y-1.5 pt-0.5">
                        {countUnmatched > 0 && (
                          <div className="text-[11px] text-amber-900 bg-amber-50/90 border border-amber-300 rounded-lg px-3 py-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>{countUnmatched} siswa tak terduga (oranye)</strong> pada file Excel bukan anggota Kelas {currentClassName} dan <strong>dikecualikan/dilewati</strong> demi mencegah kerusakan data.
                            </span>
                          </div>
                        )}
                        {missingStudents.length > 0 && (
                          <div className="text-[11px] text-rose-900 bg-rose-50/90 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2">
                            <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>
                              <strong>{missingStudents.length} siswa kelas ini (merah)</strong> tidak ada di file Excel yang diunggah. Nilai lama mereka tetap aman tidak terhapus.
                            </span>
                          </div>
                        )}
                        {countSkipped > 0 && (
                          <div className="text-[11px] text-indigo-900 bg-indigo-50/90 border border-indigo-200 rounded-lg px-3 py-2 flex items-center gap-2">
                            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>
                              <strong>{countSkipped} siswa cocok</strong> tidak memiliki nilai untuk kolom <strong>{columnKey}</strong> pada file Excel. Nilai lama mereka tetap dipertahankan aman.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            {(() => {
              const currentCols = gradeType === 'formative' ? activeFormativeCols : activeSummativeCols;
              const isSingleTarget = importTargetCol !== 'all';
              const curTargetObj = currentCols.find(c => c.key === importTargetCol);
              const columnKey = isSingleTarget && curTargetObj ? getColShortLabel(curTargetObj) : (isSingleTarget ? importTargetCol.toUpperCase() : 'Semua Kolom');

              const matchedItems = importedPreview.filter(p => p.status === 'matched');
              const eligibleItems = matchedItems.filter(p => {
                if (excludeMismatches && p.status !== 'matched') return false;
                return !excludedRowIndices.includes(p.idx);
              });
              const studentsWithScore = isSingleTarget
                ? eligibleItems.filter(p => p.scores[importTargetCol] !== null && p.scores[importTargetCol] !== undefined && !isNaN(p.scores[importTargetCol] as number))
                : eligibleItems.filter(p => Object.values(p.scores).some(v => v !== null && v !== undefined && !isNaN(v as number)));
              const countUpdating = studentsWithScore.length;

              return (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Batal
                    </button>
                    {importedPreview.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 font-medium">Ringkasan:</span>
                        <span className="font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[11px] border border-indigo-200">
                          {columnKey}
                        </span>
                        <span className="font-bold text-emerald-700">
                          {countUpdating} Siswa
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyImportedGrades}
                    disabled={importedPreview.length === 0 || isSaving || countUpdating === 0}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Menyimpan ke Firebase...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {importTargetCol === 'all'
                          ? `Konfirmasi & Simpan (${countUpdating} Siswa) ke Firebase`
                          : `Konfirmasi & Simpan Nilai ${columnKey} (${countUpdating} Siswa) ke Firebase`}
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Photo Zoom Modal Overlay */}
      {zoomedPhoto && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 z-[9999] animate-in fade-in duration-200 pointer-events-auto overscroll-none"
          onClick={() => setZoomedPhoto(null)}
        >
          <div 
            className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl max-w-lg md:max-w-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative select-text z-10"
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

      {/* Modal Profil Riwayat Nilai Siswa (Sem 1 & Sem 2) */}
      <StudentGradeHistoryModal
        isOpen={Boolean(selectedHistoryStudent)}
        onClose={() => setSelectedHistoryStudent(null)}
        student={selectedHistoryStudent}
        currentSemester={selectedSemester}
        currentFormative={localFormative}
        currentSummative={localSummative}
        currentAttitude={attitudeGrades}
        formativeColsSem1={formativeColsSem1 || DEFAULT_FORMATIVE_COLS}
        formativeColsSem2={formativeColsSem2 || DEFAULT_FORMATIVE_COLS}
        summativeColsSem1={(summativeColsSem1 || DEFAULT_SUMMATIVE_COLS).filter(c => c && c.key !== 'uts')}
        summativeColsSem2={(summativeColsSem2 || DEFAULT_SUMMATIVE_COLS).filter(c => c && c.key !== 'uts')}
        gradeWeights={gradeWeights}
        studentNotes={studentNotes}
        attendance={attendance}
        recap={recap}
      />
    </div>
  );
}
