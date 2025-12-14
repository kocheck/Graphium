import React, { useRef } from 'react';
import { useGameStore, GridType } from '../store/gameStore';
import { processImage } from '../utils/AssetProcessor';

const Sidebar = () => {
    const {
        setMap, gridType, setGridType,
        map, updateMapPosition, updateMapScale,
        isCalibrating, setIsCalibrating
    } = useGameStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragStart = (e: React.DragEvent, type: string, src: string) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type, src }));
        // Also set a drag image if we want
    };

    const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const src = await processImage(file, 'MAP');
            setMap({
                src,
                x: 0,
                y: 0,
                scale: 1
            });
            setIsCalibrating(true);
        } catch (err) {
            console.error("Failed to upload map", err);
        }
    };

    return (
        <div className="w-64 bg-neutral-800 border-r border-neutral-700 flex flex-col p-4 z-10 shrink-0 text-white overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Library</h2>

            <div className="mb-8">
                <h3 className="text-sm text-neutral-400 mb-3 uppercase font-bold tracking-wider">Map Settings</h3>

                <div className="space-y-4">
                    {/* Map Upload */}
                    <div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleMapUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition flex items-center justify-center gap-2"
                        >
                            <span>🗺️</span> Upload Map
                        </button>
                    </div>

                    {/* Grid Type Selector */}
                    <div>
                        <label className="block text-xs text-neutral-400 mb-2 uppercase font-semibold">Grid Type</label>
                        <select
                            value={gridType}
                            onChange={(e) => setGridType(e.target.value as GridType)}
                            className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="LINES">Lines</option>
                            <option value="DOTS">Dots</option>
                            <option value="HIDDEN">Hidden</option>
                        </select>
                    </div>

                    {/* Map Calibration */}
                    <div className="pt-4 border-t border-neutral-700">
                         <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs text-neutral-400 uppercase font-semibold">Calibration</h4>
                            {isCalibrating && <span className="text-xs text-blue-400 animate-pulse">Active</span>}
                         </div>

                         {isCalibrating ? (
                             <div className="bg-blue-900/30 border border-blue-500/50 rounded p-3 mb-3 text-xs text-blue-100">
                                 <p className="mb-2"><strong>Draw a square</strong> on the map that represents exactly <strong>one grid cell</strong> (e.g. 5ft square).</p>
                                 <button
                                     onClick={() => setIsCalibrating(false)}
                                     className="w-full bg-neutral-700 hover:bg-neutral-600 text-white py-1 rounded transition"
                                 >
                                     Cancel
                                 </button>
                             </div>
                         ) : (
                             <button
                                onClick={() => setIsCalibrating(true)}
                                className="w-full bg-neutral-700 hover:bg-neutral-600 text-white font-medium py-2 px-3 rounded mb-3 text-sm flex items-center justify-center gap-2 transition"
                                disabled={!map}
                             >
                                <span>📐</span> Calibrate via Draw
                             </button>
                         )}

                         <div className="text-center">
                            <button
                                onClick={() => {
                                    updateMapPosition(0, 0);
                                    updateMapScale(1);
                                }}
                                className="text-xs text-neutral-500 hover:text-neutral-300 underline"
                                disabled={!map}
                            >
                                Reset Map
                            </button>
                         </div>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <h3 className="text-sm text-neutral-400 mb-3 uppercase font-bold tracking-wider">Tokens</h3>
                <div className="grid grid-cols-2 gap-2">
                     <div
                        className="bg-neutral-700 w-full aspect-square rounded cursor-grab flex items-center justify-center hover:bg-neutral-600 transition"
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'LIBRARY_TOKEN', 'https://konvajs.org/assets/lion.png')}
                     >
                        🦁
                    </div>
                     <div
                        className="bg-neutral-700 w-full aspect-square rounded cursor-grab flex items-center justify-center hover:bg-neutral-600 transition"
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'LIBRARY_TOKEN', 'https://konvajs.org/assets/yoda.jpg')}
                     >
                        👽
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
// Force HMR update
