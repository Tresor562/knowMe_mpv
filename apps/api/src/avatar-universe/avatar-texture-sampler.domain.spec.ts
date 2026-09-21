import { auditAvatarTextureSamplers } from './avatar-texture-sampler.domain';

describe('Avatar Android texture sampler audit',()=>{
 it('accepts explicit trilinear repeat sampling with complete mips',()=>expect(auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}]},true)).toEqual({valid:true,issues:[],mipmappedSamplerCount:1,repeatSamplerCount:1}));
 it('rejects implicit samplers so runtime behavior cannot drift',()=>expect(auditAvatarTextureSamplers({textures:[{}]},true).valid).toBe(false));
 it('rejects mip filtering when embedded images do not prove complete mip chains',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9987}]},false);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/mip filtering/);});
 it('rejects invalid GL sampler enums',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:123,minFilter:456,wrapS:789,wrapT:789}]},true);expect(x.valid).toBe(false);expect(x.issues.length).toBeGreaterThanOrEqual(3);});
 it('accepts clamp-to-edge without counting repeat',()=>expect(auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9729,wrapS:33071,wrapT:33071}]},false)).toEqual({valid:true,issues:[],mipmappedSamplerCount:0,repeatSamplerCount:0}));
});
