"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import seedrandom from "seedrandom";
import { SOURCES, SOURCE_COLOR } from "@/lib/types";

const N = 140;
function Field() {
  const group = useRef<THREE.Group>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => {
    const r = seedrandom("hero");
    return Array.from({ length: N }, (_, i) => ({ a: r() * 6.28, rad: 3 + r() * 4.5, y: (r() - 0.5) * 5, sp: 0.12 + r() * 0.25, off: r(), color: new THREE.Color(SOURCE_COLOR[SOURCES[i % 5]]) }));
  }, []);
  useEffect(() => { seeds.forEach((s, i) => inst.current?.setColorAt(i, s.color)); if (inst.current?.instanceColor) inst.current.instanceColor.needsUpdate = true; }, [seeds]);
  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      const u = (t * s.sp + s.off) % 1; // 0 = far out, 1 = swallowed by the phone
      const rad = s.rad * (1 - u * u * 0.92);
      const a = s.a + u * 1.6;
      dummy.position.set(Math.cos(a) * rad * 1.5, s.y * (1 - u * 0.85), Math.sin(a) * rad - 2);
      dummy.scale.setScalar(0.07 * (1 - smooth(u)) + 0.01);
      dummy.updateMatrix();
      inst.current?.setMatrixAt(i, dummy.matrix);
    });
    if (inst.current) inst.current.instanceMatrix.needsUpdate = true;
    if (group.current) { group.current.rotation.y += (pointer.x * 0.35 - group.current.rotation.y) * 0.04; group.current.rotation.x += (-pointer.y * 0.2 - group.current.rotation.x) * 0.04; }
  });
  return (
    <group ref={group}>
      <instancedMesh ref={inst} args={[undefined, undefined, N]} frustumCulled={false}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
      <Chips />
    </group>
  );
}
const smooth = (u: number) => { const t = Math.min(1, Math.max(0, (u - 0.7) / 0.3)); return t * t * (3 - 2 * t); };

/** Five source chips orbiting the phone. */
function Chips() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const a = clock.elapsedTime * 0.35 + (i / 5) * Math.PI * 2;
      m.position.set(Math.cos(a) * 3.6, Math.sin(a * 1.3) * 1.4, Math.sin(a) * 1.6 - 0.5);
    });
  });
  return <>{SOURCES.map((s, i) => (
    <mesh key={s} ref={(m) => { refs.current[i] = m; }}><sphereGeometry args={[0.22, 20, 20]} /><meshBasicMaterial color={SOURCE_COLOR[s]} toneMapped={false} /></mesh>
  ))}</>;
}

/** Lighter landing-hero scene: orbiting source chips and particles drifting into the phone. */
export default function HeroScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="h-full w-full">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 9], fov: 50 }} frameloop={visible ? "always" : "never"} gl={{ antialias: true, alpha: true }}>
        <Field />
      </Canvas>
    </div>
  );
}
