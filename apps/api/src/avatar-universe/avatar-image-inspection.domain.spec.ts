import { inspectAvatarEmbeddedImage } from './avatar-image-inspection.domain';

function png(w=1024,h=512){const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);const v=new DataView(b.buffer);v.setUint32(8,13,false);b.set([73,72,68,82],12);v.setUint32(16,w,false);v.setUint32(20,h,false);return b;}
function jpeg(w=640,h=480){return Uint8Array.from([0xff,0xd8,0xff,0xc0,0,17,8,h>>8,h&255,w>>8,w&255,3,1,0x11,0,2,0x11,0,3,0x11,0,0xff,0xd9]);}
function ktx2(w=1024,h=1024,levels=11){const b=new Uint8Array(68+levels*24);b.set([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a]);const v=new DataView(b.buffer);v.setUint32(20,w,true);v.setUint32(24,h,true);v.setUint32(28,0,true);v.setUint32(32,0,true);v.setUint32(36,1,true);v.setUint32(40,levels,true);return b;}
describe('Avatar embedded texture inspection',()=>{
 it('reads PNG dimensions from the real IHDR header',()=>{const x=inspectAvatarEmbeddedImage(png(),'image/png');expect(x).toMatchObject({width:1024,height:512,mipLevels:1,estimatedRgba8GpuBytes:1024*512*4});});
 it('reads JPEG dimensions from SOF instead of metadata supplied by a producer',()=>{const x=inspectAvatarEmbeddedImage(jpeg(),'image/jpeg');expect(x).toMatchObject({width:640,height:480,mipLevels:1});});
 it('reads KTX2 dimensions and mip count',()=>{const x=inspectAvatarEmbeddedImage(ktx2(),'image/ktx2');expect(x.width).toBe(1024);expect(x.height).toBe(1024);expect(x.mipLevels).toBe(11);expect(x.estimatedRgba8GpuBytes).toBeGreaterThan(1024*1024*4);});
 it('rejects a forged PNG MIME over arbitrary bytes',()=>expect(()=>inspectAvatarEmbeddedImage(new Uint8Array(24),'image/png')).toThrow(/PNG/));
 it('rejects a JPEG without SOF dimensions',()=>expect(()=>inspectAvatarEmbeddedImage(Uint8Array.from([0xff,0xd8,0xff,0xd9]),'image/jpeg')).toThrow(/SOF/));
 it('rejects impossible KTX2 mip counts',()=>expect(()=>inspectAvatarEmbeddedImage(ktx2(4,4,8),'image/ktx2')).toThrow(/mip/));
 it('rejects cubemap/array KTX2 payloads for avatar materials',()=>{const b=ktx2();new DataView(b.buffer).setUint32(36,6,true);expect(()=>inspectAvatarEmbeddedImage(b,'image/ktx2')).toThrow(/single-layer 2D/);});
 it('rejects unsupported image MIME types',()=>expect(()=>inspectAvatarEmbeddedImage(png(),'image/webp')).toThrow(/Unsupported/));
});
