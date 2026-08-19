# Enginn App Roadmap

## Phase 1 - Project foundation
Status: complete

- Define project purpose and version 1.0 scope.
- Define current task and development rules.
- Define mobile UI rules.
- Keep agent instructions short and reliable.

## Phase 2 - Product audit

Review each area of the app:
- Workout library
- Workout editor
- Workout runner
- Calendar and planning
- Training programs
- History and results
- Import, export, and data recovery
- Settings and account area

For every area record:
- What works
- What is broken or unclear
- Missing behavior
- Priority and acceptance criteria

## Phase 3 - Core workflow stability

Make the full flow reliable:
create workout -> schedule -> run -> save result -> review history.

Protect existing local data and handle invalid or older saved data safely.

## Phase 4 - Training insight

Improve useful statistics, progress comparison, workout metadata, splits, RPE, weights, and notes.

## Phase 5 - Version 1.0

Status: released as 1.0.0

Release when the app is stable on mobile, core flows are tested, data can be exported and restored, and no critical issue remains.

### Phase 5A - Release gate

Status: complete

- Run lint, every automated test, and the production build through one shared command.
- Keep GitHub CI aligned with the local release check.
- Define the manual mobile checklist and release blockers.

### Phase 5B - Mobile regression and blocker fixes

Status: final regression

- Complete the release checklist on a real phone and a clean test data set.
- Record reproducible failures with severity and fix every release blocker.
- Repeat affected scenarios after each fix without changing the planned version 1.0 scope.

### Phase 5C - Version 1.0 release

Status: released to `main`

- Complete final production smoke checks and data backup verification.
- Confirm that the automated gate passes and no release blocker remains.
- Mark and publish version 1.0, then monitor the production deployment.

## Phase 6 - Enginn rebrand

### Phase 6A - Name clearance

Status: confirmed by product owner

- Confirm name, domains, handles and relevant trademark classes before implementation.

### Phase 6B - Brand identity

Status: approved and connected to the application

- Define Enginn positioning, logo, app icon, palette and product language.
- Separate visible brand references from legacy technical identifiers.
- Prepare deterministic vector and PWA assets for technical implementation.

### Phase 6C - Technical rebrand

- Replace public metadata, navigation, onboarding and support copy. — complete
- Rename public workout content without breaking stored history or backup compatibility. — complete
- Configure the new deployment name and domain with redirects from the old address.

## Phase 7 - General hybrid training

- Extend program goals with discipline mix and a complete-beginner level.
- Expand exercise taxonomy beyond the current race-specific stations.
- Add technique, common mistakes, scaling and contextual “Jak na to” guidance.
- Personalize onboarding from the athlete's selected disciplines.

## Later

Consider social features, subscriptions and a broader reusable platform only after the Enginn rebrand and hybrid-training expansion are stable.
