import { ScheduleItem, ScheduleConflict } from '../types';

/**
 * Converts "HH:mm" string to minutes from midnight.
 */
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

/**
 * Converts minutes from midnight back to formatted "HH:mm" string.
 */
export const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const DAY_ALIASES: Record<string, string> = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday',
};

export const normalizeLecturerName = (value?: string): string =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const parseScheduleDayTimeWindows = (scheduleText?: string): Array<{ day: string; start: string; end: string }> => {
  if (!scheduleText) return [];

  const text = scheduleText.trim();
  if (!text) return [];

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi;
  const dayMatches = text.match(dayPattern) || [];

  const dayTokens = dayMatches
    .map((day) => DAY_ALIASES[day.toLowerCase()] || day)
    .filter((day, index, arr) => arr.indexOf(day) === index)
    .map((day) => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase());

  const timeRanges = Array.from(text.matchAll(/(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})/gi));

  if (!dayTokens.length || !timeRanges.length) {
    const fallbackMatch = text.match(/(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})/i);
    if (!fallbackMatch) return [];
    return dayNames.map((day) => ({ day, start: fallbackMatch[1], end: fallbackMatch[2] }));
  }

  const windows: Array<{ day: string; start: string; end: string }> = [];
  for (const day of dayTokens) {
    for (const range of timeRanges) {
      windows.push({
        day,
        start: range[1],
        end: range[2],
      });
    }
  }

  return windows;
};

export const hasClassScheduleConflict = (
  scheduleA?: string,
  roomA?: string,
  lecturerA?: string,
  scheduleB?: string,
  roomB?: string,
  lecturerB?: string
): boolean => {
  const normalizedRoomA = String(roomA || '').trim().toLowerCase();
  const normalizedRoomB = String(roomB || '').trim().toLowerCase();
  const normalizedLecturerA = normalizeLecturerName(lecturerA);
  const normalizedLecturerB = normalizeLecturerName(lecturerB);

  if (!scheduleA || !scheduleB) return false;

  const windowsA = parseScheduleDayTimeWindows(scheduleA);
  const windowsB = parseScheduleDayTimeWindows(scheduleB);

  if (!windowsA.length || !windowsB.length) return false;

  const sameLecturer = !!normalizedLecturerA && !!normalizedLecturerB && normalizedLecturerA === normalizedLecturerB;
  const sameRoom = !!normalizedRoomA && !!normalizedRoomB && normalizedRoomA === normalizedRoomB;

  if (!sameLecturer && !sameRoom) return false;

  for (const a of windowsA) {
    for (const b of windowsB) {
      if (a.day !== b.day) continue;
      const startA = timeToMinutes(a.start);
      const endA = timeToMinutes(a.end);
      const startB = timeToMinutes(b.start);
      const endB = timeToMinutes(b.end);

      if (startA < endB && startB < endA) {
        return true;
      }
    }
  }

  return false;
};

export const hasLecturerTimeConflict = (
  scheduleA?: string,
  lecturerA?: string,
  scheduleB?: string,
  lecturerB?: string
): boolean => {
  return hasClassScheduleConflict(scheduleA, '', lecturerA, scheduleB, '', lecturerB);
};

/**
 * Determines whether two time intervals overlap.
 */
export const isTimeOverlapping = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && sB < eA;
};

/**
 * Checks if two schedule sessions fall on the same date or day of the week.
 */
export const isSameDayOrDate = (a: ScheduleItem, b: ScheduleItem): boolean => {
  if (a.date && b.date) {
    return a.date === b.date;
  }
  if (a.dayOfWeek && b.dayOfWeek) {
    return a.dayOfWeek.toLowerCase() === b.dayOfWeek.toLowerCase();
  }
  return false;
};

/**
 * Normalizes room name for comparison (removes redundant whitespace and punctuation).
 */
const normalizeText = (text?: string): string => {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Detects all schedule conflicts across a collection of schedule items.
 * Detects:
 * 1. Room / Classroom Overlaps (same room at overlapping times)
 * 2. Lecturer Overlaps (same lecturer teaching at overlapping times)
 */
export const detectScheduleConflicts = (schedule: ScheduleItem[]): ScheduleConflict[] => {
  const conflicts: ScheduleConflict[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const a = schedule[i];
      const b = schedule[j];

      // Avoid self-comparison
      if (a.id === b.id) continue;

      // Must be on the same day or date
      if (!isSameDayOrDate(a, b)) continue;

      // Check if times overlap
      if (!isTimeOverlapping(a.startTime, a.endTime, b.startTime, b.endTime)) {
        continue;
      }

      // Calculate overlap window
      const overlapStart = minutesToTime(
        Math.max(timeToMinutes(a.startTime), timeToMinutes(b.startTime))
      );
      const overlapEnd = minutesToTime(
        Math.min(timeToMinutes(a.endTime), timeToMinutes(b.endTime))
      );

      const roomMatch =
        normalizeText(a.room) !== '' &&
        normalizeText(a.room) === normalizeText(b.room);

      const lecturerMatch =
        normalizeText(a.lecturerName) !== '' &&
        normalizeText(a.lecturerName) === normalizeText(b.lecturerName);

      if (!roomMatch && !lecturerMatch) {
        continue;
      }

      const pairKey = [a.id, b.id].sort().join('_');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      let conflictType: 'room' | 'lecturer' | 'both' = 'room';
      let warningMessage = '';

      if (roomMatch && lecturerMatch) {
        conflictType = 'both';
        warningMessage = `Critical Conflict: Room "${a.room}" and lecturer ${a.lecturerName} are both double-booked between ${a.courseCode} and ${b.courseCode} during ${overlapStart} - ${overlapEnd}.`;
      } else if (roomMatch) {
        conflictType = 'room';
        warningMessage = `Classroom Conflict: "${a.room}" is double-booked between ${a.courseCode} (${a.lecturerName}) and ${b.courseCode} (${b.lecturerName}) during overlapping window ${overlapStart} - ${overlapEnd}.`;
      } else {
        conflictType = 'lecturer';
        warningMessage = `Lecturer Conflict: ${a.lecturerName} has overlapping teaching sessions for ${a.courseCode} in ${a.room} and ${b.courseCode} in ${b.room} during ${overlapStart} - ${overlapEnd}.`;
      }

      conflicts.push({
        id: `conf_${pairKey}`,
        type: conflictType,
        sessionA: a,
        sessionB: b,
        date: a.date || b.date || '',
        dayOfWeek: a.dayOfWeek || b.dayOfWeek,
        room: roomMatch ? a.room : undefined,
        lecturerName: lecturerMatch ? a.lecturerName : undefined,
        overlapStart,
        overlapEnd,
        warningMessage,
      });
    }
  }

  return conflicts;
};

/**
 * Returns conflicts associated with a specific schedule item.
 */
export const getConflictsForItem = (
  item: ScheduleItem,
  allConflicts: ScheduleConflict[]
): ScheduleConflict[] => {
  return allConflicts.filter(
    (c) => c.sessionA.id === item.id || c.sessionB.id === item.id
  );
};
