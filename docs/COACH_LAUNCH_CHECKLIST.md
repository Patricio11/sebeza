# Coach launch checklist (founder actions)

Turning on `feature_flag_seeker_ai_coach` lights up BOTH coach features at once:
**interview practice** (AI coach page) and the **Coach's read** (Career compass).
The code shipped in Phase 22 + the 2026-08-19 wave; what remains is deliberately
manual  the Information Officer verifies the safety net personally.

**Why the gate exists:** the distress screen intercepts crisis-sounding messages
BEFORE any AI call and shows human crisis resources instead. That only works if
the resources are real and reachable. The seed ships ZERO numbers on purpose; a
wrong crisis number is worse than none. Verification-Honesty applies to phone
numbers too.

## 0 · Deploy first
- [ ] `git push`  the Coach's read, compass wave, and this checklist are local
      commits until deployed. (Migrations 0067-0069 are already on live Neon;
      the code needs the deploy.)

## 1 · Verify + add crisis resources (/admin → Crisis resources)
Enter each service ONLY after personally verifying it that day (call it, or
check the official site). Name · contact exactly as verified · availability ·
optional note · **Active ON**. Two or three solid 24/7 entries beat a long list.

Candidates to verify (numbers may have changed  check before entering):
- [ ] SADAG Suicide Crisis Line  0800 567 567 (24/7)
- [ ] Lifeline South Africa  0861 322 322 (24/7)
- [ ] GBV Command Centre  0800 428 428 (24/7)
- [ ] Childline SA  116 (24/7, free from any phone)
- [ ] SADAG Mental Health Line  011 234 4837 (office hours; optional)

## 2 · Configure the LLM provider (/admin/llm)
- [ ] Pick provider (Anthropic / OpenAI / Mistral / self-hosted) + paste API key
      (encrypted at rest)
- [ ] Set the monthly budget in ZAR  the coach HARD-STOPS at the cap. Start
      small (e.g. R200) and raise it once real usage shows.
- [ ] Mark the provider Active + run the test button until it passes

## 3 · The acknowledgement (/admin/llm)
- [ ] Tick the safety acknowledgement (safety review complete + crisis resources
      live and verified) and enable the coach switch. This is the Information
      Officer's personal sign-off  it flips `feature_flag_seeker_ai_coach` ON.

## 4 · Prove the safety net (test seeker account, ~2 minutes)
- [ ] Interview practice with a normal role title → questions come back
- [ ] Interview practice with a distress-sounding phrase → NO AI call; your
      verified crisis resources render instead
- [ ] Career compass → "Explain my compass" → read the Coach's read yourself
      (headline + body + honest caveat, "practice, not a promise" footer)
- [ ] Glance at the safety telemetry on /admin/llm (distress fires, moderation
      drops, spend) during the first week

## Notes
- The Coach's read has NO text input by design  the distress surface does not
  exist there; the payload is pseudonymous (skills, numbers, course titles).
- Reads are cached per seeker until their data changes: ~one provider call per
  real change. Budget exhaustion degrades gracefully (the compass still works).
- If any step misbehaves, note what you saw and hand it back to Claude.
