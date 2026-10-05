import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme } from '../context/ThemeContext';

// Low-poly stylized character
function Character({ position, color, scale = 1, type = 'citizen' }) {
  const group = useRef();
  // Subtle idle animation
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    // Gentle sway for farmer, walk for students, etc.
    if (type === 'farmer') {
      group.current.rotation.y = Math.sin(t * 0.3) * 0.05;
    } else if (type === 'student') {
      group.current.position.y = position[1] + Math.sin(t * 0.8 + position[0]) * 0.03;
    } else {
      group.current.position.y = position[1] + Math.sin(t * 0.5 + position[2]) * 0.02;
    }
  });

  return (
    <group ref={group} position={position} scale={scale}>
      {/* Body */}
      <mesh position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.18, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#e8c9a8" roughness={0.6} />
      </mesh>
      {/* Type-specific */}
      {type === 'farmer' && (
        <mesh position={[0, 1.12, 0]} rotation={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 12]} />
          <meshStandardMaterial color="#d4a017" />
        </mesh>
      )}
      {type === 'student' && (
        <mesh position={[0, 0.4, -0.18]}>
          <boxGeometry args={[0.28, 0.35, 0.08]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      )}
      {type === 'health' && (
        <mesh position={[0, 0.55, 0.18]}>
          <boxGeometry args={[0.04, 0.04, 0.12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
        </mesh>
      )}
    </group>
  );
}

function GovernmentBuilding({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      {/* Main block */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[2.2, 1.6, 1.2]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Columns */}
      {[-0.7, -0.35, 0, 0.35, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.8, 0.65]}>
          <cylinderGeometry args={[0.07, 0.07, 1.4, 8]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {/* Dome */}
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.45, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* Flag subtle */}
      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[0.02, 0.35, 0.02]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
}

function HealthcareBuilding({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.4, 1.2, 1]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      <mesh position={[0, 1.05, 0.52]}>
        <boxGeometry args={[0.3, 0.3, 0.02]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 1.05, 0.52]}>
        <boxGeometry args={[0.08, 0.3, 0.03]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.05, 0.52]}>
        <boxGeometry args={[0.3, 0.08, 0.03]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function CropField({ position, count = 12 }) {
  const crops = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (Math.random() - 0.5) * 3,
    z: (Math.random() - 0.5) * 2,
    h: 0.25 + Math.random() * 0.15,
    c: Math.random() > 0.5 ? '#22c55e' : '#16a34a',
  })), [count]);

  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color="#a7f3d0" roughness={0.9} />
      </mesh>
      {crops.map((c, i) => (
        <mesh key={i} position={[c.x, c.h / 2, c.z]}>
          <cylinderGeometry args={[0.03, 0.02, c.h, 5]} />
          <meshStandardMaterial color={c.c} />
        </mesh>
      ))}
    </group>
  );
}

function DigitalNetwork({ variant = 'home' }) {
  const points = useMemo(() => {
    const pts = variant === 'home' ? 8 : 5;
    return Array.from({ length: pts }, (_, i) => ({
      a: new THREE.Vector3(-4 + i * 1.1, 0.4 + Math.sin(i) * 0.15, -0.5 + Math.cos(i) * 0.3),
      b: new THREE.Vector3(-3 + i * 1.1, 0.45 + Math.cos(i) * 0.12, 0.2 + Math.sin(i) * 0.2),
    }));
  }, [variant]);

  const lineRef = useRef();
  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const t = clock.getElapsedTime();
    lineRef.current.children.forEach((child, i) => {
      if (child.material) {
        child.material.emissiveIntensity = 0.3 + Math.sin(t * 1.2 + i) * 0.15;
      }
    });
  });

  return (
    <group ref={lineRef}>
      {points.map((p, i) => {
        const mid = new THREE.Vector3().addVectors(p.a, p.b).multiplyScalar(0.5);
        mid.y += 0.25;
        const curve = new THREE.QuadraticBezierCurve3(p.a, mid, p.b);
        const geom = new THREE.TubeGeometry(curve, 12, 0.015, 6, false);
        return (
          <mesh key={i} geometry={geom}>
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.35} transparent opacity={0.55} />
          </mesh>
        );
      })}
      {points.flatMap((p, i) => [p.a, p.b]).slice(0, variant === 'home' ? 12 : 8).map((pos, idx) => (
        <mesh key={`n-${idx}`} position={pos}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function GroundAndRoad() {
  return (
    <>
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.95} />
      </mesh>
      {/* Road */}
      <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 28]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, 28]} />
        <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={0.3} />
      </mesh>
    </>
  );
}

