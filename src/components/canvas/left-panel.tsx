"use client";

import { Eye, Plus, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme-store";
import { useCanvasStore } from "@/store/canvas-store";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useGetCanvasProject } from "@/features/projects/api/use-get-canvas-project";
import { usePDFPageStore } from "@/store/pdf-page-store";

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  type: 'group' | 'layer';
}

interface LayerGroup {
  id: string;
  title: string;
  icon: string;
  visible: boolean;
  children: Layer[];
}

const doorsWindowsLayers: LayerGroup = {
  id: "doors-windows",
  title: "Doors and Windows",
  icon: "",
  visible: false,
  children: [
    {
      id: "single-doors",
      name: "Single Doors",
      visible: true,
      locked: false,
      type: 'layer'
    },
    {
      id: "double-doors",
      name: "Double Doors",
      visible: true,
      locked: false,
      type: 'layer'
    },
    {
      id: "windows",
      name: "Windows",
      visible: true,
      locked: false,
      type: 'layer'
    }
  ]
};

const wallsColorLayer: Layer = {
  id: "wall-color-processing",
  name: "Walls Color",
  visible: true,
  locked: false,
  type: 'layer'
};

interface ApiToggleEvent extends CustomEvent {
  detail: {
    apiId: string;
    enabled: boolean;
  };
}

