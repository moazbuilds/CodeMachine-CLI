/**
 * GitHub Copilot API Configuration
 *
 * These endpoints and client ID are based on the official Copilot IDE plugins.
 * The device code flow is the same authentication mechanism used by VS Code and IntelliJ.
 */

/** GitHub OAuth App Client ID (official Copilot client) */
export const COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';

/** GitHub device code endpoint */
export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';

/** GitHub OAuth token endpoint */
export const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/** Copilot token exchange endpoint */
export const COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';

/** Copilot chat completions API */
export const COPILOT_API_URL = 'https://api.githubcopilot.com/chat/completions';

/** OAuth scope needed for Copilot */
export const OAUTH_SCOPE = 'read:user';

/** Available models via Copilot API */
export const AVAILABLE_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o1-mini',
  'o3-mini',
  'claude-3.5-sonnet',
] as const;

export type CopilotModel = (typeof AVAILABLE_MODELS)[number];

/** Environment variable names */
export const ENV = {
  COPILOT_TOKEN: 'COPILOT_TOKEN',
  GITHUB_TOKEN: 'GITHUB_TOKEN',
} as const;
