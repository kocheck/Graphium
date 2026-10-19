# Think-aloud sessions and SUS

Five real sessions with DMs who haven't used Graphium, on the fixed build. An agent can't stand in
for these: the agent runs in [LAUNCH_QA_RESULTS.md](LAUNCH_QA_RESULTS.md) are scripts, and their
numbers are never reported as human results.

## Setup (once per session)

- A fresh macOS user account, or run `defaults delete com.graphium.mac` and File > Open Recent >
  Clear Menu, so the Welcome window looks new.
- A synthetic map image on the Desktop: export one from the Welcome > Generate Dungeon flow on
  another account, or use a free battlemap you have the rights to. Never a real campaign.
- A second display or TV if you have one; otherwise the World View window on the same screen.
- Screen recording with QuickTime (File > New Screen Recording) with the microphone on. The
  recording stays on your Mac (SESSION_TIMING.md); only the sheet below goes in the repo.
- Open Console.app, filter `subsystem:com.graphium category:qa`, so the `activation` line
  and its time are visible after the session. The same line is in `~/Library/Logs/Graphium`.

## Script (read aloud, word for word)

> Thanks for helping. I'm testing the app, not you, so anything that's hard is the app's fault.
> Please think out loud: say what you're looking at, what you expect and what surprises you.
> I can't answer questions during the task, but I'll answer them all afterwards.
>
> **Task.** You're running a game tonight. On the Desktop there's a map image. Get that map onto
> the second screen for your players, with one player character on it that the players can see.
> Tell me when you think you're done.

Don't help. If they are silent for 10 seconds, say only "What are you thinking?" If they are stuck
for 3 minutes, say "Let's stop there" and record the step as failed.

After the task, ask:

1. What did you expect to happen when you opened the second window?
2. Was there a moment you thought it was broken? Where?
3. Anything you'd call it differently? (Note every word they use for PC, World View, calibrate.)

## Sheet (one row per participant, in `macos/docs/sessions/<date>-thinkaloud.csv`)

| Column              | What to write                                                                 |
| ------------------- | ----------------------------------------------------------------------------- |
| participant         | P1 to P5, no names                                                            |
| dm_experience       | years running games; VTTs used before                                         |
| completed           | yes / no (the players' screen shows the map with a visible PC)                |
| time_on_task_s      | from "Task." to "done", from the recording                                    |
| activation_s        | the `activation` log line's seconds, if it appeared                           |
| furthest_step       | critical path step number from [LAUNCH_QA.md](LAUNCH_QA.md#critical-path-new-install-the-dm-brings-a-map-image) |
| stalls              | step number and what they said, one per stall                                 |
| sus                 | score from the form below                                                     |

## SUS form (hand it over after the questions)

Answer each from 1 (strongly disagree) to 5 (strongly agree).

1. I think that I would like to use this app frequently.
2. I found the app unnecessarily complex.
3. I thought the app was easy to use.
4. I think that I would need the support of a technical person to be able to use this app.
5. I found the various functions in this app were well integrated.
6. I thought there was too much inconsistency in this app.
7. I would imagine that most people would learn to use this app very quickly.
8. I found the app very cumbersome to use.
9. I felt very confident using the app.
10. I needed to learn a lot of things before I could get going with this app.

Score: for odd items subtract 1 from the answer; for even items subtract the answer from 5. Add
the ten results and multiply by 2.5 (0 to 100; 68 is average).

## Baseline and report

There is no human baseline yet: no stranger has used the native app. Run one session on the build
from before the QA fixes (the commit before the QA PR) if you can, so P1 is the baseline, and
P2 to P5 use the fixed build. Report completion rate, median time on task and mean SUS for each,
and every stall the agents' runs didn't predict or find, in LAUNCH_QA_RESULTS.md under "What the
agents got wrong".
