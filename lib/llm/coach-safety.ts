/**
 * Phase 22  AI Career Coach safety helpers. PURE + deterministic (no I/O, no
 * provider call) so they work even when the LLM is down and are trivially unit-
 * tested. Two concerns live here:
 *
 *   - `moderateQuestions` (22.3): a high-precision backstop that drops any
 *     generated "question" that slipped past the hardened prompt into a promise,
 *     an outcome claim, or contact details. Conservative by design  it only
 *     removes clear violations, never legitimate interview questions.
 *   - `detectDistress` (22.2): a pre-LLM screen for acute-crisis / self-harm
 *     signals in the seeker's free text. On a hit the caller MUST NOT dispatch
 *     to the provider  it routes to human crisis resources instead.
 */

// ── 22.3: output moderation ──────────────────────────────────────────────────

const QUESTION_BLOCK_PATTERNS: RegExp[] = [
  // Promises / outcome claims — an interview PRACTICE question never asserts these.
  /\b(you(?:'re| are) hired|you got the job|you(?:'ll| will) get (?:the|this) (?:job|role|position)|guaranteed?|you passed|we(?:'ll| will) hire you|offer you the (?:job|role|position))\b/i,
  // Contact details have no place in a practice question.
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // email
  /\bhttps?:\/\//i, // url
  /\+27\d{9}\b/, // SA phone (+27…)
  /\b0\d{9}\b/, // SA phone (0…)
];

export function moderateQuestions(questions: string[]): {
  kept: string[];
  droppedCount: number;
} {
  let droppedCount = 0;
  const kept = questions.filter((q) => {
    const violates = QUESTION_BLOCK_PATTERNS.some((re) => re.test(q));
    if (violates) droppedCount += 1;
    return !violates;
  });
  return { kept, droppedCount };
}

// ── 22.2: distress detection ─────────────────────────────────────────────────

/**
 * Acute-distress / self-harm / crisis signals. Deliberately high-recall on the
 * gravest signals (better a false positive  which shows supportive resources
 * than a miss). Word-boundary anchored to avoid matching inside benign words
 * (e.g. "kill" in "skill" is excluded by the boundaries + the phrase shapes).
 * Stems chosen to be robust to common phrasings; NOT an exhaustive clinical list.
 */
const DISTRESS_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm)(ing)?\s+(myself|me)\b/i,
  /\bend(ing)?\s+(my|it)\s+(life|all)\b/i,
  /\b(want|going|need)\s+to\s+die\b/i,
  /\bsuicid/i,
  /\bself[-\s]?harm\b/i,
  /\bno\s+(reason|point)\s+to\s+(live|go on|carry on)\b/i,
  /\bcan(no|')?t\s+go\s+on\b/i,
  /\b(better\s+off|everyone.{0,10}better)\s+(dead|without me)\b/i,
  /\bnothing\s+to\s+live\s+for\b/i,
  /\btake\s+my\s+(own\s+)?life\b/i,
];

export function detectDistress(text: string): boolean {
  if (!text) return false;
  return DISTRESS_PATTERNS.some((re) => re.test(text));
}
