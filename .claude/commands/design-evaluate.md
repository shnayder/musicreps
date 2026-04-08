Evaluate the latest screenshots in a UI iteration session against the design
system and produce structured feedback.

**Important:** The goal must come from the user — do not invent one. If no goal
is provided in the arguments, ask the user before proceeding. The goal shapes
which evaluation categories are relevant; a wrong goal leads to evaluating the
wrong things.

Also consider whether the feature's interaction model and architecture are
settled. If the screenshots reveal fundamental functional or architectural
issues, flag those first — visual polish on an unsettled design is wasted work.

## Arguments

Parse `$ARGUMENTS` as: `<session-name> "<goal>"`

- **session-name** — name of an existing iteration session in
  `screenshots/iterate/`
- **goal** — quoted string describing what you're evaluating or improving
  (required — ask user if missing)

If no session name is given, use the most recently modified session.

Example:
`/design-evaluate speed-check "Improve speed check trigger and visuals"`

## Steps

### 1. Load session

Read `screenshots/iterate/<session>/session.json`. Identify the latest version
(last entry in the `versions` array). Report which session/version you're
evaluating.

### 2. Check for existing evaluation

If `screenshots/iterate/<session>/evaluation-<version>.json` already exists,
tell the user and ask whether to re-evaluate or skip.

### 3. Read screenshots

Read all `.png` files from the latest version directory using the Read tool
(which renders images). List which states you see.

### 4. Select relevant evaluation categories

Based on the goal and what you see in the screenshots, select which categories
are most relevant. **Do not try to evaluate everything** — focus on what matters
for this goal. Typical evaluations cover 2-4 categories.

| Category              | Guide to read                                                                                                    | When relevant                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Type hierarchy        | `$DOCS_VAULT/guides/design/visual-design.md` § Type Hierarchy                                                    | Text sizing, weight, color issues                |
| Button taxonomy       | `$DOCS_VAULT/guides/design/visual-design.md` § Button Variant Taxonomy                                           | Button/action styling issues                     |
| Token compliance      | `$DOCS_VAULT/guides/design/visual-design.md` + `.claude/commands/review-checklist.md` § Design system compliance | Any hardcoded CSS values                         |
| Layout & IA           | `$DOCS_VAULT/guides/design/layout-and-ia.md`                                                                     | Content order, grouping, labeling, screen states |
| Elevation             | `$DOCS_VAULT/guides/design/visual-design.md` § Elevation                                                         | Shadow/depth mismatches                          |
| Interaction states    | `$DOCS_VAULT/guides/design/visual-design.md` § Focus, hover, active                                              | Missing interactive feedback                     |
| Structural components | `$DOCS_VAULT/guides/design/visual-design.md` § Structural Components                                             | Should be using Text/ActionButton                |
| Spacing/rhythm        | `$DOCS_VAULT/guides/design/visual-design.md` § Spacing Scale                                                     | Spacing inconsistencies, density issues          |
| Design principles     | `$DOCS_VAULT/guides/design-principles.md`                                                                        | High-level tone, feel, product fit               |

Read only the guide sections for the categories you selected.

### 5. Read relevant source code

From the state names, identify which mode(s) are being evaluated (e.g.,
`speedTap-idle` → Speed Tap mode in `src/modes/speed-tap/`). Read:

- The mode's `.tsx` and `definition.ts` files
- `src/styles.css` sections relevant to the mode
- Check for manual class composition that should use `<Text>` or
  `<ActionButton>`
- Check for hardcoded values that should use design tokens

### 6. Evaluate each state

For each screenshot, assess it against the selected categories. For each issue
found, record:

- **element**: which UI element has the problem
- **category**: which evaluation category it falls under
- **severity**:
  - `high` — violates a concrete design system rule
  - `medium` — deviates from a principle but may have rationale
  - `low` — minor polish or suggestion
- **issue**: clear description of the problem
- **principles**: which specific principles or rules are relevant (with IDs)
- **proposal**: what to change
- **sourceRef**: file:line if you found the code

Also note **positives** — what the design does well, citing principles.

### 7. Write evaluation JSON

Write to `screenshots/iterate/<session>/evaluation-<version>.json`:

```json
{
  "goal": "<goal string>",
  "version": "<version>",
  "timestamp": "<ISO 8601>",
  "categoriesEvaluated": ["<selected categories>"],
  "guidesRead": ["<guide files read>"],
  "sourceFilesRead": ["<source files read>"],
  "states": {
    "<state-name>": {
      "issues": [
        {
          "id": "<state-abbrev>-<n>",
          "element": "<UI element>",
          "category": "<category>",
          "severity": "high|medium|low",
          "issue": "<description>",
          "principles": [{ "id": "<id>", "name": "<short name>" }],
          "proposal": "<suggested fix>",
          "sourceRef": "<file:line>"
        }
      ],
      "positives": ["<what's good, citing principle>"]
    }
  },
  "summary": "<one-line summary: N issues, X high, Y medium, Z low>",
  "prioritizedChanges": [
    {
      "priority": 1,
      "description": "<what to change>",
      "affectedStates": ["<states>"],
      "effort": "small|medium|large",
      "issues": ["<issue-ids>"]
    }
  ]
}
```

### 8. Regenerate review HTML

Run `deno task iterate view <session>` to regenerate the review page with
evaluation data rendered alongside screenshots. The tool will open it in the
browser.

### 9. Present summary

Show the user:

- Which categories you evaluated and why
- Total issues by severity
- Top 3 prioritized changes with effort estimates
- Key positives worth preserving

Then wait for direction — the user will tell you which changes to implement.
