import { useEffect, useMemo, useState } from 'react';
import Chart from './Chart';
import {
  PERIODS_PER_YEAR,
  byYear,
  calculate,
  money,
  money2,
  monthsLabel,
  type Freq,
  type Inputs,
} from './loan';

const DEFAULTS: Inputs = {
  amount: 500000,
  annualRatePct: 6.0,
  years: 30,
  freq: 'monthly',
  extraPerPayment: 0,
  offset: 0,
  lumpSum: 0,
  lumpSumAtMonth: 12,
};

const NUM_KEYS = ['amount', 'annualRatePct', 'years', 'extraPerPayment', 'offset', 'lumpSum', 'lumpSumAtMonth'] as const;

function readUrl(): Inputs {
  const out: Inputs = { ...DEFAULTS };
  try {
    const p = new URL(window.location.href).searchParams;
    for (const k of NUM_KEYS) {
      const v = p.get(k);
      if (v != null && v !== '' && Number.isFinite(Number(v))) (out[k] as number) = Number(v);
    }
    const f = p.get('freq');
    if (f === 'weekly' || f === 'fortnightly' || f === 'monthly') out.freq = f;
  } catch {
    /* ignore */
  }
  return out;
}

function Field({
  label,
  prefix,
  suffix,
  value,
  onChange,
  step,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="ibox">
        {prefix && <i>{prefix}</i>}
        <input
          type="number"
          inputMode="decimal"
          step={step ?? 1}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {suffix && <i className="suf">{suffix}</i>}
      </div>
    </label>
  );
}

