"""Dependency-free GLB and media validator."""
import json,struct,sys
from pathlib import Path
def inspect_glb(path):
    blob=path.read_bytes()
    assert len(blob)>20,"Empty GLB"
    magic,version,length=struct.unpack_from("<4sII",blob)
    assert (magic,version,length)==(b"glTF",2,len(blob)),"Invalid GLB header"
    size,kind=struct.unpack_from("<II",blob,12)
    assert kind==0x4E4F534A,"Expected JSON chunk"
    doc=json.loads(blob[20:20+size])
    assert len(doc.get("meshes",[]))>=8,"Not enough real meshes"
    assert len(doc.get("materials",[]))>=4,"Missing physical materials"
    assert len(doc.get("animations",[]))>=2,"Missing clips"
    assert all(c.get("channels") for c in doc["animations"]),"Empty clip"
    return doc
def main(folder):
    folder=Path(folder)
    for name in ("mascot","crown","hero"):
        for ext in ("blend","glb","png","webm","json"):
            path=folder/(name+"."+ext)
            assert path.is_file() and path.stat().st_size>100,"Missing asset "+str(path)
        doc=inspect_glb(folder/(name+".glb"))
        if name in ("mascot","hero"):
            assert doc.get("skins"),"No actual skinning exported"
            assert max(len(s.get("joints",[])) for s in doc["skins"])>=(20 if name=="hero" else 6),"Incomplete skeletal rig"
            if name=="hero":
                assert len(doc.get("animations",[]))>=6,"Missing high-level character expressions and motions"
                assert len(doc.get("meshes",[]))>=70,"Hero geometry has too few separately sculpted components"
        assert (folder/(name+".webm")).read_bytes()[:4]==b"\x1aE\xdf\xa3","Not a WebM"
        assert (folder/(name+".png")).read_bytes()[:8]==b"\x89PNG\r\n\x1a\n","Not a PNG"
        print(name,len(doc["meshes"]),"meshes",len(doc["animations"]),"animations",len(doc.get("skins",[])),"skins")
if __name__=="__main__":
    if len(sys.argv)!=2:raise SystemExit("Usage: python3 verify.py DIR")
    main(sys.argv[1])
