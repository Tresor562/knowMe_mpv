/** Pure accessibility transforms, shared by the Android appearance provider. */
export function accessibleVisualStyle<T extends { transitionDuration: number; glassBoost: number }>(
  visual: T,
  reduceMotion: boolean,
  reduceTransparency: boolean
): T {
  if (!reduceMotion && !reduceTransparency) return visual;
  return {
    ...visual,
    transitionDuration: reduceMotion ? 0 : visual.transitionDuration,
    glassBoost: reduceTransparency ? 0 : visual.glassBoost
  };
}

export function accessibleGlassPalette<T extends { surface: string; surfaceGlass: string }>(
  palette: T,
  reduceTransparency: boolean
): T {
  return reduceTransparency ? { ...palette, surfaceGlass: palette.surface } : palette;
}
