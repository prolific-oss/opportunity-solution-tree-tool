# Continuous Discovery Feature Guide

This document describes the user-facing functionality in the Continuous Discovery review app. Keep it updated whenever app features or behavior change.

## App Purpose

The app is a local-first review command center for an Opportunity Solution Tree. It helps a team review the current outcome, inspect opportunity branches, focus as many opportunities as needed, prioritize solutions, track assumptions and tests, assign owners, and review outcome progress.

## Top Navigation

- Shows the product name and DCX mark.
- Shows the current review week.
- Shows a compact stack of review participant initials.
- Opens team settings from `Team`.
- Opens the full tree drawer from `Full tree`.

## Outcome Progress

The outcome progress area summarizes the current outcome and key result confidence.

- The progress pill expands and collapses the weekly outcome progress drawer.
- The drawer lists key results with current value, target, progress, confidence, trend, sparkline, and latest check-in note.
- Key result titles wrap so longer descriptions remain visible.
- Each key result row has an explicit `Expand` or `Collapse` button.
- Expanded key results show:
  - Metric history chart.
  - Target summary.
  - Fortnightly check-in form.
  - Editable check-in history.
- Users can add key results.
- Adding a key result shows a confirmation message.
- Users can edit key result titles, current values, targets, check-in values, confidence, and notes.
- Users can delete key results and individual check-ins.

## Focus Rail

The left rail filters the assumption test queue across focused work.

- Shows how many focused solutions and assumptions are currently visible.
- Filters by focused opportunities with checkbox controls.
- Focused solutions appear under their opportunity branch in the same filter tree.
- Opportunity branches default collapsed and can be expanded for solution-level filters.
- Shows test and open-test counts for each filter option.
- `Tree` opens the full tree drawer, where focus can be changed.
- Filter controls only narrow the queue; they do not set or unset focus.
- Reset clears local filters and shows all focused solutions again.

## Assumption Test Queue

The main screen shows the active assumption test queue for all focused solutions, regardless of opportunity.

- Queue rows follow the full tree order for focused solutions and their
  assumptions, then sort tests within each assumption by priority.
- Solutions appear in the left column.
- Assumptions and their tests appear in the main column.
- The main queue is always expanded. Expand/collapse behavior is only used in the full tree drawer.
- Queue filters can be reset from the queue header or the left rail.
- Solution labels in the queue show only the solution name, rank, and completion state.
- Users can add tests from:
  - The queue header.
  - A specific assumption row.
  - The test detail panel.
- Users can paste multiple items into add forms; the app parses them into selectable items before adding.
- Adding opportunities, solutions, assumptions, tests, parsed bulk items, or key results shows a confirmation toast.

## Test Rows

Each test row shows:

- Status dot.
- Test description.
- Owner initials.
- Due date.
- Status pill.
- Overdue due dates are visually emphasized.

Clicking a test opens the detail panel.

## Test Detail Panel

The detail panel lets users inspect and edit one test.

- Shows the solution context.
- Shows and edits the assumption being tested.
- Shows sibling-test context for the same assumption.
- Moves the selected test to another assumption from the full tree: the detail
  panel opens the tree at the current test, highlights its current assumption,
  and shows `Move here` actions on other assumptions.
- Lets users add another test for the same assumption.
- Edits assumption type.
- Assigns owner and owner role.
- Sets due date.
- Edits test description.
- Edits success criteria.
- Changes test status between `Not started`, `In progress`, and `Done`.
- For `In progress`, shows progress commentary.
- For `Done`, shows verdict controls and evidence.
- Saves changes with a saved/error state.
- Deletes the selected test.

## Full Tree Drawer

The full tree drawer is the main place for expanding, collapsing, editing, adding, deleting, focusing, and reordering the Opportunity Solution Tree.

### Default State

- Opening the tree defaults to a collapsed top-level view.
- The default view shows the outcome and its immediate opportunities only.
- No opportunity, solution, or assumption branch auto-expands.

### Tree Hierarchy

The tree supports:

- Outcome.
- Opportunities.
- Nested opportunities.
- Solutions.
- Nested solutions.
- Assumptions.
- Tests under assumptions.

Tree rows use compact type chips with distinct icons and soft tints:

- Outcome uses the target icon and a calm blue-teal tint.
- Opportunity uses the search icon and the app's sky tint.
- Solution uses the lightbulb icon and the app's navy tint.
- Assumption uses the flask icon and the app's purple tint.

