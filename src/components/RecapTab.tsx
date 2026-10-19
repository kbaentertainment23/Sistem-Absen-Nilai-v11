import React, { useState, useEffect, useMemo } from 'react';
import { stripClockFromJamString } from '../utils/textHelper';
import { 
  Student, 
  AttendanceRecord, 
  GradeFormative, 
  GradeSummative, 
  GradeAttitude,
  MonthlyRecap, 
  GradeColumn, 
  StudentNote, 
  GradeWeightConfig 
} from '../types';
import { calculateStudentGradeBreakdown, DEFAULT_GRADE_WEIGHTS, KKTP_STANDARD } from '../utils/gradeCalculator';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell,
  ReferenceLine,
  LabelList
} from 'recharts';
import { 
  Users, 
  Award, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown,
  ClipboardCheck, 
  Sparkles, 
  AlertTriangle, 
  Clock, 
  BarChart3, 
  BarChart2,
  LineChart as LineChartIcon, 
  Filter, 
  User,
  PieChart as PieChartIcon,
  Search,
  CheckCircle2,
  CalendarCheck,
  BookOpen,
  Eye,
  LayoutGrid,
  ArrowRight,
  Target,
  Layers
} from 'lucide-react';

interface RecapTabProps {
  students: Student[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  attitudeGrades?: GradeAttitude[];
  recap: MonthlyRecap[];
  formativeCols?: GradeColumn[];
  summativeCols?: GradeColumn[];
  notes?: StudentNote[];
  selectedSemester?: 1 | 2;
  allAttendance?: AttendanceRecord[];
  allFormative?: GradeFormative[];
  allSummative?: GradeSummative[];
  allNotes?: StudentNote[];
  activeClassName?: string;
  gradeWeights?: GradeWeightConfig;
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

type ChartViewMode = 'progression_bar' | 'comparison' | 'class_trend' | 'individual' | 'distribution';
type RecapSubTab = 'charts' | 'progression' | 'monitoring' | 'monthly' | 'character' | 'all';

export default function RecapTab({
  students,
  formativeGrades,
  summativeGrades,
  attitudeGrades = [],
  recap,
  formativeCols = [],
  summativeCols = [],
  notes = [],
  allAttendance = [],
  gradeWeights = DEFAULT_GRADE_WEIGHTS
}: RecapTabProps) {
  const activeFormativeCols = formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS;
  const activeSummativeCols = (summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS).filter(c => c && c.key !== 'uts');

  const currentKktp = gradeWeights?.kktp ?? KKTP_STANDARD;

  // Sub-Navigation Tab State
  const [activeSubTab, setActiveSubTab] = useState<RecapSubTab>('charts');

  // Search & Filter States
  const [monthlySearch, setMonthlySearch] = useState('');
  const [monthlyFilter, setMonthlyFilter] = useState<'all' | 'perfect' | 'late' | 'low'>('all');
  const [characterSearch, setCharacterSearch] = useState('');
  const [characterFilter, setCharacterFilter] = useState<'all' | 'aktif' | 'bermasalah'>('all');

  const [selectedStudentNisForNotes, setSelectedStudentNisForNotes] = useState<string | null>(null);
  
  // Recharts Chart View State
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('progression_bar');
  const [filterStudentOption, setFilterStudentOption] = useState<'top3' | 'top5' | 'top10' | 'all' | 'needs_improvement'>('all');
  const [selectedStudentForTrend, setSelectedStudentForTrend] = useState<string>('');
  const [progressionFilterScope, setProgressionFilterScope] = useState<'all' | 'formatif' | 'sumatif'>('all');
  const [showProgressionStudentCompare, setShowProgressionStudentCompare] = useState<boolean>(false);
  const [selectedProgressionStudent, setSelectedProgressionStudent] = useState<string>('');

  // Scroll to top when changing sub-tab
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeSubTab]);

  // 1. Calculate general stats
  const totalStudents = students.length;
  
  const studentsWithAttendance = recap.filter(r => ((Number(r.hadir) || 0) + (Number(r.sakit) || 0) + (Number(r.izin) || 0) + (Number(r.alfa) || 0)) > 0);
  const rawAvg = studentsWithAttendance.length > 0
    ? (studentsWithAttendance.reduce((acc, curr) => acc + (isNaN(Number(curr.persentaseKehadiran)) ? 0 : Number(curr.persentaseKehadiran)), 0) / studentsWithAttendance.length) * 100
    : 0;
  const avgAttendance = isNaN(rawAvg) ? 0 : rawAvg;

  const totalLateCases = recap.reduce((acc, curr) => acc + (Number(curr?.terlambatCount) || 0), 0);

  // Top disciplined (only students with attendance > 0 days and >= 80% attendance)
  const topDisciplined = useMemo(() => {
    return [...recap]
      .filter(r => (r.hadir + r.sakit + r.izin + r.alfa) > 0)
      .sort((a, b) => b.persentaseKehadiran - a.persentaseKehadiran)
      .filter(r => r.persentaseKehadiran >= 0.8)
      .slice(0, 5);
  }, [recap]);

  // Needs attention (only students with attendance > 0 days and < 85% attendance or high lateness)
  const needsAttention = useMemo(() => {
    return [...recap]
      .filter(r => (r.hadir + r.sakit + r.izin + r.alfa) > 0 && (r.persentaseKehadiran < 0.85 || r.terlambatCount > 1))
      .sort((a, b) => a.persentaseKehadiran - b.persentaseKehadiran || b.terlambatCount - a.terlambatCount)
      .slice(0, 5);
  }, [recap]);

  // Helper to calculate average from non-null values dynamically
  const calculateAvg = (scores: (number | string | null | undefined)[]): number => {
    const validScores = scores
      .map(v => (v !== null && v !== undefined && v !== '' ? Number(v) : NaN))
      .filter((v): v is number => !isNaN(v) && v >= 0);
    if (validScores.length === 0) return 0;
    const total = validScores.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((total / validScores.length).toFixed(1));
  };

