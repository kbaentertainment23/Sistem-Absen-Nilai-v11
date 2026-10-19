import { 
  Student, 
  GradeFormative, 
  GradeSummative, 
  GradeColumn, 
  GradeAttitude, 
  GradeWeightConfig, 
  MonthlyRecap, 
  StudentNote, 
  AttendanceRecord 
} from '../types';

export const KKTP_STANDARD = 76;

export const DEFAULT_GRADE_WEIGHTS: GradeWeightConfig = {
  formatif: 20,
  sumatif: 40,
  uas: 30,
  sikap: 10,
  kktp: 76
};

/**
 * Robust mathematical safe rounding function that avoids IEEE 754 floating point inaccuracies.
 * E.g., 1.005 rounded to 2 decimals -> 1.01 instead of 1.00
 */
export const safeRound = (val: number | null | undefined, decimals: number = 1): number => {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
};

/**
 * Formats a score for display safely, converting NaN/null to a clean placeholder.
 */
export const formatSafeScore = (
  score: number | string | null | undefined, 
  placeholder: string = '-', 
  decimals: number = 1
): string => {
  if (score === null || score === undefined || score === '') return placeholder;
  const num = Number(score);
  if (isNaN(num)) return placeholder;
  return num.toFixed(decimals);
};

/**
 * Mekanisme Adil Remedial (Fair Remedial Value Adjustment):
 * 1. Jika siswa tidak remedial (nilai raw >= KKTP): nilai dipakai apa adanya.
 * 2. Jika remedial (nilai raw < KKTP) dan nilai tes remedial didapat:
 *    - Nilai tes remedial < KKTP: Nilai tetap nilai perbaikan tersebut (belum tuntas tapi meningkat jika lebih tinggi dari nilai asli).
 *    - Nilai tes remedial >= KKTP:
 *      Agar adil terhadap siswa reguler yang tuntas di awal tanpa remedial (misal dapat nilai 78, 82),
 *      siswa remedial yang mendapat skor 90-100 tidak langsung mendapat nilai 90-100.
 *      Mekanisme: Nilai remedial disesuaikan ke rentang KKTP (76) sampai batas wajar proporsional (maksimal 78-80),
 *      dengan rumus: KKTP + ((skorRemedial - KKTP) / (100 - KKTP)) * 4
 */
export const calculateFairRemedialScore = (
  rawScore: number | string | null | undefined,
  remedialRawScore: number | string | null | undefined,
  kktp: number = KKTP_STANDARD
): {
  effectiveScore: number | null;
  isRemedied: boolean;
  isAdjusted: boolean;
  remedialRaw: number | null;
  originalRaw: number | null;
} => {
  const orig = rawScore !== null && rawScore !== undefined && String(rawScore).trim() !== '' && !isNaN(Number(rawScore))
    ? Number(rawScore)
    : null;
  
  const rem = remedialRawScore !== null && remedialRawScore !== undefined && String(remedialRawScore).trim() !== '' && !isNaN(Number(remedialRawScore))
    ? Number(remedialRawScore)
    : null;

  // Jika tidak ada nilai remedial yang diinput
  if (rem === null) {
    return {
      effectiveScore: orig,
      isRemedied: false,
      isAdjusted: false,
      remedialRaw: null,
      originalRaw: orig
    };
  }

  // Jika nilai asli sudah >= KKTP, nilai remedial tidak diperlukan (pakai nilai asli)
  if (orig !== null && orig >= kktp) {
    return {
      effectiveScore: orig,
      isRemedied: false,
      isAdjusted: false,
      remedialRaw: rem,
      originalRaw: orig
    };
  }

  // Jika nilai tes remedial belum mencapai KKTP
  if (rem < kktp) {
    // Ambil nilai tertinggi antara nilai asli dan remedial jika masih di bawah KKTP
    const bestUnderKktp = orig !== null ? Math.max(orig, rem) : rem;
    return {
      effectiveScore: safeRound(bestUnderKktp, 1),
      isRemedied: true,
      isAdjusted: false,
      remedialRaw: rem,
      originalRaw: orig
    };
  }

  // Nilai tes remedial >= KKTP: Terapkan rumus penyesuaian wajar & adil
  // Range bonus di atas KKTP adalah 0 s.d 4 poin (maksimal 80 jika KKTP 76)
  const maxBonus = 4.0;
  const denominator = Math.max(1, 100 - kktp);
  const remProportion = Math.min(1, Math.max(0, (rem - kktp) / denominator));
  const fairScore = kktp + (remProportion * maxBonus);
  const adjustedFinal = safeRound(fairScore, 1);

  return {
    effectiveScore: adjustedFinal,
    isRemedied: true,
    isAdjusted: rem > kktp,
    remedialRaw: rem,
    originalRaw: orig
  };
};

