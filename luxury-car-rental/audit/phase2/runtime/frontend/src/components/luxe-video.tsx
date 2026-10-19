'use client';

// ==========================================================
// <video> À DÉCLENCHEMENT PAR VISIBILITÉ
// ==========================================================
//
// Les vidéos (MP4 distants Pexels) sont le poste le plus
// lourd d'une page : un seul fichier pèse plusieurs Mo et la
// page catalogue en affiche jusqu'à six.
//
// Ce composant :
//   - affiche d'emblée le poster de secours (chargement léger) ;
//   - ne lance le chargement du MP4 qu'au moment où le lecteur
//     entre dans le viewport (IntersectionObserver) ;
//   - met la lecture en pause dès qu'il sort de l'écran
//     (économie de bande passante et de CPU) ;
//   - conserve le comportement d'origine : lecture automatique
//     (muted + loop + playsInline) dès que le visuel est visible.
// ==========================================================

import { useEffect, useRef } from 'react';

interface LuxeVideoProps {
  src: string;
  poster: string;
  className?: string;
  /** Marge (px) autour du viewport : précharge juste avant l'entrée. */
  rootMargin?: string;
}

export default function LuxeVideo({
  src,
  poster,
  className,
  rootMargin = '240px',
}: LuxeVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Affirme le mode silencieux avant de jouer (autoplay autorisé).
    video.muted = true;

    if (typeof IntersectionObserver === 'undefined') {
      video.play().catch(() => {});
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { rootMargin },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <video
      ref={videoRef}
      className={className}
      src={src}
      poster={poster}
      style={{
        // Poster local en arrière-plan : même si la vidéo
        // distante ne se charge pas, l'image de la voiture
        // reste visible (la zone n'est jamais vide).
        backgroundImage: `url("${poster}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}