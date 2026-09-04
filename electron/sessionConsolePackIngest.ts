import { dialog, ipcMain, net } from 'electron';

import {
  exportSessionConsolePackToDirectory,
  ingestSessionConsolePackFromBoardPath,
} from './sessionConsolePackFiles.js';
import {
  fetchHttpCapped,
  isSafePackHttpUrl,
  PACK_HTTP_MAX_BYTES,
} from '../src/utils/sessionConsolePack.js';
import { isArchitectPackSender } from '../src/utils/sessionConsolePackIpc.js';

import type { SessionConsoleCatalog } from '../src/types/sessionConsole.js';
import type { IpcMainInvokeEvent } from 'electron';

export function registerSessionConsolePackHandlers(ctx: {
  tempAssetsDir: string;
  allowedMediaRoots: string[];
  getArchitectWebContentsId: () => number | null;
}): void {
  ipcMain.handle('IMPORT_SESSION_CONSOLE_PACK', async (event: IpcMainInvokeEvent) => {
    if (!isArchitectPackSender(event.sender.id, ctx.getArchitectWebContentsId())) {
      return null;
    }
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
      fetchHttpCapped(url, PACK_HTTP_MAX_BYTES, (href) => {
        if (!isSafePackHttpUrl(href)) {
          return Promise.reject(new Error('blocked pack host'));
        }
        return net.fetch(href, { redirect: 'error' });
      }),
    );
  });

  ipcMain.handle(
    'EXPORT_SESSION_CONSOLE_PACK',
    async (event: IpcMainInvokeEvent, catalog: SessionConsoleCatalog) => {
      if (!isArchitectPackSender(event.sender.id, ctx.getArchitectWebContentsId())) {
        return false;
      }
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
