const HEBREW_DAYS = [
  '\u05D9\u05D5\u05DD \u05E8\u05D0\u05E9\u05D5\u05DF',
  '\u05D9\u05D5\u05DD \u05E9\u05E0\u05D9',
  '\u05D9\u05D5\u05DD \u05E9\u05DC\u05D9\u05E9\u05D9',
  '\u05D9\u05D5\u05DD \u05E8\u05D1\u05D9\u05E2\u05D9',
  '\u05D9\u05D5\u05DD \u05D7\u05DE\u05D9\u05E9\u05D9',
  '\u05D9\u05D5\u05DD \u05E9\u05D9\u05E9\u05D9',
  '\u05E9\u05D1\u05EA',
];

const HEBREW_MONTHS = [
  '\u05D9\u05E0\u05D5\u05D0\u05E8',
  '\u05E4\u05D1\u05E8\u05D5\u05D0\u05E8',
  '\u05DE\u05E8\u05E5',
  '\u05D0\u05E4\u05E8\u05D9\u05DC',
  '\u05DE\u05D0\u05D9',
  '\u05D9\u05D5\u05E0\u05D9',
  '\u05D9\u05D5\u05DC\u05D9',
  '\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8',
  '\u05E1\u05E4\u05D8\u05DE\u05D1\u05E8',
  '\u05D0\u05D5\u05E7\u05D8\u05D5\u05D1\u05E8',
  '\u05E0\u05D5\u05D1\u05DE\u05D1\u05E8',
  '\u05D3\u05E6\u05DE\u05D1\u05E8',
];

export function getHebrewDate(date: Date): string {
  const day = HEBREW_DAYS[date.getDay()];
  const dayNum = date.getDate();
  const month = HEBREW_MONTHS[date.getMonth()];
  return `${day}, ${dayNum} \u05D1${month}`;
}

export function getHebrewMonthYear(date: Date): string {
  const month = HEBREW_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${month} ${year}`;
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(Math.round(m)).padStart(2, '0')}`;
}

export function formatCurrency(amount: number, currency: string = 'ILS', locale?: string): string {
  const resolvedLocale = locale ?? (currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'he-IL');
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

export function getTimerDisplay(startTime: string, breakMinutes: number, onBreak: boolean, breakStartTime?: string): string {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  let totalMs = now - start;

  let currentBreakMs = 0;
  if (onBreak && breakStartTime) {
    currentBreakMs = now - new Date(breakStartTime).getTime();
  }

  const breakMs = breakMinutes * 60 * 1000 + currentBreakMs;
  const netMs = Math.max(0, totalMs - breakMs);

  const totalSeconds = Math.floor(netMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
