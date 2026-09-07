// Loan / mortgage amortisation engine. Pure functions, no dependencies.

export type Freq = 'weekly' | 'fortnightly' | 'monthly';

export const PERIODS_PER_YEAR: Record<Freq, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
};

export interface Inputs {
  amount: number; // principal borrowed
  annualRatePct: number; // nominal annual interest rate
  years: number; // original loan term
  freq: Freq; // repayment frequency
  extraPerPayment: number; // additional amount paid every period
  offset: number; // average offset / redraw balance (reduces interest)
  lumpSum: number; // one-off extra payment
  lumpSumAtMonth: number; // when the lump sum lands (months from now)
}

export interface PeriodRow {
  n: number; // payment number
  month: number; // approximate month index
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
}

export interface Result {
  scheduledPayment: number; // contractual repayment per period (no extras)
  firstInterest: number;
  totalPaid: number;
  totalInterest: number;
  payoffPeriods: number; // in the chosen frequency
  payoffMonths: number;
  payoffYears: number;
  rows: PeriodRow[];
  // comparison against the plain contractual monthly schedule
  baseTotalInterest: number;
  baseMonths: number;
  interestSaved: number;
  monthsSaved: number;
}

// Standard amortised payment for a fully-amortising loan.
export function scheduledPayment(principal: number, ratePerPeriod: number, n: number): number {
  if (n <= 0) return principal;
  if (ratePerPeriod === 0) return principal / n;
  const f = Math.pow(1 + ratePerPeriod, n);
  return (principal * ratePerPeriod * f) / (f - 1);
}

function simulate(
  i: Inputs,
  ratePerPeriod: number,
  basePayment: number,
  withExtras: boolean,
  perYear: number,
): { rows: PeriodRow[]; totalInterest: number; totalPaid: number; periods: number } {
  const rows: PeriodRow[] = [];
  let balance = i.amount;
  let totalInterest = 0;
  let totalPaid = 0;
  let n = 0;
  const maxPeriods = Math.ceil(i.years * perYear) + perYear * 60; // generous guard
  const lumpPeriod = withExtras
    ? Math.round((i.lumpSumAtMonth / 12) * perYear)
    : Number.POSITIVE_INFINITY;

  while (balance > 0.005 && n < maxPeriods) {
    n++;
    const offsetEffective = withExtras ? Math.min(i.offset, Math.max(0, balance)) : 0;
    const interest = Math.max(0, (balance - offsetEffective) * ratePerPeriod);
    let extra = withExtras ? i.extraPerPayment : 0;
    if (withExtras && i.lumpSum > 0 && n === lumpPeriod) extra += i.lumpSum;

    let payment = basePayment + extra;
    let principalPaid = payment - interest;

    if (principalPaid >= balance) {
      principalPaid = balance;
      payment = principalPaid + interest;
      extra = Math.max(0, payment - basePayment);
    }

    balance -= principalPaid;
    totalInterest += interest;
    totalPaid += payment;

    rows.push({
      n,
      month: Math.round((n / perYear) * 12),
      payment,
      interest,
      principal: principalPaid,
      extra,
      balance: Math.max(0, balance),
    });
  }

  return { rows, totalInterest, totalPaid, periods: n };
}

export function calculate(i: Inputs): Result {
  const perYear = PERIODS_PER_YEAR[i.freq];
  const ratePerPeriod = i.annualRatePct / 100 / perYear;

  // The contractual repayment is set monthly (as lenders do), then split for
  // weekly/fortnightly. Paying "half the monthly amount" every fortnight means
  // 26 half-payments = 13 monthly-equivalents a year, which is why fortnightly
  // repayments clear the loan years early — this model preserves that.
  const monthlyRate = i.annualRatePct / 100 / 12;
  const monthlyPayment = scheduledPayment(i.amount, monthlyRate, Math.round(i.years * 12));
  const split = { monthly: 1, fortnightly: 2, weekly: 4 }[i.freq];
  const basePayment = monthlyPayment / split;

  const withExtras = simulate(i, ratePerPeriod, basePayment, true, perYear);
  // Baseline: the plain contractual monthly schedule, no extras, no offset.
  const baseline = simulate(i, monthlyRate, monthlyPayment, false, 12);

  const payoffMonths = (withExtras.periods / perYear) * 12;
  return {
    scheduledPayment: basePayment,
    firstInterest: i.amount * ratePerPeriod,
    totalPaid: withExtras.totalPaid,
    totalInterest: withExtras.totalInterest,
    payoffPeriods: withExtras.periods,
    payoffMonths,
    payoffYears: withExtras.periods / perYear,
    rows: withExtras.rows,
    baseTotalInterest: baseline.totalInterest,
    baseMonths: baseline.periods,
    interestSaved: baseline.totalInterest - withExtras.totalInterest,
    monthsSaved: baseline.periods - payoffMonths,
  };
}

// Yearly rollup for the chart / table.
export interface YearRow {
  year: number;
  principalPaid: number;
  interestPaid: number;
  endBalance: number;
}

export function byYear(rows: PeriodRow[], perYear: number): YearRow[] {
  const out: YearRow[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const y = Math.floor(idx / perYear);
    if (!out[y]) out[y] = { year: y + 1, principalPaid: 0, interestPaid: 0, endBalance: 0 };
    out[y].principalPaid += rows[idx].principal;
    out[y].interestPaid += rows[idx].interest;
    out[y].endBalance = rows[idx].balance;
  }
  return out;
}

export function money(n: number): string {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}
export function money2(n: number): string {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function monthsLabel(monthsFloat: number): string {
  const months = Math.round(monthsFloat);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m === 1 ? '' : 's'}`;
  if (m === 0) return `${y} year${y === 1 ? '' : 's'}`;
  return `${y} yr ${m} mo`;
}
