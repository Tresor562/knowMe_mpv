/** User-facing labels are never used to construct a local filesystem path. */
export function normalizeKnowStickerLabel(input:string,maxLength=80):string {
  const label=input.normalize('NFC').trim().replace(/\s+/g,' ');
  if(!label||label.length>maxLength||/[\\/\u0000-\u001f\u007f]/u.test(label))
    throw new Error(`Nom invalide : utilise entre 1 et ${maxLength} caractères sans barre oblique.`);
  return label;
}
export function knowStickerDisplayName(filename:string):string {
  return filename.replace(/\.(webp|png|jpe?g)$/iu,'');
}
export function knowStickerUploadName(name:string):string {
  const label=normalizeKnowStickerLabel(knowStickerDisplayName(name));
  return label+'.webp';
}
