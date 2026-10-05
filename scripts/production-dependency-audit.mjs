import { readFile } from 'node:fs/promises';

const reportPath = process.argv[2];
const auditExitCode = Number(process.argv[3] ?? 0);

if (!reportPath) {
  console.error('Usage: node scripts/production-dependency-audit.mjs <audit-json> <audit-exit-code>');
  process.exit(2);
}

const raw = await readFile(reportPath, 'utf8');
let report;
try {
  report = JSON.parse(raw);
} catch (error) {
  console.error('Dependency audit report is not valid JSON.');
  console.error(String(error));
  process.exit(2);
}

const SEVERE = new Set(['high', 'critical']);

const ALLOWLIST = new Map([
  [
    'GHSA-86w9-cpqp-85rv',
    {
      packageName: 'node-forge',
      allowedPaths: [
        'apps__mobile>expo>@expo/cli>node-forge',
        'apps/mobile>expo>@expo/cli>node-forge'
      ],
      reason: 'unpatched Expo CLI build-tool dependency'
    }
  ],
  [
    'GHSA-vfj7-8cjw-p6xm',
    {
      packageName: 'braces',
      allowedPaths: [
        'apps__mobile>react-native>@react-native/community-cli-plugin>metro>metro-file-map>micromatch>braces',
        'apps/mobile>react-native>@react-native/community-cli-plugin>metro>metro-file-map>micromatch>braces'
      ],
      reason: 'unpatched React Native/Metro build-tool dependency'
    }
  ]
]);

function extractGhsa(value) {
  const match = String(value ?? '').match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i);
  return match ? match[0] : null;
}

function legacyAdvisories(input) {
  if (!input?.advisories || typeof input.advisories !== 'object') return [];
  return Object.entries(input.advisories).map(([key, advisory]) => {
    const paths = (advisory.findings ?? []).flatMap((finding) => finding.paths ?? []);
    return {
      id:
        extractGhsa(advisory.github_advisory_id) ??
        extractGhsa(advisory.url) ??
        extractGhsa(key),
      packageName: advisory.module_name ?? advisory.name ?? '',
      severity: String(advisory.severity ?? '').toLowerCase(),
      patchedVersions: String(advisory.patched_versions ?? ''),
      paths,
      title: advisory.title ?? '',
      source: advisory.url ?? key
    };
  });
}

function modernAdvisories(input) {
  if (!input?.vulnerabilities || typeof input.vulnerabilities !== 'object') return [];
  const result = [];
  for (const [packageName, vulnerability] of Object.entries(input.vulnerabilities)) {
    const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
    const advisoryObjects = via.filter((item) => item && typeof item === 'object');
    if (!advisoryObjects.length) {
      result.push({
        id: null,
        packageName,
        severity: String(vulnerability.severity ?? '').toLowerCase(),
        patchedVersions: '',
        paths: vulnerability.nodes ?? [],
        title: '',
        source: packageName
      });
      continue;
    }
    for (const advisory of advisoryObjects) {
      result.push({
        id:
          extractGhsa(advisory.source) ??
          extractGhsa(advisory.url) ??
          extractGhsa(advisory.name),
        packageName,
        severity: String(advisory.severity ?? vulnerability.severity ?? '').toLowerCase(),
        patchedVersions: String(advisory.range ?? ''),
        paths: vulnerability.nodes ?? [],
        title: advisory.title ?? '',
        source: advisory.url ?? advisory.source ?? packageName
      });
    }
  }
  return result;
}

const advisories = legacyAdvisories(report);
if (!advisories.length) advisories.push(...modernAdvisories(report));

const severeAdvisories = advisories.filter((item) => SEVERE.has(item.severity));

if (auditExitCode !== 0 && severeAdvisories.length === 0) {
  console.error(
    `pnpm audit exited with code ${auditExitCode}, but no high/critical advisory could be parsed. Failing closed.`
  );
  process.exit(1);
}

const blockers = [];
const quarantined = [];

for (const advisory of severeAdvisories) {
  const rule = advisory.id ? ALLOWLIST.get(advisory.id) : null;
  if (!rule || advisory.packageName !== rule.packageName) {
    blockers.push(advisory);
    continue;
  }

  const paths = advisory.paths.map((value) => String(value));
  if (!paths.length) {
    blockers.push({ ...advisory, note: 'no dependency path available; cannot prove build-tool-only scope' });
    continue;
  }

  const allPathsAreBuildToolOnly = paths.every((path) =>
    rule.allowedPaths.some((allowedPath) => path.includes(allowedPath))
  );

  if (!allPathsAreBuildToolOnly) {
    blockers.push({ ...advisory, note: 'advisory escaped the reviewed mobile build-tool path' });
    continue;
  }

  quarantined.push({ ...advisory, reason: rule.reason });
}

if (blockers.length) {
  console.error('Blocking high/critical production dependency advisories detected:');
  for (const item of blockers) {
    console.error(
      JSON.stringify(
        {
          id: item.id,
          package: item.packageName,
          severity: item.severity,
          paths: item.paths,
          source: item.source,
          note: item.note
        },
        null,
        2
      )
    );
  }
  process.exit(1);
}

for (const item of quarantined) {
  console.warn(
    `QUARANTINED ${item.id} ${item.packageName}: ${item.reason}; reviewed path(s): ${item.paths.join(', ')}`
  );
}

console.log(
  `Dependency audit gate passed: ${severeAdvisories.length} high/critical advisories parsed, ${quarantined.length} quarantined as exact unpatched mobile build-tool-only findings, 0 blockers.`
);
