# CodeMachine Workflow Customization Guide

CodeMachine CLI provides a powerful, flexible workflow system that can be completely customized to fit your specific development needs. This guide covers everything from basic modifications to advanced workflow orchestration patterns.

## Quick Start: Customizing Your First Workflow

### 1. Understanding the Core Components

CodeMachine workflows consist of three main configurable parts:

- **Main Agents** (`config/main.agents.js`): Primary workflow steps that execute sequentially
- **Sub-Agents** (`config/sub.agents.js`): Specialized agents that can be called dynamically by main agents
- **Workflow Modules** (`config/modules.js`): Special behaviors like loops and triggers
- **Workflow Templates** (`templates/workflows/`): Define the sequence and configuration of steps

### 2. Basic Workflow Customization

#### Creating a Custom Workflow Template

Create a new workflow file in `templates/workflows/my-custom-workflow.js`:

```javascript
export default {
  name: "My Custom Workflow",

  steps: [
    // Basic step resolution
    resolveStep("init", { executeOnce: true }),

    // With custom engine and model
    resolveStep("principal-analyst", {
      executeOnce: true,
      engine: "claude",
      model: "opus",
      modelReasoningEffort: "high",
    }),

    // Using UI separators
    resolveUI("🔧 Custom Development Phase"),

    // Custom step with fallback
    resolveStep("code-generation", {
      engine: "codex",
      model: "gpt-5-codex",
      notCompletedFallback: "plan-fallback",
    }),

    // Loop behavior
    resolveModule("check-task", {
      loopSteps: 4,
      loopMaxIterations: 10,
      loopSkip: ["runtime-prep"],
    }),
  ],

  subAgentIds: ["founder-architect", "structural-data-architect", "behavior-architect"],
};
```

## Advanced Customization Patterns

### 1. Multi-Engine Workflow Strategy

Different AI engines excel at different tasks. Here's how to optimize workflow performance:

```javascript
export default {
  name: "Optimized Multi-Engine Workflow",
  steps: [
    // Strategic planning with Claude
    resolveStep("blueprint-orchestrator", {
      executeOnce: true,
      engine: "claude",
      model: "opus",
      modelReasoningEffort: "high",
    }),

    // Code generation with specialized models
    resolveStep("code-generation", {
      engine: "codex",
      model: "gpt-5-codex",
    }),

    // Analysis and review with Claude
    resolveStep("task-sanity-check", {
      engine: "claude",
      model: "sonnet",
    }),

    // Git operations with Cursor
    resolveStep("git-commit", {
      engine: "cursor",
    }),
  ],
};
```

### 2. Conditional Workflow Branching

Use trigger modules to create adaptive workflows:

```javascript
// First, create a custom trigger module in config/modules.js
{
  id: 'quality-gate',
  name: 'Quality Gate',
  promptPath: 'prompts/templates/custom/quality-check.md',
  behavior: {
    type: 'trigger',
    action: 'mainAgentCall',
    triggerAgentId: 'code-refinement' // Default agent to call
  }
}

// Then use it in your workflow
export default {
  name: 'Quality-Driven Workflow',
  steps: [
    resolveStep('code-generation'),
    resolveStep('task-sanity-check'),
    resolveModule('quality-gate'), // Will trigger different agents based on quality
    resolveStep('git-commit')
  ]
};
```

### 3. Parallel Execution Patterns

Leverage sub-agents for parallel processing:

```javascript
export default {
  name: "Parallel Architecture Workflow",
  steps: [
    resolveStep("blueprint-orchestrator", {
      executeOnce: true,
      // This agent can call multiple sub-agents in parallel
      engine: "claude",
      model: "opus",
    }),
  ],

  subAgentIds: [
    "founder-architect", // Works on foundation
    "structural-data-architect", // Works on structure
    "behavior-architect", // Works on behavior
    "ui-ux-architect", // Works on UI/UX
    "operational-architect", // Works on operations
    // All can execute in parallel when called by blueprint-orchestrator
  ],
};
```

## Creating Custom Agents

### 1. Adding Main Agents

Edit `config/main.agents.js` to add new workflow steps:

```javascript
{
  id: 'security-review',
  name: 'Security Review Agent',
  description: 'Conducts comprehensive security analysis of generated code',
  promptPath: path.join(promptsDir, 'custom', 'security-review.md'),
  // Optional: Custom chain of prompts
  chainedPromptsPath: [
    path.join(promptsDir, 'custom', 'security', 'vulnerability-scan.md'),
    path.join(promptsDir, 'custom', 'security', 'dependency-check.md'),
    path.join(promptsDir, 'custom', 'security', 'final-report.md')
  ]
}
```

### 2. Adding Sub-Agents

