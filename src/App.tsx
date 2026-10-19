import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, anonymousSignIn, logout } from './lib/firebase';
import { 
  initializeDatabaseIfEmpty,
  getClassesFromFirestore,
  saveClassesToFirestore,
  getStudentsFromFirestore,
  saveStudentsToFirestore,
  saveStudentsToFirestoreForClass,
  deleteStudentFromFirestore,
  getAttendanceFromFirestore,
  saveAttendanceToFirestore,
  deleteAttendanceByDateFromFirestore,
  getFormativeGradesFromFirestore,
  saveFormativeGradesToFirestore,
  getSummativeGradesFromFirestore,
  saveSummativeGradesToFirestore,
  getStudentNotesFromFirestore,
  saveStudentNoteToFirestore,
  deleteStudentNoteFromFirestore,
  getJournalsFromFirestore,
  saveJournalToFirestore,
  deleteJournalFromFirestore,
  getExtraTikDataFromFirestore,
  saveExtraTikPesertaToFirestore,
  saveExtraTikAbsensiToFirestore,
  deleteExtraTikAbsensiByDateFromFirestore,
  saveExtraTikNilaiToFirestore,
  deepCleanDatabaseFromFirestore,
  getAppLogoFromFirestore,
  saveAppLogoToFirestore,
  getTeacherPasswordFromFirestore,
  saveTeacherPasswordToFirestore,
  getAttendanceDateNotesFromFirestore,
  saveAttendanceDateNoteToFirestore,
  deleteAttendanceDateNoteFromFirestore,
  getGradeWeightConfigFromFirestore,
  saveGradeWeightConfigToFirestore,
  getAttitudeGradesFromFirestore,
  saveAttitudeGradesToFirestore,
  getClassSchedulesFromFirestore,
  saveClassSchedulesToFirestore,
  DeepCleanResult
} from './lib/firestoreService';
import { getFriendlyErrorMessage } from './lib/errorHelper';
import { convertGoogleDriveUrl } from './utils/imageHelper';
import { DEFAULT_GRADE_WEIGHTS, safeRound, formatSafeScore } from './utils/gradeCalculator';
import { normalizeClassKey, isClassMatch, formatDisplayClassName } from './utils/textHelper';
import { getLocalCache, setLocalCache, useDebouncedLocalStorage } from './utils/storageHelper';

import { 
  Student, 
  AttendanceRecord, 
  GradeFormative, 
  GradeSummative, 
  MonthlyRecap, 
  GradeColumn, 
  StudentNote, 
  ExtraTikPeserta, 
  ExtraTikAbsensi, 
  ExtraTikNilai, 
  JurnalHarianRecord,
  AttendanceDateNote,
  GradeWeightConfig,
  GradeAttitude,
  ClassSchedule
} from './types';

// Tab components
import AttendanceTab from './components/AttendanceTab';
import JurnalHarianTab from './components/JurnalHarianTab';
import GradesTab from './components/GradesTab';
import RecapTab from './components/RecapTab';
import StudentsTab from './components/StudentsTab';
import StudentNotesTab from './components/StudentNotesTab';
import ProfessionalReportTab from './components/ProfessionalReportTab';
import ExtraTIKTab from './components/ExtraTIKTab';
import SettingsTab from './components/SettingsTab';
import LoginPage from './components/LoginPage';
import StudentSpinnerModal from './components/StudentSpinnerModal';
import GroupDividerModal from './components/GroupDividerModal';
import ErrorBoundary from './components/ErrorBoundary';

import {
  Database,
  LogOut,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  PieChart,
  Users,
  Loader2,
  AlertCircle,
  Award,
  ChevronRight,
  ClipboardList,
  Sparkles,
  BookOpen,
  UserCheck,
  Menu,
  X,
  ShieldCheck,
  Check,
  Layers,
  FileText,
  RefreshCw,
  Lock,
  KeyRound,
  Settings,
  Dices
} from 'lucide-react';

