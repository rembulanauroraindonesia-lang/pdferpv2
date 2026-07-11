/**
 * datePicker() — inline calendar popup component (Alpine x-data factory).
 * ----------------------------------------------------------------------------
 * Usage in partial:
 *   <span x-data="datePicker(doc.date)" @set-date="setDate($event.detail)">
 *
 * Locale: Indonesian. All date math uses LOCAL time (no toISOString = UTC) —
 * see pdferp_skills pitfall #8 (UTC off-by-one).
 *
 * Exposes: open, cursor (YYYY-MM), selected (ISO), todayIso, weekDays, days[],
 *   buildDays(), toggle(), prevMonth(), nextMonth(), pick(iso), pickToday(),
 *   monthLabel().
 */
import type { AlpineComponent } from "@/types/alpine";

const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Local ISO (YYYY-MM-DD) — avoids the UTC off-by-one from toISOString(). */
const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export type DatePickerComponent = Partial<AlpineComponent> & {
  open: boolean;
  cursor: string;
  selected: string;
  todayIso: string;
  weekDays: string[];
  days: DayCell[];
  buildDays(): void;
  toggle(): void;
  prevMonth(): void;
  nextMonth(): void;
  pick(iso: string): void;
  pickToday(): void;
  monthLabel(): string;
};

export function datePicker(initialIso?: string): DatePickerComponent {
  const todayIso = localIso(new Date());
  const safe = initialIso || todayIso;

  return {
    open: false,
    cursor: safe.slice(0, 7),
    selected: initialIso || "",
    todayIso,
    weekDays: ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"],
    days: [],

    buildDays() {
      const [y, m] = this.cursor.split("-").map(Number);
      const first = new Date(y, m - 1, 1);
      const startDow = (first.getDay() + 6) % 7; // Mon=0 ... Sun=6
      const daysInMonth = new Date(y, m, 0).getDate();
      const out: DayCell[] = [];
      // leading days from prev month
      const prevDays = new Date(y, m - 1, 0).getDate();
      for (let i = startDow - 1; i >= 0; i--) {
        const d = prevDays - i;
        const iso = localIso(new Date(y, m - 2, d));
        out.push({ iso, day: d, inMonth: false, isToday: iso === this.todayIso, isSelected: iso === this.selected });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = localIso(new Date(y, m - 1, d));
        out.push({ iso, day: d, inMonth: true, isToday: iso === this.todayIso, isSelected: iso === this.selected });
      }
      // trailing to fill 6 weeks (42 cells)
      let lastDt = new Date(y, m - 1, daysInMonth);
      while (out.length < 42) {
        lastDt = new Date(lastDt.getFullYear(), lastDt.getMonth(), lastDt.getDate() + 1);
        const iso = localIso(lastDt);
        out.push({ iso, day: lastDt.getDate(), inMonth: false, isToday: iso === this.todayIso, isSelected: iso === this.selected });
      }
      this.days = out;
    },

    toggle() {
      this.open = !this.open;
      if (this.open) this.buildDays();
    },
    prevMonth() {
      const [y, m] = this.cursor.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      this.cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      this.buildDays();
    },
    nextMonth() {
      const [y, m] = this.cursor.split("-").map(Number);
      const d = new Date(y, m, 1);
      this.cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      this.buildDays();
    },
    pick(iso: string) {
      this.selected = iso;
      this.open = false;
      this.$dispatch?.("set-date", iso);
    },
    pickToday() {
      // jump the calendar view to today's month, then pick today
      this.cursor = this.todayIso.slice(0, 7);
      this.buildDays();
      this.pick(this.todayIso);
    },
    monthLabel() {
      const [y, m] = this.cursor.split("-").map(Number);
      return `${MONTHS_LONG[m - 1]} ${y}`;
    },
  };
}
