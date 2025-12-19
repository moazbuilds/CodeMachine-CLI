/**
 * Presentation Features Module
 *
 * Feature-based organization for the TUI presentation layer.
 * Each feature is a self-contained module with its own components, hooks, and types.
 *
 * Feature Module Structure:
 * ```
 * features/
 * ├── home/           # Home/landing feature
 * ├── workflow/       # Workflow execution feature
 * ├── onboarding/     # Onboarding flow feature
 * └── shared/         # Shared components and utilities
 * ```
 *
 * Each feature module contains:
 * - components/       - UI components specific to the feature
 * - hooks/            - Feature-specific hooks
 * - types.ts          - TypeScript types for the feature
 * - index.tsx         - Feature entry point
 */

// Feature modules
export * from './home'
export * from './workflow'
export * from './onboarding'
export * from './shared'
