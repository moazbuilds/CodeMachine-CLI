import { AgentMonitorService, type AgentTreeNode, type AgentRecord } from '../../../agents/monitoring/index.js';
import chalk from 'chalk';

/**
 * Display all agents in a hierarchical tree view
 */
export function listAgents(): void {
  const monitor = AgentMonitorService.getInstance();

  const activeAgents = monitor.getActiveAgents();
  const offlineAgents = monitor.getOfflineAgents();
  const fullTree = monitor.buildAgentTree();
  let activeTrees = filterAgentTrees(fullTree, agent => agent.status === 'running');
  let offlineTrees = filterAgentTrees(fullTree, agent => agent.status !== 'running');

  if (activeAgents.length > 0 && activeTrees.length === 0) {
    activeTrees = activeAgents.map<AgentTreeNode>(agent => ({
      agent,
      children: [] as AgentTreeNode[]
    }));
  }

  if (offlineAgents.length > 0 && offlineTrees.length === 0) {
    offlineTrees = offlineAgents.map<AgentTreeNode>(agent => ({
      agent,
      children: [] as AgentTreeNode[]
    }));
  }

  console.log('');

  // Active agents section
  if (activeAgents.length > 0 && activeTrees.length > 0) {
    console.log(chalk.bold.green(`ACTIVE AGENTS (${activeAgents.length} running)`));

    activeTrees.forEach((tree, index) => {
      printTreeNode(tree, '', index === activeTrees.length - 1, 'active');
    });

    console.log('');
  }

  // Offline agents section
  if (offlineAgents.length > 0 && offlineTrees.length > 0) {
    console.log(chalk.bold.gray(`OFFLINE AGENTS (${offlineAgents.length} terminated)`));

    offlineTrees.forEach((tree, index) => {
      printTreeNode(tree, '', index === offlineTrees.length - 1, 'offline');
    });

    console.log('');
  }

  // Summary
  const total = activeAgents.length + offlineAgents.length;
  console.log(chalk.dim('─'.repeat(60)));
  console.log(chalk.dim(`Total: ${total} agents (${activeAgents.length} active, ${offlineAgents.length} offline)`));
  console.log('');
}

function filterAgentTrees(
  tree: AgentTreeNode[],
  predicate: (agent: AgentRecord) => boolean
): AgentTreeNode[] {
  return tree.flatMap(node => filterAgentTree(node, predicate));
}

function filterAgentTree(
  node: AgentTreeNode,
  predicate: (agent: AgentRecord) => boolean
): AgentTreeNode[] {
  const matchingChildren = node.children.flatMap(child => filterAgentTree(child, predicate));
  const matchesSelf = predicate(node.agent);

  if (!matchesSelf) {
    return matchingChildren;
  }

  return [
    {
      agent: node.agent,
      children: matchingChildren
    }
  ];
}

/**
 * Print a tree node with proper indentation and connectors
 */
function printTreeNode(
  node: AgentTreeNode,
  prefix: string,
  isLast: boolean,
  mode: 'active' | 'offline'
): void {
  const { agent } = node;
  const connector = isLast ? '└─' : '├─';
  const tag = agent.parentId ? chalk.cyan('[SUB]') : chalk.magenta('[MAIN]');

  const statusText = formatStatus(agent);

  console.log(`${prefix}${connector} ${tag} ${chalk.bold(agent.name)}`);
  const idLine = buildIdLine(agent, statusText, mode);
  console.log(`${prefix}${isLast ? ' ' : '│'}   ${idLine}`);

  if (agent.prompt.length > 60) {
    console.log(`${prefix}${isLast ? ' ' : '│'}   ${chalk.dim('Prompt:')} ${agent.prompt.substring(0, 57)}...`);
  } else {
    console.log(`${prefix}${isLast ? ' ' : '│'}   ${chalk.dim('Prompt:')} ${agent.prompt}`);
  }

  if (mode === 'offline') {
    console.log(
      `${prefix}${isLast ? ' ' : '│'}   ${chalk.dim('Ran:')} ${formatRunRange(agent)}`
    );

    if (agent.error) {
      console.log(`${prefix}${isLast ? ' ' : '│'}   ${chalk.red('Error:')} ${agent.error}`);
    }
  }

  // Print children
  if (node.children.length > 0) {
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child, index) => {
      printTreeNode(child, childPrefix, index === node.children.length - 1, mode);
    });
  }
}

function buildIdLine(agent: AgentRecord, statusText: string, mode: 'active' | 'offline'): string {
  const segments = [
    `${chalk.dim('ID:')} ${agent.id}`,
    `${chalk.dim('Status:')} ${statusText}`
  ];

  if (mode === 'active') {
    const uptime = formatDuration(Date.now() - new Date(agent.startTime).getTime());
    segments.push(`${chalk.dim('Uptime:')} ${uptime}`);
  } else {
    const durationText = formatAgentDuration(agent);
    segments.push(`${chalk.dim('Duration:')} ${durationText}`);
  }

  return segments.join(` ${chalk.dim('|')} `);
}

function formatStatus(agent: AgentRecord): string {
  switch (agent.status) {
    case 'running':
      return chalk.green('Running');
    case 'completed':
      return chalk.green('Completed');
    case 'failed':
      return chalk.red('Failed');
    default:
      return chalk.gray(agent.status);
  }
}

function formatAgentDuration(agent: AgentRecord): string {
  if (agent.status === 'running') {
    return formatDuration(Date.now() - new Date(agent.startTime).getTime());
  }

  if (typeof agent.duration === 'number') {
    return formatDuration(agent.duration);
  }

  if (agent.endTime) {
    const start = new Date(agent.startTime).getTime();
    const end = new Date(agent.endTime).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return formatDuration(end - start);
    }
  }

  return 'N/A';
}

function formatRunRange(agent: AgentRecord): string {
  const start = formatTimestamp(agent.startTime);
  const end = agent.endTime ? formatTimestamp(agent.endTime) : 'N/A';
  return `${start} → ${end}`;
}

function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) {
    return 'N/A';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
