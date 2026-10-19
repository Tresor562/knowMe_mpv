"""Visual proof gate: disallow technically valid GLBs with invisible/cropped posters.

CI uses packaged python3-pil. This tests framing, not art-direction quality.
"""
import sys
from pathlib import Path
from PIL import Image
def check(p):
    im=Image.open(p).convert("RGBA")
    a=im.getchannel("A")
    mask=a.point(lambda v: 255 if v>=32 else 0)
    box=mask.getbbox()
    if not box:raise AssertionError(f"{p.name}: image entirely transparent/blank")
    w,h=im.size
    occupied=sum(1 for px in a.getdata() if px>=32)/(w*h)
    rw=(box[2]-box[0])/w;rh=(box[3]-box[1])/h
    assert occupied>=.05,f"{p.name} mostly empty ({occupied:.2%})"
    assert rw>=.13 and rh>=.22,f"{p.name} appears too small or offscreen (bbox={box})"
    assert box[0]>=0 and box[1]>=0
    print(f"POSTER_VISIBLE {p.name}: coverage={occupied:.1%}, width={rw:.1%}, height={rh:.1%}")
def main(folder):
    for name in ("artist_hero","artist_tactical","gift_car"):
        check(Path(folder)/(name+".png"))
if __name__=="__main__":
    if len(sys.argv)!=2:raise SystemExit("Usage: verify_posters.py OUTPUT")
    main(sys.argv[1])
