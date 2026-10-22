# Case study draft: Agent Payment Guardrails Simulator

Fill in the bracketed parts from your own experience before publishing. Nothing here claims results the project has not produced.

## One-line summary
A concept tool that lets a product manager change spend, consent, and fraud rules for an AI shopping agent and see right away which purchases are approved, declined, or held for a person.

## Why I built it
[Add 2 to 3 sentences in your own words. A natural angle is your experience writing IT policies and controls at RBL Bank, and how a rule only feels reasonable once you see what it does to real cases. Use only things you actually observed.]

## The problem
Agents are beginning to make purchases for people. The owner needs to know what the agent may spend, when it must ask, and why a purchase was stopped. A single on/off switch is too blunt, and approving every purchase by hand removes the point of having an agent.

## What I built
- A rules screen with limits, blocked categories, categories that always need a person, and consent and fraud checks.
- A simulated day of 14 purchase attempts, each showing how every rule voted.
- A dashboard with approved, declined, and waiting counts and totals, daily limit used, and which rules did the most work.
- An approval queue where a person decides held purchases, with undo.
- A form to try a custom purchase against the current rules.

## Decisions and tradeoffs
1. **A decline beats a hold, and a hold beats an approval.** This order is predictable and easy to explain. The tradeoff is that a purchase that trips one hard rule never reaches a person, even when the owner might have wanted to override it.
2. **Held purchases do not count toward the daily limit until approved.** This stops a queue of pending items from blocking everything else. The tradeoff is that approving several held items later can push the day over what the owner expected, so a person's call is checked against the running total at the point it arrived.
3. **Live recompute instead of a run button.** A product manager can change one number and watch outcomes move. It makes tuning thresholds quick. The cost is that a person's earlier approvals stay in place when a rule changes, so the reviewer has to use Undo if they want to start clean.
4. **Show the reason for every rule.** A decision without a reason would be hard to trust or debug. The cost is a longer table per purchase, so rows are collapsed by default.
5. **A scripted agent.** The sample day is fixed so results are repeatable and each rule has a case that triggers it. A real agent would behave less predictably.

## What the default sample day shows
Under the default rules, 5 of the 14 purchases are approved, 3 are declined, and 6 wait for a person. These counts come from made-up purchases and made-up thresholds, so they say nothing about real fraud rates. They show how the rules interact: for example, a retry of the same flight is held rather than declined until the first one is approved, at which point the duplicate check declines it.

## What I tested
- Seventeen unit tests on the rules engine: decision order, limits at the exact boundary, invalid input, daily limit using approved spend only, a person's approval changing later results, duplicate detection, purchase speed over a rolling hour, policy changes, and summary totals.
- A production build and a click-through of all three screens in a headless browser.

## What I have not tested yet
- No real users, so no claims about accuracy, fraud reduction, or time saved.
- The thresholds are placeholders and have not been compared with real spending data.
- No accessibility audit beyond basic labels and keyboard-reachable controls.

## What I would do next
1. Ask 3 to 5 people who manage payments or risk to change the rules and tell me which decisions surprise them.
2. Let the owner set rules per merchant or category instead of one global policy.
3. Add a plain-language message the agent can show when it is declined, so the owner can fix the cause.
4. Store decisions in an audit trail on a server.

## Skills shown
Product thinking for payments and AI agents, policy and control design, edge-case analysis, prototyping, testing, and deployment.

## Links
- Live demo: [add Vercel URL after deploy]
- Code: [add GitHub URL]
