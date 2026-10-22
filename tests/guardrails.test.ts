import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POLICY,
  SAMPLE_DAY,
  runDay,
  summarize,
  decide,
  checkRules,
  type PurchaseRequest,
  type Policy,
} from "../lib/guardrails";

const base: PurchaseRequest = {
  id: "x",
  minute: 600,
  merchant: "Test Shop",
  category: "Groceries",
  amount: 20,
  recurring: false,
  newMerchant: false,
  country: "US",
  purpose: "Test purchase",
};

const req = (over: Partial<PurchaseRequest>): PurchaseRequest => ({ ...base, ...over });
const finalOf = (results: ReturnType<typeof runDay>, id: string) => results.find((r) => r.request.id === id)!;

test("sample day under the default policy gives 5 approved, 3 declined, 6 waiting", () => {
  const s = summarize(runDay(SAMPLE_DAY, DEFAULT_POLICY));
  assert.equal(s.total, 14);
  assert.equal(s.approved, 5);
  assert.equal(s.declined, 3);
  assert.equal(s.waiting, 6);
  assert.equal(s.approved + s.declined + s.waiting, s.total);
});

test("a decline beats a hold when both apply", () => {
  const results = runDay([req({ id: "a", category: "Gambling", amount: 200 })], DEFAULT_POLICY);
  assert.equal(results[0].automatic, "declined");
  assert.equal(results[0].final, "declined");
  assert.equal(results[0].decidedBy, "rules");
});

test("a request with no hold or decline is approved by the rules", () => {
  const rules = checkRules(req({}), DEFAULT_POLICY, []);
  assert.equal(decide(rules), "approved");
});

test("an amount equal to the limit is allowed, one cent over is declined", () => {
  const policy: Policy = { ...DEFAULT_POLICY, perTransactionLimit: 100, humanApprovalAbove: 500, dailyLimit: 1000 };
  const at = runDay([req({ id: "a", amount: 100 })], policy);
  const over = runDay([req({ id: "b", amount: 100.01 })], policy);
  assert.equal(at[0].final, "approved");
  assert.equal(over[0].final, "declined");
});

test("zero amount and missing purpose are both declined", () => {
  const zero = runDay([req({ id: "a", amount: 0 })], DEFAULT_POLICY);
  const blank = runDay([req({ id: "b", purpose: "   " })], DEFAULT_POLICY);
  assert.equal(zero[0].final, "declined");
  assert.equal(blank[0].final, "declined");
});

test("daily limit counts approved spend only, not held requests", () => {
  const policy: Policy = { ...DEFAULT_POLICY, dailyLimit: 100, humanApprovalAbove: 60, maxPurchasesPerHour: 10 };
  const results = runDay(
    [
      req({ id: "a", minute: 600, amount: 70, merchant: "A" }), // held: over 60
      req({ id: "b", minute: 610, amount: 50, merchant: "B" }), // approved, spend 50
      req({ id: "c", minute: 620, amount: 40, merchant: "C" }), // approved, spend 90
      req({ id: "d", minute: 630, amount: 20, merchant: "D" }), // 90 + 20 > 100, declined
    ],
    policy
  );
  assert.equal(finalOf(results, "a").final, "waiting");
  assert.equal(finalOf(results, "b").final, "approved");
  assert.equal(finalOf(results, "c").final, "approved");
  assert.equal(finalOf(results, "d").final, "declined");
  assert.equal(finalOf(results, "d").spentAfter, 90);
});

test("a person approving a held request adds it to spend and affects later checks", () => {
  const policy: Policy = { ...DEFAULT_POLICY, dailyLimit: 100, humanApprovalAbove: 60, maxPurchasesPerHour: 10 };
  const requests = [
    req({ id: "a", minute: 600, amount: 70, merchant: "A" }),
    req({ id: "b", minute: 610, amount: 40, merchant: "B" }),
  ];
  const without = runDay(requests, policy);
  assert.equal(finalOf(without, "b").final, "approved");

  const withCall = runDay(requests, policy, { a: "approve" });
  assert.equal(finalOf(withCall, "a").final, "approved");
  assert.equal(finalOf(withCall, "a").decidedBy, "person");
  assert.equal(finalOf(withCall, "b").final, "declined"); // 70 + 40 > 100
});

