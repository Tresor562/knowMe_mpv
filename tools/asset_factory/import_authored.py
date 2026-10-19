"""Load *artist-authored* licensed GLB assets into Blender; preserve UV/PBR/materials/rig.

Unlike build.py, this module NEVER constructs an anatomy from primitives.
Input must come from download_authored.py with registry provenance.
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector

def arguments():
    p=argparse.ArgumentParser()
    p.add_argument("--key",required=True,choices=("artist_hero","artist_tactical","gift_car"))
    p.add_argument("--sources",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--size",type=int,default=300)
    p.add_argument("--frames",type=int,default=8)
    return p.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])

def scene_setup():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.samples=8
    scene.render.film_transparent=True
    for layer in scene.view_layers: layer.cycles.use_denoising=False
    scene.render.image_settings.file_format="PNG"
    scene.render.fps=12
    scene.render.resolution_percentage=100
    return scene

def bounds(meshes):
    all_pts=[]
    for obj in meshes:
        for v in obj.bound_box:
            all_pts.append(obj.matrix_world @ Vector(v))
    if not all_pts: raise RuntimeError("Artist source has no mesh bounds")
    mn=Vector(tuple(min(p[i] for p in all_pts) for i in range(3)))
    mx=Vector(tuple(max(p[i] for p in all_pts) for i in range(3)))
    return mn,mx

def look(obj,at):
    v=Vector(at)-obj.location
    obj.rotation_euler=v.to_track_quat("-Z","Y").to_euler()

def area(name,xyz,energy,rgb,size,target):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=energy;data.color=rgb;data.shape="DISK";data.size=size
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=xyz
    look(ob,target)

def authored(key,source):
    bpy.ops.import_scene.gltf(filepath=str(source))
    # The upstream games contain presentation/debug meshes in their GLBs.
    # Do NOT let those outliers blow up the bounding box and shrink the real art.
    discard={
        "artist_hero":{"Icosphere"},
        "artist_tactical":{"0","Icosphere"},
        "gift_car":{"Fabric"},
    }.get(key,set())
    for obj in list(bpy.context.scene.objects):
        if obj.type=="MESH" and obj.name in discard:
            print("ARTIST_ASSET_REMOVE_NON_HERO_SUBMESH",key,obj.name)
            bpy.data.objects.remove(obj,do_unlink=True)
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    assert meshes, "No authored mesh in imported GLB"
    all_objs=[o for o in bpy.context.scene.objects if o.type in {"MESH","ARMATURE","EMPTY"}]
    all_objs_set=set(all_objs)
    pre_skins=sum(any(m.type=="ARMATURE" for m in o.modifiers) for o in meshes)
    originals=[o for o in all_objs if o.parent not in all_objs_set]
    imported_actions=list(bpy.data.actions)
    root=bpy.data.objects.new("KnowMe_ArtistOriginal_Parent",None)
    bpy.context.collection.objects.link(root)
    bpy.context.view_layer.update()
    for obj in originals:
        m=obj.matrix_world.copy()
        obj.parent=root
        obj.matrix_world=m
    bpy.context.view_layer.update()
    lo,hi=bounds(meshes)
    print("ARTIST_RAW_BOUNDS",key,tuple(round(x,4) for x in lo),tuple(round(x,4) for x in hi))
    width=max(hi.x-lo.x,hi.y-lo.y)
    height=hi.z-lo.z
    length=max(width,height)
    # Model authors use different units (meters, centimeters, tiny glTF sample units).
    assert 0.0001<length<10000, ("unexpected scene dimensions",length)
    factor=(2.55/length if key!="gift_car" else 1.6/length)
    root.scale=(factor,)*3
    bpy.context.view_layer.update()
    lo,hi=bounds(meshes)
    root.location.x-=.5*(lo.x+hi.x)
    root.location.y-=.5*(lo.y+hi.y)
    root.location.z-=lo.z
    bpy.context.view_layer.update()
    print("ARTIST_NORMALIZED_BOUNDS",key,tuple(round(x,4) for x in bounds(meshes)[0]),tuple(round(x,4) for x in bounds(meshes)[1]))
    # Source rigged clips often start with all imported NLA strips active,
    # combining dozens of animations into one broken pose.
    # Preview one neutral/idle clip but keep all source actions for GLB export.
    for obj in all_objs:
        ad=obj.animation_data
        if ad is None:continue
        for track in ad.nla_tracks:track.mute=True
        if imported_actions and obj.type=="ARMATURE":
            idle=next((ac for ac in imported_actions
                if ac.name.startswith("idle_") or ac.name=="idle"),None)
            if idle is not None:ad.action=idle
    # A rigid turntable is a preview-only animation for UNRIGGED art.
    # For skinned characters, preserve the artist's original animation clips unchanged.
    if not imported_actions:
        root.animation_data_create()
        act=bpy.data.actions.new(name="KnowMe_Showroom_Turntable")
        root.animation_data.action=act
        for f,a in ((1,0),(9,math.pi),(17,math.tau)):
            root.rotation_euler.z=a
            root.keyframe_insert(data_path="rotation_euler",frame=f)
        track=root.animation_data.nla_tracks.new()
        track.name=act.name
        track.strips.new(act.name,1,act)
        root.animation_data.action=None
    mats={m.name for o in meshes for m in o.data.materials if m}
    images={image.name for image in bpy.data.images if image.source=="FILE" and image.has_data}
    uv_count=sum(bool(o.data.uv_layers) for o in meshes)
    # Do not hide a broken source by reconstructing it with spheres.
    if key=="artist_hero":
        assert pre_skins and imported_actions, "Hero source lost rig or animation"
    if key=="artist_tactical":
        assert len(images)>0 or len(mats)>3, "Missing authored material / texture details"
    return root,{"source_meshes":len(meshes),"artist_mesh_names":[o.name for o in meshes][:50],
                  "original_skeletal_meshes":pre_skins,"original_actions":[a.name for a in imported_actions],
                  "original_images":sorted(images),"materials":sorted(mats),
                  "uv_mesh_count":uv_count}

def render_scene(key,scene,mesh_count):
    scene.world.color=(.08,.06,.13)
    scene.frame_set(1)
    meshes=[o for o in scene.objects if o.type=="MESH"]
    low,high=bounds(meshes)
    middle=(low+high)*.5
    extent=high-low
    span=max(float(extent.x),float(extent.y),float(extent.z),.001)
    print("ARTIST_RENDER_BOUNDS",key,"center",tuple(round(a,4) for a in middle),
          "extent",tuple(round(a,4) for a in extent))
    # Camera and lights follow actual imported author geometry, including unusual
    # source units/origins. A static camera made skinned assets render completely blank.
    area("Gallery key",middle+Vector((-span*1.5,-span*2,span*2.5)),900,(.97,.9,.75),span*2,middle)
    area("Blue rim",middle+Vector((span*1.5,span*2,span*2)),1200,(.48,.56,1),span*1.7,middle)
    area("White fill",middle+Vector((span*1.4,-span*1.8,span*.7)),480,(.94,.96,1),span*2.5,middle)
    cam=bpy.data.cameras.new("Product camera")
    obj=bpy.data.objects.new("Camera",cam)
    scene.collection.objects.link(obj)
    obj.location=middle+Vector((span*1.3,-span*3.5,span*1.2))
    look(obj,middle)
    cam.type="ORTHO"
    cam.ortho_scale=max(float(extent.z)*1.35,float(max(extent.x,extent.y))*1.85,.25)
    cam.clip_end=max(500.0,span*10)
    scene.camera=obj

def produce(a,registry):
    scene=scene_setup()
    source=a.sources/(a.key+".glb")
    source_metadata=registry[a.key]
    root,stats=authored(a.key,source)
    render_scene(a.key,scene,stats["source_meshes"])
    a.out.mkdir(parents=True,exist_ok=True)
    bpy.context.scene.frame_set(1)
    # Pack all imported images into the editable Blender source, preserving source UVs.
    try:
        bpy.ops.file.pack_all()
    except Exception as exc:
        raise RuntimeError("Could not pack original textures in BLEND") from exc
    bpy.ops.wm.save_as_mainfile(filepath=str(a.out/(a.key+".blend")))
    for obj in bpy.context.selected_objects:obj.select_set(False)
    for ob in scene.objects:
        if ob.type in {"MESH","ARMATURE"} or ob==root or (ob.type=="EMPTY" and ob.name!="Camera"):
            ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(a.out/(a.key+".glb")),export_format="GLB",use_selection=True,
        export_animations=True,export_animation_mode="ACTIONS",export_force_sampling=True,
        export_lights=False,export_cameras=False)
    # Capture an actual object frame from the artist scene; not an impostor replacing the GLB.
    if root.animation_data:
        for track in root.animation_data.nla_tracks:track.mute=True
    scene.render.resolution_x=a.size;scene.render.resolution_y=a.size
    scene.cycles.samples=10
    scene.frame_set(1)
    scene.render.filepath=str(a.out/(a.key+".png"))
    bpy.ops.render.render(write_still=True)
    output={"asset":a.key,"provenance":source_metadata,"import_stats":stats,
            "source":a.key+".blend","model":a.key+".glb","poster":a.key+".png",
            "blender":bpy.app.version_string}
    (a.out/(a.key+".json")).write_text(json.dumps(output,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("KNOWME_ARTIST_ASSET_BUILT "+json.dumps({k:v for k,v in output.items() if k!="provenance"}))

if __name__=="__main__":
    arg=arguments()
    registry=json.loads((arg.sources/"provenance.json").read_text(encoding="utf-8"))
    produce(arg,registry)
