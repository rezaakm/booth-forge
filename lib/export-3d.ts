import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

export async function exportToGLB(scene: THREE.Object3D): Promise<Blob> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true });
  return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
}

export async function exportToUSDZ(scene: THREE.Object3D): Promise<Blob> {
  const exporter = new USDZExporter();
  const arraybuffer = await exporter.parseAsync(scene);
  return new Blob([arraybuffer as unknown as BlobPart], { type: 'model/vnd.usdz+zip' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
