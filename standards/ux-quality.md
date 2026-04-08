# UX Quality Standards

Standards for evaluating usability, interaction quality,
and user experience beyond accessibility compliance.
These are evaluated via screenshot review, code analysis,
and interactive testing.

## Evaluation Mindset

Every check should be filtered through one question:

> "Would this frustrate or confuse a real user?"

A technically correct UI can still be a bad experience.
Err on the side of flagging — false positives are cheap,
shipped frustration is expensive.

---

## Nielsen's 10 Heuristics

### H1. Visibility of System Status
The system should keep users informed about what is
going on through appropriate feedback within a
reasonable time.

- Every user-initiated action has visible feedback
  (button press, form submit, delete, toggle)
- Loading states exist for all async operations
  (skeletons, spinners, or progress indicators)
- Mutations show pending state while in flight
  (disabled button, spinner, optimistic update)
- Success/failure outcomes are communicated clearly
  (toast, inline message, redirect)
- Current location is always clear (active nav state,
  breadcrumb, page title)
- Progress indicators for multi-step flows show
  which step the user is on

### H2. Match Between System and Real World
The system should speak the users' language, with
words, phrases, and concepts familiar to the user,
rather than system-oriented terms.

- Labels and terminology match what users expect
  (not database column names or developer jargon)
- Domain terms are used consistently throughout
  (don't alternate between "roast" and "log" for
  the same concept)
- Information is ordered by user priority, not
  data structure (most important fields first)
- Icons match common conventions (trash = delete,
  pencil = edit, gear = settings)
- Date/time/number formats match user locale
  expectations

### H3. User Control and Freedom
Users often perform actions by mistake. They need
a clearly marked "emergency exit" to leave the
unwanted action without going through an extended
process.

- Every page has a clear back/escape path
  (back link, breadcrumb, close button, or nav)
- Destructive actions are reversible or guarded
  (confirmation dialog, undo option, or soft delete)
- Modal dialogs can be dismissed via Escape key,
  close button, and overlay click
- Form progress is not lost on accidental
  navigation (or user is warned before leaving)
- No dead-end states — the user can always get
  somewhere from anywhere

### H4. Consistency and Standards
Users should not have to wonder whether different
words, situations, or actions mean the same thing.

- Same action looks the same everywhere (primary
  buttons, link styles, icon meanings)
- Similar pages use similar layouts (all detail
  pages share structure, all list pages share
  patterns)
- Terminology is consistent across pages (don't
  call it "Upload" on one page and "Import" on
  another)
- Platform conventions are followed (links are
  underlined or obviously clickable, form fields
  look like form fields)
- Component patterns are reused, not reinvented

### H5. Error Prevention
Even better than good error messages is a careful
design which prevents a problem from occurring in
the first place.

- Destructive actions require confirmation
  ("Delete this roast?" not just instant delete)
- Form inputs constrain values where possible
  (dropdowns for known sets, date pickers for
  dates, number inputs for numbers)
- Inline validation catches errors before submit
  (required fields, format validation, length limits)
- Disabled states prevent impossible actions
  (can't submit an empty form, can't delete while
  a save is in progress)
- Duplicate submissions are prevented (disable
  button after first click, debounce)

### H6. Recognition Rather Than Recall
Minimize the user's memory load by making elements,
actions, and options visible. The user should not
have to remember information from one part of the
interface to another.

- Options are visible, not hidden behind menus
  that require memorization
- Recently used or relevant items are surfaced
  (recent beans in upload, last viewed roasts)
- Labels are present on icons (or tooltips at
  minimum) — icon-only buttons must have labels
- Filters and sort state are visible (not just a
  dropdown that resets on navigation)
- Related context is co-located (don't make users
  navigate away to find info they need here)

### H7. Flexibility and Efficiency of Use
Accelerators — unseen by the novice user — may
speed up interaction for the expert user.

- Common actions are reachable in minimal clicks
  (upload from dashboard, not buried in settings)
- Keyboard shortcuts exist for power users where
  appropriate
- Progressive disclosure — advanced options are
  available but don't clutter the default view
- Bulk actions exist for repetitive tasks
  (select multiple, batch delete)
- Filters, sort, and search are available on
  list views with significant data

### H8. Aesthetic and Minimalist Design
Interfaces should not contain information which is
irrelevant or rarely needed. Every extra unit of
information competes with the relevant units and
diminishes their relative visibility.

- Every visible element earns its space — no
  decorative clutter
- Information density is appropriate for context
  (detail page = comprehensive, card = summary)
- White space is used intentionally to group and
  separate content
- Secondary actions are visually subordinate to
  primary actions
- No redundant information (don't show the same
  data in two places on one page)

### H9. Help Users Recognize, Diagnose, and Recover from Errors
Error messages should be expressed in plain language
(no codes), precisely indicate the problem, and
constructively suggest a solution.

- Error messages are human-readable (not stack
  traces, error codes, or "Something went wrong")
- Errors identify what went wrong AND what to do
  about it ("File must be .klog or .csv" not just
  "Invalid file")
- Form errors are associated with the specific
  field that caused them (not just a banner at top)
- Network errors offer a retry option
- Errors don't destroy user input (form data
  survives a failed submission)

### H10. Help and Documentation
Even though it is better if the system can be used
without documentation, it may be necessary to
provide help and documentation.

