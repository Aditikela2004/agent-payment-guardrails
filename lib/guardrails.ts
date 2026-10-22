export type Category =
  | "Groceries"
  | "Software"
  | "Travel"
  | "Electronics"
  | "Gift cards"
  | "Subscriptions"
  | "Gambling"
  | "Crypto and cash-like";

export const CATEGORIES: Category[] = [
  "Groceries",
  "Software",
  "Travel",
  "Electronics",
  "Gift cards",
  "Subscriptions",
  "Gambling",
  "Crypto and cash-like",
];

export type PurchaseRequest = {
  id: string;
  /** Minutes since the start of the simulated day. */
  minute: number;
  merchant: string;
  category: Category;
  amount: number;
  recurring: boolean;
  newMerchant: boolean;
  country: string;
  /** What the agent says the purchase is for. */
  purpose: string;
};

export type Policy = {
  homeCountry: string;
  perTransactionLimit: number;
  dailyLimit: number;
  /** Purchases above this amount wait for a person. */
  humanApprovalAbove: number;
  blockedCategories: Category[];
  reviewCategories: Category[];
  /** A first purchase from a merchant above this amount waits for a person. */
  newMerchantReviewAbove: number;
  /** Maximum approved purchases in any rolling 60 minutes. */
  maxPurchasesPerHour: number;
  requireConsentForRecurring: boolean;
  reviewForeignPurchases: boolean;
  /** Same merchant and amount inside this many minutes is treated as a duplicate. */
  duplicateWindowMinutes: number;
};

export const DEFAULT_POLICY: Policy = {
  homeCountry: "US",
  perTransactionLimit: 300,
  dailyLimit: 500,
  humanApprovalAbove: 150,
  blockedCategories: ["Gambling", "Crypto and cash-like"],
  reviewCategories: ["Gift cards"],
  newMerchantReviewAbove: 50,
  maxPurchasesPerHour: 4,
  requireConsentForRecurring: true,
  reviewForeignPurchases: true,
  duplicateWindowMinutes: 10,
};

export type RuleOutcome = "pass" | "decline" | "review";

export type RuleResult = {
  ruleId: string;
  name: string;
  outcome: RuleOutcome;
  detail: string;
};

export type Decision = "approved" | "declined" | "needs_approval";

export type HumanCall = "approve" | "decline";

export type Evaluated = {
  request: PurchaseRequest;
  /** What the rules decided before any person looked at it. */
  automatic: Decision;
  /** What happened in the end, including a person's call on held items. */
  final: "approved" | "declined" | "waiting";
  decidedBy: "rules" | "person" | "none";
  rules: RuleResult[];
  /** Total approved spend after this request. */
  spentAfter: number;
};

type Approved = { merchant: string; amount: number; minute: number };

const money = (n: number) => `$${n.toFixed(2)}`;

