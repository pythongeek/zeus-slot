/**
 * GSAP animation helpers for slot machine effects.
 * Covers: reel bounce-stop, winning symbols pulse, screen shake,
 * coin burst particles, and confetti explosions.
 */
import { gsap } from 'gsap';

export { gsap };

/**
 * Animate a reel div stopping — bounce effect using CSS spring.
 * Call on each reel stop with the reel's DOM element.
 */
export function animateReelStop(
  reelEl: HTMLElement,
  onComplete?: () => void
) {
  // Remove the CSS spinning animation
  reelEl.classList.remove('animate-spin-reel');

  gsap.fromTo(
    reelEl,
    { scaleY: 1.08, filter: 'brightness(1.4)' },
    {
      scaleY: 1,
      filter: 'brightness(1)',
      duration: 0.35,
      ease: 'elastic.out(1, 0.5)',
      onComplete,
    }
  );
}

/**
 * Winning symbol bounce pulse — scale up + glow ring.
 * Returns a cleanup function.
 */
export function animateWinningSymbol(
  symbolEl: HTMLElement,
  loop: boolean = true
): () => void {
  const glow = document.createElement('div');
  glow.style.cssText = `
    position: absolute; inset: -4px; border-radius: 8px;
    border: 2px solid #D4AF37;
    box-shadow: 0 0 16px rgba(212,175,55,0.6), 0 0 32px rgba(212,175,55,0.3);
    pointer-events: none; z-index: 5;
  `;
  symbolEl.style.position = 'relative';
  symbolEl.appendChild(glow);

  const tl = gsap.timeline({ repeat: loop ? -1 : 0, yoyo: loop });
  tl.to(glow, { opacity: 0.3, scale: 1.15, duration: 0.4, ease: 'sine.inOut' });
  if (!loop) tl.eventCallback('onComplete', () => glow.remove());

  return () => {
    tl.kill();
    glow.remove();
  };
}

/**
 * Screen shake — call on big win / jackpot.
 * intensity: 1 = light, 2 = medium, 3 = heavy
 */
export function screenShake(intensity: number = 1) {
  const container = document.querySelector<HTMLElement>('.relative.bg-\\[\\#12121A\\/95\\].border-2');
  const target = container || document.querySelector<HTMLElement>('[class*="Slot Machine"]') || document.body;

  const strength = intensity * 8;
  gsap.to(target, {
    x: `+=${strength * 0.5}`,
    yoyo: true,
    repeat: 7,
    duration: 0.06,
    ease: 'none',
    onComplete: () => gsap.set(target, { x: 0, y: 0 }),
  });
}

/**
 * Coin burst — spawns gold coin divs that fly upward and fade.
 * Attach to a container element (e.g. the win display).
 */
export function coinBurst(container: HTMLElement, count: number = 12) {
  const rect = container.getBoundingClientRect();

  for (let i = 0; i < count; i++) {
    const coin = document.createElement('div');
    coin.style.cssText = `
      position: fixed;
      width: 14px; height: 14px;
      background: radial-gradient(circle at 40% 40%, #F4D03F, #D4AF37);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 0 6px rgba(212,175,55,0.8);
    `;
    coin.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 60}px`;
    coin.style.top = `${rect.top + rect.height / 2}px`;
    document.body.appendChild(coin);

    const destX = (Math.random() - 0.5) * 200;
    const destY = -(80 + Math.random() * 120);

    gsap.to(coin, {
      x: destX,
      y: destY,
      opacity: 0,
      scale: Math.random() * 0.5 + 0.5,
      rotation: Math.random() * 720,
      duration: 0.8 + Math.random() * 0.4,
      ease: 'power2.out',
      delay: i * 0.04,
      onComplete: () => coin.remove(),
    });
  }
}

/**
 * Particle burst — multi-colored sparkles for big wins.
 */
export function particleBurst(x: number, y: number, count: number = 20) {
  const colors = ['#D4AF37', '#00E676', '#4FC3F7', '#F4D03F', '#FF6B6B', '#ffffff'];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const size = 4 + Math.random() * 6;
    p.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px;
      width: ${size}px; height: ${size}px;
      background: ${colors[i % colors.length]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events: none; z-index: 9999;
      box-shadow: 0 0 4px ${colors[i % colors.length]};
    `;
    document.body.appendChild(p);

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 60 + Math.random() * 100;

    gsap.to(p, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40,
      opacity: 0,
      scale: 0,
      rotation: Math.random() * 360,
      duration: 0.6 + Math.random() * 0.5,
      ease: 'power2.out',
      delay: Math.random() * 0.1,
      onComplete: () => p.remove(),
    });
  }
}

