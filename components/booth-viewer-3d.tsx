'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { BoothConfig } from '@/lib/types';
import { buildBoothScene } from '@/lib/booth-geometry';
import { exportToGLB, exportToUSDZ, downloadBlob } from '@/lib/export-3d';

// ─── Inner Scene Component ───────────────────────────────────────────────────

function BoothModel({ config, sceneRef }: { config: BoothConfig; sceneRef: React.MutableRefObject<THREE.Group | null> }) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    // Clear previous children
    while (groupRef.current.children.length) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    const boothGroup = buildBoothScene(config);
    groupRef.current.add(boothGroup);
    sceneRef.current = groupRef.current;
  }, [config, sceneRef]);

  return <group ref={groupRef} />;
}

function CameraSetup({ config }: { config: BoothConfig }) {
  const { camera } = useThree();

  useEffect(() => {
    const cx = config.width / 2;
    const cz = config.depth / 2;
    camera.position.set(
      config.width * -0.6,
      config.wallHeight * 1.8,
      config.depth * -0.6
    );
    (camera as THREE.PerspectiveCamera).lookAt(cx, config.wallHeight * 0.4, cz);
  }, [config, camera]);

  return null;
}

// ─── Exported Viewer Component ───────────────────────────────────────────────

export interface BoothViewer3DHandle {
  exportGLB: () => Promise<void>;
  exportUSDZ: () => Promise<void>;
}

interface BoothViewer3DProps {
  config: BoothConfig;
  name?: string;
  onReady?: (handle: BoothViewer3DHandle) => void;
}

const BoothViewer3D = forwardRef<BoothViewer3DHandle, BoothViewer3DProps>(
  function BoothViewer3D({ config, name, onReady }, ref) {
    const sceneRef = useRef<THREE.Group | null>(null);

    const doExportGLB = useCallback(async () => {
      if (!sceneRef.current) return;
      const blob = await exportToGLB(sceneRef.current);
      downloadBlob(blob, `${(name || config.boothName || 'booth').replace(/\s+/g, '_')}.glb`);
    }, [config.boothName, name]);

    const doExportUSDZ = useCallback(async () => {
      if (!sceneRef.current) return;
      const blob = await exportToUSDZ(sceneRef.current);
      downloadBlob(blob, `${(name || config.boothName || 'booth').replace(/\s+/g, '_')}.usdz`);
    }, [config.boothName, name]);

    useImperativeHandle(ref, () => ({
      exportGLB: doExportGLB,
      exportUSDZ: doExportUSDZ,
    }), [doExportGLB, doExportUSDZ]);

    // Callback-based ref for when forwarded ref doesn't work (next/dynamic)
    useEffect(() => {
      if (onReady) {
        onReady({ exportGLB: doExportGLB, exportUSDZ: doExportUSDZ });
      }
    }, [onReady, doExportGLB, doExportUSDZ]);

    return (
      <div style={{ width: '100%', height: '100%', minHeight: 400, background: '#1a1a1f', borderRadius: 10, overflow: 'hidden' }}>
        <Canvas
          shadows
          camera={{ fov: 45, near: 0.1, far: 200 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          <CameraSetup config={config} />

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[config.width * 2, config.wallHeight * 3, -config.depth]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
          />
          <directionalLight position={[-5, 8, 5]} intensity={0.3} />
          <hemisphereLight args={[0xffffff, 0x444444, 0.4]} />

          {/* Booth */}
          <BoothModel config={config} sceneRef={sceneRef} />

          {/* Ground */}
          <ContactShadows
            position={[config.width / 2, 0, config.depth / 2]}
            opacity={0.35}
            scale={Math.max(config.width, config.depth) * 2}
            blur={2}
            far={10}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color={0x2a2a2f} roughness={0.9} />
          </mesh>

          {/* Grid */}
          <gridHelper
            args={[40, 40, 0x444444, 0x333333]}
            position={[0, -0.005, 0]}
          />

          {/* Controls */}
          <OrbitControls
            target={[config.width / 2, config.wallHeight * 0.4, config.depth / 2]}
            maxPolarAngle={Math.PI * 0.48}
            minDistance={2}
            maxDistance={50}
            enableDamping
          />
        </Canvas>
      </div>
    );
  }
);

export default BoothViewer3D;
