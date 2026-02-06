import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const DustParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const createParticle = (forceFullRandom = false): Particle => {
      const maxLife = 8000 + Math.random() * 12000; // 8-20 seconds lifespan
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2, // Slow random horizontal speed
        vy: (Math.random() - 0.5) * 0.2, // Balanced random vertical drift
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        life: forceFullRandom ? Math.random() * maxLife : 0,
        maxLife,
      };
    };

    // Initialize particles with staggered lifecycles for even distribution
    const particleCount = Math.floor((canvas.width * canvas.height) / 12000);
    particlesRef.current = Array.from({ length: particleCount }, () => createParticle(true));

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle, index) => {
        // Update life
        particle.life += deltaTime;

        // Reset particle if it exceeded its lifespan - spawn at new random position
        if (particle.life >= particle.maxLife) {
          particlesRef.current[index] = createParticle(false);
          return;
        }

        // Calculate fade based on lifecycle (fade in and out)
        const lifeProgress = particle.life / particle.maxLife;
        let fadeMultiplier = 1;
        if (lifeProgress < 0.1) {
          fadeMultiplier = lifeProgress / 0.1; // Fade in
        } else if (lifeProgress > 0.9) {
          fadeMultiplier = (1 - lifeProgress) / 0.1; // Fade out
        }

        // Update position - pure velocity, no wobble bias
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around screen edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(0, 0%, 80%, ${particle.opacity * fadeMultiplier})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
};

export default DustParticles;