/**
 * Stagger bounce animation on all winning symbols at once.
 */
export function animateWinSymbols(
  winningCells: HTMLElement[],
  onComplete?: () => void
) {
  if (winningCells.length === 0) {
    onComplete?.();
    return;
  }

  gsap.fromTo(
    winningCells,
    { scale: 1, filter: 'brightness(1)' },
    {
      scale: 1.18,
      filter: 'brightness(1.5)',
      duration: 0.2,
      ease: 'power2.out',
      stagger: 0.06,
      onComplete,
    }
  );

  // Add glow rings to each
  winningCells.forEach((cell) => {
    const ring = document.createElement('div');
    ring.style.cssText = `
      position: absolute; inset: -3px; border-radius: 8px;
      border: 2px solid #D4AF37;
      box-shadow: 0 0 12px rgba(212,175,55,0.5);
      pointer-events: none; z-index: 4;
    `;
    cell.style.position = 'relative';
    cell.appendChild(ring);

    gsap.fromTo(
      ring,
      { scale: 0.8, opacity: 0 },
      {
        scale: 1.1,
        opacity: 0.6,
        duration: 0.4,
        ease: 'power2.out',
        yoyo: true,
        repeat: -1,
      }
    );
  });
}

/**
 * Win counter count-up with a bounce at the end.
 */
export function gsapWinCounter(
  element: HTMLElement,
  from: number,
  to: number,
  duration: number = 1.0
) {
  const obj = { value: from };
  gsap.to(obj, {
    value: to,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      element.textContent = toFixed(obj.value);
    },
    onComplete: () => {
      element.textContent = to.toFixed(4);
      // Final bounce
      gsap.fromTo(
        element,
        { scale: 1.3, color: '#00E676' },
        { scale: 1, color: '#ffffff', duration: 0.3, ease: 'elastic.out(1, 0.4)' }
      );
    },
  });
}

function toFixed(n: number) {
  return n.toFixed(4);
}

/**
 * Thunder/lightning flash effect.
 * Returns a kill function.
 */
export function thunderFlash(): () => void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9998;
    background: rgba(255,255,255,0.4);
    pointer-events: none;
  `;
  document.body.appendChild(overlay);

  gsap.fromTo(overlay, { opacity: 1 }, { opacity: 0, duration: 0.15, repeat: 3, yoyo: true });

  return () => {
    gsap.killTweensOf(overlay);
    overlay.remove();
  };
}

/**
 * Confetti rain for big wins — continuous falling confetti pieces.
 * Returns a kill function.
 */
export function startConfetti(): () => void {
  const colors = ['#D4AF37', '#00E676', '#4FC3F7', '#F4D03F', '#FF6B6B', '#C084FC'];

  const pieces: HTMLDivElement[] = [];
  const count = 60;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position: fixed; top: -20px;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      z-index: 9997; pointer-events: none;
    `;
    p.style.left = `${Math.random() * 100}vw`;
    document.body.appendChild(p);
    pieces.push(p);
  }

  pieces.forEach((p, i) => {
    gsap.to(p, {
      y: `110vh`,
      x: `+=${(Math.random() - 0.5) * 200}`,
      rotation: Math.random() * 720,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 1.5,
      ease: 'none',
      repeat: -1,
      repeatDelay: Math.random(),
    });
  });

  return () => {
    pieces.forEach((p) => {
      gsap.killTweensOf(p);
      p.remove();
    });
  };
}

/**
 * Pulse the entire game frame for a beat.
 */
export function pulseFrame() {
  const frame = document.querySelector<HTMLElement>(
    '.relative.bg-\\[\\#12121A\\/95\\].border-2'
  );
  if (!frame) return;
  gsap.fromTo(
    frame,
    { boxShadow: '0 0 40px rgba(212,175,55,0.15)' },
    {
      boxShadow: '0 0 80px rgba(212,175,55,0.6), 0 0 120px rgba(212,175,55,0.3)',
      duration: 0.3,
      yoyo: true,
      repeat: 1,
    }
  );
}
