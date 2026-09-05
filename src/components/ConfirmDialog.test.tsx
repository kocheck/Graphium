import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGameStore } from '../store/gameStore';

import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    useGameStore.getState().clearConfirmDialog();
  });

  it('renders nothing when no confirmation is pending', () => {
    render(<ConfirmDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the message, owns Escape and focuses Cancel first', () => {
    act(() => {
      useGameStore.getState().showConfirmDialog('Delete this map?', () => {}, 'Delete');
    });
    render(<ConfirmDialog />);

    const root = screen.getByTestId('dialog-confirm-root');
    expect(root).toHaveAttribute('role', 'dialog');
    expect(root).toHaveAttribute('aria-modal', 'true');
    expect(root).toHaveAttribute('data-esc-owns', 'true');
    expect(screen.getByText('Delete this map?')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-confirm-confirm')).toHaveTextContent('Delete');
    expect(screen.getByTestId('dialog-confirm-cancel')).toHaveFocus();
  });

  it('Enter confirms and closes', () => {
    const onConfirm = vi.fn();
    act(() => {
      useGameStore.getState().showConfirmDialog('Sure?', onConfirm);
    });
    render(<ConfirmDialog />);

    act(() => {
      fireEvent.keyDown(screen.getByTestId('dialog-confirm-root'), { key: 'Enter' });
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().confirmDialog).toBeNull();
  });

  it('Escape closes without confirming', () => {
    const onConfirm = vi.fn();
    act(() => {
      useGameStore.getState().showConfirmDialog('Sure?', onConfirm);
    });
    render(<ConfirmDialog />);

    act(() => {
      fireEvent.keyDown(screen.getByTestId('dialog-confirm-root'), { key: 'Escape' });
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(useGameStore.getState().confirmDialog).toBeNull();
  });
});