/**
 * Mengambil nilai efektif (effective score) dari sebuah kolom penilaian,
 * memperhitungkan nilai asli (misal 'f1') dan nilai remedial (misal 'f1_rem').
 */
export const getEffectiveColumnScore = (
  gradeObj: Record<string, any> | undefined,
  colKey: string,
  kktp: number = KKTP_STANDARD
): number | null => {
  if (!gradeObj) return null;
  const raw = gradeObj[colKey];
  const rem = gradeObj[`${colKey}_rem`];

  const result = calculateFairRemedialScore(raw, rem, kktp);
  return result.effectiveScore;
};

export interface StudentScoreBreakdown {
  nis: string;
  nama: string;
  noAbsen?: string;
  kelas?: string;
  jenisKelamin?: 'L' | 'P';
  
  // 4 Main Components
  formatifAvg: number;
  sumatifAvg: number;
  uasScore: number;
  sikapScore: number;

  // Breakdown Weighted Values
  formatifWeighted: number;
  sumatifWeighted: number;
  uasWeighted: number;
  sikapWeighted: number;

  // Final Composite Score & Letter Grade
  nilaiAkhir: number;
  finalGrade: number; // alias for compatibility
  predikat: string;
  predicate: string; // alias for compatibility
  predikatLengkap: string;
  keterangan: string;
  status: string; // 'Tuntas' | 'Perlu Remidi'
  isTuntas: boolean;
  deskripsi: string;
  deskripsiKompetensi: string;
  catatanSikap?: string;

  // Status kelengkapan & weights
  isComplete: boolean;
  hasAnyScore: boolean;
  missingComponents: string[];
  weights: GradeWeightConfig;
}

/**
 * Helper to calculate numeric average from an array of values.
 * Differentiates strictly between:
 *   - Empty/Unassigned (null, undefined, '', NaN): Excluded from count (denominator N)
 *   - Valid Zero (0, '0'): Included in count (denominator N) as 0
 */
export const calculateAverage = (scores: (number | string | null | undefined)[]): number => {
  const valid: number[] = [];
  
  for (const s of scores) {
    if (s === null || s === undefined) continue;
    if (typeof s === 'string' && s.trim() === '') continue;
    const num = Number(s);
    if (!isNaN(num) && num >= 0) {
      valid.push(num);
    }
  }

  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return safeRound(sum / valid.length, 1);
};

/**
 * Calculates student attitude score automatically:
 * - Baseline: 85.0 (Baik)
 * - Attendance bonus/deduction based on percentage:
 *    >= 95%: +3.0
 *    >= 90%: +1.5
 *    < 80%: -5.0
 *    < 70%: -10.0
 * - Positive notes (tipe 'aktif'): +3.0 per note (max +10)
 * - Behavior alerts (tipe 'bermasalah'): -5.0 per note
 * - Lateness: -1.5 per late count
 * - Bounded between 50 and 100.
 * If manualScore is specified in GradeAttitude, that takes priority.
 */
export const calculateAttitudeScore = (
  studentNis: string,
  attitudeRecords: GradeAttitude[] = [],
  studentNotes: StudentNote[] = [],
  recapRecords: MonthlyRecap[] = [],
  attendanceRecords: AttendanceRecord[] = []
): number => {
  const attRecord = attitudeRecords.find(a => a.nis === studentNis);
  if (attRecord?.manualScore !== undefined && attRecord?.manualScore !== null && !isNaN(Number(attRecord.manualScore))) {
    const manual = Number(attRecord.manualScore);
    return isNaN(manual) ? 85.0 : Math.min(100, Math.max(0, manual));
  }

  let score = 85.0; // Baseline: Predikat B (Baik)

  // 1. Check Attendance
  const recap = recapRecords.find(r => r.nis === studentNis);
  if (recap && !isNaN(recap.persentaseKehadiran)) {
    const pct = recap.persentaseKehadiran;
    if (pct >= 0.95) score += 3.0;
    else if (pct >= 0.90) score += 1.5;
    else if (pct < 0.70) score -= 10.0;
    else if (pct < 0.80) score -= 5.0;

    // Lateness penalty
    if (recap.terlambatCount > 0) {
      score -= Math.min(10, recap.terlambatCount * 1.5);
    }
  } else if (attendanceRecords.length > 0) {
    const studentAbs = attendanceRecords.filter(a => a.nis === studentNis);
    if (studentAbs.length > 0) {
      const hadir = studentAbs.filter(a => a.status === 'Hadir').length;
      const pct = hadir / studentAbs.length;
      if (!isNaN(pct)) {
        if (pct >= 0.95) score += 3.0;
        else if (pct >= 0.90) score += 1.5;
        else if (pct < 0.70) score -= 10.0;
        else if (pct < 0.80) score -= 5.0;
      }

      const lateCount = studentAbs.filter(a => (a.terlambat && a.terlambat > 0) || a.keterangan?.toLowerCase().includes('terlambat')).length;
      if (lateCount > 0) {
        score -= Math.min(10, lateCount * 1.5);
      }
    }
  }

  // 2. Check Student Character & Discipline Notes
  const notes = studentNotes.filter(n => n.nis === studentNis);
  const activeCount = notes.filter(n => n.tipe === 'aktif').length;
  const problemCount = notes.filter(n => n.tipe === 'bermasalah').length;

  score += Math.min(10, activeCount * 3.0);
  score -= (problemCount * 5.0);

  if (isNaN(score)) score = 85.0;
  return safeRound(Math.min(100, Math.max(50, score)), 1);
};

