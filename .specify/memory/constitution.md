<!--
Sync Impact Report
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: n/a (first concrete version; all 5 slots filled from template placeholders)
Added sections:
  - Core Principles I–V (Vocabulary-First Learning, Level-Adaptive Content Sourcing,
    AI-Mediated Speaking & Correction, Gamified Progression, PWA Simplicity & Resilience)
  - Content Sourcing & Compliance
  - Development Workflow & Quality Gates
  - Governance
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (Constitution Check gate is populated dynamically
    from this file; no hardcoded principle names to change)
  - .specify/templates/spec-template.md ✅ (generic, no principle-specific references)
  - .specify/templates/tasks-template.md ✅ (generic, no principle-specific references)
  - .specify/templates/checklist-template.md ✅ (generic, no principle-specific references)
  - No command files under .specify/templates/commands/ exist in this repo; nothing to update
  - No README or docs/quickstart.md exist yet; nothing to update
Follow-up TODOs: none — all placeholders resolved from user-supplied product description
-->

# Vokablor Constitution

## Core Principles

### I. Vocabulary-First Learning

Every learning activity in the app MUST resolve to one or more tracked vocabulary items.
Vocabulary items MUST support two acquisition paths: manual entry/curation by the user,
and automated discovery by the app searching the web on the user's behalf. Each vocabulary
item MUST carry, at minimum: target-language term, translation/definition, source language
level, origin (user-added vs. app-discovered), and a per-user mastery state. No feature may
introduce a learning flow that bypasses this vocabulary model (e.g., ad-hoc text review not
tied to tracked words).

Rationale: vocabulary is the atomic unit the rest of the product depends on — reading
sources, speaking practice, conversations, and gamification all key off it. Letting any
feature sidestep the model fragments progress tracking and breaks the single source of
truth for what the user has and hasn't learned.

### II. Level-Adaptive Content Sourcing

The system MUST maintain an explicit, per-user, per-language proficiency level, and MUST
recompute it from observed performance (drills, speaking corrections, conversations) rather
than relying solely on self-reported input. All external content surfaced to a user — news
articles, TV/show excerpts, game text — MUST be filtered or ranked against that level before
display. The app MUST be able to explain, for any surfaced text or word, why it was chosen
(matching level, target vocabulary present, or explicit user search). Selection logic that
cannot be traced back to level + vocabulary state MUST NOT ship.

Rationale: the product's core promise is "content that matches where I am." An
unexplainable or level-blind recommendation defeats that promise and erodes trust in the
level model.

### III. AI-Mediated Speaking & Correction (NON-NEGOTIABLE)

The speaking-practice mode MUST capture the user's spoken attempt, compare it against the
target vocabulary/phrase, and return a correction grounded in that comparison — never a
generic or fabricated response. When the system's confidence in a correction is low, it
MUST say so explicitly rather than presenting a guess as ground truth. AI-driven
conversation practice MUST stay scoped to the vocabulary and level currently assigned to
the user for that language; conversations MUST NOT silently drift to content the user
hasn't been introduced to without flagging it as new material.

Rationale: incorrect corrections presented with false confidence actively teach the wrong
thing — this is the one failure mode that damages the user more than not having the feature
at all, so visible uncertainty is mandatory, not optional polish.

### IV. Gamified Progression

Every learning action — vocabulary drill, reading a sourced text, a speaking-correction
round, or an AI conversation — MUST feed a single, unified progression system (e.g. points,
streaks, levels) rather than a mode-local scoreboard. Progression state MUST be visible to
the user from any mode and MUST be consistent: the same action produces comparable
progression signals regardless of which feature triggered it.

Rationale: gamification is called out as cross-cutting in the product vision; if each mode
tracks its own score, motivation fragments and the user loses a coherent sense of overall
progress.

### V. PWA Simplicity & Resilience

The app MUST be delivered and installable as a Progressive Web App, and core vocabulary
review MUST remain usable offline (cached vocabulary + spaced-repetition drills at minimum).
Content-discovery, speaking-correction, and conversation features MAY require connectivity,
but MUST fail with a clear, actionable message when offline rather than hanging or silently
no-op'ing. New features MUST default to the simplest implementation that satisfies
Principles I–IV; any added architectural complexity (extra services, new storage layers,
additional external dependencies) MUST be justified in the plan's Complexity Tracking
section.

Rationale: the feature set (web search, content aggregation, speech AI, conversational AI,
gamification) is already broad for a single product; unchecked incidental complexity is the
most likely way this project stalls.

## Content Sourcing & Compliance

External text sourced from news sites, TV/show scripts, or games MUST be treated as
third-party copyrighted material by default: the app MUST store and display only short
excerpts sufficient to show the target vocabulary in context, MUST attribute the original
source with a link, and MUST NOT persist or redistribute full articles/scripts. Any source
integration MUST support removal of cached excerpts on request (e.g., a takedown or a
source revoking access).

## Development Workflow & Quality Gates

Every plan MUST pass the Constitution Check gate against Principles I–V before Phase 0
research and again after Phase 1 design. Changes that affect level computation, vocabulary
mastery state, or AI correction/conversation logic MUST include an automated test or a
documented manual verification step before merge — these are the paths most likely to
silently mislead a learner if they regress.

## Governance

This constitution supersedes ad-hoc practice for this project. Amendments require: (1) a
documented rationale for the change, (2) a version bump per the policy below, and (3) a
pass over `.specify/templates/plan-template.md`, `spec-template.md`, `tasks-template.md`,
and `checklist-template.md` to confirm no generated artifact contradicts the new text.

Versioning policy (semantic):
- MAJOR: backward-incompatible principle removal or redefinition.
- MINOR: a new principle or materially expanded section is added.
- PATCH: wording, clarification, or typo fixes with no rule change.

All feature plans and PRs MUST verify compliance with the Core Principles above; unresolved
violations MUST be recorded in the plan's Complexity Tracking table with a justification.

**Version**: 1.0.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-01