  // 2. Prepare Academic Data for Recharts
  const allAcademicData = useMemo(() => {
    return students.map((s, idx) => {
      const f = formativeGrades.find(g => g.nis === s.nis);
      const sum = summativeGrades.find(g => g.nis === s.nis);
      const att = attitudeGrades.find(g => g.nis === s.nis);
      
      const rawAbsen = s.noAbsen ? String(s.noAbsen).replace(/^no\.?\s*/i, '').trim() : String(idx + 1);

      const breakdown = calculateStudentGradeBreakdown(
        s,
        f,
        sum,
        activeFormativeCols,
        activeSummativeCols,
        gradeWeights,
        att,
        notes,
        recap,
        allAttendance
      );

      return {
        nis: s.nis,
        nama: s.nama,
        noAbsen: rawAbsen,
        name: rawAbsen,
        'Nilai Formatif': parseFloat(breakdown.formatifAvg.toFixed(1)),
        'Nilai Sumatif': parseFloat(breakdown.sumatifAvg.toFixed(1)),
        'Nilai UAS': parseFloat(breakdown.uasScore.toFixed(1)),
        'Nilai Sikap': parseFloat(breakdown.sikapScore.toFixed(1)),
        overallAverage: parseFloat(breakdown.finalGrade.toFixed(1)),
        predicate: breakdown.predicate,
        status: breakdown.status
      };
    });
  }, [students, formativeGrades, summativeGrades, attitudeGrades, recap, notes, allAttendance, gradeWeights, activeFormativeCols, activeSummativeCols]);

  // Filtered Academic Data for Comparison Chart
  const filteredAcademicData = useMemo(() => {
    const sorted = [...allAcademicData].sort((a, b) => b.overallAverage - a.overallAverage);
    if (filterStudentOption === 'top3') return sorted.slice(0, 3);
    if (filterStudentOption === 'top5') return sorted.slice(0, 5);
    if (filterStudentOption === 'top10') return sorted.slice(0, 10);
    if (filterStudentOption === 'needs_improvement') {
      const filtered = sorted.filter(s => s.overallAverage > 0 && s.overallAverage < currentKktp);
      return filtered.length > 0 ? filtered : sorted.slice(-5);
    }
    return sorted;
  }, [allAcademicData, filterStudentOption, currentKktp]);

  // Progression Bar Data from Formatif 1 to Sumatif Terakhir
  const progressionAssessmentList = useMemo(() => {
    const formatifItems = activeFormativeCols.map((col, idx) => ({
      key: col.key,
      label: col.label,
      shortLabel: `F${idx + 1}`,
      category: 'Formatif' as const,
      index: idx + 1,
      baseColor: '#6366f1' // Indigo
    }));

    const summativeItems = activeSummativeCols.map((col, idx) => ({
      key: col.key,
      label: col.label,
      shortLabel: col.key === 'uas' ? 'UAS' : `S${idx + 1}`,
      category: 'Sumatif' as const,
      index: idx + 1,
      baseColor: col.key === 'uas' ? '#8b5cf6' : '#0ea5e9' // Violet for UAS, Sky for regular Sumatif
    }));

    return [...formatifItems, ...summativeItems];
  }, [activeFormativeCols, activeSummativeCols]);

  const progressionBarData = useMemo(() => {
    const activeStudentNis = selectedProgressionStudent || selectedStudentForTrend;
    return progressionAssessmentList.map((item, idx) => {
      let rawScores: number[] = [];
      if (item.category === 'Formatif') {
        rawScores = formativeGrades
          .map(g => Number(g[item.key]))
          .filter(v => !isNaN(v) && v > 0);
      } else {
        rawScores = summativeGrades
          .map(g => Number(g[item.key]))
          .filter(v => !isNaN(v) && v > 0);
      }

      const count = rawScores.length;
      const avg = count > 0 ? rawScores.reduce((a, b) => a + b, 0) / count : 0;
      const highest = count > 0 ? Math.max(...rawScores) : 0;
      const lowest = count > 0 ? Math.min(...rawScores) : 0;
      const tuntasCount = rawScores.filter(v => v >= currentKktp).length;
      const tuntasPct = count > 0 ? (tuntasCount / count) * 100 : 0;

      let studentVal: number | null = null;
      if (activeStudentNis) {
        if (item.category === 'Formatif') {
          const rec = formativeGrades.find(g => g.nis === activeStudentNis);
          const v = rec ? Number(rec[item.key]) : NaN;
          studentVal = !isNaN(v) && v > 0 ? v : null;
        } else {
          const rec = summativeGrades.find(g => g.nis === activeStudentNis);
          const v = rec ? Number(rec[item.key]) : NaN;
          studentVal = !isNaN(v) && v > 0 ? v : null;
        }
      }

      return {
        stageId: item.key,
        stageName: item.label,
        shortLabel: item.shortLabel,
        category: item.category,
        order: idx + 1,
        'Rata-Rata Kelas': parseFloat(avg.toFixed(1)),
        'Nilai Siswa': studentVal,
        highest,
        lowest,
        totalGraded: count,
        tuntasCount,
        tuntasPct: parseFloat(tuntasPct.toFixed(1)),
        color: item.baseColor
      };
    });
  }, [progressionAssessmentList, formativeGrades, summativeGrades, selectedProgressionStudent, selectedStudentForTrend]);

  // Filtered Progression Bar Data based on scope (all, formatif, sumatif)
  const filteredProgressionBarData = useMemo(() => {
    if (progressionFilterScope === 'formatif') {
      return progressionBarData.filter(d => d.category === 'Formatif');
    }
    if (progressionFilterScope === 'sumatif') {
      return progressionBarData.filter(d => d.category === 'Sumatif');
    }
    return progressionBarData;
  }, [progressionBarData, progressionFilterScope]);

