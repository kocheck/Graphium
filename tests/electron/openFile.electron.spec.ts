/**
 * OS file-open path: a .graphium file handed to Graphium by the OS opens straight
 * into the editor. On Linux/Windows the path arrives on the command line; macOS
 * Finder/Open Recent use 'open-file', which feeds the same queueOsOpenFile →
 * TAKE_PENDING_OPEN_FILE path exercised here.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { test as base, expect } from '@playwright/test';
import JSZip from 'jszip';

import { launchElectron } from '../helpers/launchElectron';

const CAMPAIGN_NAME = 'Opened From Finder';

const writeCampaignFile = async (dir: string): Promise<string> => {
  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify({
      id: 'os-open-campaign',
      name: CAMPAIGN_NAME,
      activeMapId: 'map-1',
      tokenLibrary: [],
      maps: {
        // Same shape gameStore's createDefaultMap writes into a saved campaign
        'map-1': {
          id: 'map-1',
          name: 'Crypt',
          tokens: [],
          drawings: [],
          doors: [],
          stairs: [],
          map: null,
          gridSize: 50,
          gridType: 'LINES',
          exploredRegions: [],
          isDaylightMode: false,
        },
      },
    }),
  );
  const filePath = path.join(dir, 'os-open.graphium');
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
  return filePath;
};

base.describe('Electron OS file open', () => {
  base('opens a .graphium passed by the OS directly into the editor', async () => {
    base.setTimeout(45000);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'graphium-open-'));
    const filePath = await writeCampaignFile(dir);
    const app = await launchElectron({ extraArgs: [filePath] });
    try {
      const window = await app.firstWindow();
      await expect(window.getByTestId('editor-view')).toBeVisible({ timeout: 20000 });
      await expect(window.getByText(CAMPAIGN_NAME).first()).toBeVisible();
    } finally {
      await app.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  base('launches to the home screen when no file is passed', async () => {
    const app = await launchElectron();
    try {
      const window = await app.firstWindow();
      await expect(window.getByTestId('new-campaign-button')).toBeVisible({ timeout: 20000 });
    } finally {
      await app.close();
    }
  });
});