The type colors are intentionally limited to the small chip area so focus, completion, and disclosure states remain the dominant interaction cues.

### Expand and Collapse

Expand/collapse controls are intentionally scoped to the tree drawer.

- Opportunity rows show `Show` or `Hide` controls when they have child opportunities or solutions.
- Solution rows show `Show` or `Hide` controls when they have child assumptions or sub-solutions.
- Solution rows keep common actions compact: focus is an icon toggle, add is an icon menu, and complete/reopen plus delete live in the overflow menu.
- Assumption rows show `Show` or `Hide` controls for their tests.
- Expanding one branch does not collapse sibling branches.
- Expanded sibling branches remain visible at the same time.
- Row clicks do not expand or collapse branches; only the disclosure buttons do.
- The drawer does not show sibling `collapsed` summary pills.

### Focus and Visual State

- Any number of terminal opportunities can be in focus at the same time.
- Each focused opportunity's lineage is also in focus, so parent opportunities and the outcome remain visibly active.
- Any number of terminal solutions can be in focus at the same time.
- Focused solutions also focus their lineage, including parent solutions, parent opportunities, and the outcome.
- Focused rows have a clear focus pill and stronger focus styling.
- Focus actions use a pin icon so they are distinct from the outcome target icon.
- Rows on a focus path stay readable but quieter than the terminal focused row.
- Non-focused opportunity and solution alternatives are dimmed.
- Muted alternatives brighten on hover/focus so they remain usable.
- Muted `Set focus` buttons are toned down so they do not compete with the focused card.
- Solution focus can be set or unset from the solution rail or full tree drawer.

### Add Actions

The `Add` menu adapts to the selected tree node.

- Outcome can add an opportunity.
- Opportunity can add:
  - Sibling opportunity.
  - Sub-opportunity.
  - Solution.
- Solution can add:
  - Sibling solution.
  - Sub-solution.
  - Assumption.
- Assumption can add a test.
- Tests can be added from any visible tree assumption, including assumptions under non-focused solutions.
- Mutually exclusive branch rules are enforced:
  - An opportunity with sub-opportunities cannot also add solutions.
  - An opportunity with solutions cannot also add sub-opportunities.
  - A solution with assumptions cannot also add sub-solutions.
  - A solution with sub-solutions cannot also add assumptions.

### Edit Actions

- Tree node titles can be edited inline.
- Opportunity and solution descriptions can be edited inline.
- Assumption type can be edited inline.
- Solution completion can be toggled between active and completed from the solution row overflow menu.
- Opportunities can be added to the current focus set.
- Any number of solutions can be set as focused solutions.

### Delete Actions

- Opportunities, solutions, and assumptions can be deleted.
- Delete actions show a confirmation popover.
- The confirmation explains when nested items will also be deleted.

### Reordering

- Tree nodes other than the outcome can be drag-reordered.
- Reordering is limited to siblings of the same type under the same parent.
- Drop indicators show before/after placement.

## Team Settings

The team settings modal manages test owners.

- Shows all team members and roles.
- Adds a teammate with name and role.
- Removes teammates.
- Team members appear as owner options for tests.
- Existing test owners can be backfilled into team members.

## Data and Persistence

- Data is stored locally in SQLite at `data/review-command-center.sqlite` by default.
- `REVIEW_DB_PATH` can point the app at a different SQLite file.
- The app bootstraps tables and seed data automatically on first run.
- The data model stores:
  - Tree nodes in `ost_nodes`.
  - Tests in `assumption_tests`.
  - Outcome metrics in `outcome_metrics`.
  - Team members in `team_members`.

## API Surface

The app uses local Next API routes for review changes:

- `GET /api/review`: read current review state.
- `POST /api/review/opportunities`: create opportunity nodes.
- `POST /api/review/solutions`: create solution nodes.
- `POST /api/review/assumptions`: create assumption nodes.
- `POST /api/review/tests`: create tests.
- `PATCH /api/review/tests/[id]`: update tests.
- `DELETE /api/review/tests/[id]`: delete tests.
- `PATCH /api/review/nodes/[id]`: update tree nodes, rebuild focus lineage, and update solution status.
- `DELETE /api/review/nodes/[id]`: delete tree nodes.
- `PATCH /api/review/nodes/reorder`: reorder sibling tree nodes.
- `POST /api/review/team-members`: add team members.
- `DELETE /api/review/team-members`: delete team members.

## Validation Commands

Use these after code changes:

```bash
npm run lint
npm run build
```
