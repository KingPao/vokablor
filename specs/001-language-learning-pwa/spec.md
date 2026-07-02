# Feature Specification: Language Learning PWA

**Feature Branch**: `001-language-learning-pwa`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "Build a PWA that helps me learning languages. The main focus is on learning vocabulary that can be customized by the user or searched by the app in the web, finding and showing texts from News sites, tv shows, games, etc where these words are used. This is dependent on the user language level. And the last part is that the user has a normal vocabulary training mode and a mode where he gets asked by an AI to speak the words to it and it will correct the user. Also then the App creates conversations where the user talks with the AI in the language he wants to learn. All of that should be gamified, and the app should track the language level of the user to check what vocabulary and what news sources are the next to learn from."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build and Practice a Personal Vocabulary List (Priority: P1)

A learner adds words they want to learn (manually, or by asking the app to find suggestions
for a topic/level), and reviews them in a standard training mode until each word reaches a
tracked mastery level.

**Why this priority**: This is the foundational loop every other mode depends on — without a
vocabulary list and a way to review it, there is nothing for the reading, speaking, or
conversation modes to act on. It is also the smallest slice that already delivers value on
its own.

**Independent Test**: Can be fully tested by creating an account, adding/searching for 10
words in a target language, running a training session, and confirming mastery state updates
after each answer — with no dependency on reading sources, speech, or conversation features.

**Acceptance Scenarios**:

1. **Given** a learner with an empty vocabulary list, **When** they manually add a word with
   its translation, **Then** the word appears in their list marked as user-added and unmastered.
2. **Given** a learner who asks the app to suggest vocabulary for a topic and level, **When**
   the app returns suggestions, **Then** each suggestion is marked as app-discovered and can be
   added to the list with one action.
3. **Given** a learner with words in their list, **When** they start a training session,
   **Then** they are quizzed on due words and each answer updates that word's mastery state.
4. **Given** a word the learner has already added, **When** the app discovers the same word
   again during a search, **Then** the existing entry is reused instead of creating a duplicate.

---

### User Story 2 - Level-Adaptive Real-World Reading (Priority: P2)

A learner sees short excerpts from news articles, TV/show scripts, or games that use their
target vocabulary in context, filtered to match their current assessed level in that language.

**Why this priority**: This is the feature that most differentiates the product from a plain
flashcard app, but it depends on User Story 1 already existing (there must be vocabulary and a
level to match sources against).

**Independent Test**: Can be tested by giving a learner an existing vocabulary list and level,
triggering a source search, and confirming every returned excerpt (a) contains at least one of
the learner's target words and (b) is tagged at or below the learner's current level.

**Acceptance Scenarios**:

1. **Given** a learner with a target word and an assessed level, **When** the app searches for
   real-world usage, **Then** it returns excerpts (with source type, attribution, and link) that
   contain the word and are appropriate for that level.
2. **Given** no excerpt can be found at the learner's exact level, **When** the search
   completes, **Then** the app tells the learner no match was found rather than showing an
   unrelated or mismatched result.
3. **Given** an excerpt sourced from a copyrighted work, **When** it is displayed, **Then** only
   a short snippet and a link to the original are shown, not the full article/script.

---

### User Story 3 - AI-Corrected Speaking Practice (Priority: P3)

A learner speaks a target word or phrase aloud, and an AI evaluates the attempt and returns a
correction grounded in what was actually said.

**Why this priority**: Builds directly on the vocabulary list from User Story 1 and introduces
the AI-correction capability that User Story 4 (conversations) also depends on, so it is
sequenced before conversation practice.

**Independent Test**: Can be tested by picking a due word, recording a spoken attempt (correct,
incorrect, and inaudible cases), and confirming the app returns a grounded correction each time,
or an explicit "couldn't evaluate" response when confidence is too low to correct reliably.

**Acceptance Scenarios**:

1. **Given** a learner is shown a target word, **When** they speak it correctly, **Then** the
   app confirms correctness and updates the word's mastery state.
2. **Given** a learner mispronounces or misuses a word, **When** they finish speaking, **Then**
   the app returns a correction that references the specific error, not a generic response.
3. **Given** the spoken input is inaudible or unrecognizable, **When** evaluation is attempted,
   **Then** the app tells the learner it could not evaluate the attempt rather than guessing.
4. **Given** a learner has not configured a personal AI provider, **When** they start a speaking
   session, **Then** the app uses a default shared AI provider without blocking the session.

---

### User Story 4 - AI Conversation Practice (Priority: P4)

