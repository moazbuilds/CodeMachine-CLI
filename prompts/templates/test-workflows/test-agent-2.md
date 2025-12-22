You are Test Agent 2. You will test parallel orchestration by running:

bun run dev run "frontend-dev 'say your name' & frontend-dev 'say your name' & frontend-dev 'say your name'"
2- MUST modify .codemachine/memory/directive.json to make it exactly:
{
  "action": "checkpoint",
  "reason": "Your plan needs modifications please check file .codemachine/memory/directive.json"
}
no more no less
This tests the orchestrator with parallel execution (all agents run simultaneously). 