  // Progression Statistical Insights
  const progressionInsights = useMemo(() => {
    if (progressionBarData.length === 0) return null;

    const validStages = progressionBarData.filter(d => d['Rata-Rata Kelas'] > 0);
    const firstStage = progressionBarData[0];
    const lastStage = progressionBarData[progressionBarData.length - 1];

    const firstScore = firstStage && !isNaN(Number(firstStage['Rata-Rata Kelas'])) ? Number(firstStage['Rata-Rata Kelas']) : 0;
    const lastScore = lastStage && !isNaN(Number(lastStage['Rata-Rata Kelas'])) ? Number(lastStage['Rata-Rata Kelas']) : 0;
    const rawDelta = lastScore - firstScore;
    const delta = isNaN(rawDelta) ? 0 : parseFloat(rawDelta.toFixed(1));

    const highestStage = validStages.length > 0 
      ? [...validStages].sort((a, b) => b['Rata-Rata Kelas'] - a['Rata-Rata Kelas'])[0]
      : null;
    const lowestStage = validStages.length > 0
      ? [...validStages].sort((a, b) => a['Rata-Rata Kelas'] - b['Rata-Rata Kelas'])[0]
      : null;

    const formatifStages = progressionBarData.filter(d => d.category === 'Formatif' && d['Rata-Rata Kelas'] > 0);
    const sumatifStages = progressionBarData.filter(d => d.category === 'Sumatif' && d['Rata-Rata Kelas'] > 0);

    const formatifRawAvg = formatifStages.length > 0
      ? formatifStages.reduce((acc, curr) => acc + (Number(curr['Rata-Rata Kelas']) || 0), 0) / formatifStages.length
      : 0;
    const formatifOverallAvg = isNaN(formatifRawAvg) ? 0 : parseFloat(formatifRawAvg.toFixed(1));

    const sumatifRawAvg = sumatifStages.length > 0
      ? sumatifStages.reduce((acc, curr) => acc + (Number(curr['Rata-Rata Kelas']) || 0), 0) / sumatifStages.length
      : 0;
    const sumatifOverallAvg = isNaN(sumatifRawAvg) ? 0 : parseFloat(sumatifRawAvg.toFixed(1));

    return {
      firstScore,
      lastScore,
      delta,
      isPositive: delta >= 0,
      highestStage,
      lowestStage,
      formatifOverallAvg,
      sumatifOverallAvg,
      totalStages: progressionBarData.length
    };
  }, [progressionBarData]);

  // Class Assessment Progression Trend Data (Average per assessment column)
  const classAssessmentTrendData = useMemo(() => {
    const formativePoints = activeFormativeCols.map(col => {
      const validScores = formativeGrades
        .map(g => Number(g[col.key]))
        .filter(val => !isNaN(val) && val > 0);
      const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;
      return {
        evalName: col.label,
        category: 'Formatif',
        'Rata-Rata Class': parseFloat(avg.toFixed(1)),
      };
    });

    const summativePoints = activeSummativeCols.map(col => {
      const validScores = summativeGrades
        .map(g => Number(g[col.key]))
        .filter(val => !isNaN(val) && val > 0);
      const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;
      return {
        evalName: col.label,
        category: 'Sumatif',
        'Rata-Rata Class': parseFloat(avg.toFixed(1)),
      };
    });

    return [...formativePoints, ...summativePoints];
  }, [formativeGrades, summativeGrades, activeFormativeCols, activeSummativeCols]);

  // Individual Student Trend Data across Formative & Summative
  const defaultStudentNis = selectedStudentForTrend || (students[0]?.nis ?? '');
  const activeTrendStudent = students.find(s => s.nis === defaultStudentNis);

  const individualStudentTrendData = useMemo(() => {
    if (!defaultStudentNis) return [];
    
    const fRecord = formativeGrades.find(g => g.nis === defaultStudentNis);
    const sRecord = summativeGrades.find(g => g.nis === defaultStudentNis);

    const formativePoints = activeFormativeCols.map(col => {
      const val = fRecord ? Number(fRecord[col.key]) : NaN;
      const studentScore = !isNaN(val) && val > 0 ? val : null;
      
      const validClassScores = formativeGrades
        .map(g => Number(g[col.key]))
        .filter(v => !isNaN(v) && v > 0);
      const classAvg = validClassScores.length > 0 ? validClassScores.reduce((a, b) => a + b, 0) / validClassScores.length : 0;

      return {
        evalName: col.label,
        category: 'Formatif',
        'Nilai Siswa': studentScore,
        'Rata-Rata Kelas': parseFloat(classAvg.toFixed(1)),
      };
    });

    const summativePoints = activeSummativeCols.map(col => {
      const val = sRecord ? Number(sRecord[col.key]) : NaN;
      const studentScore = !isNaN(val) && val > 0 ? val : null;

      const validClassScores = summativeGrades
        .map(g => Number(g[col.key]))
        .filter(v => !isNaN(v) && v > 0);
      const classAvg = validClassScores.length > 0 ? validClassScores.reduce((a, b) => a + b, 0) / validClassScores.length : 0;

      return {
        evalName: col.label,
        category: 'Sumatif',
        'Nilai Siswa': studentScore,
        'Rata-Rata Kelas': parseFloat(classAvg.toFixed(1)),
      };
    });

    return [...formativePoints, ...summativePoints];
  }, [defaultStudentNis, formativeGrades, summativeGrades, activeFormativeCols, activeSummativeCols]);

  // Grade Distribution Data
  const gradeDistributionData = useMemo(() => {
    const totalWithGrades = allAcademicData.filter(d => d.overallAverage > 0);
    if (totalWithGrades.length === 0) return [];

    const distribution = [
      { category: 'Sangat Baik (≥85)', count: totalWithGrades.filter(d => d.overallAverage >= 85).length, color: '#10b981' },
      { category: 'Baik (75-84)', count: totalWithGrades.filter(d => d.overallAverage >= 75 && d.overallAverage < 85).length, color: '#6366f1' },
      { category: 'Cukup (65-74)', count: totalWithGrades.filter(d => d.overallAverage >= 65 && d.overallAverage < 75).length, color: '#f59e0b' },
      { category: 'Perlu Bimbingan (<65)', count: totalWithGrades.filter(d => d.overallAverage < 65).length, color: '#f43f5e' },
    ];
    return distribution.filter(d => d.count > 0);
  }, [allAcademicData]);

  // Filtered Monthly Recap Rows
  const filteredMonthlyRecap = useMemo(() => {
    return recap.filter(row => {
      const matchSearch = monthlySearch === '' || 
        row.nama.toLowerCase().includes(monthlySearch.toLowerCase()) || 
        row.nis.toLowerCase().includes(monthlySearch.toLowerCase());
      if (!matchSearch) return false;

      if (monthlyFilter === 'perfect') {
        return (row.hadir + row.sakit + row.izin + row.alfa) > 0 && row.persentaseKehadiran >= 0.99;
      }
      if (monthlyFilter === 'late') {
        return row.terlambatCount > 0;
      }
      if (monthlyFilter === 'low') {
        return (row.hadir + row.sakit + row.izin + row.alfa) > 0 && row.persentaseKehadiran < 0.85;
      }
      return true;
    });
  }, [recap, monthlySearch, monthlyFilter]);

