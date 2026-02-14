/**
 * Date Utilities
 * Persian (Jalali) date formatting and utilities
 * Uses date-fns-jalali for formatting and custom conversion
 */

import { format } from "date-fns-jalali";
import { faIR } from "date-fns-jalali/locale/fa-IR";

// Persian numbers map
const persianNumbers = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

// Persian weekday names
const persianWeekdays = [
  "شنبه", // 0 - Saturday
  "یکشنبه", // 1 - Sunday
  "دوشنبه", // 2 - Monday
  "سه‌شنبه", // 3 - Tuesday
  "چهارشنبه", // 4 - Wednesday
  "پنج‌شنبه", // 5 - Thursday
  "جمعه", // 6 - Friday
];

// Constants for Persian calendar
const PERSIAN_EPOCH = 1948320;

const PERSIAN_NUM_DAYS = [
  0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336,
];

/**
 * Convert English digit to Persian digit
 */
function toPersianDigit(num: number | string): string {
  return num
    .toString()
    .split("")
    .map((d) => (/\d/.test(d) ? persianNumbers[parseInt(d)] : d))
    .join("");
}

/**
 * Helper: Integer division
 */
function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/**
 * Helper: Modulo
 */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Convert Gregorian to Julian Day Number
 */
function g2d(gy: number, gm: number, gd: number): number {
  return (
    div(1461 * (gy + 4800 + div(gm - 14, 12)), 4) +
    div(367 * (gm - 2 - 12 * div(gm - 14, 12)), 12) -
    div(3 * div(gy + 4900 + div(gm - 14, 12), 100), 4) +
    gd -
    32075
  );
}

/**
 * Convert Julian Day Number to Persian date
 */
function d2j(jd: number): { jy: number; jm: number; jd: number } {
  const jdn = Math.floor(jd);
  const depoch = jdn - PERSIAN_EPOCH;
  const cycle = div(depoch, 1029983);
  const cyear = mod(depoch, 1029983);

  let y: number;
  if (cyear === 1029982) {
    y = 2820;
  } else {
    const aux1 = div(cyear, 366);
    const aux2 = mod(cyear, 366);
    y = div(2810 * aux1 + 2818 * aux2, 1029982);
  }

  const jy = y + 2820 * cycle + 474;
  const year = jy <= 0 ? jy - 1 : jy;

  let yday = jdn - d2jd(year, 1, 1) + 1;
  let month: number;
  if (yday <= 186) {
    month = Math.ceil(yday / 31);
  } else {
    month = Math.ceil((yday - 6) / 30);
  }

  let day = jdn - d2jd(year, month, 1) + 1;

  return { jy: year, jm: month, jd: day };
}

/**
 * Convert Persian date to Julian Day Number
 */
function d2jd(jy: number, jm: number, jd: number): number {
  const [ny, nm] = normalizeMonth(jy, jm);
  jy = ny;
  jm = nm;

  const month = jm - 1;
  const year = jy;
  const day = jd;

  let julianDay = PERSIAN_EPOCH - 1 + 365 * (year - 1) + div(8 * year + 21, 33);

  if (month !== 0) {
    julianDay += PERSIAN_NUM_DAYS[month];
  }

  return julianDay + day;
}

/**
 * Normalize month for Persian calendar
 */
function normalizeMonth(jy: number, jm: number): [number, number] {
  if (jm <= 0) {
    jy -= 1;
    jm += 12;
  } else if (jm > 12) {
    jy += Math.floor((jm - 1) / 12);
    jm = ((jm - 1) % 12) + 1;
  }
  return [jy, jm];
}

/**
 * Convert Gregorian date to Persian (Jalali) date
 */
export function gregorianToPersian(date: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const jd = g2d(year, month, day);
  const jalali = d2j(jd);

  // Get weekday (0 = Saturday in Persian calendar)
  const weekday = date.getDay();
  // Convert from Gregorian weekday (0=Sunday) to Persian weekday (0=Saturday)
  const persianWeekday = (weekday + 1) % 7;

  return {
    year: jalali.jy,
    month: jalali.jm,
    day: jalali.jd,
    weekday: persianWeekday,
  };
}

/**
 * Format date to Persian string (e.g., "۱۴۰۳/۵/۶")
 */
export function formatPersianDate(date: Date = new Date()): string {
  const formatted = format(date, "yyyy/M/d", { locale: faIR });
  return toPersianDigit(formatted);
}

/**
 * Format time to Persian string (e.g., "۱۴:۳۰")
 */
export function formatPersianTime(date: Date = new Date()): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const formatted = `${hours}:${minutes}`;
  return toPersianDigit(formatted);
}

/**
 * Format weekday to Persian string (e.g., "جمعه")
 */
export function formatPersianWeekday(date: Date = new Date()): string {
  const persian = gregorianToPersian(date);
  return persianWeekdays[persian.weekday];
}

/**
 * Format full Persian date with weekday (e.g., "۱۴۰۳/۵/۶ - جمعه")
 */
export function formatFullPersianDate(date: Date = new Date()): string {
  const persian = gregorianToPersian(date);
  const formatted = `${persian.year}/${persian.month}/${persian.day}`;
  return `${toPersianDigit(formatted)} - ${persianWeekdays[persian.weekday]}`;
}

/**
 * Get current Persian date info
 */
export function getPersianDateInfo(date: Date = new Date()): {
  date: string;
  time: string;
  weekday: string;
  full: string;
} {
  return {
    date: formatPersianDate(date),
    time: formatPersianTime(date),
    weekday: formatPersianWeekday(date),
    full: formatFullPersianDate(date),
  };
}

/**
 * Check if today is Friday (weekend in Iran)
 */
export function isFriday(date: Date = new Date()): boolean {
  const persian = gregorianToPersian(date);
  return persian.weekday === 6;
}

/**
 * Check if today is Thursday (half-day in Iran)
 */
export function isThursday(date: Date = new Date()): boolean {
  const persian = gregorianToPersian(date);
  return persian.weekday === 5;
}

/**
 * Add Tehran timezone offset (UTC+3:30) to a date
 * This converts UTC time to Tehran local time
 */
export function toTehranTime(date: Date = new Date()): Date {
  const tehranOffset = 3 * 60 + 30; // 3 hours 30 minutes in minutes
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + tehranOffset);
  return result;
}
