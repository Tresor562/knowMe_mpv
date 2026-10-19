"""Offline-data preview: embed imported professional model GLBs. CDN needed for renderer."""
from pathlib import Path
import base64,json,sys
names=[("artist_hero","Personnage articulé"),("artist_tactical","Tenue tactique sculptée"),("gift_car","Cadeau automobile 3D")]
TEMPLATE='''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KnowMe • modèles 3D créés par des artistes</title>
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js"></script>
<style>
:root{font-family:system-ui,Arial,sans-serif;color-scheme:dark}*{box-sizing:border-box}
body{background:#101423;color:#f5f5ff;margin:0}
main{max-width:900px;padding:18px;margin:auto}h1{font-size:24px;margin:5px 0 9px}
nav{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0}
button{border:1px solid #516184;background:#283354;border-radius:14px;padding:12px;color:white;font:inherit;cursor:pointer}
button[aria-pressed=true]{background:#6656cf;border-color:#c5baff}
model-viewer{width:100%;height:56vh;min-height:300px;background:radial-gradient(ellipse,#49446f,#1b1e35);border-radius:20px}
p{font-size:13px;line-height:1.5;color:#bdc4df}
#clips{display:flex;flex-wrap:wrap;gap:7px;padding:12px 0}
a{color:#cfbfff}details{padding:10px;border:1px solid #323f63;border-radius:15px}summary{cursor:pointer}
</style></head><body><main>
<p>KNOWME • ATELIER 3D • PREUVE DES SOURCES</p><h1>Modèles créés par des artistes</h1>
<p>De vrais objets sculptés et texturés, non reconstruits avec des primitives. Déplace le doigt pour tourner le modèle ; sélectionne les clips lorsqu'ils existent.</p>
<nav id="models"></nav>
<model-viewer id="mv" camera-controls auto-rotate environment-image="neutral"
shadow-intensity="0.7" exposure="1.1" interaction-prompt="auto" alt="Modèle 3D artistique inspectable"></model-viewer>
<div id="clips"></div><p id="status">Chargement du lecteur…</p>
<details><summary>Droits des créateurs, licences et limites</summary><div id="credits"></div></details>
<p>Les fichiers GLB sont intégrés à cette page ; la bibliothèque WebGL se charge depuis un CDN. Modèles source sous licences CC BY 4.0 ou CC0 ; respect des auteurs obligatoire. Modèles de validation, pas personnages KnowMe exclusifs. L'animation de rotation d'un objet sans squelette n'est pas une animation corporelle.</p>
</main><script>
const ASSETS=__ASSET_CONFIG__;
const mv=document.getElementById("mv"),clips=document.getElementById("clips"),status=document.getElementById("status"),nav=document.getElementById("models");
let selected;
for(const key of Object.keys(ASSETS)){
 const info=ASSETS[key],b=document.createElement("button");b.textContent=info.label;b.dataset.key=key;b.onclick=()=>choose(key);nav.appendChild(b)
}
function choose(key){
 const it=ASSETS[key];selected=key;clips.replaceChildren();
 nav.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.key===key)));
 mv.src=it.data;mv.removeAttribute("animation-name");status.textContent="Chargement de la géométrie et des matériaux…";
 const credit=document.getElementById("credits");credit.replaceChildren();
 const p=document.createElement("p");p.textContent=it.credit;credit.appendChild(p);
 const a=document.createElement("a");a.href=it.source;a.textContent="Voir l'œuvre et la licence";a.target="_blank";a.rel="noopener noreferrer";credit.appendChild(a)
}
mv.addEventListener("load",()=>{
 let available=mv.availableAnimations||[];
 status.textContent=available.length+" animation(s) ; rotation tactile activée.";
 available.forEach(name=>{
  const b=document.createElement("button");b.textContent="▶ "+name;b.onclick=()=>{
    mv.animationName=name;mv.play();clips.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  };clips.appendChild(b)
 });
 if(available.length){mv.animationName=available[0];mv.play()}
});
mv.addEventListener("error",()=>{status.textContent="Erreur de lecture WebGL / CDN. Essaie Chrome avec connexion."});
customElements.whenDefined("model-viewer").then(()=>choose("artist_hero"));
</script></body></html>'''

def main(src,out):
    items={}
    provenance=json.loads((src/"provenance.json").read_text())
    for key,label in names:
        glb=out/(key+".glb");data=glb.read_bytes()
        assert data[:4]==b"glTF"
        s=provenance[key]
        items[key]={
            "label":label,
            "data":"data:model/gltf-binary;base64,"+base64.b64encode(data).decode("ascii"),
            "credit":s["work"]+" — "+s["artist"]+" — "+s["license"]+". "+s["modifications"],
            "source":s["original_work"]
        }
    text=TEMPLATE.replace("__ASSET_CONFIG__",json.dumps(items,ensure_ascii=False))
    (out/"preview_artists.html").write_text(text,encoding="utf-8")
    print("ARTIST_VIEWER_BUILT",len(text),"chars",list(items))

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: create_authored_preview.py SOURCES OUTPUT")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
