import { DayOfWeek, ClassSchedule, ScheduleVersion } from '../types';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu'
];

export const DAY_INDEX_MAP: Record<number, DayOfWeek> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu'
};

/**
 * Parses numeric lesson hours from standard text formats entered in settings/schedules.
 * Examples:
 *  - "Jam 1-3" -> [1, 2, 3]
 *  - "1 - 3" -> [1, 2, 3]
 *  - "1, 2, 3" -> [1, 2, 3]
 *  - "Jam 4, 5, 6" -> [4, 5, 6]
 *  - "Jam 4-6 (09:45-12:00)" -> [4, 5, 6]
 *  - "Ke-1 s.d. 3" -> [1, 2, 3]
 *  - "1 - 2" -> [1, 2]
 */
export function parseLessonHoursFromString(input: string | undefined | null): number[] {
  if (!input || typeof input !== 'string') return [];

  const text = input.trim();
  if (!text) return [];

  // 1. Check for range pattern e.g., "1-3", "1 - 3", "Jam 1-4", "Jam 4 - 6", "1 s.d. 3", "1 s/d 3"
  const rangeMatch = text.match(/(?:jam\s*|ke[- ]?)?(\d{1,2})\s*(?:-|s\.?d\.?|s\/d|sampai|to)\s*(\d{1,2})/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start && end <= 15) {
      const result: number[] = [];
      for (let h = start; h <= end; h++) {
        result.push(h);
      }
      return result;
    }
  }

  // 2. Check for comma or whitespace separated list of digits e.g. "1, 2, 3" or "Jam 1,2,3"
  const listMatch = text.match(/(?:jam\s*)?(\d{1,2}(?:\s*,\s*\d{1,2})+)/i);
  if (listMatch) {
    const nums = listMatch[1]
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= 15);
    if (nums.length > 0) {
      return Array.from(new Set(nums)).sort((a, b) => a - b);
    }
  }

  // 3. Fallback: match standalone single number before any bracket/colon
  const singleMatch = text.match(/(?:jam\s*|ke[- ]?)?(\b\d{1,2}\b)/i);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    if (!isNaN(val) && val >= 1 && val <= 15) {
      return [val];
    }
  }

  return [];
}

/**
 * Returns DayOfWeek string from a Date object or date string (YYYY-MM-DD)
 */
export function getDayOfWeekFromDate(date: Date | string): DayOfWeek {
  if (!date) return 'Senin';
  if (typeof date === 'string') {
    // If it's a YYYY-MM-DD string, parse safely with local time component
    const parts = date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return DAY_INDEX_MAP[d.getDay()] || 'Senin';
    }
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayIdx = isNaN(d.getDay()) ? 1 : d.getDay();
  return DAY_INDEX_MAP[dayIdx] || 'Senin';
}

