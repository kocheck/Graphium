/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
  // Electron IPC (only available in Electron, not in web)
  ipcRenderer?: {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    off(channel: string, listener: (...args: any[]) => void): void;
    removeAllListeners(channel: string): void;
    send(channel: string, ...args: any[]): void;
    invoke(channel: string, ...args: any[]): Promise<any>;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  };
  // Electron Theme API (only available in Electron)
  themeAPI?: {
    getThemeState: () => Promise<{ mode: string; effectiveTheme: string }>;
    setThemeMode: (mode: string) => Promise<void>;
    onThemeChanged: (
      callback: (data: { mode: string; effectiveTheme: string }) => void,
    ) => () => void;
  };
  // Electron Error Reporting API (only available in Electron)
  errorReporting?: {
    getUsername: () => Promise<string>;
    openExternal: (url: string) => Promise<boolean>;
    saveToFile: (
      reportContent: string,
    ) => Promise<{ success: boolean; filePath?: string; reason?: string }>;
  };
}
