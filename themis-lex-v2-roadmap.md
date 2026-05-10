# Themis Lex — v2 Roadmap
**Purpose:** Post-launch features and enhancements explicitly out of scope for v1 submission.
**Status:** Reference document. Items here are not built until v1 ships and there is intentional capacity to start v2.
**Companion docs:** `themis-lex-active-checklist.md` (current v1 work), `themis-lex-build-lessons.md` (process improvements)

---

## Why a v2 Roadmap Exists

During the v1 build, real features and ideas surfaced that didn't fit the four-week submission window. Rather than scope-creep them in or lose them entirely, they live here. This roadmap is the contract with future-self that says: "This will not be forgotten, and it will not be rushed into v1."

After v1 submission, these become the basis for what comes next. The order below is rough — actual priority depends on what real users ask for first.

---

## v2 Backlog

### Two-call differential temperature (the marquee v2 feature)
**Source:** Original architecture, deferred per Fast Lane Addendum
**Implementation:** Already specified as STUB V2 in `bedrock.ts`. Two calls — 0.7 for can_help, 0.1 for must_not_touch — merged before returning to client.
**Why it's a v2 narrative win:** This is the architectural decision the Build Club post originally centered on. Single-call at 0.2 is the v1 compromise. The two-call version is a story for a future build update — "the architecturally cleaner pattern we shipped in week six." Worth the time once v1 is stable.

### "How to Start" per can_help recommendation
**Source:** Original PRD v1.0
**Status:** STUB V2. Currently noted in WorkflowCard with comment.
**Description:** A safe, generic first step per "Where AI Can Help You" item. No tool names, no specific legal guidance, links to Judicial Council AI resources.
**Dependency:** Court-approved tool list confirmed. Cannot build until that exists.
**Note:** Partially supplanted by the description field added in v1, which gives users orientation before they read the substantive content. The "How to Start" row is still meaningful — it would be the actionable next step after orientation. Worth revisiting whether to build this as designed, or pivot to a different shape now that description exists.

### Six additional role classifications
**Source:** PRD v1.3 Section 3
**Roles:** Courtroom Clerk, Deputy Clerk, Research Attorney, Family Law Facilitator, Self-Help Center Staff, Court Administrator
**Status:** Visually disabled in dropdown with "Role context for this classification is pending."
**Dependency:** Job description PDFs extracted, role_context.json updated.
**Build cost:** Per role, this is roughly the same work as a v1 role context — download PDF, verify clean text layer, extract and clean content, add to role_context.json, update validate.ts active roles list. Adding all six at once is a focused 4-6 hour session.

### Shareable link / unique URL per assessment
**Source:** PRD v1.3 STUB list
**Status:** STUB V2 comment placed in ResultsPanel.
**Description:** User can generate a unique URL for an assessment, share it with a supervisor, and have the supervisor view the assessment in a read-only state.
**Dependency:** Database (DynamoDB), unique ID generation, URL scheme `/assessment/[id]`, read-only public view, user data storage policy.
**Considerations:** This is the highest-impact v2 feature for institutional adoption — a supervisor receiving a URL is more shareable than a PDF attachment. But it requires a clear data storage policy first. Whose data is being stored? For how long? Who can access it? These are non-trivial governance questions that need answers before code.

### Multi-court support
**Source:** PRD v1.3 STUB list
**Description:** Court-specific role context per California Superior Court. Currently scoped to Santa Barbara only.
**Dependency:** Job descriptions from each court, separate role_context per court, court selector in UI.
**Considerations:** Court systems vary across California — the JA III at Los Angeles Superior may have responsibilities that differ meaningfully from Santa Barbara. Multi-court support requires either a court-context layer in the prompt or fully separate role_context files keyed by court. The latter is cleaner but more maintenance.

### Saved history / profile comparison
**Source:** PRD v1.3 STUB list
**Description:** User can save past assessments and compare workflows over time.
**Dependency:** User accounts (currently NEVER), database, comparison view UI.
**Considerations:** Adding user accounts changes the entire trust model of the app. Currently, no data is stored after the response is returned, which is a significant privacy advantage. User accounts mean storing data, which means privacy policy, data retention rules, and a different conversation with court IT. Not impossible, but a much bigger change than other v2 features.

### Supervisor dashboard view
**Source:** PRD v1.3 STUB list
**Description:** Aggregate view of assessments completed within a unit so supervisors can see common workflows.
**Dependency:** User accounts, role-based access, aggregation logic that protects individual privacy.
**Considerations:** Most institutionally interesting v2 feature for an actual court rollout. But same dependency on user accounts as saved history. Build these together if you build them at all.

---

## Items Not in This Roadmap (Out of Scope Forever, Not Just v1)

For clarity, these are explicitly NOT planned for any future version. Listed so the boundary is documented.

- **User accounts and authentication** — adds complexity and trust burden disproportionate to value for the current product shape. May change if shareable links or saved history move forward, since both depend on accounts.
- **Specific California statute citations generated by the model** — hallucination risk in a court context. Governance principles only. This is a hard NEVER.
- **Unsupervised handling of real case data** — the whole product premise is that AI doesn't touch case data. Enabling that would be a different product.
- **Agents or multi-hop orchestration** — single API call per assessment. Agents introduce latency, complexity, and unpredictability that don't fit a tool court staff need to trust.

---

## How to Use This Document

After v1 submission and any post-launch breathing room, return here to plan v2. The order in this document is illustrative, not prescriptive — actual v2 priorities depend on what real users ask for first.

If you receive feedback that points to a feature not in this list, add it here with the same structure (source, description, dependencies, considerations). If you decide a v2 item is no longer worth building, document the reasoning rather than just deleting it — the historical record of "why we chose not to build this" is valuable.

This document is also a useful reference for the NACM workshop, Beyond the Docket essays, and any conversation with court administration about future enhancements. The shape of the roadmap signals discipline — deliberate scoping rather than feature sprawl.
