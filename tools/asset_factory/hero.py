"""KnowMe original anime-inspired hero. A genuine Blender armature/skinned 3D mesh asset.
Not a Genshin/GTA model, nor a substitute for hand-sculpted production art.
Blender >= 4.0; built by build.py --kind hero.
"""
import math
import bpy
from mathutils import Vector
from build import material, sphere, cube, cone, skin

def hero():
    mats={
        "skin":material("Warm skin • PBR",(.71,.39,.24),0,.49),
        "skinLight":material("Soft highlight",(.91,.61,.40),0,.5),
        "hair":material("Midnight indigo hair",(.042,.027,.104),.08,.32),
        "hairHL":material("Indigo-blue hair sheen",(.115,.12,.32),.09,.23),
        "coat":material("Royal ink embroidered jacket",(.036,.048,.14),.06,.37),
        "inner":material("Silk porcelain tunic",(.90,.84,.70),.02,.5),
        "sleeve":material("Velvet violet sleeve",(.19,.13,.38),.05,.63),
        "gold":material("Brushed champagne gold",(.76,.47,.17),.73,.23),
        "goldLight":material("Polished gold linework",(.97,.76,.34),.83,.15),
        "boot":material("Black leather boots",(.033,.026,.046),.05,.25),
        "sole":material("Sole piping",(.23,.16,.29),.04,.62),
        "gem":material("Iridescent violet jewel",(.46,.13,.82),.24,.12),
        "iris":material("Amber luminous iris",(.47,.26,.055),.15,.13),
        "pupil":material("Iris and eyebrows black",(.021,.01,.033),.06,.14),
        "white":material("Iridescent catchlight",(.98,.96,1),0,.13),
        "rose":material("Warm lip",(.49,.18,.16),0,.61),
        "cape":material("Royal silk mantle",(.17,.14,.43),.08,.47),
        "capeLining":material("Mantle inner fabric",(.42,.28,.69),0,.57),
    }
    bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
    rig=bpy.context.object;rig.name="KnowMe_Hero_FullBody_Armature"
    bones=rig.data.edit_bones
    bones.remove(bones[0])
    spec=[
        ("Root",(0,0,.22),(0,0,.42),None),
        ("Pelvis",(0,0,.82),(0,0,1.11),"Root"),
        ("Spine",(0,0,1.1),(0,0,1.6),"Pelvis"),
        ("Chest",(0,0,1.6),(0,0,2.04),"Spine"),
        ("Neck",(0,0,2.03),(0,0,2.20),"Chest"),
        ("Head",(0,0,2.19),(0,0,2.88),"Neck"),
        ("HairRear.L",(-.22,.14,2.94),(-.42,.19,2.34),"Head"),
        ("HairRear.R",(.22,.14,2.94),(.42,.19,2.34),"Head"),
        ("HairFront.L",(-.18,-.19,2.96),(-.25,-.44,2.52),"Head"),
        ("HairFront.R",(.18,-.19,2.96),(.25,-.44,2.52),"Head"),
        ("Cape.L",(-.42,.18,1.98),(-.57,.24,1.04),"Chest"),
        ("Cape.R",(.42,.18,1.98),(.57,.24,1.04),"Chest"),
        ("Brow.L",(-.16,-.35,2.75),(-.17,-.39,2.71),"Head"),
        ("Brow.R",(.16,-.35,2.75),(.17,-.39,2.71),"Head"),
        ("Eyelid.L",(-.16,-.40,2.62),(-.16,-.47,2.59),"Head"),
        ("Eyelid.R",(.16,-.40,2.62),(.16,-.47,2.59),"Head"),
        ("Jaw",(0,-.18,2.43),(0,-.27,2.33),"Head"),
    ]
    for s in (-1,1):
        side="L" if s<0 else "R"
        spec.extend([
            ("UpperArm."+side,(s*.45,0,1.94),(s*.74,0,1.59),"Chest"),
            ("Forearm."+side,(s*.74,0,1.59),(s*.94,-.06,1.29),"UpperArm."+side),
            ("Hand."+side,(s*.94,-.06,1.29),(s*1.01,-.09,1.08),"Forearm."+side),
            ("Thumb."+side,(s*.96,-.13,1.22),(s*.82,-.22,1.13),"Hand."+side),
            ("Finger."+side,(s*1.01,-.09,1.10),(s*1.045,-.10,1.01),"Hand."+side),
            ("Thigh."+side,(s*.2,0,.93),(s*.28,0,.52),"Pelvis"),
            ("Shin."+side,(s*.28,0,.52),(s*.27,0,.18),"Thigh."+side),
            ("Foot."+side,(s*.27,0,.18),(s*.27,-.28,.13),"Shin."+side),
            ("Toe."+side,(s*.27,-.28,.13),(s*.27,-.37,.13),"Foot."+side)
        ])
    for name,head,tail,parent in spec:
        b=bones.new(name);b.head=head;b.tail=tail;b.use_connect=False
        if parent:b.parent=bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for b in rig.pose.bones:b.rotation_mode="XYZ"
    rig.show_in_front=True
    def part(obj,bone):skin(obj,rig,bone);return obj
    def sph(name,pos,scale,m,bone,seg=32,ring=20):
        return part(sphere(name,pos,scale,mats[m],seg,ring),bone)
    def bx(name,pos,scale,m,bone,bevel=.05):
        return part(cube(name,pos,scale,mats[m],bevel),bone)
    def rod(name,start,end,radius,m,bone,tip=None):
        p,q=Vector(start),Vector(end);axis=q-p
        bpy.ops.mesh.primitive_cone_add(vertices=18,radius1=radius,radius2=radius if tip is None else tip,
            depth=axis.length,location=(p+q)/2)
        obj=bpy.context.object;obj.name=name
        obj.rotation_euler=axis.to_track_quat("Z","Y").to_euler()
        obj.data.materials.append(mats[m])
        bevel=obj.modifiers.new("Cloth silhouette or trim rounding","BEVEL")
        bevel.width=min(radius*.22,.025);bevel.segments=2
        for pol in obj.data.polygons:pol.use_smooth=True
        return part(obj,bone)
    def line(name,coords,width,m,bone):
        cv=bpy.data.curves.new(name,"CURVE");cv.dimensions="3D";cv.resolution_u=16
        cv.bevel_depth=width;cv.resolution_u=12;cv.bevel_resolution=2
        spline=cv.splines.new("BEZIER");spline.bezier_points.add(len(coords)-1)
        for b,p in zip(spline.bezier_points,coords):
            b.co=p;b.handle_left_type="AUTO";b.handle_right_type="AUTO"
        ob=bpy.data.objects.new(name,cv);bpy.context.collection.objects.link(ob)
        bpy.context.view_layer.objects.active=ob;ob.select_set(True)
        bpy.ops.object.convert(target="MESH");ob=bpy.context.object
        ob.data.materials.append(mats[m]);ob.select_set(False)
        return part(ob,bone)
    def gem(name,pos,scale,bone):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=pos)
        ob=bpy.context.object;ob.name=name;ob.scale=scale
        ob.data.materials.append(mats["gem"])
        return part(ob,bone)
    # Balanced human proportions. 3.1 Blender units tall, independent eyes/hands/jaw/hair.
    sph("Pelvis armour",(0,0,1.08),(.39,.26,.26),"coat","Pelvis")
    sph("Waist fit",(0,0,1.38),(.34,.245,.37),"coat","Spine")
    sph("Hero chest",(0,0,1.79),(.49,.3,.40),"coat","Chest")
    sph("Inner vest",(0,-.268,1.72),(.24,.07,.36),"inner","Chest")
    sph("High collar",(0,0,2.05),(.25,.25,.16),"inner","Neck")
    sph("Neck skin",(0,-.01,2.15),(.135,.14,.16),"skin","Neck")
    # Tapered tunic panel, dual shoulder armour, layered shoulder straps.
    bx("Cross waist sash",(0,-.27,1.32),(.73,.09,.13),"gold","Spine",.04)
    for i in range(7):
        x=-.27+i*.09
        line("Jacket piping %02d"%i,[(x,-.295,1.57),(x+.01,-.310,1.71),(x+.023,-.31,1.95)],.006,"goldLight","Chest")
    line("Central lapel trim",[(0,-.33,2.02),(-.11,-.33,1.79),(0,-.327,1.48)],.013,"gold","Chest")
    gem("Amethyst chest talisman",(0,-.382,1.69),(.092,.043,.15),"Chest")
    for sign in (-1,1):
        side="L" if sign<0 else "R"
        sph("Gold shoulder cap "+side,(sign*.50,.00,1.95),(.20,.26,.15),"gold","Chest")
        sph("Satin upper arm "+side,(sign*.68,0,1.73),(.17,.17,.28),"sleeve","UpperArm."+side)
        rod("Upper arm "+side,(sign*.70,0,1.81),(sign*.82,-.02,1.51),.14,"sleeve","UpperArm."+side,.117)
        sph("Elbow "+side,(sign*.82,-.02,1.48),(.16,.16,.14),"coat","Forearm."+side)
        rod("Embroidered forearm "+side,(sign*.84,-.02,1.50),(sign*.98,-.065,1.27),.155,"sleeve","Forearm."+side,.107)
        sph("Cuff "+side,(sign*.98,-.06,1.27),(.145,.14,.085),"gold","Forearm."+side)
        sph("Palm "+side,(sign*1.025,-.095,1.145),(.125,.09,.15),"skin","Hand."+side)
        for finger in range(4):
            x=1.0+finger*.041-.061
            rod("Finger %s %s"%(side,finger),(sign*x,-.106,1.09),
                (sign*(x+.018),-.12,1.005+.008*finger),.027,"skin","Finger."+side,.017)
        rod("Thumb "+side,(sign*.95,-.13,1.21),(sign*.83,-.22,1.11),.045,"skin","Thumb."+side,.023)
        sph("Thigh trousers "+side,(sign*.20,0,.78),(.213,.22,.36),"coat","Thigh."+side)
        rod("Leg shaping "+side,(sign*.24,0,.73),(sign*.27,0,.44),.185,"coat","Thigh."+side,.16)
        sph("Knee guard "+side,(sign*.28,-.09,.50),(.18,.15,.12),"gold","Shin."+side)
        rod("Lower leg "+side,(sign*.275,0,.48),(sign*.27,0,.20),.18,"boot","Shin."+side,.14)
        sph("Ankle "+side,(sign*.27,-.03,.20),(.16,.175,.13),"boot","Foot."+side)
        sph("Boot "+side,(sign*.27,-.16,.135),(.21,.33,.115),"boot","Foot."+side)
        bx("Boot outsole "+side,(sign*.27,-.19,.082),(.43,.60,.07),"sole","Foot."+side,.025)
        line("Boot metallic filigree "+side,[(sign*.12,-.17,.24),(sign*.27,-.185,.34),(sign*.43,-.17,.24)],.015,"goldLight","Shin."+side)
        bx("Belt buckle "+side,(sign*.31,-.28,1.325),(.12,.06,.13),"goldLight","Pelvis",.02)
        sph("Mantle fold outer "+side,(sign*.40,.21,1.42),(.21,.07,.60),"cape","Cape."+side)
        sph("Mantle inner lining "+side,(sign*.37,.27,1.4),(.16,.05,.52),"capeLining","Cape."+side)
        line("Mantle golden edge "+side,[(sign*.49,.24,2.00),(sign*.52,.26,1.65),(sign*.55,.29,1.20),(sign*.39,.29,.93)],.014,"gold","Cape."+side)
    # Custom expressive head: independent eyes, brows, lid control bones, volumetric hair.
    sph("Hand sculpted style face",(0,-.06,2.54),(.43,.35,.55),"skin","Head")
    sph("Chin plane",(0,-.28,2.30),(.26,.12,.15),"skinLight","Head")
    sph("Bridge of nose",(0,-.405,2.47),(.065,.075,.13),"skinLight","Head")
    sph("Nose tip",(0,-.47,2.42),(.085,.065,.05),"skin","Head")
    sph("Upper lip",(0,-.425,2.32),(.16,.03,.025),"rose","Jaw")
    sph("Lower lip",(0,-.419,2.285),(.145,.03,.017),"skinLight","Jaw")
    for sign in (-1,1):
        side="L" if sign<0 else "R"
        sph("Ear "+side,(sign*.423,-.07,2.53),(.085,.11,.16),"skin","Head")
        sph("Almond sclera "+side,(sign*.175,-.367,2.62),(.137,.077,.125),"white","Head")
        sph("Gold iris "+side,(sign*.175,-.427,2.62),(.078,.033,.103),"iris","Head")
        sph("Cat pupil "+side,(sign*.175,-.454,2.626),(.041,.017,.072),"pupil","Head")
        sph("Twin catchlight "+side,(sign*.15,-.477,2.665),(.028,.012,.031),"white","Head")
        line("Graphic upper lashes "+side,[(sign*.058,-.426,2.699),(sign*.175,-.424,2.738),
            (sign*.290,-.382,2.706)],.018,"pupil","Head")
        line("Articulated eyelid "+side,[(sign*.075,-.414,2.702),(sign*.17,-.434,2.69),
            (sign*.28,-.413,2.700)],.020,"skin","Eyelid."+side)
        line("Layered brow "+side,[(sign*.08,-.37,2.814),(sign*.19,-.377,2.835),
            (sign*.305,-.32,2.813)],.025,"hair","Brow."+side)
        sph("Subtle cheek volume "+side,(sign*.315,-.315,2.41),(.103,.025,.068),"skinLight","Head")
        gem("Hanging earring "+side,(sign*.445,-.09,2.34),(.045,.033,.115),"Head")
        line("Earring loop "+side,[(sign*.423,-.095,2.48),(sign*.46,-.08,2.42),
            (sign*.45,-.09,2.37)],.009,"goldLight","Head")
    # Layered coiffure: scalp + individually tapered locks with controlled trailing bones.
    sph("Base indigo hair cap",(0,.08,2.84),(.45,.355,.285),"hair","Head")
    for i in range(17):
        x=(i-8)*.054
        side="L" if x<0 else "R"
        sx=max(-.38,min(.38,x))
        peak=2.95+.105*math.sin(i*.74)
        line("Anisotropic hair strand %02d"%i,[(sx*.8,-.09,3.01),
            (sx,-.31,peak),(sx*1.08,-.38,2.70+.075*math.cos(i*.58))],
            .030 if i%3 else .046,"hairHL" if i%4==0 else "hair","HairFront."+side)
    for i in range(16):
        angle=math.pi/8+(i/16)*math.pi*1.75
        x=.32*math.cos(angle);y=.26*math.sin(angle)+.17
        side="L" if x<0 else "R"
        line("Rear hair strand %02d"%i,[(x*.6,y*.6,3.03),(x,y,2.82),
            (x*1.17,y+.10,2.56-.15*(i%3)/3)],.049,
            "hairHL" if i%5==0 else "hair","HairRear."+side)
    # Heroic ornament: sculptural circlet and jewel, original identity.
    line("Crownlet", [(-.33,-.23,2.91),(-.18,-.32,3.00),(0,-.32,3.025),
                       (.18,-.32,3.00),(.33,-.23,2.91)],.018,"goldLight","Head")
    gem("Central sigil",(0,-.348,3.005),(.084,.055,.108),"Head")
    # Animated bone keyframes with separate actions and independently moving cloth/hair.
    rig.animation_data_create()
    action_names=("Idle","Greet","Walk","Magic","Victory","Blink")
    frames=(1,5,9,13,17,21,25)
    for anim in action_names:
        action=bpy.data.actions.new("KnowMe_Hero_"+anim)
        rig.animation_data.action=action
        for f in frames:
            t=(f-1)/24.0
            step=math.sin(math.tau*t)
            fast=math.sin(math.tau*t*2)
            config={
                "Root":((0,0,0),(.0,.0,.02*step)),
                "Pelvis":((0,0,.022*step),(0,0,0)),
                "Spine":((.025*fast,0,.028*step),(0,0,0)),
                "Chest":((-.028*fast,0,.018*step),(0,0,0)),
                "Head":((.018*fast,.028*step,.04*step),(0,0,0)),
                "Jaw":((.035*(1+fast),0,0),(0,0,0)),
            }
            for sign in (-1,1):
                side="L" if sign<0 else "R"
                config.update({
                    "UpperArm."+side:((.065*step,0,sign*.03*step),(0,0,0)),
                    "Forearm."+side:((-.025*fast,0,0),(0,0,0)),
                    "Thigh."+side:((0,0,0),(0,0,0)),
                    "Shin."+side:((0,0,0),(0,0,0)),
                    "Foot."+side:((0,0,0),(0,0,0)),
                    "HairRear."+side:((.07*math.sin(math.tau*t-.5),0,.035*fast),(0,0,0)),
                    "HairFront."+side:((.035*fast,0,0),(0,0,0)),
                    "Cape."+side:((.09*math.sin(math.tau*t-.8),0,.025*step),(0,0,0)),
                    "Brow."+side:((0,0,0),(0,0,0)),
                    "Eyelid."+side:((0,0,0),(0,0,0)),
                })
            if anim=="Greet":
                p=math.sin(math.pi*t)**2
                config["UpperArm.R"]=((-1.18*p,0,-.40*p),(0,0,0))
                config["Forearm.R"]=((-.23*p,.22*fast,0),(0,0,0))
                config["Head"]=((-.08*p,.07*step,.12*p),(0,0,0))
            elif anim=="Walk":
                config["Thigh.L"]=((.55*step,0,0),(0,0,0))
                config["Thigh.R"]=((-.55*step,0,0),(0,0,0))
                config["Shin.L"]=((.22*max(0,-step),0,0),(0,0,0))
                config["Shin.R"]=((.22*max(0,step),0,0),(0,0,0))
                config["UpperArm.L"]=((-.35*step,0,0),(0,0,0))
                config["UpperArm.R"]=((.35*step,0,0),(0,0,0))
                config["Root"]=((0,0,0),(0,0,.07*abs(step)))
            elif anim=="Magic":
                p=math.sin(math.pi*t)
                config["UpperArm.L"]=((-1.18*p,0,-.36*p),(0,0,0))
                config["UpperArm.R"]=((-1.24*p,0,.36*p),(0,0,0))
                config["Hand.L"]=((-.45*p,.3*p,0),(0,0,0))
                config["Hand.R"]=((-.45*p,-.3*p,0),(0,0,0))
                config["Chest"]=((-.14*p,0,.04*step),(0,0,0))
            elif anim=="Victory":
                p=math.sin(math.pi*t)
                config["UpperArm.L"]=((-1.32*p,0,-.24*p),(0,0,0))
                config["UpperArm.R"]=((-1.32*p,0,.24*p),(0,0,0))
                config["Root"]=((0,0,0),(0,0,.14*p))
                config["Head"]=((-.18*p,0,.12*step),(0,0,0))
            elif anim=="Blink":
                p=1 if f in (9,13) else 0
                config["Eyelid.L"]=((-.76*p,0,0),(0,0,0))
                config["Eyelid.R"]=((-.76*p,0,0),(0,0,0))
                config["Brow.L"]=((.08*p,0,0),(0,0,0))
                config["Brow.R"]=((.08*p,0,0),(0,0,0))
            for bone in rig.pose.bones:
                eul,offset=config.get(bone.name,((0,0,0),(0,0,0)))
                bone.rotation_euler=eul
                bone.location=offset
                bone.keyframe_insert(data_path="rotation_euler",frame=f,group=bone.name)
                bone.keyframe_insert(data_path="location",frame=f,group=bone.name)
        for fc in action.fcurves:
            for key in fc.keyframe_points:key.interpolation="BEZIER"
        track=rig.animation_data.nla_tracks.new();track.name=action.name
        track.strips.new(action.name,1,action)
    rig.animation_data.action=None
    bpy.context.scene.frame_set(1)
    return rig
