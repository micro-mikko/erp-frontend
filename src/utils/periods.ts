import { format, startOfYear, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { PeriodKey } from '../api/types';

const FMT = 'yyyy-MM-dd';

export interface Period {
  key: PeriodKey;
  label: string;
  from: string;
  to: string;
}

export function buildPeriods(year?: number): Period[] {
  const now   = new Date();
  const y     = year ?? now.getFullYear();
  const today = format(now, FMT);

  return [
    {
      key:  'ytd',
      label: 'YTD',
      from: format(startOfYear(now), FMT),
      to:   today,
    },
    {
      key:  'this_month',
      label: 'Denna månad',
      from: format(startOfMonth(now), FMT),
      to:   today,
    },
    {
      key:  'last_month',
      label: 'Förra månaden',
      from: format(startOfMonth(subMonths(now, 1)), FMT),
      to:   format(endOfMonth(subMonths(now, 1)), FMT),
    },
    { key: 'q1', label: 'Q1', from: `${y}-01-01`, to: `${y}-03-31` },
    { key: 'q2', label: 'Q2', from: `${y}-04-01`, to: `${y}-06-30` },
    { key: 'q3', label: 'Q3', from: `${y}-07-01`, to: `${y}-09-30` },
    { key: 'q4', label: 'Q4', from: `${y}-10-01`, to: `${y}-12-31` },
  ];
}

export function getPeriod(
  key: PeriodKey,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  if (key === 'custom') {
    return { from: customFrom ?? format(startOfYear(new Date()), FMT), to: customTo ?? format(new Date(), FMT) };
  }
  const p = buildPeriods().find(p => p.key === key);
  return { from: p!.from, to: p!.to };
}
