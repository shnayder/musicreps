# Engineering Backlog

Owner: engineering workstream
Branch: workstream/engineering

## Scope

Dev tooling, linters, tests, CI, tech debt, build system,
input handling. If it's code behavior that users won't consciously
notice as "design," it belongs here.

## Active

## Backlog
Try agentic browser tools for vs code (Experimental), Setting:   workbench.browser.enableChatTools


### Quiz behavior

### iOS
- get to a first TestFlight install
- later: release process

### Testing
- integration tests. e.g. speed tap - click, assert progress updates. Check that components are wired correctly.

### Tech debt / architecture
- look more closely at the code. Use function length linter, add others for code smell. 
- arch
  - how declarative can modes be? how declarative should they be?
    - i.e. app framework provides bags of prompt, response, stats controls, modes provide sets of items, choose controls. What stays custom? distractor logic perhaps. Not sure what else?
- plans/design-docs/2026-03-04-build-architecture-evaluation.md
  - remove dual rendering paths. Perhaps add splash screen at the same time.
  - split up css
- arch review claude command
- Can/should we make a fretboard without SVG? HTML tables instead. First understand why
  the SVG is causing issues.
- How and why is speed tap different arch-wise? Clean it up?
- Look for large code files, refactor
- consider tailwind

mode clean ups:
  -> put definition right in the logic file? single file
  -> put description, before/after text in the mode itself. Mode is self-contained source of truth. Home page components need to pull from all enabled modes. 
