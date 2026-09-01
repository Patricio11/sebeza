# Employer-view polish: what an employer sees on a profile

Source: founder's friend's feedback email (26 Jun 2026), triaged 2026-09-01 against the
current system. Ten points; four survive as work, the rest are already built, already
solved, or consciously rejected.

```
implement ▶ 1/10  raw "66%" off every employer-facing surface; Essentials line instead
            4     Trust panel: honest verification lines (identity / email / quals)
            3/8   hero fact chips: latest qualification + availability at a glance
            7     bio prompt asks "why should someone hire you"

reject    ▶ 2    CV as source of truth (profile-first is the model; LLM CV-parsing
                 ships raw PII to a provider - new POPIA purpose; maybe an opt-in
                 assist much later)
            6    Employer Confidence stars (fake-precision score applied to humans;
                 the Trust panel + Essentials line say the same thing honestly)

done      ▶ 5    Request to engage (praised; unchanged)
            9    profession-relevant skills (alias matching + role blueprints; for a
                 promoted profession like Film Director the admin drafts its
                 blueprint on /admin/blueprints)
```

Decisions:
- Completeness remains a SEEKER number (dashboard) and an internal ranking input.
  No employer-facing surface prints the percent.
- The Essentials row derives from data, listing only what is true: experience,
  qualifications, skills, languages; "Still building their profile" when none.
- Trust rows never invent a tick: identity = live selfie only; email is genuinely
  always verified for active accounts; qualifications say "self-declared" unless a
  real verification exists. References are not a thing and do not appear.

## TASKS

- [x] /p/[handle]: remove the ProfileCompleteness chip from the hero and the Completeness row from the dossier
- [x] Dossier: replace the bare Verification row with Identity / Email / Qualifications trust rows + the Essentials row
- [x] Hero: fact-chip row (caught + fixed a hydration crash: the chips list cannot live inside a <p>) (latest qualification, availability) under the meta line
- [x] bioHelp copy in en/zu/xh/af: "why someone should hire you"

## VERIFY

- [x] Full suite + build green (636 tests)
- [x] Harness screenshots ev01-ev03: visitor view with no percent anywhere, Identity/Email/Qualifications/Essentials rows, hero chips; minimal profile says "Qualifications, skills on file"; hydration clean on /p as a visitor (no percent anywhere, trust rows, chips), owner preview matches
- [ ] Founder: draft the Film Director blueprint on /admin/blueprints (no code)