Edit `config/sub.agents.js` for specialized expertise:

```javascript
{
  id: 'performance-optimizer',
  name: 'Performance Optimizer',
  description: 'Specializes in code performance optimization and profiling',
  mirrorPath: 'prompts/templates/custom/sub-agents/performance-optimizer.md'
},
{
  id: 'accessibility-expert',
  name: 'Accessibility Expert',
  description: 'Ensures code meets accessibility standards and best practices',
  mirrorPath: 'prompts/templates/custom/sub-agents/accessibility-expert.md'
}
```

### 3. Creating Custom Modules

Edit `config/modules.js` for special behaviors:

#### Loop Module with Custom Logic

```javascript
{
  id: 'iterative-refinement',
  name: 'Iterative Refinement',
  promptPath: 'prompts/templates/custom/workflows/iterative-refinement.md',
  behavior: {
    type: 'loop',
    action: 'stepBack',
    steps: 3,              // Go back 3 steps
    maxIterations: 15,     // Maximum 15 iterations
    skip: ['git-commit']  // Skip git commits during loops
  }
}
```

#### Trigger Module with Dynamic Agent Selection

```javascript
{
  id: 'adaptive-router',
  name: 'Adaptive Router',
  promptPath: 'prompts/templates/custom/workflows/adaptive-routing.md',
  behavior: {
    type: 'trigger',
    action: 'mainAgentCall',
    triggerAgentId: 'context-manager' // Default, can be overridden by prompt
  }
}
```

## Workflow Configuration Options

### Complete Override Reference

| Option                 | Type    | Description                     | Example                                                  |
| ---------------------- | ------- | ------------------------------- | -------------------------------------------------------- |
| `executeOnce`          | boolean | Run step only once per workflow | `true`                                                   |
| `engine`               | string  | AI engine to use                | `'claude'`, `'codex'`, `'cursor'`, `'ccr'`, `'opencode'` |
| `model`                | string  | Specific AI model               | `'gpt-5-codex'`, `'opus'`, `'gpt-4'`                     |
| `modelReasoningEffort` | string  | Reasoning depth                 | `'low'`, `'medium'`, `'high'`                            |
| `agentName`            | string  | Custom display name             | `'Senior Architect'`                                     |
| `promptPath`           | string  | Custom prompt path              | `'./prompts/custom.md'`                                  |
| `notCompletedFallback` | string  | Fallback agent ID               | `'plan-fallback'`                                        |

### Engine-Specific Recommendations

#### Claude Models (Best for: Planning, Analysis, Review)

- `opus`: Complex architecture, strategic decisions
- `sonnet`: Balanced performance for most tasks
- `haiku`: Fast, simple tasks

#### Codex Models (Best for: Code Generation)

- `gpt-5-codex`: Latest code-specialized model
- `gpt-5`: General purpose with good coding
- `gpt-4`: Stable, reliable code generation

#### Cursor (Best for: Git Operations, File Management)

- Engine-specific models, good for tool usage

#### OpenCode (Provider-Agnostic)

- Use your existing OpenCode configuration
- Examples: `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`

## Real-World Workflow Examples

### 1. E-Commerce Development Workflow

```javascript
export default {
  name: "E-Commerce Platform Workflow",
  steps: [
    resolveUI("🏗️ Architecture Phase"),
    resolveStep("init", { executeOnce: true }),
    resolveStep("principal-analyst", {
      executeOnce: true,
      engine: "claude",
      model: "opus",
    }),
    resolveStep("blueprint-orchestrator", {
      executeOnce: true,
      engine: "claude",
      model: "opus",
    }),

    resolveUI("📋 Planning & Scoping"),
    resolveStep("plan-agent", {
      executeOnce: true,
      engine: "claude",
      model: "sonnet",
    }),
    resolveStep("task-breakdown", { executeOnce: true }),

    resolveUI("🛒 Feature Development"),
    resolveStep("context-manager"),
    resolveStep("code-generation", {
      engine: "codex",
      model: "gpt-5-codex",
    }),
    resolveStep("runtime-prep", { executeOnce: true }),
    resolveStep("task-sanity-check"),

    resolveUI("🔒 Quality Assurance"),
    resolveModule("check-task", {
      loopSteps: 6,
      loopMaxIterations: 15,
      loopSkip: ["runtime-prep"],
    }),
  ],

  subAgentIds: ["founder-architect", "structural-data-architect", "behavior-architect", "ui-ux-architect", "operational-architect"],
};
```

### 2. API-First Development Workflow

