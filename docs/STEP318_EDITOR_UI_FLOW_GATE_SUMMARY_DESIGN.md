# Step318 Editor UI Flow Gate Summary Design

## Goal

Turn `editor_ui_flow_smoke.sh` into an explicit gate producer instead of a flow that only reports transport success and then requires manual `flow_result.json` inspection.

## Problem

Before this step, the script had two separate notions of success:

- shell `OK`, driven only by:
  - `FLOW_EXIT_CODE == 0`
  - screenshot exists
  - flow JSON parses without `__error`
- `interaction_checks.complete`, computed later inside the summary writer

That meant the long flow could still be reported as successful at the shell layer without promoting the semantic checks back into the gate decision.

The tail also duplicated console capture:

- one `pwcli console warning` call into `playwright.log`
- another `pwcli console warning` call into `console.log`

That duplication added noise and increased the tail work of an already long smoke wrapper.

## Design

Update `tools/web_viewer/scripts/editor_ui_flow_smoke.sh` so the summary layer becomes the canonical gate bridge:

- persist `interaction_checks_complete`
- persist `first_failed_interaction_check`
- persist `gate_ok = ok && interaction_checks_complete`
- when `gate_ok` is false because semantic interaction checks failed, emit:
  - `flow_failure_code = UI_FLOW_INTERACTION_CHECK_FAIL`
  - `flow_failure_detail = <first failed check>`

Then make the final shell exit honor `gate_ok`, not just the earlier transport-oriented `OK`.

Also remove the duplicate console CLI invocation:

- keep a single `pwcli console warning` call for `console.log`
- append that captured output into `playwright.log`

## Boundaries

This step does not change:

- any editor runtime behavior
- any interaction contract inside the flow body
- any Playwright action timing

It only tightens the wrapper semantics around:

- success classification
- failure summarization
- tail log capture

## Expected Outcome

The long flow now has an explicit semantic gate result:

- passing artifacts produce `gate_ok = true`
- failing artifacts produce `gate_ok = false` plus a stable failure code/detail

So downstream consumers no longer need to inspect `flow_result.json` manually just to know whether the wrapper considers the run a real pass.
