import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getResumeStartIndex,
  markStepStarted,
  removeFromNotCompleted,
} from '../../../src/shared/workflows/steps.js';

describe('workflow step tracking', () => {
  const testDir = join(process.cwd(), '.test-codemachine');

  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('getResumeStartIndex', () => {
    it('returns 0 when tracking file does not exist', async () => {
      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(0);
    });

    it('returns 0 when resumeFromLastStep is false', async () => {
      const trackingPath = join(testDir, 'template.json');
      writeFileSync(
        trackingPath,
        JSON.stringify({
          activeTemplate: 'test.workflow.js',
          lastUpdated: new Date().toISOString(),
          notCompletedSteps: [0, 2, 5],
          resumeFromLastStep: false,
        }),
      );

      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(0);
    });

    it('returns 0 when resumeFromLastStep is not set', async () => {
      const trackingPath = join(testDir, 'template.json');
      writeFileSync(
        trackingPath,
        JSON.stringify({
          activeTemplate: 'test.workflow.js',
          lastUpdated: new Date().toISOString(),
          notCompletedSteps: [0, 2, 5],
        }),
      );

      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(0);
    });

    it('returns 0 when notCompletedSteps is empty and resumeFromLastStep is true', async () => {
      const trackingPath = join(testDir, 'template.json');
      writeFileSync(
        trackingPath,
        JSON.stringify({
          activeTemplate: 'test.workflow.js',
          lastUpdated: new Date().toISOString(),
          notCompletedSteps: [],
          resumeFromLastStep: true,
        }),
      );

      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(0);
    });

    it('returns the first (lowest) step index from notCompletedSteps when resumeFromLastStep is true', async () => {
      const trackingPath = join(testDir, 'template.json');
      writeFileSync(
        trackingPath,
        JSON.stringify({
          activeTemplate: 'test.workflow.js',
          lastUpdated: new Date().toISOString(),
          notCompletedSteps: [0, 2, 5],
          resumeFromLastStep: true,
        }),
      );

      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(0);
    });

    it('returns the correct index when notCompletedSteps has only one element', async () => {
      const trackingPath = join(testDir, 'template.json');
      writeFileSync(
        trackingPath,
        JSON.stringify({
          activeTemplate: 'test.workflow.js',
          lastUpdated: new Date().toISOString(),
          notCompletedSteps: [3],
          resumeFromLastStep: true,
        }),
      );

      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(3);
    });

    it('returns the correct index when notCompletedSteps is not sorted', async () => {
      const trackingPath = join(testDir, 'template.json');
      writeFileSync(
        trackingPath,
        JSON.stringify({
          activeTemplate: 'test.workflow.js',
          lastUpdated: new Date().toISOString(),
          notCompletedSteps: [7, 1, 4, 2],
          resumeFromLastStep: true,
        }),
      );

      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(1);
    });

    it('handles corrupted tracking file gracefully', async () => {
      const trackingPath = join(testDir, 'template.json');
      writeFileSync(trackingPath, 'invalid json content');

      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(0);
    });
  });

  describe('integration with step tracking', () => {
    it('correctly resumes after marking steps as started and some completed', async () => {
      // Mark multiple steps as started
      await markStepStarted(testDir, 0);
      await markStepStarted(testDir, 1);
      await markStepStarted(testDir, 2);

      // Complete some steps
      await removeFromNotCompleted(testDir, 0);
      await removeFromNotCompleted(testDir, 1);

      // Enable resume feature
      const trackingPath = join(testDir, 'template.json');
      const content = JSON.parse(
        readFileSync(trackingPath, 'utf8'),
      );
      content.resumeFromLastStep = true;
      writeFileSync(trackingPath, JSON.stringify(content));

      // Should resume from step 2 (the first/only incomplete step)
      const result = await getResumeStartIndex(testDir);
      expect(result).toBe(2);
    });
  });
});
