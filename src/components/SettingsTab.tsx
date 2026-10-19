import React, { useState, useEffect, useRef } from 'react';
import { 
  DatabaseOverallStats, 
  CollectionStat, 
  getDatabaseStatsFromFirestore,
  deepCleanDatabaseFromFirestore,
  restoreDatabaseFromJSON,
  DeepCleanResult
} from '../lib/firestoreService';
import { 
  Student, 
  AttendanceRecord, 
  GradeFormative, 
  GradeSummative, 
  GradeColumn, 
  StudentNote, 
  JurnalHarianRecord, 
  ExtraTikPeserta, 
  ExtraTikAbsensi, 
  ExtraTikNilai,
  GradeWeightConfig,
  GradeAttitude,
  ClassSchedule,
  DayOfWeek,
  ScheduleVersion
} from '../types';
import { DEFAULT_GRADE_WEIGHTS } from '../utils/gradeCalculator';
import { DAYS_OF_WEEK } from '../utils/scheduleHelper';
import { 
  Settings, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  HardDrive, 
  Database, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  FileText, 
  Loader2, 
  Info, 
  Sliders, 
  Cpu, 
  Lock, 
  Check, 
  Download, 
  Upload, 
  FileJson, 
  Image as ImageIcon, 
  Save, 
  Link as LinkIcon, 
  X, 
  KeyRound, 
  ArrowLeft,
  ChevronRight,
  Grid, 
  Table, 
  Search, 
  Eye, 
  Filter, 
  Calculator, 
  Percent, 
  RotateCcw,
  Calendar,
  CalendarCheck,
  CalendarRange,
  CalendarDays,
  Clock,
  MapPin,
  Bell,
  History,
  Plus,
  Edit3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Radio
} from 'lucide-react';
import { convertGoogleDriveUrl } from '../utils/imageHelper';

interface SettingsTabProps {
  classes: { id: number; name: string }[];
  role: 'admin' | 'guru';
  onRefreshData: () => Promise<void>;
  addToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  appLogoUrl?: string;
  onUpdateAppLogoUrl?: (newUrl: string) => Promise<void>;
  teacherPassword?: string;
  onUpdateTeacherPassword?: (newPassword: string) => Promise<void>;
  gradeWeights?: GradeWeightConfig;
  onUpdateGradeWeights?: (newWeights: GradeWeightConfig) => Promise<void>;
  classSchedules?: Record<string, ClassSchedule>;
  onUpdateClassSchedules?: (newSchedules: Record<string, ClassSchedule>) => Promise<void>;
  allAppData?: {
    classes: { id: number; name: string }[];
    students: Student[];
    attendance: AttendanceRecord[];
    formativeGrades: GradeFormative[];
    summativeGrades: GradeSummative[];
    formativeCols: GradeColumn[];
    summativeCols: GradeColumn[];
    studentNotes: StudentNote[];
    journals: JurnalHarianRecord[];
    extraTikPeserta: ExtraTikPeserta[];
    extraTikAbsensi: ExtraTikAbsensi[];
    extraTikNilai: ExtraTikNilai[];
    attitudeGrades?: GradeAttitude[];
    gradeWeights?: GradeWeightConfig;
    classSchedules?: Record<string, ClassSchedule>;
  };
}

export type SettingTabId = 'all' | 'schedule' | 'weights' | 'logo' | 'password' | 'backup' | 'cleaning' | 'collections' | 'table' | 'info';

