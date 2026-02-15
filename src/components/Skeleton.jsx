import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({ count = 6 }) {
  const items = Array.from({ length: count });
  return (
    <div className={styles.skeletonGrid} role="status" aria-live="polite">
      {items.map((_, i) => (
        <div key={i} className={styles.skeletonCard} aria-hidden>
          <div className={styles.skeletonImage} />
          <div className={styles.skeletonLine} style={{ width: '60%' }} />
          <div className={styles.skeletonLine} style={{ width: '40%' }} />
        </div>
      ))}
    </div>
  );
}
