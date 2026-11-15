"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import seedrandom from "seedrandom";
import type { SceneData } from "@/lib/run/sceneData";
import { STEPS, type SceneClock } from "@/lib/run/controller";

// ───────── layout ─────────
const PRISM = new THREE.Vector3(-1.6, 0, 0);
const FUNNEL_X = 3.3;
const RING_Y = [3.0, 1.2, -0.6, -2.4];
const TOP = new THREE.Vector3(FUNNEL_X, 3.9, 0);
const BOTTOM_Y = -3.0;
const EXIT = new THREE.Vector3(FUNNEL_X, -3.4, 0.6);
const PHONE = new THREE.Vector3(8.0, -0.8, 0.6);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const CAMERA: Record<number, { pos: [number, number, number]; look: [number, number, number] }> = {
  [-1]: { pos: [-1.5, 1, 14], look: [-1.5, 0, 0] },
  0: { pos: [-1.5, 1, 14], look: [-1.5, 0, 0] },
  1: { pos: [-1.4, 0.6, 9.5], look: [-1.6, 0, 0] },
  2: { pos: [1.5, 0.4, 12], look: [2.6, 0, 0] },
  3: { pos: [1.5, 0.4, 12], look: [2.6, 0, 0] },
  4: { pos: [1.5, 0.4, 12], look: [2.6, 0, 0] },
  5: { pos: [3.4, -1.2, 9.5], look: [3.3, -2.2, 0] },
  6: { pos: [3.4, -1.0, 10], look: [3.6, -1.8, 0] },
  7: { pos: [3.6, -0.2, 13], look: [4.6, -0.8, 0] },
};
const DONE_CAM = { pos: [1.2, 0.8, 16] as [number, number, number], look: [1.2, 0, 0] as [number, number, number] };

function stepProgress(c: SceneClock) {
  if (c.step < 0) return 0;
  return clamp((performance.now() - c.startedAt) / STEPS[c.step].ms);
}

