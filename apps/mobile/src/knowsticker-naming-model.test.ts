import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {normalizeKnowStickerLabel,knowStickerDisplayName,knowStickerUploadName}
  from './knowsticker-naming-model.ts';

test('safe user-visible sticker and pack names preserve Unicode',()=>{
  assert.equal(normalizeKnowStickerLabel('   Mes   mangas   '),'Mes mangas');
  assert.equal(normalizeKnowStickerLabel('Étoile ⭐'),'Étoile ⭐');
  assert.equal(knowStickerDisplayName('Salut.webp'),'Salut');
  assert.equal(knowStickerUploadName('  Coucou.png  '),'Coucou.webp');
});
test('renaming rejects empty, huge and filesystem-unsafe labels',()=>{
  for(const item of ['', '    ', 'a'.repeat(81), '../test', 'nom\\fichier','nom\u0000test'])
    assert.throws(()=>normalizeKnowStickerLabel(item));
  assert.equal(knowStickerUploadName('Mon sticker'),'Mon sticker.webp');
});
