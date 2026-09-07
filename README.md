# loan-repayment-calculator

Loan / mortgage repayment calculator. Enter the amount, rate and term to get the
repayment, total interest and payoff date, then model extra repayments, an
average offset/redraw balance, a one-off lump sum, or fortnightly/weekly
repayments — and see the interest saved and time cut against the standard monthly
schedule. Balance-over-time chart, year-by-year table, shareable URL. Client-side
only.

**Live:** https://loan-repayment-calculator.correia95.workers.dev/

## Stack

- React 18 + TypeScript + Vite, no runtime deps beyond React
- Static-assets Cloudflare Worker

## Engine

[`src/loan.ts`](src/loan.ts): `scheduledPayment` (standard amortised payment
formula, monthly), then split into halves/quarters for fortnightly/weekly so the
"13 monthly-equivalents a year" acceleration is captured. `calculate` runs a
period-by-period simulation (interest on balance minus offset, extra + lump-sum
principal, final-period trim) and a monthly no-extras baseline for the savings
comparison.

Verified in Node: $500k @ 6% / 30y monthly → $2,997.75/mo, ≈$579,191 total
interest; fortnightly → clears in ≈24.5 years, ≈$124k interest saved; offset
$50k → ≈$195k saved; 0% and lump-sum cases.

## Develop / deploy

```bash
npm install
npm run dev
npm run deploy
```