export default function LeftPanel() {
  const { isDarkMode } = useThemeStore();
  const { setLayerVisibility, layers } = useCanvasStore(); 
  const [activeApiLayers, setActiveApiLayers] = useState<LayerGroup[]>([]);
  const [doorsWindowsProcessing, setDoorsWindowsProcessing] = useState(false);
  const [layerStates, setLayerStates] = useState({
    "single-doors": false,
    "double-doors": false,
    "windows": false
  });
  const [wallsLayerVisible, setWallsLayerVisible] = useState(false);
  const [wallsLayerProcessing, setWallsLayerProcessing] = useState(false);
  const [wallsEyeProcessing, setWallsEyeProcessing] = useState(false);
  const [wallsDetectionActivated, setWallsDetectionActivated] = useState(false);
  const { projectId } = useParams();
  const { data: project } = useGetCanvasProject(projectId as string);
  const { currentPage } = usePDFPageStore();

  useEffect(() => {
    // When project data loads, we don't automatically show the layers
    // even if detection results exist - they will be shown only after the user
    // toggles the detection switch
    setActiveApiLayers([]);
    setLayerStates({
      "single-doors": false,
      "double-doors": false,
      "windows": false
    });
    
    // Reset the walls layer visibility state on page refresh
    setWallsLayerVisible(false);
    setWallsLayerProcessing(false);
    setWallsEyeProcessing(false);
    setLayerVisibility("wall_color_processing", false);
  }, [project]);

  const getLayerArrayKey = (states: typeof layerStates) => {
    const { "single-doors": single, "double-doors": double, "windows": windows } = states;
    
    // All layers visible - show complete detection
    if (single && double && windows) {
      return "complete_doors_and_windows";
    }
    
    // Two layers visible
    if (single && double && !windows) {
      return "single_doors_and_double_doors";
    }
    if (single && !double && windows) {
      return "single_doors_and_windows";
    }
    if (!single && double && windows) {
      return "double_doors_and_windows";
    }
    
    // Single layer visible
    if (single && !double && !windows) {
      return "single_doors";
    }
    if (!single && double && !windows) {
      return "double_doors";
    }
    if (!single && !double && windows) {
      return "windows";
    }
    
    // No layers visible - show original pages
    return "pages";
  };

  const toggleLayerVisibility = async (layerId: string) => {
    if (layerId === "doors-windows") {
      // Toggle main group visibility
      const newMainVisible = !activeApiLayers.find(g => g.id === "doors-windows")?.visible;
      
      // Update all sub-layer states
      const newStates = {
        "single-doors": newMainVisible,
        "double-doors": newMainVisible,
        "windows": newMainVisible
      };
      setLayerStates(newStates);
      
      setActiveApiLayers(prev => {
        return prev.map(group => {
          if (group.id === "doors-windows") {
            return {
              ...group,
              visible: newMainVisible,
              children: group.children.map(child => ({
                ...child,
                visible: newMainVisible
              }))
            };
          }
          return group;
        });
      });

      setDoorsWindowsProcessing(true);
      try {
        const arrayKey = newMainVisible ? "complete_doors_and_windows" : "pages";
        const response = await fetch(`/api/canvas/layer-visibility`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            layerId: arrayKey,
            visible: true,
            currentPage
          })
        });

        const data = await response.json();
        
        if (data.success) {
          window.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
            detail: {
              imageUrl: data.imageUrl,
              layerId: arrayKey,
              visible: true
            }
          }));
        }
      } catch (error) {
        console.error('Error updating layer visibility:', error);
      } finally {
        setDoorsWindowsProcessing(false);
      }
    } else {
      // Handle sub-layer toggle
      const newStates = {
        ...layerStates,
        [layerId]: !layerStates[layerId as keyof typeof layerStates]
      };
      setLayerStates(newStates);

      // Update layer group visibility in UI
      setActiveApiLayers(prev => {
        return prev.map(group => {
          if (group.id === "doors-windows") {
            return {
              ...group,
              children: group.children.map(child => ({
                ...child,
                visible: newStates[child.id as keyof typeof layerStates]
              }))
            };
          }
          return group;
        });
      });

      setDoorsWindowsProcessing(true);
      try {
        const arrayKey = getLayerArrayKey(newStates);
        const response = await fetch(`/api/canvas/layer-visibility`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            layerId: arrayKey,
            visible: true,
            currentPage
          })
        });

        const data = await response.json();
        
        if (data.success) {
          window.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
            detail: {
              imageUrl: data.imageUrl,
              layerId: arrayKey,
              visible: true
            }
          }));
        }
      } catch (error) {
        console.error('Error updating layer visibility:', error);
      } finally {
        setDoorsWindowsProcessing(false);
      }
    }
  };

  const handleApiToggle = (apiId: string, enabled: boolean) => {
    if (apiId === "doors-windows") {
      if (enabled) {
        // When enabling, start with layers not visible but show in panel with processing indicator
        setDoorsWindowsProcessing(true);
        // Add the layer group but with visibility off initially
        const initialGroup = {
          ...doorsWindowsLayers,
          visible: false,
          children: doorsWindowsLayers.children.map(child => ({
            ...child,
            visible: false
          }))
        };
        setActiveApiLayers([initialGroup]);
        
        // Set all sub-layers visibility state to false initially
        setLayerStates({
          "single-doors": false,
          "double-doors": false,
          "windows": false
        });
      } else {
        // When disabling, remove the layer group entirely
        setActiveApiLayers([]);
        setDoorsWindowsProcessing(false);
      }
    } else if (apiId === "walls-detection") {
      if (enabled) {
        // For walls detection, we'll set the processing state
        // The actual visibility will be set when the detection completes
        setWallsLayerProcessing(true);
        // Initially set to not visible
        setWallsLayerVisible(false);
        // Mark that walls detection has been activated in this session
        setWallsDetectionActivated(true);
      } else {
        // When disabling, hide the layer
        setWallsLayerProcessing(false);
        setWallsLayerVisible(false);
        // Reset the activation state
        setWallsDetectionActivated(false);
        
        // Hide the layer on the canvas
        const wallColorUrl = project?.canvasData?.wall_color_processing?.[currentPage];
        if (wallColorUrl) {
          window.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
            detail: {
              imageUrl: wallColorUrl,
              layerId: "wall_color_processing",
              visible: false
            }
          }));
        }
      }
    }
  };

  useEffect(() => {
    const handleAPIToggle = (event: Event) => {
      const customEvent = event as ApiToggleEvent;
      handleApiToggle(customEvent.detail.apiId, customEvent.detail.enabled);
    };

    const handleDoorsWindowsDetectionComplete = (event: Event) => {
      // Show doors and windows layers when detection is complete
      console.log('Doors and windows detection complete event received');
      setDoorsWindowsProcessing(false);
      
      // Set the doors-windows layer group as active with visibility ON
      setActiveApiLayers(prev => {
        // Check if we already have the walls layer active
        const hasWallsLayer = wallsLayerVisible;
        
        // Create a new array with the doors-windows layer group
        const doorsWindowsGroup = {
          ...doorsWindowsLayers,
          visible: true,
          children: doorsWindowsLayers.children.map(child => ({
            ...child,
            visible: true
          }))
        };
        
        // Return the appropriate layers array
        return hasWallsLayer ? [doorsWindowsGroup] : [doorsWindowsGroup];
      });
      
      // Set all sub-layers as visible
      setLayerStates({
        "single-doors": true,
        "double-doors": true,
        "windows": true
      });
      
      // Get the complete doors and windows image URL for the current page
      const doorsWindowsUrl = project?.canvasData?.complete_doors_and_windows?.[currentPage];
      
      if (doorsWindowsUrl) {
        // Dispatch event to update canvas with the complete doors and windows layer
        window.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
          detail: {
            imageUrl: doorsWindowsUrl,
            layerId: "complete_doors_and_windows",
            visible: true
          }
        }));
      } else {
        console.error('No doors and windows image found for the current page');
      }
    };
    
    const handleWallsDetectionComplete = (event: Event) => {
      // Processing is complete - show the layer automatically
      console.log('Walls detection complete event received');
      
      // Set processing to false and make the layer visible
      setWallsLayerProcessing(false);
      setWallsLayerVisible(true); // Make it visible by default
      
      // Update the canvas store to make the layer visible
      setLayerVisibility("wall_color_processing", true);
      
      // Get the wall color processing image URL for the current page
      const wallColorUrl = project?.canvasData?.wall_color_processing?.[currentPage];
      console.log('Wall color URL:', wallColorUrl);
      
      if (wallColorUrl) {
        // Make the layer visible immediately after processing completes
        window.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
          detail: {
            imageUrl: wallColorUrl,
            layerId: "wall_color_processing",
            visible: true // Make it visible by default
          }
        }));
      } else {
        console.error('No wall color processing image found for the current page');
      }
    };

    window.addEventListener("apiToggle", handleAPIToggle as EventListener);
    window.addEventListener("doorsWindowsDetectionComplete", handleDoorsWindowsDetectionComplete as EventListener);
    window.addEventListener("wallsDetectionComplete", handleWallsDetectionComplete as EventListener);
    
    return () => {
      window.removeEventListener("apiToggle", handleAPIToggle as EventListener);
      window.removeEventListener("doorsWindowsDetectionComplete", handleDoorsWindowsDetectionComplete as EventListener);
      window.removeEventListener("wallsDetectionComplete", handleWallsDetectionComplete as EventListener);
    };
  }, [project, currentPage, wallsLayerVisible]);

  const renderLayer = (layer: Layer, isDarkMode: boolean) => (
    <div 
      key={layer.id} 
      className="flex items-center justify-between p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
    >
      <div className="flex items-center space-x-2">
        <Eye 
          className={cn(
            "h-4 w-4 transition-all",
            layer.visible ? (isDarkMode ? "text-orange-400" : "text-orange-500") : "text-zinc-400",
            "group-hover:text-orange-500 dark:group-hover:text-orange-400"
          )} 
          onClick={() => toggleLayerVisibility(layer.id)} 
        />
        <span className={cn(
          "text-sm",
          isDarkMode ? "text-zinc-300" : "text-zinc-700"
        )}>{layer.name}</span>
      </div>
    </div>
  );

  const renderLayerGroup = (group: LayerGroup, isDarkMode: boolean) => (
    <div key={group.id} className="space-y-1">
      <div className="flex items-center justify-between p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
        <div className="flex items-center space-x-2">
          {doorsWindowsProcessing && group.id === "doors-windows" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye 
              className={cn(
                "h-4 w-4 transition-all",
                group.visible ? (isDarkMode ? "text-orange-400" : "text-orange-500") : "text-zinc-400",
                "group-hover:text-orange-500 dark:group-hover:text-orange-400",
                doorsWindowsProcessing ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              )} 
              onClick={() => {
                if (!doorsWindowsProcessing) {
                  toggleLayerVisibility(group.id);
                }
              }} 
            />
          )}
          <span className={cn(
            "text-sm font-medium",
            isDarkMode ? "text-zinc-300" : "text-zinc-700"
          )}>{group.title}</span>
        </div>
      </div>
      {group.visible && (
        <div className="pl-4 space-y-1">
          {group.children.map(child => renderLayer(child, isDarkMode))}
        </div>
      )}
    </div>
  );

  return (
    <div className={cn(
      "w-[300px] border-r transition-colors flex flex-col h-[calc(100vh-48px)]", 
      isDarkMode ? "border-zinc-800" : "border-zinc-200"
    )}>
      <div className="p-2 border-b" style={{ borderColor: isDarkMode ? "#1f2937" : "#e5e7eb" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <Square className={cn(
              "h-2 w-2 rounded-full",
              isDarkMode ? "bg-orange-500" : "bg-orange-500"
            )} />
            <h2 className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-orange-100" : "text-zinc-900"
            )}>Layers</h2>
          </div>
          <Plus className={cn(
            "h-4 w-4",
            isDarkMode ? "text-orange-400" : "text-orange-500"
          )} />
        </div>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto flex-grow"> 
        {activeApiLayers.map(group => renderLayerGroup(group, isDarkMode))}
        
        {/* Walls Color Layer - Only show when walls detection has been explicitly activated by the user */}
        {!wallsLayerProcessing && wallsDetectionActivated && project?.canvasData?.wall_color_processing && (
          <div className="space-y-1 mt-3">
            <div className="flex items-center justify-between p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
              <div className="flex items-center space-x-2">
                {wallsEyeProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye 
                    className={cn(
                      "h-4 w-4 transition-all",
                      wallsLayerVisible ? (isDarkMode ? "text-orange-400" : "text-orange-500") : "text-zinc-400",
                      "group-hover:text-orange-500 dark:group-hover:text-orange-400",
                      "cursor-pointer"
                    )}
                    onClick={async () => {
                      try {
                        // Show processing indicator
                        setWallsEyeProcessing(true);
                        
                        const newVisibility = !wallsLayerVisible;
                        setWallsLayerVisible(newVisibility);
                        
                        // Update the canvas store to reflect the layer visibility
                        setLayerVisibility("wall_color_processing", newVisibility);
                        
                        // Get the appropriate image URL based on visibility
                        let imageUrl;
                        if (newVisibility) {
                          // When showing the layer, use wall_color_processing array
                          imageUrl = project?.canvasData?.wall_color_processing?.[currentPage];
                        } else {
                          // When hiding the layer, use pages array (original image)
                          imageUrl = project?.canvasData?.pages?.[currentPage];
                        }
                        
                        if (imageUrl) {
                          // Call the layer-visibility API
                          const response = await fetch(`/api/canvas/layer-visibility`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              projectId,
                              layerId: newVisibility ? "wall_color_processing" : "pages",
                              visible: true,
                              currentPage
                            })
                          });
                          
                          const data = await response.json();
                          
                          if (data.success) {
                            // Dispatch event to update canvas with the appropriate layer
                            window.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
                              detail: {
                                imageUrl: imageUrl,
                                layerId: newVisibility ? "wall_color_processing" : "pages",
                                visible: true
                              }
                            }));
                            
                            console.log(`Toggled to ${newVisibility ? 'wall_color_processing' : 'pages'} layer`);
                          }
                        } else {
                          console.error('No image found for the current page');
                        }
                      } catch (error) {
                        console.error('Error toggling wall color layer:', error);
                      } finally {
                        // Hide processing indicator
                        setWallsEyeProcessing(false);
                      }
                    }}
                  />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-zinc-300" : "text-zinc-700"
                )}>Walls Color</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Walls Color Processing Indicator */}
        {wallsLayerProcessing && (
          <div className="space-y-1 mt-3">
            <div className="flex items-center justify-between p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-zinc-300" : "text-zinc-700"
                )}>Walls Color</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