export function checkRules(
  req: PurchaseRequest,
  policy: Policy,
  approved: Approved[]
): RuleResult[] {
  const spent = approved.reduce((sum, a) => sum + a.amount, 0);
  const lastHour = approved.filter((a) => req.minute - a.minute < 60).length;
  const out: RuleResult[] = [];

  const add = (ruleId: string, name: string, outcome: RuleOutcome, detail: string) =>
    out.push({ ruleId, name, outcome, detail });

  // 1. The request has to be well formed before anything else matters.
  if (!(req.amount > 0)) {
    add("valid-amount", "Valid amount", "decline", "The amount must be greater than zero.");
  } else {
    add("valid-amount", "Valid amount", "pass", "Amount is valid.");
  }

  if (req.purpose.trim().length === 0) {
    add("stated-purpose", "Stated purpose", "decline", "The agent gave no reason for the purchase.");
  } else {
    add("stated-purpose", "Stated purpose", "pass", "The agent stated a purpose.");
  }

  // 2. Hard stops.
  if (policy.blockedCategories.includes(req.category)) {
    add("blocked-category", "Blocked category", "decline", `${req.category} is blocked for agents.`);
  } else {
    add("blocked-category", "Blocked category", "pass", `${req.category} is allowed.`);
  }

  if (req.amount > policy.perTransactionLimit) {
    add(
      "per-transaction-limit",
      "Per-purchase limit",
      "decline",
      `${money(req.amount)} is over the ${money(policy.perTransactionLimit)} limit.`
    );
  } else {
    add("per-transaction-limit", "Per-purchase limit", "pass", `Within the ${money(policy.perTransactionLimit)} limit.`);
  }

  if (spent + req.amount > policy.dailyLimit) {
    add(
      "daily-limit",
      "Daily limit",
      "decline",
      `${money(spent)} already approved today, so ${money(req.amount)} would pass the ${money(policy.dailyLimit)} limit.`
    );
  } else {
    add("daily-limit", "Daily limit", "pass", `${money(spent + req.amount)} of ${money(policy.dailyLimit)} would be used.`);
  }

  const duplicate = approved.find(
    (a) =>
      a.merchant === req.merchant &&
      a.amount === req.amount &&
      req.minute - a.minute <= policy.duplicateWindowMinutes
  );
  if (duplicate) {
    add(
      "duplicate",
      "Duplicate check",
      "decline",
      `Same merchant and amount approved ${req.minute - duplicate.minute} minutes earlier.`
    );
  } else {
    add("duplicate", "Duplicate check", "pass", "No matching recent purchase.");
  }

  // 3. Hold for a person.
  if (req.amount > policy.humanApprovalAbove) {
    add(
      "human-approval-threshold",
      "Approval threshold",
      "review",
      `Over ${money(policy.humanApprovalAbove)}, so a person decides.`
    );
  } else {
    add("human-approval-threshold", "Approval threshold", "pass", `At or under ${money(policy.humanApprovalAbove)}.`);
  }

  if (policy.reviewCategories.includes(req.category)) {
    add("review-category", "Category review", "review", `${req.category} always needs a person.`);
  } else {
    add("review-category", "Category review", "pass", "Category does not need review.");
  }

  if (req.newMerchant && req.amount > policy.newMerchantReviewAbove) {
    add(
      "new-merchant",
      "New merchant",
      "review",
      `First purchase from ${req.merchant} and over ${money(policy.newMerchantReviewAbove)}.`
    );
  } else {
    add("new-merchant", "New merchant", "pass", req.newMerchant ? "New merchant, small amount." : "Known merchant.");
  }

  if (policy.requireConsentForRecurring && req.recurring) {
    add("recurring-consent", "Recurring consent", "review", "Recurring charges need the owner's consent.");
  } else {
    add("recurring-consent", "Recurring consent", "pass", req.recurring ? "Consent not required by policy." : "One-time purchase.");
  }

  if (policy.reviewForeignPurchases && req.country !== policy.homeCountry) {
    add("foreign", "Foreign purchase", "review", `Merchant is in ${req.country}, not ${policy.homeCountry}.`);
  } else {
    add("foreign", "Foreign purchase", "pass", "Merchant is in the home country.");
  }

  if (lastHour >= policy.maxPurchasesPerHour) {
    add(
      "velocity",
      "Purchase speed",
      "review",
      `${lastHour} purchases approved in the last hour. The limit is ${policy.maxPurchasesPerHour}.`
    );
  } else {
    add("velocity", "Purchase speed", "pass", `${lastHour} of ${policy.maxPurchasesPerHour} purchases used this hour.`);
  }

  return out;
}

/** A decline beats a hold, and a hold beats an approval. */
export function decide(rules: RuleResult[]): Decision {
  if (rules.some((r) => r.outcome === "decline")) return "declined";
  if (rules.some((r) => r.outcome === "review")) return "needs_approval";
  return "approved";
}

/**
 * Run a list of requests in time order. Held requests stay out of the spend
 * total until a person approves them. A person's call is applied at the point
 * where the request arrived, so later checks see the right running total.
 */
export function runDay(
  requests: PurchaseRequest[],
  policy: Policy,
  calls: Record<string, HumanCall> = {}
): Evaluated[] {
  const ordered = [...requests].sort((a, b) => a.minute - b.minute);
  const approved: Approved[] = [];
  const results: Evaluated[] = [];

  for (const request of ordered) {
    const rules = checkRules(request, policy, approved);
    const automatic = decide(rules);
    let final: Evaluated["final"];
    let decidedBy: Evaluated["decidedBy"];

    if (automatic === "approved") {
      final = "approved";
      decidedBy = "rules";
    } else if (automatic === "declined") {
      final = "declined";
      decidedBy = "rules";
    } else if (calls[request.id] === "approve") {
      final = "approved";
      decidedBy = "person";
    } else if (calls[request.id] === "decline") {
      final = "declined";
      decidedBy = "person";
    } else {
      final = "waiting";
      decidedBy = "none";
    }

    if (final === "approved") {
      approved.push({ merchant: request.merchant, amount: request.amount, minute: request.minute });
    }

    results.push({
      request,
      automatic,
      final,
      decidedBy,
      rules,
      spentAfter: approved.reduce((sum, a) => sum + a.amount, 0),
    });
  }
  return results;
}

