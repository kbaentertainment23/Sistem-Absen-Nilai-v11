import React, { useState, useEffect, useMemo } from 'react';
import { 
  Student, 
  GradeFormative, 
  GradeSummative, 
  GradeAttitude, 
  GradeColumn, 
  GradeWeightConfig,
  StudentNote,
  AttendanceRecord,
  MonthlyRecap
} from '../types';
import { 
  getEffectiveColumnScore, 
  calculateStudentGradeBreakdown, 
  DEFAULT_GRADE_WEIGHTS, 
  KKTP_STANDARD,
  calculateAttitudeScore
} from '../utils/gradeCalculator';
import { getStudentPhotoUrl, handleStudentPhotoError } from '../lib/photoOptimizer';
import { getFormativeGradesFromFirestore, getSummativeGradesFromFirestore, getAttitudeGradesFromFirestore } from '../lib/firestoreService';
import { 
  X, 
  User, 
  Award, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  BarChart2, 
  GraduationCap, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  Info,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  LineChart, 
  Line 
} from 'recharts';

export interface StudentGradeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  currentSemester: 1 | 2;
  currentFormative: GradeFormative[];
  currentSummative: GradeSummative[];
  currentAttitude?: GradeAttitude[];
  formativeColsSem1: GradeColumn[];
  formativeColsSem2: GradeColumn[];
  summativeColsSem1: GradeColumn[];
  summativeColsSem2: GradeColumn[];
  gradeWeights?: GradeWeightConfig;
  studentNotes?: StudentNote[];
  attendance?: AttendanceRecord[];
  recap?: MonthlyRecap[];
}

export interface SemesterDataBundle {
  semester: 1 | 2;
  label: string;
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  attitudeGrades: GradeAttitude[];
  formativeCols: GradeColumn[];
  summativeCols: GradeColumn[];
}

