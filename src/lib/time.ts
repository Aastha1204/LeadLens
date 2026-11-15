/** All business time is Asia/Kolkata (UTC+05:30, no DST). Timestamps are ISO instants. */
export const IST_OFFSET_MIN = 330;
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** Epoch ms for a wall-clock time in IST. Month is 1-based; overflow rolls over (month 13 = Jan next year). */
export function istMs(y: number, mo: number, d: number, h = 0, mi = 0): number {
  return Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MIN * MIN;
}
const shift = (t: string | number) =>
  new Date((typeof t === "string" ? Date.parse(t) : t) + IST_OFFSET_MIN * MIN);

export const iso = (ms: number) => new Date(ms).toISOString();
export const monthOf = (t: string | number) => shift(t).toISOString().slice(0, 7);
export const dayOfMonthIST = (t: string | number) => shift(t).getUTCDate();
export const weekdayIST = (t: string | number) => shift(t).getUTCDay(); // 0 = Sunday
export const hourIST = (t: string | number) => shift(t).getUTCHours();
export const isWeekendIST = (t: string | number) => [0, 6].includes(weekdayIST(t));
/** Week of month: days 1-7 = 1, 8-14 = 2, ... 29-31 = 5 */
export const weekNo = (t: string | number) => Math.floor((dayOfMonthIST(t) - 1) / 7) + 1;

const ym = (month: string) => month.split("-").map(Number) as [number, number];
export function monthStartMs(month: string) { const [y, m] = ym(month); return istMs(y, m, 1); }
export function monthEndMs(month: string) { const [y, m] = ym(month); return istMs(y, m + 1, 1); }
export function daysInMonth(month: string) { return Math.round((monthEndMs(month) - monthStartMs(month)) / DAY); }
export function addMonths(month: string, n: number): string {
  const [y, m] = ym(month);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export const prevMonth = (m: string) => addMonths(m, -1);
/** Report time for a month = 9:00 AM IST on the 1st of the following month. */
export function reportTimeMs(month: string) { const [y, m] = ym(month); return istMs(y, m + 1, 1, 9, 0); }
export const monthStartDate = (month: string) => `${month}-01`;
