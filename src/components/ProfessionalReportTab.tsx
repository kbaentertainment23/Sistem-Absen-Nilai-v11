import React, { useState, useRef } from 'react';
import { stripClockFromJamString } from '../utils/textHelper';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { convertGoogleDriveUrl } from '../utils/imageHelper';
import { 
  Student, 
  AttendanceRecord,
  GradeFormative, 
  GradeSummative, 
  MonthlyRecap, 
  GradeColumn, 
  StudentNote,
  JurnalHarianRecord,
  ReportConfig,
  ExtraTikPeserta,
  ExtraTikAbsensi,
  ExtraTikNilai,
  GradeAttitude,
  GradeWeightConfig
} from '../types';
import { 
  getReportConfigFromFirestore, 
  saveReportConfigToFirestore 
} from '../lib/firestoreService';
import { safeSetItem, optimizeImage } from '../lib/photoOptimizer';
import { generatePDF } from '../utils/pdfGenerator';
import { 
  calculateStudentGradeBreakdown, 
  getEffectiveColumnScore,
  DEFAULT_GRADE_WEIGHTS,
  KKTP_STANDARD
} from '../utils/gradeCalculator';
import { 
  FileText, 
  Settings, 
  Printer, 
  Download, 
  Check, 
  AlertCircle, 
  Info, 
  Building, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  Layout, 
  Eye, 
  Sparkles,
  Award,
  CheckSquare,
  Square,
  Upload,
  Trash,
  BookOpen,
  Save,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  UserCheck,
  CalendarCheck,
  TrendingUp,
  LayoutList,
  X
} from 'lucide-react';

