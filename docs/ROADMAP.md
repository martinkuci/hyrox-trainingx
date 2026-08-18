# HYROX Training App Roadmap

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

Status: release candidate 1.0.0

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

Status: release candidate; awaiting final approval, merge, and tag

- Complete final production smoke checks and data backup verification.
- Confirm that the automated gate passes and no release blocker remains.
- Mark and publish version 1.0, then monitor the production deployment.

## Later

Only after version 1.0 consider accounts, cloud sync, social features, subscriptions, or extracting a broader reusable platform.