export function formatDateToYMD(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDayBeforeStr(dateStr: string): string {
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
}

export interface ResolvedScheduleDetail {
  hari: DayOfWeek[];
  jamPelajaran?: string;
  ruang?: string;
  keterangan?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  versionName?: string;
  isVersioned?: boolean;
  versionIndex?: number;
}

/**
 * Resolves the exact schedule in effect for a given date, supporting historical versioning (Effective Date Schedule).
 * Crucial Rule:
 * If a new roster version is set with a start date (e.g. Roster 2 starting 7 September),
 * any date strictly prior to that start date MUST resolve to the prior schedule (Jadwal Lama / Roster 1),
 * e.g. Friday, so that past attendance and journals are valid (sah) and not treated as out-of-schedule.
 */
export function getClassScheduleForDate(
  schedule: ClassSchedule | undefined | null,
  date: Date | string
): ResolvedScheduleDetail | null {
  if (!schedule) return null;

  const targetDateStr = formatDateToYMD(date);

  // Check semester boundaries
  if (schedule.tanggalMulaiSemester && targetDateStr < schedule.tanggalMulaiSemester) {
    return null;
  }
  if (schedule.tanggalSelesaiSemester && targetDateStr > schedule.tanggalSelesaiSemester) {
    return null;
  }

  const rawVersions = Array.isArray(schedule.riwayatJadwal) 
    ? schedule.riwayatJadwal.filter(v => v && Array.isArray(v.hari) && v.hari.length > 0) 
    : [];

  if (rawVersions.length > 0) {
    // Sort versions chronologically by tanggalMulai
    const sortedVersions = [...rawVersions].sort((a, b) => (a.tanggalMulai || '').localeCompare(b.tanggalMulai || ''));

    // Identify the designated active version if present
    let activeVer: ScheduleVersion | undefined;
    if (schedule.activeVersionId) {
      activeVer = sortedVersions.find(v => v.id === schedule.activeVersionId);
    }
    if (!activeVer) {
      activeVer = sortedVersions.find(v => v.isActive);
    }
    if (!activeVer && sortedVersions.length > 0) {
      activeVer = sortedVersions[sortedVersions.length - 1];
    }

    const activeIdx = activeVer ? sortedVersions.indexOf(activeVer) : -1;

    // 1. If targetDate falls within active version's effective window:
    if (activeVer && activeVer.tanggalMulai && targetDateStr >= activeVer.tanggalMulai) {
      if (!activeVer.tanggalSelesai || targetDateStr <= activeVer.tanggalSelesai) {
        const versionIdx = sortedVersions.indexOf(activeVer) + 1;
        return {
          hari: Array.isArray(activeVer.hari) ? activeVer.hari : [],
          jamPelajaran: activeVer.jamPelajaran || schedule.jamPelajaran,
          ruang: activeVer.ruang || schedule.ruang,
          keterangan: activeVer.keterangan || schedule.keterangan,
          tanggalMulai: activeVer.tanggalMulai || schedule.tanggalMulaiSemester,
          tanggalSelesai: activeVer.tanggalSelesai || schedule.tanggalSelesaiSemester,
          versionName: activeVer.label || `Roster ${versionIdx} (Aktif)`,
          isVersioned: true,
          versionIndex: versionIdx
        };
      }
    }

    // 2. Check historical/earlier versions covering targetDateStr:
    // A version matches if targetDateStr is in its explicit [tanggalMulai, tanggalSelesai] range
    const matchingHistorical = sortedVersions.filter(v => 
      v.tanggalMulai && v.tanggalMulai <= targetDateStr &&
      (!v.tanggalSelesai || targetDateStr <= v.tanggalSelesai)
    );

    if (matchingHistorical.length > 0) {
      const matched = matchingHistorical[matchingHistorical.length - 1];
      const versionIdx = sortedVersions.indexOf(matched) + 1;
      return {
        hari: Array.isArray(matched.hari) ? matched.hari : [],
        jamPelajaran: matched.jamPelajaran || schedule.jamPelajaran,
        ruang: matched.ruang || schedule.ruang,
        keterangan: matched.keterangan || schedule.keterangan,
        tanggalMulai: matched.tanggalMulai || schedule.tanggalMulaiSemester,
        tanggalSelesai: matched.tanggalSelesai || schedule.tanggalSelesaiSemester,
        versionName: matched.label || `Roster ${versionIdx}`,
        isVersioned: true,
        versionIndex: versionIdx
      };
    }

    // 3. CRITICAL: If targetDateStr is strictly BEFORE the active version's start date (e.g. before 7 September):
    // The schedule MUST remain the OLD SCHEDULE (Jadwal Lama).
    if (activeVer && activeVer.tanggalMulai && targetDateStr < activeVer.tanggalMulai) {
      // Find the version in sortedVersions that preceded activeVer
      const earlierVersions = activeIdx > 0
        ? sortedVersions.slice(0, activeIdx)
        : sortedVersions.filter(v => v !== activeVer && (!v.tanggalMulai || v.tanggalMulai < activeVer.tanggalMulai));

      if (earlierVersions.length > 0) {
        // Pick the closest earlier version prior to targetDateStr, or default to the baseline earlier version (Roster 1)
        const chosenEarlier = [...earlierVersions].reverse().find(v => !v.tanggalMulai || v.tanggalMulai <= targetDateStr) || earlierVersions[0];
        const versionIdx = sortedVersions.indexOf(chosenEarlier) + 1;
        return {
          hari: Array.isArray(chosenEarlier.hari) ? chosenEarlier.hari : [],
          jamPelajaran: chosenEarlier.jamPelajaran || schedule.jamPelajaran,
          ruang: chosenEarlier.ruang || schedule.ruang,
          keterangan: chosenEarlier.keterangan || schedule.keterangan,
          tanggalMulai: chosenEarlier.tanggalMulai || schedule.tanggalMulaiSemester,
          tanggalSelesai: chosenEarlier.tanggalSelesai || getDayBeforeStr(activeVer.tanggalMulai),
          versionName: chosenEarlier.label || `Roster ${versionIdx} (Jadwal Lama)`,
          isVersioned: true,
          versionIndex: versionIdx
        };
      }

      // If no earlier version exists in riwayatJadwal, check if jadwalLama was saved
      if (schedule.jadwalLama && Array.isArray(schedule.jadwalLama.hari) && schedule.jadwalLama.hari.length > 0) {
        return {
          hari: schedule.jadwalLama.hari,
          jamPelajaran: schedule.jadwalLama.jamPelajaran || schedule.jamPelajaran,
          ruang: schedule.jadwalLama.ruang || schedule.ruang,
          keterangan: schedule.jadwalLama.keterangan || 'Jadwal Lama Sebelum Perubahan',
          tanggalMulai: schedule.tanggalMulaiSemester,
          tanggalSelesai: getDayBeforeStr(activeVer.tanggalMulai),
          versionName: 'Jadwal Lama (Awal Semester)',
          isVersioned: true,
          versionIndex: 1
        };
      }

      // Check if schedule.hari has days that differ from activeVer
      if (Array.isArray(schedule.hari) && schedule.hari.length > 0) {
        return {
          hari: schedule.hari,
          jamPelajaran: schedule.jamPelajaran,
          ruang: schedule.ruang,
          keterangan: schedule.keterangan,
          tanggalMulai: schedule.tanggalMulaiSemester,
          tanggalSelesai: getDayBeforeStr(activeVer.tanggalMulai),
          versionName: 'Jadwal Lama (Awal Semester)',
          isVersioned: true,
          versionIndex: 1
        };
      }
    }

    // 4. If targetDateStr is before the earliest version's start date, the earliest version is the initial baseline roster
    if (sortedVersions.length > 0) {
      const earliest = sortedVersions[0];
      const versionIdx = 1;
      return {
        hari: Array.isArray(earliest.hari) ? earliest.hari : [],
        jamPelajaran: earliest.jamPelajaran || schedule.jamPelajaran,
        ruang: earliest.ruang || schedule.ruang,
        keterangan: earliest.keterangan || schedule.keterangan,
        tanggalMulai: earliest.tanggalMulai || schedule.tanggalMulaiSemester,
        tanggalSelesai: earliest.tanggalSelesai || schedule.tanggalSelesaiSemester,
        versionName: earliest.label || `Roster ${versionIdx}`,
        isVersioned: true,
        versionIndex: versionIdx
      };
    }

    // 5. If activeVer has no tanggalMulai (unrestricted), fallback to activeVer
    if (activeVer && !activeVer.tanggalMulai) {
      const versionIdx = sortedVersions.indexOf(activeVer) + 1;
      return {
        hari: Array.isArray(activeVer.hari) ? activeVer.hari : [],
        jamPelajaran: activeVer.jamPelajaran || schedule.jamPelajaran,
        ruang: activeVer.ruang || schedule.ruang,
        keterangan: activeVer.keterangan || schedule.keterangan,
        tanggalMulai: activeVer.tanggalMulai || schedule.tanggalMulaiSemester,
        tanggalSelesai: activeVer.tanggalSelesai || schedule.tanggalSelesaiSemester,
        versionName: activeVer.label || `Roster ${versionIdx} (Aktif)`,
        isVersioned: true,
        versionIndex: versionIdx
      };
    }
  }

  // 6. Base fallback if no version history exists
  if (Array.isArray(schedule.hari) && schedule.hari.length > 0) {
    return {
      hari: schedule.hari,
      jamPelajaran: schedule.jamPelajaran,
      ruang: schedule.ruang,
      keterangan: schedule.keterangan,
      tanggalMulai: schedule.tanggalMulaiSemester,
      tanggalSelesai: schedule.tanggalSelesaiSemester,
      versionName: 'Jadwal Standar',
      isVersioned: false
    };
  }

  return null;
}

/**
 * Checks if a specific class has a scheduled lesson on a given date (YYYY-MM-DD or Date),
 * taking into account semester date range and historical version changes.
 */
export function isClassScheduledOnDate(
  scheduleMapOrSingle: Record<string, ClassSchedule> | ClassSchedule | undefined,
  classNameOrDate: string | Date,
  maybeDate?: Date | string
): boolean {
  if (!scheduleMapOrSingle) return false;

  let schedule: ClassSchedule | undefined;
  let targetDate: Date | string;

  if (typeof classNameOrDate === 'string' && maybeDate !== undefined) {
    // Called with (scheduleMap, className, date)
    const map = scheduleMapOrSingle as Record<string, ClassSchedule>;
    schedule = map[classNameOrDate];
    targetDate = maybeDate;
  } else {
    // Called with (classSchedule, date)
    schedule = scheduleMapOrSingle as ClassSchedule;
    targetDate = classNameOrDate;
  }

  if (!schedule) return false;

  const targetDateStr = formatDateToYMD(targetDate);
  const semStart = schedule.tanggalMulaiSemester;
  const semEnd = schedule.tanggalSelesaiSemester;

  if (semStart && targetDateStr < semStart) return false;
  if (semEnd && targetDateStr > semEnd) return false;

  const resolved = getClassScheduleForDate(schedule, targetDate);
  if (!resolved || !Array.isArray(resolved.hari) || resolved.hari.length === 0) {
    return false;
  }

  const dayName = getDayOfWeekFromDate(targetDate);
  return resolved.hari.includes(dayName);
}

/**
 * Get all classes scheduled for a specific date
 */
export function getClassesScheduledToday(
  scheduleMap: Record<string, ClassSchedule> | undefined,
  classes: { id: number; name: string }[],
  date: Date | string = new Date()
): { id: number; name: string; schedule: ClassSchedule; resolved: ResolvedScheduleDetail | null }[] {
  if (!scheduleMap) return [];
  const targetDateStr = formatDateToYMD(date);
  const dayName = getDayOfWeekFromDate(date);
  
  const scheduled: { id: number; name: string; schedule: ClassSchedule; resolved: ResolvedScheduleDetail | null }[] = [];
  classes.forEach(c => {
    const s = scheduleMap[c.name];
    if (s) {
      const semStart = s.tanggalMulaiSemester;
      const semEnd = s.tanggalSelesaiSemester;
      if (semStart && targetDateStr < semStart) return;
      if (semEnd && targetDateStr > semEnd) return;

      const resolved = getClassScheduleForDate(s, date);
      if (resolved && Array.isArray(resolved.hari) && resolved.hari.includes(dayName)) {
        scheduled.push({
          id: c.id,
          name: c.name,
          schedule: s,
          resolved
        });
      }
    }
  });
  return scheduled;
}

