/**
 * Default packages that ship with CodeMachine.
 *
 * These are auto-imported on first run and checked for updates in the background.
 */

export interface DefaultPackage {
  /** Package name to match in registry (e.g., "ali-workflow") */
  name: string;
  /** GitHub owner/repo or full URL */
  source: string;
  /** If true, must be installed for CLI to function */
  required: boolean;
  /** Raw URL to fetch codemachine.json for version check */
  manifestUrl: string;
}

export const DEFAULT_PACKAGES: DefaultPackage[] = [
  {
    name: 'ali-workflow',
    source: 'codemachine-ai/ali-workflow',
    required: true,
    manifestUrl:
      'https://raw.githubusercontent.com/codemachine-ai/ali-workflow/main/codemachine.json',
  },
  // Add more default packages here as needed
];
