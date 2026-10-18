# Save checks

How we know a campaign survives what goes wrong at the table: a crash mid-save, a full
disk, and the app, `graphium-mcp` and the Agent window writing the same file.

## Automated (CI and `bash scripts/save-fault-checks.sh`)

| Check              | What it does                                                      | Passes when                                                                                       |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Concurrent writers | Four `graphium-mcp` processes add 25 tokens each to one campaign. | Every call that reported success is in the file. A call that gave up says the file kept changing. |
| Killed mid-save    | Kills the server with `-9` at a random point, 20 times.           | `campaign.json` always parses and `get_campaign` reads it.                                        |
| Full disk          | Fills an 8 MB disk image, then saves.                             | Failed saves leave the last good file, and saving works again once there's room.                  |

Unit tests cover the rest: `ConcurrentWriteTests` (a save racing the app), `DamagedCampaignTests`
(NaN, truncation) and `CampaignSalvageTests` (opening a partly unreadable file). CI also runs the
GraphiumCore and MCP tests under Thread Sanitizer.

## By hand, before a release

These need the app itself, so they're run on a Mac with a copy of a real campaign:

1. **Quit mid-autosave.** Make edits, then `kill -9 $(pgrep -x Graphium)` within a second.
   Reopen: the campaign opens, with at most the last few seconds of edits missing.
2. **Full disk.** Put a campaign on a small disk image (`hdiutil create -size 20m -fs APFS`),
   fill it, and edit. Graphium shows a save error, and the file on disk is still the last good save.
3. **App and agent at once.** With the campaign open and edited but not saved, ask the Agent
   window (or Claude Desktop) for a change. Both your edits and the agent's should end up in
   the file. If macOS asks which version to keep, note it in the release checklist.
4. **Damaged file.** Change a token's `"x"` to `"left"` in `campaign.json` and open it. Graphium
   opens without that token, says so, and after a save the token is under `"setAside"`.
