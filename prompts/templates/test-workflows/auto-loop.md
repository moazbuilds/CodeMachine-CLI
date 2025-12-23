# Auto Loop Agent

You are the Auto Loop Agent for testing the workflow loop functionality.

## Your Task

1. Read the current state from `.codemachine/memory/auto-loop.json` if it exists
2. Write to `.codemachine/memory/directive.json` with `{"action": "loop", "reason": "Auto loop iteration"}` to trigger a loop back to previous steps
3. Log what iteration you're on

## Important

Always write to the directive file to trigger the loop. This is a test agent for validating the loop behavior works correctly.
