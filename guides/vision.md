# Product Vision

## Overview
I'm learning the guitar. From long-ago musical experiences and my guitar lessons, I "know" a lot of relevant things — the strings and notes on the guitar, how chords are assembled, how tab and "normal" music notation work, different kinds of scales, etc. However, many of those things I have to think about and do math in my head to apply, and this makes the knowledge far less useful in practice. This app is meant to focus on automatizing musical knowledge that the user "knows", but doesn't _know_ immediately. 

Think of it as weight lifting for music. Or drilling your multiplication tables in elementary school. 

The app is informed by cognitive and learning science, inspired by spaced repetition approaches. Optimized for efficient practice, helping you use "free" time to be better when you're at your instrument. 

Built-in well-chosen content — not a generic flash-card app.

## Example: guitar fretboard notes

On guitar, it's very useful to instantly know where all the notes are on the fretboard. But it's kind of a pain —- there are effectively 60 notes to learn (two e strings, notes repeat after fret 12). So you usually start with heuristics:

- The strings are (E)ddy (A)te (D)ynamite, (G)ood (B)ye (E)ddy.
- If you look two frets up, two strings away, that's the same note, so if you know the notes on the E string you can figure out the notes on the D string. Except that the B string is different -- B to D or E to G strings is three frets up. 
- the fifth fret is the same as the next open string. Except B again. 
- etc.

If you want to keep playing guitar, you should just memorize the notes so you don't have to think about that when you could be thinking about more interesting higher-level musical considerations. There are some good approaches for learning on your actual guitar. I started with that, and it's necessary to some degree -- your fingers need to actually go to the right places. However, I only get so many guitar minutes a day, and have a lot of miscellaneous phone time. It seems like a waste of time to be thinking "ok, this is the D string, so this is E, F, G, ok, Ab" when I'm actually playing, if I can instead memorize it faster on my phone while waiting for my kids to finish gymnastics class. Then I can work on making my recalcitrant fingers obey me when I get to play.

The app is primarily for skills like this -- I can figure out the answer given some time to think, but want to automatize and stop thinking. We track progress using response times -- if you start taking 8 seconds to name notes, and learn to do it in under one, you've probably stopped doing math in your head.

## Target user

You're a beginner-to-intermediate musician, and you want to keep working at music to make progress. If you think "if I keep working at this a few times a week for the next two decades, I'll see some real progress", this app is for you.

Kids are welcome if they have internal motivation. We'll show you your progress and encourage you, but we're not going to bribe you, guilt you, or nag you into it. You have to find fun in the practice, not in silly animations, treasure chests, etc.

## Usage scenarios 

If you're next to your musical instrument and can play, do that instead! There are other apps that can help with instrument-required exercises. If you have 5 minutes between meetings or are waiting for a ride, this is a better use of your time than scrolling social media or playing silly games. It will make you a better musician. 

Primary scenario: use for 2-5 minutes at a time, perhaps several times a day, hopefully for many months or even years. Start wherever you are -- automatize things you don't already know perfectly, and review them periodically if they decay. Hopefully, you'll keep practicing many of the skills in real music and won't need to keep coming back to them in-app. Add new skills as earlier ones are cemented. 

## Why yet another app?

Lots of tools out there to help you learn music and theory, and they do tend to include practice modes, but:
- not always well optimized for automatization -- you will automatize eventually by just playing music and being curious, but I want to go faster.
- mix teaching and practice in a sequential way, so you're practicing the new stuff, but perhaps not the old. In music as in many other pursuits, there is value in going back and practicing the basics over and over.
- require having your instrument with you, so not usable as a way to fill small slots of time.

To be fair, I haven't done a detailed survey. Partly building this for fun, to scratch my own itch, explore meta-interests around software development, product management, AI, tools for human-computer collaboration.

## Tone, personality, design vision

Design:
- clean
- minimal config. Where there's a reasonable default, go with that. You should be learning, not fiddling with settings.
- solid content coverage, but not excessive -- focus on "core" curriculum.
- used mostly on phone, often without sound, certainly without my instrument.
- adaptive -- we don't waste your time. Understand what you know, how well you remember it, pushes you till you master it, then points you to the next thing to learn and goes back to review periodically.
- Primarily target two-handed phone use. This is intended as a focused, engaged experience -- more like doing a crossword than scrolling social media.

Tone should be:
- calm, coach-like. You're serious about getting better at music, even if slowly and without any plans to be a star, we'll support you.
- not over the top, pushy, overly cheery. The app mostly shouldn't talk -- show me data, let me get excited about it if I choose. "574 minutes of practice so far" shows up. A chart or message conveying "this used to take 9s/item with 10% error rate, now 1.2s/2% error rate". That's motivating without being noisy.
   - Good: "35 correct answers in 1 minute. Your previous best was 28." That's enough. I can see I improved.
   - Not: "35! in 1 minute! Yay! New record! Keep going! You can do it! Go go go! /shows fireworks animation."
