# Engineering Rules

## Scope
Finish the HYROX application before expanding it into a broader training platform.

## Before editing
- Read `AGENTS.md`, `docs/PROJECT.md`, and `docs/CURRENT_TASK.md`.
- Use the Next.js 16 documentation in `node_modules/next/dist/docs/` when framework behavior is uncertain.

## Change discipline
- Make small, focused changes with a clear purpose.
- Avoid unrelated refactors inside feature or bug-fix work.
- Prefer extracting small components over replacing large files at once.
- Do not add dependencies unless they provide a clear benefit that existing code cannot reasonably deliver.

## Data safety
- Preserve existing workout templates, plans, schedules, programs, and results.
- Do not change persisted data shapes without a migration or backward-compatible fallback.
- Treat import, export, recovery, and invalid stored data as product-critical behavior.

## Verification
- Re-read every file after writing it through an external tool.
- Run lint and build checks for code changes whenever available.
- Test the complete affected user flow, not only the edited component.
- Never claim a change succeeded until it has been verified.

## Product priorities
1. Reliable core workflow.
2. Mobile usability during training.
3. Data preservation and recovery.
4. Clear maintainable code.
5. New features only after the above remain stable.
