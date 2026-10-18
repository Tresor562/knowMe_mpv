/** Only public post MP4 asset IDs are supported for explicit offline saves.
 * This is a local file-name allowlist, not an authorization mechanism.
 */
export function publicPostVideoId(path:string):string|null{
  const match=/^\/media\/public\/post\/([a-zA-Z0-9_-]{1,128})$/.exec(path);
  return match?.[1]??null;
}
export function offlinePublicVideoFilename(id:string):string{
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw Error('Identifiant vidéo invalide.');
  return id+'.mp4';
}
