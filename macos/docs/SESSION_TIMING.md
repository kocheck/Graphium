# Timing a real session

How we find and measure the moments that slow the table down. Each fix has to beat the
current app on these numbers in a second real session, so both sessions are timed the same
way.

## Privacy

Recordings contain players' voices and faces. They stay on the DM's Mac and are never
committed, uploaded or attached to issues. Only the timing sheet (times, moment types,
short notes with no player names) goes into the repo, under `macos/docs/sessions/`.

## Before the session

1. Open the campaign in Graphium on the DM's Mac, with the World View on the TV or projector
   as usual.
2. Start a screen recording of the DM's screen with system audio and the room mic:
   QuickTime Player > File > New Screen Recording, Options > Microphone. If remote players
   join on Discord, record that audio too.
3. Keep the prep notes for the session (whatever form they're in) next to the recording.
4. Say "start" out loud at the beginning. That gives a sync point between audio and screen.

The DM plays normally. No narration or stopwatch at the table; the timing happens afterwards.

## Marking moments afterwards

Watch the recording and log every **friction moment**: a stretch where play stops because
of the tool, starting when the DM (or a player) needs something and ending when play
resumes. Use these types so sessions compare:

| Type              | Starts when                                               | Ends when                                             |
| ----------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| `encounter-setup` | The DM decides a fight starts                             | Every combatant is on the map and initiative is going |
| `fog-reveal`      | Players enter or open somewhere new                       | The TV shows the right area                           |
| `world-view`      | The DM wants the TV to show something (map, plate, pause) | The TV shows it                                       |
| `rule-lookup`     | Someone asks how something works                          | The answer is given                                   |
| `token-move`      | The DM moves or finds a token                             | It's where it should be                               |
| `measure`         | Someone asks about range, movement or an area             | The answer is given                                   |
| `audio`           | The DM wants a change of music or an effect               | It plays                                              |
| `map-switch`      | The party moves to a new map                              | The new map is up on the TV                           |
| `note-lookup`     | The DM looks for prep notes, an NPC or a stat block       | They have it                                          |
| `other`           | Anything else that stops play                             | Play resumes                                          |

Record each moment as a row in `macos/docs/sessions/<yyyy-mm-dd>.csv`:

```csv
start,end,type,where_time_went,note
00:14:32,00:16:05,encounter-setup,searching library for goblin tokens,6 goblins + boss
00:41:10,00:41:48,fog-reveal,door closed so area stayed dark,
```

`start` and `end` are recording timestamps. `where_time_went` names the step that ate the
time, in plain words; that is what tells us which technology could help.

## Choosing what to fix

Per type: count, total time, median time. The two or three types with the most total time
are the friction moments to work on. A rare but very long moment (more than two minutes)
also qualifies.

## Measuring a prototype

For each friction moment:

1. **A task script.** Write the moment as steps on a fixed campaign (the stress map, or a
   copy of the real one), e.g. "place six goblins and a boss, roll initiative, show the TV".
2. **Wall-clock time.** Run the script three times in the current app and three times in the
   prototype. Record the median.
3. **Instruments** (Xcode > Open Developer Tool > Instruments) on a Release build:
   - Animation Hitches and Time Profiler while the moment runs (frame rate and hitches during a
     fog reveal, a pan on the TV, a big drag);
   - Points of Interest for any `OSSignposter` intervals the prototype adds around the moment.
4. **Keep or drop.** A prototype ships only if it is faster on the task script and doesn't
   regress hitches. Otherwise it is dropped and the numbers are recorded here.

## Proving it

After the winners ship, the DM runs a second real session and it is timed the same way.
The result is a before/after table per friction type, plus an Accessibility Inspector and
VoiceOver pass over every changed screen.
