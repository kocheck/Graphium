import { dialog, ipcMain, net } from 'electron';

import {
  exportSessionConsolePackToDirectory,
  ingestSessionConsolePackFromBoardPath,
} from './sessionConsolePackFiles.js';
import { fetchHttpCapped, PACK_HTTP_MAX_BYTES } from '../src/utils/sessionConsolePack.js';

import type { SessionConsoleCatalog } from '../src/types/sessionConsole.js';
import type { IpcMainInvokeEvent } from 'electron';

export function registerSessionConsolePackHandlers(ctx: {
  tempAssetsDir: string;
  allowedMediaRoots: string[];
}): void {
  ipcMain.handle('IMPORT_SESSION_CONSOLE_PACK', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Session Console board pack',
      properties: ['openFile'],
      filters: [{ name: 'Board pack', extensions: ['json'] }],
    });
    const boardPath = filePaths[0];
    if (canceled || !boardPath) {
      return null;
    }
    return ingestSessionConsolePackFromBoardPath(boardPath, ctx.tempAssetsDir, (url) =>
      fetchHttpCapped(url, PACK_HTTP_MAX_BYTES, (href) => net.fetch(href)),
    );
  });

  ipcMain.handle(
    'EXPORT_SESSION_CONSOLE_PACK',
    async (_event: IpcMainInvokeEvent, catalog: SessionConsoleCatalog) => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Export Session Console board pack',
        properties: ['openDirectory', 'createDirectory'],
      });
      const destDir = filePaths[0];
      if (canceled || !destDir) {
        return false;
      }
      return exportSessionConsolePackToDirectory(catalog, destDir, ctx.allowedMediaRoots);
    },
  );
}
