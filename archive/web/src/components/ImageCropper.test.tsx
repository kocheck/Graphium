import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ImageCropper from './ImageCropper';

// react-easy-crop measures its container with getBoundingClientRect, which is all zeros in
// jsdom, so the real cropper cannot be driven here. This file covers the dialog shell only;
// cropping itself has no automated coverage (recorded in plans/reports/004-pr2.md).
vi.mock('react-easy-crop', () => ({
  default: () => <div data-testid="cropper-stub" />,
}));

describe('ImageCropper', () => {
  it('renders a modal dialog with the cropper and both actions', () => {
    render(<ImageCropper imageSrc="blob:test" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const root = screen.getByRole('dialog');
    expect(root).toHaveAttribute('aria-modal', 'true');
    expect(root).toHaveAttribute('data-esc-owns', 'true');
    expect(screen.getByTestId('cropper-stub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop & Import' })).toBeInTheDocument();
  });

  it('Cancel and Escape both call onCancel', () => {
    const onCancel = vi.fn();
    render(<ImageCropper imageSrc="blob:test" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