export const StudentGradeHistoryModal: React.FC<StudentGradeHistoryModalProps> = ({
  isOpen,
  onClose,
  student,
  currentSemester,
  currentFormative,
  currentSummative,
  currentAttitude = [],
  formativeColsSem1,
  formativeColsSem2,
  summativeColsSem1,
  summativeColsSem2,
  gradeWeights = DEFAULT_GRADE_WEIGHTS,
  studentNotes = [],
  attendance = [],
  recap = []
}) => {
  const [activeTab, setActiveTab] = useState<'comparison' | 'sem1' | 'sem2' | 'chart'>('comparison');
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Historical data state for both semesters
  const [sem1Data, setSem1Data] = useState<{
    formative: GradeFormative[];
    summative: GradeSummative[];
    attitude: GradeAttitude[];
    formativeCols: GradeColumn[];
    summativeCols: GradeColumn[];
  }>({
    formative: [],
    summative: [],
    attitude: [],
    formativeCols: formativeColsSem1,
    summativeCols: summativeColsSem1
  });

  const [sem2Data, setSem2Data] = useState<{
    formative: GradeFormative[];
    summative: GradeSummative[];
    attitude: GradeAttitude[];
    formativeCols: GradeColumn[];
    summativeCols: GradeColumn[];
  }>({
    formative: [],
    summative: [],
    attitude: [],
    formativeCols: formativeColsSem2,
    summativeCols: summativeColsSem2
  });

  // Fetch full data for both Sem 1 and Sem 2 when modal opens
  useEffect(() => {
    if (!isOpen || !student) return;

    // Freeze background layer scroll while modal popup is open
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    let isMounted = true;
    const fetchSemesterHistory = async () => {
      setLoadingHistory(true);
      try {
        // Fetch Semester 1
        const [sem1FRes, sem1SRes, sem1ARes] = await Promise.all([
          getFormativeGradesFromFirestore(1),
          getSummativeGradesFromFirestore(1),
          getAttitudeGradesFromFirestore(1)
        ]);

        // Fetch Semester 2
        const [sem2FRes, sem2SRes, sem2ARes] = await Promise.all([
          getFormativeGradesFromFirestore(2),
          getSummativeGradesFromFirestore(2),
          getAttitudeGradesFromFirestore(2)
        ]);

        if (!isMounted) return;

        // If current semester is active in UI, override with current in-memory edits for high accuracy
        let f1 = sem1FRes.grades || [];
        let s1 = sem1SRes.grades || [];
        let a1 = sem1ARes || [];
        let colsF1 = (sem1FRes.colsSem1 && sem1FRes.colsSem1.length > 0) ? sem1FRes.colsSem1 : formativeColsSem1;
        let colsS1 = (sem1SRes.colsSem1 && sem1SRes.colsSem1.length > 0) ? sem1SRes.colsSem1 : summativeColsSem1;

        let f2 = sem2FRes.grades || [];
        let s2 = sem2SRes.grades || [];
        let a2 = sem2ARes || [];
        let colsF2 = (sem2FRes.colsSem2 && sem2FRes.colsSem2.length > 0) ? sem2FRes.colsSem2 : formativeColsSem2;
        let colsS2 = (sem2SRes.colsSem2 && sem2SRes.colsSem2.length > 0) ? sem2SRes.colsSem2 : summativeColsSem2;

        if (currentSemester === 1) {
          f1 = currentFormative;
          s1 = currentSummative;
          a1 = currentAttitude;
        } else if (currentSemester === 2) {
          f2 = currentFormative;
          s2 = currentSummative;
          a2 = currentAttitude;
        }

        setSem1Data({
          formative: f1,
          summative: s1,
          attitude: a1,
          formativeCols: colsF1,
          summativeCols: colsS1
        });

        setSem2Data({
          formative: f2,
          summative: s2,
          attitude: a2,
          formativeCols: colsF2,
          summativeCols: colsS2
        });
      } catch (err) {
        console.error('Error fetching semester grade history:', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };

    fetchSemesterHistory();

    return () => {
      isMounted = false;
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen, student, currentSemester, currentFormative, currentSummative, currentAttitude, formativeColsSem1, formativeColsSem2, summativeColsSem1, summativeColsSem2]);

  // Compute breakdowns for both semesters for this specific student
  const studentFormativeSem1 = useMemo(() => {
    return sem1Data.formative.find(f => f.nis === student?.nis);
  }, [sem1Data.formative, student]);

  const studentSummativeSem1 = useMemo(() => {
    return sem1Data.summative.find(s => s.nis === student?.nis);
  }, [sem1Data.summative, student]);

  const studentFormativeSem2 = useMemo(() => {
    return sem2Data.formative.find(f => f.nis === student?.nis);
  }, [sem2Data.formative, student]);

  const studentSummativeSem2 = useMemo(() => {
    return sem2Data.summative.find(s => s.nis === student?.nis);
  }, [sem2Data.summative, student]);

  const sem1Breakdown = useMemo(() => {
    if (!student) return null;
    return calculateStudentGradeBreakdown(
      student,
      studentFormativeSem1,
      studentSummativeSem1,
      sem1Data.formativeCols,
      sem1Data.summativeCols,
      gradeWeights,
      sem1Data.attitude,
      studentNotes,
      recap,
      attendance
    );
  }, [student, studentFormativeSem1, studentSummativeSem1, sem1Data.formativeCols, sem1Data.summativeCols, gradeWeights, sem1Data.attitude, studentNotes, recap, attendance]);

  const sem2Breakdown = useMemo(() => {
    if (!student) return null;
    return calculateStudentGradeBreakdown(
      student,
      studentFormativeSem2,
      studentSummativeSem2,
      sem2Data.formativeCols,
      sem2Data.summativeCols,
      gradeWeights,
      sem2Data.attitude,
      studentNotes,
      recap,
      attendance
    );
  }, [student, studentFormativeSem2, studentSummativeSem2, sem2Data.formativeCols, sem2Data.summativeCols, gradeWeights, sem2Data.attitude, studentNotes, recap, attendance]);

  // Calculate delta / growth from Sem 1 to Sem 2
  const scoreDelta = useMemo(() => {
    if (!sem1Breakdown || !sem2Breakdown) return null;
    const s1Final = sem1Breakdown.hasAnyScore ? sem1Breakdown.nilaiAkhir : null;
    const s2Final = sem2Breakdown.hasAnyScore ? sem2Breakdown.nilaiAkhir : null;

    if (s1Final === null || s2Final === null) return null;
    const diff = Number((s2Final - s1Final).toFixed(1));
    return {
      diff,
      improved: diff >= 0,
      text: diff > 0 ? `+${diff}` : `${diff}`
    };
  }, [sem1Breakdown, sem2Breakdown]);

  // Chart data preparation for comparison bar chart & line chart
  const comparisonChartData = useMemo(() => {
    if (!sem1Breakdown || !sem2Breakdown) return [];

    return [
      {
        kategori: 'Rata-rata Formatif',
        'Semester 1': sem1Breakdown.formatifAvg > 0 ? Number(sem1Breakdown.formatifAvg.toFixed(1)) : 0,
        'Semester 2': sem2Breakdown.formatifAvg > 0 ? Number(sem2Breakdown.formatifAvg.toFixed(1)) : 0,
      },
      {
        kategori: 'Rata-rata Sumatif',
        'Semester 1': sem1Breakdown.sumatifAvg > 0 ? Number(sem1Breakdown.sumatifAvg.toFixed(1)) : 0,
        'Semester 2': sem2Breakdown.sumatifAvg > 0 ? Number(sem2Breakdown.sumatifAvg.toFixed(1)) : 0,
      },
      {
        kategori: 'Ujian Akhir (UAS)',
        'Semester 1': sem1Breakdown.uasScore > 0 ? Number(sem1Breakdown.uasScore.toFixed(1)) : 0,
        'Semester 2': sem2Breakdown.uasScore > 0 ? Number(sem2Breakdown.uasScore.toFixed(1)) : 0,
      },
      {
        kategori: 'Sikap / Karakter',
        'Semester 1': sem1Breakdown.sikapScore > 0 ? Number(sem1Breakdown.sikapScore.toFixed(1)) : 0,
        'Semester 2': sem2Breakdown.sikapScore > 0 ? Number(sem2Breakdown.sikapScore.toFixed(1)) : 0,
      },
      {
        kategori: 'NILAI AKHIR',
        'Semester 1': sem1Breakdown.hasAnyScore ? Number(sem1Breakdown.nilaiAkhir.toFixed(1)) : 0,
        'Semester 2': sem2Breakdown.hasAnyScore ? Number(sem2Breakdown.nilaiAkhir.toFixed(1)) : 0,
      }
    ];
  }, [sem1Breakdown, sem2Breakdown]);

  // Progression Line chart data
  const progressionTrendData = useMemo(() => {
    if (!sem1Breakdown || !sem2Breakdown) return [];

    return [
      {
        period: 'Semester 1 (Ganjil)',
        nilaiAkhir: sem1Breakdown.hasAnyScore ? Number(sem1Breakdown.nilaiAkhir.toFixed(1)) : null,
        formatif: sem1Breakdown.formatifAvg > 0 ? Number(sem1Breakdown.formatifAvg.toFixed(1)) : null,
        sumatif: sem1Breakdown.sumatifAvg > 0 ? Number(sem1Breakdown.sumatifAvg.toFixed(1)) : null,
        kktp: KKTP_STANDARD
      },
      {
        period: 'Semester 2 (Genap)',
        nilaiAkhir: sem2Breakdown.hasAnyScore ? Number(sem2Breakdown.nilaiAkhir.toFixed(1)) : null,
        formatif: sem2Breakdown.formatifAvg > 0 ? Number(sem2Breakdown.formatifAvg.toFixed(1)) : null,
        sumatif: sem2Breakdown.sumatifAvg > 0 ? Number(sem2Breakdown.sumatifAvg.toFixed(1)) : null,
        kktp: KKTP_STANDARD
      }
    ];
  }, [sem1Breakdown, sem2Breakdown]);

  if (!isOpen || !student) return null;

  const photoUrl = student.foto || localStorage.getItem(`student_photo_${student.nis}`);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-student-history-title"
      >
        {/* Header Profil Siswa */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-4">
              {photoUrl ? (
                <img
                  src={getStudentPhotoUrl(photoUrl)}
                  alt={student.nama}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleStudentPhotoError(e, photoUrl)}
                  className="w-16 h-16 sm:w-18 sm:h-18 object-cover rounded-2xl border-2 border-indigo-400/40 shadow-md shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-18 sm:h-18 bg-indigo-950/80 rounded-2xl border-2 border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-md shrink-0">
                  <User className="w-8 h-8 sm:w-9 sm:h-9" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 id="modal-student-history-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {student.nama}
                  </h3>
                  {student.label && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                      {student.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300 flex-wrap">
                  <span className="font-mono bg-white/10 px-2 py-0.5 rounded-md text-white font-semibold">
                    NIS: {student.nis}
                  </span>
                  {student.noAbsen && (
                    <span className="bg-white/10 px-2 py-0.5 rounded-md text-slate-200">
                      Absen #{student.noAbsen}
                    </span>
                  )}
                  {student.kelas && (
                    <span className="bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded-md font-bold">
                      {student.kelas}
                    </span>
                  )}
                  {student.jenisKelamin && (
                    <span className="text-slate-400">
                      • {student.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick KPI Badge: Perkembangan Semester */}
            {scoreDelta && (
              <div className={`p-3 rounded-2xl border shrink-0 text-right ${
                scoreDelta.improved 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center gap-1.5 justify-end text-xs font-bold uppercase tracking-wider mb-0.5">
                  {scoreDelta.improved ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Tren Meningkat</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                      <span>Tren Menurun</span>
                    </>
                  )}
                </div>
                <div className="text-xl font-black font-mono">
                  {scoreDelta.text} Poin
                </div>
                <div className="text-[10px] text-slate-400">
                  Antara Semester 1 &amp; 2
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/10 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'comparison'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Perbandingan Semester 1 &amp; 2</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'chart'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
              }`}
            >
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              <span>Grafik Visual Perkembangan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sem1')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'sem1'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
              }`}
            >
              <span>Rincian Semester 1 (Ganjil)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sem2')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'sem2'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
              }`}
            >
              <span>Rincian Semester 2 (Genap)</span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
          {loadingHistory && (
            <div className="flex items-center justify-center p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700 font-bold gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Memuat seluruh arsip riwayat nilai siswa dari database Firebase...</span>
            </div>
          )}

          {/* TAB 1: PERBANDINGAN SEMESTER 1 & 2 */}
          {activeTab === 'comparison' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Highlight KPI Cards: Semester 1 vs Semester 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card Semester 1 */}
                <div className={`bg-white p-5 rounded-2xl border ${currentSemester === 1 ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'} shadow-xs relative`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs">
                        SEM 1
                      </span>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">Semester 1 (Ganjil)</h4>
                        <p className="text-[11px] text-slate-400">Tahun Ajaran Aktif</p>
                      </div>
                    </div>
                    {currentSemester === 1 && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-md uppercase">
                        Sedang Aktif
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Nilai Akhir</span>
                      <span className="text-2xl font-black text-slate-900">
                        {sem1Breakdown?.hasAnyScore ? sem1Breakdown.nilaiAkhir.toFixed(1) : '-'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Predikat &amp; Status</span>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-md font-black text-xs border ${
                          sem1Breakdown?.predikat === 'A'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : sem1Breakdown?.predikat === 'B'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : sem1Breakdown?.predikat === 'C'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {sem1Breakdown?.predikat || '-'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          sem1Breakdown?.isTuntas
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {sem1Breakdown?.isTuntas ? 'Tuntas' : 'Remidi'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Component Breakdown Mini */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/60">
                      <span className="text-[9px] text-indigo-600 font-bold block">Formatif</span>
                      <span className="font-black text-slate-800">{sem1Breakdown?.formatifAvg ? sem1Breakdown.formatifAvg.toFixed(1) : '-'}</span>
                    </div>
                    <div className="p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/60">
                      <span className="text-[9px] text-emerald-600 font-bold block">Sumatif</span>
                      <span className="font-black text-slate-800">{sem1Breakdown?.sumatifAvg ? sem1Breakdown.sumatifAvg.toFixed(1) : '-'}</span>
                    </div>
                    <div className="p-2 bg-amber-50/50 rounded-lg border border-amber-100/60">
                      <span className="text-[9px] text-amber-600 font-bold block">UAS</span>
                      <span className="font-black text-slate-800">{sem1Breakdown?.uasScore ? sem1Breakdown.uasScore.toFixed(1) : '-'}</span>
                    </div>
                    <div className="p-2 bg-pink-50/50 rounded-lg border border-pink-100/60">
                      <span className="text-[9px] text-pink-600 font-bold block">Sikap</span>
                      <span className="font-black text-slate-800">{sem1Breakdown?.sikapScore ? sem1Breakdown.sikapScore.toFixed(1) : '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Semester 2 */}
                <div className={`bg-white p-5 rounded-2xl border ${currentSemester === 2 ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'} shadow-xs relative`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs">
                        SEM 2
                      </span>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">Semester 2 (Genap)</h4>
                        <p className="text-[11px] text-slate-400">Tahun Ajaran Aktif</p>
                      </div>
                    </div>
                    {currentSemester === 2 && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-md uppercase">
                        Sedang Aktif
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Nilai Akhir</span>
                      <span className="text-2xl font-black text-slate-900">
                        {sem2Breakdown?.hasAnyScore ? sem2Breakdown.nilaiAkhir.toFixed(1) : '-'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Predikat &amp; Status</span>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-md font-black text-xs border ${
                          sem2Breakdown?.predikat === 'A'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : sem2Breakdown?.predikat === 'B'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : sem2Breakdown?.predikat === 'C'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {sem2Breakdown?.predikat || '-'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          sem2Breakdown?.isTuntas
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {sem2Breakdown?.isTuntas ? 'Tuntas' : 'Remidi'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Component Breakdown Mini */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/60">
                      <span className="text-[9px] text-indigo-600 font-bold block">Formatif</span>
                      <span className="font-black text-slate-800">{sem2Breakdown?.formatifAvg ? sem2Breakdown.formatifAvg.toFixed(1) : '-'}</span>
                    </div>
                    <div className="p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/60">
                      <span className="text-[9px] text-emerald-600 font-bold block">Sumatif</span>
                      <span className="font-black text-slate-800">{sem2Breakdown?.sumatifAvg ? sem2Breakdown.sumatifAvg.toFixed(1) : '-'}</span>
                    </div>
                    <div className="p-2 bg-amber-50/50 rounded-lg border border-amber-100/60">
                      <span className="text-[9px] text-amber-600 font-bold block">UAS</span>
                      <span className="font-black text-slate-800">{sem2Breakdown?.uasScore ? sem2Breakdown.uasScore.toFixed(1) : '-'}</span>
                    </div>
                    <div className="p-2 bg-pink-50/50 rounded-lg border border-pink-100/60">
                      <span className="text-[9px] text-pink-600 font-bold block">Sikap</span>
                      <span className="font-black text-slate-800">{sem2Breakdown?.sikapScore ? sem2Breakdown.sikapScore.toFixed(1) : '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabel Perbandingan Lengkap Komponen Nilai */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-slate-800 text-sm">
                      Matriks Perbandingan Antar Semester
                    </h4>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Standar KKTP: <strong className="text-indigo-600">{KKTP_STANDARD}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-600 font-black border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Komponen Penilaian</th>
                        <th className="py-3 px-4 text-center">Bobot</th>
                        <th className="py-3 px-4 text-center bg-indigo-50/40">Semester 1</th>
                        <th className="py-3 px-4 text-center bg-emerald-50/40">Semester 2</th>
                        <th className="py-3 px-4 text-center">Selisih (Delta)</th>
                        <th className="py-3 px-4 text-center">Evaluasi Perkembangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {/* Formatif Row */}
                      <tr className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                          <span>Formatif (Rata-rata TP)</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-500 font-mono">
                          {gradeWeights.formatif}%
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-indigo-50/20">
                          {sem1Breakdown?.formatifAvg ? sem1Breakdown.formatifAvg.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-emerald-50/20">
                          {sem2Breakdown?.formatifAvg ? sem2Breakdown.formatifAvg.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {(() => {
                            if (!sem1Breakdown?.formatifAvg || !sem2Breakdown?.formatifAvg) return '-';
                            const diff = Number((sem2Breakdown.formatifAvg - sem1Breakdown.formatifAvg).toFixed(1));
                            return (
                              <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            if (!sem1Breakdown?.formatifAvg || !sem2Breakdown?.formatifAvg) return <span className="text-slate-400">-</span>;
                            const diff = sem2Breakdown.formatifAvg - sem1Breakdown.formatifAvg;
                            if (diff >= 3) return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[10px]">Peningkatan Pesat</span>;
                            if (diff >= 0) return <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold text-[10px]">Stabil Meningkat</span>;
                            return <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold text-[10px]">Perlu Pendampingan</span>;
                          })()}
                        </td>
                      </tr>

                      {/* Sumatif Row */}
                      <tr className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          <span>Sumatif Lingkup Materi</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-500 font-mono">
                          {gradeWeights.sumatif}%
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-indigo-50/20">
                          {sem1Breakdown?.sumatifAvg ? sem1Breakdown.sumatifAvg.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-emerald-50/20">
                          {sem2Breakdown?.sumatifAvg ? sem2Breakdown.sumatifAvg.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {(() => {
                            if (!sem1Breakdown?.sumatifAvg || !sem2Breakdown?.sumatifAvg) return '-';
                            const diff = Number((sem2Breakdown.sumatifAvg - sem1Breakdown.sumatifAvg).toFixed(1));
                            return (
                              <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            if (!sem1Breakdown?.sumatifAvg || !sem2Breakdown?.sumatifAvg) return <span className="text-slate-400">-</span>;
                            const diff = sem2Breakdown.sumatifAvg - sem1Breakdown.sumatifAvg;
                            if (diff >= 3) return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[10px]">Peningkatan Pesat</span>;
                            if (diff >= 0) return <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold text-[10px]">Stabil</span>;
                            return <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold text-[10px]">Perlu Evaluasi Bab</span>;
                          })()}
                        </td>
                      </tr>

                      {/* UAS Row */}
                      <tr className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                          <span>Ujian Akhir Semester (UAS)</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-500 font-mono">
                          {gradeWeights.uas}%
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-indigo-50/20">
                          {sem1Breakdown?.uasScore ? sem1Breakdown.uasScore.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-emerald-50/20">
                          {sem2Breakdown?.uasScore ? sem2Breakdown.uasScore.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {(() => {
                            if (!sem1Breakdown?.uasScore || !sem2Breakdown?.uasScore) return '-';
                            const diff = Number((sem2Breakdown.uasScore - sem1Breakdown.uasScore).toFixed(1));
                            return (
                              <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            if (!sem1Breakdown?.uasScore || !sem2Breakdown?.uasScore) return <span className="text-slate-400">-</span>;
                            const diff = sem2Breakdown.uasScore - sem1Breakdown.uasScore;
                            return diff >= 0 ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[10px]">Meningkat</span>
                            ) : (
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold text-[10px]">Menurun</span>
                            );
                          })()}
                        </td>
                      </tr>

                      {/* Sikap Row */}
                      <tr className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block"></span>
                          <span>Penilaian Karakter &amp; Sikap</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-500 font-mono">
                          {gradeWeights.sikap}%
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-indigo-50/20">
                          {sem1Breakdown?.sikapScore ? sem1Breakdown.sikapScore.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 bg-emerald-50/20">
                          {sem2Breakdown?.sikapScore ? sem2Breakdown.sikapScore.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {(() => {
                            if (!sem1Breakdown?.sikapScore || !sem2Breakdown?.sikapScore) return '-';
                            const diff = Number((sem2Breakdown.sikapScore - sem1Breakdown.sikapScore).toFixed(1));
                            return (
                              <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold text-[10px]">
                            Disiplin &amp; Afektif
                          </span>
                        </td>
                      </tr>

                      {/* NILAI AKHIR (Composite) */}
                      <tr className="bg-slate-900 text-white font-black text-sm">
                        <td className="py-3.5 px-4">
                          NILAI AKHIR RAPOR (NA)
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          100%
                        </td>
                        <td className="py-3.5 px-4 text-center text-indigo-200 font-mono text-base">
                          {sem1Breakdown?.hasAnyScore ? sem1Breakdown.nilaiAkhir.toFixed(1) : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center text-emerald-300 font-mono text-base">
                          {sem2Breakdown?.hasAnyScore ? sem2Breakdown.nilaiAkhir.toFixed(1) : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          {scoreDelta ? (
                            <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                              scoreDelta.improved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {scoreDelta.text}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center font-sans font-bold text-xs">
                          {scoreDelta?.improved ? (
                            <span className="text-emerald-400">Progresif Positif</span>
                          ) : scoreDelta ? (
                            <span className="text-rose-400">Perlu Penguatan</span>
                          ) : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GRAFIK VISUAL PERKEMBANGAN */}
          {activeTab === 'chart' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart: Comparison by Category */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Grafik Komparasi Nilai Siswa</h4>
                      <p className="text-[11px] text-slate-400">Bandingkan setiap elemen penilaian Sem 1 &amp; Sem 2</p>
                    </div>
                    <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                      <BarChart2 className="w-4 h-4" />
                    </span>
                  </div>

                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="kategori" 
                          tick={{ fontSize: 10, fill: '#64748b' }} 
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip 
                          formatter={(value: any) => [`${value} Poin`, 'Nilai']}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="Semester 1" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Semester 2" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart: Progression & KKTP Boundary */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Garis Tren Perkembangan Rapor</h4>
                      <p className="text-[11px] text-slate-400">Arah pertumbuhan nilai terhadap batas KKTP ({KKTP_STANDARD})</p>
                    </div>
                    <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  </div>

                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressionTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                        <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip 
                          formatter={(value: any) => [`${value} Poin`, '']}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Line 
                          type="monotone" 
                          dataKey="nilaiAkhir" 
                          name="Nilai Akhir Rapor" 
                          stroke="#0f172a" 
                          strokeWidth={3} 
                          dot={{ r: 5, fill: '#0f172a' }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="formatif" 
                          name="Formatif" 
                          stroke="#6366f1" 
                          strokeWidth={2} 
                          strokeDasharray="4 4"
                          dot={{ r: 4, fill: '#6366f1' }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="sumatif" 
                          name="Sumatif" 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          strokeDasharray="4 4"
                          dot={{ r: 4, fill: '#10b981' }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="kktp" 
                          name="Garis Batas KKTP" 
                          stroke="#f43f5e" 
                          strokeWidth={2} 
                          dot={false} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Rangkuman Deskriptif Perkembangan Siswa */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-800 text-xs sm:text-sm">Analisis Catatan Guru</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {scoreDelta?.improved ? (
                      <>
                        Siswa <strong>{student.nama}</strong> menunjukkan progres positif dengan kenaikan <strong>+{scoreDelta.diff} poin</strong> dari Semester 1 ke Semester 2. Pencapaian kompetensi materi dan afektif siswa berada pada lintasan yang memuaskan.
                      </>
                    ) : scoreDelta ? (
                      <>
                        Siswa <strong>{student.nama}</strong> mengalami sedikit penurunan sebesar <strong>{scoreDelta.diff} poin</strong> pada Semester 2. Disarankan memberikan modul remedial atau penguatan pada bab sumatif yang belum tuntas.
                      </>
                    ) : (
                      <>
                        Data riwayat nilai sedang dihimpun. Pastikan seluruh kolom formatif, sumatif, dan UAS untuk Semester 1 dan 2 telah diisi dengan lengkap.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DETAIL LENGKAP SEMESTER 1 */}
          {activeTab === 'sem1' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs">SEM 1</span>
                    <h4 className="font-bold text-slate-800 text-sm">Rincian Formatif Semester 1 (Ganjil)</h4>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Rata-rata: <strong className="text-indigo-600">{sem1Breakdown?.formatifAvg.toFixed(1) || '-'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {sem1Data.formativeCols.map((col, idx) => {
                    const rawVal = studentFormativeSem1 ? studentFormativeSem1[col.key] : null;
                    const remVal = studentFormativeSem1 ? studentFormativeSem1[`${col.key}_rem`] : null;
                    const eff = getEffectiveColumnScore(studentFormativeSem1, col.key, KKTP_STANDARD);
                    return (
                      <div key={col.key || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold block truncate" title={col.label}>
                          {col.label}
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className={`text-lg font-black ${eff !== null && eff >= KKTP_STANDARD ? 'text-slate-800' : 'text-rose-600'}`}>
                            {eff !== null ? eff : '-'}
                          </span>
                          {remVal !== null && remVal !== undefined && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-mono font-bold">
                              Rem: {remVal}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs">SEM 1</span>
                    <h4 className="font-bold text-slate-800 text-sm">Rincian Sumatif &amp; UAS Semester 1</h4>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Rata-rata Sumatif: <strong className="text-emerald-600">{sem1Breakdown?.sumatifAvg.toFixed(1) || '-'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {sem1Data.summativeCols.map((col, idx) => {
                    const rawVal = studentSummativeSem1 ? studentSummativeSem1[col.key] : null;
                    const remVal = studentSummativeSem1 ? studentSummativeSem1[`${col.key}_rem`] : null;
                    const eff = getEffectiveColumnScore(studentSummativeSem1, col.key, KKTP_STANDARD);
                    const isUas = col.key === 'uas';
                    return (
                      <div key={col.key || idx} className={`p-3 rounded-xl border space-y-1 ${isUas ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[10px] font-bold block truncate ${isUas ? 'text-amber-800' : 'text-slate-500'}`} title={col.label}>
                          {col.label}
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className={`text-lg font-black ${eff !== null && eff >= KKTP_STANDARD ? 'text-slate-800' : 'text-rose-600'}`}>
                            {eff !== null ? eff : '-'}
                          </span>
                          {remVal !== null && remVal !== undefined && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-mono font-bold">
                              Rem: {remVal}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DETAIL LENGKAP SEMESTER 2 */}
          {activeTab === 'sem2' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs">SEM 2</span>
                    <h4 className="font-bold text-slate-800 text-sm">Rincian Formatif Semester 2 (Genap)</h4>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Rata-rata: <strong className="text-indigo-600">{sem2Breakdown?.formatifAvg.toFixed(1) || '-'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {sem2Data.formativeCols.map((col, idx) => {
                    const rawVal = studentFormativeSem2 ? studentFormativeSem2[col.key] : null;
                    const remVal = studentFormativeSem2 ? studentFormativeSem2[`${col.key}_rem`] : null;
                    const eff = getEffectiveColumnScore(studentFormativeSem2, col.key, KKTP_STANDARD);
                    return (
                      <div key={col.key || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold block truncate" title={col.label}>
                          {col.label}
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className={`text-lg font-black ${eff !== null && eff >= KKTP_STANDARD ? 'text-slate-800' : 'text-rose-600'}`}>
                            {eff !== null ? eff : '-'}
                          </span>
                          {remVal !== null && remVal !== undefined && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-mono font-bold">
                              Rem: {remVal}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs">SEM 2</span>
                    <h4 className="font-bold text-slate-800 text-sm">Rincian Sumatif &amp; UAS Semester 2</h4>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Rata-rata Sumatif: <strong className="text-emerald-600">{sem2Breakdown?.sumatifAvg.toFixed(1) || '-'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {sem2Data.summativeCols.map((col, idx) => {
                    const rawVal = studentSummativeSem2 ? studentSummativeSem2[col.key] : null;
                    const remVal = studentSummativeSem2 ? studentSummativeSem2[`${col.key}_rem`] : null;
                    const eff = getEffectiveColumnScore(studentSummativeSem2, col.key, KKTP_STANDARD);
                    const isUas = col.key === 'uas';
                    return (
                      <div key={col.key || idx} className={`p-3 rounded-xl border space-y-1 ${isUas ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[10px] font-bold block truncate ${isUas ? 'text-amber-800' : 'text-slate-500'}`} title={col.label}>
                          {col.label}
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className={`text-lg font-black ${eff !== null && eff >= KKTP_STANDARD ? 'text-slate-800' : 'text-rose-600'}`}>
                            {eff !== null ? eff : '-'}
                          </span>
                          {remVal !== null && remVal !== undefined && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-mono font-bold">
                              Rem: {remVal}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Klik tab di atas untuk berganti antara tabel perbandingan dan grafik visual.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-xs"
          >
            Tutup Riwayat
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentGradeHistoryModal;