A learner has an open-ended, back-and-forth conversation with an AI partner in the language
they're learning, built around vocabulary they already know or are currently learning.

**Why this priority**: This is the most advanced practice mode and composes the vocabulary
list, level, and AI-correction capability from the earlier stories, so it is delivered last.

**Independent Test**: Can be tested by starting a conversation session for a learner with a
known vocabulary set and level, exchanging several turns, and confirming the AI's turns stay in
the target language, reference the learner's known words, and flag any new vocabulary
introduced.

**Acceptance Scenarios**:

1. **Given** a learner starts a conversation, **When** the AI responds, **Then** the response
   is in the target language and uses vocabulary at or near the learner's current level.
2. **Given** the AI introduces a word not yet in the learner's vocabulary list, **When** it
   appears, **Then** the app visibly flags it as new material rather than assuming prior
   knowledge.
3. **Given** a learner makes a language error during the conversation, **When** the AI replies,
   **Then** the reply includes a correction grounded in what the learner actually wrote/said.
4. **Given** a learner ends a conversation, **When** the session closes, **Then** any new words
   encountered can be added to the learner's vocabulary list with one action.

---

### User Story 5 - Gamified Progress and Adaptive Leveling (Priority: P5)

A learner's actions across every mode (training, reading, speaking, conversation) feed a single
visible progress system (points/streaks/level), and their assessed language level updates
automatically from performance so the app knows what vocabulary and sources to surface next.

**Why this priority**: This is a cross-cutting enhancement layer on top of Stories 1-4 — those
stories already work with a static, manually-set level; this story makes leveling automatic and
adds the motivational layer. It is ordered last because it enhances rather than blocks the core
loops.

**Independent Test**: Can be tested by performing a mix of actions across all modes and
confirming a single progress indicator updates consistently, and by simulating a run of
consistently correct answers and confirming the learner's level increases without a manual
override.

**Acceptance Scenarios**:

1. **Given** a learner completes an action in any mode, **When** it finishes, **Then** their
   overall progress indicator (points/streak/level) updates and is visible from any screen.
2. **Given** a learner has consistently succeeded at their current level across multiple modes,
   **When** the app reassesses, **Then** their level increases and subsequent vocabulary/source
   suggestions reflect the new level.
3. **Given** a learner has recently struggled at their current level, **When** the app
   reassesses, **Then** the level does not increase and easier reinforcement is prioritized.

---

### Edge Cases

- What happens when the learner has no internet connection? Training on already-loaded
  vocabulary must remain usable; reading-source search, speaking correction, and conversation
  practice require connectivity and must fail with a clear message rather than hanging.
- What happens when a real-world search returns no result matching the learner's level for a
  given word? The app must say so explicitly rather than substituting a mismatched result.
- What happens when a learner is learning more than one language at a time? Vocabulary,
  level, and progress must be tracked independently per language.
- What happens when the AI conversation partner or speaking-correction provider is unreachable
  or returns a low-confidence result? The app must say it could not evaluate/respond rather than
  presenting a guess as a confident correction.
- What happens when a learner deletes a vocabulary word that already has training history,
  source excerpts, or speaking attempts linked to it? Those linked records must be retained or
  cleanly removed without corrupting the learner's remaining progress data.
- What happens when the same source excerpt matches multiple vocabulary words for different
  learners? The excerpt must be reusable/shareable rather than re-fetched per learner.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Learners MUST be able to manually add a vocabulary item (term, translation, target
  language) to their personal list.
- **FR-002**: Learners MUST be able to ask the app to search the web for vocabulary suggestions
  for a given topic and/or their current level, and add any suggestion to their list.
- **FR-003**: The system MUST record, for every vocabulary item, whether it was user-added or
  app-discovered.
- **FR-004**: Learners MUST be able to edit or remove vocabulary items from their list.
- **FR-005**: The system MUST prevent duplicate vocabulary entries for the same term/language
  pair per learner, reusing the existing entry instead.
- **FR-006**: The system MUST provide a standard training/review mode that quizzes learners on
  due vocabulary and updates a per-word mastery state based on each answer.
- **FR-007**: The system MUST maintain an explicit, per-learner, per-language proficiency level.
- **FR-008**: The system MUST search for and surface short excerpts from news articles, TV/show
  scripts, or games that contain a learner's target vocabulary, filtered to the learner's current
  level in that language.
- **FR-009**: The system MUST store and display only short excerpts with source attribution and
  a link back to the original — never the full article, script, or text body.
