---
name: design-feedback
description: Feed the Graphium macOS design harness. Use when Kyle shares an image or pattern with what he likes or dislikes, when a session finds a design rule card wrong or missing, or when asked to consolidate or heal the design harness.
---

# Design feedback

Turns Kyle's examples and real misses into tested rules in `macos/design/harness/`. Nothing changes without Kyle's OK, and approved changes go in as a PR.

## A. Taste example (image + "like / don't like")

1. Save the example card at `macos/design/harness/taste/examples/<yyyy-mm-dd>-<slug>.md` with: what Kyle liked, what he didn't (his words), a text description of the image, and its source URL if any. Items from his myMind collection are cited by title, as the 006 brief does.
2. Images: only Graphium renders or synthetic mockups go in the repo, next to the card. A third-party screenshot stays out of git: in the claude.ai project folder (`/mnt/project-files/design-harness/refs/`) when the session has it, otherwise ask Kyle where to keep it. The card holds the description, source and that location instead; never drop the reference silently.
3. Run the `design-advisor` agent in **distill** mode on the card, naming this SKILL.md for the card format.
4. Show Kyle the candidate rules and which existing rules they strengthen, merge with or contradict. A contradiction waits for his choice. A rule that contradicts a decision in `docs/decisions/` needs a new decision file, not just a card edit.
5. On his OK, update `taste/principles.md` (or a rule card if the rule is about a specific surface), add the example to the rule's `sources`, and raise `confidence` only for an independent example.

## B. Miss (a card was wrong, missing, or the advisor reported a rule gap)

File a GitHub issue in kocheck/Graphium labeled `design-harness` (create the label if missing) with the card id, what happened, and the screenshot or file that showed it. Don't edit a shared log.

## C. Consolidate (every five new examples or open `design-harness` issues, or when asked)

Run the advisor in **consolidate** mode, pasting the open `design-harness` issues' text into the call (it can't read GitHub), show Kyle the edits, then open one PR that applies them and closes the issues it fixes.

## Rule card format

`macos/design/harness/rules/<id>.md`, 3 KB at most, listed in `macos/design/harness/INDEX.md` with a "read when" phrase:

```
---
id: <kebab-case, same as filename>
applies_to: [mac, surface or component tags from INDEX.md]
sources: [issue numbers, decision files, brief sections, HIG pages, taste examples]
confidence: decided | strong | tentative
reviewed: <yyyy-mm-dd>
superseded_by: <id>   # only when retired; never delete a card
---
# <the rule as a title>
**Rule.** … **Test.** one line an agent can check on a screenshot.
**Good.** … **Bad.** … **Why.** … Links: Apple pages and in-repo files only.
```

`taste/principles.md` holds at most 15 numbered rules (4 KB), each with a test and its sources. Adding a 16th means merging or demoting one. Taste example cards may be up to 6 KB. A rule with no new supporting example in six months is marked superseded at the next consolidation; rules sourced from the confirmed 006 brief are exempt until Kyle revisits the brief.

Don't restate DESIGN.md or token values; link to its sections. `bash macos/scripts/check-design-docs.sh` checks byte budgets, that every rule card is listed in INDEX, that each card's `id` matches its filename (write `id` plain: no quotes, no trailing comment), and that generated tokens are current. The 15-rule cap, `superseded_by` and decay are kept by the consolidate step, not by the script.
