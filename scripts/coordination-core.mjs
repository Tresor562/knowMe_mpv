/**
 * Pure PR coordination rules; no GitHub requests and no secrets.
 */
export const WORKSTREAMS = new Set([
  'messaging', 'social', 'reels', 'profiles', 'marketplace', 'infra', 'design',
]);

const BRANCH_PATTERN = /^chat\/([a-z]+)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function coordinationMetadata(pr) {
  const branch = pr?.head?.ref ?? '';
  if (!branch.startsWith('chat/')) return { coordinated: false, branch };
  const matched = BRANCH_PATTERN.exec(branch);
  if (!matched || !WORKSTREAMS.has(matched[1])) {
    throw new Error(
      'Branche coordonnée invalide. Format obligatoire : chat/<messaging|social|reels|profiles|marketplace|infra|design>/<slug-kebab-case>.',
    );
  }
  const domain = matched[1];
  const body = pr?.body ?? '';
  const domainMatch = /^Workstream:\s*([a-z]+)\s*$/im.exec(body);
  const issueMatch = /^Coordination-Issue:\s*#([1-9][0-9]*)\s*$/im.exec(body);
  if (domainMatch?.[1] !== domain) {
    throw new Error(`La PR doit contenir la ligne exacte "Workstream: ${domain}".`);
  }
  if (!issueMatch) {
    throw new Error('La PR doit contenir "Coordination-Issue: #<numero>" avec une issue existante.');
  }
  return { coordinated: true, domain, issueNumber: Number(issueMatch[1]), branch };
}

export function overlappingPaths(first, second) {
  const set = new Set(first);
  return [...new Set(second)].filter((name) => set.has(name)).sort();
}

export function getOverlaps(currentPr, currentFiles, competingPrs) {
  return competingPrs
    .filter(({ pr }) => pr.number !== currentPr.number && pr.base?.ref === currentPr.base?.ref)
    .map(({ pr, files }) => ({ number: pr.number, paths: overlappingPaths(currentFiles, files) }))
    .filter(({ paths }) => paths.length)
    .sort((a, b) => a.number - b.number);
}
