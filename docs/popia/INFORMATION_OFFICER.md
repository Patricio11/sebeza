# Information Officer designation

> POPIA Section 56 requires every responsible party to designate an
> Information Officer. PAIA Section 17 requires a Deputy. Both must be
> registered with the Information Regulator before the platform begins
> processing personal information at commercial scale.

Last updated 2026-06-01 (Phase 13 added a new processing purpose + potential cross-border sub-processors via the admin-managed LLM pipeline).

---

## Status

**Pre-launch  to be designated before commercial pilot.**

A working email is published already at `popia@sebenzasa.com` and surfaced on
`/privacy` and `/paia` so individuals can exercise their rights today. The
named-individual designation gets filled in here once the founding team /
investor structure is locked.

## What this role does

1. Receives and responds to PAIA + POPIA requests (Section 23 access,
   Section 24 correction/deletion, objections to processing).
2. Maintains this manual and the Privacy Policy.
3. Oversees the breach-notification process (`BREACH_RESPONSE.md`).
4. Approves new processing purposes and new sub-processors. **Phase 13.3 introduces an editorial-catalogue-enrichment processing purpose using LLM sub-processors (OpenAI / Anthropic in the US, Mistral in the EU, or self-hosted in af-south-1)**  the activation flow on `/admin/llm` already gates cross-border configuration behind an explicit POPIA s.72 acknowledgement timestamped in `llm_providers.s72_acknowledged_at` + the audit row. The Information Officer signs off the choice of provider as part of the operational launch. Self-hosted is the POPIA-clean recommended path.
5. Registers with the Information Regulator at
   <https://inforegulator.org.za/>.

## How to update

When the Information Officer is named:

1. Edit this file with name + role + work address.
2. Submit registration with the Information Regulator (Form for
   designation; the Regulator publishes the template).
3. Update `/paia` Section 2 (the page renders from a placeholder today).
4. Add the named person to the responding-to-requests rota documented in
   `BREACH_RESPONSE.md`.
