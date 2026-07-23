# Belief Validation and Method Workbench Plan

## Goal

Turn Opus's cognitive-map output into user-owned hypotheses instead of silently
treating every model suggestion as a thought or belief the user actually holds.
Once the user endorses a thought or intermediate belief, let them work on it
either in a focused Opus conversation or in a short, structured exercise with no
conversation required.

## Product rules

1. Model output remains a suggestion until the user reviews it.
2. Review choices are explicit and reversible:
   - `unreviewed` — Opus suggested it; the user has not decided.
   - `endorsed` — "This is mine" / "This rings true."
   - `rejected` — "Not a thought/belief I have."
   - `irrelevant` — It may be recognizable but is not useful to work on.
3. Rejected and irrelevant items stay in storage for audit/undo, but are excluded
   from later synthesis, coaching memory, and recommendations.
4. Automatic model analysis never overwrites a user's review choice.
5. The existing lifecycle status on intermediate beliefs (`active`/`dismissed`)
   remains separate from the user's review choice. This avoids conflating model
   maintenance with what the user says is personally true.
6. A suggested item can be reviewed without starting coaching, and an endorsed
   item can be worked without opening a conversation.

## Current gaps

- Automatic thoughts have only **Work this thought**; they cannot be affirmed,
  rejected, or marked irrelevant.
- Intermediate beliefs have only a small dismiss control; they cannot be
  affirmed or used as the focus of a coaching conversation.
- Conversations persist a legacy REBT belief or an automatic thought, but not an
  intermediate belief.
- The CBT coach tends to start with evidence for/against even though the app
  already has an exercise runner and Burns/TEAM-CBT offers a much wider method
  set.
- The exercise library is not launched from a selected thought or intermediate
  belief, so the user must re-enter the target manually.

## Implementation

### 1. Persist user review

- Add `review_status` and `reviewed_at` to `automatic_thoughts`.
- Add the same fields to `intermediate_beliefs_cog`.
- Default existing and new rows to `unreviewed`.
- Add validated PATCH endpoints:
  - `/cognitive/automatic-thoughts/{id}`
  - `/cognitive/intermediate-beliefs/{id}`
- Keep the existing intermediate-belief DELETE route as a backward-compatible
  lifecycle dismissal.
- Exclude `rejected` and `irrelevant` automatic thoughts from intermediate-belief
  synthesis.
- Exclude `rejected` and `irrelevant` intermediate beliefs from core-schema
  synthesis, decay reinforcement, coaching memory, and work recommendations.
- Do not auto-prune an `endorsed` intermediate belief.

### 2. Review controls in Belief Insights

- Replace the ambiguous single dismiss affordance with labeled controls:
  **This is mine / Rings true**, **Not mine / Doesn't fit**, and **Irrelevant**.
- Show the saved review state on each card.
- Keep network failures visible and leave the previous state intact.
- Enable work actions only for endorsed items, while allowing the user to change
  a prior review decision.

### 3. Make intermediate beliefs a first-class focus

- Add `selected_intermediate_belief_id` to conversations.
- Extend the conversation API and focus-memory builder so the exact intermediate
  belief, category, confidence, and user endorsement survive navigation and
  later turns.
- Add an intermediate-belief workbench route with three conversational choices:
  - **TEAM-CBT / Burns** — Testing, Empathy, Agenda Setting, then a deliberately
    chosen method instead of reflexively using a thought record.
  - **Beckian CBT** — collaborative Socratic guided discovery.
  - **REBT** — ABC(DE), empirical/logical/pragmatic disputation, and flexible
    preference-based alternatives.
- Keep all three framed as bounded self-help, with the app's existing safety
  boundaries.

### 4. Add short, no-conversation methods

Add focused 4–8 minute exercises that can be launched directly from an endorsed
thought or intermediate belief:

- **Examine the Evidence** — facts for, facts against, and a testable conclusion.
- **Identify and Explain the Distortions** — select the distortions and explain
  how each one operates in this exact thought.
- **Be Specific** — replace a sweeping claim with concrete people, events,
  behavior, time, and context.
- **Thinking in Shades of Gray** — move a binary/global judgment onto a
  percentage continuum and write a more precise statement.
- **Define Terms** — operationally define a label such as "failure" and test
  whether the definition is coherent and consistently applied.
- **Double-Standard Technique** — answer the thought as the user would answer a
  respected friend in the same situation.
- **Cost-Benefit Analysis** — especially for intermediate beliefs, name both the
  short-term payoff and longer-term cost before deciding what to modify.

The existing 7-column record, Triple Column, Downward Arrow, Behavioral
Experiment, and REBT ABCDE exercises remain available; the new workbench presents
methods by fit rather than pretending one worksheet is the default.

### 5. Carry the selected focus into exercises

- Pass a focus kind, focus id, and focus text from the workbench to the exercise
  runner.
- Prefill the exercise's target-thought or target-belief step.
- Save that prefill in `exercise_sessions.step_data` at session creation so the
  completed exercise remains tied to the selected item without a second
  conversation.
- Keep **Discuss with coach** optional after completion; **Done** remains a
  complete endpoint.

### 6. Broaden Opus method selection

- Add a distinct TEAM-CBT/Burns coaching prompt.
- Expand the Beckian prompt and recommendation catalog with the new short
  methods.
- In TEAM-CBT and Beckian modes, instruct Opus to:
  1. confirm the target and desired change,
  2. account for the belief's advantages or resistance to change,
  3. choose a fitting method from the catalog,
  4. avoid defaulting to evidence for/against when another method better matches
     labeling, all-or-nothing thinking, overgeneralization, self-criticism, or a
     rule/assumption.

## Contract and compatibility work

- Update the OpenAPI source, regenerate API Zod/client code, and keep generated
  files in the same commit as the contract change.
- Use additive database fields with defaults so existing rows continue to load.
- Update the bundled exercise catalog and the database seed catalog together so
  online and offline behavior match.
- The repository currently uses `drizzle-kit push` rather than checked-in SQL
  migrations; deployment must run the schema push and exercise seed before the
  new API is exercised.

## Verification

- API tests cover all review transitions, invalid review values, not-found
  records, and exclusion of rejected/irrelevant rows from synthesis.
- Conversation tests prove an intermediate belief is the persisted focus and is
  described as an endorsed hypothesis rather than a fact.
- Catalog tests verify unique exercise IDs, required metadata, focus-prefill
  mapping, and parity between the bundled and seeded catalogs.
- Run:
  - `pnpm --filter @workspace/api-spec run codegen`
  - `pnpm run typecheck`
  - `pnpm --filter @workspace/api-server run test`
  - `pnpm run build`
- Exercise the mobile/web flow with one endorsed and one rejected automatic
  thought plus one endorsed intermediate belief. Confirm the rejected thought is
  not reused, the belief can launch each coaching approach, and a quick exercise
  completes and saves without a conversation.

## Delivery sequence

- [x] Record this plan in the repository before implementation.
- [ ] Add review-state persistence and API contracts.
- [ ] Add review controls and workbench navigation.
- [ ] Add intermediate-belief conversation focus and three coaching approaches.
- [ ] Add short Burns/CBT methods and focus-prefilled exercise sessions.
- [ ] Regenerate clients, test, build, and exercise the flows.
- [ ] Push the implementation branch and update the draft pull request.

