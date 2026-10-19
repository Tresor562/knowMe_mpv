"""KnowMe procedural 3D asset factory. Blender 4.0+ background script.
Usage: blender -b --factory-startup --python tools/asset_factory/build.py -- --kind mascot --out dist/knowme-assets
"""
import argparse
import json
import math
import os
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector

def args():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--kind",choices=("mascot","crown"),required=True)
    parser.add_argument("--out",required=True)
    parser.add_argument("--frames",type=int,default=16)
    parser.add_argument("--size",type=int,default=440)
    return parser.parse_args(argv)

def material(name,rgba,metal=0.0,rough=0.4):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*rgba,1)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*rgba,1)
    bsdf.inputs["Metallic"].default_value=metal
    bsdf.inputs["Roughness"].default_value=rough
    return mat

def smooth(obj):
    if obj.type=="MESH":
        for poly in obj.data.polygons: poly.use_smooth=True
    return obj

def sphere(name,where,scale,mat,segments=24,rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=where)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    return smooth(obj)

def cube(name,where,scale,mat,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=where)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        m=obj.modifiers.new("Soft beveled edge","BEVEL");m.width=bevel;m.segments=3
        # Avoid Blender 4.0 auto-smooth warnings for weighted normals.
    obj.data.materials.append(mat)
    return obj

def cone(name,where,r1,r2,depth,mat,verts=40):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=where)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    bevel=o.modifiers.new("Soft edge","BEVEL");bevel.width=.035;bevel.segments=3
    return smooth(o)

def torus(name,where,major,minor,mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=12,location=where,major_radius=major,minor_radius=minor)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat);return smooth(o)

