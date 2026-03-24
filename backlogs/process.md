# Process Backlog

Owner: process workstream
Branch: workstream/process

## Scope

Process improvements, retros, scripts, Claude automation, focusing human
attention on the right things. If it's about how we work rather than what we
build, it belongs here.

## Prioritization principles

- **Make efficient use of my (human) time and attention**
  - Guide my attention to the right things
  - Improve review tooling
  - Document and automate so I don't have to make the same decision many times.
- **Prevent repeated friction.** One-off issues are ok. Three-off issues are
  not.
- **Use tools to automate or simplify human or AI review** when possible. Type
  systems, linters, screenshotters, tests of course. Build custom tools.

## Active

- VS code + worktrees.
  - process for keeping track of and updating branches. Perhaps just treating
    worktrees as feature branches is easiest, though merge back to main, then
    start next branch will have to happen without actually checking out main.
    Make a script for that.
  
## Backlog

### Review and feedback

- Set up codex access to musicreps
- Notifications when web session stop. But just once, not every ten minutes.
- [P1] Product spec review checklist + command (like code review)
- [P1] Post-merge clean-up checklist/trigger
- [P1] Review and improvement process after every feature / bug fix batch
  - How could we have prevented the bug?
  - How could we have caught it with build-time tools (tests, linter)?
  - What patterns/libraries would make future work easier?
- [P1] Fix GH auto review config (get Claude to wait/respond automatically)
- [P2] Step-by-step review tooling — big spec/plan, go through chunk by chunk
- [P2] Improve GH code review instructions
- [--] Regular code review cadence

### Tooling and automation
- Screenshot tool should support components, for design system iteration
- [P1] Set up notifications when web mode or local claude finishes or stops for
  questions (iOS/watch)
  - overview dashboard of what needs my attention? Shown in the corner on every
    desktop
- Tailscale + tmux + ssh + phone?
- Color terminals to match worktrees
- [P2] Script/hook to filter for new user-facing terminology, or wrong words
- [--] Get & background tasks working
- [--] Tune local sandboxing
- [--] Voice + pointer review tool, hooked up to DOM so I don't have to explain
  what I'm talking about. Point mouse at a thing or things and talk.

### Planning and organization
- Obsidian for backlog management and specs?
- Update PR descriptions as we go
- [P2] Backlog wrangling — how to keep it organized, sized. "Start on the next
  thing" command perhaps.
- [P2] Size plans using XS-L (anything >L needs splitting)
- [P2] Periodic git cleanup: remove merged feature branches
- [--] Highlight tags in backlog, if I stick with this format
- [--] Use GH issues for backlog? Integrate with Claude?
- [--] Use up weekly token budget — backlog of tasks to run
- [--] Project timeline report/viz/analysis
- dev and probably other guides getting long -- split further