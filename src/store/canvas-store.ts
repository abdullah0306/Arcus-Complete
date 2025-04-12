import { create } from 'zustand';
import { fabric } from 'fabric';
import { CanvasData } from '@/types/canvas';

interface CanvasStore {
  canvas: fabric.Canvas | null;
  setCanvas: (canvas: fabric.Canvas) => void;
  currentLayer: string;
  setCurrentLayer: (layer: string) => void;
  layers: {
    [key: string]: boolean;
  };
  setLayerVisibility: (layer: string, visible: boolean) => void;
  getActiveLayer: (currentPage: number, canvasData: CanvasData) => string;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  canvas: null,
  currentLayer: 'pages',
  layers: {
    pages: true,
    complete_doors_and_windows: false,
    single_doors: false,
    double_doors: false,
    windows: false,
    single_doors_and_windows: false,
    single_doors_and_double_doors: false,
    double_doors_and_windows: false
  },
  setCanvas: (canvas) => set({ canvas }),
  setCurrentLayer: (layer) => set({ currentLayer: layer }),
  setLayerVisibility: (layer, visible) => set((state) => ({
    layers: {
      ...state.layers,
      [layer]: visible
    }
  })),
  getActiveLayer: (currentPage: number, canvasData: CanvasData) => {
    // Get the current visibility state
    const state = useCanvasStore.getState();
    const layers = state.layers;

    // Check if we have detection results
    const hasDetectionResults = 
      canvasData.complete_doors_and_windows?.[currentPage] ||
      canvasData.single_doors?.[currentPage] ||
      canvasData.double_doors?.[currentPage] ||
      canvasData.windows?.[currentPage];

    // If no detection results, always show pages
    if (!hasDetectionResults) {
      return 'pages';
    }

    // If complete_doors_and_windows is visible, show it
    if (layers.complete_doors_and_windows) {
      return 'complete_doors_and_windows';
    }

    // Otherwise show the pages array
    return 'pages';
  }
}));
