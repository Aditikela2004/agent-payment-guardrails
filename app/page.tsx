"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  DEFAULT_POLICY,
  SAMPLE_DAY,
  runDay,
  summarize,
  type Category,
  type Evaluated,
  type HumanCall,
  type Policy,
  type PurchaseRequest,
} from "../lib/guardrails";

type Step = 1 | 2 | 3;

const money = (n: number) => `$${n.toFixed(2)}`;

function clock(minute: number) {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function label(e: Evaluated) {
  if (e.final === "approved") return e.decidedBy === "person" ? "Approved by person" : "Approved";
  if (e.final === "declined") return e.decidedBy === "person" ? "Declined by person" : "Declined";
  return "Waiting for a person";
}

function NumberField(props: {
  id: string;
  text: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label htmlFor={props.id}>{props.text}</label>
      <input
        id={props.id}
        type="number"
        min={0}
        step={props.step ?? 1}
        value={Number.isFinite(props.value) ? props.value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          props.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
      />
    </div>
  );
}

export default function Page() {
  const [step, setStep] = useState<Step>(1);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [requests, setRequests] = useState<PurchaseRequest[]>(SAMPLE_DAY);
  const [calls, setCalls] = useState<Record<string, HumanCall>>({});
  const [custom, setCustom] = useState({
    merchant: "",
    category: "Groceries" as Category,
    amount: 25,
    country: "US",
    purpose: "",
    recurring: false,
    newMerchant: false,
  });

  const results = useMemo(() => runDay(requests, policy, calls), [requests, policy, calls]);
  const summary = useMemo(() => summarize(results), [results]);

  const set = <K extends keyof Policy>(key: K, value: Policy[K]) =>
    setPolicy((p) => ({ ...p, [key]: value }));

  function addCustom() {
    const lastMinute = requests.reduce((max, r) => Math.max(max, r.minute), 0);
    const n = requests.filter((r) => r.id.startsWith("c")).length + 1;
    setRequests((list) => [
      ...list,
      {
        id: `c${n}-${lastMinute}`,
        minute: lastMinute + 15,
        merchant: custom.merchant.trim() || "Custom merchant",
        category: custom.category,
        amount: custom.amount,
        recurring: custom.recurring,
        newMerchant: custom.newMerchant,
        country: custom.country.trim().toUpperCase() || "US",
        purpose: custom.purpose,
      },
    ]);
  }

  const waiting = results.filter((r) => r.final === "waiting");
  const personCalls = results.filter((r) => r.decidedBy === "person");
  const usedPct = Math.min(100, (summary.approvedSpend / Math.max(policy.dailyLimit, 1)) * 100);
  const maxHits = Math.max(1, ...summary.ruleHits.map((h) => h.declines + h.reviews));

  return (
    <main className="wrap">
      <h1>Agent Payment Guardrails Simulator</h1>
      <p className="sub">
        Set the rules, watch a simulated shopping agent try to buy things, and see which purchases are approved,
        declined, or held for a person.
      </p>
      <div className="banner" role="note">
        Portfolio concept with synthetic data. No real payments, merchants, or cards are involved, and the agent is
        a fixed script, not a live AI. The rules are illustrative and are not a fraud or compliance product.
      </div>

      <nav className="steps" aria-label="Steps">
        {(
          [
            [1, "1. Rules"],
            [2, "2. Agent day"],
            [3, "3. Dashboard and approvals"],
          ] as [Step, string][]
        ).map(([n, text]) => (
          <button
            key={n}
            className="step"
            aria-current={step === n ? "step" : undefined}
            onClick={() => setStep(n)}
          >
            {text}
          </button>
        ))}
      </nav>

      {step === 1 && (
        <section className="card" aria-labelledby="rules-h">
          <h2 id="rules-h">Rules for the agent</h2>
          <p className="sub">Change any value. Steps 2 and 3 update right away.</p>
          <div className="grid">
            <NumberField
              id="ptl"
              text="Per-purchase limit ($)"
              value={policy.perTransactionLimit}
              onChange={(n) => set("perTransactionLimit", n)}
            />
            <NumberField
              id="dl"
              text="Daily limit ($)"
              value={policy.dailyLimit}
              onChange={(n) => set("dailyLimit", n)}
            />
            <NumberField
              id="hat"
              text="A person must approve purchases above ($)"
              value={policy.humanApprovalAbove}
              onChange={(n) => set("humanApprovalAbove", n)}
            />
            <NumberField
              id="nm"
              text="A person must approve a first purchase from a new merchant above ($)"
              value={policy.newMerchantReviewAbove}
              onChange={(n) => set("newMerchantReviewAbove", n)}
            />
            <NumberField
              id="mph"
              text="Most approved purchases in one hour"
              value={policy.maxPurchasesPerHour}
              onChange={(n) => set("maxPurchasesPerHour", n)}
            />
            <NumberField
              id="dw"
              text="Duplicate window (minutes)"
              value={policy.duplicateWindowMinutes}
              onChange={(n) => set("duplicateWindowMinutes", n)}
            />
            <div>
              <label htmlFor="hc">Home country (2-letter code)</label>
              <input
                id="hc"
                value={policy.homeCountry}
                maxLength={2}
                onChange={(e) => set("homeCountry", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <h3>Blocked categories (always declined)</h3>
          <div className="checks">
            {CATEGORIES.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={policy.blockedCategories.includes(c)}
                  onChange={() => set("blockedCategories", toggle(policy.blockedCategories, c))}
                />
                {c}
              </label>
            ))}
          </div>

          <h3>Categories that always need a person</h3>
          <div className="checks">
            {CATEGORIES.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={policy.reviewCategories.includes(c)}
                  onChange={() => set("reviewCategories", toggle(policy.reviewCategories, c))}
                />
                {c}
              </label>
            ))}
          </div>

          <h3>Consent and fraud checks</h3>
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={policy.requireConsentForRecurring}
                onChange={(e) => set("requireConsentForRecurring", e.target.checked)}
              />
              Recurring charges need the owner&apos;s consent
            </label>
            <label>
              <input
                type="checkbox"
                checked={policy.reviewForeignPurchases}
                onChange={(e) => set("reviewForeignPurchases", e.target.checked)}
              />
              Hold purchases from outside the home country
            </label>
          </div>

          <h3>How the rules combine</h3>
          <p className="small muted">
            Every rule runs on every purchase. If any rule declines, the purchase is declined. If none decline but any
            asks for a person, the purchase waits. Otherwise it is approved. Held purchases do not count toward the
            daily limit until a person approves them.
          </p>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={() => setStep(2)}>
              See the agent&apos;s day
            </button>
            <button className="secondary" onClick={() => setPolicy(DEFAULT_POLICY)}>
              Reset rules
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <>
          <section className="card" aria-labelledby="day-h">
            <h2 id="day-h">The agent&apos;s day</h2>
            <p className="sub">
              {summary.total} purchase attempts, in time order. Open a row to see how each rule voted.
            </p>
            <div>
              {results.map((e) => (
                <details className={`req ${e.final}`} key={e.request.id}>
                  <summary>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span>
                        <strong>{clock(e.request.minute)}</strong> {e.request.merchant}{" "}
                        <span className="muted small">
                          {e.request.category}, {e.request.country}
                        </span>
                      </span>
                      <span className="row">
                        <strong>{money(e.request.amount)}</strong>
                        <span className={`badge ${e.final}`}>{label(e)}</span>
                      </span>
                    </div>
                    <div className="muted small">
                      {e.request.purpose.trim() ? `Agent says: ${e.request.purpose}` : "Agent gave no reason."}
                    </div>
                  </summary>
                  <table style={{ marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Result</th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.rules.map((r) => (
                        <tr key={r.ruleId}>
                          <td>{r.name}</td>
                          <td
                            className={
                              r.outcome === "decline" ? "rule-fail" : r.outcome === "review" ? "rule-hold" : "rule-ok"
                            }
                          >
                            {r.outcome === "decline" ? "Declines" : r.outcome === "review" ? "Holds" : "Passes"}
                          </td>
                          <td>{r.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="try-h">
            <h2 id="try-h">Try your own purchase</h2>
            <p className="sub">The new purchase is added to the end of the day and checked against the rules above.</p>
            <div className="grid">
              <div>
                <label htmlFor="cm">Merchant</label>
                <input
                  id="cm"
                  value={custom.merchant}
                  onChange={(e) => setCustom({ ...custom, merchant: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="cc">Category</label>
                <select
                  id="cc"
                  value={custom.category}
                  onChange={(e) => setCustom({ ...custom, category: e.target.value as Category })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <NumberField
                id="ca"
                text="Amount ($)"
                step={0.01}
                value={custom.amount}
                onChange={(n) => setCustom({ ...custom, amount: n })}
              />
              <div>
                <label htmlFor="cco">Merchant country (2-letter code)</label>
                <input
                  id="cco"
                  maxLength={2}
                  value={custom.country}
                  onChange={(e) => setCustom({ ...custom, country: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="full">
                <label htmlFor="cp">What the agent says it is for</label>
                <input
                  id="cp"
                  value={custom.purpose}
                  onChange={(e) => setCustom({ ...custom, purpose: e.target.value })}
                />
              </div>
              <div className="full checks">
                <label>
                  <input
                    type="checkbox"
                    checked={custom.recurring}
                    onChange={(e) => setCustom({ ...custom, recurring: e.target.checked })}
                  />
                  Recurring charge
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={custom.newMerchant}
                    onChange={(e) => setCustom({ ...custom, newMerchant: e.target.checked })}
                  />
                  First purchase from this merchant
                </label>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" onClick={addCustom}>
                Add to the day
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setRequests(SAMPLE_DAY);
                  setCalls({});
                }}
              >
                Reset the day
              </button>
              <button className="secondary" onClick={() => setStep(3)}>
                Go to dashboard
              </button>
            </div>
          </section>
        </>
      )}

      {step === 3 && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="muted small">Approved</div>
              <div className="big">{summary.approved}</div>
              <div className="small">{money(summary.approvedSpend)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Declined</div>
              <div className="big">{summary.declined}</div>
              <div className="small">{money(summary.declinedSpend)} stopped</div>
            </div>
            <div className="stat">
              <div className="muted small">Waiting for a person</div>
              <div className="big">{summary.waiting}</div>
              <div className="small">{money(summary.waitingSpend)} held</div>
            </div>
          </div>

          <section className="card" aria-labelledby="spend-h">
            <h2 id="spend-h">Daily limit used</h2>
            <div
              className={`bar ${summary.approvedSpend > policy.dailyLimit ? "over" : ""}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedPct)}
              aria-label="Share of the daily limit used"
            >
              <span style={{ width: `${usedPct}%` }} />
            </div>
            <p className="small muted">
              {money(summary.approvedSpend)} of {money(policy.dailyLimit)} approved today.
            </p>
          </section>

          <section className="card" aria-labelledby="queue-h">
            <h2 id="queue-h">Approval queue</h2>
            {waiting.length === 0 ? (
              <p className="muted">Nothing is waiting for a person.</p>
            ) : (
              waiting.map((e) => (
                <div className="req waiting" key={e.request.id}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span>
                      <strong>{clock(e.request.minute)}</strong> {e.request.merchant}{" "}
                      <span className="muted small">{e.request.category}</span>
                    </span>
                    <strong>{money(e.request.amount)}</strong>
                  </div>
                  <div className="small muted">
                    {e.request.purpose.trim() ? `Agent says: ${e.request.purpose}` : "Agent gave no reason."}
                  </div>
                  <ul className="small">
                    {e.rules
                      .filter((r) => r.outcome === "review")
                      .map((r) => (
                        <li key={r.ruleId}>
                          {r.name}: {r.detail}
                        </li>
                      ))}
                  </ul>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button
                      className="primary"
                      onClick={() => setCalls((c) => ({ ...c, [e.request.id]: "approve" }))}
                    >
                      Approve
                    </button>
                    <button
                      className="danger"
                      onClick={() => setCalls((c) => ({ ...c, [e.request.id]: "decline" }))}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
            {personCalls.length > 0 && (
              <>
                <h3>Decisions you made</h3>
                <ul className="small">
                  {personCalls.map((e) => (
                    <li key={e.request.id}>
                      {e.request.merchant} {money(e.request.amount)}: {label(e).toLowerCase()}{" "}
                      <button
                        className="secondary"
                        style={{ padding: "0 8px" }}
                        onClick={() =>
                          setCalls((c) => {
                            const next = { ...c };
                            delete next[e.request.id];
                            return next;
                          })
                        }
                      >
                        Undo
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="hits-h">
            <h2 id="hits-h">Which rules did the work</h2>
            {summary.ruleHits.length === 0 ? (
              <p className="muted">No rule declined or held anything.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Declines</th>
                    <th>Holds</th>
                    <th aria-label="Share of activity" />
                  </tr>
                </thead>
                <tbody>
                  {summary.ruleHits.map((h) => (
                    <tr key={h.ruleId}>
                      <td>{h.name}</td>
                      <td>{h.declines}</td>
                      <td>{h.reviews}</td>
                      <td style={{ width: "35%" }}>
                        <div className="bar" aria-hidden="true">
                          <span style={{ width: `${((h.declines + h.reviews) / maxHits) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="small muted">
              A purchase can trip several rules at once, so the counts add up to more than the number of purchases.
            </p>
          </section>

          <div className="row">
            <button className="secondary" onClick={() => setStep(1)}>
              Change the rules
            </button>
            <button className="secondary" onClick={() => setStep(2)}>
              Back to the agent&apos;s day
            </button>
          </div>
        </>
      )}
    </main>
  );
}
