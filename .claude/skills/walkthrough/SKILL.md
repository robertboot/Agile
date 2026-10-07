---
name: walkthrough
description: Walk Robert through anything he has to do by hand — a dashboard setting, a dialog, a console, a phone call, pasting SQL. Use whenever a task needs him to click, type or navigate somewhere Claude cannot reach. ONE step per message, then stop and wait.
---

# Walkthrough

Robert does not want a plan. He wants the next thing to do.

## The rule

**One step per message. Then stop.**

Not "one step, and here's what comes after". Not five numbered steps. One. Wait for him to
come back before giving the next.

A message that contains step 2 has already failed.

## Shape of a step

- Two or three lines, maximum.
- Start with the click or the action, not the reason.
- Name the exact thing to click, by its visible label, and say where it is on screen
  relative to something he can already see.
- No explanation of why unless he asks.
- End. No "then", no "after that", no preview of what's coming.

Good:

> Click **Reset password** on the Database Settings page, under "Database password".
> Copy the new password it gives you.

Bad:

> First reset the password, then copy the connection string, then open the environment
> editor and add it as a variable, then restart the session.

## When he is lost

If he asks "where?" he has already looked and not found it. Do not repeat the same
description louder.

- Give a different landmark, or a direct URL.
- Ask what he can see on screen and work from that.
- If he has sent a screenshot, read it and point at the actual pixels — top-left, third
  tab along, right of the green badge.

## Never

- Never send a wall of steps because it "saves a round trip". It does not; it loses him.
- Never ask him to paste a password, token or key into the chat. It goes in the settings
  field, never the conversation.
- Never send him a long block to copy when the same thing can be a file he opens, or
  something Claude can do itself. If a paste keeps failing, stop pasting and fix the
  mechanism — shorter chunks, plain ASCII, or a file.
- Never say "just" or "simply".

## Address him by name when the step is his to do

One step. Then stop.
