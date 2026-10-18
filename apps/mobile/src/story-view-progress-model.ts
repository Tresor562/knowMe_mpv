/** Stories track actual media progress rather than marking opened stories complete. */
export function storyCompletionBps(positionMs:number,durationMs:number):number{
  if(!Number.isFinite(positionMs)||!Number.isFinite(durationMs)||durationMs<=0)return 0;
  return Math.max(0,Math.min(10_000,Math.round(positionMs/durationMs*10_000)));
}

/**
 * Send progress milestones sparingly. The open event (0) must be handled
 * separately, so client progress updates never increment viewCount.
 */
export function storyProgressCheckpoint(progressBps:number,lastCheckpoint:number):number|null{
  if(!Number.isFinite(progressBps)||!Number.isFinite(lastCheckpoint))return null;
  const bounded=Math.max(0,Math.min(10_000,Math.floor(progressBps)));
  const milestone=Math.floor(bounded/2_500)*2_500;
  return milestone>=2_500&&milestone>lastCheckpoint?milestone:null;
}
