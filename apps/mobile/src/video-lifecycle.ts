/** Pure policy shared by every native video player (stories, posts, Reels). */
export function shouldSuspendVideo(manuallyPaused:boolean,appState:string|null|undefined):boolean{
  return manuallyPaused||appState==='background'||appState==='inactive';
}
