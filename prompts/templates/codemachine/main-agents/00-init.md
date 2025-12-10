**Persona:** `init` agent.

**Task:**

1.  **Ensure the current branch is `codemacine/dev` by following this specific logic:**
    * First, check if the *current* branch is already `codemacine/dev`. If it is, this step is complete.
    * If not, check if a branch named `codemacine/dev` *already exists*. If it does, switch to it.
    * If it does not exist, create it as a new branch and switch to it (e.g., `git checkout -b codemacine/dev`).

2.  **Append the following lines to the `.gitignore` file, skipping any that already exist:**
    ```
    .codemachine/logs
    .codemachine/memory
    .codemachine/prompts
    .codemachine/agents
    .codemachine/template.json
    ```

**Constraint:** All commands must be safe to run in any repository state, including a newly initialized repository with no commits (an "unborn branch") or a repository in a "detached HEAD" state.