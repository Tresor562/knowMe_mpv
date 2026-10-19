/** Deterministic square cropping in output-canvas pixels. Input image is
 * scaled to COVER, never stretched; dragging cannot expose empty canvas. */
export type CropPan={x:number;y:number};
export type CropFrame={x:number;y:number;width:number;height:number;pan:CropPan};

export function avatarCropFrame(
  imageWidth:number,imageHeight:number,side:number,zoom:number,pan:CropPan
):CropFrame {
  if(!Number.isFinite(imageWidth)||!Number.isFinite(imageHeight)||
    !Number.isFinite(side)||imageWidth<=0||imageHeight<=0||side<=0)
    throw new Error('INVALID_AVATAR_DIMENSIONS');
  const safeZoom=Number.isFinite(zoom)?Math.max(1,Math.min(3,zoom)):1;
  const scale=Math.max(side/imageWidth,side/imageHeight)*safeZoom;
  const width=imageWidth*scale,height=imageHeight*scale;
  const limitX=Math.max(0,(width-side)/2),limitY=Math.max(0,(height-side)/2);
  const clamp=(value:number,limit:number)=>
    Number.isFinite(value)?Math.max(-limit,Math.min(limit,value)):0;
  const safePan={x:clamp(pan.x,limitX),y:clamp(pan.y,limitY)};
  return {
    x:(side-width)/2+safePan.x,
    y:(side-height)/2+safePan.y,
    width,height,pan:safePan
  };
}
