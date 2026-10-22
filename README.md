# Agent Payment Guardrails Simulator

A concept project that shows how spend limits, consent rules, and fraud checks could decide whether an AI shopping agent's purchases are approved, declined, or held for a person.

**This is a portfolio concept using synthetic data.** No real payments, cards, or merchants are involved. The agent is a fixed script of 14 purchase attempts, not a live AI. The rules are illustrative and are not a fraud or compliance product.

## Screens
1. Rules: limits, blocked categories, categories that need a person, and consent and fraud checks. Every value can be changed.
2. Agent day: the 14 purchase attempts in time order, each with a decision and an expandable table showing how every rule voted. A form lets you add your own purchase.
3. Dashboard and approvals: counts and dollar totals for approved, declined, and waiting purchases, how much of the daily limit is used, an approval queue where you approve or decline held purchases, and a table of which rules did the most work.

Results recompute as soon as a rule changes, so you can see the effect of a policy choice without a run button.

## How the rules combine
Every rule runs on every purchase. If any rule declines, the purchase is declined. If none decline but any asks for a person, it waits. Otherwise it is approved. Held purchases stay out of the daily total until a person approves them, and a person's call is applied at the point in the day where the purchase arrived, so later checks see the right running total.

Rules in this version: valid amount, stated purpose, blocked category, per-purchase limit, daily limit, duplicate check, approval threshold, category review, new merchant, recurring consent, foreign purchase, and purchase speed.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000. No API key or environment variable is needed.

## Tests
```bash
npm test
```
Seventeen tests cover the decision order (a decline beats a hold), limits at the exact boundary, empty and invalid input, the daily limit counting approved spend only, a person's approval changing later results, the duplicate check, purchase speed over a rolling hour, policy changes, and the summary totals.

## Deploy to Vercel
1. Put this folder in its own GitHub repository.
2. In Vercel, choose Add New, then Project, and import the repository. Framework preset: Next.js.
3. Click Deploy. There are no environment variables to set.

## Project layout
- `lib/guardrails.ts`: policy, rules, decision logic, day runner, summary, sample purchases
- `app/page.tsx`: the three-screen interface
- `tests/guardrails.test.ts`: unit tests
- `docs/`: problem brief and case study draft

## Known limits
- The agent is scripted. A real agent's behavior would be less predictable.
- Thresholds are made-up round numbers. Real limits would come from a product's risk data and policy.
- There is no real fraud model, identity check, or merchant data. The "new merchant" and "foreign" signals are simple flags.
- Decisions are not stored. Refreshing the page resets the day.
- No users have tested this, so it makes no claims about accuracy or fraud reduction.
