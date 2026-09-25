# Design system

Rules for UI. When rules conflict, protect them in this order:

1. Accessibility and both themes readable.
2. Semantic tokens and shared primitives over one-off styling.
3. Neutral chrome; color is for status only.
4. Density that matches the layout (desktop 32px / touch 44px).
5. Motion that explains a change; never decoration.
6. Surfaces and borders only when earned.

If shipped chrome disagrees with a rule here, update this document or ask.

## Principles

- Read first. Content is a document. Chrome is furniture.
- Neutral chrome. Charcoal dark, white or pale gray light. Reserve color for semantic status.
- Semantic tokens own color. Features never pick a palette or raw hex.
- Density follows layout. Desktop controls are 32px. Touch keeps 44px targets.
- Motion explains. State changes and panel open/close; no ornament.
- Accessibility is structural. Focus, names, and contrast are part of the design, not polish.

## Type

- Use the Tailwind text scale only. No custom font sizes in feature files.
- Heading copy uses the `font-heading` role. Code and monospace runs use `font-mono` when defined, otherwise `font-sans`.
- Weights: regular (400), medium (500), semibold (600) only.

## Spacing and geometry

- Use the Tailwind spacing scale for layout gaps and padding.
- Corner radius uses roles derived from one `--radius` knob: `tight` = radius − 4px, `control` = radius, `inset` = radius + 4px, `container` = radius × 2, `sheet` = radius × 2.5, `full` for capsules/circles only, `none` for flush chrome. Do not invent one-off radii.
- A shape nested inside another uses radius = outer radius − gap, never below `tight`.
- Pill shapes (`rounded-full`) only for intentionally circular or capsule controls; never text buttons, cards, panels, or static labels.

## Token roles

Names live in the project's `tokens.css`. Use the role, not a hard-coded value. This document never holds values.

| Role                   | Meaning                          |
| ---------------------- | -------------------------------- |
| `background`           | Page and app ground              |
| `foreground`           | Default text on background       |
| `card`                 | Raised content surface           |
| `card-foreground`      | Text on card                     |
| `popover`              | Floating menu or popover surface |
| `popover-foreground`   | Text on popover                  |
| `primary`              | Primary action fill              |
| `primary-foreground`   | Text on primary                  |
| `secondary`            | Secondary / inset surface        |
| `secondary-foreground` | Text on secondary                |
| `muted`                | Quiet wash behind muted text     |
| `muted-foreground`     | Secondary text                   |
| `accent`               | Accent wash                      |
| `accent-foreground`    | Text on accent                   |
| `destructive`          | Dangerous action or error        |
| `border`               | Default border                   |
| `input`                | Input border / field edge        |
| `ring`                 | Focus ring                       |
| `positive`             | Success / credit status          |
| `negative`             | Failure / debit status           |
| `chart-1` .. `chart-5` | Chart series colors              |
| `radius`               | Base corner radius knob          |
| `radius-tight`         | One step below control           |
| `radius-control`       | Default interactive control      |
| `radius-inset`         | Nested inside a container        |
| `radius-container`     | Cards, menus, dialogs            |
| `radius-sheet`         | Large sheets and bubbles         |
| `radius-full`          | Capsules and circles             |
| `radius-none`          | Flush chrome                     |
| `font-sans`            | Default UI typeface              |
| `font-heading`         | Heading typeface                 |
| `font-mono`            | Monospace typeface (optional)    |

A fill must read in both themes. A faint hover wash is too weak as a selected or editing state fill; use a solid secondary surface for those.

## Surfaces and borders

- Earn a surface or border: selection, interaction, warning, or a real group. Prefer spacing and typography for hierarchy.
- No nested cards. Panes are flush; splitters and hairlines divide.
- Status is a mark (ring, dot, icon tone), not a tinted card fill or badge for ordinary metadata.

## Interaction states

- Hover: muted wash or icon tone shift; interruptible.
- Focus-visible: ring via the `ring` role; never invent a second focus language. Put the focus ring on the whole interactive row, never the inner textbox alone when the row already owns focus chrome.
- Selected: solid secondary or accent fill that works in both themes.
- Editing: soft secondary fill, not a heavier card.
- Disabled: reduced opacity or muted icon; still layout-stable.
- Dragging: same density as the resting control; no decorative elevation.

## Motion

- Prefer short, interruptible transitions that explain a state change.
- Reduced motion: no transform; color and opacity only.

## Reject list

- Decorative gradients, glows, multi-layer shadows, or purple-on-white defaults.
- Badges, pills, or tinted cards for ordinary metadata.
- Borders or nested cards to fix weak hierarchy.
- Textbox focus rings inside composite rows that already show focus.
- Raw hex or ad-hoc palette in feature files.
- Product-behavior essays in this file. Code and tests own behavior.

## Review checklist

- [ ] Light and dark both readable; state fills visible in both.
- [ ] Mobile width checked; touch targets adequate.
- [ ] Keyboard focus-visible is obvious; no missing names.
- [ ] Density matches the layout (compact figures vs comfortable editors).
- [ ] Tokens and shared primitives used; no one-off color.

## Where it lives

- The project's `tokens.css` is the source of truth for values.
- Roles may be split across multiple `:root` or `.dark` blocks (including inside `@media`, `@supports`, or `@layer`). Each color role must still exist in both themes when all blocks are merged.
- This document defines vocabulary and rules only. It never holds values.
