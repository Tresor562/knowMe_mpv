"""Fetch allowlisted authored glTF geometry by immutable public GitHub commit.

No credentials. No search. Every source is explicitly identified, credited and
validated before importing it in Blender. No paid, CC-NC or unknown-license art.
"""
import hashlib,json,sys,time,urllib.request
from pathlib import Path

SOURCES={
 "artist_hero":{
   "url":"https://raw.githubusercontent.com/cktang88/3d-fps/130ac2a5c856401ec36e7d35afcfefe40c5801f4/public/assets/models/characters/soldier.glb",
   "artist":"BAMEN","work":"FREE [Military Soldier] RIGGED",
   "original_work":"https://sketchfab.com/3d-models/free-military-soldier-rigged-e9c56308a67d4a3db62e914fafa4d198",
   "license":"CC-BY-4.0","license_url":"https://creativecommons.org/licenses/by/4.0/",
   "animation_credits":[
      {"creators":"Quaternius","work":"Universal Animation Library 1 & 2","license":"CC0-1.0","url":"https://quaternius.com"},
      {"creators":"Ian Mason, Sebastian Starke and Taku Komura","work":"100STYLE motion capture dataset","license":"CC-BY-4.0","url":"https://zenodo.org/records/8127870"}
   ],
   "modifications":"Distributed by cktang88/3d-fps with animation adaptations; normalized/imported into Blender for KnowMe pipeline proof.",
   "source_project":"https://github.com/cktang88/3d-fps/tree/130ac2a5c856401ec36e7d35afcfefe40c5801f4"
 },
 "artist_tactical":{
   "url":"https://raw.githubusercontent.com/cktang88/3d-fps/130ac2a5c856401ec36e7d35afcfefe40c5801f4/public/assets/models/characters/soldier_tac.glb",
   "artist":"DanlyVostok (1799danly)","work":"Military tactical suit (LowPolyGameReady)",
   "original_work":"https://sketchfab.com/3d-models/military-tactical-suit-lowpolygameready-ef698ce36b1545a78ce592dd3db4c7ed",
   "license":"CC-BY-4.0","license_url":"https://creativecommons.org/licenses/by/4.0/",
   "modifications":"GLB converted, geometry merged and textures WebP by cktang88/3d-fps; imported and normalized for KnowMe asset study.",
   "source_project":"https://github.com/cktang88/3d-fps/tree/130ac2a5c856401ec36e7d35afcfefe40c5801f4"
 },
 "gift_car":{
   "url":"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/ToyCar/glTF-Binary/ToyCar.glb",
   "artist":"Guido Odendahl / Khronos glTF sample contributors","work":"Toy Car (artist-created collectible example)",
   "original_work":"https://github.com/KhronosGroup/glTF-Sample-Assets/tree/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/ToyCar",
   "license":"CC0-1.0","license_url":"https://creativecommons.org/publicdomain/zero/1.0/",
   "modifications":"Artist-authored 3D model used unmodified except scene normalization and rotating gallery presentation.",
   "source_project":"https://github.com/KhronosGroup/glTF-Sample-Assets"
 }
}

def main(folder):
    out=Path(folder);out.mkdir(parents=True,exist_ok=True)
    result={}
    for key,meta in SOURCES.items():
        if meta["license"] not in {"CC-BY-4.0","CC0-1.0"}:raise ValueError("Licence interdite")
        url=meta["url"]
        if not url.startswith("https://raw.githubusercontent.com/"):raise ValueError("Invalid source host")
        data=None
        for i in range(3):
            try:
                req=urllib.request.Request(url,headers={"User-Agent":"KnowMe-Asset-CI/1.0"})
                with urllib.request.urlopen(req,timeout=35) as response:
                    assert int(response.headers.get("Content-Length","0"))<45_000_000
                    data=response.read(45_000_001)
                break
            except Exception:
                if i==2:raise
                time.sleep(2*(i+1))
        if not 10000<len(data)<45_000_000 or data[:4]!=b"glTF":
            raise ValueError(key+": invalid external GLB binary")
        path=out/(key+".glb")
        path.write_bytes(data)
        item=dict(meta);item["sha256"]=hashlib.sha256(data).hexdigest()
        item["size_bytes"]=len(data)
        result[key]=item
        print("ARTIST_SOURCE_VERIFIED",key,"bytes",len(data),"sha256",item["sha256"],"artist",meta["artist"])
    (out/"provenance.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

if __name__=="__main__":
    if len(sys.argv)!=2:raise SystemExit("Usage: download_authored.py DEST")
    main(sys.argv[1])
