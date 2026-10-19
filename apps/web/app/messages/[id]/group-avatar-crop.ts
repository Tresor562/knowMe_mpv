/** Crop geometry used by the group avatar preview and actual uploaded bitmap.
 * All pan values are CSS pixels relative to a square preview frame.
 * Geometry is deterministic, independent of browser canvas/image objects.
 */
export const GROUP_AVATAR_PREVIEW_SIZE=288;
export const GROUP_AVATAR_OUTPUT_SIZE=768;
export const GROUP_AVATAR_MAX_ZOOM=3;

export type AvatarCropViewport={
  cssWidth:number;cssHeight:number;left:number;top:number;
  panX:number;panY:number;zoom:number;
  sourceX:number;sourceY:number;sourceSize:number;
};

const finite=(x:number,fallback:number)=>Number.isFinite(x)?x:fallback;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export function computeAvatarCrop(
  naturalWidth:number,naturalHeight:number,zoom=1,panX=0,panY=0,
  frameSize=GROUP_AVATAR_PREVIEW_SIZE
):AvatarCropViewport {
  if(!Number.isFinite(naturalWidth)||!Number.isFinite(naturalHeight)||
    naturalWidth<=0||naturalHeight<=0||frameSize<=0||!Number.isFinite(frameSize))
    throw new Error('INVALID_AVATAR_DIMENSIONS');
  const safeZoom=clamp(finite(zoom,1),1,GROUP_AVATAR_MAX_ZOOM);
  const scale=Math.max(frameSize/naturalWidth,frameSize/naturalHeight)*safeZoom;
  const cssWidth=naturalWidth*scale;
  const cssHeight=naturalHeight*scale;
  const maxPanX=Math.max(0,(cssWidth-frameSize)/2);
  const maxPanY=Math.max(0,(cssHeight-frameSize)/2);
  const safeX=clamp(finite(panX,0),-maxPanX,maxPanX);
  const safeY=clamp(finite(panY,0),-maxPanY,maxPanY);
  const sourceSize=frameSize/scale;
  const sourceX=clamp((naturalWidth-sourceSize)/2-safeX/scale,0,naturalWidth-sourceSize);
  const sourceY=clamp((naturalHeight-sourceSize)/2-safeY/scale,0,naturalHeight-sourceSize);
  return {
    cssWidth,cssHeight,zoom:safeZoom,panX:safeX,panY:safeY,
    left:(frameSize-cssWidth)/2+safeX,
    top:(frameSize-cssHeight)/2+safeY,
    sourceX,sourceY,sourceSize
  };
}
