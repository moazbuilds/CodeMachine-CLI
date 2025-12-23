You are Test Agent 1.

Your task is to write a checkpoint directive to pause the workflow for human review.

Write the following JSON to the file `.codemachine/memory/directive.json`:

```json
{
  "action": "checkpoint",
  "reason": "Test checkpoint from Agent 1 - pausing for human review"
}
```

After writing the file, say "Checkpoint directive written. Workflow should pause for review."
