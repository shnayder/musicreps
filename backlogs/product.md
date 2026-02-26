# Product Backlog

Owner: product workstream
Branch: workstream/product

## Prioritization principles
1. Make it work for me: major usefulness or usability blockers first
2. Validate big risks or unknowns early (e.g. app store, overall approach)
3. Ongoing process and tech improvements — pull in small ones regularly

## Goals
1. Reach acceptable usability for fretboard mode — getting close
2. Reach acceptable layout, UI design — just starting
3. Derisk testflight iOS app
4. Make agents more autonomous in extending the app

## Active
- UX glossary — mode, quiz, round, item, fluent vs mastered, recall vs speed
- Roadmap cleanup

## Backlog
- Home screen: what skills exist, what's my status on each
- home screen — follow up from claude/redesign-navigation-menu-xpSD4, or perhaps discard at this point and start over
- "What should I work on next" recommendation
- "Have I practiced long enough?" — question count, coverage, recall status
- Show effort: how much practiced today, across modes, over time
- Show progress: response time trends, modes started -> mastered
- Cold start for non-novice: mark areas as "I know this" or fast-test mode
- Sequencing/prioritization/recommendation: Duo-path style, cadence levels, etc.
- Brief descriptions of each mode in the menu
- Explanation that orange border means "recommended"

### Small bugs
- semitone math is only testing addition, looks like
- buttons wrong size for semitone math and other related modes.
- Tweak: "last-question quiz extension" should have a timeout, not just sit there for 3 hours if you leave it. 30s to start.
- "Keyboard: C D E, c d e, C#, fs (=F#), Db, bb (=Bb) — Enter to confirm" shows up on round complete. Shouldn't be on this screen at all. Component screwup?

## Future / Public Release
- Better name (Reflex Music?)
- iOS/Android support
- Marketing materials, landing page
- LLC or personal business
- review code license
- Intro/landing screen
- Feedback loops (email, bug reports)
- Monetization plan

## New Modes to Consider
- Relative major/minor
- Chord tones on fretboard
- Common chord relationships / transposition
- Musical modes (Dorian, Lydian, etc.)
- Pentatonic scale notes
- Circle of fifths navigation
