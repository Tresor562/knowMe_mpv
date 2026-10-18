/** User-selected emoji aliases for searching and suggesting personal KnowStickers. */
export function parseKnowStickerEmojiTags(input:string):string[]{
  const candidates=input.normalize('NFC').trim().split(/[\s,;]+/u).filter(Boolean);
  if(candidates.length>12)throw new Error('Maximum 12 emojis par sticker.');
  const tags=[...new Set(candidates)];
  for(const tag of tags){
    if(Array.from(tag).length>10||!/[☀-➿🀀-🿿]/u.test(tag))
      throw new Error('Associe uniquement des emojis reconnus.');
  }
  return tags;
}