// ───────── labels (canvas-texture sprites: crisp, no DOM, no network) ─────────
function makeLabel(text: string, bold?: string): { tex: THREE.CanvasTexture; w: number; h: number } {
  const dpr = 2, pad = 14, size = 26;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = (w: number) => `${w} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.font = font(500);
  const w1 = ctx.measureText(text).width;
  ctx.font = font(700);
  const w2 = bold ? ctx.measureText(" " + bold).width : 0;
  const W = Math.ceil(w1 + w2 + pad * 2), H = size + pad * 1.6;
  c.width = W * dpr; c.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, H / 2); ctx.fill();
  ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
  ctx.font = font(500); ctx.fillText(text, pad, H / 2 + 1);
  if (bold) { ctx.font = font(700); ctx.fillText(" " + bold, pad + w1, H / 2 + 1); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w: W / 100, h: H / 100 };
}
const Label = ({ text, bold, position, matRef }: { text: string; bold?: string; position: [number, number, number]; matRef?: (m: THREE.SpriteMaterial | null) => void }) => {
  const l = useMemo(() => makeLabel(text, bold), [text, bold]);
  useEffect(() => () => l.tex.dispose(), [l]);
  return <sprite position={position} scale={[l.w, l.h, 1]}><spriteMaterial ref={matRef} map={l.tex} transparent depthWrite={false} toneMapped={false} /></sprite>;
};

// ───────── static pieces ─────────
function SourceNodes({ data }: { data: SceneData }) {
  return (
    <group>
      {data.sources.map((s, i) => {
        const th = ((i - 2) / 2) * 0.62;
        const p = new THREE.Vector3(PRISM.x - 5.2 * Math.cos(th), 5.2 * Math.sin(th), 0);
        return (
          <group key={s.key} position={p}>
            <mesh><sphereGeometry args={[0.36, 24, 24]} /><meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={1.4} toneMapped={false} /></mesh>
            <mesh scale={1.6}><sphereGeometry args={[0.36, 16, 16]} /><meshBasicMaterial color={s.color} transparent opacity={0.12} /></mesh>
            <Label text={`${s.label} · ${s.raw}`} position={[0, 0.85, 0]} />
          </group>
        );
      })}
    </group>
  );
}
export function sourcePos(index: number): THREE.Vector3 {
  const th = ((index - 2) / 2) * 0.62;
  return new THREE.Vector3(PRISM.x - 5.2 * Math.cos(th), 5.2 * Math.sin(th), 0);
}

function Prism({ clock, data }: { clock: SceneClock; data: SceneData }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, 2.4, 1.6)), []);
  useFrame(() => { if (mat.current) mat.current.emissiveIntensity = 0.25 + (clock.step === 1 ? 0.6 * Math.sin(performance.now() / 160) ** 2 : 0) + (clock.step === 0 ? 0.25 : 0); });
  return (
    <group position={PRISM} rotation={[0.1, -0.35, 0]}>
      <mesh><boxGeometry args={[2.4, 2.4, 1.6]} /><meshStandardMaterial ref={mat} color="#8fa1ff" emissive="#3b3fd8" transparent opacity={0.14} roughness={0.05} metalness={0.3} depthWrite={false} /></mesh>
      <lineSegments geometry={edges}><lineBasicMaterial color="#9aa6ff" transparent opacity={0.8} toneMapped={false} /></lineSegments>
      <Label text={`Lead table · ${data.particles.length} → ${data.unique}`} position={[0, 1.9, 0]} />
    </group>
  );
}

const STAGE_NAMES = ["Enquiries", "Contacted", "Meeting / visit", "Won"];
const ringRadius = (count: number, top: number) => 0.4 + 1.2 * Math.sqrt(count / Math.max(1, top));

function Funnel({ clock, data }: { clock: SceneClock; data: SceneData }) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const label = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const radii = data.funnel.map((c) => ringRadius(c, data.funnel[0]));
  useFrame(() => {
    const p = stepProgress(clock);
    const show = clock.step >= 2 ? 1 : 0;
    mats.current.forEach((m, i) => {
      if (!m) return;
      const pulse = clock.step === 3 ? Math.max(0, Math.sin(p * Math.PI * 2 - i * 0.9)) : 0;
      const verify = clock.step === 4 ? smooth(i * 0.2, i * 0.2 + 0.25, p) : clock.step > 4 ? 1 : 0;
      m.opacity = 0.25 + 0.6 * show;
      m.emissiveIntensity = 0.8 + 1.8 * pulse;
      m.emissive.set(clock.blocked && clock.step >= 4 ? "#ef4444" : verify > 0.5 ? "#22c55e" : i % 2 ? "#14c8b4" : "#5b5fe0");
      m.color.copy(m.emissive);
    });
    label.current.forEach((m) => { if (m) m.opacity = show; });
  });
  return (
    <group position={[FUNNEL_X, 0, 0]}>
      {RING_Y.map((y, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radii[i], 0.045, 12, 64]} />
            <meshStandardMaterial ref={(m) => { mats.current[i] = m; }} transparent toneMapped={false} />
          </mesh>
          <Label text={STAGE_NAMES[i]} bold={String(data.funnel[i])} position={[radii[i] + 1.1, 0, 0]} matRef={(m) => { label.current[i] = m; }} />
        </group>
      ))}
    </group>
  );
}

function Flashes({ clock, count, partnerPos }: { clock: SceneClock; count: number; partnerPos: THREE.Vector3[] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const p = clock.step === 1 ? stepProgress(clock) : clock.step < 1 ? 0 : 1;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = clamp((p - 0.6 - i * 0.03) / 0.3);
      const on = clock.step === 1 && t > 0 && t < 1;
      m.visible = on;
      if (on) { m.scale.setScalar(0.15 + 1.1 * t); (m.material as THREE.MeshBasicMaterial).opacity = 1 - t; }
    });
  });
  return <>{Array.from({ length: count }, (_, i) => (
    <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={partnerPos[i] ?? [0, 0, 0]} visible={false}>
      <ringGeometry args={[0.8, 1, 32]} /><meshBasicMaterial color="#ffffff" transparent toneMapped={false} />
    </mesh>
  ))}</>;
}

function Particles({ data, clock }: { data: SceneData; clock: SceneClock }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = data.particles.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }), []);
  const rig = useMemo(() => {
    const rng = seedrandom("pipeline");
    const srcIndex = (k: string) => data.sources.findIndex((s) => s.key === k);
    return data.particles.map((p, k) => {
      const S = sourcePos(srcIndex(p.source)).add(new THREE.Vector3((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5));
      const P = new THREE.Vector3(PRISM.x + (rng() - 0.5) * 1.7, (rng() - 0.5) * 1.7, (rng() - 0.5) * 1.0);
      const C = S.clone().lerp(P, 0.5).add(new THREE.Vector3(0, (rng() - 0.5) * 2.2, (rng() - 0.5) * 2.2));
      return { S, P, C, delay: (k / N) * 0.55, phase: rng() * 6.28, color: new THREE.Color(data.sources[srcIndex(p.source)].color) };
    });
  }, [data, N]);
  const partners = useMemo(() => data.particles.map((p) => (p.dupOf === null ? null : rig[p.dupOf].P)), [data, rig]);

  useEffect(() => { rig.forEach((r, k) => ref.current?.setColorAt(k, r.color)); if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true; }, [rig]);

  const WON = data.funnel[3];
  useFrame(({ clock: tclock }) => {
    const mesh = ref.current; if (!mesh) return;
    const time = tclock.elapsedTime;
    const p = stepProgress(clock);
    const s = clock.step;
    for (let k = 0; k < N; k++) {
      const r = rig[k], dup = data.particles[k].dupOf !== null;
      const pos = tmp.a; let scale = 1;
      if (s < 0) { pos.copy(r.S); scale = 0.6; }
      else if (s === 0) {
        const e = ease(clamp((p * 1.55 - r.delay) / 0.55));
        const u = 1 - e;
        pos.set(0, 0, 0).addScaledVector(r.S, u * u).addScaledVector(r.C, 2 * u * e).addScaledVector(r.P, e * e);
      } else if (s === 1) {
        pos.copy(r.P).add(tmp.b.set(Math.sin(time * 1.3 + r.phase) * 0.07, Math.cos(time * 1.1 + r.phase) * 0.07, 0));
        if (dup) { const e = ease(clamp(p / 0.65)); pos.copy(r.P).lerp(partners[k]!, e); scale = 1 - smooth(0.62, 0.78, p); }
      } else if (dup) { pos.copy(r.P); scale = 0; }
      else if (s === 2) {
        const f = ease(clamp(p * 1.5 - (k / data.unique) * 0.45));
        if (f < 0.3) {
          const e = ease(f / 0.3), u = 1 - e; tmp.c.set(r.P.x + 2, 4.6, 0);
          pos.set(0, 0, 0).addScaledVector(r.P, u * u).addScaledVector(tmp.c, 2 * u * e).addScaledVector(TOP, e * e);
        } else {
          const u = (f - 0.3) / 0.7;
          const y = TOP.y + (BOTTOM_Y - TOP.y) * u * u;
          const rad = ringRadius(y > RING_Y[1] ? data.funnel[0] : y > RING_Y[2] ? data.funnel[1] : y > RING_Y[3] ? data.funnel[2] : WON, data.funnel[0]) * 0.55;
          const ang = k * 2.4 + u * 9;
          pos.set(FUNNEL_X + Math.cos(ang) * rad, y, Math.sin(ang) * rad);
          for (let j = 1; j < 4; j++) if (k >= data.funnel[j]) scale = Math.min(scale, clamp((y - (RING_Y[j] - 0.5)) / 0.5));
        }
      } else {
        if (k < WON) pos.set(FUNNEL_X + Math.cos(k * 1.9) * 0.45, BOTTOM_Y + 0.08 + (k % 3) * 0.08, Math.sin(k * 1.9) * 0.45);
        else { pos.set(FUNNEL_X, BOTTOM_Y, 0); scale = 0; }
      }
      dummy.position.copy(pos);
      dummy.scale.setScalar(Math.max(0.0001, scale) * 0.12);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  const flashPos = useMemo(() => partners.filter((x): x is THREE.Vector3 => !!x), [partners]);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} /><meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <Flashes clock={clock} count={flashPos.length} partnerPos={flashPos} />
    </>
  );
}

function ReportSheet({ clock }: { clock: SceneClock }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock: t }) => {
    const grp = g.current; if (!grp) return;
    const s = clock.step, p = stepProgress(clock);
    let vis = 0;
    if (s === 5) { vis = ease(p); grp.position.copy(EXIT); grp.scale.set(1, Math.max(0.001, vis), 1); grp.rotation.set(-0.5 * (1 - vis), 0, 0); }
    else if (s === 6) { vis = 1; grp.position.set(EXIT.x, EXIT.y + 0.15 * Math.sin(t.elapsedTime * 2), EXIT.z); grp.scale.set(1, 1, 1); grp.rotation.set(0, Math.sin(t.elapsedTime) * 0.12, 0); }
    else if (s === 7) {
      const e = ease(p); vis = 1 - smooth(0.85, 1, p);
      grp.position.set(EXIT.x + (PHONE.x - EXIT.x) * e, EXIT.y + (PHONE.y - EXIT.y) * e + Math.sin(e * Math.PI) * 1.3, EXIT.z);
      const sc = 1 - 0.55 * e; grp.scale.set(sc, sc, sc); grp.rotation.set(0, 0, -0.25 * e);
    }
    grp.visible = vis > 0.01;
  });
  const lines = [0.55, 0.3, 0.05, -0.2, -0.45, -0.7];
  return (
    <group ref={g} visible={false}>
      <mesh><planeGeometry args={[1.5, 2.1]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.88, 0.01]}><planeGeometry args={[1.5, 0.32]} /><meshBasicMaterial color="#3b3fd8" toneMapped={false} /></mesh>
      {lines.map((y, i) => <mesh key={i} position={[(i % 2 ? 0.15 : 0) - 0.1, y, 0.01]}><planeGeometry args={[i % 3 === 0 ? 1.1 : 0.9, 0.09]} /><meshBasicMaterial color={i === 2 ? "#14c8b4" : "#c9ccd8"} toneMapped={false} /></mesh>)}
    </group>
  );
}

function CameraRig({ clock, userMovedRef }: { clock: SceneClock; userMovedRef: React.MutableRefObject<boolean> }) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const last = useRef(-2);
  useFrame((_, dt) => {
    if (clock.step !== last.current) { last.current = clock.step; userMovedRef.current = false; }
    if (userMovedRef.current || !controls) return;
    const t = clock.status === "done" ? DONE_CAM : CAMERA[clock.step] ?? CAMERA[0];
    const k = 1 - Math.exp(-dt * 1.8);
    camera.position.lerp(new THREE.Vector3(...t.pos), k);
    controls.target.lerp(new THREE.Vector3(...t.look), k);
    controls.update();
  });
  return null;
}

function Scene({ data, clock }: { data: SceneData; clock: SceneClock }) {
  const userMovedRef = useRef(false);
  const [done, setDone] = useState(false);
  useFrame(() => { const d = clock.status === "done"; if (d !== done) setDone(d); });
  return (
    <>
      <color attach="background" args={["#070914"]} />
      <fog attach="fog" args={["#070914", 16, 34]} />
      <hemisphereLight args={["#aab4ff", "#14162b", 0.9]} />
      <pointLight position={[-4, 4, 6]} intensity={30} color="#8fa1ff" />
      <pointLight position={[6, -2, 6]} intensity={22} color="#14c8b4" />
      <SourceNodes data={data} />
      <Prism clock={clock} data={data} />
      <Funnel clock={clock} data={data} />
      <Particles data={data} clock={clock} />
      <ReportSheet clock={clock} />
      <ContactShadows position={[0, -4.2, 0]} opacity={0.4} scale={30} blur={2.6} far={6} />
      <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={22} minPolarAngle={0.7} maxPolarAngle={2.3}
        minAzimuthAngle={-1.1} maxAzimuthAngle={1.1} autoRotate={done} autoRotateSpeed={0.5} onStart={() => { userMovedRef.current = true; }} />
      <CameraRig clock={clock} userMovedRef={userMovedRef} />
      <EffectComposer multisampling={0}><Bloom intensity={0.55} luminanceThreshold={0.55} mipmapBlur /></EffectComposer>
    </>
  );
}

/** The 1st-of-the-month pipeline: sources → lead table → funnel → report → phone. */
export default function PipelineScene({ data, clock }: { data: SceneData; clock: SceneClock }) {
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
      <Canvas dpr={[1, 1.5]} camera={{ position: [-1.5, 1, 14], fov: 45 }} frameloop={visible ? "always" : "never"} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Scene data={data} clock={clock} />
      </Canvas>
    </div>
  );
}
