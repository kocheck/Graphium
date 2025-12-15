import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from './Sidebar';
import { useGameStore } from '../store/gameStore';
import * as AssetProcessor from '../utils/AssetProcessor';

// Mock the AssetProcessor module
vi.mock('../utils/AssetProcessor', () => ({
    processImage: vi.fn(),
}));

describe('Sidebar - Map Upload Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store
        useGameStore.setState({ 
            toast: null,
            map: null,
            gridType: 'LINES',
            isCalibrating: false
        });
    });

    it('should show error toast when map upload fails', async () => {
        vi.mocked(AssetProcessor.processImage).mockRejectedValue(new Error('Upload failed'));

        render(<Sidebar />);
        
        const uploadButton = screen.getByText(/Upload Map/i);
        expect(uploadButton).toBeInTheDocument();

        // Get the hidden file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        // Create a mock file
        const file = new File(['test'], 'test.png', { type: 'image/png' });
        
        // Trigger file upload
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
            const state = useGameStore.getState();
            expect(state.toast).not.toBeNull();
            expect(state.toast?.type).toBe('error');
            expect(state.toast?.message).toContain('Failed to upload map');
        });
    });

    it('should show error toast when map image fails to load', async () => {
        vi.mocked(AssetProcessor.processImage).mockResolvedValue('/path/to/image.png');

        // Mock URL.createObjectURL to return a fake URL
        const originalCreateObjectURL = global.URL.createObjectURL;
        const originalRevokeObjectURL = global.URL.revokeObjectURL;
        global.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
        global.URL.revokeObjectURL = vi.fn();

        // Mock Image to trigger onerror
        const originalImage = global.Image;
        
        global.Image = class MockImage {
            onload: ((event: Event) => void) | null = null;
            onerror: ((event: Event) => void) | null = null;
            _src: string = '';
            
            get src() {
                return this._src;
            }
            
            set src(value: string) {
                this._src = value;
                // Trigger onerror asynchronously when src is set
                Promise.resolve().then(() => {
                    if (this.onerror) {
                        this.onerror(new Event('error'));
                    }
                });
            }
        } as any;

        render(<Sidebar />);
        
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['test'], 'test.png', { type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
            const state = useGameStore.getState();
            expect(state.toast).not.toBeNull();
            expect(state.toast?.type).toBe('error');
            expect(state.toast?.message).toContain('Failed to load map image');
        });

        // Restore originals
        global.Image = originalImage;
        global.URL.createObjectURL = originalCreateObjectURL;
        global.URL.revokeObjectURL = originalRevokeObjectURL;
    });
});