```javascript
export default {
  name: "API-First Development Workflow",
  steps: [
    resolveStep("init", { executeOnce: true }),

    // API specification and design
    resolveStep("blueprint-orchestrator", {
      executeOnce: true,
      engine: "claude",
      model: "opus",
      agentName: "API Architect",
    }),

    // Implementation with code-first approach
    resolveStep("code-generation", {
      engine: "codex",
      model: "gpt-5-codex",
      agentName: "API Developer",
    }),

    // API testing and validation
    resolveStep("task-sanity-check", {
      engine: "claude",
      model: "sonnet",
      agentName: "API Tester",
    }),

    // Documentation generation
    resolveStep("runtime-prep", { executeOnce: true }),
    resolveModule("check-task", { loopSteps: 3, loopMaxIterations: 10 }),
  ],

  subAgentIds: ["founder-architect", "structural-data-architect", "behavior-architect", "operational-architect"],
};
```

### 3. Microservices Workflow with Parallel Processing

```javascript
export default {
  name: "Microservices Development Workflow",
  steps: [
    resolveStep("init", { executeOnce: true }),
    resolveStep("principal-analyst", {
      executeOnce: true,
      engine: "claude",
      model: "opus",
    }),

    // Distributed system architecture
    resolveStep("blueprint-orchestrator", {
      executeOnce: true,
      engine: "claude",
      model: "opus",
    }),

    // Individual service development
    resolveStep("code-generation", {
      engine: "codex",
      model: "gpt-5-codex",
    }),

    // Integration testing
    resolveStep("task-sanity-check", {
      engine: "claude",
      model: "sonnet",
    }),

    // Container and deployment setup
    resolveStep("runtime-prep", { executeOnce: true }),
    resolveModule("check-task", { loopSteps: 4, loopMaxIterations: 12 }),
  ],

  subAgentIds: [
    "founder-architect",
    "structural-data-architect",
    "behavior-architect",
    "operational-architect",
    // These will work in parallel on different services
  ],
};
```

## Testing and Debugging Workflows

### 1. Creating Test Workflows

Use the test workflow template for experimentation:

```javascript
// templates/workflows/my-test-workflow.js
export default {
  name: "Test Workflow",
  steps: [resolveStep("test-agent-1"), resolveStep("test-agent-2"), resolveModule("auto-loop", { loopSteps: 1, loopMaxIterations: 3 })],
  subAgentIds: [],
};
```

### 2. Workflow Validation

Run workflows in test mode first:

```bash
# Test your custom workflow
codemachine --workflow my-test-workflow

# Run with debug output
DEBUG=true codemachine --workflow my-custom-workflow
```

### 3. Common Issues and Solutions

#### Issue: Workflow Stuck in Loop

**Solution**: Check `loopMaxIterations` and ensure your loop module has proper exit conditions.

#### Issue: Agent Not Found

**Solution**: Verify agent IDs in `main.agents.js` and `sub.agents.js` match workflow references.

#### Issue: Engine Not Available

**Solution**: Ensure the specified AI engine is installed and configured in your environment.

## Best Practices

### 1. Workflow Design Principles

- **Single Responsibility**: Each agent should have one clear purpose
- **Fail Fast**: Use `notCompletedFallback` for critical steps
- **Iterative Development**: Start simple, add complexity gradually
- **Engine Optimization**: Match engines to task types

### 2. Performance Optimization

```javascript
// Good: Use appropriate engines for each task
(resolveStep("planning", { engine: "claude", model: "opus" }), resolveStep("coding", { engine: "codex", model: "gpt-5-codex" }), resolveStep("review", { engine: "claude", model: "sonnet" }));

// Avoid: Using expensive models for simple tasks
resolveStep("git-commit", { engine: "claude", model: "opus" }); // Overkill
```

### 3. Error Handling

```javascript
// Robust configuration with fallbacks
(resolveStep("plan-agent", {
  executeOnce: true,
  notCompletedFallback: "plan-fallback",
}),
  resolveModule("check-task", {
    loopSteps: 4,
    loopMaxIterations: 10, // Prevent infinite loops
    loopSkip: ["git-commit"], // Skip expensive operations in loops
  }));
```

### 4. Maintenability

- Use descriptive agent names and descriptions
- Comment complex workflow logic
- Version control your custom workflows
- Document custom prompt templates

## Conclusion

CodeMachine's workflow system is designed for maximum flexibility while maintaining simplicity. Start with the existing templates, modify incrementally, and gradually build up to complex multi-engine, parallel workflows tailored to your specific development needs.

The key is understanding that:

1. **Main agents** define the primary workflow sequence
2. **Sub-agents** provide specialized, callable expertise
3. **Modules** add dynamic behaviors like loops and triggers
4. **Workflow templates** orchestrate everything together

With these building blocks, you can create workflows ranging from simple linear processes to complex, adaptive, multi-agent systems that can handle any development challenge.
