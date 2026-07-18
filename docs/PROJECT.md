# HYROX Training App

## Purpose
A mobile-first personal training app for planning, completing, and reviewing HYROX workouts.

## Core user flow
1. Create or select a workout template.
2. Schedule it in a weekly plan or calendar.
3. Run the workout with the workout runner.
4. Save duration, RPE, weights, notes, and splits.
5. Review completed sessions in history.

## Technology
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

## Core data
The main data model is `HyroxData` in `lib/types.ts`. It contains workout templates, scheduled workouts, results, weekly plans, and training programs.

## Version 1.0 goal
Deliver a stable personal HYROX training app that works well on a phone and preserves training data reliably.

## Current non-goals
- General application-building platform
- Multi-user accounts
- Social features
- Paid subscriptions
- Large backend redesign

Finish the HYROX app first. Reusable foundations may be extracted later.