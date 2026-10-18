export const OPEN_SESSION_CONSOLE_SETTINGS_EVENT = 'graphium-open-session-console-settings';

export function openSessionConsoleSettings(): void {
  window.dispatchEvent(new Event(OPEN_SESSION_CONSOLE_SETTINGS_EVENT));
}