- **FR-010**: The system MUST tell the learner explicitly when no level-appropriate source match
  can be found for a word, rather than showing an unrelated result.
- **FR-011**: The system MUST provide a speaking-practice mode that captures a learner's spoken
  attempt at a target word/phrase and returns an AI-generated correction grounded in that
  attempt.
- **FR-012**: The system MUST respond with an explicit "could not evaluate" outcome when speech
  input is unusable (inaudible, wrong language, low confidence) instead of presenting a guess as
  a confident correction.
- **FR-013**: The system MUST provide an AI-driven conversation mode in the learner's target
  language, scoped to their known/target vocabulary and current level.
- **FR-014**: The system MUST visibly flag any vocabulary introduced by the AI during a
  conversation that is not already in the learner's vocabulary list.
- **FR-015**: Learners MUST be able to add newly encountered conversation vocabulary to their
  list directly from the conversation session.
- **FR-016**: Learners MUST be able to configure which AI provider is used for their
  speaking-correction and conversation sessions; the system MUST supply a default shared provider
  for learners who have not configured one.
- **FR-017**: The system MUST combine actions from every mode (training, reading, speaking,
  conversation) into a single, learner-visible progress representation (e.g., points, streaks,
  level).
- **FR-018**: The system MUST periodically reassess a learner's proficiency level from observed
  performance across modes, rather than relying solely on a one-time, self-reported level.
- **FR-019**: The system MUST use the learner's current level to determine which vocabulary and
  which reading sources are surfaced next.
- **FR-020**: Learners MUST be able to review previously loaded vocabulary and their existing
  progress while offline; the system MUST clearly indicate when a feature is unavailable due to
  lack of connectivity.
- **FR-021**: The system MUST track vocabulary, level, and progress independently per language
  for learners studying more than one language.

### Key Entities

- **Learner Profile**: A learner's account and settings, including which languages they are
  studying and their configured AI provider preference (if any).
- **Vocabulary Item**: A tracked word/phrase — term, translation, target language, origin
  (user-added vs. app-discovered), and per-learner mastery state.
- **Proficiency Level**: A learner's current assessed level in a given language, plus enough
  history to show how/when it last changed.
- **Source Excerpt**: A short piece of level-tagged text pulled from a news article, TV/show, or
  game, linked to the vocabulary word(s) it demonstrates, with attribution and a source link.
- **Practice Session**: A record of a training, speaking, or conversation session, including
  which mode it was, which vocabulary it touched, and the outcome.
- **Speaking Attempt**: A single spoken attempt at a word/phrase, its evaluation result, and a
  confidence indicator.
- **Conversation Session**: A sequence of turns between learner and AI in the target language,
  including any vocabulary flagged as new during the session.
- **Progress State**: A learner's cumulative gamification state (points, streaks, level) derived
  from activity across all modes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new learner can add or discover at least 10 vocabulary words and complete a
  first training round within 5 minutes of creating an account.
- **SC-002**: For at least 90% of a learner's active vocabulary words, the app can surface at
  least one level-appropriate real-world usage example on request.
- **SC-003**: A learner can complete a full speaking-practice round (attempt plus correction) in
  under 30 seconds per word under normal conditions.
- **SC-004**: A learner can view their overall progress (points/streak/level) from any mode
  within a single action, with no more than one screen transition.
- **SC-005**: A learner's assessed proficiency level changes automatically in response to
  sustained performance, without requiring a manual level reselection after onboarding.
- **SC-006**: Learners studying multiple languages can switch between them and see each
  language's vocabulary, level, and progress tracked without any cross-language mixing.

## Assumptions

- Learners create individual accounts; vocabulary, level, and progress are scoped per account
  and per language, not shared across learners.
- Proficiency is tracked on a standard, industry-recognized level scale (e.g., CEFR A1-C2 or
  equivalent) unless a learner's target language customarily uses a different standard scale.
- A learner may study more than one language at a time; a "current" language selection
  determines which vocabulary/content is shown by default.
- "AI provider" refers to whichever text/speech AI service evaluates speaking attempts and
  drives conversations; the app supplies a working default so the feature functions before a
  learner configures their own.
- Source excerpts are short enough (a sentence or a few sentences) to fall within fair-use-style
  quotation norms; full-length copyrighted works are never stored or redistributed.
- "Real-world sources" (news, TV/show, games) are treated as illustrative categories; exact
  source availability will vary by language and is expected to grow over time rather than be
  fixed at launch.
