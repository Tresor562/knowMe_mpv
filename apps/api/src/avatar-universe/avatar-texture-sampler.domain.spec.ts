import { auditAvatarTextureSamplers } from './avatar-texture-sampler.domain';

describe('Avatar Android texture sampler audit',()=>{
 it('accepts explicit trilinear repeat sampling with complete mips',()=>expect(auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}]},true)).toEqual({valid:true,issues:[],mipmappedSamplerCount:1,repeatSamplerCount:1}));
 it('rejects implicit samplers so runtime behavior cannot drift',()=>expect(auditAvatarTextureSamplers({textures:[{}]},true).valid).toBe(false));
 it('rejects mip filtering when embedded images do not prove complete mip chains',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}]},false);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/mip filtering/);});
 it('rejects invalid GL sampler enums',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:123,minFilter:456,wrapS:789,wrapT:789}]},true);expect(x.valid).toBe(false);expect(x.issues.length).toBeGreaterThanOrEqual(3);});
 it('accepts explicit clamp-to-edge without counting repeat when no mip chain exists',()=>expect(auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9729,wrapS:33071,wrapT:33071}]},false)).toEqual({valid:true,issues:[],mipmappedSamplerCount:0,repeatSamplerCount:0}));
 it('rejects omitted wrap modes instead of inheriting glTF defaults',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9987}]},true);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/explicit wrapS and wrapT/);});
 it('rejects nearest filtering in the certified mobile avatar profile',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9728,minFilter:9984,wrapS:10497,wrapT:10497}]},true);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/LINEAR/);});
 it('rejects complete mip chains that runtime sampling would ignore',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9729,wrapS:33071,wrapT:33071}]},true);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/does not consume mipmaps/);});
 it('rejects mirrored repeat outside the certified Android avatar profile',()=>{const x=auditAvatarTextureSamplers({textures:[{sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33648,wrapT:10497}]},true);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/MIRRORED_REPEAT/);});
});
