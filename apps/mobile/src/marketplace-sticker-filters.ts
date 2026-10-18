type NamedOfficialPack = { name: string; description: string };
type NamedPersonalPack = { name: string };

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

export function filterOfficialStickerPacks<T extends NamedOfficialPack>(packs: readonly T[], query: string): T[] {
  const term = normalized(query);
  if (!term) return [...packs];
  return packs.filter(pack => normalized(pack.name + ' ' + pack.description).includes(term));
}

export function filterPersonalStickerPacks<T extends NamedPersonalPack>(packs: readonly T[], query: string): T[] {
  const term = normalized(query);
  if (!term) return [...packs];
  return packs.filter(pack => normalized(pack.name).includes(term));
}
