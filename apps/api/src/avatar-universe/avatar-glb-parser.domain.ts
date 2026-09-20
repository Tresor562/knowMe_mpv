import { sha256AvatarGlb, AvatarGlbInspection } from './avatar-glb-inspection.domain';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const TRIANGLES = 4;

type Gltf = {
  accessors?: Array<{ count?: number }>;
  meshes?: Array<{ name?: string; primitives?: Array<{ mode?: number; indices?: number; attributes?: Record<string, number>; targets?: Array<Record<string, number>> }> }>;
  nodes?: Array<{ name?: string; mesh?: number; skin?: number }>;
  skins?: Array<{ joints?: number[] }>;
  materials?: Array<{ pbrMetallicRoughness?: unknown }>;
  textures?: unknown[];
  cameras?: unknown[];
  animations?: unknown[];
  extensions?: { KHR_lights_punctual?: { lights?: unknown[] } };
};

function integer(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Invalid GLB ${label}.`);
  return value as number;
}

function parseJsonChunk(bytes: Uint8Array): Gltf {
  if (bytes.byteLength < 20) throw new Error('GLB is truncated.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Invalid GLB magic.');
  if (view.getUint32(4, true) !== 2) throw new Error('Only glTF 2.0 GLB is supported.');
  if (view.getUint32(8, true) !== bytes.byteLength) throw new Error('GLB declared length does not match binary length.');
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK || 20 + length > bytes.byteLength) throw new Error('GLB JSON chunk is missing or truncated.');
  try { return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)).trim()) as Gltf; }
  catch { throw new Error('GLB JSON chunk is invalid.'); }
}

export function inspectAvatarGlb(bytes: Uint8Array): AvatarGlbInspection {
  const gltf = parseJsonChunk(bytes);
  const accessors = gltf.accessors ?? [];
  const meshes = gltf.meshes ?? [];
  const primitives = meshes.flatMap(mesh => mesh.primitives ?? []);
  let triangles = 0;
  let vertices = 0;
  let maxBonesPerVertex = 0;
  const morphTargets = new Set<string>();

  for (const primitive of primitives) {
    if ((primitive.mode ?? TRIANGLES) !== TRIANGLES) throw new Error('Avatar GLB primitives must use TRIANGLES mode.');
    const positionAccessor = primitive.attributes?.POSITION;
    if (positionAccessor === undefined) throw new Error('Avatar GLB primitive is missing POSITION.');
    const vertexCount = integer(accessors[positionAccessor]?.count, 'POSITION accessor count');
    vertices += vertexCount;
    if (primitive.indices === undefined) throw new Error('Avatar GLB primitive must be indexed.');
    const indexCount = integer(accessors[primitive.indices]?.count, 'index accessor count');
    if (indexCount % 3 !== 0) throw new Error('Avatar GLB triangle index count must be divisible by 3.');
    triangles += indexCount / 3;
    const attrs = primitive.attributes ?? {};
    if (attrs.JOINTS_0 !== undefined || attrs.WEIGHTS_0 !== undefined) {
      if (attrs.JOINTS_0 === undefined || attrs.WEIGHTS_0 === undefined) throw new Error('Avatar GLB JOINTS_0 and WEIGHTS_0 must be paired.');
      maxBonesPerVertex = Math.max(maxBonesPerVertex, 4);
    }
    if (attrs.JOINTS_1 !== undefined || attrs.WEIGHTS_1 !== undefined) maxBonesPerVertex = Math.max(maxBonesPerVertex, 8);
    const targetNames = (meshes.find(mesh => mesh.primitives?.includes(primitive)) as any)?.extras?.targetNames as string[] | undefined;
    const targetCount = primitive.targets?.length ?? 0;
    if (targetCount && (!targetNames || targetNames.length !== targetCount)) throw new Error('Avatar GLB morph targets require exact mesh extras.targetNames.');
    targetNames?.forEach(name => morphTargets.add(name));
  }

  const joints = new Set<string>();
  for (const skin of gltf.skins ?? []) for (const nodeIndex of skin.joints ?? []) {
    const name = gltf.nodes?.[nodeIndex]?.name;
    if (!name) throw new Error('Avatar GLB skin joints must have stable node names.');
    joints.add(name);
  }
  const materials = gltf.materials ?? [];
  const lights = gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
  return {
    sha256: sha256AvatarGlb(bytes), byteLength: bytes.byteLength, triangles, vertices,
    meshes: meshes.length, primitives: primitives.length, materials: materials.length,
    textures: gltf.textures?.length ?? 0, joints: [...joints], morphTargets: [...morphTargets].sort(),
    maxBonesPerVertex, cameras: gltf.cameras?.length ?? 0, lights,
    animations: gltf.animations?.length ?? 0, skins: gltf.skins?.length ?? 0,
    pbrMetallicRoughness: materials.length > 0 && materials.every(material => material.pbrMetallicRoughness !== undefined),
  };
}
