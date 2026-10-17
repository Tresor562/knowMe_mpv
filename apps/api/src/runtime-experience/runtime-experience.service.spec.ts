import { BadRequestException } from '@nestjs/common';
import { validateRuntimeDocument } from './runtime-experience.service';

describe('Dynamic experience document validation', () => {
  const valid = {
    badges: [
      { key:'verified_blue', label:'Certifié KnowMe', color:'#1877F2', symbol:'check' },
      { key:'creator', label:'Créateur', color:'#325ACE', symbol:'star' }
    ],
    modules: [{ key:'announcement', title:'Nouveau sur KnowMe', kind:'notice' }]
  };
  it('accepts only declarative bounded primitives', () => {
    expect(validateRuntimeDocument(valid)).toEqual(valid);
  });
  it('rejects unsafe routes and executable presentation payloads', () => {
    expect(() => validateRuntimeDocument({badges:[],modules:[
      {key:'bad', title:'test',kind:'link',href:'javascript:alert(1)'}
    ]})).toThrow(BadRequestException);
    expect(() => validateRuntimeDocument({badges:[],modules:[
      {key:'bad', title:'test',kind:'link',href:'//evil.example'}
    ]})).toThrow(BadRequestException);
    expect(() => validateRuntimeDocument({badges:[],modules:[
      {key:'bad', title:'test',kind:'link',href:'/../admin'}
    ]})).toThrow(BadRequestException);
  });
  it('rejects duplicate badges and unbounded catalogs', () => {
    expect(() => validateRuntimeDocument({badges:[valid.badges[0],valid.badges[0]],modules:[]})).toThrow(BadRequestException);
    expect(() => validateRuntimeDocument({badges:new Array(101).fill(valid.badges[0]),modules:[]})).toThrow(BadRequestException);
  });
  it('rejects HTML, scripts or opaque URLs as visual elements', () => {
    expect(() => validateRuntimeDocument({badges:[
      { key:'bad', label:'x',color:'url(javascript:evil())',symbol:'check'}
    ],modules:[]})).toThrow(BadRequestException);
  });
});
