import { useState } from 'react';

import ToggleSwitch from '../ToggleSwitch';
import { DiscordSetupHelp } from './DiscordSetupHelp';
import { getStorage } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import { processImportedCatalogPlates } from '../../utils/sessionConsoleBoard';
import { sanitizeSessionConsoleErrorMessage } from '../../utils/syncUtils';

import type { SessionConsoleCatalog } from '../../types/sessionConsole';

async function importPack(): Promise<{
  catalog: SessionConsoleCatalog;
  skipped: string[];
  warnings: string[];
} | null> {
  try {
    return await getStorage().importSessionConsolePack();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pack import failed';
    useGameStore.getState().showToast(sanitizeSessionConsoleErrorMessage(message), 'error');
    return null;
  }
}

export function SessionConsoleStageFields(): JSX.Element {
  const catalog = useGameStore((state) => state.sessionConsole);
  const updateSessionConsole = useGameStore((state) => state.updateSessionConsole);

  return (
    <section className="space-y-3">
      <h3
        className="text-xs uppercase font-bold tracking-wider"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Stage
      </h3>
      <label
        className="block text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Title
        <input
          value={catalog.stage.title}
          onChange={(event) =>
            updateSessionConsole({
              type: 'UPDATE_STAGE_CHROME',
              patch: { title: event.target.value },
            })
          }
          className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
        />
      </label>
      <label
        className="block text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Subtitle
        <input
          value={catalog.stage.subtitle}
          onChange={(event) =>
            updateSessionConsole({
              type: 'UPDATE_STAGE_CHROME',
              patch: { subtitle: event.target.value },
            })
          }
          className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
        />
      </label>
      <ToggleSwitch
        checked={catalog.stage.showFrame}
        onChange={(checked) =>
          updateSessionConsole({ type: 'UPDATE_STAGE_CHROME', patch: { showFrame: checked } })
        }
        label="Show frame"
      />
    </section>
  );
}

export function SessionConsolePlaybackFields(): JSX.Element {
  const catalog = useGameStore((state) => state.sessionConsole);
  const updateSessionConsole = useGameStore((state) => state.updateSessionConsole);

  return (
    <section className="space-y-3">
      <h3
        className="text-xs uppercase font-bold tracking-wider"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Playback defaults
      </h3>
      <label
        className="block text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Default volume on load
        <input
          type="range"
          min={0}
          max={100}
          value={catalog.defaults.volume}
          onChange={(event) =>
            updateSessionConsole({
              type: 'UPDATE_DEFAULTS',
              patch: { volume: Number(event.target.value) },
            })
          }
          className="w-full mt-2"
        />
      </label>
      <label
        className="block text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Duck percent
        <input
          type="range"
          min={1}
          max={100}
          value={catalog.defaults.duckPercent}
          onChange={(event) =>
            updateSessionConsole({
              type: 'UPDATE_DEFAULTS',
              patch: { duckPercent: Number(event.target.value) },
            })
          }
          className="w-full mt-2"
        />
      </label>
    </section>
  );
}

export function SessionConsolePackFields(): JSX.Element {
  const catalog = useGameStore((state) => state.sessionConsole);
  const updateSessionConsole = useGameStore((state) => state.updateSessionConsole);
  const showConfirmDialog = useGameStore((state) => state.showConfirmDialog);
  const showToast = useGameStore((state) => state.showToast);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const applySkippedSummary = (skipped: string[], warnings: string[] = []): void => {
    const uniqueWarnings = [...new Set(warnings)];
    for (const warning of uniqueWarnings) {
      showToast(sanitizeSessionConsoleErrorMessage(warning), 'info');
    }
    const sanitized = skipped.map((item) => sanitizeSessionConsoleErrorMessage(item));
    if (sanitized.length === 0) {
      setImportSummary('Import complete.');
      return;
    }
    setImportSummary(`Skipped ${sanitized.length}: ${sanitized.join('; ')}`);
  };

  const handleImportReplace = (): void => {
    showConfirmDialog(
      'Replace the current Session Console catalog? This cannot be undone.',
      () => {
        void (async () => {
          const result = await importPack();
          if (!result) {
            return;
          }
          const imported = await processImportedCatalogPlates(result.catalog);
          updateSessionConsole({ type: 'REPLACE_CATALOG', catalog: imported });
          applySkippedSummary(result.skipped, result.warnings);
        })();
      },
      'Replace',
    );
  };

  const handleImportMerge = (): void => {
    void (async () => {
      const result = await importPack();
      if (!result) {
        return;
      }
      const catalog = await processImportedCatalogPlates(result.catalog);
      updateSessionConsole({ type: 'MERGE_CATALOG', catalog });
      applySkippedSummary(result.skipped, result.warnings);
    })();
  };

  const handleExport = (): void => {
    void (async () => {
      try {
        const result = await getStorage().exportSessionConsolePack(catalog);
        if (result === false) {
          return;
        }
        if (!result.ok) {
          showToast('Board pack export finished with errors', 'error');
          return;
        }
        showToast('Board pack exported', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Pack export failed';
        showToast(sanitizeSessionConsoleErrorMessage(message), 'error');
      }
    })();
  };

  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((open) => !open)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3
          className="text-xs uppercase font-bold tracking-wider"
          style={{ color: 'var(--app-text-secondary)' }}
        >
          Advanced: board pack
        </h3>
      </button>
      {advancedOpen && (
        <div className="space-y-2">
          <button
            type="button"
            className="btn btn-secondary w-full py-2 text-sm"
            onClick={handleImportReplace}
          >
            Import replace
          </button>
          <button
            type="button"
            className="btn btn-secondary w-full py-2 text-sm"
            onClick={handleImportMerge}
          >
            Import merge
          </button>
          <button
            type="button"
            className="btn btn-secondary w-full py-2 text-sm"
            onClick={handleExport}
          >
            Export pack
          </button>
          {importSummary && (
            <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
              {importSummary}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function SessionConsoleTableSetup(): JSX.Element {
  return (
    <section className="space-y-3">
      <h3
        className="text-xs uppercase font-bold tracking-wider"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Table setup
      </h3>
      <DiscordSetupHelp />
    </section>
  );
}