/**
 * Returns letter predicate & qualitative descriptor
 */
export const getPredikatInfo = (score: number) => {
  if (isNaN(score) || score <= 0) {
    return {
      predikat: '-',
      predikatLengkap: 'Belum Ada Nilai',
      keterangan: 'Belum Dinilai',
      deskripsi: 'Belum ada data penilaian yang tercatat pada periode semester ini.'
    };
  } else if (score >= 88) {
    return {
      predikat: 'A',
      predikatLengkap: 'Sangat Baik (A)',
      keterangan: 'Tuntas - Sangat Memuaskan',
      deskripsi: 'Menunjukkan penguasaan materi yang sangat unggul, pemahaman konsep yang mendalam, serta etika belajar dan kedisiplinan yang sangat terpuji.'
    };
  } else if (score >= 78) {
    return {
      predikat: 'B',
      predikatLengkap: 'Baik (B)',
      keterangan: 'Tuntas - Memuaskan',
      deskripsi: 'Menunjukkan pemahaman materi dan kompetensi yang baik, aktif mengikuti kegiatan pembelajaran, dan memiliki integritas yang baik.'
    };
  } else if (score >= 68) {
    return {
      predikat: 'C',
      predikatLengkap: 'Cukup (C)',
      keterangan: 'Tuntas - Cukup',
      deskripsi: 'Mencapai kriteria ketuntasan minimal kompetensi, perlu terus meningkatkan ketelitian dan keaktifan dalam menyelesaikan tugas mandiri.'
    };
  } else {
    return {
      predikat: 'D',
      predikatLengkap: 'Perlu Bimbingan (D)',
      keterangan: 'Belum Tuntas',
      deskripsi: 'Memerlukan pendampingan dan bimbingan khusus untuk memahami materi pembelajaran serta penguatan motivasi dan kehadiran belajar.'
    };
  }
};

/**
 * Main Calculator for 4 Assessment Components (Formatif 20%, Sumatif 40%, UAS 30%, Sikap 10%)
 */
