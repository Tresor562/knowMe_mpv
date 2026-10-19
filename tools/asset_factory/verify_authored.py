"""Inspect real artist asset provenance and ensure imported GLB retains textures/UV/rig."""
import hashlib,json,struct,sys
from pathlib import Path

def doc(path):
    b=Path(path).read_bytes()
    assert b[:4]==b"glTF" and struct.unpack_from("<I",b,4)[0]==2
    length=struct.unpack_from("<I",b,8)[0]
    assert length==len(b),"Truncated binary"
    sz,typ=struct.unpack_from("<II",b,12)
    assert typ==0x4e4f534a,"Missing GLB JSON chunk"
    return json.loads(b[20:20+sz])
def main(sources,out):
    p=json.loads((sources/"provenance.json").read_text())
    assert set(p)=={"artist_hero","artist_tactical","gift_car"}
    for key,meta in p.items():
        orig=sources/(key+".glb")
        baked=out/(key+".glb")
        assert hashlib.sha256(orig.read_bytes()).hexdigest()==meta["sha256"]
        assert meta["license"] in {"CC-BY-4.0","CC0-1.0"}
        assert meta["original_work"] and meta["artist"]
        src=doc(orig)
        exp=doc(baked)
        for ext in ("blend","glb","png","json"):
            file=out/(key+"."+ext)
            assert file.is_file() and file.stat().st_size>500,str(file)
        assert len(exp.get("meshes",[]))>0
        assert len(exp.get("materials",[]))>0
        has_uv=lambda d:any("TEXCOORD_0" in pr.get("attributes",{})
            for m in d.get("meshes",[]) for pr in m["primitives"])
        if has_uv(src):assert has_uv(exp),key+": lost artist's UV maps"
        if src.get("images"):assert exp.get("images"),key+": lost original PBR textures"
        if key=="artist_hero":
            assert src.get("skins"),"source is not rigged"
            assert exp.get("skins"),"artist skeleton lost"
            assert src.get("animations") and exp.get("animations"),"animation clips lost"
        elif key in ("artist_tactical","gift_car"):
            assert exp.get("animations"),"no turntable clip"
        metadata=json.loads((out/(key+".json")).read_text())
        assert metadata["provenance"]["sha256"]==meta["sha256"]
        assert metadata["import_stats"]["source_meshes"]>0
        print("PASS AUTHOR ART",key,"meshes",len(exp.get("meshes",[])),
            "materials",len(exp.get("materials",[])),"textures",len(exp.get("images",[])),
            "skins",len(exp.get("skins",[])),"animations",len(exp.get("animations",[])))
if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: verify_authored.py SOURCES OUTPUT")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
