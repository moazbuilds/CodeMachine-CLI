import chalk from 'chalk';

type ColorizeFn = (input: string) => string;

type AgentLogger = (chunk: string) => void;

const passthrough: ColorizeFn = (input) => input;

const hasTty = Boolean(process.stdout.isTTY || process.stderr.isTTY);
const supportsColor = hasTty && (chalk.level ?? 0) > 0;

const COLOR_PALETTE: ColorizeFn[] = supportsColor
  ? [
      chalk.greenBright,
      chalk.yellowBright,
      chalk.cyanBright,
      chalk.magentaBright,
      chalk.blueBright,
      chalk.green,
      chalk.yellow,
      chalk.blue,
      chalk.magenta,
      chalk.cyan,
      chalk.white,
      chalk.whiteBright,
      chalk.gray,
      chalk.hex('#00CED1'), // DarkTurquoise
      chalk.hex('#9370DB'), // MediumPurple
      chalk.hex('#3CB371'), // MediumSeaGreen
      chalk.hex('#FFD700'), // Gold
      chalk.hex('#BA55D3'), // MediumOrchid
      chalk.hex('#20B2AA'), // LightSeaGreen
    ]
  : [passthrough];

const agentColorAssignments = new Map<string, ColorizeFn>();

function getColorizer(agentId: string): ColorizeFn {
  if (agentColorAssignments.has(agentId)) {
    return agentColorAssignments.get(agentId)!;
  }
  const paletteIndex = agentColorAssignments.size % COLOR_PALETTE.length;
  const colorFn = COLOR_PALETTE[paletteIndex] ?? passthrough;
  agentColorAssignments.set(agentId, colorFn);
  return colorFn;
}

function writeSafely(stream: NodeJS.WriteStream, text: string): void {
  try {
    stream.write(text);
  } catch {
    // Suppress stream errors to avoid crashing the workflow runner
  }
}

export function getAgentLoggers(agentId: string): { stdout: AgentLogger; stderr: AgentLogger } {
  const colorize = getColorizer(agentId);
  return {
    stdout(chunk: string) {
      writeSafely(process.stdout, colorize(chunk));
    },
    stderr(chunk: string) {
      writeSafely(process.stderr, colorize(chunk));
    },
  };
}

export function formatAgentLog(agentId: string, message: string): string {
  const colorize = getColorizer(agentId);
  return colorize(message);
}
