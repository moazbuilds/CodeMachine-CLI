import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getResumeStartIndex,
  markStepStarted,
  removeFromNotCompleted,
  initStepSession,
  updateStepDuration,
  updateStepTelemetry,
  getStepDuration,
  getStepTelemetry,
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

  describe('duration accumulation', () => {
    it('accumulates duration across multiple calls', async () => {
      // First initialize a step session
      await initStepSession(testDir, 0, 'session-1', 100);

      // First duration update
      await updateStepDuration(testDir, 0, 5000);
      expect(await getStepDuration(testDir, 0)).toBe(5000);

      // Second duration update (should accumulate)
      await updateStepDuration(testDir, 0, 3000);
      expect(await getStepDuration(testDir, 0)).toBe(8000);

      // Third duration update
      await updateStepDuration(testDir, 0, 2000);
      expect(await getStepDuration(testDir, 0)).toBe(10000);
    });

    it('returns 0 for non-existent step duration', async () => {
      const result = await getStepDuration(testDir, 99);
      expect(result).toBe(0);
    });

    it('returns 0 when tracking file does not exist', async () => {
      // Use a non-existent directory
      const nonExistentDir = join(process.cwd(), '.non-existent-test');
      const result = await getStepDuration(nonExistentDir, 0);
      expect(result).toBe(0);
    });

    it('does not update duration for non-existent step', async () => {
      // Try to update a step that was never initialized
      await updateStepDuration(testDir, 5, 1000);
      // Should return 0 since step 5 doesn't exist
      const result = await getStepDuration(testDir, 5);
      expect(result).toBe(0);
    });
  });

  describe('telemetry accumulation', () => {
    it('accumulates telemetry across multiple calls', async () => {
      await initStepSession(testDir, 0, 'session-1', 100);

      // First telemetry update
      await updateStepTelemetry(testDir, 0, {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      });

      let telemetry = await getStepTelemetry(testDir, 0);
      expect(telemetry).toEqual({
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
        cached: 0,
      });

      // Second telemetry update (should accumulate)
      await updateStepTelemetry(testDir, 0, {
        tokensIn: 200,
        tokensOut: 100,
        cost: 0.02,
        cached: 50,
      });

      telemetry = await getStepTelemetry(testDir, 0);
      expect(telemetry).toEqual({
        tokensIn: 300,
        tokensOut: 150,
        cost: 0.03,
        cached: 50,
      });
    });

    it('returns null for non-existent step telemetry', async () => {
      const result = await getStepTelemetry(testDir, 99);
      expect(result).toBeNull();
    });

    it('returns null when tracking file does not exist', async () => {
      const nonExistentDir = join(process.cwd(), '.non-existent-test');
      const result = await getStepTelemetry(nonExistentDir, 0);
      expect(result).toBeNull();
    });

    it('handles cached field correctly', async () => {
      await initStepSession(testDir, 0, 'session-1', 100);

      // First update without cached
      await updateStepTelemetry(testDir, 0, {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      });

      // Second update with cached
      await updateStepTelemetry(testDir, 0, {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
        cached: 25,
      });

      const telemetry = await getStepTelemetry(testDir, 0);
      expect(telemetry?.cached).toBe(25);
    });

    it('does not update telemetry for non-existent step', async () => {
      await updateStepTelemetry(testDir, 5, {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      });
      const result = await getStepTelemetry(testDir, 5);
      expect(result).toBeNull();
    });
  });

  describe('duration and telemetry together', () => {
    it('tracks both duration and telemetry for the same step', async () => {
      await initStepSession(testDir, 0, 'session-1', 100);

      // Update both
      await updateStepDuration(testDir, 0, 5000);
      await updateStepTelemetry(testDir, 0, {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      });

      // Verify both are tracked independently
      expect(await getStepDuration(testDir, 0)).toBe(5000);
      expect(await getStepTelemetry(testDir, 0)).toEqual({
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
        cached: 0,
      });

      // Update both again
      await updateStepDuration(testDir, 0, 3000);
      await updateStepTelemetry(testDir, 0, {
        tokensIn: 200,
        tokensOut: 100,
        cost: 0.02,
      });

      // Verify accumulation
      expect(await getStepDuration(testDir, 0)).toBe(8000);
      expect(await getStepTelemetry(testDir, 0)).toEqual({
        tokensIn: 300,
        tokensOut: 150,
        cost: 0.03,
        cached: 0,
      });
    });

    it('tracks multiple steps independently', async () => {
      await initStepSession(testDir, 0, 'session-0', 100);
      await initStepSession(testDir, 1, 'session-1', 101);

      // Update step 0
      await updateStepDuration(testDir, 0, 1000);
      await updateStepTelemetry(testDir, 0, { tokensIn: 10, tokensOut: 5, cost: 0.001 });

      // Update step 1
      await updateStepDuration(testDir, 1, 2000);
      await updateStepTelemetry(testDir, 1, { tokensIn: 20, tokensOut: 10, cost: 0.002 });

      // Verify independence
      expect(await getStepDuration(testDir, 0)).toBe(1000);
      expect(await getStepDuration(testDir, 1)).toBe(2000);

      const telemetry0 = await getStepTelemetry(testDir, 0);
      const telemetry1 = await getStepTelemetry(testDir, 1);

      expect(telemetry0?.tokensIn).toBe(10);
      expect(telemetry1?.tokensIn).toBe(20);
    });
  });
});
