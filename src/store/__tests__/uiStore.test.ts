import { describe, it, expect, beforeEach } from 'vitest';

import { useUiStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset to initial state before each test
    useUiStore.setState({
      toast: null,
      confirmDialog: null,
      showResourceMonitor: false,
      dungeonDialog: false,
      isGamePaused: false,
      isMobileSidebarOpen: false,
      isCommandPaletteOpen: false,
    });
  });

  describe('initial state', () => {
    it('has null toast', () => {
      expect(useUiStore.getState().toast).toBeNull();
    });

    it('has null confirmDialog', () => {
      expect(useUiStore.getState().confirmDialog).toBeNull();
    });

    it('has showResourceMonitor false', () => {
      expect(useUiStore.getState().showResourceMonitor).toBe(false);
    });

    it('has dungeonDialog false', () => {
      expect(useUiStore.getState().dungeonDialog).toBe(false);
    });

    it('has isGamePaused false', () => {
      expect(useUiStore.getState().isGamePaused).toBe(false);
    });

    it('has isMobileSidebarOpen false', () => {
      expect(useUiStore.getState().isMobileSidebarOpen).toBe(false);
    });

    it('has isCommandPaletteOpen false', () => {
      expect(useUiStore.getState().isCommandPaletteOpen).toBe(false);
    });
  });

  describe('toast actions', () => {
    it('showToast sets toast with message and type', () => {
      useUiStore.getState().showToast('Test message', 'success');
      const toast = useUiStore.getState().toast;
      expect(toast).toEqual({ message: 'Test message', type: 'success' });
    });

    it('showToast supports error type', () => {
      useUiStore.getState().showToast('Error occurred', 'error');
      expect(useUiStore.getState().toast).toEqual({
        message: 'Error occurred',
        type: 'error',
      });
    });

    it('showToast supports info type', () => {
      useUiStore.getState().showToast('Info note', 'info');
      expect(useUiStore.getState().toast).toEqual({
        message: 'Info note',
        type: 'info',
      });
    });

    it('showToast overwrites previous toast', () => {
      useUiStore.getState().showToast('First', 'info');
      useUiStore.getState().showToast('Second', 'error');
      expect(useUiStore.getState().toast?.message).toBe('Second');
      expect(useUiStore.getState().toast?.type).toBe('error');
    });

    it('clearToast sets toast to null', () => {
      useUiStore.getState().showToast('To be cleared', 'info');
      expect(useUiStore.getState().toast).not.toBeNull();
      useUiStore.getState().clearToast();
      expect(useUiStore.getState().toast).toBeNull();
    });

    it('clearToast is no-op when already null', () => {
      useUiStore.getState().clearToast();
      expect(useUiStore.getState().toast).toBeNull();
    });
  });

  describe('confirmDialog actions', () => {
    it('showConfirmDialog sets dialog with message and callback', () => {
      const onConfirm = () => {};
      useUiStore.getState().showConfirmDialog('Are you sure?', onConfirm);
      const dialog = useUiStore.getState().confirmDialog;
      expect(dialog).not.toBeNull();
      expect(dialog?.message).toBe('Are you sure?');
      expect(dialog?.onConfirm).toBe(onConfirm);
    });

    it('showConfirmDialog accepts optional confirmText', () => {
      const onConfirm = () => {};
      useUiStore.getState().showConfirmDialog('Delete?', onConfirm, 'Delete Forever');
      expect(useUiStore.getState().confirmDialog?.confirmText).toBe('Delete Forever');
    });

    it('showConfirmDialog without confirmText has undefined confirmText', () => {
      useUiStore.getState().showConfirmDialog('Confirm?', () => {});
      expect(useUiStore.getState().confirmDialog?.confirmText).toBeUndefined();
    });

    it('clearConfirmDialog sets confirmDialog to null', () => {
      useUiStore.getState().showConfirmDialog('Test', () => {});
      expect(useUiStore.getState().confirmDialog).not.toBeNull();
      useUiStore.getState().clearConfirmDialog();
      expect(useUiStore.getState().confirmDialog).toBeNull();
    });

    it('onConfirm callback is callable', () => {
      let called = false;
      useUiStore.getState().showConfirmDialog('Do it?', () => {
        called = true;
      });
      useUiStore.getState().confirmDialog?.onConfirm();
      expect(called).toBe(true);
    });
  });

  describe('resource monitor', () => {
    it('setShowResourceMonitor toggles visibility', () => {
      expect(useUiStore.getState().showResourceMonitor).toBe(false);
      useUiStore.getState().setShowResourceMonitor(true);
      expect(useUiStore.getState().showResourceMonitor).toBe(true);
      useUiStore.getState().setShowResourceMonitor(false);
      expect(useUiStore.getState().showResourceMonitor).toBe(false);
    });
  });

  describe('dungeon dialog', () => {
    it('showDungeonDialog sets dungeonDialog to true', () => {
      useUiStore.getState().showDungeonDialog();
      expect(useUiStore.getState().dungeonDialog).toBe(true);
    });

    it('clearDungeonDialog sets dungeonDialog to false', () => {
      useUiStore.getState().showDungeonDialog();
      useUiStore.getState().clearDungeonDialog();
      expect(useUiStore.getState().dungeonDialog).toBe(false);
    });
  });

  describe('game pause', () => {
    it('setIsGamePaused sets pause state', () => {
      useUiStore.getState().setIsGamePaused(true);
      expect(useUiStore.getState().isGamePaused).toBe(true);
      useUiStore.getState().setIsGamePaused(false);
      expect(useUiStore.getState().isGamePaused).toBe(false);
    });
  });

  describe('mobile sidebar', () => {
    it('setMobileSidebarOpen controls sidebar visibility', () => {
      useUiStore.getState().setMobileSidebarOpen(true);
      expect(useUiStore.getState().isMobileSidebarOpen).toBe(true);
      useUiStore.getState().setMobileSidebarOpen(false);
      expect(useUiStore.getState().isMobileSidebarOpen).toBe(false);
    });
  });

  describe('command palette', () => {
    it('setCommandPaletteOpen controls palette visibility', () => {
      useUiStore.getState().setCommandPaletteOpen(true);
      expect(useUiStore.getState().isCommandPaletteOpen).toBe(true);
      useUiStore.getState().setCommandPaletteOpen(false);
      expect(useUiStore.getState().isCommandPaletteOpen).toBe(false);
    });
  });

  describe('state isolation', () => {
    it('changing one state does not affect others', () => {
      useUiStore.getState().showToast('Hello', 'info');
      useUiStore.getState().setIsGamePaused(true);
      useUiStore.getState().setMobileSidebarOpen(true);

      const state = useUiStore.getState();
      expect(state.toast?.message).toBe('Hello');
      expect(state.isGamePaused).toBe(true);
      expect(state.isMobileSidebarOpen).toBe(true);
      expect(state.confirmDialog).toBeNull();
      expect(state.showResourceMonitor).toBe(false);
      expect(state.dungeonDialog).toBe(false);
      expect(state.isCommandPaletteOpen).toBe(false);
    });
  });
});
