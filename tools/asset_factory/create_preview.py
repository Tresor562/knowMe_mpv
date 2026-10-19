"""Create a portable HTML preview embedding the *actual* Blender-exported GLB files.
The web component's pinned runtime is fetched from a public CDN when opened.
"""
import base64
import html
import json
import sys
from pathlib import Path

TEMPLATE=r'''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>KnowMe • vraie 3D animée</title>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#101426;color:#eff0ff}
main{width:min(960px,100%);margin:auto;padding:24px 14px 34px}
header{display:flex;align-items:center;justify-content:space-between;gap:10px}h1{font-size:23px;margin:10px 0 2px}p{line-height:1.5;color:#adbbd8;margin:3px 0 14px;font-size:13px}
button{border:1px solid #454a70;background:#252b49;color:#edf0ff;padding:12px 15px;border-radius:14px;font:inherit;cursor:pointer}
button[aria-pressed="true"]{background:#7d65de;border-color:#ab9bfa;color:white}
nav{display:flex;gap:8px;margin:14px 0}nav button{flex:1}
model-viewer{display:block;height:min(65vh,550px);width:100%;background:radial-gradient(circle at 50% 50%,#494779,#242642 55%,#17182b);border-radius:22px;outline:1px solid #45456e}
.controls{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.hint{font-size:12px;color:#a8abc6}
.status{font-size:11px;background:#1d253f;border-radius:18px;padding:7px 10px}
small{color:#8895b4;font-size:11px}.controls button{font-size:13px}
</style>
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js"></script>
</head><body><main>
<header><div><small>KNOWME MOTION FACTORY • BLENDER 4</small><h1>Objets 3D réels, animés.</h1></div><span class="status">GLB + rigging</span></header>
<p>Ce sont de vrais maillages Blender exportés en glTF. Glisse le doigt pour tourner la scène ; lance chaque animation.</p>
<nav role="group" aria-label="Choisir un modèle"><button id="mascot" aria-pressed="true">Personnage articulé</button><button id="crown" aria-pressed="false">Couronne 3D</button></nav>
<model-viewer id="mv" camera-controls auto-rotate shadow-intensity="1" exposure="1.25" environment-image="neutral" interaction-prompt="auto" alt="Modèle 3D KnowMe"></model-viewer>
<div class="controls" id="clips"></div><p class="hint" id="detail">Chargement du modèle…</p>
<small>Ce lecteur a besoin d'Internet uniquement pour charger la bibliothèque gratuite model-viewer. Les deux GLB sont intégrés à cette page ; aucun PNG n'est utilisé comme modèle.</small>
</main><script>
const models=__MODELS__;
const viewer=document.getElementById("mv"),controls=document.getElementById("clips"),detail=document.getElementById("detail");
function select(which){
 document.querySelectorAll("nav button").forEach(b=>b.setAttribute("aria-pressed",String(b.id===which)));
 controls.replaceChildren();
 detail.textContent="Chargement de la géométrie et des clips…";
 viewer.removeAttribute("animation-name");
 viewer.src=models[which];
}
viewer.addEventListener("load",()=>{
 const names=viewer.availableAnimations||[];
 detail.textContent=names.length+" animation(s) disponibles. Glisse pour tourner l'objet. Le rendu est temps réel, pas une vidéo.";
 names.forEach(n=>{
  const b=document.createElement("button");b.textContent="▶ "+n.replace("KnowMe_","");
  b.addEventListener("click",()=>{viewer.animationName=n;viewer.play();document.querySelectorAll(".controls button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)))});
  controls.appendChild(b);
 });
 if(names[0]){viewer.animationName=names[0];viewer.play()}
});
viewer.addEventListener("error",()=>{detail.textContent="Impossible de charger le modèle : vérifie WebGL et la connexion au lecteur CDN."});
document.getElementById("mascot").addEventListener("click",()=>select("mascot"));
document.getElementById("crown").addEventListener("click",()=>select("crown"));
customElements.whenDefined("model-viewer").then(()=>select("mascot"));
</script></body></html>'''

def main(directory):
    folder=Path(directory)
    models={}
    for n in ("mascot","crown"):
        raw=(folder/(n+".glb")).read_bytes()
        assert raw[:4]==b"glTF",n+" not a GLB"
        models[n]="data:model/gltf-binary;base64,"+base64.b64encode(raw).decode("ascii")
    output=TEMPLATE.replace("__MODELS__",json.dumps(models))
    (folder/"preview.html").write_text(output,encoding="utf-8")
    assert "__MODELS__" not in output
    print("Preview created with embedded real GLB geometry; bytes",len(output))
if __name__=="__main__":
    if len(sys.argv)!=2:raise SystemExit("Usage: python3 create_preview.py <folder>")
    main(sys.argv[1])
