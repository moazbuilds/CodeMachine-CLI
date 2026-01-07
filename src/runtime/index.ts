#!/usr/bin/env bun
// Import resource manifest to embed files in compiled binary
import '../shared/runtime/resource-manifest.js';

export { runCodemachineCli } from './cli-setup.js';
export * from './services/index.js';
