// CodeMachine AI Assistant - Demo Responses
export const demoResponses = {
  "what is codemachine": {
    text: "CodeMachine is a CLI tool that lets you create, run, and share AI-powered workflows. It enables you to automate tasks by chaining together multiple AI agents with custom prompts.",
    source: { title: "What is CodeMachine?", url: "/core-concepts/what-is-codemachine" }
  },
  "how do i create my first workflow": {
    text: "To create your first workflow:\n\n1. Create a directory for your workflow\n2. Add a workflow.yaml file defining your agents\n3. Write your prompts in .md files\n4. Run with codemachine run",
    source: { title: "Your First Workflow", url: "/build-workflows/your-first-workflow" }
  },
  "how do agents work": {
    text: "Agents are the building blocks of workflows. Each agent has a name, model, and prompt. They can receive inputs from other agents and produce outputs for downstream agents.",
    source: { title: "Build Agents", url: "/build-workflows/build-agents" }
  }
};

export function getResponse(question) {
  const key = question.toLowerCase().replace(/[?!.,]/g, "").trim();
  return demoResponses[key] || {
    text: "This is a demo preview. When connected to your backend, I'll search your documentation and provide accurate answers with source citations.",
    source: null
  };
}