def make_armature():
    bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
    arm=bpy.context.object;arm.name="KnowMe_Mascot_Rig"
    eb=arm.data.edit_bones
    eb.remove(eb[0])
    specs=[
        ("Root",(0,0,.35),(0,0,.65),None),
        ("Torso",(0,0,.7),(0,0,1.75),"Root"),
        ("Head",(0,0,1.75),(0,0,2.65),"Torso"),
        ("Arm_L",(-.53,0,1.7),(-.9,0,1.15),"Torso"),
        ("Arm_R",(.53,0,1.7),(.9,0,1.15),"Torso"),
        ("Leg_L",(-.27,0,.85),(-.32,0,.23),"Root"),
        ("Leg_R",(.27,0,.85),(.32,0,.23),"Root"),
    ]
    for name,head,tail,parent in specs:
        b=eb.new(name);b.head=head;b.tail=tail;b.use_connect=False
        if parent:b.parent=eb[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for bone in arm.pose.bones:bone.rotation_mode="XYZ"
    return arm

def skin(obj,rig,bone):
    """100% weight mesh to a real Blender armature bone, not a moving PNG."""
    bpy.context.view_layer.update()
    world=obj.matrix_world.copy()
    obj.parent=rig
    obj.matrix_world=world
    vertex_group=obj.vertex_groups.new(name=bone)
    vertex_group.add(list(range(len(obj.data.vertices))),1.0,"REPLACE")
    mod=obj.modifiers.new("KnowMe skeletal skin","ARMATURE")
    mod.object=rig
    return obj

def make_mascot():
    purple=material("KnowMe lavender armor",(.34,.24,.86),.17,.35)
    lilac=material("Soft periwinkle",(.66,.57,1),.05,.46)
    cream=material("Warm ceramic face",(.96,.87,.73),0,.5)
    navy=material("Deep onyx uniform",(.055,.07,.15),.08,.39)
    dark=material("Eye pupils",(.02,.012,.042),.04,.13)
    white=material("Eye catchlights",(.98,.98,1),0,.15)
    pink=material("Cheeks",(.96,.37,.53),0,.58)
    gold=material("KnowMe gold accents",(.91,.52,.12),.78,.19)
    rig=make_armature()
    def part(o,b):skin(o,rig,b);return o
    part(sphere("Torso armor",(0,0,1.44),(.62,.43,.78),navy),"Torso")
    part(sphere("Chest shield",(0,-.39,1.52),(.39,.10,.36),purple),"Torso")
    part(cube("Chest emblem",(0,-.505,1.53),(.24,.04,.15),gold,.03),"Torso")
    part(sphere("Head",(0,-.04,2.3),(.67,.59,.62),lilac),"Head")
    part(sphere("Face plate",(0,-.52,2.27),(.52,.105,.43),cream),"Head")
    part(sphere("Left eye",(-.22,-.618,2.39),(.145,.055,.19),white),"Head")
    part(sphere("Right eye",(.22,-.618,2.39),(.145,.055,.19),white),"Head")
    part(sphere("Left iris",(-.20,-.672,2.38),(.085,.035,.12),dark),"Head")
    part(sphere("Right iris",(.24,-.672,2.38),(.085,.035,.12),dark),"Head")
    part(sphere("Eye shine L",(-.225,-.71,2.43),(.035,.015,.043),white),"Head")
    part(sphere("Eye shine R",(.215,-.71,2.43),(.035,.015,.043),white),"Head")
    part(sphere("Smile",(0,-.638,2.08),(.16,.023,.042),dark),"Head")
    for sign in (-1,1):
        side="L" if sign<0 else "R"
        part(sphere("Cheek_"+side,(sign*.41,-.61,2.16),(.095,.018,.055),pink),"Head")
        part(sphere("Ear_"+side,(sign*.53,-.08,2.75),(.21,.21,.30),purple),"Head")
        arm="Arm_"+side
        part(sphere("Shoulder_"+side,(sign*.67,0,1.63),(.26,.25,.25),purple),arm)
        part(sphere("Arm_"+side,(sign*.86,-.02,1.29),(.2,.2,.4),purple),arm)
        part(sphere("Mitten_"+side,(sign*.97,-.08,1.04),(.23,.22,.23),cream),arm)
        leg="Leg_"+side
        part(sphere("Leg_"+side,(sign*.28,0,.56),(.22,.25,.35),navy),leg)
        part(sphere("Shoe_"+side,(sign*.3,-.18,.25),(.30,.44,.20),purple),leg)
        part(sphere("Sole_"+side,(sign*.3,-.22,.13),(.31,.43,.075),white),leg)
    # Keyframes on a true armature. Exporter emits distinct glTF animation clips.
    def pose(frame,root=0,head=0,left=0,right=0,legs=0):
        values={"Root":(0,0,root),"Head":(0,head,0),"Arm_L":(0,left,0),"Arm_R":(0,right,0),
                "Leg_L":(legs,0,0),"Leg_R":(-legs,0,0)}
        for b in rig.pose.bones:
            b.location=(0,0,values.get(b.name,(0,0,0))[2]) if b.name=="Root" else (0,0,0)
            b.rotation_euler=(values.get(b.name,(0,0,0))[0],values.get(b.name,(0,0,0))[1],0)
            b.keyframe_insert(data_path="location",frame=frame,group=b.name)
            b.keyframe_insert(data_path="rotation_euler",frame=frame,group=b.name)
    for name,poses in (
        ("Idle",[(1,0,0,0,0,0),(9,.045,-.06,-.08,.08,0),(17,0,0,0,0,0)]),
        ("Wave",[(1,0,0,0,0,0),(5,.05,.12,0,-1.15,0),(9,0,-.05,0,-.55,0),(13,.05,.11,0,-1.18,0),(17,0,0,0,0,0)]),
        ("Celebrate",[(1,0,0,0,0,0),(5,-.08,0,.3,-.3,.1),(10,.3,-.08,-1.0,1.0,-.2),(13,.16,.05,-.6,.6,.12),(17,0,0,0,0,0)]),
    ):
        action=bpy.data.actions.new(name="KnowMe_"+name)
        rig.animation_data_create()
        rig.animation_data.action=action
        for f,z,h,l,r,leg in poses:pose(f,z,h,l,r,leg)
        for fc in action.fcurves:
            for pt in fc.keyframe_points:pt.interpolation="BEZIER"
        # Stash every action in a distinct NLA track for reliable glTF clip export.
        track=rig.animation_data.nla_tracks.new()
        track.name=action.name
        track.strips.new(action.name,1,action)
    rig.animation_data.action=None
    bpy.context.scene.frame_set(1)
    return rig

def make_crown():
    gold=material("Polished gold",(.84,.49,.095),.86,.16)
    pale=material("Gold rim highlight",(1,.81,.33),.67,.2)
    purple=material("Amethyst gems",(.41,.08,.76),.27,.095)
    lilac=material("Gem reflections",(.85,.41,1),.1,.13)
    dark=material("Crown deep inset",(.12,.045,.22),.3,.23)
    pivot=bpy.data.objects.new("KnowMe_Collectible_GiftPivot",None)
    bpy.context.collection.objects.link(pivot)
    pivot.location=(0,0,1.55)
    def attach(obj):
        matrix=obj.matrix_world.copy()
        obj.parent=pivot
        obj.matrix_world=matrix
    for z,r in ((1.10,.68),(1.35,.70),(1.57,.63)):
        attach(torus("Hand polished circlet",(0,0,z),r,.075,gold))
    attach(cone("Crown core",(0,0,1.45),.70,.54,.55,dark))
    for i in range(8):
        angle=i*math.tau/8
        x,y=math.cos(angle),math.sin(angle)
        height=2.27 if i%2==0 else 1.96
        o=cone("Golden crown point %02d"%i,(x*.6,y*.6,(1.55+height)/2),.18,.018,height-1.55,gold)
        attach(o)
        gem=sphere("Amethyst tip %02d"%i,(x*.6,y*.6,height),(.12,.12,.16),purple,16,10)
        attach(gem)
        pearl=sphere("Light glint %02d"%i,(x*.6-.03,y*.6-.06,height+.07),(.032,.025,.045),lilac,12,8)
        attach(pearl)
    for i in range(10):
        angle=i*math.tau/10
        gem=sphere("Faceted rim jewel %02d"%i,(math.cos(angle)*.70,math.sin(angle)*.70,1.36),(.10,.085,.13),purple,12,6)
        attach(gem)
    central=sphere("Central floating jewel",(0,-.62,1.84),(.26,.105,.36),purple,8,4);attach(central)
    attach(sphere("Central jewel sparkle",(-.07,-.74,2.02),(.06,.02,.09),lilac))
    pivot.animation_data_create()
    for name,points in (
        ("Orbit",[(1,0,0),(9,math.pi,0),(17,math.tau,0)]),
        ("Reveal",[(1,0,-.23),(5,.18,.17),(9,-.09,.15),(17,0,0)]),
    ):
        act=bpy.data.actions.new(name="KnowMe_"+name)
        pivot.animation_data.action=act
        for f,angle,rise in points:
            pivot.rotation_euler=(0,0,angle)
            pivot.location.z=1.55+rise
            pivot.keyframe_insert("rotation_euler",frame=f)
            pivot.keyframe_insert("location",frame=f)
        track=pivot.animation_data.nla_tracks.new()
        track.name=act.name
        track.strips.new(act.name,1,act)
    pivot.animation_data.action=None
    bpy.context.scene.frame_set(1)
    return pivot

def studio(kind):
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.samples=18
    # Ubuntu's packaged Blender may lack OpenImageDenoise.
    # Explicitly disable Cycles denoising instead of failing render.
    for view_layer in scene.view_layers:
        view_layer.cycles.use_denoising=False
    scene.render.film_transparent=True
    scene.world.color=(.09,.055,.17)
    def area(name,where,power,color,size):
        data=bpy.data.lights.new(name,"AREA");data.energy=power;data.color=color;data.shape="DISK";data.size=size
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=where;look(ob,(0,0,1.65))
    area("Soft key",(-3,-4,6),750,(.87,.84,1),5)
    area("Lavender rim",(3,2,5),1000,(.49,.37,1),3)
    area("Golden accent",(-2,2,3),600,(1,.69,.38),2)
    cam=bpy.data.cameras.new("Hero portrait camera");cam_obj=bpy.data.objects.new("Camera",cam)
    scene.collection.objects.link(cam_obj)
    cam_obj.location=(3.9,-7.7,3.4) if kind=="crown" else (3.4,-7.8,3.0)
    look(cam_obj,(0,0,1.55 if kind=="crown" else 1.43))
    cam.type="ORTHO";cam.ortho_scale=3.9 if kind=="mascot" else 3.8
    scene.camera=cam_obj
    scene.render.image_settings.file_format="PNG"
    scene.render.resolution_percentage=100
    scene.frame_start=1;scene.frame_end=17;scene.render.fps=12

def look(o,at):
    direction=Vector(at)-o.location
    o.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()

def export(kind,out,root,frames,size):
    scene=bpy.context.scene
    blender_file=out/(kind+".blend")
    bpy.ops.wm.save_as_mainfile(filepath=str(blender_file))
    # Lights and cameras are not part of the portable model.
    for obj in bpy.context.selected_objects:obj.select_set(False)
    for obj in scene.objects:
        if obj.type in ("MESH","ARMATURE") or obj==root or obj.parent==root:
            obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(out/(kind+".glb")),export_format="GLB",
        use_selection=True,export_animations=True,export_animation_mode="ACTIONS",
        export_frame_range=False,export_force_sampling=True,export_lights=False,export_cameras=False)
    # Mute NLA clips so the explicit preview action plays without stacking motions.
    if root.animation_data:
        for track in root.animation_data.nla_tracks:track.mute=True
    # Poster and short transparent turn/character clip for low-end clients.
    if root.animation_data and root.animation_data.action:
        preferred="KnowMe_Wave" if kind=="mascot" else "KnowMe_Orbit"
        action=bpy.data.actions.get(preferred)
        if action:root.animation_data.action=action
    scene.render.resolution_x=size;scene.render.resolution_y=size
    scene.frame_set(4)
    scene.render.filepath=str(out/(kind+".png"))
    bpy.ops.render.render(write_still=True)
    scene.render.resolution_x=min(size,300);scene.render.resolution_y=min(size,300)
    scene.cycles.samples=5
    scene.frame_start=1;scene.frame_end=max(8,min(frames,48))
    folder=out/("_"+kind+"_frames");folder.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(folder/"frame_")
    scene.render.image_settings.file_format="PNG"
    bpy.ops.render.render(animation=True)
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate","12",
        "-i",str(folder/"frame_%04d.png"),"-c:v","libvpx-vp9","-pix_fmt","yuva420p",
        "-b:v","0","-crf","33",str(out/(kind+".webm"))],check=True)
    import shutil
    shutil.rmtree(folder)
    return {"asset":kind,"source":kind+".blend","model":kind+".glb","poster":kind+".png",
            "video":kind+".webm","blender":bpy.app.version_string,
            "animation_names":["KnowMe_Idle","KnowMe_Wave","KnowMe_Celebrate"] if kind=="mascot" else ["KnowMe_Orbit","KnowMe_Reveal"]}

def main():
    a=args()
    if a.frames<8 or a.frames>48:raise ValueError("--frames must be 8..48")
    if a.size<128 or a.size>1024:raise ValueError("--size must be 128..1024")
    out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    bpy.context.scene.frame_set(1)
    root=make_mascot() if a.kind=="mascot" else make_crown()
    studio(a.kind)
    result=export(a.kind,out,root,a.frames,a.size)
    (out/(a.kind+".json")).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("KNOWME_ASSET_BUILT "+json.dumps(result))
if __name__=="__main__":main()
