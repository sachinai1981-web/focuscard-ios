import type { FocusTask } from './types';

export const TIMELINE_START_HOUR = 5;
export const TIMELINE_END_HOUR = 23;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_SLOT = 15;
export const TIMELINE_START_MINUTES = TIMELINE_START_HOUR * MINUTES_PER_HOUR;
export const TIMELINE_END_MINUTES = TIMELINE_END_HOUR * MINUTES_PER_HOUR;
export const TIMELINE_DURATION_MINUTES =
  TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;
export const TIMELINE_HOUR_COUNT =
  TIMELINE_END_HOUR - TIMELINE_START_HOUR;
export const LAST_START_OFFSET =
  TIMELINE_DURATION_MINUTES - MINUTES_PER_SLOT;

export const timeOptions = Array.from(
  { length: TIMELINE_DURATION_MINUTES / MINUTES_PER_SLOT + 1 },
  (_, index) => index * MINUTES_PER_SLOT,
);

export const startTimeOptions = timeOptions.slice(0, -1);
export const endTimeOptions = timeOptions.slice(1);

export function offsetFromClock(hour: number, minute = 0) {
  const absoluteMinutes = hour * MINUTES_PER_HOUR + minute;
  return clampToTimelineBoundary(absoluteMinutes - TIMELINE_START_MINUTES);
}

export function formatClockTime(offset: number) {
  const absoluteMinutes = TIMELINE_START_MINUTES + offset;
  const hours = Math.floor(absoluteMinutes / MINUTES_PER_HOUR);
  const minutes = absoluteMinutes % MINUTES_PER_HOUR;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatHourLabel(hourIndex: number) {
  const hour = TIMELINE_START_HOUR + hourIndex;
  return String(hour).padStart(2, '0');
}

export function getDurationMinutes(task: FocusTask) {
  return Math.max(task.end - task.start, MINUTES_PER_SLOT);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainder = minutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function clampToTimeline(minutes: number) {
  return Math.min(Math.max(minutes, 0), LAST_START_OFFSET);
}

export function clampToTimelineBoundary(minutes: number) {
  return Math.min(Math.max(minutes, 0), TIMELINE_DURATION_MINUTES);
}

export function buildSegments(task: FocusTask) {
  const segments: Array<{
    hourIndex: number;
    startMinute: number;
    endMinute: number;
  }> = [];

  for (let hourIndex = 0; hourIndex < TIMELINE_HOUR_COUNT; hourIndex += 1) {
    const hourStart = hourIndex * MINUTES_PER_HOUR;
    const hourEnd = hourStart + MINUTES_PER_HOUR;
    const segmentStart = Math.max(task.start, hourStart);
    const segmentEnd = Math.min(task.end, hourEnd);

    if (segmentEnd > segmentStart) {
      segments.push({
        hourIndex,
        startMinute: segmentStart - hourStart,
        endMinute: segmentEnd - hourStart,
      });
    }
  }

  return segments;
}
