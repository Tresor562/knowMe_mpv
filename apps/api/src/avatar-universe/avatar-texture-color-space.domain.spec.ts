import { auditAvatarTextureColorSpaces } from './avatar-texture-color-space.domain';

function ktx2(transfer:number){const levels=1,dfdOffset=104,dfdLength=20,payloadOffset=124,b=new Uint8Array(128),v=new DataView(b.buffer);b.set([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a]);v.setUint32(16,1,true);v.setUint32(20,1,true);v.setUint32(24,1,true);v.setUint32(36,1,true);v.setUint32(40,levels,true);v.setUint32(48,dfdOffset,true);v.setUint32(52,dfdLength,true);v.setUint32(80,payloadOffset,true);v.setUint32(88,4,true);v.setUint32(96,4,true);v.setUint32(dfdOffset,dfdLength,true);v.setUint16(dfdOffset+10,16,true);v.setUint8(dfdOffset+12,166);v.setUint8(dfdOffset+14,transfer);return b;}
function fixture(transfer:number){const bin=ktx2(transfer);return{bin,g:{bufferViews:[{buffer:0,byteOffset:0,byteLength:bin.length}],images:[{bufferView:0,mimeType:'image/ktx2'}],textures:[{extensions:{KHR_texture_basisu:{source:0}}}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}]}};}

describe('avatar texture color-space audit',()=>{
 it('accepts sRGB KTX2 for base color',()=>{const f=fixture(2);expect(auditAvatarTextureColorSpaces(f.g,f.bin)).toMatchObject({valid:true,srgbTextureCount:1,linearTextureCount:0});});
 it('rejects linear KTX2 for base color',()=>{const f=fixture(1),x=auditAvatarTextureColorSpaces(f.g,f.bin);expect(x.valid).toBe(false);expect(x.issues[0]).toMatch(/linear.*srgb/i);});
 it('accepts linear KTX2 for normal maps',()=>{const f=fixture(1);f.g.materials=[{normalTexture:{index:0}}] as any;expect(auditAvatarTextureColorSpaces(f.g,f.bin).valid).toBe(true);});
 it('rejects sRGB KTX2 for metallic-roughness data',()=>{const f=fixture(2);f.g.materials=[{pbrMetallicRoughness:{metallicRoughnessTexture:{index:0}}}] as any;expect(auditAvatarTextureColorSpaces(f.g,f.bin).valid).toBe(false);});
 it('rejects sharing one texture between color and data channels',()=>{const f=fixture(2);f.g.materials=[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicRoughnessTexture:{index:0}}}] as any;expect(auditAvatarTextureColorSpaces(f.g,f.bin).issues[0]).toMatch(/shared/);});
});
