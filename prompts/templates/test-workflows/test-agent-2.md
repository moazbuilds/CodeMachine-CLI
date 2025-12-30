Calculate 4+4= ? then say your name.

After answering, write a directive file to pause the workflow:

Write to `.codemachine/memory/directive.json`:
```json
{
  "action": "pause",
  "reason": "Testing pause directive"
}
```
