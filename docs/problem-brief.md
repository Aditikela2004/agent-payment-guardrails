# Problem brief: Agent Payment Guardrails Simulator

Concept project, synthetic data only.

## Problem
AI agents are starting to buy things on a person's behalf. A person who hands an agent a payment method needs to know what it can spend, when it has to ask first, and why a purchase was stopped. Without clear rules the choices are all or nothing: give the agent full access, or approve every purchase by hand.

## Users
- **Account owner:** wants the agent to handle small, routine purchases and to be asked about anything unusual.
- **Product or risk manager:** sets the default rules, and needs to see how a change affects approvals, declines, and the number of purchases that wait for a person.

## Goals
1. Let a product manager change a rule and see the effect on a realistic set of purchases right away.
2. Show the reason for every decision, down to the individual rule.
3. Keep a person in charge of anything above a threshold, anything recurring, and anything unusual.

## Scope of this concept
- A fixed set of 14 synthetic purchase attempts from a household assistant agent.
- Twelve rules covering limits, consent, and simple fraud signals.
- An approval queue where a person approves or declines held purchases.
- A form to test a custom purchase.

## Out of scope
- Real payment processing, cards, or merchants.
- A real fraud model or identity verification.
- Accounts, saved policies, or a stored audit trail.
- Live AI behavior. The agent is a script.

## Success measures to try once real users exist
These are measures to collect, not results.
- Share of agent purchases approved automatically versus held.
- Share of held purchases a person approves. A high rate suggests the threshold is too low and creates needless work.
- Number of purchases a person later disputes after automatic approval.
- Time a person spends on the approval queue per week.

## Open questions
- Where should the default thresholds come from? Spending history, the account's risk profile, or the owner's own settings?
- Should a person's repeated approvals of one merchant turn it into a known merchant?
- How should the agent explain a decline so the owner can fix the cause?