function Trees({ variant }) {
  const count = variant === 'home' ? 10 : 6;
  const positions = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 22,
    z: -4 - Math.random() * 8,
    s: 0.7 + Math.random() * 0.5,
  })), [count]);

  return (
    <group>
      {positions.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} scale={p.s}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 1.2, 7]} />
            <meshStandardMaterial color="#92400e" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <coneGeometry args={[0.45, 1, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Clouds() {
  const clouds = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    pos: [ -8 + i * 4.5, 4.5 + Math.sin(i) * 0.5, -10 - Math.random() * 4 ],
    scale: 0.8 + Math.random() * 0.4,
  })), []);

  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((c, i) => {
      c.position.x += Math.sin(t * 0.04 + i) * 0.0008;
    });
  });

  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <group key={i} position={c.pos} scale={c.scale}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.7, 8, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.85} roughness={1} />
          </mesh>
          <mesh position={[0.5, 0.1, 0.15]}>
            <sphereGeometry args={[0.55, 8, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.8} roughness={1} />
          </mesh>
          <mesh position={[-0.45, 0.08, -0.1]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.75} roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Scene({ variant, theme }) {
  const isDark = theme === 'dark';
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  const groupRef = useRef();
  const camRef = useRef();

  // Slow cinematic camera
  useFrame(({ camera, clock }) => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    // Very slow drift
    camera.position.x = Math.sin(t * 0.04) * 0.6;
    camera.position.y = 3.2 + Math.sin(t * 0.03) * 0.12;
    camera.position.z = 9.5 + Math.cos(t * 0.025) * 0.45;
    camera.lookAt(0, 0.4, -1.2);
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.015) * 0.015;
    }
  });

  const showFarmer = true;
  const showCenter = variant !== 'admin' || !isMobile;
  const showRight = true;

  return (
    <>
      <color attach="background" args={[isDark ? '#020617' : '#f0f9ff']} />
      <fog attach="fog" args={[isDark ? '#020617' : '#f0f9ff', 12, 26]} />

      {/* Lights — cinematic */}
      <ambientLight intensity={isDark ? 0.45 : 0.85} color={isDark ? '#1e293b' : '#ffffff'} />
      <directionalLight position={[6, 10, 5]} intensity={isDark ? 0.7 : 1.05} color={isDark ? '#7dd3fc' : '#ffffff'} castShadow />
      <directionalLight position={[-4, 6, -3]} intensity={isDark ? 0.25 : 0.35} color="#a78bfa" />
      <pointLight position={[0, 4, 2]} intensity={isDark ? 0.5 : 0.25} color="#38bdf8" distance={18} />
      <pointLight position={[4, 2.5, -2]} intensity={isDark ? 0.35 : 0.15} color="#a855f7" distance={14} />

      <group ref={groupRef}>
        <GroundAndRoad />
        <Clouds />
        <Trees variant={variant} />

        {/* LEFT — Agriculture */}
        {showFarmer && (
          <>
            <CropField position={[-5.2, 0, 0.8]} count={isMobile ? 8 : 14} />
            <Character position={[-5.0, 0, 1.4]} color="#16a34a" type="farmer" scale={1} />
            <Character position={[-4.2, 0, 0.6]} color="#15803d" type="farmer" scale={0.92} />
          </>
        )}

        {/* CENTER — Citizens: women, children, senior, health */}
        {showCenter && (
          <>
            <Character position={[-1.2, 0, 0.2]} color="#be185d" type="citizen" scale={1} />
            <Character position={[-0.4, 0, 0.9]} color="#2563eb" type="student" scale={0.82} />
            <Character position={[0.3, 0, 0.3]} color="#7c3aed" type="citizen" scale={0.95} />
            <Character position={[1.1, 0, 1.0]} color="#64748b" type="senior" scale={0.96} />
            <Character position={[0.8, 0, -0.4]} color="#ef4444" type="health" scale={0.98} />
          </>
        )}

        {/* RIGHT — Government */}
        {showRight && (
          <>
            <GovernmentBuilding position={[5.0, 0, -0.8]} scale={isMobile ? 0.85 : 1} />
            <HealthcareBuilding position={[3.2, 0, 1.2]} />
          </>
        )}

        <DigitalNetwork variant={variant} />
      </group>
    </>
  );
}

export default function Government3DScene({ variant = 'home' }) {
  const { theme } = useTheme();
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 480 : false;
  // DPR and detail
  const dpr = isMobile ? [1, 1.2] : [1, 1.6];

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 3.2, 9.5], fov: 52 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(theme === 'dark' ? '#020617' : '#f0f9ff');
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <Scene variant={variant} theme={theme} />
      </Canvas>
      {/* Theme overlay — tuned for 20-30% light / 25-40% dark visibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            theme === 'dark'
              ? 'linear-gradient(180deg, rgba(3,7,18,0.62) 0%, rgba(3,7,18,0.72) 45%, rgba(3,7,18,0.84) 100%), radial-gradient(ellipse 60% 40% at 50% 0%, rgba(56,189,248,0.07), transparent 60%)'
              : 'linear-gradient(180deg, rgba(244,247,251,0.58) 0%, rgba(244,247,251,0.70) 45%, rgba(244,247,251,0.82) 100%), radial-gradient(ellipse 60% 40% at 50% 0%, rgba(56,189,248,0.05), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
