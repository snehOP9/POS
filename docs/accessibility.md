# Accessibility acceptance checklist

EmberServe POS must remain usable during a busy service by keyboard users,
screen-reader users, low-vision users, touch users, and people who reduce
motion. Accessibility is part of the operational definition of done, not a
post-release theme pass.

## Baseline implementation

- Use semantic landmarks, headings in order, native buttons/inputs where
  possible, and associated visible labels.
- Provide a clearly visible focus indicator that is not removed for mouse
  users. Preserve logical tab order across responsive layouts.
- Give every icon-only action an accessible name; give destructive and
  financial actions a visible label or unambiguous confirmation.
- Make errors specific, adjacent to the affected field, programmatically
  associated with it, and not dependent on color alone.
- Use text and icons in addition to color for availability, vegetarian status,
  spice level, allergens, urgency, and order state.
- Provide useful menu-image alt text; decorative images use empty alt text.
- Respect prefers-reduced-motion. Motion is short feedback, never required to
  understand a state or complete an action.
- Build dialogs/drawers with focus entry, focus trap, Escape dismissal where
  safe, return focus, and an accessible title.

## Role-specific checks

| Panel | Required checks |
| --- | --- |
| Customer | Cart changes and order tracking announce through a polite live region; modifier requirements and price changes are explained in text. |
| Cashier | Keyboard shortcuts do not conflict with form typing; totals, payment state, and destructive actions are always readable and confirmed. |
| Waiter | Touch actions are generous, table state is not color-only, and ready alerts are announced without stealing focus. |
| Kitchen | Order numbers, timers, quantities, notes, and status controls are high contrast and distance-readable; urgency does not rely on animation alone. |

## Verification gate

1. Navigate each route using keyboard only: menu, login, cashier, waiter, and
   kitchen.
2. Check visible focus, logical tab sequence, skip/landmark behavior, dialogs,
   and Escape handling at mobile and desktop sizes.
3. Run an automated scan such as axe, then manually test key flows with a
   screen reader.
4. Verify contrast for normal and status text against its actual surface.
5. Enable reduced motion and high contrast modes; complete order, payment, and
   kitchen-update flows.
6. Verify that live updates announce meaningful changes without repeatedly
   reading the whole screen.
7. Test the primary touch workflows on a real tablet or touchscreen. Aim for
   at least 44 by 44 CSS pixels for primary targets unless device context
   requires a larger control.

Record exceptions with an owner and remediation date; do not waive access to a
critical order, payment, authentication, or kitchen action.