- Empty states include guidance ("Upload your
  first roast to get started")
- Complex features have inline help or tooltips
  (DTR%, roast phases, chart controls)
- First-time user experience is self-explanatory
  (no manual needed to upload a file and view
  a roast)
- Help content is focused on the user's task,
  not system internals

---

## Gestalt Principles

### Proximity
- Related items are grouped spatially (metadata
  fields together, actions together, content
  sections together)
- Unrelated items have clear visual separation
  (whitespace, dividers, or card boundaries)
- Groups are consistent — if "origin" and
  "process" are grouped on one page, they should
  be grouped on all pages

### Similarity
- Elements that serve the same function look the
  same (all primary buttons identical, all card
  layouts identical, all nav links identical)
- Elements that serve different functions look
  different (don't style a link like a button
  unless it acts like one)
- Color, size, and shape consistently encode
  meaning across the app

### Continuity
- Visual flow follows natural reading patterns
  (left-to-right, top-to-bottom in LTR locales)
- The eye can follow a logical path through the
  page without jumping
- Related content flows in sequence (chart →
  data table → notes, not chart → notes → table)

### Figure-Ground
- Content is clearly distinct from its background
  at every breakpoint
- Cards, modals, and elevated surfaces have clear
  visual separation from the base layer
- Interactive elements stand out from static
  content

### Common Fate
- Elements that change together are perceived as
  related (toggling a chart series updates both
  the button and the chart line)
- Animations group related changes (a modal
  appears as one unit, not piece by piece)

---

## Interaction Quality

### Touch Targets
- All interactive elements are at least 44x44px
  on mobile (buttons, links, checkboxes, toggles)
- Tap targets have sufficient spacing to prevent
  accidental activation (minimum 8px gap)
- Small inline actions (star rating halves, table
  row clicks) are tested at mobile viewport

### Affordances
- Interactive elements look interactive (buttons
  look like buttons, links look like links)
- Non-interactive elements don't look clickable
  (no hover cursors on static text, no underlines
  on non-link text)
- Disabled elements look disabled AND communicate
  why (tooltip or adjacent text explaining the
  constraint)

### Microcopy
- Button labels describe the action, not the
  element ("Save Roast" not "Submit", "Upload
  .klog File" not "Choose File")
- Empty states are encouraging and actionable
  ("Upload your first roast to get started"
  not "No data")
- Confirmation dialogs explain the consequence
  ("This will permanently delete the roast and
  all its data" not "Are you sure?")
- Placeholder text in inputs shows expected
  format, not the field name (e.g. "ethiopia
  yirgacheffe" not "Enter bean name")

### Form UX
- Labels are above inputs, not beside them
  (better for mobile, scanning, and a11y)
- Required fields are indicated before the user
  tries to submit
- Validation fires at the right time (on blur
  for format, on submit for required, real-time
  for character counts)
- Error recovery preserves all entered data
- Tab order matches visual order
- Submit button is disabled or provides feedback
  while saving

### Loading & Perceived Performance
- Skeleton screens match the shape of the content
  they replace (not generic rectangles)
- Actions that take >100ms show immediate visual
  feedback (button state change, spinner)
- Actions that take >1s show a progress indicator
- Content appears progressively (above-the-fold
  first, below-the-fold streams in)
- Optimistic updates for low-risk mutations
  (toggling a favorite, updating a rating)

---

## Cognitive Load & Comprehension

### Information Density
- Cards show 3-5 key fields max — not a data dump
- Tables show the most important columns by default
  with optional expansion for more
- Detail pages organize content into scannable
  sections with clear headings
- Numbers and metrics have context (units, labels,
  comparison benchmarks)

### Visual Scanning
- Headings create a scannable outline of the page
- The most important content is above the fold
  at desktop and mobile
- F-pattern or Z-pattern reading flow is supported
  by layout
- Users can find what they need without reading
  everything

### Discoverability
- Features are findable without prior knowledge
  of the app
- Chart controls, filters, and toggles are visible
  (not hidden behind a gear icon with no label)
- New users can complete core tasks (upload, view,
  compare) without onboarding
- The path from "I want to do X" to doing X is
  2-3 clicks max for core tasks

### First-Time User Experience
- The app makes sense on first visit without
  context (clear value prop, obvious next steps)
- Empty states guide rather than frustrate
  ("Upload your first roast" with a clear button,
  not a blank page)
- Core vocabulary is self-evident or explained
  inline (DTR%, RoR, First Crack — not assumed
  knowledge for new users of the app)
- The logged-out experience gives enough to
  understand the value before signing up

---

## Frustration Signals

These are patterns that reliably frustrate users.
Flag any instance found:

- **Dead clicks** — tapping something that looks
  interactive but isn't
- **Mystery meat navigation** — icons without
  labels, actions without clear purpose
- **Data loss** — losing form input, losing scroll
  position, losing filter state
- **Forced detours** — requiring extra steps for
  common tasks (sign in to view public content,
  navigate away to find related info)
- **Ambiguous actions** — "Submit" (submit what?),
  "OK" (OK to what?), "Cancel" (cancel what action?)
- **Silent failures** — action appears to work but
  nothing actually happened
- **Jarring transitions** — content jumping, layout
  shifting, scroll position resetting
- **Cognitive overload** — too many options, too
  much data, too many decisions at once
- **Inconsistent behavior** — same gesture/click
  does different things in different contexts
- **Broken expectations** — clicking "Back" goes
  somewhere unexpected, closing a modal loses
  changes without warning
