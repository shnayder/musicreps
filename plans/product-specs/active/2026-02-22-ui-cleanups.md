# Layout and IA
- home screen:
    1. page has a scroll bar even when screen is much larger than menu. 
    2. align title left, not center
- quiz setup mode
    1. "Overall" isn't clear. We're trying to communicate the user's overall level of knowledge/memory/comfort/mastery of this info. Whatever word we pick, should be a header. 
        1. Then our current estimate.
        1. below it, show how many of the items have been learned
    1. Quiz config session needs a header. Perhaps "Quiz setup"?
        - then Suggestions section
        - then the actual config. If there are more than one params, stack them vertically. Align labels left.
    1. Info string "2 strings · sharps and flats · 60s" seems superfluous -- duplicating info just above. Remove it.
- progress tab
    - Explain what we're seeing
    - everything is centered. Looks weird to me.
    - "Response time baseline: 0.8s" needs explanation, and can't be so faint if it's at the top of the page. Either put it below (probably right idea), or make it more prominent. Or both.
    - buttons in line with text doesn't look right. Put it below perhaps.
    - align legend left? or make it vertical, one item per row. 
    - In recall mode, percentages are very mysterious. Need to explain what we're estimating. Does % make sense? (make this a separate exploration I think)
- mid-quiz
    - nit: "Name this note." — drop the period
    - correct/incorrect handling. Instead of correct/incorrect message below notes -- feels a bit antique -- what about making the button itself give feedback -- either flash it green, or flash it red and highlight the correct answer. 
        - for multi-step modes, can do this for each step. This gives the user a hint mid-question, but that's ok: e.g. in chord spelling, if I enter C F for C major, it will tell me the right second note is E before I enter the third note. That's fine.
        - for speed tap, scope response to the string I suppose. If I'm supposed to tap E and tap F instead, show me where E is on that string (could be in two places). 
    - Last question shouldn't be awkwardly attached after "name this note"
    - for text prompts, show just the prompt: "A + m6" instead of "A + m6 = ?".
    - keyboard entry -- when there's a keyboard (can we detect that we're not on a phone?), show the user a summary of the keyboard ("Keyboard works: type C, D, Eb, Gs or G#, db, ds, ..." ). And then help them see what they've typed -- I think highlight the still-possible answers may work well. So e.g. if I'm entering notes and type C, C and C# get shown in an "intermediate state, pick one" style. Then hit enter when done.
        - once this works, can support keyboard entry in all modes text-response modes. 
    - center quiz vertically?

- Round complete
   - awkward hierarchy. Small font mode summary with no header at the top, then large "Round complete" and details.
     - move overall summary below "round complete", with its own header? User logic "how did I do on this round? Ok, how am I doing overall? Should I keep going?"
   - center vertically?

# Color
- grey background for quiz mode is sad. Let's try neutral, same as home screen.
- Red "Wrong - it was B" message is too red. 
- round complete background is also sad grey.



once we're done -- architecture retro. Why is the structure duplicated in each mode? We're just moving UI structure around, not changing anything about logic or state. I would hope  
  that these were better separated.   