# Repository Instructions

## Documentation Rule

When adding, changing, or removing user-facing functionality, always update the feature documentation in `docs/features.md` in the same change.

For local setup, data, or operational workflow changes, also update the relevant documentation in `docs/`.

Keep documentation concise, current, and written for someone trying to understand or use the app without reading the source first.

## Deployment Rule

This repo is managed as a local-first app published through GitHub. Do not run or report deployment steps for routine changes unless the user explicitly asks for deployment work.

## Frontend Verification Rule

For frontend changes, include screenshots in the final response that show the
relevant states needed to prove the feature or fix works well. Capture the
before/neutral state when useful, the changed interaction state, and any edge
state related to the bug or behavior being changed.

When a change affects layout, popovers, icon buttons, hover/focus states, or
visual hierarchy, verify it in a browser before finishing:

- Run the app on a non-3000 port unless the user explicitly says otherwise.
- Prefer a disposable `REVIEW_DB_PATH` or seeded fixture when creating visual
  proof states, so screenshots do not mutate the user's normal local data.
- Use stable DOM or accessibility selectors where possible. If role locators are
  ambiguous or flaky, use the browser visible-DOM node ids for deterministic
  clicks.
- Capture screenshots for the normal state and each relevant interaction state
  such as open menus, focused rows, muted alternatives, disabled options, and
  hover/focus tooltips.
- Pair screenshots with targeted computed-style or DOM assertions for fragile UI
  details: element dimensions, text content, opacity, z-index, top element at an
  overlap point, and whether hidden labels are contributing to layout.
- Include the screenshot paths or rendered screenshots in the final response.