- dry, subtle humor is great. Knock-knock jokes, not so much.
- slightly nerdy. I'm a nerd. We're using cog sci here. Keep it out of the main path, but I can't help but want to (eventually) see data. Are RTs really log-normally distributed? What's my RT trend over time? That said, in-app data should be simple and useful -- things that help you understand your state and progress. Nerdier analytics can come later as exports or a separate view.

Related apps:
- I mostly love the Duolingo learning path -- minimal decisions about what to work on next. Can jump into the learning. Starting at the right place can be tricky, and I sometimes feel like it's wasting my time on material I already know. With a more restricted and more structured domain, we have the opportunity to infer more -- if you just answered C+M5, F#+m7, Bb-P11, all near-instantaneously, we can probably assume you'll know G + P4 as well and don't have to test every possible combination. 

- Even more, Duo wastes a ton of my time with animations, treasure chests, etc. I'm motivated to learn. A bit of extra motivation to not skip is helpful (reminders, streak and even the social streaks). Tapping through slot machines for how many gems I get before I can get back to learning is not. The unremovable upsells are also annoying.


## Skill lifecycle

Each skill has a lifecycle:

- **Far Future** -- not relevant yet. You haven't started the prerequisites, or it's just not on your radar. The app won't recommend it.
- **Near Future** -- reasonable to start. "Interval math. Not started. Makes sense to start next."
- **Learning** -- actively working on it. Still getting things wrong, or still slow.
- **Consolidating** -- you can do it, but it's not automatic yet, or you used to have it down and you're rusty. The app keeps it on the practice list. "Fretboard. Learned. Still consolidating. Time to review" Includes things that were once mastered but need refreshing -- if I do a session in a mode I once had down and I'm slow, it goes back on the "keep practicing" list.
- **Mastered** -- we don't think you need to practice this any more. Perhaps this just falls out of a spaced-repetition algorithm that eventually says "next review: 3 years from now." The app won't bring it up without explicit user action. "Note ↔ Semitones. Mastered."

The user can tweak which skills they want to keep reviewing, but mostly the system handles it.

## Guidance and navigation

I don't want to think about what to do next. The app should have a recommendation -- maybe even auto-start in the recommended mode. But it should still say what the mode is, and I should be able to choose something else if I want.

Not a single "Practice" button that hides which mode I'm in. More like: open the app, see my status across skills, see a recommendation ("Recommended: fretboard (last 5 days ago), interval math (good next option)"), tap into it.

The home view should show status across skills -- what's being learned, what's consolidated, what's available next. Trends over time: days practiced out of the last 7, total practice time, that kind of thing. Keep round-end summaries (answer count, time, etc.) -- those are useful context after each round.

Long-term, I'd love goal-based paths: "I want to improvise in folk guitar" and the app selects the relevant skills, sequences them, and guides me through -- right order, not too much at once. For now, the simpler version is fine: per-mode guidance with a good recommendation system on top.

## Target content

For the initial app, relatively basic music theory. What serious/professional musicians have internalized, often without explicit practice just by exposure over many years. What a new musician stumbles on every day.

To make this concrete, here are a few skills that inspired me to build this:

- immediately name all the notes on the guitar fretboard
- key signatures -- stop futzing around with rules for deriving the tonic from the key signature. Just know, "2 sharps is D major", "3 flats is E flat major", etc.
- interval math -- how many tones there are in every interval, be able to instantly jump around by interval. Quick, what's F# + m6? 
- That forms a foundation for chords -- be able to instantly name the notes in common chords, and semi-instantly name the notes in weird chords too. 
- etc. To be added as I find new things to learn, and others ask for features. I already added ukelele mode due to popular demand.

If the app gets some traction, I'm considering extensions:
- to other domains where this kind of drilling is useful and there aren't great solutions. e.g. I still haven't found a multiplication tables app I'm happy with for my kids. That would be a different app, built with the same framework, likely with shared brand.
- to perhaps allow user-created or user-prompted content. Once the patterns are well established, it seems quite likely that e.g. Claude will be able to turn "I want to memorize useful fundamentals for jazz guitar" into a series of lessons that can plug right in.

## Target platforms

Web (free), iOS + Android with a paid model. Details TBD.

## Success

If this helps me become a better musician, I'll already be happy. Ideally, many other people will find it useful too and pay, so I can keep investing in it and making it better.

The app is open source, because it's also a meta-experiment in finding ways to use AI to make better software, faster, and exploring my interests in teaching computers to do what we want. If there is interest and others want to contribute, that'd be great. If someone takes the code and makes a better version, that's also mostly great -- there are many other problems I can work on.


---

For design principles (product, visual, UX), see
[design-principles.md](design-principles.md).
