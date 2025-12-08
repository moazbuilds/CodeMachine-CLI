/**
 * Home Route - Re-export
 *
 * Entry point for the home route module.
 */

export { HomeView as Home, type HomeViewProps } from "./home-view"
export { useHomeCommands } from "./hooks/use-home-commands"
export { getVersion, getSpecPath, HOME_COMMANDS, COMMAND_HELP } from "./config/commands"
