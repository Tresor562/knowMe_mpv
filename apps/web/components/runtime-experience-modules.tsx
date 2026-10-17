'use client';
import Link from 'next/link';
import { useRuntimeExperience } from './runtime-experience-provider';

/** Only fixed rendering primitives; remote data never becomes executable HTML. */
export function RuntimeExperienceModules() {
  const { document } = useRuntimeExperience();
  if (!document.modules.length) return null;
  return <section aria-label="Nouveautés KnowMe" style={{ display:'grid',gap:8,margin:'12px 0' }}>
    {document.modules.map(module => (
      <div key={module.key} className="card" style={{ padding:14, borderRadius:18 }}>
        {module.href
          ? <Link href={module.href} style={{ color:'inherit',fontWeight:700 }}>{module.title} →</Link>
          : <strong>{module.title}</strong>}
      </div>
    ))}
  </section>;
}