interface ProfessionalReportTabProps {
  students: Student[];
  attendance?: AttendanceRecord[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  attitudeGrades?: GradeAttitude[];
  recap: MonthlyRecap[];
  formativeCols: GradeColumn[];
  summativeCols: GradeColumn[];
  notes: StudentNote[];
  activeClassName: string;
  journals?: JurnalHarianRecord[];
  extraTikPeserta?: ExtraTikPeserta[];
  extraTikAbsensi?: ExtraTikAbsensi[];
  extraTikNilai?: ExtraTikNilai[];
  selectedSemester?: 1 | 2;
  allAttendance?: AttendanceRecord[];
  allFormative?: GradeFormative[];
  allSummative?: GradeSummative[];
  allNotes?: StudentNote[];
  allJournals?: JurnalHarianRecord[];
  gradeWeights?: GradeWeightConfig;
}

type ReportType = 'collective' | 'individual' | 'journal' | 'extra_tik';
type ThemeColor = 'indigo' | 'slate' | 'emerald' | 'rose' | 'amber' | 'cyan';

// Reusable Official Indonesian Kop Surat Component
const RenderKopSurat: React.FC<{
  logoKiri?: string | null;
  logoKanan?: string | null;
  govName: string;
  deptName: string;
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
}> = ({ logoKiri, logoKanan, govName, deptName, schoolName, schoolAddress, schoolPhone }) => {
  return (
    <div className="relative pb-2 mb-3">
      <div className="flex items-center justify-between gap-4">
        {/* Logo Kiri */}
        <div className="w-[16mm] h-[16mm] flex items-center justify-center shrink-0 overflow-hidden">
          {logoKiri ? (
            <img src={convertGoogleDriveUrl(logoKiri)} alt="Logo Kiri" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center border border-slate-200 rounded-xl p-1 bg-slate-50/50 shadow-2xs">
              <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-.153-7.843-.418m15.686 0a11.955 11.955 0 01-1.358 3.667m-14.016-3.667a11.95 11.95 0 001.358 3.667m12.658 0A12.018 12.018 0 0112 14.5c-1.91 0-3.724-.21-5.358-.598m0 0a11.954 11.954 0 01-1.357-3.667m0 0C3.393 9.773 2.25 8.514 2.25 7c0-2.347 4.365-4.25 9.75-4.25s9.75 1.903 9.75 4.25c0 1.514-1.143 2.773-2.65 3.232z" />
              </svg>
            </div>
          )}
        </div>

        {/* Teks Tengah Kop Surat */}
        <div className="flex-1 text-center space-y-0.5">
          <h5 className="text-[9px] font-extrabold text-slate-700 tracking-[0.15em] uppercase leading-none">{govName || 'PEMERINTAH PROVINSI / KABUPATEN'}</h5>
          <h5 className="text-[10px] font-black text-slate-800 tracking-[0.12em] uppercase leading-tight">{deptName || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}</h5>
          <h2 className="text-[14.5px] font-black text-slate-950 tracking-[0.06em] uppercase leading-tight py-0.5">{schoolName || 'SATUAN PENDIDIKAN'}</h2>
          <p className="text-[8.5px] text-slate-600 font-medium leading-tight">{schoolAddress || 'Alamat Sekolah'}</p>
          {schoolPhone && <p className="text-[7.5px] text-slate-500 font-mono leading-tight">{schoolPhone}</p>}
        </div>

        {/* Logo Kanan */}
        <div className="w-[16mm] h-[16mm] flex items-center justify-center shrink-0 overflow-hidden">
          {logoKanan ? (
            <img src={convertGoogleDriveUrl(logoKanan)} alt="Logo Kanan" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center border border-slate-200 rounded-xl p-1 bg-slate-50/50 shadow-2xs">
              <svg className="w-9 h-9 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Garis Ganda Standar Kop Surat Resmi (Thick + Thin line) */}
      <div className="border-b-[2.5px] border-slate-900 mt-2"></div>
      <div className="border-b-[1px] border-slate-900 mt-[2px]"></div>
    </div>
  );
};

// Reusable wrapper to dynamically calculate remaining vertical space on printed page
// and automatically move signature section to next page only if it would otherwise be cut off
const DynamicReportSignatures: React.FC<{
  children: React.ReactNode;
  cols?: number;
}> = ({ children, cols = 2 }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const sigRef = useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = useState<number>(0);
  const [isMovedToNextPage, setIsMovedToNextPage] = useState<boolean>(false);

  const calculateSpace = React.useCallback(() => {
    if (!anchorRef.current || !sigRef.current) return;
    const anchor = anchorRef.current;
    const sig = sigRef.current;
    const container = anchor.closest('.report-page-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const contentEndPx = anchorRect.top - containerRect.top;
    if (contentEndPx < 0) return;

    // Constants based on A4 page dimensions (210mm x 297mm) at standard 96 DPI
    const mmToPx = 96 / 25.4;
    const pageHeightPx = 297 * mmToPx; // ~1122.52 px
    const bottomMarginPx = 16 * mmToPx; // ~60.47 px bottom margin
    const topMarginPx = 12 * mmToPx; // ~45.35 px top margin

    // Determine which physical A4 page (0-indexed) the preceding content ends on
    const pageIdx = Math.floor(contentEndPx / pageHeightPx);
    const currentPageBottomPx = (pageIdx + 1) * pageHeightPx - bottomMarginPx;

    // Dynamically calculate remaining vertical space on this printed page
    const remainingSpacePx = currentPageBottomPx - contentEndPx;
    const sigHeightPx = sig.getBoundingClientRect().height || 100;
    const requiredHeightPx = sigHeightPx + 16; // include minimal top margin

    // Ensure signature section is automatically moved to next page only if it would otherwise be cut off
    if (requiredHeightPx > remainingSpacePx) {
      const nextPageTopPx = (pageIdx + 1) * pageHeightPx + topMarginPx;
      const neededSpacer = Math.max(0, Math.ceil(nextPageTopPx - contentEndPx));
      setSpacerHeight(neededSpacer);
      setIsMovedToNextPage(true);
    } else {
      setSpacerHeight(0);
      setIsMovedToNextPage(false);
    }
  }, []);

  React.useLayoutEffect(() => {
    calculateSpace();
    const timer1 = setTimeout(calculateSpace, 50);
    const timer2 = setTimeout(calculateSpace, 200);
    const timer3 = setTimeout(calculateSpace, 500);
    window.addEventListener('resize', calculateSpace);
    window.addEventListener('beforeprint', calculateSpace);

    let observer: ResizeObserver | null = null;
    if (anchorRef.current) {
      const container = anchorRef.current.closest('.report-page-container');
      if (container && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          calculateSpace();
        });
        observer.observe(container);
      }
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', calculateSpace);
      window.removeEventListener('beforeprint', calculateSpace);
      if (observer) observer.disconnect();
    };
  }, [calculateSpace]);

  const gridColsClass = cols === 3 ? 'grid grid-cols-3 gap-4 items-start w-full' : 'flex justify-between items-start gap-8';

  return (
    <div className="w-full">
      {/* Invisible anchor marking the natural end of content above signatures */}
      <div ref={anchorRef} className="w-full h-0 pointer-events-none invisible" />
      <div
        ref={sigRef}
        style={{
          marginTop: spacerHeight > 0 ? `${spacerHeight}px` : undefined,
        }}
        className={`w-full ${gridColsClass} pt-4 text-[10px] text-slate-800 border-t-2 border-slate-200 ${
          spacerHeight > 0 ? '' : 'mt-6 sm:mt-8'
        } break-inside-avoid page-break-inside-avoid ${
          isMovedToNextPage ? 'print:break-before-page print:page-break-before-always' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default function ProfessionalReportTab({
  students,
  attendance,
  formativeGrades,
  summativeGrades,
  attitudeGrades = [],
  recap,
  formativeCols,
  summativeCols,
  notes,
  activeClassName,
  journals,
  extraTikPeserta = [],
  extraTikAbsensi = [],
  extraTikNilai = [],
  gradeWeights
}: ProfessionalReportTabProps) {
  // Report Config States
  const [reportType, setReportType] = useState<ReportType>('collective');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [includeAttendance, setIncludeAttendance] = useState<boolean>(true);
  const [includeGrades, setIncludeGrades] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  const [themeColor] = useState<ThemeColor>('indigo');
  
  // Custom official headers (Kop Surat)
  const [govName, setGovName] = useState(() => localStorage.getItem('report_gov_name') || 'PEMERINTAH KABUPATEN / KOTA ADMINISTRATIF');
  const [deptName, setDeptName] = useState(() => localStorage.getItem('report_dept_name') || 'DINAS PENDIDIKAN, KEPEMUDAAN, DAN OLAHRAGA');
  const [schoolName, setSchoolName] = useState(() => localStorage.getItem('report_school_name') || 'SMP NEGERI INDONESIA HEBAT');
  const [schoolAddress, setSchoolAddress] = useState(() => localStorage.getItem('report_school_address') || 'Jl. Pendidikan Luhur No. 88, Kota Harapan Bangsa');
  const [schoolPhone, setSchoolPhone] = useState(() => localStorage.getItem('report_school_phone') || 'Telepon: (021) 7654321 | Email: info@smpnindonesia.sch.id');

  // Custom logo states with local persistence
  const [logoKiri, setLogoKiri] = useState<string | null>(() => localStorage.getItem('custom_report_logo_kiri'));
  const [logoKanan, setLogoKanan] = useState<string | null>(() => localStorage.getItem('custom_report_logo_kanan'));

  // Signature Configs
  const [cityName, setCityName] = useState(() => localStorage.getItem('report_city_name') || 'Jakarta');
  const [teacherName, setTeacherName] = useState(() => localStorage.getItem('report_teacher_name') || 'Dra. Riana Amalia, M.Pd.');
  const [teacherNip, setTeacherNip] = useState(() => localStorage.getItem('report_teacher_nip') || 'NIP. 19780516 200501 2 003');
  const [teacherSubject, setTeacherSubject] = useState(() => localStorage.getItem('report_teacher_subject') || 'Informatika');
  const [headmasterName, setHeadmasterName] = useState(() => localStorage.getItem('report_headmaster_name') || 'Drs. Hermawan Prasetyo, M.Si.');
  const [headmasterNip, setHeadmasterNip] = useState(() => localStorage.getItem('report_headmaster_nip') || 'NIP. 19710814 199803 1 001');

  // Paraf Mechanism Options
  const [parafMode, setParafMode] = useState<'digital' | 'custom_image' | 'stamp' | 'manual'>(() => 
    (localStorage.getItem('report_paraf_mode') as any) || 'digital'
  );
  const [customParafImg, setCustomParafImg] = useState<string | null>(() => localStorage.getItem('report_custom_paraf_img'));

  // Save status states
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Sync from Firestore on component mount
  React.useEffect(() => {
    let isMounted = true;
    getReportConfigFromFirestore().then((cfg) => {
      if (!isMounted || !cfg) return;
      if (cfg.govName) { setGovName(cfg.govName); safeSetItem('report_gov_name', cfg.govName); }
      if (cfg.deptName) { setDeptName(cfg.deptName); safeSetItem('report_dept_name', cfg.deptName); }
      if (cfg.schoolName) { setSchoolName(cfg.schoolName); safeSetItem('report_school_name', cfg.schoolName); }
      if (cfg.schoolAddress) { setSchoolAddress(cfg.schoolAddress); safeSetItem('report_school_address', cfg.schoolAddress); }
      if (cfg.schoolPhone) { setSchoolPhone(cfg.schoolPhone); safeSetItem('report_school_phone', cfg.schoolPhone); }
      if (cfg.logoKiri !== undefined) { 
        setLogoKiri(cfg.logoKiri); 
        if (cfg.logoKiri) safeSetItem('custom_report_logo_kiri', cfg.logoKiri); 
        else localStorage.removeItem('custom_report_logo_kiri'); 
      }
      if (cfg.logoKanan !== undefined) { 
        setLogoKanan(cfg.logoKanan); 
        if (cfg.logoKanan) safeSetItem('custom_report_logo_kanan', cfg.logoKanan); 
        else localStorage.removeItem('custom_report_logo_kanan'); 
      }
      if (cfg.cityName) { setCityName(cfg.cityName); safeSetItem('report_city_name', cfg.cityName); }
      if (cfg.teacherName) { setTeacherName(cfg.teacherName); safeSetItem('report_teacher_name', cfg.teacherName); }
      if (cfg.teacherNip) { setTeacherNip(cfg.teacherNip); safeSetItem('report_teacher_nip', cfg.teacherNip); }
      if (cfg.teacherSubject) { setTeacherSubject(cfg.teacherSubject); safeSetItem('report_teacher_subject', cfg.teacherSubject); }
      if (cfg.headmasterName) { setHeadmasterName(cfg.headmasterName); safeSetItem('report_headmaster_name', cfg.headmasterName); }
      if (cfg.headmasterNip) { setHeadmasterNip(cfg.headmasterNip); safeSetItem('report_headmaster_nip', cfg.headmasterNip); }
      if (cfg.parafMode) { setParafMode(cfg.parafMode); safeSetItem('report_paraf_mode', cfg.parafMode); }
      if (cfg.customParafImg !== undefined) { 
        setCustomParafImg(cfg.customParafImg); 
        if (cfg.customParafImg) safeSetItem('report_custom_paraf_img', cfg.customParafImg); 
        else localStorage.removeItem('report_custom_paraf_img'); 
      }
    }).catch(err => console.error('Error fetching report config:', err));
    return () => { isMounted = false; };
  }, []);

  // Auto-sync to localStorage whenever fields change
  React.useEffect(() => {
    safeSetItem('report_gov_name', govName);
    safeSetItem('report_dept_name', deptName);
    safeSetItem('report_school_name', schoolName);
    safeSetItem('report_school_address', schoolAddress);
    safeSetItem('report_school_phone', schoolPhone);
    safeSetItem('report_city_name', cityName);
    safeSetItem('report_teacher_name', teacherName);
    safeSetItem('report_teacher_nip', teacherNip);
    safeSetItem('report_teacher_subject', teacherSubject);
    safeSetItem('report_headmaster_name', headmasterName);
    safeSetItem('report_headmaster_nip', headmasterNip);
    safeSetItem('report_paraf_mode', parafMode);
    if (logoKiri) safeSetItem('custom_report_logo_kiri', logoKiri); else localStorage.removeItem('custom_report_logo_kiri');
    if (logoKanan) safeSetItem('custom_report_logo_kanan', logoKanan); else localStorage.removeItem('custom_report_logo_kanan');
    if (customParafImg) safeSetItem('report_custom_paraf_img', customParafImg); else localStorage.removeItem('report_custom_paraf_img');
  }, [
    govName, deptName, schoolName, schoolAddress, schoolPhone,
    cityName, teacherName, teacherNip, teacherSubject, headmasterName, headmasterNip,
    parafMode, logoKiri, logoKanan, customParafImg
  ]);

  const handleLogoKiriChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await optimizeImage(file, 350, 0.75);
        setLogoKiri(compressed);
        safeSetItem('custom_report_logo_kiri', compressed);
      } catch (err) {
        console.error('Failed to optimize logo kiri:', err);
      }
    }
  };

  const handleLogoKananChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await optimizeImage(file, 350, 0.75);
        setLogoKanan(compressed);
        safeSetItem('custom_report_logo_kanan', compressed);
      } catch (err) {
        console.error('Failed to optimize logo kanan:', err);
      }
    }
  };

  const removeLogoKiri = () => {
    setLogoKiri(null);
    localStorage.removeItem('custom_report_logo_kiri');
  };

  const removeLogoKanan = () => {
    setLogoKanan(null);
    localStorage.removeItem('custom_report_logo_kanan');
  };

  const handleSavePermanentConfig = async () => {
    setIsSavingConfig(true);
    setSaveSuccessMsg(null);
    try {
      const payload: ReportConfig = {
        govName,
        deptName,
        schoolName,
        schoolAddress,
        schoolPhone,
        logoKiri,
        logoKanan,
        cityName,
        teacherSubject,
        teacherName,
        teacherNip,
        headmasterName,
        headmasterNip,
        parafMode,
        customParafImg
      };
      await saveReportConfigToFirestore(payload);
      setSaveSuccessMsg('Data Kop, Logo, & Penandatangan Berhasil Disimpan Permanen!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed saving config:', err);
      setSaveSuccessMsg('Data disimpan secara lokal di perangkat.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Apakah Anda yakin ingin mengembalikan data Kop & Penandatangan ke pengaturan awal (default)?')) {
      const defaultGov = 'PEMERINTAH KABUPATEN / KOTA ADMINISTRATIF';
      const defaultDept = 'DINAS PENDIDIKAN, KEPEMUDAAN, DAN OLAHRAGA';
      const defaultSchool = 'SMP NEGERI INDONESIA HEBAT';
      const defaultAddr = 'Jl. Pendidikan Luhur No. 88, Kota Harapan Bangsa';
      const defaultPhone = 'Telepon: (021) 7654321 | Email: info@smpnindonesia.sch.id';
      const defaultCity = 'Jakarta';
      const defaultSubject = 'Informatika';
      const defaultTeacher = 'Dra. Riana Amalia, M.Pd.';
      const defaultTeacherNip = 'NIP. 19780516 200501 2 003';
      const defaultHead = 'Drs. Hermawan Prasetyo, M.Si.';
      const defaultHeadNip = 'NIP. 19710814 199803 1 001';

      setGovName(defaultGov);
      setDeptName(defaultDept);
      setSchoolName(defaultSchool);
      setSchoolAddress(defaultAddr);
      setSchoolPhone(defaultPhone);
      setCityName(defaultCity);
      setTeacherSubject(defaultSubject);
      setTeacherName(defaultTeacher);
      setTeacherNip(defaultTeacherNip);
      setHeadmasterName(defaultHead);
      setHeadmasterNip(defaultHeadNip);
      setLogoKiri(null);
      setLogoKanan(null);
      setParafMode('digital');
      setCustomParafImg(null);

      saveReportConfigToFirestore({
        govName: defaultGov,
        deptName: defaultDept,
        schoolName: defaultSchool,
        schoolAddress: defaultAddr,
        schoolPhone: defaultPhone,
        cityName: defaultCity,
        teacherSubject: defaultSubject,
        teacherName: defaultTeacher,
        teacherNip: defaultTeacherNip,
        headmasterName: defaultHead,
        headmasterNip: defaultHeadNip,
        logoKiri: null,
        logoKanan: null,
        parafMode: 'digital',
        customParafImg: null
      }).catch(e => console.error(e));

      setSaveSuccessMsg('Pengaturan telah dikembalikan ke default.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  const handleParafImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await optimizeImage(file, 300, 0.7);
        setCustomParafImg(compressed);
        safeSetItem('report_custom_paraf_img', compressed);
      } catch (err) {
        console.error('Failed to optimize paraf image:', err);
      }
    }
  };

  // Academic Meta Options
  const [semester, setSemester] = useState('Semester Ganjil (Semester 1)');
  const [academicYear, setAcademicYear] = useState('2026/2027');

  // Individual student filter
  const [selectedStudentNis, setSelectedStudentNis] = useState<string>('all');

  // PDF processing state
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  const previewRef = useRef<HTMLDivElement>(null);

  // Helper to calculate average from non-null values dynamically
  const calculateAvg = (scores: (number | null)[]): number => {
    const validScores = scores.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
    if (validScores.length === 0) return 0;
    const total = validScores.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((total / validScores.length).toFixed(1));
  };

  const getThemeClasses = (type: 'bg' | 'text' | 'border' | 'accent' | 'headerBg') => {
    switch (themeColor) {
      case 'indigo':
        return {
          bg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          text: 'text-indigo-600',
          border: 'border-indigo-200',
          accent: 'indigo',
          headerBg: 'bg-indigo-50 text-indigo-950'
        }[type];
      case 'slate':
        return {
          bg: 'bg-slate-800 hover:bg-slate-900 text-white',
          text: 'text-slate-800',
          border: 'border-slate-300',
          accent: 'slate',
          headerBg: 'bg-slate-100 text-slate-950'
        }[type];
      case 'emerald':
        return {
          bg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          text: 'text-emerald-600',
          border: 'border-emerald-200',
          accent: 'emerald',
          headerBg: 'bg-emerald-50 text-emerald-950'
        }[type];
      case 'rose':
        return {
          bg: 'bg-rose-600 hover:bg-rose-700 text-white',
          text: 'text-rose-600',
          border: 'border-rose-200',
          accent: 'rose',
          headerBg: 'bg-rose-50 text-rose-950'
        }[type];
      case 'amber':
        return {
          bg: 'bg-amber-600 hover:bg-amber-700 text-white',
          text: 'text-amber-600',
          border: 'border-amber-200',
          accent: 'amber',
          headerBg: 'bg-amber-50 text-amber-950'
        }[type];
      case 'cyan':
        return {
          bg: 'bg-cyan-600 hover:bg-cyan-700 text-white',
          text: 'text-cyan-600',
          border: 'border-cyan-200',
          accent: 'cyan',
          headerBg: 'bg-cyan-50 text-cyan-950'
        }[type];
    }
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    setPdfError(null);

    try {
      await generatePDF({
        reportType,
        config: {
          govName,
          deptName,
          schoolName,
          schoolAddress,
          schoolPhone,
          cityName,
          teacherSubject,
          teacherName,
          teacherNip,
          headmasterName,
          headmasterNip,
          logoKiri,
          logoKanan,
          parafMode,
          customParafImg,
          semester,
          academicYear,
          activeClassName,
          orientation
        },
        students,
        selectedStudentNis,
        attendance,
        formativeGrades,
        summativeGrades,
        attitudeGrades,
        gradeWeights,
        recap,
        formativeCols,
        summativeCols,
        notes,
        journals,
        extraTikPeserta,
        extraTikAbsensi,
        extraTikNilai,
        includeAttendance,
        includeGrades,
        includeNotes
      });
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      setPdfError(err?.message || 'Terjadi kesalahan saat membuat file PDF. Silakan coba kembali.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      if (reportType === 'collective') {
        // 1. REKAP PRESENSI SHEET
        if (includeAttendance || (!includeAttendance && !includeGrades && !includeNotes)) {
          const presensiRows = recap.map((r, i) => {
            const st = students.find(s => s.nis === r.nis);
            return {
              'No': i + 1,
              'NIS': r.nis,
              'Nama Lengkap Murid': r.nama,
              'L/P': r.jenisKelamin || st?.jenisKelamin || '-',
              'No. Absen': st?.noAbsen || i + 1,
              'Hadir': r.hadir,
              'Sakit': r.sakit,
              'Izin': r.izin,
              'Alfa': r.alfa,
              'Terlambat (Frekuensi)': r.terlambatCount,
              '% Kehadiran': `${(r.persentaseKehadiran * 100).toFixed(0)}%`
            };
          });

          const wsPresensi = XLSX.utils.json_to_sheet(presensiRows);
          wsPresensi['!cols'] = [
            { wch: 6 },
            { wch: 14 },
            { wch: 30 },
            { wch: 8 },
            { wch: 10 },
            { wch: 8 },
            { wch: 8 },
            { wch: 8 },
            { wch: 8 },
            { wch: 20 },
            { wch: 14 },
          ];
          XLSX.utils.book_append_sheet(wb, wsPresensi, 'Rekap Presensi');
        }

        // 2. TRANSKRIP NILAI SHEET (NILAI AKHIR: FORMATIF, SUMATIF, UAS, SIKAP)
        if (includeGrades) {
          const weights = gradeWeights || DEFAULT_GRADE_WEIGHTS;
          const nilaiRows = students.map((s, i) => {
            const f = formativeGrades.find(g => g.nis === s.nis);
            const sum = summativeGrades.find(g => g.nis === s.nis);
            const att = (attitudeGrades || []).find(g => g.nis === s.nis);

            const breakdown = calculateStudentGradeBreakdown(
              s,
              f,
              sum,
              formativeCols,
              summativeCols,
              weights,
              att,
              notes,
              recap,
              attendance
            );

            return {
              'No': i + 1,
              'NIS': s.nis,
              'Nama Lengkap Murid': s.nama,
              'L/P': s.jenisKelamin || '-',
              [`Formatif (${weights.formatif}%)`]: breakdown.formatifAvg > 0 ? breakdown.formatifAvg : 0,
              [`Sumatif (${weights.sumatif}%)`]: breakdown.sumatifAvg > 0 ? breakdown.sumatifAvg : 0,
              [`UAS (${weights.uas}%)`]: breakdown.uasScore > 0 ? breakdown.uasScore : 0,
              [`Sikap (${weights.sikap}%)`]: breakdown.sikapScore > 0 ? breakdown.sikapScore : 0,
              'Nilai Akhir (NA)': breakdown.nilaiAkhir > 0 ? breakdown.nilaiAkhir : 0,
              'Predikat': breakdown.predikatLengkap,
              'Status Kelulusan': breakdown.status,
              'Deskripsi Capaian': breakdown.deskripsiKompetensi
            };
          });

          const wsNilai = XLSX.utils.json_to_sheet(nilaiRows);
          wsNilai['!cols'] = [
            { wch: 6 },
            { wch: 14 },
            { wch: 30 },
            { wch: 8 },
            { wch: 16 },
            { wch: 16 },
            { wch: 14 },
            { wch: 14 },
            { wch: 18 },
            { wch: 22 },
            { wch: 18 },
            { wch: 45 },
          ];
          XLSX.utils.book_append_sheet(wb, wsNilai, 'Transkrip Nilai');
        }

        // 3. CATATAN SISWA SHEET
        if (includeNotes) {
          const notesRows = notes.map((n, i) => ({
            'No': i + 1,
            'Tanggal': n.tanggal,
            'NIS': n.nis,
            'Nama Murid': n.nama,
            'Tipe Perilaku': n.tipe,
            'Catatan Observasi Guru': n.catatan
          }));

          const wsNotes = XLSX.utils.json_to_sheet(notesRows.length > 0 ? notesRows : [{ 'Catatan': 'Tidak ada catatan observasi' }]);
          wsNotes['!cols'] = [
            { wch: 6 },
            { wch: 14 },
            { wch: 14 },
            { wch: 28 },
            { wch: 16 },
            { wch: 50 },
          ];
          XLSX.utils.book_append_sheet(wb, wsNotes, 'Catatan Perilaku');
        }

      } else if (reportType === 'journal') {
        const classJournalsForExcel = (journals || []).filter(j => j.kelas === activeClassName).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
        const journalRows = classJournalsForExcel.map((j, i) => {
          const jamStr = Array.isArray(j.jamPelajaran) ? `Jam ${j.jamPelajaran.join(', ')}` : '-';
          const absensiStr = j.tidakHadirSnapshot && j.tidakHadirSnapshot.length > 0
            ? j.tidakHadirSnapshot.map(x => `${x.nama} (${x.status})`).join(', ')
            : 'Nihil / Hadir Semua';

          return {
            'No': i + 1,
            'Tanggal': j.tanggal,
            'Jam Pelajaran': jamStr,
            'Mata Pelajaran': teacherSubject,
            'Kelas': j.kelas,
            'Topik / Materi Pembelajaran': j.materi || '-',
            'Detail Ketidakhadiran / Presensi': absensiStr,
            'Catatan Guru / Refleksi': j.catatan || '-',
            'Hambatan': j.hambatan || '-',
            'Solusi': j.solusi || '-'
          };
        });

        const wsJournal = XLSX.utils.json_to_sheet(journalRows.length > 0 ? journalRows : [{ 'Pesan': 'Belum ada data jurnal harian untuk kelas ini' }]);
        wsJournal['!cols'] = [
          { wch: 6 },
          { wch: 14 },
          { wch: 16 },
          { wch: 18 },
          { wch: 10 },
          { wch: 35 },
          { wch: 30 },
          { wch: 40 },
          { wch: 30 },
          { wch: 30 },
        ];
        XLSX.utils.book_append_sheet(wb, wsJournal, 'Jurnal Harian Guru');

      } else {
        const targetStudents = selectedStudentNis !== 'all' 
          ? students.filter(s => s.nis === selectedStudentNis)
          : students;

        const weights = gradeWeights || DEFAULT_GRADE_WEIGHTS;

        const individualRows = targetStudents.map((s, i) => {
          const r = recap.find(rec => rec.nis === s.nis);
          const f = formativeGrades.find(g => g.nis === s.nis);
          const sum = summativeGrades.find(g => g.nis === s.nis);
          const att = (attitudeGrades || []).find(g => g.nis === s.nis);

          const breakdown = calculateStudentGradeBreakdown(
            s,
            f,
            sum,
            formativeCols,
            summativeCols,
            weights,
            att,
            notes,
            recap,
            attendance
          );

          const studentNotes = notes.filter(n => n.nis === s.nis).map(n => `[${n.tanggal}] ${n.tipe.toUpperCase()}: ${n.catatan}`).join(' | ');

          const showAtt = includeAttendance || (!includeAttendance && !includeGrades && !includeNotes);
          const showGrd = includeGrades || (!includeAttendance && !includeGrades && !includeNotes);
          const showNot = includeNotes || (!includeAttendance && !includeGrades && !includeNotes);

          const rowObj: Record<string, any> = {
            'No': i + 1,
            'NIS': s.nis,
            'Nama Siswa': s.nama,
            'L/P': s.jenisKelamin || '-',
            'No. Absen': s.noAbsen || i + 1,
          };

          if (showAtt) {
            rowObj['Hadir'] = r?.hadir || 0;
            rowObj['Sakit'] = r?.sakit || 0;
            rowObj['Izin'] = r?.izin || 0;
            rowObj['Alfa'] = r?.alfa || 0;
            rowObj['% Kehadiran'] = `${((r?.persentaseKehadiran || 0) * 100).toFixed(0)}%`;
          }

          if (showGrd) {
            rowObj[`Nilai Formatif (${weights.formatif}%)`] = breakdown.formatifAvg > 0 ? breakdown.formatifAvg : 0;
            rowObj[`Nilai Sumatif (${weights.sumatif}%)`] = breakdown.sumatifAvg > 0 ? breakdown.sumatifAvg : 0;
            rowObj[`Nilai UAS (${weights.uas}%)`] = breakdown.uasScore > 0 ? breakdown.uasScore : 0;
            rowObj[`Nilai Sikap (${weights.sikap}%)`] = breakdown.sikapScore > 0 ? breakdown.sikapScore : 0;
            rowObj['Nilai Akhir (NA)'] = breakdown.nilaiAkhir > 0 ? breakdown.nilaiAkhir : 0;
            rowObj['Predikat'] = breakdown.predikatLengkap;
            rowObj['Status'] = breakdown.status;
            rowObj['Capaian Kompetensi'] = breakdown.deskripsiKompetensi;
          }

          if (showNot) {
            rowObj['Catatan Guru'] = studentNotes || 'Siswa menunjukkan perkembangan belajar yang konsisten.';
          }

          return rowObj;
        });

        const wsIndividual = XLSX.utils.json_to_sheet(individualRows);
        wsIndividual['!cols'] = [
          { wch: 6 },
          { wch: 14 },
          { wch: 30 },
          { wch: 8 },
          { wch: 10 },
          { wch: 8 },
          { wch: 8 },
          { wch: 8 },
          { wch: 8 },
          { wch: 14 },
          { wch: 18 },
          { wch: 18 },
          { wch: 16 },
          { wch: 16 },
          { wch: 18 },
          { wch: 22 },
          { wch: 16 },
          { wch: 45 },
          { wch: 50 },
        ];
        XLSX.utils.book_append_sheet(wb, wsIndividual, 'Rapor Siswa');
      }

      if (reportType === 'extra_tik') {
        const extraRows = filteredExtraTikReportData.map((item, i) => ({
          'No': i + 1,
          'NIS': item.nis,
          'Nama Lengkap Peserta': item.nama,
          'Kelas': item.kelas,
          'Status Peserta': item.status,
          'Tanggal Daftar': item.tanggalDaftar || '-',
          'Hadir': item.hadir,
          'Sakit': item.sakit,
          'Izin': item.izin,
          'Alfa': item.alfa,
          '% Kehadiran': `${item.persentaseHadir}%`,
          'Nilai Tugas': item.nilaiTugas ?? '-',
          'Nilai Praktik': item.nilaiPraktik ?? '-',
          'Nilai Teori': item.nilaiTeori ?? '-',
          'Rata-Rata Nilai': item.rataRata ?? '-',
          'Predikat': item.predikat
        }));
        const wsExtra = XLSX.utils.json_to_sheet(extraRows);
        wsExtra['!cols'] = [
          { wch: 5 },  { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 14 },
          { wch: 15 }, { wch: 8 },  { wch: 8 },  { wch: 8 },  { wch: 8 },
          { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }
        ];
        XLSX.utils.book_append_sheet(wb, wsExtra, 'Laporan Extra TIK');
      }

      const timeStamp = new Date().toISOString().slice(0, 10);
      const cleanClassName = activeClassName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = reportType === 'collective'
        ? `Laporan_Kolektif_${cleanClassName}_${timeStamp}.xlsx`
        : reportType === 'journal'
        ? `Jurnal_Harian_Guru_${cleanClassName}_${timeStamp}.xlsx`
        : reportType === 'extra_tik'
        ? `Laporan_Extra_TIK_${timeStamp}.xlsx`
        : `Rapor_Siswa_${cleanClassName}_${timeStamp}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      console.error('Error generating Excel file:', err);
      alert('Gagal mengunduh file Excel: ' + (err?.message || err));
    }
  };

  // Extra TIK Data Calculation for Report
  const [extraTikStatusFilter, setExtraTikStatusFilter] = useState<'Semua' | 'Aktif' | 'Alumni' | 'Keluar'>('Semua');

  const extraTikReportData = React.useMemo(() => {
    return (extraTikPeserta || []).map((p) => {
      const normNis = p.nis?.toString().trim() || '';
      const student = students.find(s => s.nis?.toString().trim() === normNis);
      const nama = student ? student.nama : (p.nama || '');
      const kelas = student ? (student.kelas || 'Belum Diatur') : (p.kelas || 'Belum Diatur');

      const studentAbs = (extraTikAbsensi || []).filter(a => a.nis?.toString().trim() === normNis);
      const hadir = studentAbs.filter(a => a.statusKehadiran === 'Hadir').length;
      const sakit = studentAbs.filter(a => a.statusKehadiran === 'Sakit').length;
      const izin = studentAbs.filter(a => a.statusKehadiran === 'Izin').length;
      const alfa = studentAbs.filter(a => a.statusKehadiran === 'Alfa').length;
      const totalAbs = studentAbs.length;
      const persentaseHadir = totalAbs > 0 ? Math.round((hadir / totalAbs) * 100) : 100;

      const gradeObj = (extraTikNilai || []).find(n => n.nis?.toString().trim() === normNis);
      const nilaiTugas = gradeObj?.nilaiTugas ?? null;
      const nilaiPraktik = gradeObj?.nilaiPraktik ?? null;
      const nilaiTeori = gradeObj?.nilaiTeori ?? null;

      let rataRata = gradeObj?.rataRata ?? null;
      if (rataRata === null) {
        const vals = [nilaiTugas, nilaiPraktik, nilaiTeori].filter((v): v is number => v !== null && !isNaN(v));
        if (vals.length > 0) {
          rataRata = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }
      }

      let predikat = gradeObj?.predikat;
      if (!predikat || predikat === '-') {
        if (rataRata !== null) {
          if (rataRata >= 85) predikat = 'Sangat Baik (A)';
          else if (rataRata >= 75) predikat = 'Baik (B)';
          else if (rataRata >= 60) predikat = 'Cukup (C)';
          else predikat = 'Perlu Bimbingan (D)';
        } else {
          predikat = '-';
        }
      }

      return {
        nis: normNis,
        nama,
        kelas,
        status: p.status,
        tanggalDaftar: p.tanggalDaftar,
        hadir,
        sakit,
        izin,
        alfa,
        totalAbs,
        persentaseHadir,
        nilaiTugas,
        nilaiPraktik,
        nilaiTeori,
        rataRata,
        predikat
      };
    });
  }, [extraTikPeserta, extraTikAbsensi, extraTikNilai, students]);

  const filteredExtraTikReportData = React.useMemo(() => {
    if (extraTikStatusFilter === 'Semua') return extraTikReportData;
    return extraTikReportData.filter(p => p.status === extraTikStatusFilter);
  }, [extraTikReportData, extraTikStatusFilter]);

  // Determine which students to render for the report preview
  const studentsToRender = reportType === 'individual' && selectedStudentNis !== 'all'
    ? students.filter(s => s.nis === selectedStudentNis)
    : students;

  const classJournals = React.useMemo(() => {
    return (journals || []).filter(j => j.kelas === activeClassName).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [journals, activeClassName]);

  // Active sections for collective report
  const activeSections: string[] = [];
  if (includeAttendance) activeSections.push('attendance');
  if (includeGrades) activeSections.push('grades');
  if (includeNotes) activeSections.push('notes');
  if (activeSections.length === 0) {
    activeSections.push('attendance');
  }

  // Active pages for collective report (paginated by max rows per page to guarantee signatures always stay inside A4 page)
  interface CollectivePageMeta {
    section: string;
    subPage: number;
    totalSubPages: number;
    startIdx: number;
    endIdx: number;
  }

  const activePages: CollectivePageMeta[] = [];
  if (includeAttendance || (!includeAttendance && !includeGrades && !includeNotes)) {
    const pageSize = 35; // 35 rows fits comfortably inside 297mm without pushing signature
    const totalSub = Math.max(1, Math.ceil(recap.length / pageSize));
    for (let i = 0; i < totalSub; i++) {
      activePages.push({
        section: 'attendance',
        subPage: i + 1,
        totalSubPages: totalSub,
        startIdx: i * pageSize,
        endIdx: (i + 1) * pageSize,
      });
    }
  }

  if (includeGrades) {
    const pageSize = 35; // 35 rows fits comfortably inside 297mm without pushing signature
    const totalSub = Math.max(1, Math.ceil(students.length / pageSize));
    for (let i = 0; i < totalSub; i++) {
      activePages.push({
        section: 'grades',
        subPage: i + 1,
        totalSubPages: totalSub,
        startIdx: i * pageSize,
        endIdx: (i + 1) * pageSize,
      });
    }
  }

  if (includeNotes) {
    const pageSize = 25; // 25 notes fits comfortably inside 297mm without pushing signature
    const totalSub = Math.max(1, Math.ceil(notes.length / pageSize));
    for (let i = 0; i < totalSub; i++) {
      activePages.push({
        section: 'notes',
        subPage: i + 1,
        totalSubPages: totalSub,
        startIdx: i * pageSize,
        endIdx: (i + 1) * pageSize,
      });
    }
  }

  if (activePages.length === 0) {
    activePages.push({ section: 'attendance', subPage: 1, totalSubPages: 1, startIdx: 0, endIdx: 35 });
  }

  // Paginated Extra TIK pages memo
  const extraTikPages = React.useMemo(() => {
    const isLandscape = orientation === 'landscape';
    const page1Size = isLandscape ? 15 : 22;
    const pageOtherSize = isLandscape ? 24 : 32;

    const data = filteredExtraTikReportData;
    if (data.length === 0) {
      return [{ pageNum: 1, items: [] }];
    }

    const pagesList: { pageNum: number; items: typeof data }[] = [];
    let remaining = [...data];
    let pNum = 1;

    while (remaining.length > 0) {
      const limit = pNum === 1 ? page1Size : pageOtherSize;
      const slice = remaining.slice(0, limit);
      pagesList.push({ pageNum: pNum, items: slice });
      remaining = remaining.slice(limit);
      pNum++;
    }
    return pagesList;
  }, [filteredExtraTikReportData, orientation]);

  // Calculate total pages based on report type
  const totalPages = reportType === 'collective' 
    ? activePages.length 
    : reportType === 'journal'
    ? Math.max(1, Math.ceil(classJournals.length / 15))
    : reportType === 'extra_tik'
    ? extraTikPages.length
    : studentsToRender.length;

  // Safe current page number (1-based index)
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));

  // Reset page to 1 whenever any configuration or target student changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [reportType, selectedStudentNis, includeAttendance, includeGrades, includeNotes, activeClassName]);

  // Helper for automated Paraf signature cells in journal rows
  const renderParafCell = (teacherNameStr: string) => {
    if (parafMode === 'digital') {
      const initials = teacherNameStr
        .replace(/^(Drs\.|Dra\.|Mr\.|Mrs\.|Ms\.|S\.Pd\.|M\.Pd\.|M\.Si\.|S\.Kom\.)\s*/gi, '')
        .trim().split(/\s+/).map(w => w[0]).join('').substring(0, 3).toUpperCase() || 'TTD';
      const firstName = teacherNameStr
        .replace(/^(Drs\.|Dra\.|Mr\.|Mrs\.|Ms\.|S\.Pd\.|M\.Pd\.|M\.Si\.|S\.Kom\.)\s*/gi, '')
        .trim().split(' ')[0] || 'Paraf';
      return (
        <div className="flex flex-col items-center justify-center py-0.5 select-none">
          <div className="font-serif italic font-black text-indigo-950 text-[13px] tracking-tighter leading-none transform -rotate-6 border-b border-indigo-900/30 px-1">
            {firstName}
          </div>
          <div className="text-[6.5px] font-mono font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded mt-0.5 border border-emerald-300 shadow-2xs">
            ✓ {initials}
          </div>
        </div>
      );
    }
    if (parafMode === 'custom_image' && customParafImg) {
      return (
        <div className="w-10 h-7 mx-auto flex items-center justify-center overflow-hidden">
          <img src={customParafImg} alt="Paraf" className="max-w-full max-h-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
        </div>
      );
    }
    if (parafMode === 'stamp') {
      return (
        <div className="inline-flex flex-col items-center justify-center px-1 py-0.5 rounded border border-emerald-600 bg-emerald-50/60 text-emerald-900 shadow-2xs">
          <span className="text-[7px] font-black uppercase tracking-wider leading-none">VALID ✓</span>
          <span className="text-[5.5px] font-mono font-bold text-slate-600 mt-0.5 leading-none">Guru Mapel</span>
        </div>
      );
    }
    // Default manual
    return (
      <div className="w-8 h-8 mx-auto border border-dashed border-slate-300 rounded flex items-center justify-center text-[7px] text-slate-300">
        Paraf
      </div>
    );
  };

  // Helper for automated bottom report signatures
  const renderBottomSignature = (nameStr: string, isTeacher: boolean) => {
    if (isTeacher && parafMode !== 'manual') {
      return (
        <div className="h-14 w-full flex items-center justify-center my-0.5">
          {parafMode === 'digital' && (
            <div className="flex flex-col items-center select-none transform -rotate-2">
              <span className="font-serif italic font-black text-indigo-950 text-xl tracking-tighter border-b-2 border-indigo-900/40 px-3 pb-0.5">
                {nameStr.replace(/^(Drs\.|Dra\.|Mr\.|Mrs\.|Ms\.|S\.Pd\.|M\.Pd\.|M\.Si\.|S\.Kom\.)\s*/gi, '').trim().split(' ')[0] || 'TTD'}
              </span>
              <span className="text-[7.5px] font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 mt-0.5 shadow-2xs">
                ✓ DIGITALLY SIGNED & VERIFIED
              </span>
            </div>
          )}
          {parafMode === 'custom_image' && customParafImg && (
            <img src={customParafImg} alt="Tanda Tangan" className="max-h-14 max-w-[130px] object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
          )}
          {parafMode === 'stamp' && (
            <div className="border-2 border-emerald-600 bg-emerald-50/70 text-emerald-900 px-3 py-1 rounded-lg text-center transform -rotate-2 shadow-xs">
              <div className="text-[9px] font-black tracking-widest uppercase">TERVERIFIKASI ✓</div>
              <div className="text-[7px] font-mono text-slate-600">Dokumen Sah Guru Mapel</div>
            </div>
          )}
          {(parafMode === 'custom_image' && !customParafImg) && (
            <div className="h-14"></div>
          )}
        </div>
      );
    }
    return <div className="mt-14 w-full"></div>;
  };

  // Helper to render a specific section of the collective report
  const renderCollectiveSection = (section: string, pageNum: number, maxPages: number, pageItem?: CollectivePageMeta) => {
    return (
      <>
        <div>
          {/* Official School Header - Kop Surat */}
          <RenderKopSurat
            logoKiri={logoKiri}
            logoKanan={logoKanan}
            govName={govName}
            deptName={deptName}
            schoolName={schoolName}
            schoolAddress={schoolAddress}
            schoolPhone={schoolPhone}
          />

          {/* Document Title */}
          <div className="my-3 text-center space-y-1">
            <h3 className="text-[13px] font-black tracking-wider uppercase text-slate-900 leading-tight">
              LAPORAN PERKEMBANGAN BELAJAR DAN ABSENSI KOLEKTIF
            </h3>
            <p className="text-[9.5px] font-bold text-slate-600 uppercase">
              KELAS: {activeClassName} | SEMESTER: {semester} | TAHUN AJARAN: {academicYear}
            </p>
          </div>

          {/* Tables and Info */}
          <div className="space-y-4 text-[10px]">
            {section === 'attendance' && (includeAttendance || (!includeAttendance && !includeGrades && !includeNotes)) && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  I. REKAPITULASI PRESENSI / KEHADIRAN SISWA
                </span>
                <table className="w-full border-collapse border border-slate-200 shadow-2xs">
                  <thead>
                    <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                      <th className="border border-slate-200 px-1 py-2 text-center w-8 text-[9px]">No</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-16 text-[9px]">NIS</th>
                      <th className="border border-slate-200 px-2.5 py-2 text-left text-[9px]">Nama Lengkap Murid</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-10 text-[9px]">L/P</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Hadir</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Sakit</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Izin</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Alfa</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-12 text-[9px]">Terlambat</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-14 text-[9px]">Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.slice(pageItem?.startIdx ?? 0, pageItem?.endIdx ?? 35).map((r, index) => (
                      <tr key={r.nis} className="hover:bg-slate-50 border-b border-slate-150 text-slate-800">
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono text-slate-500">{(pageItem?.startIdx ?? 0) + index + 1}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-700 font-semibold">{r.nis}</td>
                        <td className="border border-slate-200 px-2.5 py-1 font-bold text-slate-900 truncate max-w-[190px]">{r.nama}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center text-slate-600">{r.jenisKelamin || '-'}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">{r.hadir}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono font-bold text-blue-700 bg-blue-50/20">{r.sakit}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono font-bold text-amber-700 bg-amber-50/20">{r.izin}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono font-bold text-rose-700 bg-rose-50/30">{r.alfa}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono text-slate-500">{r.terlambatCount}x</td>
                        <td className={`border border-slate-200 px-1.5 py-1 text-center font-mono font-extrabold ${getThemeClasses('text')} bg-slate-50/40`}>
                          {(!isNaN(r.persentaseKehadiran) ? (r.persentaseKehadiran * 100) : 0).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {section === 'grades' && includeGrades && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  II. TRANSKRIP NILAI AKADEMIK SISWA (RATA-RATA FORMATIF & SUMATIF)
                </span>
                <table className="w-full border-collapse border border-slate-200 shadow-2xs">
                  <thead>
                    <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                      <th className="border border-slate-200 px-1 py-2 text-center w-8 text-[9px]">No</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-16 text-[9px]">NIS</th>
                      <th className="border border-slate-200 px-2.5 py-2 text-left text-[9px]">Nama Lengkap Murid</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-14 text-[9px]">Formatif (F)</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-14 text-[9px]">Sumatif (S)</th>
                      <th className="border border-slate-200 px-2 py-2 text-center w-16 text-[9px]">Nilai Akhir</th>
                      <th className="border border-slate-200 px-2.5 py-2 text-left text-[9px]">Predikat Kelulusan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(pageItem?.startIdx ?? 0, pageItem?.endIdx ?? 35).map((s, index) => {
                      const f = formativeGrades.find(g => g.nis === s.nis);
                      const sum = summativeGrades.find(g => g.nis === s.nis);
                      const currentKktp = gradeWeights?.kktp ?? KKTP_STANDARD;
                      
                      const fAvg = f 
                        ? (f.rataRata !== null && !isNaN(f.rataRata) && f.rataRata > 0 
                            ? f.rataRata 
                            : calculateAvg(formativeCols.map(c => getEffectiveColumnScore(f, c.key, currentKktp))))
                        : 0;
                        
                      const sumAvg = sum
                        ? (sum.rataRata !== null && !isNaN(sum.rataRata) && sum.rataRata > 0 
                            ? sum.rataRata 
                            : calculateAvg(summativeCols.map(c => getEffectiveColumnScore(sum, c.key, currentKktp))))
                        : 0;

                      const finalGrade = parseFloat(((fAvg + sumAvg) / 2).toFixed(1));

                      const getGradeMeta = (g: number) => {
                        if (g >= 85) return { name: 'SANGAT BAIK (A)', style: 'text-emerald-700 font-black' };
                        if (g >= 75) return { name: 'BAIK (B)', style: 'text-indigo-700 font-bold' };
                        if (g >= 65) return { name: 'CUKUP (C)', style: 'text-amber-700 font-medium' };
                        return { name: 'PERLU BIMBINGAN (D)', style: 'text-rose-600 font-bold' };
                      };

                      const gradeMeta = getGradeMeta(finalGrade);

                      return (
                        <tr key={s.nis} className="hover:bg-slate-50 border-b border-slate-150 text-slate-800">
                          <td className="border border-slate-200 px-1 py-1 text-center font-mono text-slate-500">{(pageItem?.startIdx ?? 0) + index + 1}</td>
                          <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-700 font-semibold">{s.nis}</td>
                          <td className="border border-slate-200 px-2.5 py-1 font-bold text-slate-900 truncate max-w-[190px]">{s.nama}</td>
                          <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-800">{fAvg > 0 ? fAvg : '-'}</td>
                          <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-800">{sumAvg > 0 ? sumAvg : '-'}</td>
                          <td className={`border border-slate-200 px-2 py-1 text-center font-mono font-extrabold ${getThemeClasses('text')} bg-slate-50/40`}>{finalGrade > 0 ? finalGrade : '-'}</td>
                          <td className={`border border-slate-200 px-2.5 py-1 ${gradeMeta.style} text-[9px]`}>
                            {finalGrade > 0 ? gradeMeta.name : 'Belum Berpartisipasi'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {section === 'notes' && includeNotes && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  III. JURNAL INSIDENSIAL & CATATAN PERILAKU SISWA
                </span>
                {notes.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[9px] italic">
                    Tidak ada catatan perilaku atau insidensi siswa yang dilaporkan untuk kelas ini.
                  </div>
                ) : (
                  <table className="w-full border-collapse border border-slate-200 text-[9px] shadow-2xs">
                    <thead>
                      <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                        <th className="border border-slate-200 px-1.5 py-2 text-left w-20">Tanggal</th>
                        <th className="border border-slate-200 px-1.5 py-2 text-left w-28">Nama Murid</th>
                        <th className="border border-slate-200 px-1.5 py-2 text-center w-16">Tipe Perilaku</th>
                        <th className="border border-slate-200 px-2.5 py-2 text-left">Catatan Observasi Guru</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notes.slice(pageItem?.startIdx ?? 0, pageItem?.endIdx ?? 25).map((n) => (
                        <tr key={n.id} className="border-b border-slate-150 text-slate-800 hover:bg-slate-50/50">
                          <td className="border border-slate-200 px-1.5 py-1.5 font-mono text-slate-500">{n.tanggal}</td>
                          <td className="border border-slate-200 px-1.5 py-1.5 font-bold text-slate-900">{n.nama}</td>
                          <td className="border border-slate-200 px-1.5 py-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                              n.tipe === 'aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {n.tipe}
                            </span>
                          </td>
                          <td className="border border-slate-200 px-2.5 py-1.5 text-slate-600 leading-normal italic">{n.catatan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {notes.length > (pageItem?.endIdx ?? 25) && (
                  <p className="text-[8px] text-right text-slate-400 font-medium italic pt-0.5">
                    * Menampilkan catatan {(pageItem?.startIdx ?? 0) + 1} - {Math.min(notes.length, pageItem?.endIdx ?? 25)} dari {notes.length} total catatan (silakan lihat halaman berikutnya).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signatures section at bottom - hanya tampil 1x pada halaman terakhir dari setiap bagian data (absen, nilai, catatan) */}
        {(!pageItem || pageItem.subPage === pageItem.totalSubPages) && (
          <DynamicReportSignatures cols={2}>
            <div className="flex flex-col justify-between items-center text-center">
              <div className="space-y-1 w-full min-h-[36px] flex flex-col justify-end">
                <p className="font-bold uppercase tracking-wider text-slate-600">Mengetahui,</p>
                <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Kepala {schoolName}</p>
              </div>
              <div className="w-full">
                {renderBottomSignature(headmasterName, false)}
                <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[70mm] mx-auto">{headmasterName || 'Kepala Sekolah'}</p>
                <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{headmasterNip ? `${headmasterNip}` : '-'}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between items-center text-center">
              <div className="space-y-1 w-full min-h-[36px] flex flex-col justify-end">
                <p className="text-slate-700 font-medium">{cityName || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Guru Mata Pelajaran {teacherSubject || activeClassName}</p>
              </div>
              <div className="w-full">
                {renderBottomSignature(teacherName, true)}
                <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[70mm] mx-auto">{teacherName || 'Guru Mata Pelajaran'}</p>
                <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{teacherNip ? `${teacherNip}` : '-'}</p>
              </div>
            </div>
          </DynamicReportSignatures>
        )}
      </>
    );
  };

  // Helper to render an individual student report
  const renderIndividualStudentReport = (s: Student) => {
    const sRecap = recap.find(r => r.nis === s.nis);
    const sNotes = notes.filter(n => n.nis === s.nis);
    const f = formativeGrades.find(g => g.nis === s.nis);
    const sum = summativeGrades.find(g => g.nis === s.nis);
    const att = (attitudeGrades || []).find(g => g.nis === s.nis);
    const weights = gradeWeights || DEFAULT_GRADE_WEIGHTS;

    const breakdown = calculateStudentGradeBreakdown(
      s,
      f,
      sum,
      formativeCols,
      summativeCols,
      weights,
      att,
      notes,
      recap,
      attendance
    );

    const w = breakdown.weights;

    return (
      <>
        <div>
          {/* Official School Header - Kop Surat */}
          <RenderKopSurat
            logoKiri={logoKiri}
            logoKanan={logoKanan}
            govName={govName}
            deptName={deptName}
            schoolName={schoolName}
            schoolAddress={schoolAddress}
            schoolPhone={schoolPhone}
          />

          {/* Document Title */}
          <div className="my-4 text-center">
            <h3 className="text-[12px] font-black tracking-widest uppercase text-slate-950">
              KARTU HASIL BELAJAR & ABSENSI SISWA (KHB)
            </h3>
            <div className="w-24 h-[1.5px] mx-auto bg-slate-800 mt-1" />
          </div>

          {/* Student Identity Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-slate-200 bg-slate-50/30 p-3.5 rounded-xl text-[10px] mb-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Nama Lengkap</span>
              <span className="font-black text-slate-950 text-right">{s.nama}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Kelas / Roster</span>
              <span className="font-extrabold text-slate-900 text-right">{activeClassName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">No. Induk (NIS)</span>
              <span className="font-mono font-black text-slate-950 text-right">{s.nis}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Semester</span>
              <span className="font-bold text-slate-900 text-right">{semester}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Jenis Kelamin</span>
              <span className="font-bold text-slate-900 text-right">{s.jenisKelamin === 'L' ? 'Laki-laki (L)' : s.jenisKelamin === 'P' ? 'Perempuan (P)' : '-'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Tahun Ajaran</span>
              <span className="font-mono font-bold text-slate-900 text-right">{academicYear}</span>
            </div>
          </div>

          {/* Detailed Student Performance Data */}
          <div className="space-y-4 text-[10px]">
            {/* Attendance Section */}
            {includeAttendance && sRecap && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  {(() => {
                    let idx = 1;
                    return `${idx === 1 ? 'I' : 'II'}. REKAPITULASI PRESENSI / KEHADIRAN INDIVIDUAL`;
                  })()}
                </span>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <span className="block text-[8px] text-emerald-700 font-bold uppercase tracking-wider">Hadir</span>
                    <span className="text-lg font-black text-emerald-700 font-mono leading-none block my-1">{sRecap.hadir}</span>
                    <span className="text-[8px] text-emerald-600 block">Hari</span>
                  </div>
                  <div className="text-center p-2 bg-cyan-50/50 rounded-xl border border-cyan-100">
                    <span className="block text-[8px] text-cyan-700 font-bold uppercase tracking-wider">Sakit</span>
                    <span className="text-lg font-black text-cyan-600 font-mono leading-none block my-1">{sRecap.sakit}</span>
                    <span className="text-[8px] text-cyan-600 block">Hari</span>
                  </div>
                  <div className="text-center p-2 bg-amber-50/50 rounded-xl border border-amber-100">
                    <span className="block text-[8px] text-amber-700 font-bold uppercase tracking-wider">Izin</span>
                    <span className="text-lg font-black text-amber-600 font-mono leading-none block my-1">{sRecap.izin}</span>
                    <span className="text-[8px] text-amber-600 block">Hari</span>
                  </div>
                  <div className="text-center p-2 bg-rose-50/50 rounded-xl border border-rose-100">
                    <span className="block text-[8px] text-rose-700 font-bold uppercase tracking-wider">Alfa</span>
                    <span className="text-lg font-black text-rose-600 font-mono leading-none block my-1">{sRecap.alfa}</span>
                    <span className="text-[8px] text-rose-600 block">Hari</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px] bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100">
                  <span className="font-bold text-slate-700 font-medium">Persentase Tingkat Kehadiran Kumulatif:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-black font-mono text-sm ${getThemeClasses('text')}`}>{(!isNaN(sRecap.persentaseKehadiran) ? (sRecap.persentaseKehadiran * 100) : 0).toFixed(0)}%</span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${
                      (sRecap.hadir + sRecap.sakit + sRecap.izin + sRecap.alfa) === 0
                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                        : sRecap.persentaseKehadiran >= 0.95 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : sRecap.persentaseKehadiran >= 0.85 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {(sRecap.hadir + sRecap.sakit + sRecap.izin + sRecap.alfa) === 0 ? 'BELUM ADA DATA' : sRecap.persentaseKehadiran >= 0.95 ? 'SANGAT MEMUASKAN' : sRecap.persentaseKehadiran >= 0.85 ? 'CUKUP' : 'PERINGATAN ABSEN'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Grades section - Nilai Akhir */}
            {includeGrades && (
              <div className="space-y-2">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  {(() => {
                    let num = 1;
                    if (includeAttendance) num++;
                    const rom = num === 1 ? 'I' : num === 2 ? 'II' : 'III';
                    return `${rom}. CAPAIAN NILAI AKADEMIK & KOMPETENSI (NILAI AKHIR)`;
                  })()}
                </span>
                
                <div className="space-y-2">
                  <table className="w-full table-fixed border-collapse border border-slate-200 shadow-2xs">
                    <thead>
                      <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                        <th className="border border-slate-200 px-1.5 py-1.5 text-center text-[8px] w-8">No</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-left text-[8.5px]">Komponen Penilaian</th>
                        <th className="border border-slate-200 px-1 py-1.5 text-center text-[8.5px] w-14">Bobot</th>
                        <th className="border border-slate-200 px-1.5 py-1.5 text-center text-[8.5px] w-20">Nilai Murni</th>
                        <th className="border border-slate-200 px-1.5 py-1.5 text-center text-[8.5px] w-20 bg-indigo-50/50">Nilai Terbobot</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-left text-[8px] w-36">Keterangan Capaian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[8.5px]">
                      <tr className="hover:bg-slate-50/50">
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-bold text-slate-600">1</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">
                          Penilaian Formatif (Tugas / Latihan Harian / Kuis)
                        </td>
                        <td className="border border-slate-200 px-1 py-1.5 text-center font-mono font-bold text-slate-700">{w.formatif}%</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-bold text-slate-800">{breakdown.formatifAvg > 0 ? breakdown.formatifAvg : '-'}</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-black text-indigo-700 bg-indigo-50/30">{breakdown.formatifWeighted > 0 ? breakdown.formatifWeighted : '-'}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 text-[8px]">Capaian tugas & kuis harian</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-bold text-slate-600">2</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">
                          Penilaian Sumatif (Lingkup Materi / STS)
                        </td>
                        <td className="border border-slate-200 px-1 py-1.5 text-center font-mono font-bold text-slate-700">{w.sumatif}%</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-bold text-slate-800">{breakdown.sumatifAvg > 0 ? breakdown.sumatifAvg : '-'}</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-black text-indigo-700 bg-indigo-50/30">{breakdown.sumatifWeighted > 0 ? breakdown.sumatifWeighted : '-'}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 text-[8px]">Pemahaman materi pokok</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-bold text-slate-600">3</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">
                          Ujian Akhir Semester (UAS / SAS)
                        </td>
                        <td className="border border-slate-200 px-1 py-1.5 text-center font-mono font-bold text-slate-700">{w.uas}%</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-bold text-slate-800">{breakdown.uasScore > 0 ? breakdown.uasScore : '-'}</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-black text-indigo-700 bg-indigo-50/30">{breakdown.uasWeighted > 0 ? breakdown.uasWeighted : '-'}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 text-[8px]">Evaluasi capaian akhir semester</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-bold text-slate-600">4</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">
                          Penilaian Sikap & Karakter (Observasi & Perilaku)
                        </td>
                        <td className="border border-slate-200 px-1 py-1.5 text-center font-mono font-bold text-slate-700">{w.sikap}%</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-bold text-slate-800">{breakdown.sikapScore > 0 ? breakdown.sikapScore : '-'}</td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-center font-mono font-black text-indigo-700 bg-indigo-50/30">{breakdown.sikapWeighted > 0 ? breakdown.sikapWeighted : '-'}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 text-[8px]">Budi pekerti & kedisiplinan</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Performance summary card */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-2 mt-2">
                  <div className="flex items-center gap-3">
                    <div className={`${getThemeClasses('headerBg')} p-2 rounded-lg`}>
                      <Award className={`w-5 h-5 ${getThemeClasses('text')}`} />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400 font-bold uppercase leading-tight tracking-wide">Nilai Akhir (Formatif, Sumatif, UAS, Sikap)</span>
                      <span className={`text-xl font-black ${getThemeClasses('text')} font-mono leading-none`}>
                        {breakdown.nilaiAkhir > 0 ? breakdown.nilaiAkhir : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase leading-tight tracking-wide">
                      Predikat & Status Kelulusan: <span className="font-extrabold text-slate-700 uppercase">{breakdown.status}</span>
                    </span>
                    <span className={`text-[10px] font-black tracking-wide block mt-0.5 ${
                      breakdown.nilaiAkhir >= 85 ? 'text-emerald-700' : breakdown.nilaiAkhir >= 75 ? 'text-indigo-700' : breakdown.nilaiAkhir >= 65 ? 'text-amber-700' : 'text-rose-600'
                    }`}>
                      {breakdown.predikatLengkap}
                    </span>
                  </div>
                </div>

                {/* Deskripsi Capaian Kompetensi */}
                <div className="p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-xl text-[9px] text-slate-700 flex items-start gap-2">
                  <span className="font-black text-slate-800 shrink-0 uppercase tracking-wide text-[8.5px]">Capaian:</span>
                  <p className="leading-relaxed text-slate-600">{breakdown.deskripsiKompetensi}</p>
                </div>
              </div>
            )}

            {/* Behavior Journal Notes */}
            {includeNotes && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  {(() => {
                    let num = 1;
                    if (includeAttendance) num++;
                    if (includeGrades) num++;
                    const rom = num === 1 ? 'I' : num === 2 ? 'II' : 'III';
                    return `${rom}. CATATAN PERILAKU DAN CATATAN SIKAP DARI GURU MATA PELAJARAN`;
                  })()}
                </span>
                {sNotes.length === 0 ? (
                  <div className="text-left py-2.5 px-3.5 bg-slate-50/40 rounded-xl border border-dashed border-slate-200 text-slate-500 italic text-[9px] leading-relaxed">
                    Murid yang bersangkutan selalu menunjukkan perilaku teladan, budi pekerti yang luhur, sopan santun yang tinggi, serta tingkat kepatuhan dan kerja sama yang sangat baik dalam seluruh aktivitas kelas sepanjang periode semester berjalan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sNotes.map(n => (
                      <div key={n.id} className="border border-slate-150 bg-slate-50/30 p-2.5 rounded-xl flex items-start gap-2.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${
                          n.tipe === 'aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {n.tipe}
                        </span>
                        <div className="space-y-0.5 text-left flex-1">
                          <p className="font-mono text-[8px] text-slate-400 font-bold">{n.tanggal} | Pembelajaran: {stripClockFromJamString(n.jamPembelajaran)}</p>
                          <p className="text-slate-700 leading-normal italic text-[9.5px]">"{n.catatan}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signatures section at bottom - Mode Portrait 3 Tanda Tangan Berjejer (1 Baris) */}
        <DynamicReportSignatures cols={3}>
          {/* 1. Orang Tua / Wali */}
          <div className="flex flex-col justify-between items-center text-center w-full">
            <div className="space-y-1 w-full min-h-[32px] flex flex-col justify-end">
              <p className="font-bold uppercase tracking-wider text-slate-600">Mengetahui,</p>
              <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Orang Tua / Wali Murid</p>
            </div>
            <div className="mt-12 w-full">
              <p className="font-bold text-slate-900 whitespace-nowrap">( ............................ )</p>
              <p className="text-[8.5px] text-transparent font-mono font-bold leading-none mt-1.5">-</p>
            </div>
          </div>

          {/* 2. Guru Mata Pelajaran / Wali Kelas */}
          <div className="flex flex-col justify-between items-center text-center w-full">
            <div className="space-y-1 w-full min-h-[32px] flex flex-col justify-end">
              <p className="font-bold uppercase tracking-wider text-slate-600">Mengetahui,</p>
              <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Guru / Wali Kelas</p>
            </div>
            <div className="w-full">
              {renderBottomSignature(teacherName, true)}
              <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[48mm] mx-auto">{teacherName || 'Guru Mata Pelajaran'}</p>
              <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{teacherNip ? `${teacherNip}` : '-'}</p>
            </div>
          </div>

          {/* 3. Kepala Sekolah */}
          <div className="flex flex-col justify-between items-center text-center w-full">
            <div className="space-y-1 w-full min-h-[32px] flex flex-col justify-end">
              <p className="text-slate-700 font-medium">{cityName || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Kepala {schoolName}</p>
            </div>
            <div className="w-full">
              {renderBottomSignature(headmasterName, false)}
              <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[48mm] mx-auto">{headmasterName || 'Kepala Sekolah'}</p>
              <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{headmasterNip ? `${headmasterNip}` : '-'}</p>
            </div>
          </div>
        </DynamicReportSignatures>
      </>
    );
  };

  // Helper to render daily teaching journals
  const renderJournalReport = (pageNum: number, maxPages: number) => {
    const startIndex = (pageNum - 1) * 15;
    const pageJournals = classJournals.slice(startIndex, startIndex + 15);

    return (
      <>
        <div>
          {/* Official School Header - Kop Surat */}
          <RenderKopSurat
            logoKiri={logoKiri}
            logoKanan={logoKanan}
            govName={govName}
            deptName={deptName}
            schoolName={schoolName}
            schoolAddress={schoolAddress}
            schoolPhone={schoolPhone}
          />

          {/* Document Title */}
          <div className="my-3 text-center space-y-1">
            <h3 className="text-[13px] font-black tracking-wider uppercase text-slate-900 leading-tight">
              LAPORAN JURNAL KEGIATAN PEMBELAJARAN DAN ABSENSI HARIAN
            </h3>
            <p className="text-[9.5px] font-bold text-slate-600 uppercase">
              KELAS: {activeClassName} | SEMESTER: {semester} | TAHUN AJARAN: {academicYear} | HALAMAN: {pageNum} / {maxPages}
            </p>
          </div>

          {/* Journal Table */}
          <div className="space-y-1.5 text-[10px]">
            <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
              REKAPITULASI CATATAN MENGAJAR GURU
            </span>
            <table className="w-full border-collapse border border-slate-200 shadow-2xs">
              <thead>
                <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                  <th className="border border-slate-200 px-1 py-2 text-center w-8 text-[9px]">No</th>
                  <th className="border border-slate-200 px-1.5 py-2 text-left w-24 text-[9px]">Hari, Tanggal</th>
                  <th className="border border-slate-200 px-1 py-2 text-center w-14 text-[9px]">Jam Ke-</th>
                  <th className="border border-slate-200 px-2 py-2 text-left text-[9px]">Materi & Tugas Pembelajaran</th>
                  <th className="border border-slate-200 px-1.5 py-2 text-left w-28 text-[9px]">Siswa Tidak Hadir</th>
                  <th className="border border-slate-200 px-2 py-2 text-left w-36 text-[9px]">Catatan / Kendala / Prestasi</th>
                  <th className="border border-slate-200 px-1 py-2 text-center w-14 text-[9px]">Paraf</th>
                </tr>
              </thead>
              <tbody>
                {pageJournals.length > 0 ? (
                  pageJournals.map((j, idx) => {
                    const formattedDate = new Date(j.tanggal).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    });
                    const jamStr = j.jamPelajaran.join(', ');
                    const absentList = j.tidakHadirSnapshot && j.tidakHadirSnapshot.length > 0
                      ? j.tidakHadirSnapshot.map(s => `${s.nama} (${s.status})`).join(', ')
                      : 'Nihil / Hadir Semua';
                    const notesList = j.catatanSiswaSnapshot && j.catatanSiswaSnapshot.length > 0
                      ? j.catatanSiswaSnapshot
                      : null;

                    return (
                      <tr key={j.id} className="border-b border-slate-150 text-slate-800 hover:bg-slate-50/50 align-top">
                        <td className="border border-slate-200 px-1 py-2 text-center font-bold text-slate-500">
                          {startIndex + idx + 1}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-2 font-bold text-slate-900 leading-tight">
                          {formattedDate}
                        </td>
                        <td className="border border-slate-200 px-1 py-2 text-center font-mono font-extrabold text-indigo-700">
                          {jamStr}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 leading-normal">
                          <div className="font-semibold text-slate-900">{j.materi || '-'}</div>
                          {j.adaTugas && j.deskripsiTugas && (
                            <div className="mt-1 pt-1 border-t border-slate-100 text-[8.5px] text-indigo-700 font-bold">
                              📌 PR/Tugas: {j.deskripsiTugas}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-1.5 leading-tight">
                          {j.tidakHadirSnapshot && j.tidakHadirSnapshot.length > 0 ? (
                            <div className="flex flex-col gap-1 py-0.5">
                              {j.tidakHadirSnapshot.map((s, sidx) => {
                                const st = String(s.status || 'Alfa');
                                const isAlfa = st === 'Alfa' || st.toLowerCase().includes('alfa') || st.toLowerCase().includes('alpa') || st === 'A';
                                const isIzin = st === 'Izin' || st.toLowerCase().includes('izin') || st === 'I';
                                const isSakit = st === 'Sakit' || st.toLowerCase().includes('sakit') || st === 'S';
                                return (
                                  <span
                                    key={sidx}
                                    className={`inline-flex items-center justify-center px-2 py-0.5 rounded border text-[8.5px] font-extrabold shadow-2xs leading-snug break-words ${
                                      isAlfa
                                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                                        : isIzin
                                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                                        : isSakit
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    [{st[0]}] {s.nama}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[8.5px] leading-snug">
                              ✓ Nihil / Semua Hadir
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 leading-normal text-[9px]">
                          <div className="italic text-slate-700">{j.catatan || '-'}</div>
                          {j.hambatan && (
                            <div className="text-amber-800 font-medium mt-0.5">
                              ⚠️ Hambatan: {j.hambatan}
                              {j.solusi ? ` (Solusi: ${j.solusi})` : ''}
                            </div>
                          )}
                          {notesList && (
                            <div className="mt-1 pt-1 border-t border-slate-100 space-y-0.5">
                              {notesList.map((sn, sidx) => (
                                <div key={sidx} className={`p-1 rounded text-[8px] border font-medium leading-tight ${
                                  sn.tipe === 'bermasalah' ? 'bg-rose-50/80 border-rose-100 text-rose-800' : 'bg-emerald-50/80 border-emerald-100 text-emerald-800'
                                }`}>
                                  <span className="font-extrabold">{sn.nama}:</span> "{sn.catatan}"
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-200 px-1 py-1.5 text-center align-middle">
                          {renderParafCell(teacherName)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="border border-slate-200 py-8 text-center text-slate-400 italic">
                      Belum ada data jurnal harian mengajar untuk kelas {activeClassName} ini. Silakan input jurnal di menu Jurnal Harian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures section at bottom - hanya tampil 1x pada halaman terakhir laporan jurnal */}
        {(pageNum === maxPages) && (
          <DynamicReportSignatures cols={2}>
            <div className="flex flex-col justify-between items-center text-center">
              <div className="space-y-1 w-full min-h-[36px] flex flex-col justify-end">
                <p className="font-bold uppercase tracking-wider text-slate-600">Mengetahui,</p>
                <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Kepala {schoolName}</p>
              </div>
              <div className="w-full">
                {renderBottomSignature(headmasterName, false)}
                <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[70mm] mx-auto">{headmasterName || 'Kepala Sekolah'}</p>
                <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{headmasterNip ? `${headmasterNip}` : '-'}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between items-center text-center">
              <div className="space-y-1 w-full min-h-[36px] flex flex-col justify-end">
                <p className="text-slate-700 font-medium">{cityName || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Guru Mata Pelajaran {teacherSubject || activeClassName}</p>
              </div>
              <div className="w-full">
                {renderBottomSignature(teacherName, true)}
                <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[70mm] mx-auto">{teacherName || 'Guru Mata Pelajaran'}</p>
                <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{teacherNip ? `${teacherNip}` : '-'}</p>
              </div>
            </div>
          </DynamicReportSignatures>
        )}
      </>
    );
  };

  const renderExtraTikReport = (pageNum: number, maxPages: number) => {
    const currentSlice = extraTikPages[pageNum - 1] || { pageNum, items: [] };
    const pageItems = currentSlice.items;

    // Calculate row start number
    let startIdx = 0;
    for (let p = 0; p < pageNum - 1; p++) {
      startIdx += (extraTikPages[p]?.items.length || 0);
    }

    const totalPeserta = filteredExtraTikReportData.length;
    const totalAktif = filteredExtraTikReportData.filter(p => p.status === 'Aktif').length;
    const avgNilaiList = filteredExtraTikReportData.map(p => p.rataRata).filter((v): v is number => v !== null && !isNaN(v));
    const rawAvgNilaiTotal = avgNilaiList.length > 0 ? Math.round(avgNilaiList.reduce((a, b) => a + b, 0) / avgNilaiList.length) : null;
    const avgNilaiTotal = rawAvgNilaiTotal !== null && !isNaN(rawAvgNilaiTotal) ? rawAvgNilaiTotal : '-';
    
    const hadirPercents = filteredExtraTikReportData.map(p => Number(p.persentaseHadir)).filter(v => !isNaN(v));
    const rawAvgKehadiran = hadirPercents.length > 0 ? Math.round(hadirPercents.reduce((a, b) => a + b, 0) / hadirPercents.length) : 0;
    const avgKehadiran = isNaN(rawAvgKehadiran) ? 0 : rawAvgKehadiran;
    
    const tuntasCount = avgNilaiList.filter(n => n >= 75).length;
    const rawPersenTuntas = avgNilaiList.length > 0 ? Math.round((tuntasCount / avgNilaiList.length) * 100) : 0;
    const persenTuntas = isNaN(rawPersenTuntas) ? 0 : rawPersenTuntas;

    const isLandscape = orientation === 'landscape';

    return (
      <>
        <div>
          {/* Official School Header - Kop Surat */}
          <RenderKopSurat
            logoKiri={logoKiri}
            logoKanan={logoKanan}
            govName={govName}
            deptName={deptName}
            schoolName={schoolName}
            schoolAddress={schoolAddress}
            schoolPhone={schoolPhone}
          />

          {/* Title */}
          <div className="my-3 text-center space-y-1">
            <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-indigo-900 text-white text-[9px] font-extrabold uppercase tracking-wider leading-snug mb-1 text-center">
              Laporan Resmi Ekstrakurikuler
            </div>
            <h3 className="text-[13px] font-black tracking-wider uppercase text-slate-900 leading-tight">
              LAPORAN CAPAIAN & REKAPITULASI EKSTRAKURIKULER TIK
            </h3>
            <p className="text-[9.5px] font-bold text-slate-600 uppercase">
              SEMESTER: {semester} | TAHUN AJARAN: {academicYear} | STATUS: <span className="text-indigo-800">{extraTikStatusFilter}</span> | HALAMAN {pageNum} DARI {maxPages}
            </p>
          </div>

          {/* KPI Summary Cards on Page 1 */}
          {pageNum === 1 && (
            <div className={`grid ${isLandscape ? 'grid-cols-5' : 'grid-cols-3'} gap-2.5 mb-3 text-center`}>
              <div className="p-2 rounded-xl border border-indigo-200 bg-indigo-50/70 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 text-indigo-700 leading-none">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[8px] font-extrabold uppercase tracking-wider leading-none">Total Peserta</span>
                </div>
                <span className="text-xs font-black text-indigo-950 font-mono leading-none">{totalPeserta} Siswa</span>
              </div>
              <div className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/70 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 text-emerald-700 leading-none">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[8px] font-extrabold uppercase tracking-wider leading-none">Status Aktif</span>
                </div>
                <span className="text-xs font-black text-emerald-950 font-mono leading-none">{totalAktif} Siswa</span>
              </div>
              <div className="p-2 rounded-xl border border-sky-200 bg-sky-50/70 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 text-sky-700 leading-none">
                  <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[8px] font-extrabold uppercase tracking-wider leading-none">Rata2 Kehadiran</span>
                </div>
                <span className="text-xs font-black text-sky-950 font-mono leading-none">{avgKehadiran}%</span>
              </div>
              <div className="p-2 rounded-xl border border-amber-200 bg-amber-50/70 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 text-amber-700 leading-none">
                  <Award className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[8px] font-extrabold uppercase tracking-wider leading-none">Rata2 Nilai TIK</span>
                </div>
                <span className="text-xs font-black text-amber-950 font-mono leading-none">{avgNilaiTotal}</span>
              </div>
              <div className="p-2 rounded-xl border border-purple-200 bg-purple-50/70 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 text-purple-700 leading-none">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[8px] font-extrabold uppercase tracking-wider leading-none">Tingkat Capaian (≥75)</span>
                </div>
                <span className="text-xs font-black text-purple-950 font-mono leading-none">{persenTuntas}%</span>
              </div>
            </div>
          )}

          {/* Extra TIK Data Table with Exact Percentage Widths */}
          <div className="w-full text-[9px]">
            <table className="w-full border-collapse border border-slate-300 table-fixed shadow-2xs">
              <thead>
                <tr className="bg-indigo-900 text-white font-black text-[8.5px] uppercase tracking-wider border-b border-indigo-950">
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[3%]">No</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[8%]">NIS</th>
                  <th className="border border-indigo-900/40 px-2 py-1.5 text-left w-[20%]">Nama Peserta</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[6%]">Kelas</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[8%]">Status</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[12%]">Presensi (H / S / I / A)</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[7%]">% Hadir</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[6%]">Tugas</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[6%]">Praktik</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[6%]">Teori</th>
                  <th className="border border-indigo-900/40 px-1 py-1.5 text-center w-[6%]">Rata2</th>
                  <th className="border border-indigo-900/40 px-1.5 py-1.5 text-center w-[12%]">Predikat Akhir</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length > 0 ? (
                  pageItems.map((item, idx) => (
                    <tr key={item.nis} className="hover:bg-indigo-50/30 even:bg-slate-50/70 border-b border-slate-200 text-slate-800">
                      <td className="border border-slate-200 px-1 py-0.5 text-center font-mono text-slate-500 align-middle">{startIdx + idx + 1}</td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center font-mono font-bold text-slate-700 align-middle">{item.nis}</td>
                      <td className="border border-slate-200 px-2 py-0.5 font-extrabold text-slate-900 truncate align-middle">{item.nama}</td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center text-slate-700 font-semibold align-middle">{item.kelas}</td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center align-middle">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[7.5px] font-black leading-snug text-center uppercase border ${
                          item.status === 'Aktif' ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300' :
                          item.status === 'Alumni' ? 'bg-blue-100/90 text-blue-900 border-blue-300' : 'bg-rose-100/90 text-rose-900 border-rose-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center font-mono text-[8.5px] align-middle">
                        <span className="text-emerald-700 font-bold">{item.hadir}</span> / <span className="text-blue-700">{item.sakit}</span> / <span className="text-amber-700">{item.izin}</span> / <span className="text-rose-700 font-bold">{item.alfa}</span>
                      </td>
                      <td className={`border border-slate-200 px-1 py-0.5 text-center font-mono font-extrabold text-[8.5px] align-middle ${
                        item.persentaseHadir >= 80 ? 'text-emerald-800 bg-emerald-50/50' : 'text-amber-800 bg-amber-50/50'
                      }`}>
                        {item.persentaseHadir}%
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center font-mono font-bold align-middle">{item.nilaiTugas ?? '-'}</td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center font-mono font-bold align-middle">{item.nilaiPraktik ?? '-'}</td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center font-mono font-bold align-middle">{item.nilaiTeori ?? '-'}</td>
                      <td className="border border-slate-200 px-1 py-0.5 text-center font-mono font-black text-indigo-950 bg-indigo-50/60 align-middle">
                        {item.rataRata ?? '-'}
                      </td>
                      <td className="border border-slate-200 px-1.5 py-0.5 text-center font-bold text-[8px] align-middle">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[7.5px] font-bold leading-snug text-center ${
                          item.predikat.startsWith('Sangat') ? 'bg-emerald-100 text-emerald-900 font-extrabold' :
                          item.predikat.startsWith('Baik') ? 'bg-sky-100 text-sky-900' :
                          item.predikat.startsWith('Cukup') ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'
                        }`}>
                          {item.predikat}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="border border-slate-200 py-8 text-center text-slate-400 italic">
                      Belum ada data peserta Ekstrakurikuler TIK.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures at bottom of last page */}
        {pageNum === maxPages && (
          <DynamicReportSignatures cols={2}>
            <div className="flex flex-col justify-between items-center text-center">
              <div className="space-y-1 w-full min-h-[36px] flex flex-col justify-end">
                <p className="font-bold uppercase tracking-wider text-slate-600">Mengetahui,</p>
                <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Kepala {schoolName}</p>
              </div>
              <div className="w-full">
                {renderBottomSignature(headmasterName, false)}
                <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[70mm] mx-auto">{headmasterName || 'Kepala Sekolah'}</p>
                <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{headmasterNip ? `${headmasterNip}` : '-'}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between items-center text-center">
              <div className="space-y-1 w-full min-h-[36px] flex flex-col justify-end">
                <p className="text-slate-700 font-medium">{cityName || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="font-extrabold text-slate-900 leading-tight uppercase tracking-wide">Pembina / Guru Ekstrakurikuler TIK</p>
              </div>
              <div className="w-full">
                {renderBottomSignature(teacherName, true)}
                <p className="font-black underline underline-offset-[3px] decoration-slate-900 text-slate-950 truncate max-w-[70mm] mx-auto">{teacherName || 'Pembina Extra TIK'}</p>
                <p className="text-[8.5px] text-slate-600 font-mono font-bold leading-none mt-1.5 truncate mx-auto">{teacherNip ? `${teacherNip}` : '-'}</p>
              </div>
            </div>
          </DynamicReportSignatures>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-950">
              Generator Laporan Akademik & Absensi Profesional
            </h3>
            <p className="text-xs text-slate-500">
              Unduh rekapitulasi data absensi, nilai, dan catatan siswa dalam format dokumen PDF resmi berdesain elegan, nyaman dibaca, dan berstandar administrasi sekolah nasional.
            </p>
          </div>
        </div>

        {/* Configuration Tabs and Options */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Options sidebar controls */}
          <div className="lg:col-span-5 space-y-5 border-r border-slate-100 pr-0 lg:pr-6">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Settings className="w-4 h-4 text-indigo-500" />
              1. Pengaturan Dokumen
            </h4>

            {/* Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Jenis Laporan
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportType('collective');
                    setSelectedStudentNis('all');
                    setOrientation('landscape');
                  }}
                  className={`py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer text-center ${
                    reportType === 'collective'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  Kolektif
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportType('individual');
                    setOrientation('portrait');
                  }}
                  className={`py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer text-center ${
                    reportType === 'individual'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  Rapor Siswa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportType('journal');
                    setOrientation('portrait');
                  }}
                  className={`py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer text-center ${
                    reportType === 'journal'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  Jurnal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportType('extra_tik');
                    setOrientation('landscape');
                  }}
                  className={`py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer text-center ${
                    reportType === 'extra_tik'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  Extra TIK
                </button>
              </div>
            </div>

            {/* Page Orientation Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Orientasi Cetak (Layout)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5 rotate-90" />
                  Landscape (Mendatar)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  Portrait (Tegak)
                </button>
              </div>
            </div>

            {/* Individual Student Filter if individual type chosen */}
            {reportType === 'individual' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Siswa Sasaran
                </label>
                <select
                  value={selectedStudentNis}
                  onChange={(e) => setSelectedStudentNis(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Siswa Kelas ({students.length} Halaman)</option>
                  {students.map(s => (
                    <option key={s.nis} value={s.nis}>{s.nis} - {s.nama}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Extra TIK Filter if extra_tik type chosen */}
            {reportType === 'extra_tik' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Filter Status Peserta TIK
                </label>
                <select
                  value={extraTikStatusFilter}
                  onChange={(e) => setExtraTikStatusFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Semua">Semua Status Peserta ({extraTikReportData.length} Siswa)</option>
                  <option value="Aktif">Aktif Saja ({extraTikReportData.filter(p => p.status === 'Aktif').length} Siswa)</option>
                  <option value="Alumni">Alumni ({extraTikReportData.filter(p => p.status === 'Alumni').length} Siswa)</option>
                  <option value="Keluar">Keluar ({extraTikReportData.filter(p => p.status === 'Keluar').length} Siswa)</option>
                </select>

                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-150 text-indigo-900 space-y-1.5 text-xs">
                  <div className="font-extrabold flex items-center gap-1.5 text-indigo-950">
                    <Award className="w-4 h-4 text-indigo-600" />
                    Laporan Ekstrakurikuler TIK
                  </div>
                  <p className="text-[11px] leading-relaxed text-indigo-800">
                    Menampilkan rekapitulasi total <strong>{filteredExtraTikReportData.length} peserta Ekstrakurikuler TIK</strong>. Laporan mencakup data NIS, Nama, Kelas, Rekap Presensi (Hadir, Sakit, Izin, Alfa, % Kehadiran), Nilai Tugas, Nilai Praktik, Nilai Teori, Rata-Rata Nilai, serta Predikat Akhir.
                  </p>
                </div>
              </div>
            )}

            {/* Select Data Columns to Include / Info */}
            {reportType === 'journal' ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Informasi Rekap Jurnal
                </label>
                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-150 text-indigo-900 space-y-1.5 text-xs">
                  <div className="font-extrabold flex items-center gap-1.5 text-indigo-950">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Rekapitulasi Jurnal Mengajar
                  </div>
                  <p className="text-[11px] leading-relaxed text-indigo-800">
                    Menampilkan total <strong>{classJournals.length} catatan jurnal</strong> pembelajaran untuk kelas <strong>{activeClassName}</strong>. Laporan mencakup hari/tanggal, jam pelajaran, materi, absensi siswa, catatan kendala, serta kolom paraf penandatangan resmi.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Data yang Ingin Direkap
                </label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIncludeAttendance(!includeAttendance)}
                    className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700"
                  >
                    {includeAttendance ? (
                      <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                    )}
                    <span>Data Rekapitulasi Absensi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncludeGrades(!includeGrades)}
                    className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700"
                  >
                    {includeGrades ? (
                      <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                    )}
                    <span>Data Nilai Akademik (Formatif & Sumatif)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncludeNotes(!includeNotes)}
                    className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700"
                  >
                    {includeNotes ? (
                      <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                    )}
                    <span>Data Jurnal Catatan Guru / Perilaku</span>
                  </button>
                </div>
              </div>
            )}

            {/* School Period Metadata */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Semester
                </label>
                <input
                  type="text"
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Official Headers configuration */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-500" />
                2. Kustomisasi Kop Resmi & Penandatangan
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tersimpan Permanen
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-150 text-left">
              {/* Kop Surat Fields */}
              <div className="space-y-2.5 sm:col-span-2">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Data Kop Instansi & Sekolah
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={govName}
                    onChange={e => setGovName(e.target.value)}
                    placeholder="Pemerintah Provinsi / Kota"
                    className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white"
                    title="Pemerintah Tingkat I/II"
                  />
                  <input
                    type="text"
                    value={deptName}
                    onChange={e => setDeptName(e.target.value)}
                    placeholder="Dinas Pendidikan"
                    className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white"
                  />
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    placeholder="Nama Sekolah"
                    className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 font-bold text-indigo-800 bg-white"
                  />
                  <input
                    type="text"
                    value={schoolAddress}
                    onChange={e => setSchoolAddress(e.target.value)}
                    placeholder="Alamat Sekolah"
                    className="w-full py-1.5 px-2.5 text-[11px] rounded-lg border border-slate-200 text-slate-600 bg-white"
                  />
                  <input
                    type="text"
                    value={schoolPhone}
                    onChange={e => setSchoolPhone(e.target.value)}
                    placeholder="Telepon & Kontak Sekolah"
                    className="w-full py-1.5 px-2.5 text-[10px] rounded-lg border border-slate-200 text-slate-500 bg-white font-mono"
                  />

                  {/* Upload Logo Custom */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5 pt-2.5 border-t border-slate-200/60">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                        Logo Kiri (Instansi / Pemda)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer text-[10.5px] font-bold text-slate-700 transition shadow-xs">
                          <Upload className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Pilih Logo Kiri</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoKiriChange}
                            className="hidden"
                          />
                        </label>
                        {logoKiri && (
                          <button
                            type="button"
                            onClick={removeLogoKiri}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                            title="Hapus Logo Kiri"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                        Logo Kanan (Sekolah / Tut Wuri)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer text-[10.5px] font-bold text-slate-700 transition shadow-xs">
                          <Upload className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Pilih Logo Kanan</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoKananChange}
                            className="hidden"
                          />
                        </label>
                        {logoKanan && (
                          <button
                            type="button"
                            onClick={removeLogoKanan}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                            title="Hapus Logo Kanan"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signatures fields */}
              <div className="space-y-2">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Penandatangan: Guru Mata Pelajaran
                </span>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={cityName}
                    onChange={e => setCityName(e.target.value)}
                    placeholder="Tempat Kota Terbit (mis. Jakarta)"
                    className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white"
                    title="Kota Tempat Cetak"
                  />
                  <input
                    type="text"
                    value={teacherSubject}
                    onChange={e => setTeacherSubject(e.target.value)}
                    placeholder="Mata Pelajaran (mis. Informatika, Matematika)"
                    className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white font-bold text-indigo-700 placeholder:text-slate-400 placeholder:font-normal"
                    title="Mata Pelajaran yang Bersangkutan"
                  />
                  <input
                    type="text"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    placeholder="Nama Lengkap Guru Mata Pelajaran"
                    className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white font-semibold"
                  />
                  <input
                    type="text"
                    value={teacherNip}
                    onChange={e => setTeacherNip(e.target.value)}
                    placeholder="NIP Guru Mata Pelajaran"
                    className="w-full py-1 px-2 text-[11px] rounded-lg border border-slate-200 text-slate-500 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Penandatangan: Kepala Sekolah
                </span>
                <div className="space-y-1.5">
                  <div className="h-6 flex items-center">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Mengetahui, Kepala Sekolah</span>
                  </div>
                  <input
                    type="text"
                    value={headmasterName}
                    onChange={e => setHeadmasterName(e.target.value)}
                    placeholder="Nama Lengkap Kepala Sekolah"
                    className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white font-semibold"
                  />
                  <input
                    type="text"
                    value={headmasterNip}
                    onChange={e => setHeadmasterNip(e.target.value)}
                    placeholder="NIP Kepala Sekolah"
                    className="w-full py-1 px-2 text-[11px] rounded-lg border border-slate-200 text-slate-500 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Mekanisme Paraf & TTD Otomatis */}
              <div className="space-y-2 sm:col-span-2 pt-3 border-t border-slate-200/80 mt-1">
                <span className="block text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Mekanisme Paraf & Tanda Tangan Otomatis
                </span>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Pilih mekanisme pengesahan untuk mengisi kolom paraf di tabel jurnal dan kolom tanda tangan di bawah laporan secara otomatis agar tidak perlu paraf manual satu per satu.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { id: 'digital', label: '🖋️ Paraf Digital Cepat', desc: 'Paraf otomatis bergaya kaligrafi' },
                    { id: 'stamp', label: '🛡️ Stempel Validasi', desc: 'Cap stempel verifikasi resmi' },
                    { id: 'custom_image', label: '🖼️ Upload Gambar TTD', desc: 'Gunakan scan/foto tanda tangan' },
                    { id: 'manual', label: '📝 Kosong / Manual', desc: 'Kotak kosong untuk paraf basah' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setParafMode(m.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        parafMode === m.id
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 shadow-xs font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold">{m.label}</span>
                      <span className="text-[9.5px] text-slate-500 mt-1 leading-tight">{m.desc}</span>
                    </button>
                  ))}
                </div>
                {parafMode === 'custom_image' && (
                  <div className="mt-2 p-3 bg-slate-100/80 border border-slate-250 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-10 bg-white border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {customParafImg ? (
                          <img src={customParafImg} alt="TTD Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">Belum ada</span>
                        )}
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-800">File Tanda Tangan / Paraf</span>
                        <span className="text-[10px] text-slate-500">Format PNG/JPG dengan background transparan disarankan</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-2xs">
                        {customParafImg ? 'Ganti Foto' : 'Upload TTD'}
                        <input type="file" accept="image/*" onChange={handleParafImageUpload} className="hidden" />
                      </label>
                      {customParafImg && (
                        <button
                          type="button"
                          onClick={() => { setCustomParafImg(null); localStorage.removeItem('report_custom_paraf_img'); }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition border border-rose-200"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar: Simpan Permanen & Reset */}
              <div className="sm:col-span-2 pt-3 border-t border-slate-200/80 mt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Data Kop, Logo, dan Penandatangan tersimpan secara permanen di cloud & perangkat.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                    title="Kembalikan data Kop dan TTD ke format awal"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset Default</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePermanentConfig}
                    disabled={isSavingConfig}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingConfig ? 'Menyimpan...' : 'Simpan Permanen'}</span>
                  </button>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="sm:col-span-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button and Zoom */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Eye className="w-4 h-4 text-slate-400" /> Skala Pratinjau:
            </span>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              {[50, 75, 100].map(zoom => (
                <button
                  key={zoom}
                  onClick={() => setPreviewZoom(zoom)}
                  className={`px-3 py-1 rounded-lg font-bold transition duration-200 cursor-pointer ${
                    previewZoom === zoom 
                      ? 'bg-white text-slate-800 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {zoom}%
                </button>
              ))}
            </div>
          </div>
          
          {pdfError && (
            <div className="mb-3 p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 text-xs font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
              <span>{pdfError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              disabled={(reportType !== 'journal' && reportType !== 'extra_tik' && students.length === 0) || (reportType === 'extra_tik' && filteredExtraTikReportData.length === 0)}
              className="px-5 py-2.5 rounded-2xl font-bold bg-sky-600 hover:bg-sky-700 text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs sm:text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              title="Buka modal pratinjau laporan sebelum mengunduh"
            >
              <Eye className="w-4.5 h-4.5 text-white" />
              Pratinjau Layout Modal
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={(reportType !== 'journal' && reportType !== 'extra_tik' && students.length === 0) || (reportType === 'extra_tik' && filteredExtraTikReportData.length === 0)}
              className="px-5 py-2.5 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs sm:text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              title="Unduh data laporan dalam format spreadsheet Excel (.xlsx) untuk kemudahan olah data"
            >
              <FileSpreadsheet className="w-4.5 h-4.5 text-white" />
              Unduh Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGenerating || (reportType !== 'journal' && reportType !== 'extra_tik' && students.length === 0) || (reportType === 'extra_tik' && filteredExtraTikReportData.length === 0)}
              className={`px-6 py-2.5 rounded-2xl font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs sm:text-sm ${
                isGenerating || (reportType !== 'journal' && reportType !== 'extra_tik' && students.length === 0) || (reportType === 'extra_tik' && filteredExtraTikReportData.length === 0)
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyusun PDF Beresolusi Tinggi...
                </>
              ) : (
                <>
                  <Download className="w-4.5 h-4.5 text-white" />
                  Unduh PDF Laporan Resmi
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Warning */}
      <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-150 text-indigo-900 text-xs leading-relaxed space-y-1 text-left flex items-start gap-2.5">
        <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-[13px] text-indigo-950">Akurasi & Standar Percetakan Digital</p>
          <p className="text-indigo-800">
            Preview di bawah ini disesuaikan dalam format rasio kertas internasional <strong>A4 (210mm x 297mm)</strong>. 
            Hasil ekspor PDF dijamin memiliki kontras visual tinggi, font serif/sans-serif yang seimbang, dan bebas pecah saat dicetak ke printer fisik sekolah.
          </p>
        </div>
      </div>

      {/* Pagination Navigation Bar */}
      {totalPages > 1 && !isGenerating && (
        <div id="report-pagination-nav" className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-left">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Navigasi Halaman Laporan (A4)
            </span>
            <span className="text-[12px] font-extrabold text-slate-700">
              {reportType === 'collective' 
                ? (() => {
                    const p = activePages[safeCurrentPage - 1] || activePages[0];
                    const secName = p?.section === 'attendance' ? 'I. Rekapitulasi Presensi' : p?.section === 'grades' ? 'II. Transkrip Nilai Akademik' : 'III. Jurnal Perilaku Siswa';
                    return p?.totalSubPages > 1 ? `${secName} (Hal. ${p?.subPage}/${p?.totalSubPages})` : secName;
                  })()
                : reportType === 'journal'
                ? `Jurnal Mengajar Guru (Halaman ${safeCurrentPage} dari ${totalPages})`
                : reportType === 'extra_tik'
                ? `Laporan Extra TIK (Halaman ${safeCurrentPage} dari ${totalPages})`
                : `Murid: ${studentsToRender[safeCurrentPage - 1]?.nama || ''} (${studentsToRender[safeCurrentPage - 1]?.nis || ''})`
              }
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="prev-page-btn"
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              &larr; Sebelumnya
            </button>
            
            <div id="page-indicator-counter" className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-600">
              Halaman {safeCurrentPage} dari {totalPages}
            </div>

            <button
              id="next-page-btn"
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              Selanjutnya &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Report Live Preview Stage */}
      <div className="w-full flex justify-center overflow-x-auto py-4 bg-slate-900/5 rounded-3xl border border-slate-200/60 p-4 min-h-[500px]">
        <div 
          className="origin-top transition-all duration-300 shadow-2xl rounded-sm"
          style={{ transform: `scale(${previewZoom / 100})`, width: orientation === 'landscape' ? '297mm' : '210mm' }}
        >
          <div ref={previewRef} className="bg-neutral-100 flex flex-col gap-6 select-none text-left">
            
            {/* REPORT RENDER LOGIC */}
            {(() => {
              const isExtraTik = reportType === 'extra_tik';
              const extraTikClass = isExtraTik ? "report-extra-tik" : "";
              const containerClass = orientation === 'landscape'
                ? `report-page-container ${extraTikClass} bg-white w-[297mm] max-w-[297mm] min-h-[210mm] pt-[10mm] pb-[12mm] pl-[18mm] pr-[18mm] flex flex-col justify-start shadow-md relative overflow-hidden font-sans text-slate-800 box-border`
                : `report-page-container ${extraTikClass} bg-white w-[210mm] max-w-[210mm] min-h-[297mm] pt-[12mm] pb-[16mm] pl-[25mm] pr-[25mm] flex flex-col justify-start shadow-md relative overflow-hidden font-sans text-slate-800 box-border`;

              if (reportType === 'collective') {
                return isGenerating ? (
                  activePages.map((pageItem, idx) => (
                    <div key={`col-${pageItem.section}-${idx}`} data-report-title={`Rekapitulasi Hasil Belajar Kelas - ${activeClassName} (${pageItem.section} - Hal ${pageItem.subPage})`} className={containerClass}>
                      {renderCollectiveSection(pageItem.section, idx + 1, activePages.length, pageItem)}
                    </div>
                  ))
                ) : (
                  <div data-report-title={`Rekapitulasi Hasil Belajar Kelas - ${activeClassName}`} className={containerClass}>
                    {renderCollectiveSection((activePages[safeCurrentPage - 1] || activePages[0])?.section || 'attendance', safeCurrentPage, activePages.length, activePages[safeCurrentPage - 1] || activePages[0])}
                  </div>
                );
              }

              if (reportType === 'journal') {
                return isGenerating ? (
                  Array.from({ length: totalPages }, (_, idx) => (
                    <div key={idx + 1} data-report-title={`Laporan Jurnal Harian Guru - ${activeClassName} (Hal. ${idx + 1})`} className={containerClass}>
                      {renderJournalReport(idx + 1, totalPages)}
                    </div>
                  ))
                ) : (
                  <div data-report-title={`Laporan Jurnal Harian Guru - ${activeClassName}`} className={containerClass}>
                    {renderJournalReport(safeCurrentPage, totalPages)}
                  </div>
                );
              }

              if (reportType === 'extra_tik') {
                return isGenerating ? (
                  Array.from({ length: totalPages }, (_, idx) => (
                    <div key={idx + 1} data-report-title={`Laporan Ekstrakurikuler TIK (Hal. ${idx + 1})`} className={containerClass}>
                      {renderExtraTikReport(idx + 1, totalPages)}
                    </div>
                  ))
                ) : (
                  <div data-report-title="Laporan Ekstrakurikuler TIK" className={containerClass}>
                    {renderExtraTikReport(safeCurrentPage, totalPages)}
                  </div>
                );
              }

              // Individual Report
              return isGenerating ? (
                studentsToRender.map((s) => (
                  <div key={s.nis} data-student-name={s.nama} className={containerClass}>
                    {renderIndividualStudentReport(s)}
                  </div>
                ))
              ) : (
                studentsToRender.length > 0 && (
                  (() => {
                    const s = studentsToRender[safeCurrentPage - 1] || studentsToRender[0];
                    return (
                      <div key={s.nis} data-student-name={s.nama} className={containerClass}>
                        {renderIndividualStudentReport(s)}
                      </div>
                    );
                  })()
                )
              );
            })()}

          </div>
        </div>
      </div>

      {/* MODAL PRATINJAU LAPORAN */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-between p-3 sm:p-5 overflow-hidden animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center justify-between gap-4 border border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-50 border border-sky-150 rounded-xl text-sky-600">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 leading-tight">
                  Pratinjau Layout Laporan Resmiku (A4)
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Format: {orientation === 'landscape' ? 'Landscape (297mm x 210mm)' : 'Portrait (210mm x 297mm)'} • Halaman {safeCurrentPage} dari {totalPages}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPreviewModal(false);
                  handleDownloadPDF();
                }}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak / Unduh PDF
              </button>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Pagination Bar */}
          {totalPages > 1 && (
            <div className="my-2 bg-slate-800/90 text-white px-4 py-2 rounded-2xl backdrop-blur-md border border-slate-700/80 flex items-center gap-3 text-xs font-bold shadow-lg shrink-0">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                &larr; Sebelumnya
              </button>
              <span>
                Halaman {safeCurrentPage} dari {totalPages}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Selanjutnya &rarr;
              </button>
            </div>
          )}

          {/* Modal Main Content View Stage */}
          <div className="flex-1 w-full max-w-6xl overflow-auto my-2 flex justify-center items-start p-4 bg-slate-950/40 rounded-3xl border border-slate-800/60 shadow-inner">
            <div
              className="origin-top transition-all duration-300 shadow-2xl rounded-sm bg-white"
              style={{ width: orientation === 'landscape' ? '297mm' : '210mm' }}
            >
              <div className="bg-white flex flex-col gap-6 select-none text-left">
                {(() => {
                  const isExtraTik = reportType === 'extra_tik';
                  const extraTikClass = isExtraTik ? "report-extra-tik" : "";
                  const containerClass = orientation === 'landscape'
                    ? `report-page-container ${extraTikClass} bg-white w-[297mm] max-w-[297mm] min-h-[210mm] pt-[10mm] pb-[12mm] pl-[18mm] pr-[18mm] flex flex-col justify-start shadow-md relative overflow-hidden font-sans text-slate-800 box-border`
                    : `report-page-container ${extraTikClass} bg-white w-[210mm] max-w-[210mm] min-h-[297mm] pt-[12mm] pb-[16mm] pl-[25mm] pr-[25mm] flex flex-col justify-start shadow-md relative overflow-hidden font-sans text-slate-800 box-border`;

                  if (reportType === 'collective') {
                    return (
                      <div className={containerClass}>
                        {renderCollectiveSection((activePages[safeCurrentPage - 1] || activePages[0])?.section || 'attendance', safeCurrentPage, activePages.length, activePages[safeCurrentPage - 1] || activePages[0])}
                      </div>
                    );
                  }

                  if (reportType === 'journal') {
                    return (
                      <div className={containerClass}>
                        {renderJournalReport(safeCurrentPage, totalPages)}
                      </div>
                    );
                  }

                  if (reportType === 'extra_tik') {
                    return (
                      <div className={containerClass}>
                        {renderExtraTikReport(safeCurrentPage, totalPages)}
                      </div>
                    );
                  }

                  // Individual Report
                  if (studentsToRender.length > 0) {
                    const s = studentsToRender[safeCurrentPage - 1] || studentsToRender[0];
                    return (
                      <div key={s.nis} className={containerClass}>
                        {renderIndividualStudentReport(s)}
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 border border-slate-200 shrink-0 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              💡 Layout di atas disesuaikan dengan rasio cetak kertas A4 presisi.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPreviewModal(false);
                  handleDownloadPDF();
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer shadow-2xs"
              >
                Unduh PDF
              </button>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