test("a person declining a held request leaves spend unchanged", () => {
  const results = runDay(SAMPLE_DAY, DEFAULT_POLICY, { r3: "decline" });
  const r3 = finalOf(results, "r3");
  assert.equal(r3.final, "declined");
  assert.equal(r3.decidedBy, "person");
  assert.equal(r3.spentAfter, finalOf(results, "r2").spentAfter);
});

test("duplicate check fires once the first purchase is actually approved", () => {
  const before = runDay(SAMPLE_DAY, DEFAULT_POLICY);
  assert.equal(finalOf(before, "r4").automatic, "needs_approval"); // r3 was never approved

  const after = runDay(SAMPLE_DAY, DEFAULT_POLICY, { r3: "approve" });
  assert.equal(finalOf(after, "r4").automatic, "declined");
  assert.ok(finalOf(after, "r4").rules.some((r) => r.ruleId === "duplicate" && r.outcome === "decline"));
});

test("purchase speed holds the fifth rapid purchase", () => {
  const policy: Policy = { ...DEFAULT_POLICY, maxPurchasesPerHour: 4 };
  const rapid = [1, 2, 3, 4, 5].map((n) =>
    req({ id: `p${n}`, minute: 600 + n, amount: 10 + n, merchant: `M${n}` })
  );
  const results = runDay(rapid, policy);
  assert.deepEqual(
    results.map((r) => r.final),
    ["approved", "approved", "approved", "approved", "waiting"]
  );
  assert.ok(finalOf(results, "p5").rules.some((r) => r.ruleId === "velocity" && r.outcome === "review"));
});

test("purchases older than an hour do not count toward purchase speed", () => {
  const policy: Policy = { ...DEFAULT_POLICY, maxPurchasesPerHour: 1 };
  const results = runDay(
    [req({ id: "a", minute: 600, merchant: "A" }), req({ id: "b", minute: 661, merchant: "B" })],
    policy
  );
  assert.equal(finalOf(results, "b").final, "approved");
});

test("changing the policy changes the outcome", () => {
  const strict: Policy = { ...DEFAULT_POLICY, perTransactionLimit: 200 };
  const loose = runDay(SAMPLE_DAY, DEFAULT_POLICY);
  const tight = runDay(SAMPLE_DAY, strict);
  assert.equal(finalOf(loose, "r3").final, "waiting"); // 240 is held under the default policy
  assert.equal(finalOf(tight, "r3").final, "declined"); // 240 is over a 200 limit
});

test("turning off recurring consent lets a small subscription through", () => {
  const policy: Policy = { ...DEFAULT_POLICY, requireConsentForRecurring: false };
  const results = runDay([req({ id: "a", recurring: true, amount: 12, category: "Subscriptions" })], policy);
  assert.equal(results[0].final, "approved");
  const strict = runDay([req({ id: "a", recurring: true, amount: 12, category: "Subscriptions" })], DEFAULT_POLICY);
  assert.equal(strict[0].final, "waiting");
});

test("foreign purchases are held and the home country is configurable", () => {
  const held = runDay([req({ id: "a", country: "ES" })], DEFAULT_POLICY);
  assert.equal(held[0].final, "waiting");
  const home = runDay([req({ id: "a", country: "ES" })], { ...DEFAULT_POLICY, homeCountry: "ES" });
  assert.equal(home[0].final, "approved");
});

test("runDay sorts by time and does not change the input list", () => {
  const input = [req({ id: "late", minute: 700 }), req({ id: "early", minute: 100, merchant: "Other" })];
  const copy = JSON.parse(JSON.stringify(input));
  const results = runDay(input, DEFAULT_POLICY);
  assert.deepEqual(
    results.map((r) => r.request.id),
    ["early", "late"]
  );
  assert.deepEqual(input, copy);
});

test("summary totals add up and rule hits are sorted by activity", () => {
  const results = runDay(SAMPLE_DAY, DEFAULT_POLICY);
  const s = summarize(results);
  const approvedSum = results.filter((r) => r.final === "approved").reduce((t, r) => t + r.request.amount, 0);
  assert.equal(s.approvedSpend, approvedSum);
  const activity = s.ruleHits.map((h) => h.declines + h.reviews);
  assert.deepEqual(activity, [...activity].sort((a, b) => b - a));
  assert.ok(s.ruleHits.every((h) => h.declines + h.reviews > 0));
});

test("an empty day gives an empty summary", () => {
  const s = summarize(runDay([], DEFAULT_POLICY));
  assert.equal(s.total, 0);
  assert.equal(s.approvedSpend, 0);
  assert.deepEqual(s.ruleHits, []);
});
