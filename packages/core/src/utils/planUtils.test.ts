/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';
import { validatePlanPath, validatePlanContent } from './planUtils.js';

describe('planUtils', () => {
  let tempRootDir: string;
  let plansDir: string;

  beforeEach(() => {
    tempRootDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'planUtils-test-')),
    );
    const plansDirRaw = path.join(tempRootDir, 'plans');
    fs.mkdirSync(plansDirRaw, { recursive: true });
    plansDir = fs.realpathSync(plansDirRaw);
  });

  afterEach(() => {
    if (fs.existsSync(tempRootDir)) {
      fs.rmSync(tempRootDir, { recursive: true, force: true });
    }
  });

  describe('validatePlanPath', () => {
    it('should return null for a valid path within plans directory', async () => {
      const planPath = path.join('plans', 'test.md');
      const fullPath = path.join(tempRootDir, planPath);
      fs.writeFileSync(fullPath, '# My Plan');

      const result = await validatePlanPath(planPath, plansDir, tempRootDir);
      expect(result).toBeNull();
    });

    it('should return null for a valid path outside plans directory but within project root', async () => {
      const planPath = 'root-plan.md';
      const fullPath = path.join(tempRootDir, planPath);
      fs.writeFileSync(fullPath, '# My Plan');

      const result = await validatePlanPath(planPath, plansDir, tempRootDir);
      expect(result).toBeNull();
    });

    it('should return error for path traversal', async () => {
      const planPath = path.join('..', 'secret.txt');
      const result = await validatePlanPath(planPath, plansDir, tempRootDir);
      expect(result).toContain('Access denied');
    });

    it('should return error for non-existent file', async () => {
      const planPath = path.join('plans', 'ghost.md');
      const result = await validatePlanPath(planPath, plansDir, tempRootDir);
      expect(result).toContain('Plan file does not exist');
    });

    it('should detect path traversal via symbolic links', async () => {
      const maliciousPath = path.join('plans', 'malicious.md');
      const fullMaliciousPath = path.join(tempRootDir, maliciousPath);

      // Create a file totally outside the project root
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
      const outsideFile = path.join(outsideDir, 'secret.txt');
      fs.writeFileSync(outsideFile, 'secret content');

      // Create a symbolic link pointing outside the project root
      fs.symlinkSync(outsideFile, fullMaliciousPath);

      const result = await validatePlanPath(
        maliciousPath,
        plansDir,
        tempRootDir,
      );

      // Clean up outside dir
      fs.rmSync(outsideDir, { recursive: true, force: true });

      expect(result).toContain('Access denied');
    });
  });

  describe('validatePlanContent', () => {
    it('should return null for non-empty content', async () => {
      const planPath = path.join(plansDir, 'full.md');
      fs.writeFileSync(planPath, 'some content');
      const result = await validatePlanContent(planPath);
      expect(result).toBeNull();
    });

    it('should return error for empty content', async () => {
      const planPath = path.join(plansDir, 'empty.md');
      fs.writeFileSync(planPath, '   ');
      const result = await validatePlanContent(planPath);
      expect(result).toContain('Plan file is empty');
    });

    it('should return error for unreadable file', async () => {
      const planPath = path.join(plansDir, 'ghost.md');
      const result = await validatePlanContent(planPath);
      // Since isEmpty treats unreadable files as empty (defensive),
      // we expect the "Plan file is empty" message.
      expect(result).toContain('Plan file is empty');
    });

    it('should return null for non-empty directory', async () => {
      const planDirPath = path.join(plansDir, 'my-plan-dir');
      fs.mkdirSync(planDirPath, { recursive: true });
      fs.writeFileSync(path.join(planDirPath, 'plan.md'), '# Content');

      const result = await validatePlanContent(planDirPath);
      expect(result).toBeNull();
    });

    it('should return error for empty directory', async () => {
      const planDirPath = path.join(plansDir, 'empty-dir');
      fs.mkdirSync(planDirPath, { recursive: true });

      const result = await validatePlanContent(planDirPath);
      expect(result).toContain('Plan directory is empty');
    });
  });
});
