export default {
  name: 'Test Workflow',
  controller: true,
  tracks: {
    question: 'What type of project workflow do you want?',
    options: {
      quick: {
        label: 'Small Project',
        description: 'Fast iteration, minimal documentation'
      },
      bmad: {
        label: 'Enterprise',
        description: 'Full BMAD methodology with all phases'
      },
    },
  },
  conditionGroups: [
    // Group 1: Tech stack (shown for ALL tracks, single-select with children)
    {
      id: 'tech_stack',
      question: 'What is your preferred tech stack?',
      multiSelect: false,  // Radio buttons - single select
      conditions: {
        python: {
          label: 'Python',
          description: 'Python ecosystem (Django, Flask, FastAPI)'
        },
        javascript: {
          label: 'JavaScript/TypeScript',
          description: 'Node.js, Bun, Deno ecosystem'
        },
      },
      children: {
        python: {
          question: 'Which Python framework do you prefer?',
          multiSelect: false,
          conditions: {
            django: { label: 'Django', description: 'Full-featured web framework' },
            flask: { label: 'Flask', description: 'Lightweight microframework' },
            fastapi: { label: 'FastAPI', description: 'Modern async API framework' },
          }
        },
        javascript: {
          question: 'Which JavaScript runtime do you prefer?',
          multiSelect: false,
          conditions: {
            node: { label: 'Node.js', description: 'Traditional runtime' },
            bun: { label: 'Bun', description: 'Fast all-in-one toolkit' },
            deno: { label: 'Deno', description: 'Secure runtime with TypeScript' },
          }
        }
      }
    },

    // Group 2: Project features (shown for ALL tracks, multi-select with children)
    {
      id: 'features',
      question: 'What features does your project have?',
      multiSelect: true,  // Checkboxes - can select multiple
      conditions: {
        has_ui: {
          label: 'Has UI',
          description: 'Project includes a user interface'
        },
        has_api: {
          label: 'Has API',
          description: 'Project includes backend API'
        },
        has_db: {
          label: 'Has Database',
          description: 'Project requires data persistence'
        },
      },
      children: {
        has_ui: {
          question: 'What is your preferred UI framework?',
          multiSelect: false,
          conditions: {
            react: { label: 'React', description: 'Component-based library' },
            solidjs: { label: 'SolidJS', description: 'Fine-grained reactivity' },
            vue: { label: 'Vue', description: 'Progressive framework' },
            svelte: { label: 'Svelte', description: 'Compile-time framework' },
          }
        },
        has_api: {
          question: 'What API style do you prefer?',
          multiSelect: false,
          conditions: {
            rest: { label: 'REST API', description: 'Traditional HTTP endpoints' },
            graphql: { label: 'GraphQL', description: 'Query language for APIs' },
            trpc: { label: 'tRPC', description: 'End-to-end typesafe APIs' },
          }
        },
        has_db: {
          question: 'What database type do you prefer?',
          multiSelect: false,
          conditions: {
            postgresql: { label: 'PostgreSQL', description: 'Relational database' },
            mongodb: { label: 'MongoDB', description: 'Document database' },
            sqlite: { label: 'SQLite', description: 'Embedded database' },
          }
        }
      }
    },

    // Group 3: Enterprise features (ONLY shown for 'bmad' track)
    {
      id: 'enterprise',
      question: 'What enterprise features do you need?',
      multiSelect: true,
      tracks: ['bmad'],  // Only shown when 'bmad' track is selected
      conditions: {
        monitoring: {
          label: 'Monitoring & Observability',
          description: 'Logging, metrics, and tracing'
        },
        sso: {
          label: 'SSO Integration',
          description: 'Single Sign-On with enterprise providers'
        },
        compliance: {
          label: 'Compliance',
          description: 'SOC2, HIPAA, or GDPR compliance'
        },
      },
      children: {
        monitoring: {
          question: 'Which observability stack do you prefer?',
          multiSelect: false,
          conditions: {
            datadog: { label: 'Datadog', description: 'Full observability platform' },
            grafana: { label: 'Grafana Stack', description: 'Open source monitoring' },
            newrelic: { label: 'New Relic', description: 'APM and monitoring' },
          }
        },
        sso: {
          question: 'Which SSO provider will you use?',
          multiSelect: false,
          conditions: {
            okta: { label: 'Okta', description: 'Enterprise identity provider' },
            auth0: { label: 'Auth0', description: 'Flexible authentication' },
            azure_ad: { label: 'Azure AD', description: 'Microsoft identity platform' },
          }
        }
      }
    },

    // Group 4: Quick start options (ONLY shown for 'quick' track)
    {
      id: 'quick_options',
      question: 'What quick start template do you want?',
      multiSelect: false,
      tracks: ['quick'],  // Only shown when 'quick' track is selected
      conditions: {
        starter: {
          label: 'Starter Template',
          description: 'Basic project structure'
        },
        crud: {
          label: 'CRUD App',
          description: 'Full CRUD operations template'
        },
        api_only: {
          label: 'API Only',
          description: 'Headless API service'
        },
      },
    },
  ],
  steps: [
    // No filtering - always runs
    resolveStep('test-agent-1'),

    // Track filtering only
    resolveStep('test-agent-2', { tracks: ['bmad'] }),
    resolveStep('test-agent-3', { tracks: ['quick'] }),

    // Condition filtering - top-level
    resolveStep('test-agent-1', { conditions: ['python'] }),
    resolveStep('test-agent-2', { conditions: ['javascript'] }),
    resolveStep('test-agent-3', { conditions: ['has_ui'] }),

    // Condition filtering - child conditions
    resolveStep('test-agent-1', { conditions: ['django'] }),
    resolveStep('test-agent-2', { conditions: ['react'] }),
    resolveStep('test-agent-3', { conditions: ['postgresql'] }),

    // Combined track + condition
    resolveStep('test-agent-1', { tracks: ['quick'], conditions: ['has_ui', 'react'] }),
    resolveStep('test-agent-2', { tracks: ['bmad'], conditions: ['monitoring', 'datadog'] }),
    resolveStep('test-agent-3', { tracks: ['bmad'], conditions: ['has_api', 'rest'] }),

    // Multiple conditions (AND logic)
    resolveStep('test-agent-1', { conditions: ['python', 'has_ui', 'has_db'] }),
    resolveStep('test-agent-2', { conditions: ['javascript', 'has_api'] }),

    // Human review checkpoint
    separator("❚❚ Human Review"),

    // Module with conditions
    resolveModule('auto-loop', { loopSteps: 3, loopMaxIterations: 5, conditions: ['has_api'] }),
  ],
  subAgentIds: ['frontend-dev'],
};