export type Summary = {
  total: number;
  approved: number;
  declined: number;
  waiting: number;
  approvedSpend: number;
  declinedSpend: number;
  waitingSpend: number;
  /** How many requests each rule declined or held, most active first. */
  ruleHits: { ruleId: string; name: string; declines: number; reviews: number }[];
};

export function summarize(results: Evaluated[]): Summary {
  const sum = (items: Evaluated[]) => items.reduce((s, r) => s + r.request.amount, 0);
  const approved = results.filter((r) => r.final === "approved");
  const declined = results.filter((r) => r.final === "declined");
  const waiting = results.filter((r) => r.final === "waiting");

  const hits = new Map<string, { ruleId: string; name: string; declines: number; reviews: number }>();
  for (const r of results) {
    for (const rule of r.rules) {
      if (rule.outcome === "pass") continue;
      const entry = hits.get(rule.ruleId) ?? { ruleId: rule.ruleId, name: rule.name, declines: 0, reviews: 0 };
      if (rule.outcome === "decline") entry.declines += 1;
      else entry.reviews += 1;
      hits.set(rule.ruleId, entry);
    }
  }

  return {
    total: results.length,
    approved: approved.length,
    declined: declined.length,
    waiting: waiting.length,
    approvedSpend: sum(approved),
    declinedSpend: sum(declined),
    waitingSpend: sum(waiting),
    ruleHits: [...hits.values()].sort(
      (a, b) => b.declines + b.reviews - (a.declines + a.reviews) || a.name.localeCompare(b.name)
    ),
  };
}

/** Synthetic purchase attempts from a made-up household assistant agent. */
export const SAMPLE_DAY: PurchaseRequest[] = [
  { id: "r1", minute: 480, merchant: "Greenleaf Market", category: "Groceries", amount: 84.2, recurring: false, newMerchant: false, country: "US", purpose: "Weekly grocery restock from the saved list" },
  { id: "r2", minute: 495, merchant: "Notely", category: "Software", amount: 12, recurring: true, newMerchant: false, country: "US", purpose: "Monthly note-taking app renewal" },
  { id: "r3", minute: 540, merchant: "Skyline Air", category: "Travel", amount: 240, recurring: false, newMerchant: true, country: "US", purpose: "Flight to the March family visit" },
  { id: "r4", minute: 545, merchant: "Skyline Air", category: "Travel", amount: 240, recurring: false, newMerchant: true, country: "US", purpose: "Flight to the March family visit (retry)" },
  { id: "r5", minute: 600, merchant: "QuickCoin Exchange", category: "Crypto and cash-like", amount: 120, recurring: false, newMerchant: true, country: "US", purpose: "Top up wallet for a discount offer" },
  { id: "r6", minute: 640, merchant: "PrintWorks", category: "Electronics", amount: 45, recurring: false, newMerchant: false, country: "US", purpose: "Printer ink, supplies were low" },
  { id: "r7", minute: 645, merchant: "PrintWorks", category: "Electronics", amount: 18, recurring: false, newMerchant: false, country: "US", purpose: "USB cable" },
  { id: "r8", minute: 648, merchant: "Greenleaf Market", category: "Groceries", amount: 22, recurring: false, newMerchant: false, country: "US", purpose: "Forgotten milk and eggs" },
  { id: "r9", minute: 652, merchant: "Greenleaf Market", category: "Groceries", amount: 9.5, recurring: false, newMerchant: false, country: "US", purpose: "Bread" },
  { id: "r10", minute: 655, merchant: "Greenleaf Market", category: "Groceries", amount: 14, recurring: false, newMerchant: false, country: "US", purpose: "Fruit" },
  { id: "r11", minute: 720, merchant: "Hotel Alba", category: "Travel", amount: 180, recurring: false, newMerchant: true, country: "ES", purpose: "Hotel deposit for the summer trip" },
  { id: "r12", minute: 780, merchant: "GiftNest", category: "Gift cards", amount: 60, recurring: false, newMerchant: false, country: "US", purpose: "Birthday gift card requested by the owner" },
  { id: "r13", minute: 840, merchant: "LuckyPlay", category: "Gambling", amount: 25, recurring: false, newMerchant: true, country: "US", purpose: "Sign-up bonus offer" },
  { id: "r14", minute: 900, merchant: "ByteForge", category: "Software", amount: 0, recurring: false, newMerchant: false, country: "US", purpose: "" },
];
