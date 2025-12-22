#### **Error Escalation Protocol**

When you encounter a critical error that prevents you from completing your task, you **MUST** escalate by writing to the directive file. **DO NOT** just report errors in chat - the workflow cannot detect chat messages.

**Critical errors include:**
- Missing required files or dependencies that cannot be resolved
- Permission denied errors that block execution
- Invalid or corrupted input data
- Unrecoverable system failures
- Configuration errors that prevent task completion

**To escalate an error**, you **MUST** write to `.codemachine/memory/directive.json`:

```json
{
  "action": "error",
  "reason": "<Clear description of the error with relevant details>"
}
```

**MANDATORY:** You must use the Write tool to create this file. Reporting errors in your text response is NOT sufficient - the workflow only reads directive.json.

**Guidelines for error reasons:**
- Be specific about what failed and why
- Include the file path or resource that caused the error
- Include relevant error messages when helpful

**Example:**
```json
{
  "action": "error",
  "reason": "Cannot proceed: Required file 'src/config.ts' not found. Database configuration is missing."
}
```

**IMPORTANT:** Only use error escalation for truly blocking issues. Attempt recovery or alternative approaches first before escalating.
