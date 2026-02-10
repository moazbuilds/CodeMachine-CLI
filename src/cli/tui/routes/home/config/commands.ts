/**
 * Home Command Configuration
 *
 * Command definitions and utility functions for the home view.
 */

import * as path from "node:path"
import { VERSION } from "../../../../../runtime/version.js"

/**
 * Get the application version
 */
export function getVersion(): string {
  return VERSION
}

/**
 * Get the specification file path
 * Shows relative path if in current directory, otherwise full path
 */
export function getSpecPath(): string {
  const cwd = process.env.CODEMACHINE_CWD || process.cwd()
  const fullPath = path.join(cwd, ".codemachine", "inputs", "specifications.md")
  const relativePath = path.relative(process.cwd(), fullPath)
  return relativePath.startsWith("..") ? fullPath : relativePath
}

/**
 * Get the absolute specification file path
 */
export function getAbsoluteSpecPath(): string {
  const cwd = process.env.CODEMACHINE_CWD || process.cwd()
  return path.join(cwd, ".codemachine", "inputs", "specifications.md")
}

/**
 * Available commands in the home view
 */
export const HOME_COMMANDS = {
  START: "/start",
  TEMPLATES: "/templates",
  TEMPLATE: "/template",
  LOGIN: "/login",
  LOGOUT: "/logout",
  IMPORT: "/import",
  EXPORT: "/export",
  EXIT: "/exit",
  QUIT: "/quit",
} as const

/**
 * Command definitions for help display
 */
export const COMMAND_HELP = [
  { command: "start", description: "Start workflow with current template" },
  { command: "templates", description: "Select and configure workflow templates" },
  { command: "login", description: "Authenticate with AI providers" },
] as const