export default function App() {
  const [inp, setInp] = useState<Inputs>(readUrl);
  const set = (patch: Partial<Inputs>) => setInp((p) => ({ ...p, ...patch }));

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      for (const k of NUM_KEYS) u.searchParams.set(k, String(inp[k]));
      u.searchParams.set('freq', inp.freq);
      window.history.replaceState(null, '', u.toString());
    } catch {
      /* ignore */
    }
  }, [inp]);

  const r = useMemo(() => calculate(inp), [inp]);
  const perYear = PERIODS_PER_YEAR[inp.freq];
  const years = useMemo(() => byYear(r.rows, perYear), [r.rows, perYear]);
  const hasExtras = inp.extraPerPayment > 0 || inp.offset > 0 || inp.lumpSum > 0 || inp.freq !== 'monthly';

  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const freqWord = { weekly: 'week', fortnightly: 'fortnight', monthly: 'month' }[inp.freq];

  return (
    <div className="app">
      <header>
        <h1>Loan Repayment Calculator</h1>
        <p className="tag">
          Work out the repayment on a home or personal loan, then see how much sooner you would be
          debt-free — and how much interest you would save — by paying a bit extra, using an offset
          account, or switching to fortnightly repayments.
        </p>
      </header>

      <div className="cols">
        <form className="panel form" onSubmit={(e) => e.preventDefault()}>
          <h2>The loan</h2>
          <Field label="Amount borrowed" prefix="$" value={inp.amount} onChange={(n) => set({ amount: n })} step={1000} />
          <div className="two">
            <Field label="Interest rate" suffix="% p.a." value={inp.annualRatePct} onChange={(n) => set({ annualRatePct: n })} step={0.05} />
            <Field label="Loan term" suffix="years" value={inp.years} onChange={(n) => set({ years: n })} />
          </div>
          <label className="field">
            <span>Repayment frequency</span>
            <select value={inp.freq} onChange={(e) => set({ freq: e.target.value as Freq })}>
              <option value="monthly">Monthly</option>
              <option value="fortnightly">Fortnightly (half the monthly amount)</option>
              <option value="weekly">Weekly (a quarter of the monthly amount)</option>
            </select>
          </label>

          <h2>Pay it off faster (optional)</h2>
          <Field
            label={`Extra per ${freqWord}`}
            prefix="$"
            value={inp.extraPerPayment}
            onChange={(n) => set({ extraPerPayment: n })}
            step={50}
          />
          <Field label="Average offset / redraw balance" prefix="$" value={inp.offset} onChange={(n) => set({ offset: n })} step={1000} />
          <div className="two">
            <Field label="One-off lump sum" prefix="$" value={inp.lumpSum} onChange={(n) => set({ lumpSum: n })} step={1000} />
            <Field label="…paid after" suffix="months" value={inp.lumpSumAtMonth} onChange={(n) => set({ lumpSumAtMonth: n })} />
          </div>
          <p className="note">
            Nothing is sent anywhere — the numbers stay in your browser and in the page link.
          </p>
        </form>

        <div className="panel result">
          <div className="headline">
            <span>Repayment</span>
            <strong>{money2(r.scheduledPayment)}</strong>
            <span>per {freqWord}</span>
          </div>

          <div className="rgrid">
            <div>
              <b>{monthsLabel(r.payoffMonths)}</b>
              <span>to debt-free</span>
            </div>
            <div>
              <b>{money(r.totalInterest)}</b>
              <span>total interest</span>
            </div>
            <div>
              <b>{money(r.totalPaid)}</b>
              <span>total repaid</span>
            </div>
            <div>
              <b>{money2(r.firstInterest)}</b>
              <span>interest in payment 1</span>
            </div>
          </div>

          {hasExtras && r.interestSaved > 1 && (
            <div className="saved">
              Against the standard monthly schedule you save{' '}
              <b>{money(r.interestSaved)}</b> in interest and finish{' '}
              <b>{monthsLabel(Math.max(0, r.monthsSaved))}</b> sooner.
            </div>
          )}

          <Chart rows={r.rows} perYear={perYear} />

          <details className="sched">
            <summary>Year-by-year breakdown</summary>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Principal paid</th>
                    <th>Interest paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td>{money(y.principalPaid)}</td>
                      <td>{money(y.interestPaid)}</td>
                      <td>{money(y.endBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <button className="share" onClick={share}>
            {copied ? 'Link copied' : 'Copy shareable link'}
          </button>
        </div>
      </div>

      <p className="disclaimer">
        Estimate only. Assumes a fixed interest rate for the life of the loan and that extra
        payments reduce the balance immediately. Real loans have rate changes, fees, redraw rules and
        minimum-repayment recalculations. Check figures with your lender before making decisions.
      </p>

      <section className="explainer">
        <h2>How loan repayments work</h2>
        <p>
          Each repayment is split in two. Part covers the <strong>interest</strong> charged on the
          balance since the last payment; the rest reduces the <strong>principal</strong> you owe.
          Early on, most of the payment is interest because the balance is large. As the balance
          falls, more of each payment goes to principal, which is why the last few years clear the
          loan quickly.
        </p>
        <h3>Why extra repayments help so much</h3>
        <p>
          Every dollar of extra principal you pay is a dollar you never pay interest on again — for
          the whole remaining term. On a long loan that compounds into tens of thousands of dollars
          saved and years off the term. The earlier the extra payment, the bigger the effect.
        </p>
        <h3>Fortnightly repayments</h3>
        <p>
          If you pay <em>half</em> the monthly repayment every fortnight, you make 26 half-payments a
          year — the equivalent of 13 monthly payments instead of 12. That one extra month a year,
          applied to principal, typically clears a 30-year loan about four to five years early. This
          calculator models it that way; paying a "true" fortnightly amount that just re-spreads the
          same total over the year would not have the same effect.
        </p>
        <h3>Offset and redraw</h3>
        <p>
          Money in an offset account is subtracted from your loan balance before interest is
          calculated, so a $20,000 offset on a 6% loan saves about $1,200 of interest a year while
          the money stays available to you. Redraw works similarly for extra payments you have
          already made. Enter your <em>average</em> balance, since it usually moves around during the
          month.
        </p>
        <h3>Frequently asked questions</h3>
        <h4>Does this include fees or lenders mortgage insurance?</h4>
        <p>No. Add establishment fees or LMI to the amount borrowed if you want them reflected.</p>
        <h4>Is the rate fixed or variable?</h4>
        <p>
          The calculation assumes one rate for the whole term. For a variable loan, re-run it
          whenever your rate changes to see the new repayment and payoff date.
        </p>
        <h4>What is "interest in payment 1"?</h4>
        <p>
          The interest portion of your very first repayment — a quick sense of how much the loan
          costs before any principal is cleared.
        </p>
        <footer>Loan Repayment Calculator · estimate only · runs in your browser · no sign-up</footer>
      </section>
    </div>
  );
}