export default function SettingsTab({ 
  classes, 
  role, 
  onRefreshData, 
  addToast, 
  appLogoUrl = '', 
  onUpdateAppLogoUrl, 
  teacherPassword = '12345',
  onUpdateTeacherPassword,
  gradeWeights = DEFAULT_GRADE_WEIGHTS,
  onUpdateGradeWeights,
  classSchedules = {},
  onUpdateClassSchedules,
  allAppData 
}: SettingsTabProps) {
  const [activeSettingTab, setActiveSettingTab] = useState<SettingTabId>('all');
  const [stats, setStats] = useState<DatabaseOverallStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Class Schedules state
  const [localSchedules, setLocalSchedules] = useState<Record<string, ClassSchedule>>(classSchedules || {});
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleFilterDay, setScheduleFilterDay] = useState<string>('all');

  // Find initial semester dates from existing schedules or default empty
  const initialSemesterStart = Object.values(classSchedules || {}).find(s => s && s.tanggalMulaiSemester)?.tanggalMulaiSemester || '';
  const initialSemesterEnd = Object.values(classSchedules || {}).find(s => s && s.tanggalSelesaiSemester)?.tanggalSelesaiSemester || '';

  const [globalSemesterStart, setGlobalSemesterStart] = useState<string>(initialSemesterStart);
  const [globalSemesterEnd, setGlobalSemesterEnd] = useState<string>(initialSemesterEnd);

  useEffect(() => {
    if (classSchedules) {
      setLocalSchedules(classSchedules);
      const start = Object.values(classSchedules).find(s => s && s.tanggalMulaiSemester)?.tanggalMulaiSemester || '';
      const end = Object.values(classSchedules).find(s => s && s.tanggalSelesaiSemester)?.tanggalSelesaiSemester || '';
      if (start) setGlobalSemesterStart(start);
      if (end) setGlobalSemesterEnd(end);
    }
  }, [classSchedules]);

  const handleToggleDayForClass = (className: string, day: DayOfWeek) => {
    const current = localSchedules[className] || { kelas: className, hari: [] };
    const currentDays = current.hari || [];
    const updatedDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    let updatedVersions = current.riwayatJadwal ? [...current.riwayatJadwal] : [];
    if (updatedVersions.length > 0) {
      let activeId = current.activeVersionId;
      let activeIdx = updatedVersions.findIndex(v => v.id === activeId || v.isActive);
      if (activeIdx === -1) activeIdx = updatedVersions.length - 1;
      if (activeIdx >= 0 && updatedVersions[activeIdx]) {
        updatedVersions[activeIdx] = {
          ...updatedVersions[activeIdx],
          hari: updatedDays
        };
      }
    }

    const updatedMap = {
      ...localSchedules,
      [className]: {
        ...current,
        kelas: className,
        hari: updatedDays,
        riwayatJadwal: updatedVersions
      }
    };

    setLocalSchedules(updatedMap);
    if (onUpdateClassSchedules) {
      queueMicrotask(() => {
        onUpdateClassSchedules(updatedMap);
      });
    }
  };

  const handleUpdateClassScheduleDetail = (
    className: string, 
    field: 'jamPelajaran' | 'ruang' | 'keterangan' | 'tanggalMulaiSemester' | 'tanggalSelesaiSemester', 
    val: string
  ) => {
    const current = localSchedules[className] || { kelas: className, hari: [] };
    let updatedVersions = current.riwayatJadwal ? [...current.riwayatJadwal] : [];
    if (['jamPelajaran', 'ruang', 'keterangan'].includes(field) && updatedVersions.length > 0) {
      let activeId = current.activeVersionId;
      let activeIdx = updatedVersions.findIndex(v => v.id === activeId || v.isActive);
      if (activeIdx === -1) activeIdx = updatedVersions.length - 1;
      if (activeIdx >= 0 && updatedVersions[activeIdx]) {
        updatedVersions[activeIdx] = {
          ...updatedVersions[activeIdx],
          [field]: val
        };
      }
    }

    const updatedMap = {
      ...localSchedules,
      [className]: {
        ...current,
        kelas: className,
        [field]: val,
        riwayatJadwal: updatedVersions
      }
    };

    setLocalSchedules(updatedMap);
    if (onUpdateClassSchedules) {
      queueMicrotask(() => {
        onUpdateClassSchedules(updatedMap);
      });
    }
  };

  const handleGlobalStartChange = (start: string) => {
    setGlobalSemesterStart(start);
    setLocalSchedules(prev => {
      const updated = { ...prev };
      classes.forEach(c => {
        const current = updated[c.name] || { kelas: c.name, hari: [] };
        updated[c.name] = {
          ...current,
          kelas: c.name,
          tanggalMulaiSemester: start
        };
      });
      return updated;
    });
  };

  const handleGlobalEndChange = (end: string) => {
    setGlobalSemesterEnd(end);
    setLocalSchedules(prev => {
      const updated = { ...prev };
      classes.forEach(c => {
        const current = updated[c.name] || { kelas: c.name, hari: [] };
        updated[c.name] = {
          ...current,
          kelas: c.name,
          tanggalSelesaiSemester: end
        };
      });
      return updated;
    });
  };

  const handleApplySemesterDatesToAll = (start: string, end: string) => {
    setGlobalSemesterStart(start);
    setGlobalSemesterEnd(end);
    setLocalSchedules(prev => {
      const updated = { ...prev };
      classes.forEach(c => {
        const current = updated[c.name] || { kelas: c.name, hari: [] };
        updated[c.name] = {
          ...current,
          kelas: c.name,
          tanggalMulaiSemester: start,
          tanggalSelesaiSemester: end
        };
      });
      return updated;
    });
    addToast('Rentang tanggal semester berhasil diterapkan ke semua kelas!', 'info');
  };

  // Schedule Version Modal state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [selectedClassForVersion, setSelectedClassForVersion] = useState<string>('');
  const [editingVersionIndex, setEditingVersionIndex] = useState<number | null>(null);
  const [expandedVersionsClass, setExpandedVersionsClass] = useState<string | null>(null);
  const [deleteConfirmScheduleVersion, setDeleteConfirmScheduleVersion] = useState<{
    className: string;
    versionIndex: number;
    label: string;
  } | null>(null);
  const [versionForm, setVersionForm] = useState<{
    label: string;
    tanggalMulai: string;
    tanggalSelesai: string;
    hari: DayOfWeek[];
    jamPelajaran: string;
    ruang: string;
    keterangan: string;
    autoAdjustPrevious: boolean;
  }>({
    label: '',
    tanggalMulai: '',
    tanggalSelesai: '',
    hari: [],
    jamPelajaran: '',
    ruang: '',
    keterangan: '',
    autoAdjustPrevious: true
  });

  const getDayBefore = (dateStr: string): string => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return dateStr;
    }
  };

  const handleOpenAddVersionModal = (className: string) => {
    const cur = localSchedules[className] || { kelas: className, hari: [] };
    const existingVersions = cur.riwayatJadwal || [];
    const nextVersionNum = existingVersions.length + (existingVersions.length === 0 && cur.hari.length > 0 ? 2 : 1);
    
    // Suggest default start date: today
    const today = new Date().toISOString().split('T')[0];

    setSelectedClassForVersion(className);
    setEditingVersionIndex(null);
    setVersionForm({
      label: `Roster ${nextVersionNum} (Mulai ${new Date(today).toLocaleDateString('id-ID', { month: 'short' })})`,
      tanggalMulai: today,
      tanggalSelesai: cur.tanggalSelesaiSemester || globalSemesterEnd || '',
      hari: cur.hari ? [...cur.hari] : [],
      jamPelajaran: cur.jamPelajaran || '',
      ruang: cur.ruang || '',
      keterangan: 'Perubahan jadwal belajar baru',
      autoAdjustPrevious: true
    });
    setIsVersionModalOpen(true);
  };

  const handleOpenEditVersionModal = (className: string, versionIndex: number) => {
    const cur = localSchedules[className] || { kelas: className, hari: [] };
    const existingVersions = cur.riwayatJadwal || [];
    const target = existingVersions[versionIndex];
    if (!target) return;

    setSelectedClassForVersion(className);
    setEditingVersionIndex(versionIndex);
    setVersionForm({
      label: target.label || `Roster ${versionIndex + 1}`,
      tanggalMulai: target.tanggalMulai || '',
      tanggalSelesai: target.tanggalSelesai || '',
      hari: Array.isArray(target.hari) ? [...target.hari] : [],
      jamPelajaran: target.jamPelajaran || '',
      ruang: target.ruang || '',
      keterangan: target.keterangan || '',
      autoAdjustPrevious: false
    });
    setIsVersionModalOpen(true);
  };

  const handleSaveVersionModal = () => {
    if (!selectedClassForVersion) return;
    if (!versionForm.tanggalMulai) {
      addToast('Harap tentukan tanggal mulai berlaku jadwal baru!', 'error');
      return;
    }
    if (versionForm.hari.length === 0) {
      addToast('Pilih minimal satu hari belajar untuk jadwal baru!', 'error');
      return;
    }

    const cur = localSchedules[selectedClassForVersion] || { kelas: selectedClassForVersion, hari: [] };
    let existingVersions: ScheduleVersion[] = Array.isArray(cur.riwayatJadwal) ? [...cur.riwayatJadwal] : [];

    // Ensure that if the new version starts after the semester start, there is an earlier version (Roster 1)
    // representing the initial/old schedule before this change
    const initialStartDate = cur.tanggalMulaiSemester || globalSemesterStart || '2026-07-01';
    const hasPriorVersion = existingVersions.some(v => v.tanggalMulai && v.tanggalMulai < versionForm.tanggalMulai);

    if (!hasPriorVersion && (cur.hari.length > 0 || cur.jamPelajaran || (cur.jadwalLama?.hari && cur.jadwalLama.hari.length > 0))) {
      const priorDays = cur.jadwalLama?.hari && cur.jadwalLama.hari.length > 0 ? cur.jadwalLama.hari : (cur.hari.length > 0 ? cur.hari : []);
      const initialEndDate = versionForm.tanggalMulai > initialStartDate 
        ? getDayBefore(versionForm.tanggalMulai)
        : initialStartDate;

      const baseVersion: ScheduleVersion = {
        id: 'ver_init_' + Date.now(),
        label: 'Roster 1 (Awal Semester)',
        tanggalMulai: initialStartDate,
        tanggalSelesai: initialEndDate,
        hari: [...priorDays],
        jamPelajaran: cur.jadwalLama?.jamPelajaran || cur.jamPelajaran,
        ruang: cur.jadwalLama?.ruang || cur.ruang,
        keterangan: 'Jadwal awal sebelum perubahan'
      };
      existingVersions.unshift(baseVersion);
    }

    let newActiveId = cur.activeVersionId;

    if (editingVersionIndex !== null) {
      // Edit existing version
      const targetId = existingVersions[editingVersionIndex]?.id || ('ver_' + Date.now());
      existingVersions[editingVersionIndex] = {
        ...existingVersions[editingVersionIndex],
        id: targetId,
        label: versionForm.label,
        tanggalMulai: versionForm.tanggalMulai,
        tanggalSelesai: versionForm.tanggalSelesai || undefined,
        hari: versionForm.hari,
        jamPelajaran: versionForm.jamPelajaran || undefined,
        ruang: versionForm.ruang || undefined,
        keterangan: versionForm.keterangan || undefined
      };
    } else {
      // Add new version - make the newly created roster the active one
      const newVersionId = 'ver_' + Date.now();
      newActiveId = newVersionId;

      if (versionForm.autoAdjustPrevious && existingVersions.length > 0) {
        // Adjust previous version end date
        const prevVerIndex = existingVersions.length - 1;
        const prevVer = existingVersions[prevVerIndex];
        if (prevVer && (!prevVer.tanggalSelesai || prevVer.tanggalSelesai >= versionForm.tanggalMulai)) {
          existingVersions[prevVerIndex] = {
            ...prevVer,
            tanggalSelesai: getDayBefore(versionForm.tanggalMulai)
          };
        }
      }

      const newVersion: ScheduleVersion = {
        id: newVersionId,
        label: versionForm.label || `Roster ${existingVersions.length + 1}`,
        tanggalMulai: versionForm.tanggalMulai,
        tanggalSelesai: versionForm.tanggalSelesai || undefined,
        hari: versionForm.hari,
        jamPelajaran: versionForm.jamPelajaran || undefined,
        ruang: versionForm.ruang || undefined,
        keterangan: versionForm.keterangan || undefined
      };
      existingVersions.push(newVersion);
    }

    // Sort versions chronologically by tanggalMulai
    existingVersions.sort((a, b) => a.tanggalMulai.localeCompare(b.tanggalMulai));

    let activeVer = newActiveId ? existingVersions.find(v => v.id === newActiveId) : undefined;
    if (!activeVer) {
      activeVer = existingVersions[existingVersions.length - 1];
      newActiveId = activeVer?.id;
    }

    // Mark isActive flag: exactly 1 active roster
    const updatedVersions = existingVersions.map(v => ({
      ...v,
      isActive: v.id === newActiveId
    }));

    const updatedClassSchedule = {
      ...cur,
      kelas: selectedClassForVersion,
      activeVersionId: newActiveId,
      hari: activeVer ? activeVer.hari : versionForm.hari,
      jamPelajaran: activeVer ? activeVer.jamPelajaran : versionForm.jamPelajaran,
      ruang: activeVer ? activeVer.ruang : versionForm.ruang,
      riwayatJadwal: updatedVersions,
      jadwalLama: (existingVersions.length > 0 && existingVersions[0].hari?.length > 0 && existingVersions[0].id !== newActiveId)
        ? {
            hari: [...existingVersions[0].hari],
            jamPelajaran: existingVersions[0].jamPelajaran,
            ruang: existingVersions[0].ruang,
            keterangan: existingVersions[0].keterangan
          }
        : (cur.jadwalLama || (cur.hari && cur.hari.length > 0 ? { hari: [...cur.hari], jamPelajaran: cur.jamPelajaran, ruang: cur.ruang } : undefined))
    };

    const updatedMap = {
      ...localSchedules,
      [selectedClassForVersion]: updatedClassSchedule
    };

    setLocalSchedules(updatedMap);
    if (onUpdateClassSchedules) {
      queueMicrotask(() => {
        onUpdateClassSchedules(updatedMap);
      });
    }

    setIsVersionModalOpen(false);
    addToast('Perubahan jadwal berhasil disimpan dan aktif secara real-time! ⚡', 'success');
  };

  const handleSetActiveScheduleVersion = (className: string, versionIdOrIndex: string | number) => {
    const cur = localSchedules[className] || { kelas: className, hari: [] };
    const existingVersions = Array.isArray(cur.riwayatJadwal) ? [...cur.riwayatJadwal] : [];
    if (existingVersions.length === 0) return;

    let targetVer: ScheduleVersion | undefined;
    if (typeof versionIdOrIndex === 'string') {
      targetVer = existingVersions.find(v => v.id === versionIdOrIndex);
    } else {
      targetVer = existingVersions[versionIdOrIndex];
    }

    if (!targetVer) return;

    const targetId = targetVer.id || `ver_${Date.now()}`;
    targetVer.id = targetId;

    const updatedVersions = existingVersions.map(v => ({
      ...v,
      isActive: (v.id === targetId || v === targetVer)
    }));

    const updatedClassSchedule = {
      ...cur,
      kelas: className,
      activeVersionId: targetId,
      hari: targetVer.hari || [],
      jamPelajaran: targetVer.jamPelajaran || '',
      ruang: targetVer.ruang || '',
      riwayatJadwal: updatedVersions
    };

    const updatedMap = {
      ...localSchedules,
      [className]: updatedClassSchedule
    };

    setLocalSchedules(updatedMap);
    if (onUpdateClassSchedules) {
      queueMicrotask(() => {
        onUpdateClassSchedules(updatedMap);
      });
    }

    addToast(`⚡ Roster aktif kelas ${className} berhasil dialihkan secara real-time!`, 'success');
  };

  const handleDeleteScheduleVersion = (className: string, versionIndex: number) => {
    const cur = localSchedules[className];
    const ver = cur?.riwayatJadwal?.[versionIndex];
    const label = ver?.label || `Roster ${versionIndex + 1}`;
    setDeleteConfirmScheduleVersion({ className, versionIndex, label });
  };

  const handleConfirmDeleteScheduleVersion = () => {
    if (!deleteConfirmScheduleVersion) return;
    const { className, versionIndex, label } = deleteConfirmScheduleVersion;

    const cur = localSchedules[className] || { kelas: className, hari: [] };
    const existingVersions = Array.isArray(cur.riwayatJadwal) ? [...cur.riwayatJadwal] : [];
    const removed = existingVersions.splice(versionIndex, 1)[0];

    let latestVer = existingVersions.length > 0 ? existingVersions[existingVersions.length - 1] : null;
    let newActiveId = cur.activeVersionId;

    if (removed && removed.id === cur.activeVersionId) {
      newActiveId = latestVer ? latestVer.id : undefined;
    }

    if (newActiveId) {
      const found = existingVersions.find(v => v.id === newActiveId);
      if (found) latestVer = found;
    }

    const updatedVersions = existingVersions.map(v => ({
      ...v,
      isActive: v.id === newActiveId || (!newActiveId && v === latestVer)
    }));

    const updatedClassSchedule = {
      ...cur,
      kelas: className,
      activeVersionId: newActiveId,
      hari: latestVer ? latestVer.hari : cur.hari,
      jamPelajaran: latestVer ? latestVer.jamPelajaran : cur.jamPelajaran,
      ruang: latestVer ? latestVer.ruang : cur.ruang,
      riwayatJadwal: updatedVersions
    };

    const updatedMap = {
      ...localSchedules,
      [className]: updatedClassSchedule
    };

    setLocalSchedules(updatedMap);
    if (onUpdateClassSchedules) {
      queueMicrotask(() => {
        onUpdateClassSchedules(updatedMap);
      });
    }

    setDeleteConfirmScheduleVersion(null);
    addToast(`Roster "${label}" berhasil dihapus dari riwayat kelas ${className}!`, 'success');
  };

  const handleSaveSchedules = async () => {
    if (!onUpdateClassSchedules) return;
    setIsSavingSchedule(true);
    try {
      const payload: Record<string, ClassSchedule> = { ...localSchedules };
      // Ensure all classes have the dates synchronized
      classes.forEach(c => {
        const cur = payload[c.name] || { kelas: c.name, hari: [] };
        payload[c.name] = {
          ...cur,
          kelas: c.name,
          tanggalMulaiSemester: cur.tanggalMulaiSemester || globalSemesterStart,
          tanggalSelesaiSemester: cur.tanggalSelesaiSemester || globalSemesterEnd
        };
      });
      // Also store _global key
      payload['_global'] = {
        kelas: '_global',
        hari: [],
        tanggalMulaiSemester: globalSemesterStart,
        tanggalSelesaiSemester: globalSemesterEnd
      };

      await onUpdateClassSchedules(payload);
      addToast('Jadwal belajar dan rentang tanggal semester berhasil disimpan!', 'success');
    } catch (err: any) {
      addToast(`Gagal menyimpan jadwal: ${err?.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const scheduledClassCount = Object.values(localSchedules).filter(s => s && s.hari && s.hari.length > 0).length;

  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [isDeepCleaning, setIsDeepCleaning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deepCleanResult, setDeepCleanResult] = useState<DeepCleanResult | null>(null);
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [cleanType, setCleanType] = useState<'cache' | 'deepclean' | 'all'>('all');
  const [lastCacheClearedTime, setLastCacheClearedTime] = useState<string | null>(null);

  // Logo settings state
  const [logoInput, setLogoInput] = useState(appLogoUrl || '');
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  // Teacher Password settings state
  const [teacherPasswordInput, setTeacherPasswordInput] = useState(teacherPassword || '12345');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Grade Weights settings state
  const [weightsInput, setWeightsInput] = useState<GradeWeightConfig>(() => gradeWeights || DEFAULT_GRADE_WEIGHTS);
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  useEffect(() => {
    if (gradeWeights) {
      setWeightsInput(gradeWeights);
    }
  }, [gradeWeights]);

  const totalWeightPercent = (Number(weightsInput.formatif) || 0) + 
                             (Number(weightsInput.sumatif) || 0) + 
                             (Number(weightsInput.uas) || 0) + 
                             (Number(weightsInput.sikap) || 0);

  const handleSaveGradeWeights = async () => {
    if (!onUpdateGradeWeights) return;
    if (totalWeightPercent !== 100) {
      addToast(`Total persentase bobot harus pas 100%! (Saat ini: ${totalWeightPercent}%)`, 'error');
      return;
    }
    setIsSavingWeights(true);
    try {
      await onUpdateGradeWeights(weightsInput);
      addToast('Konfigurasi persentase bobot nilai berhasil disimpan!', 'success');
    } catch (err: any) {
      addToast(`Gagal menyimpan bobot: ${err?.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSavingWeights(false);
    }
  };

  const handleResetGradeWeights = async () => {
    setWeightsInput(DEFAULT_GRADE_WEIGHTS);
    if (onUpdateGradeWeights) {
      setIsSavingWeights(true);
      try {
        await onUpdateGradeWeights(DEFAULT_GRADE_WEIGHTS);
        addToast('Bobot nilai dikembalikan ke default (Formatif 20%, Sumatif 40%, UAS 30%, Sikap 10%)', 'info');
      } catch (err: any) {
        addToast(`Gagal reset bobot: ${err?.message || 'Terjadi kesalahan'}`, 'error');
      } finally {
        setIsSavingWeights(false);
      }
    }
  };

  // Firestore Database Table Viewer state
  const [selectedTableCollection, setSelectedTableCollection] = useState<'attendance' | 'formativeGrades' | 'summativeGrades' | 'students' | 'journals' | 'studentNotes' | 'extraTikAbsensi' | 'extraTikNilai' | 'extraTikPeserta'>('attendance');
  const [selectedTableSemester, setSelectedTableSemester] = useState<'all' | '1' | '2'>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [inspectingRowData, setInspectingRowData] = useState<any | null>(null);

  const settingMenuItems = [
    {
      id: 'schedule' as SettingTabId,
      title: 'Jadwal Belajar Siswa Per Kelas',
      shortTitle: 'Jadwal Belajar',
      description: 'Atur hari dan jam pelajaran setiap kelas untuk mempermudah presensi, pengisian jurnal harian, serta pengingat jadwal aktif.',
      icon: CalendarCheck,
      badge: `${scheduledClassCount} dari ${classes.length} Kelas Diatur`,
      badgeColor: scheduledClassCount > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200',
      gradient: 'from-blue-600 to-indigo-600',
    },
    {
      id: 'weights' as SettingTabId,
      title: 'Bobot Penilaian & Standar KKTP',
      shortTitle: 'Bobot Nilai & KKTP',
      description: `Atur persentase 4 komponen rapor (Formatif, Sumatif, UAS, Sikap) serta standar batas kelulusan KKTP (saat ini: ${weightsInput.kktp || 76}).`,
      icon: Calculator,
      badge: `KKTP ${weightsInput.kktp || 76} • ${weightsInput.formatif}% • ${weightsInput.sumatif}% • ${weightsInput.uas}% • ${weightsInput.sikap}%`,
      badgeColor: totalWeightPercent === 100 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-rose-50 text-rose-700 border-rose-200',
      gradient: 'from-indigo-600 to-blue-600',
    },
    {
      id: 'logo' as SettingTabId,
      title: 'Logo Portal & Aplikasi',
      shortTitle: 'Logo Aplikasi',
      description: 'Atur logo instansi/sekolah dari link Google Drive atau URL gambar untuk Login & Header app.',
      icon: ImageIcon,
      badge: appLogoUrl ? 'Logo Kustom' : 'Default',
      badgeColor: appLogoUrl ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
      gradient: 'from-blue-600 to-indigo-600',
    },
    {
      id: 'password' as SettingTabId,
      title: 'Password Akses Guru',
      shortTitle: 'Password Guru',
      description: 'Atur dan ubah password yang digunakan oleh Guru saat masuk ke portal aplikasi.',
      icon: KeyRound,
      badge: 'Proteksi Akses',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      gradient: 'from-indigo-600 to-violet-600',
    },
    {
      id: 'backup' as SettingTabId,
      title: 'Backup & Restore (JSON)',
      shortTitle: 'Backup JSON',
      description: 'Unduh salinan cadangan penuh database atau pulihkan data dari file JSON backup.',
      icon: FileJson,
      badge: 'Ekspor / Impor',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      gradient: 'from-teal-600 to-emerald-600',
    },
    {
      id: 'cleaning' as SettingTabId,
      title: 'Pembersihan Cache & DB',
      shortTitle: 'Pembersihan Data',
      description: 'Hapus cache browser & jalankan pembersihan sampah data yatim di database Firestore.',
      icon: Trash2,
      badge: 'Deep Clean DB',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      gradient: 'from-rose-600 to-pink-600',
    },
    {
      id: 'collections' as SettingTabId,
      title: 'Koleksi Database Firebase',
      shortTitle: 'Koleksi Firestore',
      description: 'Rincian koleksi data, jumlah rekor, dan estimasi kapasitas penyimpanan Firestore.',
      icon: Database,
      badge: `${stats?.collections.length || 10} Koleksi`,
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      gradient: 'from-purple-600 to-indigo-600',
    },
    {
      id: 'table' as SettingTabId,
      title: 'Tabel Database Firestore',
      shortTitle: 'Tabel Firestore',
      description: 'Lihat isi rekor database secara rinci dalam bentuk tabel, lengkap dengan struktur field dan pemisah Semester 1 & Semester 2.',
      icon: Table,
      badge: 'Inspeksi Tabel & Semester',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      gradient: 'from-cyan-600 to-blue-600',
    },
    {
      id: 'info' as SettingTabId,
      title: 'Informasi Hak Akses & Sistem',
      shortTitle: 'Info Sistem',
      description: 'Informasi wewenang mode akun aktif, status lisensi, dan konektivitas real-time.',
      icon: Sliders,
      badge: role === 'admin' ? 'Mode Admin' : 'Mode Guru',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      gradient: 'from-slate-700 to-slate-900',
    },
  ];

  useEffect(() => {
    setLogoInput(appLogoUrl || '');
    setLogoPreviewError(false);
  }, [appLogoUrl]);

  useEffect(() => {
    if (teacherPassword) {
      setTeacherPasswordInput(teacherPassword);
    }
  }, [teacherPassword]);

  const handleSaveTeacherPassword = async () => {
    if (!onUpdateTeacherPassword) return;
    const trimmed = teacherPasswordInput.trim();
    if (!trimmed) {
      addToast('Password tidak boleh kosong!', 'error');
      return;
    }
    setIsSavingPassword(true);
    try {
      await onUpdateTeacherPassword(trimmed);
      addToast('Password Akses Guru berhasil diperbarui!', 'success');
    } catch (err: any) {
      addToast(`Gagal memperbarui password: ${err?.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSaveAppLogo = async () => {
    if (!onUpdateAppLogoUrl) return;
    setIsSavingLogo(true);
    try {
      const trimmed = logoInput.trim();
      await onUpdateAppLogoUrl(trimmed);
      addToast(trimmed ? 'Logo portal aplikasi berhasil diperbarui!' : 'Logo kustom dihapus (kembali ke default)', 'success');
    } catch (err: any) {
      addToast(`Gagal menyimpan logo: ${err?.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleRemoveAppLogo = async () => {
    if (!onUpdateAppLogoUrl) return;
    setIsSavingLogo(true);
    try {
      setLogoInput('');
      await onUpdateAppLogoUrl('');
      addToast('Logo portal kembali ke default sistem', 'info');
    } catch (err: any) {
      addToast(`Gagal menghapus logo: ${err?.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSavingLogo(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await getDatabaseStatsFromFirestore();
      setStats(data);
    } catch (err: any) {
      console.error('Error loading database stats:', err);
      addToast('Gagal mengambil statistik database', 'error');
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Handler untuk mengunduh seluruh data lokal ke dalam file JSON
  const handleDownloadJSONBackup = () => {
    if (!allAppData) {
      addToast('Data aplikasi belum dimuat secara lengkap', 'error');
      return;
    }

    try {
      const backupPayload = {
        exportDate: new Date().toISOString(),
        exportedAtFormatted: new Date().toLocaleString('id-ID'),
        appName: 'Aplikasi Manajemen Presensi & Nilai Sekolah',
        systemInfo: {
          totalClasses: allAppData.classes.length,
          totalStudents: allAppData.students.length,
          totalAttendanceRecords: allAppData.attendance.length,
          totalFormativeGrades: allAppData.formativeGrades.length,
          totalSummativeGrades: allAppData.summativeGrades.length,
          totalStudentNotes: allAppData.studentNotes.length,
          totalJournals: allAppData.journals.length,
          totalExtraTikPeserta: allAppData.extraTikPeserta.length,
          totalExtraTikAbsensi: allAppData.extraTikAbsensi.length,
          totalExtraTikNilai: allAppData.extraTikNilai.length,
        },
        data: {
          classes: allAppData.classes,
          students: allAppData.students,
          attendance: allAppData.attendance,
          formativeGrades: allAppData.formativeGrades,
          summativeGrades: allAppData.summativeGrades,
          formativeCols: allAppData.formativeCols,
          summativeCols: allAppData.summativeCols,
          studentNotes: allAppData.studentNotes,
          journals: allAppData.journals,
          extraTik: {
            peserta: allAppData.extraTikPeserta,
            absensi: allAppData.extraTikAbsensi,
            nilai: allAppData.extraTikNilai,
          },
        },
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Backup_Data_Sistem_${dateStr}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast(`Backup berhasil diunduh: ${fileName}`, 'success');
    } catch (err: any) {
      console.error('Error downloading JSON backup:', err);
      addToast('Gagal membuat file backup JSON: ' + (err?.message || err), 'error');
    }
  };

  // Handler untuk mengunggah dan memulihkan database dari file JSON
  const handleUploadJSONFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      addToast('Harap pilih file dengan ekstensi .json', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    const confirmRestore = window.confirm(
      `Apakah Anda yakin ingin mengunggah & memulihkan database dari file "${file.name}"?\n\n` +
      `Data yang terdapat di dalam file backup akan disimpan ke dalam database Firestore sistem.`
    );

    if (!confirmRestore) {
      if (e.target) e.target.value = '';
      return;
    }

    setIsRestoring(true);
    addToast('Memproses dan mengunggah database ke server...', 'info');

    try {
      const fileText = await file.text();
      const jsonObj = JSON.parse(fileText);

      const res = await restoreDatabaseFromJSON(jsonObj);

      await onRefreshData();
      await fetchStats();

      addToast(
        `Berhasil mengunggah & memulihkan database!\n` +
        `Siswa: ${res.restoredStudents} | Presensi: ${res.restoredAttendance} | Nilai: ${res.restoredGrades} | Jurnal: ${res.restoredJournals}`,
        'success'
      );
    } catch (err: any) {
      console.error('Error uploading JSON backup:', err);
      addToast('Gagal memulihkan database dari JSON: ' + (err?.message || err), 'error');
    } finally {
      setIsRestoring(false);
      if (e.target) e.target.value = '';
    }
  };

  // Hapus Cache Browser & Storage Sementara
  const handleClearBrowserCache = () => {
    setIsCleaningCache(true);
    try {
      // Simpan credential penting
      const savedRole = localStorage.getItem('user_role');
      const savedLoggedIn = localStorage.getItem('user_logged_in');

      // Clear sessionStorage sepenuhnya
      sessionStorage.clear();

      // Clear non-essential keys from localStorage
      const keysToKeep = ['user_role', 'user_logged_in', 'firebase:authUser'];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.some(k => key.includes(k))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));

      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastCacheClearedTime(now);
      addToast('Cache browser dan temporary storage berhasil dibersihkan!', 'success');
    } catch (err: any) {
      console.error('Error clearing browser cache:', err);
      addToast('Gagal membersihkan cache browser', 'error');
    } finally {
      setIsCleaningCache(false);
    }
  };

  // Hapus Sampah Firestore (Deep Clean)
  const handleRunDeepClean = async () => {
    setIsDeepCleaning(true);
    try {
      const result = await deepCleanDatabaseFromFirestore(classes);
      setDeepCleanResult(result);
      await onRefreshData();
      await fetchStats();
      addToast('Pembersihan sampah database Firestore selesai!', 'success');
    } catch (err: any) {
      console.error('Deep clean error:', err);
      addToast(`Gagal pembersihan database: ${err?.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsDeepCleaning(false);
    }
  };

  const handleConfirmClean = async () => {
    setIsCleanModalOpen(false);
    if (cleanType === 'cache') {
      handleClearBrowserCache();
    } else if (cleanType === 'deepclean') {
      await handleRunDeepClean();
    } else if (cleanType === 'all') {
      handleClearBrowserCache();
      await handleRunDeepClean();
    }
  };

  if (role !== 'admin') {
    return (
      <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-xs text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200/60">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-800">Akses Khusus Admin</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Menu Pengaturan dan Pemeliharaan Database hanya dapat diakses oleh akun dengan peran Admin. Silakan masuk menggunakan password Admin untuk mengakses menu ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-Menu / Feature Navigation Buttons */}
      <div className="flex items-center gap-1.5 p-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSettingTab('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSettingTab === 'all'
              ? 'bg-indigo-600 text-white shadow-xs font-black'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Semua Fitur</span>
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

        {settingMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSettingTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSettingTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.shortTitle}</span>
            </button>
          );
        })}
      </div>

      {/* Breadcrumb Header when in a specific feature sub-tab */}
      {activeSettingTab !== 'all' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSettingTab('all')}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Semua Fitur</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              {settingMenuItems.find(m => m.id === activeSettingTab)?.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${settingMenuItems.find(m => m.id === activeSettingTab)?.badgeColor}`}>
              {settingMenuItems.find(m => m.id === activeSettingTab)?.badge}
            </span>
          </div>
        </div>
      )}

      {/* TAB VIEW 1: ALL FEATURES DASHBOARD */}
      {activeSettingTab === 'all' && (
        <>
          {/* Header Banner */}
          <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300">
                    <Settings className="w-5 h-5 animate-spin-slow" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-300 bg-indigo-900/60 border border-indigo-700/50 px-2.5 py-0.5 rounded-full">
                    Pengaturan Sistem &amp; DB
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Pengaturan &amp; Optimasi Database Firebase
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
                  Kelola kapasitas penyimpanan Firestore, lihat penggunaan koleksi data, serta bersihkan cache dan sampah data yang tidak terpakai agar sistem selalu cepat.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchStats}
                disabled={isLoadingStats}
                className="self-start md:self-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
                <span>Perbarui Statistik</span>
              </button>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Database Size */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Ukuran Database</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {isLoadingStats ? '...' : stats?.totalSizeFormatted || '0 KB'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Estimasi penggunaan kuota Firestore
                </p>
              </div>
            </div>

            {/* Total Documents */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total Dokumen</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Database className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {isLoadingStats ? '...' : `${stats?.totalDocs || 0} Rekor`}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Tersebar di {stats?.collections.length || 10} koleksi data
                </p>
              </div>
            </div>

            {/* Cache Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Cache Browser</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {lastCacheClearedTime ? 'Bersih' : 'Terisi'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {lastCacheClearedTime ? `Terakhir dibersihkan pkl ${lastCacheClearedTime}` : 'Penyimpanan lokal aktif'}
                </p>
              </div>
            </div>

            {/* Data Protection Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Proteksi Data</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Aktif &amp; Aman
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  File &amp; Siswa Aktif Dijamin Selamat
                </p>
              </div>
            </div>
          </div>

          {/* Menu & Feature Cards Selection Grid */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  Daftar Fitur &amp; Menu Pengaturan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih dan buka menu fitur di bawah ini untuk mengelola bagian pengaturan terkait:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {settingMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={`p-3 bg-linear-to-tr ${item.gradient} text-white rounded-2xl shadow-xs group-hover:scale-105 transition-transform`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2 font-medium">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveSettingTab(item.id)}
                      className="w-full py-2.5 bg-white group-hover:bg-indigo-600 text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-indigo-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>Buka Fitur</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* TAB VIEW: JADWAL BELAJAR SISWA */}
      {(activeSettingTab === 'schedule' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Pengaturan Jadwal Belajar Siswa Per Kelas</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Atur hari dan jam pelajaran setiap kelas agar sistem memberikan pengingat absensi &amp; jurnal harian otomatis
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                scheduledClassCount > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <Check className="w-3.5 h-3.5" /> {scheduledClassCount} dari {classes.length} Kelas Memiliki Jadwal
              </span>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 md:mt-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                  Otomasi Pengingat Presensi &amp; Jurnal Harian
                </h4>
                <p className="text-xs text-blue-800/90 mt-0.5 leading-relaxed">
                  Ketika suatu kelas dijadwalkan belajar pada hari ini, sistem akan menampilkan <strong>badge penanda khusus</strong> dan <strong>notifikasi pengingat</strong> pada menu Absensi Harian &amp; Jurnal Harian agar Anda tidak terlewat mengisi absen.
                </p>
              </div>
            </div>
          </div>

          {/* RENTANG KALENDER SEMESTER (TANGGAL AWAL & TANGGAL AKHIR SEMESTER) */}
          <div className="bg-linear-to-br from-indigo-50/60 via-slate-50 to-blue-50/50 border border-indigo-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-2xs">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Rentang Kalender Semester (Awal &amp; Akhir)
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-md normal-case">
                      Wajib / Filter Utama
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Data absensi kehadiran &amp; jurnal harian hanya akan dihitung dan diingatkan di dalam rentang tanggal semester ini
                  </p>
                </div>
              </div>

              {(globalSemesterStart || globalSemesterEnd) && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 rounded-xl text-[11px] font-bold text-indigo-900 shadow-2xs shrink-0">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {globalSemesterStart || '...'} s.d. {globalSemesterEnd || '...'}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>📅 Tanggal Awal Semester:</span>
                  {globalSemesterStart && (
                    <span className="text-[10px] font-medium text-slate-500">
                      {new Date(globalSemesterStart + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'long' })}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={globalSemesterStart}
                  onChange={(e) => handleGlobalStartChange(e.target.value)}
                  disabled={role !== 'admin' || isSavingSchedule}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>🏁 Tanggal Akhir Semester:</span>
                  {globalSemesterEnd && (
                    <span className="text-[10px] font-medium text-slate-500">
                      {new Date(globalSemesterEnd + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'long' })}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={globalSemesterEnd}
                  onChange={(e) => handleGlobalEndChange(e.target.value)}
                  disabled={role !== 'admin' || isSavingSchedule}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-2xs"
                />
              </div>
            </div>

            {/* Presets & Apply Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-indigo-100/60">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500">Preset Semester:</span>
                <button
                  type="button"
                  onClick={() => {
                    const curYear = new Date().getFullYear();
                    const start = `${curYear}-07-13`;
                    const end = `${curYear}-12-19`;
                    setGlobalSemesterStart(start);
                    setGlobalSemesterEnd(end);
                    handleApplySemesterDatesToAll(start, end);
                  }}
                  disabled={role !== 'admin' || isSavingSchedule}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-[11px] font-bold text-slate-700 hover:text-indigo-700 transition cursor-pointer disabled:opacity-50"
                >
                  Ganjil (Juli - Des)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const curYear = new Date().getFullYear();
                    const start = `${curYear}-01-05`;
                    const end = `${curYear}-06-19`;
                    setGlobalSemesterStart(start);
                    setGlobalSemesterEnd(end);
                    handleApplySemesterDatesToAll(start, end);
                  }}
                  disabled={role !== 'admin' || isSavingSchedule}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-[11px] font-bold text-slate-700 hover:text-indigo-700 transition cursor-pointer disabled:opacity-50"
                >
                  Genap (Jan - Juni)
                </button>
                {(globalSemesterStart || globalSemesterEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalSemesterStart('');
                      setGlobalSemesterEnd('');
                      handleApplySemesterDatesToAll('', '');
                    }}
                    disabled={role !== 'admin' || isSavingSchedule}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer disabled:opacity-50"
                  >
                    Reset Batas
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleApplySemesterDatesToAll(globalSemesterStart, globalSemesterEnd)}
                disabled={role !== 'admin' || isSavingSchedule}
                className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan Rentang ke Semua Kelas</span>
              </button>
            </div>
          </div>

          {/* Filter by Day */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-bold text-slate-500 mr-1">Filter Hari:</span>
              <button
                type="button"
                onClick={() => setScheduleFilterDay('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  scheduleFilterDay === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semua Hari
              </button>
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setScheduleFilterDay(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    scheduleFilterDay === day
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveSchedules}
              disabled={role !== 'admin' || isSavingSchedule}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 ml-auto"
            >
              {isSavingSchedule ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Semua Jadwal</span>
                </>
              )}
            </button>
          </div>

          {/* Info Banner: Perlindungan Riwayat Jadwal & Jurnal */}
          <div className="p-4 bg-gradient-to-r from-indigo-50/90 via-blue-50/90 to-purple-50/90 border border-indigo-200/80 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 md:mt-0">
                <History className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-slate-900 flex items-center gap-2">
                  <span>Sistem Riwayat Perubahan Jadwal (Roster Versioning)</span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold rounded-md border border-indigo-200">
                    🛡️ Auto-Protect Jurnal Lama
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed max-w-3xl">
                  Jika ada pergantian jadwal di tengah semester, Anda dapat menambahkan <strong>Perubahan Jadwal Baru (Roster Baru)</strong> dengan memilih tanggal mulai berlaku. Semua jurnal mengajar dan presensi pada rentang jadwal lama tetap terlindungi secara sah dan tidak akan ditandai 'belum mengisi'.
                </p>
              </div>
            </div>
          </div>

          {/* Classes Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classes
              .filter(c => {
                if (scheduleFilterDay === 'all') return true;
                const s = localSchedules[c.name];
                return s && Array.isArray(s.hari) && s.hari.includes(scheduleFilterDay as DayOfWeek);
              })
              .map((c) => {
                const schedule = localSchedules[c.name] || { kelas: c.name, hari: [] };
                const hasDays = schedule.hari && schedule.hari.length > 0;
                const versions = Array.isArray(schedule.riwayatJadwal) ? schedule.riwayatJadwal : [];
                const isExpanded = expandedVersionsClass === c.name;

                return (
                  <div 
                    key={c.id} 
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      hasDays 
                        ? 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs' 
                        : 'bg-slate-50/70 border-dashed border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-150 text-indigo-700 font-black text-xs flex items-center justify-center">
                          {c.id}
                        </span>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{c.name}</h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {hasDays ? `${schedule.hari.length} hari terjadwal: ${schedule.hari.join(', ')}` : 'Belum ada hari belajar'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {versions.length > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                            <History className="w-3 h-3" />
                            {versions.length} Roster
                          </span>
                        )}
                        {hasDays ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Kosong
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day Selector Buttons (Active / Current Schedule) */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Pilih Hari Belajar (Jadwal Saat Ini):
                        </label>
                        {versions.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium italic">
                            Jadwal aktif versi terbaru
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_OF_WEEK.map((day) => {
                          const isChecked = schedule.hari && schedule.hari.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleToggleDayForClass(c.name, day)}
                              disabled={role !== 'admin' || isSavingSchedule}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                isChecked
                                  ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-200'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              <span>{day}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detailed Inputs (Jam Pelajaran, Ruangan, Keterangan) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Jam Pelajaran Saat Ini</span>
                          </span>
                          <span className="text-[10px] text-indigo-600 font-extrabold">Auto-Sinkron ke Jurnal ⚡</span>
                        </label>
                        <input
                          type="text"
                          value={schedule.jamPelajaran || ''}
                          onChange={(e) => handleUpdateClassScheduleDetail(c.name, 'jamPelajaran', e.target.value)}
                          placeholder="Misal: Jam 1-3 (07:30-09:30) / Jam 4-6"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                          disabled={role !== 'admin' || isSavingSchedule}
                        />
                        <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                          Otomatis terpilih di pembuatan jurnal harian (cth: Jam 1-3, 1-2, 4-6)
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>Ruang / Lab Saat Ini</span>
                        </label>
                        <input
                          type="text"
                          value={schedule.ruang || ''}
                          onChange={(e) => handleUpdateClassScheduleDetail(c.name, 'ruang', e.target.value)}
                          placeholder="Misal: Lab Komputer 1"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                          disabled={role !== 'admin' || isSavingSchedule}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          <span>Tgl Awal Semester Kelas</span>
                        </label>
                        <input
                          type="date"
                          value={schedule.tanggalMulaiSemester || ''}
                          onChange={(e) => handleUpdateClassScheduleDetail(c.name, 'tanggalMulaiSemester', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                          disabled={role !== 'admin' || isSavingSchedule}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-indigo-500" />
                          <span>Tgl Akhir Semester Kelas</span>
                        </label>
                        <input
                          type="date"
                          value={schedule.tanggalSelesaiSemester || ''}
                          onChange={(e) => handleUpdateClassScheduleDetail(c.name, 'tanggalSelesaiSemester', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                          disabled={role !== 'admin' || isSavingSchedule}
                        />
                      </div>
                    </div>

                    {/* Section: Riwayat Versi Jadwal (Effective Schedule History) */}
                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedVersionsClass(isExpanded ? null : c.name)}
                          className="text-xs font-extrabold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Riwayat Versi Jadwal ({versions.length})</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenAddVersionModal(c.name)}
                          disabled={role !== 'admin' || isSavingSchedule}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Perubahan Jadwal Baru</span>
                        </button>
                      </div>

                      {/* Version Timeline list */}
                      {isExpanded && (
                        <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 animate-in fade-in duration-150">
                          {versions.length > 0 && (
                            <div className="text-[10.5px] text-slate-500 font-medium pb-1 flex items-center justify-between">
                              <span>Pilih roster yang ingin dijadikan <strong>Jadwal Aktif Terkini</strong>:</span>
                              <span className="text-[9.5px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                💡 Klik radio button untuk memilih
                              </span>
                            </div>
                          )}
                          {versions.length === 0 ? (
                            <div className="text-[11px] text-slate-500 text-center py-2">
                              Belum ada riwayat perubahan jadwal tersimpan. Klik <strong>+ Perubahan Jadwal Baru</strong> jika terdapat rotasi jadwal KBM di tengah semester.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {versions.map((ver, vIdx) => {
                                const isCurrent = (schedule.activeVersionId && ver.id === schedule.activeVersionId) ||
                                  (!schedule.activeVersionId && (ver.isActive || vIdx === versions.length - 1));
                                return (
                                  <div 
                                    key={ver.id || vIdx} 
                                    className={`p-3 rounded-2xl border text-xs flex flex-col gap-2 transition ${
                                      isCurrent 
                                        ? 'bg-gradient-to-r from-indigo-50/90 to-purple-50/70 border-indigo-300 shadow-xs ring-2 ring-indigo-200/70' 
                                        : 'bg-white hover:bg-slate-50 border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      {/* Radio selector to make this roster active */}
                                      <button
                                        type="button"
                                        onClick={() => handleSetActiveScheduleVersion(c.name, ver.id || vIdx)}
                                        disabled={role !== 'admin' || isSavingSchedule}
                                        className={`flex items-center gap-2 cursor-pointer text-left transition group ${
                                          role !== 'admin' ? 'cursor-default' : ''
                                        }`}
                                        title={isCurrent ? 'Versi ini sedang aktif digunakan' : 'Klik untuk jadikan roster aktif'}
                                      >
                                        <div className={`p-1 rounded-full transition ${
                                          isCurrent 
                                            ? 'bg-indigo-600 text-white shadow-xs' 
                                            : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                        }`}>
                                          {isCurrent ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                          ) : (
                                            <Radio className="w-3.5 h-3.5" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`font-black text-xs ${isCurrent ? 'text-indigo-950 font-black' : 'text-slate-800'}`}>
                                            {ver.label || `Roster ${vIdx + 1}`}
                                          </span>
                                          {isCurrent ? (
                                            <span className="text-[9.5px] font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                                              <span>✓ Roster Aktif Digunakan</span>
                                            </span>
                                          ) : (
                                            <span className="text-[9px] font-semibold text-slate-400 group-hover:text-indigo-600 underline decoration-dashed">
                                              Klik untuk aktifkan
                                            </span>
                                          )}
                                        </div>
                                      </button>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditVersionModal(c.name, vIdx)}
                                          title="Edit Versi Jadwal"
                                          disabled={role !== 'admin'}
                                          className="p-1.5 hover:bg-white text-slate-600 hover:text-indigo-600 rounded-lg border border-transparent hover:border-slate-200 transition cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteScheduleVersion(c.name, vIdx)}
                                          title="Hapus Roster Ini"
                                          disabled={role !== 'admin'}
                                          className="p-1.5 hover:bg-rose-100/80 text-rose-500 hover:text-rose-700 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer disabled:opacity-40"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap pl-6">
                                      <span className="flex items-center gap-1 font-medium bg-white/80 px-2 py-0.5 rounded-md border border-slate-100">
                                        <CalendarRange className="w-3 h-3 text-slate-400" />
                                        {ver.tanggalMulai} s/d {ver.tanggalSelesai || 'Selesai Semester'}
                                      </span>
                                      <span className="font-bold text-slate-800 bg-white/80 px-2 py-0.5 rounded-md border border-slate-100">
                                        Hari: {Array.isArray(ver.hari) ? ver.hari.join(', ') : '-'}
                                      </span>
                                      {ver.jamPelajaran && (
                                        <span className="text-indigo-700 font-bold bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                                          ⚡ {ver.jamPelajaran}
                                        </span>
                                      )}
                                      {ver.ruang && (
                                        <span className="text-slate-500 bg-white/80 px-2 py-0.5 rounded-md border border-slate-100">
                                          • {ver.ruang}
                                        </span>
                                      )}
                                    </div>

                                    {ver.keterangan && (
                                      <p className="text-[10.5px] text-slate-500 italic pl-6">
                                        Catatan: "{ver.keterangan}"
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              💡 Pastikan menekan tombol <strong>Simpan Semua Jadwal</strong> setelah mengatur hari belajar setiap kelas.
            </p>

            <button
              type="button"
              onClick={handleSaveSchedules}
              disabled={role !== 'admin' || isSavingSchedule}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSavingSchedule ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Semua Jadwal</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB VIEW 0: BOBOT PERSENTASE PENILAIAN */}
      {(activeSettingTab === 'weights' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Bobot Persentase Penilaian Rapor</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Tentukan persentase kontribusi 4 komponen penilaian dalam kalkulasi Nilai Akhir &amp; Predikat Siswa
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                totalWeightPercent === 100
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
              }`}>
                {totalWeightPercent === 100 ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Total Pas 100%
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" /> Total: {totalWeightPercent}% (Harus 100%)
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Visual Percentage Distribution Bar */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Distribusi Bobot Nilai</span>
              <span className={totalWeightPercent === 100 ? 'text-emerald-600' : 'text-rose-600'}>
                {totalWeightPercent}% / 100%
              </span>
            </div>
            <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${Math.max(0, Number(weightsInput.formatif) || 0)}%` }}
                className="bg-blue-500 transition-all duration-300 flex items-center justify-center text-[9px] text-white font-black"
                title={`Formatif: ${weightsInput.formatif}%`}
              >
                {Number(weightsInput.formatif) >= 8 ? `${weightsInput.formatif}%` : ''}
              </div>
              <div
                style={{ width: `${Math.max(0, Number(weightsInput.sumatif) || 0)}%` }}
                className="bg-indigo-600 transition-all duration-300 flex items-center justify-center text-[9px] text-white font-black"
                title={`Sumatif: ${weightsInput.sumatif}%`}
              >
                {Number(weightsInput.sumatif) >= 8 ? `${weightsInput.sumatif}%` : ''}
              </div>
              <div
                style={{ width: `${Math.max(0, Number(weightsInput.uas) || 0)}%` }}
                className="bg-amber-500 transition-all duration-300 flex items-center justify-center text-[9px] text-white font-black"
                title={`UAS: ${weightsInput.uas}%`}
              >
                {Number(weightsInput.uas) >= 8 ? `${weightsInput.uas}%` : ''}
              </div>
              <div
                style={{ width: `${Math.max(0, Number(weightsInput.sikap) || 0)}%` }}
                className="bg-emerald-500 transition-all duration-300 flex items-center justify-center text-[9px] text-white font-black"
                title={`Sikap: ${weightsInput.sikap}%`}
              >
                {Number(weightsInput.sikap) >= 8 ? `${weightsInput.sikap}%` : ''}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold pt-1">
              <div className="flex items-center gap-1.5 text-blue-700">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                <span>Formatif ({weightsInput.formatif}%)</span>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-700">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                <span>Sumatif ({weightsInput.sumatif}%)</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-700">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span>UAS ({weightsInput.uas}%)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span>Sikap &amp; Karakter ({weightsInput.sikap}%)</span>
              </div>
            </div>
          </div>

          {/* KKTP Standard Configuration Card */}
          <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-black bg-amber-200/70 text-amber-900 rounded-lg">
                  KKTP: {weightsInput.kktp || 76}
                </span>
                <h4 className="text-sm font-black text-slate-900">
                  Kriteria Ketercapaian Tujuan Pembelajaran (KKTP / KKM)
                </h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                Ambang batas kelulusan per asesmen. Siswa dengan nilai di bawah angka ini (&lt;{weightsInput.kktp || 76}) akan otomatis memunculkan kolom input nilai remedial, baik pada <strong>Penilaian Formatif</strong> maupun <strong>Penilaian Sumatif</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <label className="block text-[11px] font-extrabold text-slate-700">Batas Minimal</label>
                <span className="text-[10px] text-slate-400">Standar Kurikulum</span>
              </div>
              <div className="relative w-28 sm:w-32">
                <input
                  type="number"
                  min="50"
                  max="100"
                  step="1"
                  value={weightsInput.kktp || 76}
                  onChange={(e) => setWeightsInput({ ...weightsInput, kktp: Number(e.target.value) || 76 })}
                  className="w-full pl-3 pr-9 py-2 bg-white border border-amber-300 rounded-xl text-base font-black text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition text-center shadow-2xs"
                  disabled={role !== 'admin' || isSavingWeights}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xs">Pts</span>
              </div>
            </div>
          </div>

          {/* 4 Cards for Setting Weights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Formatif */}
            <div className="bg-blue-50/40 border border-blue-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-900 uppercase tracking-wider">1. Nilai Formatif</span>
                <span className="px-2 py-0.5 text-xs font-black bg-blue-100 text-blue-700 rounded-lg">
                  {weightsInput.formatif}%
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Tugas harian, kuis berkala, dan asesmen pemahaman formatif pertemuan kelas.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Persentase (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={weightsInput.formatif}
                    onChange={(e) => setWeightsInput({ ...weightsInput, formatif: Number(e.target.value) || 0 })}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-blue-200 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                    disabled={role !== 'admin' || isSavingWeights}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>

            {/* 2. Sumatif */}
            <div className="bg-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">2. Nilai Sumatif</span>
                <span className="px-2 py-0.5 text-xs font-black bg-indigo-100 text-indigo-700 rounded-lg">
                  {weightsInput.sumatif}%
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Ulangan harian per bab / capaian pembelajaran lingkup materi.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Persentase (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={weightsInput.sumatif}
                    onChange={(e) => setWeightsInput({ ...weightsInput, sumatif: Number(e.target.value) || 0 })}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                    disabled={role !== 'admin' || isSavingWeights}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>

            {/* 3. UAS */}
            <div className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 uppercase tracking-wider">3. Nilai UAS</span>
                <span className="px-2 py-0.5 text-xs font-black bg-amber-100 text-amber-700 rounded-lg">
                  {weightsInput.uas}%
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Asesmen Sumatif Akhir Semester (SAS / UAS) komprehensif semester.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Persentase (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={weightsInput.uas}
                    onChange={(e) => setWeightsInput({ ...weightsInput, uas: Number(e.target.value) || 0 })}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-amber-200 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition"
                    disabled={role !== 'admin' || isSavingWeights}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>

            {/* 4. Sikap */}
            <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">4. Nilai Sikap</span>
                <span className="px-2 py-0.5 text-xs font-black bg-emerald-100 text-emerald-700 rounded-lg">
                  {weightsInput.sikap}%
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Kedisiplinan, absensi, keaktifan jurnal harian, catatan perilaku &amp; karakter.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Persentase (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={weightsInput.sikap}
                    onChange={(e) => setWeightsInput({ ...weightsInput, sikap: Number(e.target.value) || 0 })}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
                    disabled={role !== 'admin' || isSavingWeights}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attitude Mechanism Explanation Card */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-black text-xs">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Mekanisme Penilaian Sikap &amp; Karakter Siswa:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-800">1. Nilai Dasar &amp; Presensi Kehadiran</p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Nilai dasar otomatis <strong>85.0 (Baik)</strong>. Kehadiran &ge;95% mendapatkan bonus <strong>+3.0</strong>, &ge;90% <strong>+1.5</strong>. Kehadiran &lt;80% dikurangi <strong>-5.0</strong>. Setiap keterlambatan dikurangi <strong>-1.5</strong>.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-800">2. Catatan Keaktifan &amp; Pelanggaran</p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Catatan siswa aktif/berprestasi di kelas menambah <strong>+3.0</strong> per apresiasi. Catatan siswa bermasalah/pelanggaran etika mengurangi <strong>-5.0</strong> per catatan.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-800">3. Fleksibilitas Nilai Manual Guru</p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Guru dan Admin dapat meng-override atau memasukkan nilai sikap &amp; catatan perilaku secara langsung di menu <strong>Nilai Sikap</strong> pada tab Penilaian.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-800">4. Formula Nilai Akhir Rapor</p>
                <p className="text-[11px] leading-relaxed text-slate-500 font-mono text-indigo-700">
                  Nilai Akhir = ({weightsInput.formatif}% &times; Formatif) + ({weightsInput.sumatif}% &times; Sumatif) + ({weightsInput.uas}% &times; UAS) + ({weightsInput.sikap}% &times; Sikap)
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetGradeWeights}
              disabled={role !== 'admin' || isSavingWeights}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ke Default (20% - 40% - 30% - 10%)</span>
            </button>

            <button
              type="button"
              onClick={handleSaveGradeWeights}
              disabled={role !== 'admin' || isSavingWeights || totalWeightPercent !== 100}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSavingWeights ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Bobot Persentase</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB VIEW 2: LOGO PORTAL & APLIKASI */}
      {(activeSettingTab === 'logo' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Logo Portal &amp; Aplikasi</h3>
                <p className="text-xs text-slate-500 font-medium">Atur logo instansi / sekolah dari link Google Drive atau URL gambar langsung</p>
              </div>
            </div>
            {appLogoUrl ? (
              <span className="self-start sm:self-auto text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Logo Kustom Aktif
              </span>
            ) : (
              <span className="self-start sm:self-auto text-[11px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-full">
                Logo Default Sistem
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Left: Input & Actions */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Link Gambar Logo (URL / Link Google Drive)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={logoInput}
                    onChange={(e) => {
                      setLogoInput(e.target.value);
                      setLogoPreviewError(false);
                    }}
                    placeholder="Contoh: https://drive.google.com/file/d/123XYZ/view?usp=sharing atau https://..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    disabled={role !== 'admin' || isSavingLogo}
                  />
                  {logoInput && role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoInput('');
                        setLogoPreviewError(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  💡 Tempelkan URL gambar langsung (PNG, JPG, SVG) atau <strong>Link Berbagi Google Drive</strong>. Sistem akan mengonversi link Google Drive secara otomatis untuk ditampilkan di Login Portal &amp; Header Aplikasi.
                </p>
              </div>

              {role === 'admin' ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveAppLogo}
                    disabled={isSavingLogo}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Simpan Logo</span>
                  </button>
                  {appLogoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAppLogo}
                      disabled={isSavingLogo}
                      className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus / Reset Logo</span>
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400 italic">
                  * Login sebagai Admin untuk mengubah link logo aplikasi.
                </p>
              )}
            </div>

            {/* Right: Live Preview Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-center gap-2 min-h-40">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pratinjau Logo</p>
              {logoInput.trim() && !logoPreviewError ? (
                <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-center min-h-16 min-w-16">
                  <img
                    src={convertGoogleDriveUrl(logoInput.trim())}
                    alt="Preview Logo"
                    className="h-16 w-16 object-contain rounded-xl"
                    onError={() => setLogoPreviewError(true)}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 p-3">
                  <div className="h-16 w-16 bg-linear-to-tr from-indigo-600 to-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-100">
                    <Database className="w-8 h-8" />
                  </div>
                  {logoPreviewError && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1">
                      Gambar tidak dapat dimuat (Cek URL / Hak Akses Drive)
                    </p>
                  )}
                </div>
              )}
              <p className="text-[11px] text-slate-500 font-bold">
                {logoInput.trim() && !logoPreviewError ? 'Logo Kustom Siap Tampil' : 'Logo Default Sistem (Database)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB VIEW 3: PASSWORD AKSES GURU */}
      {(activeSettingTab === 'password' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Pengaturan Password Akses Guru</h3>
                <p className="text-xs text-slate-500 font-medium">Atur password yang digunakan oleh Guru saat masuk ke portal aplikasi</p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Proteksi Akses Guru
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password Akses Guru Baru
                </label>
                <div className="relative">
                  <input
                    type={showPasswordText ? "text" : "password"}
                    value={teacherPasswordInput}
                    onChange={(e) => setTeacherPasswordInput(e.target.value)}
                    placeholder="Masukkan password baru untuk Guru"
                    className="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    disabled={role !== 'admin' || isSavingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-600 p-1 cursor-pointer text-xs font-bold"
                    title={showPasswordText ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPasswordText ? "Tutup" : "Lihat"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  💡 Password awal default adalah <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono font-bold">12345</code>. Admin dapat mengganti password ini kapan saja. Perubahan disinkronkan ke database Firestore.
                </p>
              </div>

              {role === 'admin' ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveTeacherPassword}
                    disabled={isSavingPassword || !teacherPasswordInput.trim()}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Simpan Password Guru</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400 italic">
                  * Login sebagai Admin untuk mengubah password akses guru.
                </p>
              )}
            </div>

            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100/80 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Status Password Aktif</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Password Guru yang sedang digunakan saat ini:
              </p>
              <div className="p-2.5 bg-white rounded-xl border border-indigo-100 text-center font-mono font-bold text-indigo-700 text-sm tracking-widest shadow-2xs">
                {showPasswordText ? teacherPasswordInput : '••••••••'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB VIEW 4: BACKUP & RESTORE DATABASE (FORMAT JSON) */}
      {(activeSettingTab === 'backup' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-800 shadow-md space-y-4 animate-in fade-in duration-200">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadJSONFile}
            accept=".json,application/json"
            className="hidden"
          />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-indigo-800/80 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-500/30 text-indigo-300 rounded-xl border border-indigo-400/30">
                  <FileJson className="w-5 h-5" />
                </span>
                <h3 className="text-base font-black text-white">
                  Backup &amp; Pulihkan Database (Format JSON)
                </h3>
              </div>
              <p className="text-xs text-indigo-200 leading-relaxed max-w-2xl">
                Unduh seluruh salinan data aktif atau unggah file backup <strong>.json</strong> sebelumnya untuk memulihkan seluruh data (Daftar Siswa, Presensi Harian, Nilai Formatif &amp; Sumatif, Jurnal Guru, Catatan Perilaku, &amp; Extra TIK) ke dalam database Firestore.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleDownloadJSONBackup}
                className="px-4.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Backup</span>
              </button>

              <button
                type="button"
                disabled={isRestoring}
                onClick={() => fileInputRef.current?.click()}
                className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-black rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengunggah...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Database JSON</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {allAppData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
              <div className="p-2.5 bg-indigo-950/70 border border-indigo-800/60 rounded-xl">
                <p className="text-indigo-300 text-[10px] font-medium">Siswa Terdaftar</p>
                <p className="font-black text-white text-sm">{allAppData.students.length} murid</p>
              </div>
              <div className="p-2.5 bg-indigo-950/70 border border-indigo-800/60 rounded-xl">
                <p className="text-indigo-300 text-[10px] font-medium">Rekor Presensi</p>
                <p className="font-black text-white text-sm">{allAppData.attendance.length} data</p>
              </div>
              <div className="p-2.5 bg-indigo-950/70 border border-indigo-800/60 rounded-xl">
                <p className="text-indigo-300 text-[10px] font-medium">Data Nilai</p>
                <p className="font-black text-white text-sm">
                  {allAppData.formativeGrades.length + allAppData.summativeGrades.length} data
                </p>
              </div>
              <div className="p-2.5 bg-indigo-950/70 border border-indigo-800/60 rounded-xl">
                <p className="text-indigo-300 text-[10px] font-medium">Jurnal Mengajar</p>
                <p className="font-black text-white text-sm">{allAppData.journals.length} entri</p>
              </div>
              <div className="p-2.5 bg-indigo-950/70 border border-indigo-800/60 rounded-xl">
                <p className="text-indigo-300 text-[10px] font-medium">Catatan Perilaku</p>
                <p className="font-black text-white text-sm">{allAppData.studentNotes.length} rekor</p>
              </div>
              <div className="p-2.5 bg-indigo-950/70 border border-indigo-800/60 rounded-xl">
                <p className="text-indigo-300 text-[10px] font-medium">Extra TIK</p>
                <p className="font-black text-white text-sm">{allAppData.extraTikPeserta.length} peserta</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-indigo-300 italic">Memuat rincian data aplikasi...</p>
          )}
        </div>
      )}

      {/* TAB VIEW 5: FITUR PEMBERSIHAN CACHE & SAMPAH DATA */}
      {(activeSettingTab === 'cleaning' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                Pembersihan Cache &amp; Garbage Collection (Hapus Sampah)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hapus file sementara, cache lokal, dan data yatim di database agar tidak membebani kuota penyimpanan.
              </p>
            </div>

            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
              Terakhir Diperbarui: {stats?.lastUpdated || '-'}
            </span>
          </div>

          {/* Safety Guarantee Callout Box */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-emerald-500 text-white rounded-xl shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs text-emerald-950">
                <p className="font-extrabold text-emerald-900 text-sm">
                  🛡️ Jaminan Keamanan Data Penting (Safety Guaranteed)
                </p>
                <p className="leading-relaxed text-emerald-800">
                  Fitur pembersihan ini bekerja secara <strong>cerdas dan selektif</strong>. Sistem <strong>TIDAK AKAN PERNAH</strong> menghapus data siswa terdaftar, presensi resmi kelas, nilai siswa, jurnal harian mengajar, atau akun pengguna.
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-850 font-medium text-[11px] pt-1">
                  <li><strong>Yang Dibersihkan:</strong> Cache browser sementara, data yatim (rekor tanpa NIS/Kelas valid), dan log tidak terpakai.</li>
                  <li><strong>Yang Selalu Disimpan Aman:</strong> Seluruh file penting, daftar siswa aktif, rekapitulasi, dan jurnal guru.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* Button 1: Clear Cache */}
            <button
              type="button"
              onClick={() => {
                setCleanType('cache');
                setIsCleanModalOpen(true);
              }}
              disabled={isCleaningCache || isDeepCleaning}
              className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-2xl text-left transition cursor-pointer space-y-2 group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="p-2 bg-amber-100 text-amber-700 rounded-xl group-hover:scale-105 transition">
                  <Cpu className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  Browser Cache
                </span>
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 group-hover:text-amber-700 transition">
                  Hapus Cache Browser
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Bersihkan buffer foto lokal &amp; temporary storage di browser pengguna.
                </p>
              </div>
            </button>

            {/* Button 2: Deep Clean Database */}
            <button
              type="button"
              onClick={() => {
                setCleanType('deepclean');
                setIsCleanModalOpen(true);
              }}
              disabled={isCleaningCache || isDeepCleaning || role !== 'admin'}
              className="p-4 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 rounded-2xl text-left transition cursor-pointer space-y-2 group disabled:opacity-50"
              title={role !== 'admin' ? 'Fitur pembersihan database Firestore khusus Admin' : ''}
            >
              <div className="flex items-center justify-between">
                <span className="p-2 bg-rose-100 text-rose-700 rounded-xl group-hover:scale-105 transition">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                  Firestore DB
                </span>
              </div>
              <div>
                <p className="text-xs font-black text-rose-900 group-hover:text-rose-700 transition">
                  Hapus Sampah Database (Deep Clean)
                </p>
                <p className="text-[11px] text-rose-700/80 mt-0.5 leading-snug">
                  Bersihkan rekor yatim tanpa NIS/kelas valid secara aman di Firebase.
                </p>
              </div>
            </button>

            {/* Button 3: Total Clean */}
            <button
              type="button"
              onClick={() => {
                setCleanType('all');
                setIsCleanModalOpen(true);
              }}
              disabled={isCleaningCache || isDeepCleaning}
              className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 rounded-2xl text-left transition cursor-pointer space-y-2 group shadow-md disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="p-2 bg-indigo-500 text-white rounded-xl group-hover:scale-105 transition">
                  <Trash2 className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-bold text-indigo-100 bg-indigo-800/80 px-2 py-0.5 rounded-md">
                  Rekomendasi
                </span>
              </div>
              <div>
                <p className="text-xs font-black text-white transition">
                  Pembersihan Total (Cache + Sampah DB)
                </p>
                <p className="text-[11px] text-indigo-100/80 mt-0.5 leading-snug">
                  Jalankan pembersihan menyeluruh untuk performa maksimal.
                </p>
              </div>
            </button>
          </div>

          {/* Deep Clean Execution Results Display */}
          {deepCleanResult && (
            <div className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-3 text-xs border border-slate-800 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Hasil Pembersihan Deep Clean Database Selesai</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Total Dihapus: {deepCleanResult.totalDeletedDocs} Dokumen
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-slate-800/80 rounded-xl">
                  <p className="text-slate-400 text-[10px]">Presensi Yatim</p>
                  <p className="font-bold text-white">{deepCleanResult.deletedAttendanceCount} data</p>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-xl">
                  <p className="text-slate-400 text-[10px]">Nilai Yatim</p>
                  <p className="font-bold text-white">
                    {(deepCleanResult.deletedFormativeGradesCount || 0) + (deepCleanResult.deletedSummativeGradesCount || 0)} data
                  </p>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-xl">
                  <p className="text-slate-400 text-[10px]">Catatan Yatim</p>
                  <p className="font-bold text-white">{deepCleanResult.deletedNotesCount} data</p>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-xl">
                  <p className="text-slate-400 text-[10px]">Siswa Aktif Terjaga</p>
                  <p className="font-bold text-emerald-400">{deepCleanResult.activeStudentsCount} murid</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB VIEW 6: TAMPILAN PENYIMPANAN DATABASE FIREBASE */}
      {(activeSettingTab === 'collections' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                Tampilan &amp; Rincian Koleksi Database Firebase
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Informasi lengkap koleksi data yang disimpan di Cloud Firestore beserta jumlah rekor dan estimasi ukurannya.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-xl">
                Firestore Cloud Database
              </span>
            </div>
          </div>

          {/* Collections Table */}
          {isLoadingStats ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-500">Menganalisis penggunaan koleksi Firestore...</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Nama Koleksi / Data</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-center">Jumlah Dokumen</th>
                    <th className="py-3 px-4 text-right">Estimasi Ukuran</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs font-medium text-slate-800">
                  {stats?.collections.map((col) => {
                    const percentOfTotal = stats.totalSizeBytes > 0 
                      ? Math.round((col.sizeBytes / stats.totalSizeBytes) * 100) 
                      : 0;

                    return (
                      <tr key={col.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              {col.name}
                              <span className="text-[10px] font-mono text-slate-400 font-normal">({col.id})</span>
                            </p>
                            <p className="text-[11px] text-slate-500">{col.description}</p>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            col.category === 'Master Data' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : col.category === 'Presensi'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : col.category === 'Nilai'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : col.category === 'Jurnal & Catatan'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {col.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                          {col.docCount} rekor
                        </td>

                        <td className="py-3.5 px-4 text-right space-y-1">
                          <span className="font-mono font-bold text-slate-900">{col.sizeFormatted}</span>
                          <div className="w-24 ml-auto bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-1.5 rounded-full" 
                              style={{ width: `${Math.max(percentOfTotal, 3)}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {col.docCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              Aman
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                              Kosong
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

      {/* TAB VIEW 6.5: TABEL DATABASE FIRESTORE */}
      {(activeSettingTab === 'table' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Table className="w-5 h-5 text-cyan-600" />
                Tabel Database Firestore &amp; Audit Semester
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspeksi rekor data secara presisi dalam format tabel dan verifikasi pemisahan data Semester 1 &amp; Semester 2.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-black text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-xl">
                Tampilan Tabel Transparan
              </span>
            </div>
          </div>

          {/* Collection Selector Horizontal Pills */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Pilih Koleksi Data Firestore:
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: 'attendance', name: 'Presensi Harian', count: allAppData?.attendance.length || 0, data: allAppData?.attendance || [] },
                { id: 'formativeGrades', name: 'Nilai Formatif', count: allAppData?.formativeGrades.length || 0, data: allAppData?.formativeGrades || [] },
                { id: 'summativeGrades', name: 'Nilai Sumatif', count: allAppData?.summativeGrades.length || 0, data: allAppData?.summativeGrades || [] },
                { id: 'journals', name: 'Jurnal Guru', count: allAppData?.journals.length || 0, data: allAppData?.journals || [] },
                { id: 'studentNotes', name: 'Catatan Perilaku', count: allAppData?.studentNotes.length || 0, data: allAppData?.studentNotes || [] },
                { id: 'students', name: 'Daftar Siswa', count: allAppData?.students.length || 0, data: allAppData?.students || [] },
                { id: 'extraTikAbsensi', name: 'Extra TIK Presensi', count: allAppData?.extraTikAbsensi.length || 0, data: allAppData?.extraTikAbsensi || [] },
                { id: 'extraTikNilai', name: 'Extra TIK Nilai', count: allAppData?.extraTikNilai.length || 0, data: allAppData?.extraTikNilai || [] },
                { id: 'extraTikPeserta', name: 'Extra TIK Peserta', count: allAppData?.extraTikPeserta.length || 0, data: allAppData?.extraTikPeserta || [] },
              ].map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    setSelectedTableCollection(col.id as any);
                    setSelectedTableSemester('all');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                    selectedTableCollection === col.id
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs font-black'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>{col.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    selectedTableCollection === col.id ? 'bg-cyan-700 text-cyan-100' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {col.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Helper Filter & Audit Bar */}
          {(() => {
            const rawCollectionList = [
              { id: 'attendance', name: 'Presensi Harian', data: allAppData?.attendance || [] },
              { id: 'formativeGrades', name: 'Nilai Formatif', data: allAppData?.formativeGrades || [] },
              { id: 'summativeGrades', name: 'Nilai Sumatif', data: allAppData?.summativeGrades || [] },
              { id: 'journals', name: 'Jurnal Guru', data: allAppData?.journals || [] },
              { id: 'studentNotes', name: 'Catatan Perilaku', data: allAppData?.studentNotes || [] },
              { id: 'students', name: 'Daftar Siswa', data: allAppData?.students || [] },
              { id: 'extraTikAbsensi', name: 'Extra TIK Presensi', data: allAppData?.extraTikAbsensi || [] },
              { id: 'extraTikNilai', name: 'Extra TIK Nilai', data: allAppData?.extraTikNilai || [] },
              { id: 'extraTikPeserta', name: 'Extra TIK Peserta', data: allAppData?.extraTikPeserta || [] },
            ];
            const currentObj = rawCollectionList.find(c => c.id === selectedTableCollection) || rawCollectionList[0];
            const currentData: any[] = currentObj.data;

            const sem1Count = currentData.filter(i => i.semester === 1).length;
            const sem2Count = currentData.filter(i => i.semester === 2).length;
            const noSemCount = currentData.filter(i => i.semester === undefined || i.semester === null).length;

            const filteredData = currentData.filter(i => {
              if (selectedTableSemester === '1' && i.semester !== 1) return false;
              if (selectedTableSemester === '2' && i.semester !== 2) return false;
              if (tableSearchQuery.trim()) {
                const q = tableSearchQuery.toLowerCase();
                return JSON.stringify(i).toLowerCase().includes(q);
              }
              return true;
            });

            return (
              <div className="space-y-4">
                {/* Semester Audit Banner */}
                <div className="p-4 bg-cyan-50/80 border border-cyan-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-cyan-950">
                  <div className="space-y-1">
                    <p className="font-black text-cyan-900 text-sm flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-cyan-600" />
                      Status Audit Semester: {currentObj.name}
                    </p>
                    <p className="text-cyan-800 leading-relaxed font-medium">
                      Data pada koleksi ini disimpan dengan atribut penanda semester secara langsung di Firestore.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 font-extrabold rounded-xl border border-blue-200">
                      Semester 1: {sem1Count} rekor
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 font-extrabold rounded-xl border border-purple-200">
                      Semester 2: {sem2Count} rekor
                    </span>
                    {noSemCount > 0 && (
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200">
                        Umum/Master: {noSemCount} rekor
                      </span>
                    )}
                  </div>
                </div>

                {/* Filter Controls: Semester Filter & Search Box */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedTableSemester('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        selectedTableSemester === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua Semester ({currentData.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTableSemester('1')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        selectedTableSemester === '1'
                          ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semester 1 ({sem1Count})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTableSemester('2')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        selectedTableSemester === '2'
                          ? 'bg-purple-600 text-white shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semester 2 ({sem2Count})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      placeholder="Cari NIS, Nama, Kelas, Tanggal..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 focus:bg-white transition"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    {tableSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTableSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Data Render */}
                {filteredData.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <Table className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Tidak ada rekor data yang cocok.</p>
                    <p className="text-[11px] text-slate-400">Coba ubah filter semester atau hapus kata kunci pencarian.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">Identitas / Subjek</th>
                          <th className="py-3 px-4 text-center">Kelas</th>
                          <th className="py-3 px-4 text-center">Semester DB</th>
                          <th className="py-3 px-4">Informasi / Tanggal / Nilai</th>
                          <th className="py-3 px-4 text-center">Inspeksi JSON</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
                        {filteredData.map((row: any, idx: number) => {
                          const sem = row.semester;
                          return (
                            <tr key={`tbl-row-${selectedTableCollection}-${row.id || row.nis || 'item'}-${idx}`} className="hover:bg-cyan-50/40 transition">
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                                {idx + 1}
                              </td>

                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-slate-900">
                                    {row.nama || row.schoolName || row.id || `Dokumen #${idx + 1}`}
                                  </p>
                                  {row.nis && (
                                    <p className="text-[10px] font-mono text-indigo-600 font-bold">
                                      NIS: {row.nis}
                                    </p>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center">
                                {row.kelas ? (
                                  <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                                    {row.kelas}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono text-[11px]">-</span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-center">
                                {sem === 1 ? (
                                  <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                    Semester 1
                                  </span>
                                ) : sem === 2 ? (
                                  <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                                    Semester 2
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-bold text-[10px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                    Master / Umum
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                <div className="space-y-0.5 text-[11px]">
                                  {row.tanggal && <p className="font-bold text-slate-800">📅 Tanggal: {row.tanggal}</p>}
                                  {row.status && <p className="font-semibold text-slate-700">Status: <span className="font-extrabold text-indigo-700">{row.status}</span></p>}
                                  {row.rataRata !== undefined && row.rataRata !== null && (
                                    <p className="font-bold text-emerald-700">Rata-Rata: {row.rataRata}</p>
                                  )}
                                  {row.materi && <p className="text-slate-600 line-clamp-1">Materi: {row.materi}</p>}
                                  {row.catatan && <p className="text-slate-600 line-clamp-1">Catatan: {row.catatan}</p>}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setInspectingRowData(row)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-cyan-600 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>JSON</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB VIEW 7: INFORMASI HAK AKSES & SISTEM */}
      {(activeSettingTab === 'info' || activeSettingTab === 'all') && activeSettingTab !== 'all' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 animate-in fade-in duration-200">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-150 pb-3">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Informasi Hak Akses &amp; Konfigurasi Aplikasi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Mode Hak Akses Aktif</span>
              <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                {role === 'admin' ? 'Mode Administrator (Akses Penuh)' : 'Mode Guru (Akses Input & Laporan)'}
              </p>
              <p className="text-xs text-slate-500">
                {role === 'admin' 
                  ? 'Anda memiliki wewenang untuk mengelola kelas, daftar siswa, serta menjalankan Deep Clean DB.' 
                  : 'Mode ini membatasi pengubahan struktur kelas demi keamanan data.'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Konektivitas Firebase</span>
              <p className="text-sm font-black text-emerald-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Real-time Firestore Database Connected
              </p>
              <p className="text-xs text-slate-500">
                Setiap entri nilai, absensi, dan jurnal harian disinkronkan secara otomatis ke cloud database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Cleaning */}
      {isCleanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Konfirmasi Pembersihan Data</h3>
                <p className="text-xs text-slate-500">
                  {cleanType === 'cache' && 'Bersihkan cache browser dan temporary storage?'}
                  {cleanType === 'deepclean' && 'Jalankan pembersihan sampah database Firestore?'}
                  {cleanType === 'all' && 'Jalankan pembersihan total (cache & sampah DB)?'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
              <p className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                Data Penting Dijamin Aman:
              </p>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                Seluruh data siswa terdaftar, presensi resmi, nilai akademik, dan jurnal harian guru <strong>TIDAK AKAN terhapus</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCleanModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClean}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer shadow-md"
              >
                Lanjutkan Pembersihan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Inspector Modal */}
      {inspectingRowData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-700 p-6 space-y-4 text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Struktur Dokumen Firestore (Raw JSON)</h3>
                  <p className="text-[11px] text-slate-400">Pemeriksaan struktur field dan nilai persis yang tersimpan di Cloud Database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRowData(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 max-h-96 overflow-y-auto">
              <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-words leading-relaxed">
                {JSON.stringify(inspectingRowData, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Atribut Semester:</span>
                {inspectingRowData.semester === 1 ? (
                  <span className="text-blue-400 font-bold bg-blue-950 px-2 py-0.5 rounded border border-blue-800">Semester 1</span>
                ) : inspectingRowData.semester === 2 ? (
                  <span className="text-purple-400 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-800">Semester 2</span>
                ) : (
                  <span className="text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded">Master / Tanpa Semester</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInspectingRowData(null)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tutup Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kelola / Tambah Versi Jadwal (Schedule Versioning Modal) */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 to-purple-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingVersionIndex !== null ? 'Edit Versi Jadwal' : 'Tambah Perubahan Jadwal Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Kelas: <strong className="text-indigo-600">{selectedClassForVersion}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVersionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Version Label */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nama / Label Roster Jadwal:
                </label>
                <input
                  type="text"
                  value={versionForm.label}
                  onChange={(e) => setVersionForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Misal: Roster 2 (Perubahan September)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Date Ranges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Mulai Berlaku: <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="date"
                    value={versionForm.tanggalMulai}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, tanggalMulai: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    required
                  />
                  <span className="text-[10px] text-slate-400 font-medium">
                    Mulai tanggal ini KBM mengikuti hari baru
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sampai Tanggal (Opsional):</span>
                  </label>
                  <input
                    type="date"
                    value={versionForm.tanggalSelesai}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, tanggalSelesai: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">
                    Kosongkan jika berlaku hingga akhir semester
                  </span>
                </div>
              </div>

              {/* Day Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  Hari Belajar Baru: <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const isChecked = versionForm.hari.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setVersionForm(prev => ({
                            ...prev,
                            hari: isChecked ? prev.hari.filter(d => d !== day) : [...prev.hari, day]
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{day}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time & Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Jam Pelajaran:</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 font-extrabold">Auto-Sinkron ke Jurnal ⚡</span>
                  </label>
                  <input
                    type="text"
                    value={versionForm.jamPelajaran}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, jamPelajaran: e.target.value }))}
                    placeholder="Misal: Jam 4-6 (09:45-12:00)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  />
                  <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                    Contoh: Jam 1-3, Jam 4-6, 1-2, atau 2, 3
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ruang / Lab:</span>
                  </label>
                  <input
                    type="text"
                    value={versionForm.ruang}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, ruang: e.target.value }))}
                    placeholder="Misal: Lab Komputer 2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Notes / Reason */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Keterangan / Alasan Perubahan (Opsional):
                </label>
                <input
                  type="text"
                  value={versionForm.keterangan}
                  onChange={(e) => setVersionForm(prev => ({ ...prev, keterangan: e.target.value }))}
                  placeholder="Misal: SK Pergantian Jadwal Kurikulum No. 12"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Auto Adjust Checkbox for new version */}
              {editingVersionIndex === null && (
                <label className="flex items-start gap-2.5 p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={versionForm.autoAdjustPrevious}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, autoAdjustPrevious: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="text-[11px] text-indigo-950 leading-relaxed">
                    <strong className="block font-bold">Kunci Otomatis Jadwal Sebelumnya:</strong>
                    Sistem akan menyetel tanggal berakhir jadwal sebelumnya tepat 1 hari sebelum tanggal mulai baru ini, sehingga riwayat KBM lama tetap rapi dan valid.
                  </div>
                </label>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsVersionModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveVersionModal}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Versi Jadwal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Schedule Version */}
      {deleteConfirmScheduleVersion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 flex items-center gap-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-xs">
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus Roster Jadwal?</h3>
                <p className="text-xs text-rose-600 font-bold">Kelas: {deleteConfirmScheduleVersion.className}</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus <strong className="text-slate-900 font-black font-mono">"{deleteConfirmScheduleVersion.label}"</strong> dari riwayat jadwal kelas <strong className="text-slate-900">{deleteConfirmScheduleVersion.className}</strong>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Jika roster ini sedang aktif, sistem akan secara otomatis mengalihkan status aktif ke roster lainnya.</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmScheduleVersion(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteScheduleVersion}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Roster</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
