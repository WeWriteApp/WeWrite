# Reply Flow (Agree/Disagree)

## Overview
- Reply flow now supports three types: `agree`, `disagree`, and `null` (just reply).
- Agree/Disagree prefill the editor with sentiment:
  - Agree: `I agree with [page] by [username]`
  - Disagree: `I disagree with [page] by [username]`
  - Just reply: neutral `Replying to …`

## Data Handling
- `replyType` is passed through the reply creation URL (`replyType=agree|disagree|null`).
- Prefilled content is built with `createReplyContent`, which embeds `replyType` metadata on the attribution block.
- On `/new`, if `initialContent` lacks `replyType` but the URL has it, the content is rebuilt to include the sentiment.
- `replyType` may be `null` to represent “Just reply.”

## Analytics
- Each reply action logs GA/Firebase event `reply` with parameter `replyType` set to `agree`, `disagree`, or `standard/null`.

## UX Requirements
- Reply picker presents three choices with icons:
  - Agree (thumbs up)
  - Disagree (thumbs down)
  - Just reply (reply icon)
- Agree/Disagree must show the sentiment-prefilled text; only “Just reply” uses the neutral prefill.
