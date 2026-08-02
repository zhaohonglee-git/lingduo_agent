'use client';

import { useEffect, useRef, useState, useMemo, Component, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import type { PackedBin, PlacedItem } from '@cratefit/pack';
import {
  create3DScene,
  renderPackedBin3D,
  animate,
  type SceneComponents,
  type Render3DResult,
} from '@cratefit/viz';
import { useDemoStore } from '@/lib/stores/demo-store';
import { HoverInfoCard } from './HoverInfoCard';

// Three.js types for raycasting
interface Vector2 {
  x: number;
  y: number;
  set: (x: number, y: number) => void;
}

interface Raycaster {
  setFromCamera: (coords: Vector2, camera: unknown) => void;
  intersectObjects: (objects: unknown[], recursive?: boolean) => Array<{
    object: { userData?: { itemId?: string; type?: string } };
  }>;
}

interface ThreeModule {
  Raycaster: new () => Raycaster;
  Vector2: new () => Vector2;
  SphereGeometry: new (radius: number, widthSegments: number, heightSegments: number) => unknown;
  MeshBasicMaterial: new (params: { color: number; transparent?: boolean; opacity?: number; depthTest?: boolean }) => unknown;
  Mesh: new (geometry: unknown, material: unknown) => { position: { set: (x: number, y: number, z: number) => void }; name: string; renderOrder: number };
}

// Error Boundary for WebGL errors
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class Viewer3DErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Check WebGL support
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Validation pattern for safe itemId (alphanumeric, hyphens, underscores)
const SAFE_ITEM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_ORIGINAL_POSITIONS = 10000; // Limit to prevent memory issues

interface Viewer3DProps {
  packedBin: PackedBin;
}

function Viewer3DImpl({ packedBin }: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneComponents | null>(null);
  const renderResultRef = useRef<Render3DResult | null>(null);
  const raycasterRef = useRef<{ raycaster: Raycaster; mouse: Vector2 } | null>(null);
  const initialCameraRef = useRef<{ position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } } | null>(null);
  const cogMeshRef = useRef<unknown>(null);
  const threeRef = useRef<ThreeModule | null>(null);
  const originalPositionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());

  const { resolvedTheme } = useTheme();
  const [webGLSupported] = useState(() => isWebGLSupported());
  const [threeLoadError, setThreeLoadError] = useState(false);
  const viewerSettings = useDemoStore((s) => s.viewerSettings);
  const setHighlight = useDemoStore((s) => s.setHighlight);
  const clearHighlight = useDemoStore((s) => s.clearHighlight);

  // Hover state
  const [hoverInfo, setHoverInfo] = useState<{
    item: PlacedItem | null;
    position: { x: number; y: number };
  } | null>(null);

  // Memoize layer calculation to prevent recalculation on every settings change
  const { itemLayers, maxLayer } = useMemo(() => {
    const { width, height, depth } = packedBin.bin;
    const layerThreshold = Math.max(width, height, depth) * 0.05;
    const layers = new Map<string, number>();
    const uniqueYPositions = [...new Set(packedBin.items.map(item => item.position.y))].sort((a, b) => a - b);

    let currentLayer = 1;
    let lastY = uniqueYPositions[0] ?? 0;
    for (const y of uniqueYPositions) {
      if (y - lastY > layerThreshold) {
        currentLayer++;
      }
      for (const item of packedBin.items) {
        if (item.position.y === y) {
          layers.set(item.item.id, currentLayer);
        }
      }
      lastY = y;
    }
    return { itemLayers: layers, maxLayer: currentLayer };
  }, [packedBin.items, packedBin.bin]);

  // Main effect: Create scene and render (only on packedBin/theme change)
  useEffect(() => {
    if (!webGLSupported) return undefined;
    if (!containerRef.current) return undefined;

    // Clear original positions when bin changes (prevent memory leak)
    originalPositionsRef.current.clear();

    // Clean up previous scene
    if (sceneRef.current) {
      sceneRef.current.dispose();
    }

    const backgroundColor = resolvedTheme === 'dark' ? '#0f172a' : '#f8fafc';

    try {
      // Create new scene (grid will be toggled by settings effect)
      const components = create3DScene(containerRef.current, {
        backgroundColor,
        showGrid: true,
        enableShadows: true,
      });
      sceneRef.current = components;

      // Render packed bin (edges will be toggled by settings effect)
      const renderResult = renderPackedBin3D(components.scene, packedBin, {
        showEdges: true,
        itemOpacity: 0.9,
        showBinWireframe: true,
        colorScheme: 'auto',
      });
      renderResultRef.current = renderResult;

      // Auto-fit camera based on bin dimensions
      const { width, height, depth } = packedBin.bin;
      const maxDim = Math.max(width, height, depth);
      const diagonal = Math.sqrt(width * width + height * height + depth * depth);
      const cameraDistance = diagonal * 1.5;

      const camera = components.camera;
      const camX = cameraDistance * 0.7;
      const camY = cameraDistance * 0.5;
      const camZ = cameraDistance * 0.7;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(width / 2, height / 2, depth / 2);

      if (components.controls && 'target' in components.controls) {
        const controls = components.controls as {
          target: { set: (x: number, y: number, z: number) => void };
          update: () => void;
          minDistance?: number;
          maxDistance?: number;
        };
        controls.target.set(width / 2, height / 2, depth / 2);
        controls.minDistance = maxDim * 0.5;
        controls.maxDistance = diagonal * 5;
        controls.update();
      }

      initialCameraRef.current = {
        position: { x: camX, y: camY, z: camZ },
        target: { x: width / 2, y: height / 2, z: depth / 2 },
      };

      // Start animation loop
      animate(
        components.renderer,
        components.scene,
        components.camera,
        components.controls
      );

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        components.handleResize();
      });
      resizeObserver.observe(containerRef.current);

      // Handle reset view event
      const canvas = components.renderer.domElement;
      const handleResetView = () => {
        if (initialCameraRef.current) {
          const { position, target } = initialCameraRef.current;
          camera.position.set(position.x, position.y, position.z);
          camera.lookAt(target.x, target.y, target.z);
          if (components.controls && 'target' in components.controls) {
            const controls = components.controls as { target: { set: (x: number, y: number, z: number) => void }; update: () => void };
            controls.target.set(target.x, target.y, target.z);
            controls.update();
          }
        }
      };
      canvas.addEventListener('resetView', handleResetView);

      // Setup raycasting for hover detection
      // Track mount state to avoid updating state after unmount
      let isMounted = true;
      import('three').then((module) => {
        if (!isMounted) return; // Component unmounted during import
        // Runtime validation - ensure required constructors exist
        if (!module.Raycaster || !module.Vector2 || !module.SphereGeometry || !module.MeshBasicMaterial || !module.Mesh) {
          console.error('Three.js module missing required constructors');
          if (isMounted) setThreeLoadError(true); // Guard state update
          return;
        }
        threeRef.current = module as unknown as ThreeModule;
        raycasterRef.current = {
          raycaster: new threeRef.current.Raycaster(),
          mouse: new threeRef.current.Vector2(),
        };
      }).catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load Three.js:', err);
        if (isMounted) setThreeLoadError(true); // Guard state update
      });

      // Cleanup function will set isMounted = false
      const cleanupThreeImport = () => { isMounted = false; };

      // Mouse move handler for hover detection
      const handleMouseMove = (event: MouseEvent) => {
        if (!raycasterRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.mouse.set(x, y);
        raycasterRef.current.raycaster.setFromCamera(
          raycasterRef.current.mouse,
          components.camera
        );

        const intersects = raycasterRef.current.raycaster.intersectObjects(
          components.scene.children,
          true
        );

        let foundItem: PlacedItem | null = null;
        for (const intersect of intersects) {
          const userData = intersect.object.userData;
          // Validate userData structure and itemId format (strict validation)
          if (
            userData &&
            typeof userData.itemId === 'string' &&
            userData.itemId.length > 0 &&
            userData.itemId.length < 256 && // Prevent excessively long IDs
            SAFE_ITEM_ID_PATTERN.test(userData.itemId) // Only allow safe characters
          ) {
            const item = packedBin.items.find((i) => i.item.id === userData.itemId);
            if (item) {
              foundItem = item;
              break;
            }
          }
        }

        if (foundItem) {
          setHoverInfo({
            item: foundItem,
            position: { x: event.clientX, y: event.clientY },
          });
          setHighlight({ itemId: foundItem.item.id, source: 'viewer' });
        } else {
          setHoverInfo(null);
          clearHighlight();
        }
      };

      const handleMouseLeave = () => {
        setHoverInfo(null);
        clearHighlight();
      };

      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        cleanupThreeImport(); // Mark as unmounted to prevent state updates
        resizeObserver.disconnect();
        canvas.removeEventListener('resetView', handleResetView);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        if (sceneRef.current) {
          sceneRef.current.dispose();
          sceneRef.current = null;
        }
        // Clear original positions for exploded view
        originalPositionsRef.current.clear();
      };
    } catch (error) {
      console.error('3D Viewer error:', error);
      return undefined;
    }
  }, [packedBin, resolvedTheme, webGLSupported, setHighlight, clearHighlight]);

  // Settings effect: Update scene without rebuilding
  useEffect(() => {
    const components = sceneRef.current;
    const renderResult = renderResultRef.current;
    if (!components || !renderResult) return;

    // Track mount state for async operations (dynamic Three.js import)
    let isEffectActive = true;

    // Toggle auto-rotate
    if (components.controls && 'autoRotate' in components.controls) {
      (components.controls as { autoRotate: boolean; autoRotateSpeed: number }).autoRotate = viewerSettings.autoRotate;
      (components.controls as { autoRotate: boolean; autoRotateSpeed: number }).autoRotateSpeed = 2;
    }

    // Toggle edges visibility and update opacity
    for (const itemMesh of renderResult.itemMeshes) {
      if (itemMesh.edges) {
        itemMesh.edges.visible = viewerSettings.showEdges;
      }
      // Update material opacity
      const material = itemMesh.mesh.material as { opacity?: number; transparent?: boolean; needsUpdate?: boolean };
      if (material && 'opacity' in material) {
        material.opacity = viewerSettings.itemOpacity;
        material.transparent = viewerSettings.itemOpacity < 1;
        material.needsUpdate = true;
      }
    }

    // Calculate bin center for exploded view
    const { width, height, depth } = packedBin.bin;
    const binCenterX = width / 2;
    const binCenterY = height / 2;
    const binCenterZ = depth / 2;

    // Layer calculation is memoized via useMemo (itemLayers, maxLayer)

    // Store original positions on first run if not already stored
    // Limit size to prevent memory issues with large datasets
    // Also clear if size exceeds limit (prevents memory leak from rapid settings changes)
    if (originalPositionsRef.current.size === 0 ||
        originalPositionsRef.current.size > MAX_ORIGINAL_POSITIONS) {
      // Clear to prevent memory leak from accumulated stale entries
      if (originalPositionsRef.current.size > MAX_ORIGINAL_POSITIONS) {
        originalPositionsRef.current.clear();
      }
      for (const itemMesh of renderResult.itemMeshes) {
        if (originalPositionsRef.current.size >= MAX_ORIGINAL_POSITIONS) {
          console.warn(`Original positions limit reached (${MAX_ORIGINAL_POSITIONS})`);
          break;
        }
        const mesh = itemMesh.mesh;
        const itemId = (mesh.userData as { itemId?: string })?.itemId;
        if (itemId && SAFE_ITEM_ID_PATTERN.test(itemId)) {
          originalPositionsRef.current.set(itemId, {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          });
        }
      }
    }

    // Apply exploded view and layer filter
    for (const itemMesh of renderResult.itemMeshes) {
      const mesh = itemMesh.mesh;
      const itemId = (mesh.userData as { itemId?: string })?.itemId;
      if (!itemId) continue;

      const originalPos = originalPositionsRef.current.get(itemId);
      if (!originalPos) continue;

      const layer = itemLayers.get(itemId) ?? 1;
      // maxLayer comes from useMemo

      // Apply layer filter visibility
      if (viewerSettings.layerFilter !== null) {
        const visible = layer <= viewerSettings.layerFilter;
        mesh.visible = visible;
        if (itemMesh.edges) {
          itemMesh.edges.visible = visible && viewerSettings.showEdges;
        }
      } else {
        mesh.visible = true;
        if (itemMesh.edges) {
          itemMesh.edges.visible = viewerSettings.showEdges;
        }
      }

      // Apply exploded view offset
      if (viewerSettings.explodedView) {
        // Calculate item center
        const placedItem = packedBin.items.find(i => i.item.id === itemId);
        if (placedItem) {
          const itemCenterX = originalPos.x + placedItem.item.width / 2;
          const itemCenterY = originalPos.y + placedItem.item.height / 2;
          const itemCenterZ = originalPos.z + placedItem.item.depth / 2;

          // Direction from bin center to item center
          const dirX = itemCenterX - binCenterX;
          const dirY = itemCenterY - binCenterY;
          const dirZ = itemCenterZ - binCenterZ;

          // Apply explode factor
          const factor = viewerSettings.explodeDistance - 1;
          mesh.position.set(
            originalPos.x + dirX * factor,
            originalPos.y + dirY * factor,
            originalPos.z + dirZ * factor
          );
        }
      } else {
        // Reset to original position
        mesh.position.set(originalPos.x, originalPos.y, originalPos.z);
      }
    }

    // Toggle grid visibility
    const gridHelper = components.scene.children.find(
      (child) => child.type === 'GridHelper'
    );
    if (gridHelper) {
      gridHelper.visible = viewerSettings.showGrid;
    }

    // Toggle center of gravity marker
    const existingCog = components.scene.children.find(
      (child) => (child as { name?: string }).name === 'centerOfGravity'
    );

    if (viewerSettings.showCenterOfGravity && packedBin.centerOfGravity) {
      if (!existingCog && threeRef.current) {
        const THREE = threeRef.current;
        const cog = packedBin.centerOfGravity;
        const { width, height, depth } = packedBin.bin;
        const markerSize = Math.max(width, height, depth) * 0.05;

        const geometry = new THREE.SphereGeometry(markerSize, 32, 32);
        const material = new THREE.MeshBasicMaterial({
          color: 0xff4444,
          depthTest: false,
        });
        const cogMesh = new THREE.Mesh(geometry, material);
        cogMesh.position.set(cog.x, cog.y, cog.z);
        cogMesh.name = 'centerOfGravity';
        cogMesh.renderOrder = 999;
        cogMeshRef.current = cogMesh;
        components.scene.add(cogMesh as never);
      } else if (!existingCog) {
        // THREE not loaded yet, load and create
        import('three').then((THREE) => {
          // Check if effect is still active (component not unmounted or re-rendered)
          if (!isEffectActive) return;

          // Runtime validation
          if (!THREE.SphereGeometry || !THREE.MeshBasicMaterial || !THREE.Mesh) {
            console.error('Three.js module missing required constructors');
            return;
          }
          threeRef.current = THREE as unknown as ThreeModule;
          const cog = packedBin.centerOfGravity;
          if (!cog) return;
          const { width, height, depth } = packedBin.bin;
          const markerSize = Math.max(width, height, depth) * 0.05;

          const geometry = new THREE.SphereGeometry(markerSize, 32, 32);
          const material = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            depthTest: false,
          });
          const cogMesh = new THREE.Mesh(geometry, material);
          cogMesh.position.set(cog.x, cog.y, cog.z);
          cogMesh.name = 'centerOfGravity';
          cogMesh.renderOrder = 999;
          cogMeshRef.current = cogMesh;
          components.scene.add(cogMesh);
        }).catch((err) => {
          if (!isEffectActive) return;
          console.error('Failed to load Three.js:', err);
        });
      }
    } else if (existingCog) {
      components.scene.remove(existingCog);
      cogMeshRef.current = null;
    }

    // Cleanup: mark effect as inactive to prevent async operations after unmount
    return () => {
      isEffectActive = false;
    };
  }, [viewerSettings, packedBin, itemLayers, maxLayer]);

  if (!webGLSupported) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="font-semibold">WebGL not supported</p>
          <p className="text-sm">Your browser or device does not support 3D rendering</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ minHeight: '400px' }}
      />
      {threeLoadError && (
        <div className="absolute bottom-2 left-2 rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          Hover detection unavailable
        </div>
      )}
      {hoverInfo && hoverInfo.item && (
        <HoverInfoCard
          position={hoverInfo.position}
          item={hoverInfo.item}
        />
      )}
    </>
  );
}

export function Viewer3D({ packedBin }: Viewer3DProps) {
  return (
    <Viewer3DErrorBoundary
      fallback={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="font-semibold">3D Viewer Error</p>
            <p className="text-sm">Failed to initialize 3D rendering</p>
          </div>
        </div>
      }
    >
      <Viewer3DImpl packedBin={packedBin} />
    </Viewer3DErrorBoundary>
  );
}
