# UI Guidelines

## Product context
The app is used mainly on a phone before, during, and after training. Interfaces must stay clear under fatigue and in motion.

## Mobile first
- Design for small phone screens before desktop layouts.
- Keep primary actions reachable with one hand.
- Use touch targets large enough for reliable tapping.
- Avoid horizontal scrolling in normal use.

## Navigation
- Keep primary navigation consistent across screens.
- Make the current section obvious.
- Preserve the user's place when returning from detail or edit screens.
- Do not hide critical actions behind unclear icons or gestures.

## Actions and hierarchy
- Each screen should have one clear primary action.
- Use consistent labels for create, save, start, finish, cancel, and delete actions.
- Separate destructive actions from primary actions and require confirmation when data could be lost.
- Keep frequently used training actions visible without unnecessary menus.

## Training mode
- Prioritize elapsed time, current movement, work target, rest state, and the next step.
- Keep text and controls readable at a glance.
- Prevent accidental navigation or data loss during an active workout.
- Show clear feedback after every recorded split, result, or completed step.

## Forms and editing
- Use sensible defaults and reduce required typing.
- Keep validation messages close to the affected field.
- Preserve unsaved work when practical.
- Make units explicit for time, distance, repetitions, and weight.

## Visual consistency
- Reuse existing components and spacing patterns.
- Maintain strong contrast and legible text sizes.
- Use color as support, not as the only indicator of state.
- Keep cards, buttons, inputs, and status states visually consistent.

## States and feedback
Every important screen should handle:
- Loading
- Empty data
- Invalid or missing data
- Successful save
- Recoverable error

Messages should explain what happened and what the user can do next.

## Accessibility
- Use semantic controls and visible focus states.
- Provide accessible labels for icon-only controls.
- Do not rely only on color to communicate meaning.
- Respect device text scaling where possible.

## Decision rule
Prefer the simplest interface that lets the athlete complete the task quickly, safely, and without losing training data.
