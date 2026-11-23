import { useEffect, useRef } from "react";

interface Point3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseRadius: number;
  color: string;
  pulsePhase: number;
}

interface WireEdge {
  a: number;
  b: number;
}

interface Login3DSceneProps {
  interactive?: boolean;
  className?: string;
  density?: "low" | "medium" | "high";
  showCentralPolyhedron?: boolean;
}

export function Login3DScene({
  interactive = true,
  className = "",
  density = "medium",
  showCentralPolyhedron = true,
}: Login3DSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isHovered: false });
  const pulseRef = useRef<{ x: number; y: number; radius: number; maxRadius: number; opacity: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isDestroyed = false;

    // Viewport dimensions
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.parentElement.clientWidth || window.innerWidth;
      height = canvas.parentElement.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Particle Cloud Setup
    const particleCount = density === "low" ? 45 : density === "high" ? 110 : 80;
    const particles: Point3D[] = [];
    const colors = [
      "rgba(90, 163, 230, ",   // Brand light blue #5AA3E6
      "rgba(56, 189, 248, ",   // Cyan-400
      "rgba(99, 102, 241, ",   // Indigo-500
      "rgba(245, 158, 11, ",   // Amber-500
      "rgba(255, 255, 255, ",  // Pure white spark
    ];

    for (let i = 0; i < particleCount; i++) {
      // Golden ratio spherical distribution for uniform 3D sphere/torus
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      const radius = 90 + Math.random() * 260;

      particles.push({
        x: radius * Math.sin(theta) * Math.cos(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(theta),
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        vz: (Math.random() - 0.5) * 0.22,
        baseRadius: 1.2 + Math.random() * 2.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Central 3D Icosahedron / Octahedron Vertices
    // Golden ratio constant
    const phi = (1 + Math.sqrt(5)) / 2;
    const coreScale = 72;
    const rawIcosahedronVertices = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ].map(([x, y, z]) => ({
      x: x * (coreScale / phi),
      y: y * (coreScale / phi),
      z: z * (coreScale / phi),
    }));

    // Icosahedron Edges
    const edges: WireEdge[] = [];
    for (let i = 0; i < rawIcosahedronVertices.length; i++) {
      for (let j = i + 1; j < rawIcosahedronVertices.length; j++) {
        const dx = rawIcosahedronVertices[i].x - rawIcosahedronVertices[j].x;
        const dy = rawIcosahedronVertices[i].y - rawIcosahedronVertices[j].y;
        const dz = rawIcosahedronVertices[i].z - rawIcosahedronVertices[j].z;
        const dist = Math.hypot(dx, dy, dz);
        // An icosahedron edge has standard distance ~ 2 * scale
        if (Math.abs(dist - (coreScale * 2) / phi) < 18) {
          edges.push({ a: i, b: j });
        }
      }
    }

    // Gyroscope Rings Configuration
    const rings = [
      { radius: 125, tiltX: 0.85, tiltY: 0.35, speed: 0.012, color: "rgba(56, 189, 248, " },
      { radius: 155, tiltX: -0.65, tiltY: 0.75, speed: -0.009, color: "rgba(90, 163, 230, " },
      { radius: 185, tiltX: 0.45, tiltY: -0.9, speed: 0.007, color: "rgba(245, 158, 11, " },
    ];

    // Interaction handlers
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mouseRef.current.targetX = x * 0.75;
      mouseRef.current.targetY = y * 0.75;
      mouseRef.current.isHovered = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
      mouseRef.current.isHovered = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pulseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        radius: 0,
        maxRadius: 280,
        opacity: 0.8,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!interactive || !e.touches[0]) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((touch.clientY - rect.top) / rect.height) * 2 - 1;
      mouseRef.current.targetX = x * 0.8;
      mouseRef.current.targetY = y * 0.8;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    canvas.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    // 3D Projection & Math Helpers
    let rotX = 0.2;
    let rotY = 0.3;
    let rotZ = 0;
    const fov = 450;
    let time = 0;

    const project = (x: number, y: number, z: number, cx: number, cy: number) => {
      // Rotate Y
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      // Rotate X
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      // Perspective scale
      const depth = fov + z2;
      const scale = depth > 10 ? fov / depth : 0.001;

      return {
        x: cx + x1 * scale,
        y: cy + y2 * scale,
        z: z2,
        scale,
      };
    };

    // Render loop
    const render = () => {
      if (isDestroyed) return;
      time += 0.016;

      // Smooth mouse camera inertia
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      rotY = time * 0.18 + mouseRef.current.x * 0.9;
      rotX = 0.25 + Math.sin(time * 0.25) * 0.08 + mouseRef.current.y * 0.6;
      rotZ = Math.cos(time * 0.15) * 0.04;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.5;

      // Draw active click shockwave pulse
      if (pulseRef.current) {
        const pulse = pulseRef.current;
        pulse.radius += 6;
        pulse.opacity *= 0.96;

        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulse.opacity.toFixed(2)})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        if (pulse.radius > pulse.maxRadius || pulse.opacity < 0.02) {
          pulseRef.current = null;
        }
      }

      // 1. Draw 3D Gyroscope Rings if central polyhedron enabled
      if (showCentralPolyhedron) {
        rings.forEach((ring, idx) => {
          const ringPoints: { x: number; y: number; z: number }[] = [];
          const segments = 48;
          const currentAngle = time * ring.speed * 60;

          for (let s = 0; s < segments; s++) {
            const angle = (s / segments) * Math.PI * 2;
            // Base ring in 2D XY plane
            let rx = Math.cos(angle) * ring.radius;
            let ry = Math.sin(angle) * ring.radius;
            let rz = 0;

            // Tilt ring on X & Y
            const cosTx = Math.cos(ring.tiltX + Math.sin(time * 0.2) * 0.1);
            const sinTx = Math.sin(ring.tiltX + Math.sin(time * 0.2) * 0.1);
            const ty = ry * cosTx - rz * sinTx;
            const tz = ry * sinTx + rz * cosTx;

            const cosTy = Math.cos(ring.tiltY + currentAngle * 0.05);
            const sinTy = Math.sin(ring.tiltY + currentAngle * 0.05);
            const tx2 = rx * cosTy + tz * sinTy;
            const tz2 = -rx * sinTy + tz * cosTy;

            ringPoints.push({ x: tx2, y: ty, z: tz2 });
          }

          // Project ring points
          const projectedRing = ringPoints.map((pt) => project(pt.x, pt.y, pt.z, centerX, centerY));

          // Draw the ring line
          ctx.beginPath();
          for (let s = 0; s < projectedRing.length; s++) {
            const p = projectedRing[s];
            if (s === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.strokeStyle = `${ring.color}0.25)`;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Orbiting glowing satellite beads on each ring
          const beadCount = 2;
          for (let b = 0; b < beadCount; b++) {
            const beadAngle = currentAngle + (b * Math.PI * 2) / beadCount;
            let bx = Math.cos(beadAngle) * ring.radius;
            let by = Math.sin(beadAngle) * ring.radius;
            let bz = 0;

            const cosTx = Math.cos(ring.tiltX);
            const sinTx = Math.sin(ring.tiltX);
            const bty = by * cosTx - bz * sinTx;
            const btz = by * sinTx + bz * cosTx;

            const cosTy = Math.cos(ring.tiltY + currentAngle * 0.05);
            const sinTy = Math.sin(ring.tiltY + currentAngle * 0.05);
            const btx2 = bx * cosTy + btz * sinTy;
            const btz2 = -bx * sinTy + btz * cosTy;

            const pBead = project(btx2, bty, btz2, centerX, centerY);
            if (pBead.scale > 0) {
              const beadAlpha = Math.min(1, Math.max(0.2, (pBead.scale - 0.4) * 1.5));
              // Outer glow
              ctx.beginPath();
              ctx.arc(pBead.x, pBead.y, 6 * pBead.scale, 0, Math.PI * 2);
              ctx.fillStyle = `${ring.color}${(beadAlpha * 0.35).toFixed(2)})`;
              ctx.fill();

              // Core bead
              ctx.beginPath();
              ctx.arc(pBead.x, pBead.y, 2.5 * pBead.scale, 0, Math.PI * 2);
              ctx.fillStyle = `${ring.color}${beadAlpha.toFixed(2)})`;
              ctx.fill();
            }
          }
        });

        // 2. Draw central 3D Icosahedron Core
        const coreRotation = time * 0.35;
        const rotatedIco = rawIcosahedronVertices.map((v) => {
          // Additional local spin
          const cosR = Math.cos(coreRotation);
          const sinR = Math.sin(coreRotation);
          const lx = v.x * cosR - v.z * sinR;
          const lz = v.x * sinR + v.z * cosR;
          return { x: lx, y: v.y, z: lz };
        });

        const projectedIco = rotatedIco.map((v) => project(v.x, v.y, v.z, centerX, centerY));

        // Draw wireframe edges
        edges.forEach(({ a, b }) => {
          const pA = projectedIco[a];
          const pB = projectedIco[b];
          if (pA.scale > 0 && pB.scale > 0) {
            const avgDepth = (pA.z + pB.z) * 0.5;
            const edgeAlpha = Math.max(0.1, Math.min(0.7, 0.45 - avgDepth * 0.002));

            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${edgeAlpha.toFixed(2)})`;
            ctx.lineWidth = Math.max(0.8, 1.4 * ((pA.scale + pB.scale) * 0.5));
            ctx.stroke();
          }
        });

        // Draw vertices
        projectedIco.forEach((p) => {
          if (p.scale > 0) {
            const vAlpha = Math.max(0.2, Math.min(0.9, 0.65 - p.z * 0.002));
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${vAlpha.toFixed(2)})`;
            ctx.fill();
          }
        });

        // Glowing energy core center
        const pCenter = project(0, 0, 0, centerX, centerY);
        const coreGradient = ctx.createRadialGradient(
          pCenter.x,
          pCenter.y,
          0,
          pCenter.x,
          pCenter.y,
          38 * pCenter.scale
        );
        coreGradient.addColorStop(0, "rgba(56, 189, 248, 0.65)");
        coreGradient.addColorStop(0.4, "rgba(90, 163, 230, 0.3)");
        coreGradient.addColorStop(1, "transparent");
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, 38 * pCenter.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Update & Draw Particles in 3D Space
      const projectedParticles: { x: number; y: number; z: number; scale: number; p: Point3D }[] = [];

      particles.forEach((p) => {
        // Drift velocity
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Bounding sphere bounce
        const distSq = p.x * p.x + p.y * p.y + p.z * p.z;
        if (distSq > 320 * 320) {
          p.vx *= -1;
          p.vy *= -1;
          p.vz *= -1;
        }

        const proj = project(p.x, p.y, p.z, centerX, centerY);
        if (proj.scale > 0.05) {
          projectedParticles.push({ ...proj, p });
        }
      });

      // Sort by depth (back to front) for accurate 3D rendering
      projectedParticles.sort((a, b) => b.z - a.z);

      // Connect nearby particles with 3D energy laser lines
      const maxConnectDist = 85;
      for (let i = 0; i < projectedParticles.length; i++) {
        const p1 = projectedParticles[i];
        for (let j = i + 1; j < Math.min(i + 12, projectedParticles.length); j++) {
          const p2 = projectedParticles[j];
          const dx3d = p1.p.x - p2.p.x;
          const dy3d = p1.p.y - p2.p.y;
          const dz3d = p1.p.z - p2.p.z;
          const dist3d = Math.sqrt(dx3d * dx3d + dy3d * dy3d + dz3d * dz3d);

          if (dist3d < maxConnectDist) {
            const lineAlpha = (1 - dist3d / maxConnectDist) * 0.28 * Math.min(p1.scale, p2.scale);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(90, 163, 230, ${lineAlpha.toFixed(2)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw particle nodes
      projectedParticles.forEach(({ x, y, scale, p }) => {
        const pulse = 1 + Math.sin(time * 3 + p.pulsePhase) * 0.25;
        const radius = Math.max(0.6, p.baseRadius * scale * pulse);
        const alpha = Math.min(0.95, Math.max(0.15, scale * 0.7));

        // Outer glow on closer particles
        if (scale > 0.8) {
          ctx.beginPath();
          ctx.arc(x, y, radius * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${(alpha * 0.2).toFixed(2)})`;
          ctx.fill();
        }

        // Particle nucleus
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${alpha.toFixed(2)})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [interactive, density, showCentralPolyhedron]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-auto select-none ${className}`}
      style={{ touchAction: "none" }}
    />
  );
}