export const calculateStudentGradeBreakdown = (
  student: Student,
  formativeGrade?: GradeFormative,
  summativeGrade?: GradeSummative,
  formativeCols: GradeColumn[] = [],
  summativeCols: GradeColumn[] = [],
  weights: GradeWeightConfig = DEFAULT_GRADE_WEIGHTS,
  attitudeRecords: GradeAttitude[] | GradeAttitude = [],
  studentNotes: StudentNote[] = [],
  recapRecords: MonthlyRecap[] = [],
  attendanceRecords: AttendanceRecord[] = []
): StudentScoreBreakdown => {
  const attList: GradeAttitude[] = Array.isArray(attitudeRecords)
    ? attitudeRecords
    : attitudeRecords ? [attitudeRecords] : [];

  const currentKktp = weights?.kktp ?? KKTP_STANDARD;

  // 1. Formatif Average (Tugas/Kuis/Latihan Harian) - includes fair remedial scores
  const fScores: number[] = [];
  let formativeHasAnyValue = false;
  formativeCols.forEach(col => {
    const effectiveVal = getEffectiveColumnScore(formativeGrade, col.key, currentKktp);
    if (effectiveVal !== null && !isNaN(effectiveVal)) {
      fScores.push(effectiveVal);
      formativeHasAnyValue = true;
    }
  });
  
  // Calculate directly from effective scores so remedial scores and dynamic column changes are always accurately reflected
  const formatifAvg = calculateAverage(fScores);

  // 2. Sumatif Average (Sumatif Lingkup Materi / Ulangan Bab, Excluding UAS) - includes fair remedial scores
  const sColsWithoutUas = summativeCols.filter(c => c.key !== 'uas' && c.key !== 'uts');
  const sScores: number[] = [];
  let summativeHasAnyValue = false;
  sColsWithoutUas.forEach(col => {
    const effectiveVal = getEffectiveColumnScore(summativeGrade, col.key, currentKktp);
    if (effectiveVal !== null && !isNaN(effectiveVal)) {
      sScores.push(effectiveVal);
      summativeHasAnyValue = true;
    }
  });
  const sumatifAvg = calculateAverage(sScores);

  // 3. UAS Score (Asesmen Akhir Semester) - includes fair remedial score
  const effectiveUas = getEffectiveColumnScore(summativeGrade, 'uas', currentKktp);
  const uasHasValue = effectiveUas !== null && !isNaN(effectiveUas);
  const uasScore = uasHasValue
    ? effectiveUas
    : (summativeGrade?.uas !== undefined && summativeGrade?.uas !== null && summativeGrade?.uas !== '' && !isNaN(Number(summativeGrade.uas)) ? Number(summativeGrade.uas) : 0);

  // 4. Sikap & Karakter Score
  const sikapScore = calculateAttitudeScore(
    student.nis,
    attList,
    studentNotes,
    recapRecords,
    attendanceRecords
  );

  const studentAttRecord = attList.find(a => a.nis === student.nis);
  const catatanSikap = studentAttRecord?.catatanSikap || '';

  // Normalizing & Applying Custom Weights
  const wF = Number(weights.formatif) || 20;
  const wS = Number(weights.sumatif) || 40;
  const wUas = Number(weights.uas) || 30;
  const wSikap = Number(weights.sikap) || 10;
  const totalWeight = (wF + wS + wUas + wSikap) || 100;

  const safeFormatif = isNaN(formatifAvg) ? 0 : formatifAvg;
  const safeSumatif = isNaN(sumatifAvg) ? 0 : sumatifAvg;
  const safeUas = isNaN(uasScore) ? 0 : uasScore;
  const safeSikap = isNaN(sikapScore) ? 85 : sikapScore;

  const missingComponents: string[] = [];
  if (!formativeHasAnyValue && safeFormatif <= 0) missingComponents.push('Formatif');
  if (!summativeHasAnyValue && safeSumatif <= 0) missingComponents.push('Sumatif');
  if (!uasHasValue && safeUas <= 0) missingComponents.push('UAS');

  const hasAnyScore = formativeHasAnyValue || summativeHasAnyValue || uasHasValue;

  // Calculate Weighted Contributions
  const formatifWeighted = totalWeight > 0 ? safeRound((safeFormatif * wF) / totalWeight, 2) : 0;
  const sumatifWeighted = totalWeight > 0 ? safeRound((safeSumatif * wS) / totalWeight, 2) : 0;
  const uasWeighted = totalWeight > 0 ? safeRound((safeUas * wUas) / totalWeight, 2) : 0;
  const sikapWeighted = totalWeight > 0 ? safeRound((safeSikap * wSikap) / totalWeight, 2) : 0;

  // If some cognitive components exist, calculate weighted composite
  let rawNilaiAkhir = 0;
  if (hasAnyScore) {
    rawNilaiAkhir = (safeFormatif * wF + safeSumatif * wS + safeUas * wUas + safeSikap * wSikap) / totalWeight;
  } else {
    // If no cognitive exams exist at all, score remains 0 (not graded yet)
    rawNilaiAkhir = 0;
  }

  const nilaiAkhir = isNaN(rawNilaiAkhir) ? 0 : safeRound(rawNilaiAkhir, 1);
  const { predikat, predikatLengkap, keterangan, deskripsi } = getPredikatInfo(nilaiAkhir);
  const isTuntas = nilaiAkhir >= currentKktp && hasAnyScore;

  return {
    nis: student.nis,
    nama: student.nama,
    noAbsen: student.noAbsen,
    kelas: student.kelas,
    jenisKelamin: student.jenisKelamin,
    formatifAvg: safeFormatif,
    sumatifAvg: safeSumatif,
    uasScore: safeUas,
    sikapScore: safeSikap,
    formatifWeighted: isNaN(formatifWeighted) ? 0 : formatifWeighted,
    sumatifWeighted: isNaN(sumatifWeighted) ? 0 : sumatifWeighted,
    uasWeighted: isNaN(uasWeighted) ? 0 : uasWeighted,
    sikapWeighted: isNaN(sikapWeighted) ? 0 : sikapWeighted,
    nilaiAkhir,
    finalGrade: nilaiAkhir,
    predikat,
    predicate: predikat,
    predikatLengkap,
    keterangan,
    status: !hasAnyScore ? 'Belum Ada Nilai' : (isTuntas ? 'Tuntas' : 'Perlu Remidi'),
    isTuntas,
    deskripsi,
    deskripsiKompetensi: deskripsi,
    catatanSikap,
    isComplete: missingComponents.length === 0,
    hasAnyScore,
    missingComponents,
    weights
  };
};
