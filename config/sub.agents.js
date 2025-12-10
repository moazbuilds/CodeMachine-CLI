module.exports = [

  // codemachine-workflow sub-agents
  {
    id: 'founder-architect',
    name: 'Founder Architect',
    description: 'Handle foundational architecture tasks',
    mirrorPath: 'prompts/templates/codemachine/sub-agents/architecture/01-founder-architect.md',
  },
  {
    id: 'structural-data-architect',
    name: 'Structural & Data Architect',
    description: 'Define the static structure of the system, components hierarchy, and data organization',
    mirrorPath: 'prompts/templates/codemachine/sub-agents/architecture/02-structural-data-architect.md',
  },
  {
    id: 'behavior-architect',
    name: 'Behavior & Communication Architect',
    description: 'Define dynamic interactions, data flows, and communication patterns between components',
    mirrorPath: 'prompts/templates/codemachine/sub-agents/architecture/03-behavior-architect.md',
  },
  {
    id: 'operational-architect',
    name: 'Operational & Documentation Architect',
    description: 'Handle deployment, operations, security, and documentation architecture',
    mirrorPath: 'prompts/templates/codemachine/sub-agents/architecture/04-operational-architect.md',
  },
  {
    id: 'ui-ux-architect',
    name: 'UI/UX & Interface Architect',
    description: 'Define user interface architecture, design systems, component hierarchies, and user experience patterns',
    mirrorPath: 'prompts/templates/codemachine/sub-agents/architecture/05-ui-ux-architect.md',
  },
  {
    id: 'file-assembler',
    name: 'File Assembler',
    description: 'Execute commands and create manifest files from architecture outputs',
    mirrorPath: 'prompts/templates/codemachine/sub-agents/architecture/06-file-assembler.md',
  }
];
