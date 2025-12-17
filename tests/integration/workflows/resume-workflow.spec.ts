import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import {
  initStepSession,
  updateStepDuration,
  updateStepTelemetry,
  getStepDuration,
  getStepTelemetry,
  markChainCompleted,
  getStepData,
  getChainResumeInfo,
} from '../../../src/shared/workflows/steps.js';
import { loadChainedPrompts } from '../../../src/agents/runner/chained.js';

describe('workflow resume integration', () => {
  let tempDir: string;
  let cmRoot: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'resume-workflow-'));
    cmRoot = tempDir;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('accumulated values persistence', () => {
    it('persists and retrieves accumulated duration across sessions', async () => {
      // Simulate first session
      await initStepSession(cmRoot, 0, 'session-1', 100);
      await updateStepDuration(cmRoot, 0, 5000); // 5 seconds

      // Simulate interruption and restart
      const duration1 = await getStepDuration(cmRoot, 0);
      expect(duration1).toBe(5000);

      // Simulate second session (resume)
      await updateStepDuration(cmRoot, 0, 3000); // 3 more seconds

      // Verify accumulated
      const totalDuration = await getStepDuration(cmRoot, 0);
      expect(totalDuration).toBe(8000);
    });

    it('persists and retrieves accumulated telemetry across sessions', async () => {
      // First session
      await initStepSession(cmRoot, 0, 'session-1', 100);
      await updateStepTelemetry(cmRoot, 0, {
        tokensIn: 1000,
        tokensOut: 500,
        cost: 0.05,
        cached: 100,
      });

      // Simulate restart - read telemetry
      const telemetry1 = await getStepTelemetry(cmRoot, 0);
      expect(telemetry1?.tokensIn).toBe(1000);

      // Second session (resume) - add more
      await updateStepTelemetry(cmRoot, 0, {
        tokensIn: 500,
        tokensOut: 250,
        cost: 0.025,
        cached: 50,
      });

      // Verify accumulated
      const totalTelemetry = await getStepTelemetry(cmRoot, 0);
      expect(totalTelemetry?.tokensIn).toBe(1500);
      expect(totalTelemetry?.tokensOut).toBe(750);
      expect(totalTelemetry?.cost).toBeCloseTo(0.075, 10);
      expect(totalTelemetry?.cached).toBe(150);
    });

    it('maintains step data integrity across updates', async () => {
      await initStepSession(cmRoot, 0, 'session-123', 100);

      // Update duration
      await updateStepDuration(cmRoot, 0, 1000);

      // Update telemetry
      await updateStepTelemetry(cmRoot, 0, {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      });

      // Verify step data still has session info
      const stepData = await getStepData(cmRoot, 0);
      expect(stepData?.sessionId).toBe('session-123');
      expect(stepData?.monitoringId).toBe(100);
      expect(stepData?.accumulatedDuration).toBe(1000);
      expect(stepData?.accumulatedTelemetry?.tokensIn).toBe(100);
    });
  });

  describe('chained prompts resume', () => {
    it('tracks completed chains correctly', async () => {
      await initStepSession(cmRoot, 0, 'session-1', 100);

      // Mark chains as completed
      await markChainCompleted(cmRoot, 0, 0);
      await markChainCompleted(cmRoot, 0, 1);

      const stepData = await getStepData(cmRoot, 0);
      expect(stepData?.completedChains).toEqual([0, 1]);
    });

    it('identifies resume point from chain info', async () => {
      await initStepSession(cmRoot, 0, 'session-1', 100);

      // Complete first 2 chains
      await markChainCompleted(cmRoot, 0, 0);
      await markChainCompleted(cmRoot, 0, 1);

      // Get resume info
      const resumeInfo = await getChainResumeInfo(cmRoot);
      expect(resumeInfo).not.toBeNull();
      expect(resumeInfo?.stepIndex).toBe(0);
      expect(resumeInfo?.chainIndex).toBe(2); // Next chain to run
      expect(resumeInfo?.sessionId).toBe('session-1');
    });

    it('loads and filters chained prompts based on completed chains', async () => {
      // Create chained prompts directory
      const promptsDir = join(tempDir, 'prompts');
      await mkdir(promptsDir, { recursive: true });

      // Create 4 prompt files
      await writeFile(join(promptsDir, '01-first.md'), '---\nname: first\ndescription: First prompt\n---\nDo task 1');
      await writeFile(join(promptsDir, '02-second.md'), '---\nname: second\ndescription: Second prompt\n---\nDo task 2');
      await writeFile(join(promptsDir, '03-third.md'), '---\nname: third\ndescription: Third prompt\n---\nDo task 3');
      await writeFile(join(promptsDir, '04-fourth.md'), '---\nname: fourth\ndescription: Fourth prompt\n---\nDo task 4');

      // Load all prompts
      const allPrompts = await loadChainedPrompts(promptsDir, tempDir);
      expect(allPrompts).toHaveLength(4);

      // Simulate: chains 0 and 1 are completed
      const completedChains = new Set([0, 1]);

      // Filter remaining prompts (like runner.ts does on resume)
      const remainingPrompts = allPrompts.filter(
        (_, index) => !completedChains.has(index)
      );

      expect(remainingPrompts).toHaveLength(2);
      expect(remainingPrompts[0].name).toBe('third');
      expect(remainingPrompts[1].name).toBe('fourth');
    });
  });

  describe('resume state detection', () => {
    it('detects resumable step (has sessionId, no completedAt)', async () => {
      await initStepSession(cmRoot, 0, 'session-123', 100);

      const stepData = await getStepData(cmRoot, 0);

      // Should be resumable
      const isResuming = stepData?.sessionId && !stepData.completedAt;
      expect(isResuming).toBe(true);
    });

    it('does not resume completed step', async () => {
      await initStepSession(cmRoot, 0, 'session-123', 100);

      // Manually set completedAt (normally done by markStepCompleted)
      const trackingPath = join(cmRoot, 'template.json');
      const { readFile } = await import('node:fs/promises');
      const content = JSON.parse(await readFile(trackingPath, 'utf8'));
      content.completedSteps['0'].completedAt = new Date().toISOString();
      await writeFile(trackingPath, JSON.stringify(content, null, 2));

      const stepData = await getStepData(cmRoot, 0);

      // Should NOT be resumable
      const isResuming = stepData?.sessionId && !stepData.completedAt;
      expect(isResuming).toBe(false);
    });
  });

  describe('multi-step workflow resume', () => {
    it('handles multiple steps with different states', async () => {
      // Step 0: completed
      await initStepSession(cmRoot, 0, 'session-0', 100);
      await updateStepDuration(cmRoot, 0, 10000);
      const trackingPath = join(cmRoot, 'template.json');
      const { readFile } = await import('node:fs/promises');
      let content = JSON.parse(await readFile(trackingPath, 'utf8'));
      content.completedSteps['0'].completedAt = new Date().toISOString();
      await writeFile(trackingPath, JSON.stringify(content, null, 2));

      // Step 1: in progress (resumable)
      await initStepSession(cmRoot, 1, 'session-1', 101);
      await updateStepDuration(cmRoot, 1, 5000);
      await markChainCompleted(cmRoot, 1, 0);

      // Step 2: not started

      // Verify states
      const step0 = await getStepData(cmRoot, 0);
      const step1 = await getStepData(cmRoot, 1);
      const step2 = await getStepData(cmRoot, 2);

      expect(step0?.completedAt).toBeDefined();
      expect(step1?.sessionId).toBe('session-1');
      expect(step1?.completedAt).toBeUndefined();
      expect(step1?.completedChains).toEqual([0]);
      expect(step2).toBeNull();

      // Resume should target step 1
      const resumeInfo = await getChainResumeInfo(cmRoot);
      expect(resumeInfo?.stepIndex).toBe(1);
      expect(resumeInfo?.chainIndex).toBe(1); // Next chain after 0
    });
  });
});