  // Filtered Students for Character Notes
  const filteredStudentsForCharacter = useMemo(() => {
    return students.filter(s => {
      const matchSearch = characterSearch === '' || 
        s.nama.toLowerCase().includes(characterSearch.toLowerCase()) || 
        s.nis.toLowerCase().includes(characterSearch.toLowerCase());
      if (!matchSearch) return false;

      const studentNotes = notes.filter(n => n.nis === s.nis);
      const activeCount = studentNotes.filter(n => n.tipe === 'aktif').length;
      const problemCount = studentNotes.filter(n => n.tipe === 'bermasalah').length;

      if (characterFilter === 'aktif') {
        return activeCount > 0;
      }
      if (characterFilter === 'bermasalah') {
        return problemCount > 0;
      }
      return true;
    });
  }, [students, notes, characterSearch, characterFilter]);

  // Formatting Helper for percentage
  const formatPct = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '0.0%';
    return (Number(val) * 100).toFixed(1) + '%';
  };

  const getPctColorClass = (pct: number | null | undefined) => {
    const num = pct !== null && pct !== undefined && !isNaN(Number(pct)) ? Number(pct) : 0;
    if (num >= 0.95) return 'text-indigo-600 bg-indigo-50 border border-indigo-100';
    if (num >= 0.85) return 'text-amber-600 bg-amber-50 border border-amber-100';
    return 'text-rose-600 bg-rose-50 border border-rose-100';
  };

  return (
    <div id="recap-section" className="space-y-6">
      {/* Overview Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase block tracking-wider truncate">Total Siswa</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900">{totalStudents}</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase block tracking-wider truncate">Rata Kehadiran</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900">{(Number(avgAttendance) || 0).toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 bg-rose-50 rounded-xl text-rose-600 shrink-0">
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase block tracking-wider truncate">Kasus Terlambat</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900">{totalLateCases} <span className="text-[11px] font-normal text-slate-400">kali</span></span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 bg-amber-50 rounded-xl text-amber-600 shrink-0">
            <Award className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase block tracking-wider truncate">Presensi Penuh</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900">
              {recap.filter(r => (r.hadir + r.sakit + r.izin + r.alfa) > 0 && r.persentaseKehadiran >= 0.99).length} <span className="text-[11px] font-normal text-slate-400">siswa</span>
            </span>
          </div>
        </div>
      </div>

      {/* Feature Sub-Navigation Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            id="recap-subtab-progression"
            onClick={() => {
              setActiveSubTab('progression');
              setChartViewMode('progression_bar');
            }}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'progression'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-emerald-500" />
            <span>Perkembangan F1 – Sumatif</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeSubTab === 'progression' ? 'bg-white text-indigo-700' : 'bg-emerald-100 text-emerald-800'
            }`}>
              Baru
            </span>
          </button>

          <button
            type="button"
            id="recap-subtab-charts"
            onClick={() => setActiveSubTab('charts')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'charts'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Grafik & Tren</span>
          </button>

          <button
            type="button"
            id="recap-subtab-monitoring"
            onClick={() => setActiveSubTab('monitoring')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'monitoring'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Pemantauan Murid</span>
            {needsAttention.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeSubTab === 'monitoring' ? 'bg-white text-indigo-700' : 'bg-rose-500 text-white'
              }`}>
                {needsAttention.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="recap-subtab-monthly"
            onClick={() => setActiveSubTab('monthly')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'monthly'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Rekapitulasi Bulanan</span>
          </button>

          <button
            type="button"
            id="recap-subtab-character"
            onClick={() => setActiveSubTab('character')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'character'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Jurnal Karakter</span>
            {notes.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeSubTab === 'character' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {notes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="recap-subtab-all"
            onClick={() => setActiveSubTab('all')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Semua Tampilan</span>
          </button>
        </div>
      </div>

      {/* 1. FITUR GRAFIK & TREN (TERMASUK PERKEMBANGAN FORMATIF S.D SUMATIF) */}
      {(activeSubTab === 'progression' || activeSubTab === 'charts' || activeSubTab === 'all') && (
        <div id="feature-charts-section" className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <BarChart2 className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  {activeSubTab === 'progression' ? 'Perkembangan Nilai: Formatif 1 s.d Sumatif Terakhir' : 'Grafik & Tren Performa Akademik'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Visualisasi komprehensif perkembangan rata-rata nilai siswa dari Formatif 1 hingga ujian Sumatif akhir
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                id="chart-mode-progression"
                onClick={() => setChartViewMode('progression_bar')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  chartViewMode === 'progression_bar'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Perkembangan F1–Sumatif</span>
              </button>
              <button
                type="button"
                id="chart-mode-comparison"
                onClick={() => setChartViewMode('comparison')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  chartViewMode === 'comparison'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Perbandingan</span>
              </button>
              <button
                type="button"
                id="chart-mode-class-trend"
                onClick={() => setChartViewMode('class_trend')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  chartViewMode === 'class_trend'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                <span>Tren Kelas (Garis)</span>
              </button>
              <button
                type="button"
                id="chart-mode-individual"
                onClick={() => setChartViewMode('individual')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  chartViewMode === 'individual'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Individual</span>
              </button>
              <button
                type="button"
                id="chart-mode-distribution"
                onClick={() => setChartViewMode('distribution')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  chartViewMode === 'distribution'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Distribusi</span>
              </button>
            </div>
          </div>

          {/* Contextual Filters for PROGRESSION BAR MODE */}
          {chartViewMode === 'progression_bar' && (
            <div className="space-y-4">
              {/* Insight KPI Cards */}
              {progressionInsights && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* KPI 1: Growth Delta */}
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 p-3.5 rounded-xl border border-indigo-100/60 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pertumbuhan Nilai</span>
                      <span className={`p-1 rounded-md ${progressionInsights.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {progressionInsights.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className={`text-xl font-extrabold ${progressionInsights.isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isNaN(progressionInsights.delta) ? '0' : progressionInsights.delta > 0 ? `+${progressionInsights.delta}` : progressionInsights.delta}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">poin (F1 → Akhir)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      F1 ({isNaN(progressionInsights.firstScore) ? 0 : progressionInsights.firstScore}) → Sn ({isNaN(progressionInsights.lastScore) ? 0 : progressionInsights.lastScore})
                    </span>
                  </div>

                  {/* KPI 2: Highest Assessment */}
                  <div className="bg-gradient-to-br from-slate-50 to-amber-50/30 p-3.5 rounded-xl border border-amber-100/60 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Capaian Puncak</span>
                      <span className="p-1 rounded-md bg-amber-100 text-amber-700">
                        <Award className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-amber-900">
                        {progressionInsights.highestStage && !isNaN(progressionInsights.highestStage['Rata-Rata Kelas']) ? progressionInsights.highestStage['Rata-Rata Kelas'] : 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">rata-rata tertinggi</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      {progressionInsights.highestStage?.stageName || '-'}
                    </span>
                  </div>

                  {/* KPI 3: Formative Average */}
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 p-3.5 rounded-xl border border-indigo-100/60 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-Rata Formatif</span>
                      <span className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                        <BookOpen className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-indigo-900">
                        {progressionInsights.formatifOverallAvg}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">dari 100</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      {activeFormativeCols.length} Asesmen Tugas
                    </span>
                  </div>

                  {/* KPI 4: Summative Average */}
                  <div className="bg-gradient-to-br from-slate-50 to-sky-50/30 p-3.5 rounded-xl border border-sky-100/60 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-Rata Sumatif</span>
                      <span className="p-1 rounded-md bg-sky-100 text-sky-700">
                        <Target className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-sky-900">
                        {progressionInsights.sumatifOverallAvg}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">dari 100</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      {activeSummativeCols.length} Ujian & UAS
                    </span>
                  </div>
                </div>
              )}

              {/* Filter Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                {/* Scope selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-600 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    Lingkup Asesmen:
                  </span>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setProgressionFilterScope('all')}
                      className={`px-2.5 py-1 rounded-md font-bold transition text-xs cursor-pointer ${
                        progressionFilterScope === 'all'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua ({progressionBarData.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgressionFilterScope('formatif')}
                      className={`px-2.5 py-1 rounded-md font-bold transition text-xs cursor-pointer ${
                        progressionFilterScope === 'formatif'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Formatif ({activeFormativeCols.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgressionFilterScope('sumatif')}
                      className={`px-2.5 py-1 rounded-md font-bold transition text-xs cursor-pointer ${
                        progressionFilterScope === 'sumatif'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sumatif ({activeSummativeCols.length})
                    </button>
                  </div>
                </div>

                {/* Compare with student toggle */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showProgressionStudentCompare}
                      onChange={e => {
                        setShowProgressionStudentCompare(e.target.checked);
                        if (e.target.checked && !selectedProgressionStudent && students.length > 0) {
                          setSelectedProgressionStudent(students[0].nis);
                        }
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Bandingkan dengan Siswa:</span>
                  </label>

                  {showProgressionStudentCompare && (
                    <select
                      value={selectedProgressionStudent || (students[0]?.nis ?? '')}
                      onChange={e => setSelectedProgressionStudent(e.target.value)}
                      className="bg-white border border-indigo-200 text-slate-800 font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs shadow-2xs max-w-[200px] truncate"
                    >
                      {students.map(s => (
                        <option key={s.nis} value={s.nis}>
                          {s.noAbsen ? `No. ${s.noAbsen} - ` : ''}{s.nama}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contextual Filters for COMPARISON MODE */}
          {chartViewMode === 'comparison' && (
            <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex-wrap gap-2">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                Tampilkan Siswa:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterStudentOption('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition text-xs cursor-pointer ${
                    filterStudentOption === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Semua ({allAcademicData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStudentOption('top3')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition text-xs cursor-pointer ${
                    filterStudentOption === 'top3'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Top 3
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStudentOption('top5')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition text-xs cursor-pointer ${
                    filterStudentOption === 'top5'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Top 5
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStudentOption('top10')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition text-xs cursor-pointer ${
                    filterStudentOption === 'top10'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Top 10
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStudentOption('needs_improvement')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition text-xs cursor-pointer ${
                    filterStudentOption === 'needs_improvement'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Perlu Bimbingan (&lt;75)
                </button>
              </div>
            </div>
          )}

          {chartViewMode === 'individual' && (
            <div className="flex items-center justify-between text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 flex-wrap gap-2">
              <span className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                Pilih Siswa untuk Melihat Tren Individual:
              </span>
              <select
                value={defaultStudentNis}
                onChange={e => setSelectedStudentForTrend(e.target.value)}
                className="bg-white border border-indigo-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs shadow-2xs"
              >
                {students.map(s => (
                  <option key={s.nis} value={s.nis}>
                    {s.noAbsen ? `No. ${s.noAbsen} - ` : ''}{s.nama} ({s.nis})
                  </option>
                ))}
              </select>
            </div>
          )}

          {chartViewMode === 'class_trend' && (
            <div className="bg-sky-50/50 p-2.5 rounded-xl border border-sky-100 text-xs text-sky-900 font-medium flex items-center justify-between">
              <span>📈 Tren garis progres rata-rata seluruh kelas dari setiap kolom tugas formatif hingga ujian sumatif.</span>
              <span className="font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-[10px] border border-sky-200">
                {activeFormativeCols.length} Formatif + {activeSummativeCols.length} Sumatif
              </span>
            </div>
          )}

          {/* Render Active Chart View */}
          {totalStudents === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">Belum ada data nilai</div>
          ) : (
            <div className="w-full pt-2">
              {/* RECHARTS CHART CONTAINER */}
              <div className="h-80 sm:h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartViewMode === 'progression_bar' ? (
                    <BarChart
                      data={filteredProgressionBarData}
                      margin={{ top: 25, right: 15, left: -15, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="stageName" 
                        tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                        interval={0}
                        tickFormatter={(value, idx) => {
                          const item = filteredProgressionBarData[idx];
                          return item?.shortLabel || value;
                        }}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          padding: '12px 16px',
                          backgroundColor: '#ffffff'
                        }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="space-y-1.5 text-xs">
                                <div className="border-b border-slate-100 pb-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase mr-1.5 ${
                                    data.category === 'Formatif' ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800'
                                  }`}>
                                    {data.category}
                                  </span>
                                  <span className="font-extrabold text-slate-800">{data.stageName}</span>
                                </div>
                                <div className="space-y-1 pt-0.5">
                                  <div className="flex items-center justify-between gap-4 font-bold text-slate-700">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                                      Rata-Rata Kelas:
                                    </span>
                                    <span className="font-mono text-indigo-700 text-sm">{data['Rata-Rata Kelas']} / 100</span>
                                  </div>

                                  {showProgressionStudentCompare && data['Nilai Siswa'] !== null && (
                                    <div className="flex items-center justify-between gap-4 font-bold text-amber-700">
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                                        Nilai Siswa:
                                      </span>
                                      <span className="font-mono text-sm">{data['Nilai Siswa']} / 100</span>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px]">
                                    <span>Tertinggi / Terendah:</span>
                                    <span className="font-mono font-bold text-slate-700">{data.highest} / {data.lowest}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px]">
                                    <span>Tingkat Ketuntasan (≥75):</span>
                                    <span className="font-mono font-bold text-emerald-600">{data.tuntasPct}% ({data.tuntasCount}/{data.totalGraded})</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                        content={() => (
                          <div className="flex flex-wrap items-center justify-center gap-4 text-xs pt-2">
                            <div className="flex items-center gap-1.5 font-medium text-slate-600">
                              <span className="w-3 h-3 rounded-sm bg-[#6366f1] inline-block" />
                              <span>Formatif (Tugas & Kuis)</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-medium text-slate-600">
                              <span className="w-3 h-3 rounded-sm bg-[#0ea5e9] inline-block" />
                              <span>Sumatif (Ulangan & STS)</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-medium text-slate-600">
                              <span className="w-3 h-3 rounded-sm bg-[#8b5cf6] inline-block" />
                              <span>Ujian Akhir (UAS)</span>
                            </div>
                            {showProgressionStudentCompare && (
                              <div className="flex items-center gap-1.5 font-bold text-amber-700">
                                <span className="w-3 h-3 rounded-sm bg-[#f59e0b] inline-block" />
                                <span>Nilai Siswa Terpilih</span>
                              </div>
                            )}
                          </div>
                        )}
                      />
                      <ReferenceLine 
                        y={75} 
                        stroke="#f59e0b" 
                        strokeDasharray="4 4" 
                        label={{ value: 'KKTP (75)', fill: '#d97706', fontSize: 11, position: 'right' }} 
                      />
                      <Bar 
                        dataKey="Rata-Rata Kelas" 
                        name="Rata-Rata Kelas" 
                        radius={[6, 6, 0, 0]} 
                        barSize={filteredProgressionBarData.length > 8 ? 24 : 36}
                      >
                        {filteredProgressionBarData.map((entry, idx) => (
                          <Cell key={`bar-prog-${idx}`} fill={entry.color} />
                        ))}
                        <LabelList 
                          dataKey="Rata-Rata Kelas" 
                          position="top" 
                          fill="#334155" 
                          fontSize={11} 
                          fontWeight={700}
                          offset={6}
                          formatter={(v: any) => (typeof v === 'number' && v > 0 ? v : '')}
                        />
                      </Bar>

                      {showProgressionStudentCompare && (
                        <Bar 
                          dataKey="Nilai Siswa" 
                          name="Nilai Siswa" 
                          fill="#f59e0b" 
                          radius={[6, 6, 0, 0]} 
                          barSize={filteredProgressionBarData.length > 8 ? 20 : 30}
                        >
                          <LabelList 
                            dataKey="Nilai Siswa" 
                            position="top" 
                            fill="#b45309" 
                            fontSize={11} 
                            fontWeight={700}
                            offset={6}
                            formatter={(v: any) => (v !== null && typeof v === 'number' ? v : '')}
                          />
                        </Bar>
                      )}
                    </BarChart>
                  ) : chartViewMode === 'comparison' ? (
                    <BarChart data={filteredAcademicData} margin={{ top: 15, right: 10, left: -15, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} 
                        interval={0}
                        angle={0}
                        textAnchor="middle"
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', padding: '10px 14px' }}
                        labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length > 0 && payload[0].payload) {
                            const item = payload[0].payload;
                            return `${item.nama} (Absen: ${item.noAbsen})`;
                          }
                          return `Absen: ${label}`;
                        }}
                        formatter={(val: any, name: any) => [`${val} / 100`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'KKTP (75)', fill: '#d97706', fontSize: 10, position: 'right' }} />
                      <Bar dataKey="Nilai Formatif" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={filteredAcademicData.length > 10 ? 12 : 20} />
                      <Bar dataKey="Nilai Sumatif" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={filteredAcademicData.length > 10 ? 12 : 20} />
                    </BarChart>
                  ) : chartViewMode === 'class_trend' ? (
                    <LineChart data={classAssessmentTrendData} margin={{ top: 15, right: 15, left: -15, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="evalName" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                        formatter={(val: any) => [`${val} / 100`, 'Rata-Rata Kelas']}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'KKTP (75)', fill: '#d97706', fontSize: 10 }} />
                      <Line 
                        type="monotone" 
                        dataKey="Rata-Rata Class" 
                        name="Rata-Rata Kelas" 
                        stroke="#6366f1" 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  ) : chartViewMode === 'individual' ? (
                    <LineChart data={individualStudentTrendData} margin={{ top: 15, right: 15, left: -15, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="evalName" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                        formatter={(val: any, name: any) => [val !== null ? `${val} / 100` : 'Belum dinilai', name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'KKTP (75)', fill: '#d97706', fontSize: 10 }} />
                      <Line 
                        type="monotone" 
                        dataKey="Nilai Siswa" 
                        name={activeTrendStudent ? activeTrendStudent.nama : 'Nilai Siswa'} 
                        stroke="#0ea5e9" 
                        strokeWidth={3} 
                        dot={{ r: 6, fill: '#0ea5e9', strokeWidth: 2, stroke: '#ffffff' }}
                        connectNulls
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Rata-Rata Kelas" 
                        name="Rata-Rata Kelas" 
                        stroke="#cbd5e1" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: '#94a3b8' }}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={gradeDistributionData} margin={{ top: 15, right: 15, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                        formatter={(val: any) => [`${val} Siswa`, 'Jumlah Siswa']}
                      />
                      <Bar dataKey="count" name="Jumlah Siswa" radius={[6, 6, 0, 0]} barSize={40}>
                        {gradeDistributionData.map((entry, index) => (
                          <Cell key={`cell-dist-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* PROGRESSION DETAILED BREAKDOWN TABLE (When in progression_bar mode) */}
              {chartViewMode === 'progression_bar' && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Tabel Rincian Perkembangan Setiap Tahap Asesmen
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Menampilkan {filteredProgressionBarData.length} kolom asesmen
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-12">Tahap</th>
                          <th className="py-2.5 px-3">Nama Asesmen</th>
                          <th className="py-2.5 px-3">Kategori</th>
                          <th className="py-2.5 px-3 text-center">Rata-Rata</th>
                          <th className="py-2.5 px-3 text-center">Tertinggi</th>
                          <th className="py-2.5 px-3 text-center">Terendah</th>
                          <th className="py-2.5 px-3 text-center">Ketuntasan (≥75)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProgressionBarData.map((item, idx) => {
                          const isKKTP = item['Rata-Rata Kelas'] >= 75;
                          return (
                            <tr key={item.stageId} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  <span>{item.stageName}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                  item.category === 'Formatif'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                    : 'bg-sky-50 text-sky-700 border border-sky-100'
                                }`}>
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-extrabold text-sm">
                                <span className={isKKTP ? 'text-indigo-700' : 'text-rose-600'}>
                                  {item['Rata-Rata Kelas']}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-semibold text-emerald-600">
                                {item.highest}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-semibold text-rose-500">
                                {item.lowest}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${item.tuntasPct >= 80 ? 'bg-emerald-500' : item.tuntasPct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                      style={{ width: `${Math.min(item.tuntasPct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-[11px] text-slate-700">
                                    {item.tuntasPct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {item['Rata-Rata Kelas'] >= 85 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                    Sangat Baik
                                  </span>
                                ) : item['Rata-Rata Kelas'] >= 75 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                                    Tuntas
                                  </span>
                                ) : item['Rata-Rata Kelas'] > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                                    Perlu Perbaikan
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. FITUR PEMANTAUAN MURID */}
      {(activeSubTab === 'monitoring' || activeSubTab === 'all') && (
        <div id="feature-monitoring-section" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Disciplined Students */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h4 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  🏆 Murid Paling Disiplin
                </h4>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  Kehadiran Tertinggi
                </span>
              </div>
              {topDisciplined.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Belum ada data presensi siswa.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {topDisciplined.map((item) => {
                    const s = students.find(std => std.nis === item.nis);
                    return (
                      <div key={item.nis} className="py-2.5 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            {s?.noAbsen && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 font-mono font-extrabold text-[9px] shrink-0">
                                No. {s.noAbsen}
                              </span>
                            )}
                            <span className="font-bold text-slate-800 text-sm truncate block">{item.nama}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">NIS: {item.nis}</span>
                        </div>
                        <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                          {formatPct(item.persentaseKehadiran)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Needs attention (absent/late cases) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h4 className="text-xs font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  🚨 Perlu Pemantauan Khusus
                </h4>
                <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                  Sering Absen / Terlambat
                </span>
              </div>
              {needsAttention.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 text-center my-2">
                  <p className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Semua murid tertib dan disiplin!
                  </p>
                  <p className="text-[11px] text-emerald-600/80 mt-0.5">
                    Tidak ditemukan siswa dengan kendala presensi kritis saat ini.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {needsAttention.map((item) => {
                    const s = students.find(std => std.nis === item.nis);
                    return (
                      <div key={item.nis} className="py-2.5 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            {s?.noAbsen && (
                              <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-100 rounded text-rose-700 font-mono font-extrabold text-[9px] shrink-0">
                                No. {s.noAbsen}
                              </span>
                            )}
                            <span className="font-bold text-slate-800 text-sm truncate block">{item.nama}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">NIS: {item.nis}</span>
                        </div>
                        <div className="text-right flex items-center gap-2 shrink-0">
                          {item.terlambatCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100">
                              {item.terlambatCount}x Terlambat
                            </span>
                          )}
                          <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                            {formatPct(item.persentaseKehadiran)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. FITUR REKAPITULASI BULANAN SISWA */}
      {(activeSubTab === 'monthly' || activeSubTab === 'all') && (
        <div id="feature-monthly-section" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-indigo-600" />
                Rekapitulasi Bulanan Siswa
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Akumulasi data kehadiran dihitung otomatis dari seluruh riwayat absensi
              </p>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari siswa / NIS..."
                  value={monthlySearch}
                  onChange={(e) => setMonthlySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40 sm:w-48 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMonthlyFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    monthlyFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyFilter('perfect')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    monthlyFilter === 'perfect' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyFilter('late')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    monthlyFilter === 'late' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Ada Terlambat
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyFilter('low')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    monthlyFilter === 'low' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  &lt; 85%
                </button>
              </div>
            </div>
          </div>

          {filteredMonthlyRecap.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              {students.length === 0 ? 'Belum ada data siswa.' : 'Tidak ada data siswa yang cocok dengan filter pencarian.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-xs tracking-wider uppercase border-b border-slate-200">
                    <th className="py-3 px-5">Siswa</th>
                    <th className="py-3 px-5 text-center w-24">Hadir</th>
                    <th className="py-3 px-5 text-center w-24">Sakit</th>
                    <th className="py-3 px-5 text-center w-24">Izin</th>
                    <th className="py-3 px-5 text-center w-24">Alfa</th>
                    <th className="py-3 px-5 text-center w-28">Terlambat</th>
                    <th className="py-3 px-5 text-center w-36 bg-slate-50/80">Persentase Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMonthlyRecap.map(row => {
                    const s = students.find(std => std.nis === row.nis);
                    return (
                      <tr key={row.nis} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            {s?.noAbsen && (
                              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-mono font-extrabold text-xs shrink-0">
                                No. {s.noAbsen}
                              </span>
                            )}
                            <div>
                              <span className="font-bold text-slate-800 block text-sm">{row.nama}</span>
                              <span className="font-mono text-xs text-slate-500">NIS: {row.nis}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-indigo-600 font-mono text-sm">{row.hadir}</td>
                        <td className="py-3.5 px-5 text-center font-bold text-sky-600 font-mono text-sm">{row.sakit}</td>
                        <td className="py-3.5 px-5 text-center font-bold text-amber-500 font-mono text-sm">{row.izin}</td>
                        <td className="py-3.5 px-5 text-center font-bold text-rose-600 font-mono text-sm">{row.alfa}</td>
                        <td className="py-3.5 px-5 text-center font-bold text-rose-500 font-mono text-sm">
                          <span className={row.terlambatCount > 0 ? 'text-rose-600 font-extrabold px-2 py-0.5 bg-rose-50 rounded border border-rose-100 text-xs' : 'text-slate-400'}>
                            {row.terlambatCount > 0 ? `${row.terlambatCount}x` : '0'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center bg-slate-50/50">
                          {(row.hadir + row.sakit + row.izin + row.alfa) === 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold text-slate-400 bg-slate-100 border border-slate-200">
                              0.0%
                            </span>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${getPctColorClass(row.persentaseKehadiran)}`}>
                              {formatPct(row.persentaseKehadiran)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. FITUR REKAPITULASI JURNAL KARAKTER */}
      {(activeSubTab === 'character' || activeSubTab === 'all') && (
        <div id="feature-character-section" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Rekap Jurnal Karakter & Keaktifan Siswa
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dokumentasi keaktifan dan catatan kendala perilaku harian untuk pertimbangan nilai sikap
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold rounded-xl flex items-center gap-1.5 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> {notes.filter(n => n.tipe === 'aktif').length} Keaktifan
              </span>
              <span className="px-3 py-1 bg-rose-50 border border-rose-100 text-rose-700 font-extrabold rounded-xl flex items-center gap-1.5 shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> {notes.filter(n => n.tipe === 'bermasalah').length} Kendala
              </span>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Belum ada data roster siswa.
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Search & Filter Header for Character Notes */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari siswa untuk melihat jurnal..."
                    value={characterSearch}
                    onChange={(e) => setCharacterSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setCharacterFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                      characterFilter === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({students.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCharacterFilter('aktif')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                      characterFilter === 'aktif' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ada Keaktifan
                  </button>
                  <button
                    type="button"
                    onClick={() => setCharacterFilter('bermasalah')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                      characterFilter === 'bermasalah' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ada Kendala
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* List of students and their notes summary */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/20 lg:col-span-5 shadow-inner">
                  <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Daftar Siswa ({filteredStudentsForCharacter.length})</span>
                    <span className="text-slate-400 font-normal">Klik untuk lihat riwayat</span>
                  </div>
                  <div className="divide-y divide-slate-150 max-h-[380px] overflow-y-auto">
                    {filteredStudentsForCharacter.map(s => {
                      const studentNotes = notes.filter(n => n.nis === s.nis);
                      const activeCount = studentNotes.filter(n => n.tipe === 'aktif').length;
                      const problemCount = studentNotes.filter(n => n.tipe === 'bermasalah').length;
                      const isSelected = selectedStudentNisForNotes === s.nis;

                      return (
                        <button
                          key={s.nis}
                          type="button"
                          onClick={() => setSelectedStudentNisForNotes(isSelected ? null : s.nis)}
                          className={`w-full text-left px-4 py-3.5 flex items-center justify-between transition cursor-pointer text-xs ${
                            isSelected ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600 font-bold' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="space-y-1 pr-3 truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              {s.noAbsen && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 font-mono font-extrabold text-[9px] shrink-0">
                                  No. {s.noAbsen}
                                </span>
                              )}
                              <span className="font-extrabold text-slate-800 block truncate">{s.nama}</span>
                            </div>
                            <span className="font-mono text-[9px] text-slate-400 block">NIS: {s.nis}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {activeCount > 0 && (
                              <span className="px-2 py-0.5 bg-emerald-100/80 text-emerald-800 font-bold rounded text-[9px] flex items-center gap-0.5">
                                ⭐ {activeCount}x
                              </span>
                            )}
                            {problemCount > 0 && (
                              <span className="px-2 py-0.5 bg-rose-100/80 text-rose-800 font-bold rounded text-[9px] flex items-center gap-0.5">
                                ⚠️ {problemCount}x
                              </span>
                            )}
                            {activeCount === 0 && problemCount === 0 && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-400 font-semibold rounded text-[9px]">
                                -
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Detail view of the selected student's notes */}
                <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col justify-between min-h-[380px] lg:col-span-7 shadow-xs">
                  {selectedStudentNisForNotes ? (() => {
                    const s = students.find(std => std.nis === selectedStudentNisForNotes);
                    const studentNotes = notes.filter(n => n.nis === selectedStudentNisForNotes);

                    return (
                      <div className="space-y-4 flex-grow flex flex-col">
                        <div className="border-b border-slate-100 pb-3 flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider block">Pertimbangan Nilai Sikap</span>
                            <h4 className="font-black text-slate-800 text-sm mt-0.5">{s?.nama}</h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">NIS: {s?.nis}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-extrabold rounded-lg">
                              {studentNotes.filter(n => n.tipe === 'aktif').length}x Aktif
                            </span>
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-extrabold rounded-lg">
                              {studentNotes.filter(n => n.tipe === 'bermasalah').length}x Kendala
                            </span>
                          </div>
                        </div>

                        {studentNotes.length === 0 ? (
                          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-slate-400">
                            <ClipboardCheck className="w-10 h-10 text-slate-200 mb-3" />
                            <p className="font-extrabold text-xs text-slate-700">Belum Ada Catatan Jurnal</p>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                              Tidak ditemukan riwayat catatan untuk siswa ini. Seluruh rekam jejak perilaku selama jam pelajaran di kelas akan muncul di sini.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 flex-grow overflow-y-auto max-h-[300px] pr-1">
                            {studentNotes.map(n => (
                              <div 
                                key={n.id} 
                                className={`p-3.5 rounded-xl border text-[11px] space-y-2 ${
                                  n.tipe === 'aktif'
                                    ? 'bg-emerald-50/20 border-emerald-100'
                                    : 'bg-rose-50/20 border-rose-100'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className={n.tipe === 'aktif' ? 'text-emerald-700 flex items-center gap-1' : 'text-rose-700 flex items-center gap-1'}>
                                    {n.tipe === 'aktif' ? (
                                      <>
                                        <Sparkles className="w-3 h-3 text-emerald-500" /> Jurnal Aktif
                                      </>
                                    ) : (
                                      <>
                                        <AlertTriangle className="w-3 h-3 text-rose-500" /> Jurnal Kendala Perilaku
                                      </>
                                    )}
                                  </span>
                                  <span className="text-slate-400 font-mono text-[9px]">{n.tanggal}</span>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-semibold italic text-xs">
                                  "{n.catatan}"
                                </p>
                                <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1 border-t border-slate-100/50 pt-1.5 mt-1.5">
                                  <Clock className="w-3 h-3 text-slate-300" /> Jam Pembelajaran: {stripClockFromJamString(n.jamPembelajaran)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-slate-400 my-auto">
                      <ClipboardCheck className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="font-extrabold text-xs text-slate-700">Pilih Siswa Terlebih Dahulu</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed font-medium">
                        Pilih nama siswa pada panel sebelah kiri untuk menampilkan riwayat keaktifan dan kendala perilaku yang terdokumentasi harian.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
