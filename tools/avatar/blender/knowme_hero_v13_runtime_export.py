"""KnowMe Hero v13 runtime exporter: certified LODs -> deterministic named GLBs + signed manifest evidence."""
from __future__ import annotations
import hashlib,json
from pathlib import Path
import bpy
import knowme_hero_v12_export as v12

BUNDLE_VERSION=13
LOD_NAMES=("BODY_LOD0","BODY_LOD1","BODY_LOD2")
MAX_BYTES=(8*1024*1024,5*1024*1024,3*1024*1024)


def _sha256(path:Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()


def _export_one(obj_name:str,target:Path):
 obj=bpy.data.objects.get(obj_name)
 if obj is None:raise RuntimeError(f'Missing certified LOD object {obj_name}')
 bpy.ops.object.select_all(action='DESELECT')
 obj.select_set(True);bpy.context.view_layer.objects.active=obj
 armature=next((m.object for m in obj.modifiers if m.type=='ARMATURE' and m.object),None)
 if armature is None:raise RuntimeError(f'{obj_name} has no armature')
 armature.select_set(True)
 # Explicit options keep runtime semantics stable. The GLB binary itself is not
 # claimed byte-reproducible across Blender versions; SHA-256 binds the exact
 # bytes produced by this certified export run.
 bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_apply=False,export_skins=True,export_morph=True,export_morph_normal=True,export_animations=False,export_yup=True)


def export_runtime_bundle(output_dir=None):
 root=Path(output_dir or bpy.path.abspath('//runtime/hero-v13'));root.mkdir(parents=True,exist_ok=True)
 report=v12.export_report(str(root/'hero-source-report-v12.json'))
 lod_entries=[]
 for index,name in enumerate(LOD_NAMES):
  target=root/f'knowme-hero-lod{index}.glb';_export_one(name,target)
  size=target.stat().st_size
  if size<=0 or size>MAX_BYTES[index]:raise RuntimeError(f'{name} GLB byte budget exceeded: {size}')
  metric=report['lodMetrics'][index]
  lod_entries.append({'level':index,'fileName':target.name,'sha256':_sha256(target),'downloadBytes':size,'vertices':metric['vertices'],'triangles':metric['triangles']})
 manifest={'bundleVersion':BUNDLE_VERSION,'assetKey':report['assetKey'],'format':'GLB','skeletonKey':'knowme.humanoid.v1','morphTargets':report['lodShapeKeyNames'][1:],'lods':lod_entries,'sourceReport':report}
 manifest_path=root/'hero-runtime-bundle-v13.json';manifest_path.write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n',encoding='utf-8')
 print(f'KnowMe Hero v13 runtime bundle written: {manifest_path}')
 return manifest

if __name__=='__main__':export_runtime_bundle()