const DEFAULT_CLASSES = Array.from({ length: 11 }, (_, i) => ({
  id: i + 1,
  name: `Kelas 8.${i + 1}`
}));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => {
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true';
    return !isLoggedIn;
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [role, setRole] = useState<'admin' | 'guru'>(() => (localStorage.getItem('user_role') as 'admin' | 'guru') || 'guru');

  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' }[]>([]);

  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Active tab
  const [activeTab, setActiveTab] = useState<
    'attendance' | 'journal' | 'grades' | 'notes' | 'recap' | 'students' | 'professional_report' | 'extra_tik' | 'settings'
  >('attendance');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Classes & Semester State with LocalStorage Caching
  const [classes, setClasses] = useState<{ id: number; name: string }[]>(() =>
    getLocalCache('cache_classes', DEFAULT_CLASSES)
  );
  const [selectedClassId, setSelectedClassId] = useState<number>(1);
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(() => {
    const cached = localStorage.getItem('app_selected_semester');
    return cached === '2' ? 2 : 1;
  });

  const handleSelectSemester = (sem: 1 | 2) => {
    setSelectedSemester(sem);
    localStorage.setItem('app_selected_semester', String(sem));
    addToast(`Beralih ke Semester ${sem} (${sem === 1 ? 'Ganjil' : 'Genap'})`, 'info');
  };

  const activeClassName = useMemo(() => {
    return classes.find(c => c.id === selectedClassId)?.name || `Kelas 8.${selectedClassId}`;
  }, [classes, selectedClassId]);

  // Firestore Data State with LocalStorage Caching
  const [allStudents, setAllStudents] = useState<Student[]>(() =>
    getLocalCache('cache_allStudents', [])
  );
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>(() =>
    getLocalCache('cache_allAttendance', [])
  );
  const [allFormative, setAllFormative] = useState<GradeFormative[]>(() =>
    getLocalCache('cache_allFormative', [])
  );
  const [allSummative, setAllSummative] = useState<GradeSummative[]>(() =>
    getLocalCache('cache_allSummative', [])
  );
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

  const [formativeColsSem1, setFormativeColsSem1] = useState<GradeColumn[]>(() =>
    getLocalCache('cache_formativeCols_sem1', getLocalCache('cache_formativeCols', []))
  );
  const [formativeColsSem2, setFormativeColsSem2] = useState<GradeColumn[]>(() =>
    getLocalCache('cache_formativeCols_sem2', [])
  );
  const [summativeColsSem1, setSummativeColsSem1] = useState<GradeColumn[]>(() => {
    const cached = getLocalCache('cache_summativeCols_sem1', getLocalCache('cache_summativeCols', []));
    return Array.isArray(cached) ? cached.filter(c => c && c.key !== 'uts') : [];
  });
  const [summativeColsSem2, setSummativeColsSem2] = useState<GradeColumn[]>(() => {
    const cached = getLocalCache('cache_summativeCols_sem2', []);
    return Array.isArray(cached) ? cached.filter(c => c && c.key !== 'uts') : [];
  });

  const formativeCols = useMemo(() => {
    if (selectedSemester === 2) {
      return formativeColsSem2.length > 0
        ? formativeColsSem2
        : (formativeColsSem1.length > 0 ? formativeColsSem1 : DEFAULT_FORMATIVE_COLS);
    }
    return formativeColsSem1.length > 0 ? formativeColsSem1 : DEFAULT_FORMATIVE_COLS;
  }, [selectedSemester, formativeColsSem1, formativeColsSem2]);

  const summativeCols = useMemo(() => {
    if (selectedSemester === 2) {
      return summativeColsSem2.length > 0
        ? summativeColsSem2
        : (summativeColsSem1.length > 0 ? summativeColsSem1 : DEFAULT_SUMMATIVE_COLS.filter(c => c.key !== 'uts'));
    }
    return summativeColsSem1.length > 0 ? summativeColsSem1 : DEFAULT_SUMMATIVE_COLS.filter(c => c.key !== 'uts');
  }, [selectedSemester, summativeColsSem1, summativeColsSem2]);

  const handleSetFormativeCols: React.Dispatch<React.SetStateAction<GradeColumn[]>> = (valueOrFn) => {
    if (selectedSemester === 2) {
      setFormativeColsSem2(prev => {
        const current = prev.length > 0 ? prev : formativeCols;
        const next = typeof valueOrFn === 'function' ? valueOrFn(current) : valueOrFn;
        setLocalCache('cache_formativeCols_sem2', next);
        return next;
      });
    } else {
      setFormativeColsSem1(prev => {
        const current = prev.length > 0 ? prev : formativeCols;
        const next = typeof valueOrFn === 'function' ? valueOrFn(current) : valueOrFn;
        setLocalCache('cache_formativeCols_sem1', next);
        setLocalCache('cache_formativeCols', next);
        return next;
      });
    }
  };

  const handleSetSummativeCols: React.Dispatch<React.SetStateAction<GradeColumn[]>> = (valueOrFn) => {
    if (selectedSemester === 2) {
      setSummativeColsSem2(prev => {
        const current = prev.length > 0 ? prev : summativeCols;
        const next = typeof valueOrFn === 'function' ? valueOrFn(current) : valueOrFn;
        setLocalCache('cache_summativeCols_sem2', next);
        return next;
      });
    } else {
      setSummativeColsSem1(prev => {
        const current = prev.length > 0 ? prev : summativeCols;
        const next = typeof valueOrFn === 'function' ? valueOrFn(current) : valueOrFn;
        setLocalCache('cache_summativeCols_sem1', next);
        setLocalCache('cache_summativeCols', next);
        return next;
      });
    }
  };
  const [allNotes, setAllNotes] = useState<StudentNote[]>(() =>
    getLocalCache('cache_allNotes', [])
  );
  const [allJournals, setAllJournals] = useState<JurnalHarianRecord[]>(() =>
    getLocalCache('cache_allJournals', [])
  );

  // Extra TIK States with LocalStorage Caching
  const [extraTikPeserta, setExtraTikPeserta] = useState<ExtraTikPeserta[]>(() =>
    getLocalCache('cache_extraTikPeserta', [])
  );
  const [extraTikAbsensi, setExtraTikAbsensi] = useState<ExtraTikAbsensi[]>(() =>
    getLocalCache('cache_extraTikAbsensi', [])
  );
  const [extraTikNilai, setExtraTikNilai] = useState<ExtraTikNilai[]>(() =>
    getLocalCache('cache_extraTikNilai', [])
  );
  const [allDateNotes, setAllDateNotes] = useState<AttendanceDateNote[]>(() =>
    getLocalCache('cache_allDateNotes', [])
  );

  // Grade Weight Configuration State with LocalStorage Caching
  const [gradeWeights, setGradeWeights] = useState<GradeWeightConfig>(() =>
    getLocalCache('cache_gradeWeights', DEFAULT_GRADE_WEIGHTS)
  );

  // Attitude & Character Grades State with LocalStorage Caching
  const [allAttitude, setAllAttitude] = useState<GradeAttitude[]>(() =>
    getLocalCache('cache_allAttitude', [])
  );

  // Class Schedules State with LocalStorage Caching
  const [classSchedules, setClassSchedules] = useState<Record<string, ClassSchedule>>(() =>
    getLocalCache('cache_classSchedules', {})
  );

  // Custom App Logo State
  const [appLogoUrl, setAppLogoUrl] = useState<string>(() => localStorage.getItem('app_custom_logo') || '');
  const [logoHeaderError, setLogoHeaderError] = useState(false);

  // Teacher Access Password State (Default initial: 12345)
  const [teacherPassword, setTeacherPassword] = useState<string>(() => localStorage.getItem('app_teacher_password') || '12345');

  // Auto-hide scrollbar effect when scrolling stops
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      document.documentElement.classList.add('is-scrolling');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, 1000);
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Scroll to top of page whenever menu/tab, class, or semester changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeTab, selectedClassId, selectedSemester]);

  useEffect(() => {
    setLogoHeaderError(false);
  }, [appLogoUrl]);

  const handleUpdateAppLogoUrl = async (newUrl: string) => {
    setAppLogoUrl(newUrl);
    setLogoHeaderError(false);
    if (newUrl) {
      localStorage.setItem('app_custom_logo', newUrl);
    } else {
      localStorage.removeItem('app_custom_logo');
    }
    await saveAppLogoToFirestore(newUrl);
  };

  const handleUpdateTeacherPassword = async (newPassword: string) => {
    setTeacherPassword(newPassword);
    if (newPassword) {
      localStorage.setItem('app_teacher_password', newPassword);
    } else {
      localStorage.removeItem('app_teacher_password');
    }
    await saveTeacherPasswordToFirestore(newPassword);
  };

  const handleUpdateClassSchedules = async (newSchedules: Record<string, ClassSchedule>) => {
    setClassSchedules(newSchedules);
    setLocalCache('cache_classSchedules', newSchedules);
    await saveClassSchedulesToFirestore(newSchedules);
  };

  // Debounced Auto-sync state updates to LocalStorage cache with Dirty Checking
  useDebouncedLocalStorage('cache_classes', classes);
  useDebouncedLocalStorage('cache_allStudents', allStudents);
  useDebouncedLocalStorage('cache_allAttendance', allAttendance);
  useDebouncedLocalStorage('cache_allFormative', allFormative);
  useDebouncedLocalStorage('cache_formativeCols_sem1', formativeColsSem1);
  useDebouncedLocalStorage('cache_formativeCols_sem2', formativeColsSem2);
  useDebouncedLocalStorage('cache_allSummative', allSummative);
  useDebouncedLocalStorage('cache_summativeCols_sem1', summativeColsSem1);
  useDebouncedLocalStorage('cache_summativeCols_sem2', summativeColsSem2);
  useDebouncedLocalStorage('cache_allNotes', allNotes);
  useDebouncedLocalStorage('cache_allJournals', allJournals);
  useDebouncedLocalStorage('cache_extraTikPeserta', extraTikPeserta);
  useDebouncedLocalStorage('cache_extraTikAbsensi', extraTikAbsensi);
  useDebouncedLocalStorage('cache_extraTikNilai', extraTikNilai);
  useDebouncedLocalStorage('cache_allDateNotes', allDateNotes);
  useDebouncedLocalStorage('cache_gradeWeights', gradeWeights);
  useDebouncedLocalStorage('cache_allAttitude', allAttitude);
  useDebouncedLocalStorage('cache_classSchedules', classSchedules);

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => localStorage.getItem('cache_last_sync') || null);
  const [errorMsg, setErrorMsg] = useState('');

  // Spin Siswa Modal State
  const [isSpinModalOpen, setIsSpinModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Admin Auth Modal for switching roles
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordModalError, setAdminPasswordModalError] = useState('');

  // Deep Clean Database States
  const [isDeepCleanModalOpen, setIsDeepCleanModalOpen] = useState(false);
  const [isDeepCleaning, setIsDeepCleaning] = useState(false);
  const [deepCleanResult, setDeepCleanResult] = useState<DeepCleanResult | null>(null);

  // 1. Auth Listener - Syncs user state without triggering layout reset flickers & persists session
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true';
    if (isLoggedIn) {
      setNeedsAuth(false);
      // Ensure anonymous / persistent auth session in background
      anonymousSignIn()
        .then((res) => {
          if (res?.user) setUser(res.user);
        })
        .catch((err) => console.warn('Background auto auth on refresh:', err));
    }

    const unsubscribe = initAuth(
      async (authenticatedUser) => {
        setUser(authenticatedUser);
        const savedRole = (localStorage.getItem('user_role') as 'admin' | 'guru') || 'guru';
        setRole(savedRole);
        if (localStorage.getItem('user_logged_in') === 'true') {
          setNeedsAuth(false);
        }
      },
      async () => {
        // Only clear user and require auth if not logged in locally
        if (localStorage.getItem('user_logged_in') !== 'true') {
          setUser(null);
          setNeedsAuth(true);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Auto load data on mount or when authenticated
  useEffect(() => {
    if (!needsAuth) {
      loadAllDatabaseData();
    }
  }, [needsAuth]);

  // Stale-While-Revalidate Data Hydration from Firestore
  const loadAllDatabaseData = async () => {
    // Check if cached data exists in local state
    const hasCachedData = classes.length > 0 || allStudents.length > 0 || allAttendance.length > 0 || allJournals.length > 0;
    
    if (!hasCachedData) {
      setIsLoadingData(true);
    } else {
      setIsRevalidating(true);
    }
    setErrorMsg('');

    try {
      await initializeDatabaseIfEmpty().catch(e => console.warn('Init DB:', e));

      // Progressive background revalidation of all records with graceful fallback
      await Promise.allSettled([
        getClassesFromFirestore().then(res => { if (res && res.length > 0) setClasses(res); }),
        getStudentsFromFirestore().then(res => { if (res && res.length > 0) setAllStudents(res); }),
        getAttendanceFromFirestore().then(res => { if (res) setAllAttendance(res); }),
        getFormativeGradesFromFirestore().then(res => {
          if (res) {
            setAllFormative(res.grades);
            if (res.colsSem1 && res.colsSem1.length > 0) setFormativeColsSem1(res.colsSem1);
            if (res.colsSem2 && res.colsSem2.length > 0) setFormativeColsSem2(res.colsSem2);
          }
        }),
        getSummativeGradesFromFirestore().then(res => {
          if (res) {
            setAllSummative(res.grades);
            if (res.colsSem1 && res.colsSem1.length > 0) setSummativeColsSem1(res.colsSem1);
            if (res.colsSem2 && res.colsSem2.length > 0) setSummativeColsSem2(res.colsSem2);
          }
        }),
        getStudentNotesFromFirestore().then(res => { if (res) setAllNotes(res); }),
        getJournalsFromFirestore().then(res => { if (res) setAllJournals(res); }),
        getExtraTikDataFromFirestore().then(res => {
          if (res) {
            setExtraTikPeserta(res.peserta);
            setExtraTikAbsensi(res.absensi);
            setExtraTikNilai(res.nilai);
          }
        }),
        getAttendanceDateNotesFromFirestore().then(res => { if (res) setAllDateNotes(res); }),
        getGradeWeightConfigFromFirestore().then(res => {
          if (res) {
            setGradeWeights(res);
            setLocalCache('cache_gradeWeights', res);
          }
        }),
        getAttitudeGradesFromFirestore().then(res => {
          if (res) {
            setAllAttitude(res);
            setLocalCache('cache_allAttitude', res);
          }
        }),
        getAppLogoFromFirestore().then(remoteAppLogo => {
          if (remoteAppLogo !== null) {
            setAppLogoUrl(remoteAppLogo);
            if (remoteAppLogo) {
              localStorage.setItem('app_custom_logo', remoteAppLogo);
            } else {
              localStorage.removeItem('app_custom_logo');
            }
          }
        }),
        getTeacherPasswordFromFirestore().then(remotePwd => {
          if (remotePwd !== null && remotePwd) {
            setTeacherPassword(remotePwd);
            localStorage.setItem('app_teacher_password', remotePwd);
          }
        }),
        getClassSchedulesFromFirestore().then(res => {
          if (res) {
            setClassSchedules(res as Record<string, ClassSchedule>);
            setLocalCache('cache_classSchedules', res);
          }
        })
      ]);

      setIsOfflineMode(false);
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(nowTime);
      localStorage.setItem('cache_last_sync', nowTime);
    } catch (err: any) {
      console.warn('Network / Firestore unavailable, operating in offline cache mode:', err);
      setIsOfflineMode(true);
      setErrorMsg('');
    } finally {
      setIsLoadingData(false);
      setIsRevalidating(false);
    }
  };

  const handleManualRefresh = async () => {
    await loadAllDatabaseData();
    addToast('Data berhasil disinkronkan dari Firebase!', 'success');
  };

  const handleRunDeepClean = async () => {
    setIsDeepCleaning(true);
    try {
      const result = await deepCleanDatabaseFromFirestore(classes);
      setDeepCleanResult(result);
      await loadAllDatabaseData();
      addToast('Pembersihan Deep Clean database Firestore selesai!', 'success');
    } catch (err: any) {
      console.error('Deep clean error:', err);
      addToast(`Gagal Deep Clean: ${err?.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsDeepCleaning(false);
    }
  };

  // 3. Filtered data for active class using centralized class matching
  const classStudents = useMemo(() => {
    return allStudents.filter(s => {
      if (!s.kelas && selectedClassId === 1) return true;
      if (!s.kelas) return false;
      return isClassMatch(s.kelas, activeClassName);
    });
  }, [allStudents, activeClassName, selectedClassId]);

  const classStudentNisSet = useMemo(() => {
    return new Set(classStudents.map(s => s.nis));
  }, [classStudents]);

  const currentClassSchedule = useMemo((): ClassSchedule => {
    const raw = classSchedules[activeClassName] 
      || Object.values(classSchedules).find(s => isClassMatch(s?.kelas, activeClassName))
      || { kelas: activeClassName, hari: [] };

    const globalSchedule = classSchedules['_global'];
    const fallbackStart = globalSchedule?.tanggalMulaiSemester || Object.values(classSchedules).find(s => s && s.tanggalMulaiSemester)?.tanggalMulaiSemester;
    const fallbackEnd = globalSchedule?.tanggalSelesaiSemester || Object.values(classSchedules).find(s => s && s.tanggalSelesaiSemester)?.tanggalSelesaiSemester;

    let activeHari = raw.hari || [];
    let activeJam = raw.jamPelajaran;
    let activeRuang = raw.ruang;
    let activeId = raw.activeVersionId;

    if (Array.isArray(raw.riwayatJadwal) && raw.riwayatJadwal.length > 0) {
      let activeVer = raw.riwayatJadwal.find(v => v.id === raw.activeVersionId);
      if (!activeVer) {
        activeVer = raw.riwayatJadwal.find(v => v.isActive);
      }
      if (!activeVer) {
        activeVer = raw.riwayatJadwal[raw.riwayatJadwal.length - 1];
      }
      if (activeVer) {
        activeHari = Array.isArray(activeVer.hari) && activeVer.hari.length > 0 ? activeVer.hari : activeHari;
        activeJam = activeVer.jamPelajaran || activeJam;
        activeRuang = activeVer.ruang || activeRuang;
        activeId = activeVer.id || activeId;
      }
    }

    return {
      ...raw,
      kelas: activeClassName,
      activeVersionId: activeId,
      hari: activeHari,
      jamPelajaran: activeJam,
      ruang: activeRuang,
      riwayatJadwal: raw.riwayatJadwal || [],
      tanggalMulaiSemester: raw.tanggalMulaiSemester || fallbackStart,
      tanggalSelesaiSemester: raw.tanggalSelesaiSemester || fallbackEnd
    };
  }, [classSchedules, activeClassName]);

  const classAttendance = useMemo(() => {
    const semStart = currentClassSchedule.tanggalMulaiSemester;
    const semEnd = currentClassSchedule.tanggalSelesaiSemester;

    return allAttendance.filter(a => {
      const sem = Number(a.semester) === 2 ? 2 : 1;
      if (sem !== selectedSemester) return false;

      // Filter by semester date range if configured
      if (semStart && a.tanggal && a.tanggal < semStart) return false;
      if (semEnd && a.tanggal && a.tanggal > semEnd) return false;

      // Validasi kelas secara ketat untuk mencegah kebocoran absensi antar kelas
      if (a.kelas) {
        if (!isClassMatch(a.kelas, activeClassName)) {
          return false;
        }
        if (classStudentNisSet.size > 0 && !classStudentNisSet.has(a.nis)) {
          return false;
        }
        return true;
      }

      // Record legacy tanpa atribut kelas
      if (classStudentNisSet.size > 0) {
        return classStudentNisSet.has(a.nis);
      }
      return selectedClassId === 1;
    });
  }, [allAttendance, activeClassName, selectedClassId, classStudentNisSet, selectedSemester, currentClassSchedule]);

  const classFormative = useMemo(() => {
    return allFormative.filter(f => {
      const sem = Number(f.semester) === 2 ? 2 : 1;
      if (sem !== selectedSemester) return false;

      if (f.kelas) {
        if (!isClassMatch(f.kelas, activeClassName)) return false;
        if (classStudentNisSet.size > 0 && !classStudentNisSet.has(f.nis)) return false;
        return true;
      }
      if (classStudentNisSet.size > 0) return classStudentNisSet.has(f.nis);
      return selectedClassId === 1;
    });
  }, [allFormative, activeClassName, selectedClassId, classStudentNisSet, selectedSemester]);

  const classSummative = useMemo(() => {
    return allSummative.filter(s => {
      const sem = Number(s.semester) === 2 ? 2 : 1;
      if (sem !== selectedSemester) return false;

      if (s.kelas) {
        if (!isClassMatch(s.kelas, activeClassName)) return false;
        if (classStudentNisSet.size > 0 && !classStudentNisSet.has(s.nis)) return false;
        return true;
      }
      if (classStudentNisSet.size > 0) return classStudentNisSet.has(s.nis);
      return selectedClassId === 1;
    });
  }, [allSummative, activeClassName, selectedClassId, classStudentNisSet, selectedSemester]);

  const classAttitude = useMemo(() => {
    return allAttitude.filter(a => {
      const sem = Number(a.semester) === 2 ? 2 : 1;
      if (sem !== selectedSemester) return false;

      if (a.kelas) {
        if (!isClassMatch(a.kelas, activeClassName)) return false;
        if (classStudentNisSet.size > 0 && !classStudentNisSet.has(a.nis)) return false;
        return true;
      }
      if (classStudentNisSet.size > 0) return classStudentNisSet.has(a.nis);
      return selectedClassId === 1;
    });
  }, [allAttitude, activeClassName, selectedClassId, classStudentNisSet, selectedSemester]);

  const classNotes = useMemo(() => {
    return allNotes.filter(n => {
      const sem = Number(n.semester) === 2 ? 2 : 1;
      if (sem !== selectedSemester) return false;
      if (isClassMatch(n.kelas, activeClassName) || (!n.kelas && selectedClassId === 1)) return true;
      return false;
    });
  }, [allNotes, activeClassName, selectedClassId, selectedSemester]);

  const classJournals = useMemo(() => {
    const semStart = currentClassSchedule.tanggalMulaiSemester;
    const semEnd = currentClassSchedule.tanggalSelesaiSemester;

    return allJournals.filter(j => {
      const sem = Number(j.semester) === 2 ? 2 : 1;
      if (sem !== selectedSemester) return false;

      // Filter by semester date range if configured
      if (semStart && j.tanggal && j.tanggal < semStart) return false;
      if (semEnd && j.tanggal && j.tanggal > semEnd) return false;

      if (isClassMatch(j.kelas, activeClassName) || (!j.kelas && selectedClassId === 1)) return true;
      return false;
    });
  }, [allJournals, activeClassName, selectedClassId, selectedSemester, currentClassSchedule]);

  const classDateNotes = useMemo(() => {
    const semStart = currentClassSchedule.tanggalMulaiSemester;
    const semEnd = currentClassSchedule.tanggalSelesaiSemester;

    return allDateNotes.filter(n => {
      const sem = Number(n.semester) === 2 ? 2 : 1;
      if (sem !== selectedSemester) return false;

      // Filter by semester date range if configured
      if (semStart && n.tanggal && n.tanggal < semStart) return false;
      if (semEnd && n.tanggal && n.tanggal > semEnd) return false;

      if (!n.kelas || n.kelas === 'all') return true;
      return isClassMatch(n.kelas, activeClassName);
    });
  }, [allDateNotes, activeClassName, selectedSemester, currentClassSchedule]);

  // Monthly Recap calculation for current class with robust NaN-safe calculation
  const classRecap = useMemo(() => {
    return classStudents.map(student => {
      const studentRecords = classAttendance.filter(a => a.nis === student.nis);
      const hadir = studentRecords.filter(a => a.status === 'Hadir').length || 0;
      const sakit = studentRecords.filter(a => a.status === 'Sakit').length || 0;
      const izin = studentRecords.filter(a => a.status === 'Izin').length || 0;
      const alfa = studentRecords.filter(a => a.status === 'Alfa').length || 0;
      const terlambatCount = studentRecords.filter(a => a.status === 'Hadir' && (Number(a.terlambat) || 0) > 0).length || 0;
      const totalDays = hadir + sakit + izin + alfa;

      if (totalDays === 0) {
        return {
          nis: student.nis,
          nama: student.nama,
          jenisKelamin: student.jenisKelamin,
          kelas: activeClassName,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alfa: 0,
          terlambatCount: 0,
          persentaseKehadiran: 0
        };
      }

      const rawPct = totalDays > 0 ? hadir / totalDays : 0;
      const persentaseKehadiran = isNaN(rawPct) ? 0 : safeRound(rawPct, 4);

      return {
        nis: student.nis,
        nama: student.nama,
        jenisKelamin: student.jenisKelamin,
        kelas: activeClassName,
        hadir,
        sakit,
        izin,
        alfa,
        terlambatCount,
        persentaseKehadiran
      };
    });
  }, [classStudents, classAttendance, activeClassName]);

  // Handlers for Data Syncing with Firebase
  const handleSaveAttendance = async (records: AttendanceRecord[]) => {
    try {
      // Inject active class and semester into records
      const enrichedRecords = records.map(r => ({ ...r, kelas: activeClassName, semester: selectedSemester }));
      await saveAttendanceToFirestore(enrichedRecords);
      
      // Update local state
      setAllAttendance(prev => {
        const filtered = prev.filter(
          a => !(isClassMatch(a.kelas, activeClassName) && (Number(a.semester) === 2 ? 2 : 1) === selectedSemester && enrichedRecords.some(r => r.tanggal === a.tanggal && r.nis === a.nis))
        );
        const updated = [...filtered, ...enrichedRecords];
        setLocalCache('cache_allAttendance', updated);
        return updated;
      });
      addToast('Data absensi berhasil disimpan ke Firebase!', 'success');
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan absensi'), 'error');
    }
  };

  const handleDeleteAttendance = async (date: string) => {
    try {
      const studentNises = classStudents.map(s => s.nis);
      const studentNisSet = new Set(studentNises);

      await deleteAttendanceByDateFromFirestore(date, activeClassName, studentNises);
      
      setAllAttendance(prev => {
        const updated = prev.filter(a => {
          if (a.tanggal !== date) return true;
          // Periksa apakah record ini milik kelas aktif
          const matchesClass = isClassMatch(a.kelas, activeClassName);
          const isStudentOfClass = studentNisSet.has(a.nis);
          if (matchesClass || (isStudentOfClass && (!a.kelas || isClassMatch(a.kelas, activeClassName)))) {
            return false; // Dihapus dari state
          }
          return true;
        });
        setLocalCache('cache_allAttendance', updated);
        return updated;
      });
      addToast(`Absensi tanggal ${date} untuk ${activeClassName} berhasil dihapus.`, 'info');
    } catch (err: any) {
      console.error('Error deleting attendance:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menghapus absensi'), 'error');
    }
  };

  const handleSaveDateNote = async (note: AttendanceDateNote) => {
    try {
      const enrichedNote = { ...note, kelas: note.kelas || activeClassName, semester: selectedSemester };
      await saveAttendanceDateNoteToFirestore(enrichedNote);
      setAllDateNotes(prev => {
        const filtered = prev.filter(n => !(n.tanggal === enrichedNote.tanggal && (Number(n.semester) === 2 ? 2 : 1) === selectedSemester && (isClassMatch(n.kelas, enrichedNote.kelas) || (!n.kelas && isClassMatch(enrichedNote.kelas, activeClassName)))));
        const updated = [...filtered, enrichedNote];
        setLocalCache('cache_allDateNotes', updated);
        return updated;
      });
      addToast(`Penanda tanggal ${enrichedNote.tanggal} berhasil disimpan!`, 'success');
    } catch (err: any) {
      console.error('Error saving date note:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan penanda tanggal'), 'error');
    }
  };

  const handleDeleteDateNote = async (date: string) => {
    try {
      await deleteAttendanceDateNoteFromFirestore(date, activeClassName);
      setAllDateNotes(prev => {
        const updated = prev.filter(n => !(n.tanggal === date && (isClassMatch(n.kelas, activeClassName) || n.kelas === 'all' || !n.kelas) && (Number(n.semester) === 2 ? 2 : 1) === selectedSemester));
        setLocalCache('cache_allDateNotes', updated);
        return updated;
      });
      addToast(`Penanda tanggal ${date} berhasil dihapus.`, 'info');
    } catch (err: any) {
      console.error('Error deleting date note:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menghapus penanda tanggal'), 'error');
    }
  };

  const handleSaveGrades = async (
    formative: GradeFormative[],
    summative: GradeSummative[],
    colsF?: GradeColumn[],
    colsS?: GradeColumn[]
  ) => {
    try {
      const enrichedFormative = formative.map(f => ({ ...f, kelas: activeClassName, semester: selectedSemester }));
      const enrichedSummative = summative.map(s => ({ ...s, kelas: activeClassName, semester: selectedSemester }));

      await saveFormativeGradesToFirestore(enrichedFormative, colsF, selectedSemester);
      await saveSummativeGradesToFirestore(enrichedSummative, colsS, selectedSemester);

      if (colsF) handleSetFormativeCols(colsF);
      if (colsS) handleSetSummativeCols(colsS);

      setAllFormative(prev => {
        const filtered = prev.filter(f => !(isClassMatch(f.kelas, activeClassName) && (Number(f.semester) === 2 ? 2 : 1) === selectedSemester));
        const updated = [...filtered, ...enrichedFormative];
        setLocalCache('cache_allFormative', updated);
        return updated;
      });

      setAllSummative(prev => {
        const filtered = prev.filter(s => !(isClassMatch(s.kelas, activeClassName) && (Number(s.semester) === 2 ? 2 : 1) === selectedSemester));
        const updated = [...filtered, ...enrichedSummative];
        setLocalCache('cache_allSummative', updated);
        return updated;
      });

      addToast('Data nilai berhasil disimpan ke Firebase!', 'success');
    } catch (err: any) {
      console.error('Error saving grades:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan nilai'), 'error');
    }
  };

  const handleSaveAttitude = async (records: GradeAttitude[]) => {
    try {
      const enrichedRecords = records.map(r => ({
        ...r,
        kelas: activeClassName,
        semester: selectedSemester
      }));
      await saveAttitudeGradesToFirestore(enrichedRecords);

      setAllAttitude(prev => {
        const filtered = prev.filter(
          a => !(isClassMatch(a.kelas, activeClassName) && (Number(a.semester) === 2 ? 2 : 1) === selectedSemester)
        );
        const updated = [...filtered, ...enrichedRecords];
        setLocalCache('cache_allAttitude', updated);
        return updated;
      });

      addToast('Data nilai sikap berhasil disimpan ke Firebase!', 'success');
    } catch (err: any) {
      console.error('Error saving attitude grades:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan nilai sikap'), 'error');
    }
  };

  const handleUpdateGradeWeights = async (newWeights: GradeWeightConfig) => {
    try {
      await saveGradeWeightConfigToFirestore(newWeights);
      setGradeWeights(newWeights);
      setLocalCache('cache_gradeWeights', newWeights);
      addToast('Bobot persentase penilaian berhasil diperbarui!', 'success');
    } catch (err: any) {
      console.error('Error saving grade weights:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan bobot penilaian'), 'error');
    }
  };

  const handleSyncRoster = async (updatedStudents: Student[], _nisChanges?: Record<string, string>, targetNis?: string) => {
    try {
      const enriched = updatedStudents.map(s => ({ ...s, kelas: activeClassName }));
      await saveStudentsToFirestoreForClass(activeClassName, enriched, targetNis);

      const activeNum = activeClassName.replace(/^Kelas\s+/i, '').trim();
      const targetNisList = targetNis ? targetNis.split(',').map(n => n.trim()).filter(Boolean) : [];
      const targetNisSet = new Set(targetNisList);

      setAllStudents(prev => {
        const filtered = prev.filter(s => {
          if (targetNisSet.has(s.nis)) return false;
          const sClass = s.kelas || 'Kelas 8.1';
          const sClassNum = sClass.replace(/^Kelas\s+/i, '').trim();
          return sClass !== activeClassName && sClassNum !== activeNum;
        });
        return [...filtered, ...enriched];
      });
      addToast('Daftar siswa kelas berhasil diperbarui di Firebase!', 'success');
    } catch (err: any) {
      console.error('Error syncing roster:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal memperbarui daftar siswa'), 'error');
    }
  };

  const handleSyncClasses = async (updatedClasses: { id: number; name: string }[]) => {
    try {
      await saveClassesToFirestore(updatedClasses);
      setClasses(updatedClasses);
      addToast('Daftar kelas berhasil disimpan!', 'success');
    } catch (err: any) {
      console.error('Error syncing classes:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan daftar kelas'), 'error');
    }
  };

  const handleSaveNote = async (note: StudentNote) => {
    try {
      const enrichedNote = { ...note, kelas: activeClassName, semester: selectedSemester };
      const savedId = await saveStudentNoteToFirestore(enrichedNote);
      const finalNote = { ...enrichedNote, id: savedId };
      setAllNotes(prev => {
        const idx = prev.findIndex(n => n.id === savedId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = finalNote;
          return copy;
        }
        return [finalNote, ...prev];
      });
      addToast('Catatan siswa berhasil disimpan ke Firebase!', 'success');
    } catch (err: any) {
      console.error('Error saving student note:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan catatan siswa'), 'error');
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!id) return;
    try {
      await deleteStudentNoteFromFirestore(id);
      setAllNotes(prev => prev.filter(n => n.id !== id));
      addToast('Catatan siswa berhasil dihapus.', 'info');
    } catch (err: any) {
      console.error('Error deleting student note:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menghapus catatan siswa'), 'error');
    }
  };

  const handleSaveJournal = async (journal: JurnalHarianRecord) => {
    try {
      const enriched = { ...journal, kelas: activeClassName, semester: selectedSemester };
      const savedId = await saveJournalToFirestore(enriched);
      const finalJournal = { ...enriched, id: savedId };
      setAllJournals(prev => {
        const idx = prev.findIndex(j => j.id === savedId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = finalJournal;
          return copy;
        }
        return [finalJournal, ...prev];
      });
      addToast('Jurnal harian berhasil disimpan ke Firebase!', 'success');
    } catch (err: any) {
      console.error('Error saving journal:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan jurnal harian'), 'error');
    }
  };

  const handleBulkUpdateJournals = (updatedJournals: JurnalHarianRecord[]) => {
    if (!updatedJournals || updatedJournals.length === 0) return;
    try {
      setAllJournals(prev => {
        const updateMap = new Map(updatedJournals.map(j => [j.id, j]));
        const nextList = prev.map(j => updateMap.get(j.id) || j);
        setLocalCache('cache_allJournals', nextList);
        return nextList;
      });
    } catch (err: any) {
      console.error('Error bulk updating journals in state:', err);
    }
  };

  const handleDeleteJournal = async (idOrJournal: string | JurnalHarianRecord) => {
    if (!idOrJournal) return;
    const targetId = typeof idOrJournal === 'string' ? idOrJournal : idOrJournal.id;
    const targetRecord = typeof idOrJournal === 'object' ? idOrJournal : allJournals.find(j => j.id === targetId);

    try {
      if (targetRecord) {
        await deleteJournalFromFirestore({ id: targetRecord.id, tanggal: targetRecord.tanggal, kelas: targetRecord.kelas });
      } else if (targetId) {
        await deleteJournalFromFirestore(targetId);
      }
      setAllJournals(prev => prev.filter(j => {
        if (targetId && j.id === targetId) return false;
        if (targetRecord && j.tanggal === targetRecord.tanggal && j.kelas === targetRecord.kelas) return false;
        return true;
      }));
      addToast('Jurnal harian berhasil dihapus dari database.', 'info');
    } catch (err: any) {
      console.error('Error deleting journal:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menghapus jurnal harian'), 'error');
    }
  };

  const handleSyncExtraTikPeserta = async (list: ExtraTikPeserta[], deletedNis?: string) => {
    try {
      await saveExtraTikPesertaToFirestore(list, deletedNis);
      setExtraTikPeserta(list);
      addToast(deletedNis ? 'Peserta Extra TIK berhasil dihapus dari Firebase!' : 'Data peserta Extra TIK tersimpan ke Firebase!', 'success');
    } catch (err: any) {
      console.error('Error syncing extra tik peserta:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan peserta Extra TIK'), 'error');
    }
  };

  const handleSyncExtraTikAbsensi = async (list: ExtraTikAbsensi[], dateToClear?: string, classToClear?: string) => {
    try {
      if (dateToClear) {
        await deleteExtraTikAbsensiByDateFromFirestore(dateToClear, classToClear);
      }
      await saveExtraTikAbsensiToFirestore(list);
      setExtraTikAbsensi(list);
      if (dateToClear && list.length < extraTikAbsensi.length) {
        addToast('Data absensi Extra TIK berhasil diperbarui / dihapus dari Firebase.', 'info');
      } else {
        addToast('Data absensi Extra TIK tersimpan ke Firebase!', 'success');
      }
    } catch (err: any) {
      console.error('Error syncing extra tik absensi:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan absensi Extra TIK'), 'error');
    }
  };

  const handleSyncExtraTikNilai = async (list: ExtraTikNilai[]) => {
    try {
      await saveExtraTikNilaiToFirestore(list);
      setExtraTikNilai(list);
      addToast('Data nilai Extra TIK tersimpan ke Firebase!', 'success');
    } catch (err: any) {
      console.error('Error syncing extra tik nilai:', err);
      addToast(getFriendlyErrorMessage(err, 'Gagal menyimpan nilai Extra TIK'), 'error');
    }
  };

  // Sign In Actions
  const handleGuruSignIn = async (password: string): Promise<boolean> => {
    if (password !== teacherPassword) {
      return false;
    }

    setIsLoggingIn(true);
    // Instant optimistic UI transition
    setRole('guru');
    localStorage.setItem('user_role', 'guru');
    localStorage.setItem('user_logged_in', 'true');
    setNeedsAuth(false);
    setIsLoggingIn(false);
    addToast('Berhasil masuk sebagai Guru', 'success');

    // Asynchronous background Auth & Data loading
    anonymousSignIn()
      .then((res) => {
        if (res?.user) setUser(res.user);
        else setUser({ uid: 'guest_teacher_user', isAnonymous: true, displayName: 'Guru' } as any);
      })
      .catch((err) => {
        console.warn('Fallback anonymous sign-in:', err);
        setUser({ uid: 'guest_teacher_user', isAnonymous: true, displayName: 'Guru' } as any);
      });

    loadAllDatabaseData();
    return true;
  };

  const handleAdminSignIn = async (password: string): Promise<boolean> => {
    if (password !== 'budiardika25') {
      return false;
    }

    setIsLoggingIn(true);
    // Instant optimistic UI transition
    setRole('admin');
    localStorage.setItem('user_role', 'admin');
    localStorage.setItem('user_logged_in', 'true');
    setNeedsAuth(false);
    setIsLoggingIn(false);
    addToast('Berhasil masuk sebagai Admin', 'success');

    // Asynchronous background Auth & Data loading
    anonymousSignIn()
      .then((res) => {
        if (res?.user) setUser(res.user);
        else setUser({ uid: 'guest_admin_user', isAnonymous: true, displayName: 'Admin' } as any);
      })
      .catch((err) => {
        console.warn('Fallback anonymous sign-in:', err);
        setUser({ uid: 'guest_admin_user', isAnonymous: true, displayName: 'Admin' } as any);
      });

    loadAllDatabaseData();
    return true;
  };

  const handleLogout = async () => {
    localStorage.removeItem('user_logged_in');
    localStorage.removeItem('user_role');
    await logout().catch((e) => console.warn('Logout error:', e));
    setUser(null);
    setNeedsAuth(true);
    addToast('Anda telah keluar dari sistem.', 'info');
  };

  const handleSwitchRole = (targetRole: 'admin' | 'guru') => {
    if (targetRole === role) return;

    if (targetRole === 'guru') {
      setRole('guru');
      localStorage.setItem('user_role', 'guru');
      addToast('Hak akses diubah ke Guru', 'info');
    } else {
      // Require Admin Password
      setAdminPasswordInput('');
      setAdminPasswordModalError('');
      setIsAdminAuthModalOpen(true);
    }
  };

  const handleConfirmAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordModalError('');
    if (!adminPasswordInput) {
      setAdminPasswordModalError('Silakan masukkan password Admin.');
      return;
    }

    if (adminPasswordInput === 'budiardika25') {
      setRole('admin');
      localStorage.setItem('user_role', 'admin');
      setIsAdminAuthModalOpen(false);
      setAdminPasswordInput('');
      addToast('Hak akses berhasil diubah ke Admin!', 'success');
    } else {
      setAdminPasswordModalError('Password Admin salah! Silakan coba lagi.');
    }
  };

  if (needsAuth) {
    return (
      <LoginPage
        onGuruSignIn={handleGuruSignIn}
        onAdminSignIn={handleAdminSignIn}
        isLoggingIn={isLoggingIn}
        isSyncingData={isLoadingData}
        errorMsg={errorMsg}
        appLogoUrl={appLogoUrl}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col w-full max-w-full overflow-x-clip">
      {/* Toast Notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`p-4 rounded-2xl shadow-xl border text-xs font-bold pointer-events-auto flex items-center justify-between gap-3 ${
                toast.type === 'success'
                  ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                  : toast.type === 'error'
                  ? 'bg-rose-900 text-rose-100 border-rose-700'
                  : 'bg-slate-900 text-slate-100 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Frozen Sticky Header & Navigation Container */}
      <div className="sticky top-0 z-50 bg-white backdrop-blur-md print:hidden w-full shadow-md border-b border-slate-200/80">
        {/* Main App Navbar */}
        <header className="bg-transparent w-full">
          <div className="w-full px-2.5 sm:px-3 md:px-4 lg:px-6 xl:px-8">
            <div className="flex items-center justify-between h-16 gap-1.5 sm:gap-2">
              
              {/* Left Brand */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
                {appLogoUrl && !logoHeaderError ? (
                  <img
                    src={convertGoogleDriveUrl(appLogoUrl)}
                    alt="Logo Portal"
                    className="h-8 sm:h-9 md:h-10 lg:h-12 w-auto object-contain shrink-0"
                    onError={() => setLogoHeaderError(true)}
                  />
                ) : (
                  <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 lg:h-11 lg:w-11 bg-linear-to-tr from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
                    <Database className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-xs sm:text-sm md:text-base lg:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                    <span className="truncate">S I M P A N</span>
                    <span className="hidden xl:inline-block text-[10px] lg:text-xs font-extrabold bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                      Sistem Manajemen Presensi &amp; Nilai
                    </span>
                  </h1>
                  <p className="text-[10px] sm:text-[11px] lg:text-xs font-bold text-indigo-600 truncate hidden sm:block">
                    Sistem Manajemen Presensi &amp; Nilai ({role === 'admin' ? 'Mode Admin' : 'Mode Guru'})
                  </p>
                </div>
              </div>

              {/* Right Class Selector & User Role Controls */}
              <div className="hidden md:flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
                {/* Spin Siswa Button */}
                <button
                  onClick={() => setIsSpinModalOpen(true)}
                  className="px-2 py-1.5 lg:px-2.5 lg:py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs lg:text-sm font-black border border-amber-200/80 shadow-2xs group shrink-0"
                  title={`Acak / Spin Siswa ${activeClassName} untuk Maju Menjawab`}
                >
                  <Dices className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-600 group-hover:rotate-180 transition-transform duration-500" />
                  <span className="hidden 2xl:inline">Spin Siswa</span>
                </button>

                {/* Bagi Kelompok Button */}
                <button
                  onClick={() => setIsGroupModalOpen(true)}
                  className="px-2 py-1.5 lg:px-2.5 lg:py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs lg:text-sm font-black border border-emerald-200/80 shadow-2xs group shrink-0"
                  title={`Bagi Kelompok Siswa ${activeClassName}`}
                >
                  <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-emerald-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="hidden 2xl:inline">Kelompok</span>
                </button>

                {/* Sync / Refresh Button with Stale-While-Revalidate Indicator */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleManualRefresh}
                    disabled={isLoadingData || isRevalidating}
                    className="px-2 py-1.5 lg:px-2.5 lg:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs lg:text-sm font-black border border-indigo-150 disabled:opacity-50 shrink-0"
                    title="Sinkronkan Data Firebase"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 text-indigo-600 ${isLoadingData || isRevalidating ? 'animate-spin' : ''}`} />
                    <span className="hidden xl:inline">{isRevalidating ? 'Syncing...' : 'Sync'}</span>
                  </button>

                  {isRevalidating ? (
                    <span className="hidden 2xl:flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-bold animate-pulse">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      Syncing...
                    </span>
                  ) : isOfflineMode ? (
                    <span className="hidden 2xl:inline text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/80">
                      ⚡ Mode Offline (Cache Lokal)
                    </span>
                  ) : lastSyncedAt ? (
                    <span className="hidden 2xl:inline text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/80">
                      Tersinkron {lastSyncedAt}
                    </span>
                  ) : null}
                </div>

                {role === 'admin' && (
                  <button
                    onClick={() => {
                      setDeepCleanResult(null);
                      setIsDeepCleanModalOpen(true);
                    }}
                    className="px-2 py-1.5 lg:px-2.5 lg:py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs lg:text-sm font-black transition cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                    title="Deep Clean Database: Hapus data yatim / dummy tidak terhubung kelas"
                  >
                    <Sparkles className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-rose-600 animate-pulse" />
                    <span className="hidden 2xl:inline">Deep Clean</span>
                  </button>
                )}

                {/* Class Switcher Dropdown */}
                <div className="flex items-center gap-1 bg-slate-50 p-1 lg:p-1.5 rounded-xl border border-slate-200 shrink-0">
                  <Layers className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-indigo-600 ml-0.5 shrink-0" />
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(Number(e.target.value))}
                    className="bg-transparent text-xs lg:text-sm font-black text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Semester Switcher Dropdown */}
                <div className="flex items-center gap-1 bg-indigo-50/80 p-1 lg:p-1.5 rounded-xl border border-indigo-200 shrink-0">
                  <CalendarRange className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-indigo-700 ml-0.5 shrink-0" />
                  <select
                    value={selectedSemester}
                    onChange={e => handleSelectSemester(Number(e.target.value) as 1 | 2)}
                    className="bg-transparent text-xs lg:text-sm font-black text-indigo-950 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value={1}>Sem 1 (Ganjil)</option>
                    <option value={2}>Sem 2 (Genap)</option>
                  </select>
                </div>

                {/* Role Toggle */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200 text-xs font-bold shrink-0">
                  <button
                    onClick={() => handleSwitchRole('admin')}
                    className={`px-2 lg:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      role === 'admin' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => handleSwitchRole('guru')}
                    className={`px-2 lg:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      role === 'guru' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Guru
                  </button>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-1.5 lg:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                  title="Keluar Sistem"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile / Tablet Hamburger Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                title="Buka Menu Aksi"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile & Tablet Dropdown Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-200 p-3.5 sm:p-4 bg-slate-50 space-y-3 max-w-full overflow-x-hidden">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pilih Kelas</label>
                  <select
                    value={selectedClassId}
                    onChange={e => {
                      setSelectedClassId(Number(e.target.value));
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-white p-2 rounded-xl border border-slate-200 text-xs font-black text-slate-800"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">Pilih Semester</label>
                  <select
                    value={selectedSemester}
                    onChange={e => {
                      handleSelectSemester(Number(e.target.value) as 1 | 2);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-indigo-50 p-2 rounded-xl border border-indigo-200 text-xs font-black text-indigo-950"
                  >
                    <option value={1}>Sem 1 (Ganjil)</option>
                    <option value={2}>Sem 2 (Genap)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-slate-600">Peran Pengguna:</span>
                <div className="bg-slate-200 p-1 rounded-xl flex items-center gap-1 text-xs font-bold">
                  <button
                    onClick={() => {
                      handleSwitchRole('admin');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-3 py-1 rounded-lg ${role === 'admin' ? 'bg-white text-indigo-700' : 'text-slate-600'}`}
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => {
                      handleSwitchRole('guru');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-3 py-1 rounded-lg ${role === 'guru' ? 'bg-white text-indigo-700' : 'text-slate-600'}`}
                  >
                    Guru
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsSpinModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-2.5 bg-amber-50 text-amber-800 font-extrabold text-xs rounded-xl border border-amber-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Dices className="w-4 h-4 text-amber-600" />
                <span>Spin Siswa Maju ({activeClassName})</span>
              </button>

              <button
                onClick={() => {
                  setIsGroupModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-2.5 bg-emerald-50 text-emerald-800 font-extrabold text-xs rounded-xl border border-emerald-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Bagi Kelompok Siswa ({activeClassName})</span>
              </button>

              <button
                onClick={() => {
                  handleManualRefresh();
                  setIsMobileMenuOpen(false);
                }}
                disabled={isLoadingData}
                className="w-full py-2.5 bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-indigo-600 ${isLoadingData ? 'animate-spin' : ''}`} />
                <span>Sinkronkan Data Firebase</span>
              </button>

              {role === 'admin' && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setDeepCleanResult(null);
                    setIsDeepCleanModalOpen(true);
                  }}
                  className="w-full py-2.5 bg-rose-50 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-rose-600 animate-pulse" />
                  <span>Deep Clean Database</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-rose-50 text-rose-600 font-extrabold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Keluar Sistem
              </button>
            </div>
          )}
        </header>

        {/* Main App Navigation Tabs Bar */}
        <div className="bg-white border-b border-slate-200 w-full overflow-hidden">
          <div className="w-full px-2.5 sm:px-3 md:px-4 lg:px-6 xl:px-8">
            <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-2 scrollbar-none flex-nowrap">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'attendance'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Absensi Harian
              </button>

              <button
                onClick={() => setActiveTab('journal')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'journal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Jurnal Harian
              </button>

              <button
                onClick={() => setActiveTab('grades')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'grades'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Nilai Akademik
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'notes'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Catatan Siswa
              </button>

              <button
                onClick={() => setActiveTab('recap')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'recap'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <PieChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Rekapitulasi
              </button>

              <button
                onClick={() => setActiveTab('students')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'students'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Kelola Siswa
              </button>

              <button
                onClick={() => setActiveTab('extra_tik')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'extra_tik'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Extra TIK
              </button>

              <button
                onClick={() => setActiveTab('professional_report')}
                className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'professional_report'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                Cetak Laporan
              </button>

              {role === 'admin' && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-2.5 sm:px-3 md:px-3.5 lg:px-4 py-1.5 sm:py-2 rounded-xl text-xs lg:text-sm font-black transition flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5" />
                  Pengaturan
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content View */}
      <main className="flex-1 w-full max-w-full px-2.5 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 md:py-6 overflow-x-hidden">
        {isLoadingData ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
              Memuat data dari Firebase Firestore...
            </p>
          </div>
        ) : (
          <div className="w-full max-w-full">
            {/* Active Class Info Header */}
            <div className="mb-4 sm:mb-6 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-black text-xs">
                  {activeClassName}
                </span>
                <span className="p-2.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl font-black text-xs flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-amber-600" />
                  Semester {selectedSemester} ({selectedSemester === 1 ? 'Ganjil' : 'Genap'})
                </span>
                <div className="ml-1">
                  <p className="text-xs font-bold text-slate-800">
                    Siswa Terdaftar: <span className="text-indigo-600">{classStudents.length} murid</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Database Firebase terhubung &amp; tersinkronisasi otomatis.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-3 py-1.5 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5" />
                Firebase Cloud Database Safe
              </div>
            </div>

            {/* TAB CONTENT */}
            <ErrorBoundary key={activeTab} fallbackTitle="Gagal Memuat Halaman Modul">
              {activeTab === 'attendance' && (
                <AttendanceTab
                  students={classStudents}
                  attendance={classAttendance}
                  dateNotes={classDateNotes}
                  classSchedule={currentClassSchedule}
                  className={activeClassName}
                  onSave={handleSaveAttendance}
                  onDelete={handleDeleteAttendance}
                  onSaveDateNote={handleSaveDateNote}
                  onDeleteDateNote={handleDeleteDateNote}
                />
              )}

                {activeTab === 'journal' && (
                  <JurnalHarianTab
                    journals={classJournals}
                    allJournals={allJournals}
                    students={classStudents}
                    attendance={classAttendance}
                    studentNotes={classNotes}
                    dateNotes={classDateNotes}
                    activeClassName={activeClassName}
                    classSchedule={currentClassSchedule}
                    onSaveJournal={handleSaveJournal}
                    onDeleteJournal={handleDeleteJournal}
                    onBulkUpdateJournals={handleBulkUpdateJournals}
                    selectedSemester={selectedSemester}
                  />
                )}

                {activeTab === 'grades' && (
                  <GradesTab
                    students={classStudents}
                    formativeGrades={classFormative}
                    summativeGrades={classSummative}
                    attitudeGrades={classAttitude}
                    formativeCols={formativeCols}
                    setFormativeCols={handleSetFormativeCols}
                    summativeCols={summativeCols}
                    setSummativeCols={handleSetSummativeCols}
                    formativeColsSem1={formativeColsSem1}
                    formativeColsSem2={formativeColsSem2}
                    summativeColsSem1={summativeColsSem1}
                    summativeColsSem2={summativeColsSem2}
                    selectedSemester={selectedSemester}
                    gradeWeights={gradeWeights}
                    studentNotes={classNotes}
                    attendance={classAttendance}
                    recap={classRecap}
                    onSave={handleSaveGrades}
                    onSaveAttitude={handleSaveAttitude}
                  />
                )}

                {activeTab === 'notes' && (
                  <StudentNotesTab
                    students={classStudents}
                    notes={classNotes}
                    onSaveNote={handleSaveNote}
                    onDeleteNote={handleDeleteNote}
                  />
                )}

                {activeTab === 'recap' && (
                  <RecapTab
                    students={classStudents}
                    formativeGrades={classFormative}
                    summativeGrades={classSummative}
                    attitudeGrades={classAttitude}
                    gradeWeights={gradeWeights}
                    recap={classRecap}
                    formativeCols={formativeCols}
                    summativeCols={summativeCols}
                    notes={classNotes}
                    selectedSemester={selectedSemester}
                    allAttendance={allAttendance}
                    allFormative={allFormative}
                    allSummative={allSummative}
                    allNotes={allNotes}
                    activeClassName={activeClassName}
                  />
                )}

                {activeTab === 'students' && (
                  <StudentsTab
                    students={classStudents}
                    allStudents={allStudents}
                    onSyncRoster={handleSyncRoster}
                    role={role}
                    classes={classes}
                    selectedClassId={selectedClassId}
                    onSelectClassId={setSelectedClassId}
                    onSyncClasses={handleSyncClasses}
                    onDeepClean={() => {
                      setDeepCleanResult(null);
                      setIsDeepCleanModalOpen(true);
                    }}
                  />
                )}

                {activeTab === 'extra_tik' && (
                  <ExtraTIKTab
                    students={allStudents}
                    extraTikPeserta={extraTikPeserta}
                    extraTikAbsensi={extraTikAbsensi}
                    extraTikNilai={extraTikNilai}
                    onSyncPeserta={handleSyncExtraTikPeserta}
                    onSyncAbsensi={handleSyncExtraTikAbsensi}
                    onSyncNilai={handleSyncExtraTikNilai}
                    onBackToDashboard={() => setActiveTab('attendance')}
                    classes={classes}
                  />
                )}

                {activeTab === 'professional_report' && (
                  <ProfessionalReportTab
                    students={classStudents}
                    attendance={classAttendance}
                    formativeGrades={classFormative}
                    summativeGrades={classSummative}
                    attitudeGrades={classAttitude}
                    gradeWeights={gradeWeights}
                    recap={classRecap}
                    notes={classNotes}
                    journals={classJournals}
                    formativeCols={formativeCols}
                    summativeCols={summativeCols}
                    activeClassName={activeClassName}
                    extraTikPeserta={extraTikPeserta}
                    extraTikAbsensi={extraTikAbsensi}
                    extraTikNilai={extraTikNilai}
                    selectedSemester={selectedSemester}
                    allAttendance={allAttendance}
                    allFormative={allFormative}
                    allSummative={allSummative}
                    allNotes={allNotes}
                    allJournals={allJournals}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsTab
                    classes={classes}
                    role={role}
                    onRefreshData={loadAllDatabaseData}
                    addToast={addToast}
                    appLogoUrl={appLogoUrl}
                    onUpdateAppLogoUrl={handleUpdateAppLogoUrl}
                    teacherPassword={teacherPassword}
                    onUpdateTeacherPassword={handleUpdateTeacherPassword}
                    gradeWeights={gradeWeights}
                    onUpdateGradeWeights={handleUpdateGradeWeights}
                    classSchedules={classSchedules}
                    onUpdateClassSchedules={handleUpdateClassSchedules}
                    allAppData={{
                      classes,
                      students: allStudents,
                      attendance: allAttendance,
                      formativeGrades: allFormative,
                      summativeGrades: allSummative,
                      formativeCols,
                      summativeCols,
                      studentNotes: allNotes,
                      journals: allJournals,
                      extraTikPeserta,
                      extraTikAbsensi,
                      extraTikNilai,
                      attitudeGrades: allAttitude,
                      gradeWeights,
                      classSchedules
                    }}
                  />
                )}
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-bold print:hidden">
        Aplikasi Pencatat Absensi &amp; Nilai Siswa — Sepenuhnya Berbasis Firebase Firestore
      </footer>

      {/* Admin Password Verification Modal */}
      {isAdminAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-5 relative">
            <button
              type="button"
              onClick={() => setIsAdminAuthModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Verifikasi Akses Admin</h3>
                <p className="text-xs font-medium text-slate-500">Masukkan password Admin untuk mengubah hak akses.</p>
              </div>
            </div>

            <form onSubmit={handleConfirmAdminPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  Password Admin
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoFocus
                    value={adminPasswordInput}
                    onChange={e => {
                      setAdminPasswordInput(e.target.value);
                      setAdminPasswordModalError('');
                    }}
                    placeholder="Masukkan password Admin..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
                {adminPasswordModalError && (
                  <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{adminPasswordModalError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminAuthModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-100 transition cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verifikasi &amp; Masuk Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deep Clean Database Modal */}
      {isDeepCleanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl p-6 overflow-hidden relative">
            <button
              type="button"
              onClick={() => {
                setIsDeepCleanModalOpen(false);
                setDeepCleanResult(null);
              }}
              disabled={isDeepCleaning}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Deep Clean Database Firebase</h3>
                <p className="text-xs font-bold text-slate-400">Pembersihan Otomatis Data Yatim &amp; Dummy</p>
              </div>
            </div>

            {!deepCleanResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-rose-50/80 border border-rose-150 rounded-2xl text-xs text-rose-900 leading-relaxed space-y-2">
                  <p className="font-extrabold flex items-center gap-1.5 text-rose-900 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    Pemberitahuan Sistem Admin:
                  </p>
                  <p>
                    Fitur ini akan memindai seluruh koleksi Firestore (<code>students</code>, <code>attendance</code>, <code>grades_formative</code>, <code>grades_summative</code>, <code>student_notes</code>, <code>journals</code>, dan <code>extra_tik</code>) serta menghapus secara permanen data yatim/dummy yang <strong>tidak terdaftar dalam {classes.length} kelas aktif</strong> saat ini.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    {classes.length} Kelas Aktif yang Dipertahankan:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {classes.map(c => (
                      <span key={c.id} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-extrabold text-[11px] rounded-xl shadow-2xs">
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-medium">
                  💡 Seluruh siswa dan rekaman transaksi di luar daftar kelas di atas akan dibersihkan guna menghemat kuota Firestore dan mempercepat performa loading.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isDeepCleaning}
                    onClick={() => setIsDeepCleanModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isDeepCleaning}
                    onClick={handleRunDeepClean}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md shadow-rose-100 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isDeepCleaning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memproses Pembersihan Firebase...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Jalankan Deep Clean Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* RESULT STATS REPORT */
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Deep Clean berhasil dilakukan! Firestore database kini bersih &amp; optimal.</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500">Total Dokumen Dihapus</p>
                    <p className="text-2xl font-black text-rose-700">{deepCleanResult.totalDeletedDocs} <span className="text-xs font-bold text-rose-400">item</span></p>
                  </div>
                  <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Siswa Aktif Terjaga</p>
                    <p className="text-2xl font-black text-emerald-700">{deepCleanResult.activeStudentsCount} <span className="text-xs font-bold text-emerald-500">murid</span></p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
                  <p className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between">
                    <span>Rincian Item yang Dibersihkan:</span>
                    <span className="text-indigo-600 font-black">{deepCleanResult.activeClassesCount} Kelas Aktif</span>
                  </p>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px] text-slate-600 font-semibold">
                    <div>• Siswa Yatim: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedStudentsCount}</strong></div>
                    <div>• Presensi Yatim: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedAttendanceCount}</strong></div>
                    <div>• Nilai Formatif: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedFormativeGradesCount}</strong></div>
                    <div>• Nilai Sumatif: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedSummativeGradesCount}</strong></div>
                    <div>• Catatan Siswa: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedNotesCount}</strong></div>
                    <div>• Jurnal Harian: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedJournalsCount}</strong></div>
                    <div>• Extra TIK Peserta: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedExtraTikPesertaCount}</strong></div>
                    <div>• Extra TIK Presensi: <strong className="text-slate-900 font-bold">{deepCleanResult.deletedExtraTikAbsensiCount}</strong></div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeepCleanModalOpen(false);
                      setDeepCleanResult(null);
                    }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer"
                  >
                    Tutup &amp; Selesai
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spin Siswa Wheel Modal */}
      <StudentSpinnerModal
        isOpen={isSpinModalOpen}
        onClose={() => setIsSpinModalOpen(false)}
        students={classStudents}
        classNameText={activeClassName}
      />

      {/* Bagi Kelompok Siswa Modal */}
      <GroupDividerModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        students={classStudents}
        classNameText={activeClassName}
      />
    </div>
  );
}
