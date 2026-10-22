import Image from 'next/image';
import styles from './loading.module.css';

/**
 * Next.js renders this only while the requested route is still loading.
 * It does not delay routing or replay on each click.
 */
export default function Loading() {
  return (
    <main className={styles.root} role="status" aria-label="Ouverture de KnowMe">
      <div className={styles.center}>
        <div className={styles.mark}>
          <span className={styles.halo} aria-hidden="true" />
          <Image
            src="/brand/knowme-logo.svg"
            alt=""
            width={96}
            height={96}
            priority
            unoptimized
            className={styles.logo}
          />
        </div>
        <span className={styles.name}>KnowMe</span>
      </div>
    </main>
  );
}
