/**
 * 3D arena: a modelled foosball table that animates idle play and stages a
 * replay of each live goal.
 *
 * Coordinates: field surface at y=0; goals at x=±GOAL_X (white defends −x,
 * blue defends +x); width along z.
 */
import { ContactShadows, Html, MeshReflectorMaterial, OrbitControls, Sparkles } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Lineup, Rod, Side } from '../../shared/types.ts';
import type { GoalSignal } from '../store.ts';

export const SIDE_COLOR: Record<Side, string> = { white: '#e9e4d8', blue: '#4f8cff' };
const SIDE_GLOW: Record<Side, string> = { white: '#fff3d6', blue: '#3a7bff' };

const FIELD_X = 6;
const FIELD_Z = 3.5;
const GOAL_HALF = 1;
const ROD_Y = 0.78;
const BALL_R = 0.17;

interface RodDef {
  side: Side;
  kind: Rod;
  x: number;
  men: number[];
  range: number;
}

const MEN: Record<Rod, number[]> = {
  goalie: [0],
  two_bar: [-1.2, 1.2],
  three_bar: [-2.1, 0, 2.1],
  five_bar: [-2.6, -1.3, 0, 1.3, 2.6],
};

const ROD_LAYOUT: [Side, Rod][] = [
  ['white', 'goalie'],
  ['white', 'two_bar'],
  ['blue', 'three_bar'],
  ['white', 'five_bar'],
  ['blue', 'five_bar'],
  ['white', 'three_bar'],
  ['blue', 'two_bar'],
  ['blue', 'goalie'],
];

const RODS: RodDef[] = ROD_LAYOUT.map(([side, kind], i) => {
  const men = MEN[kind];
  const span = Math.max(...men.map(Math.abs));
  return { side, kind, x: -5.25 + i * 1.5, men, range: kind === 'goalie' ? 0.95 : FIELD_Z - 0.3 - span };
});

const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Field texture (drawn to a canvas at runtime; no image assets)
// ---------------------------------------------------------------------------

function useFieldTexture() {
  return useMemo(() => {
    const W = 2048;
    const H = Math.round((W * FIELD_Z) / FIELD_X);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 ? '#1d6b3a' : '#227a43';
      g.fillRect((i * W) / stripes, 0, W / stripes + 1, H);
    }
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 10;
    g.strokeRect(20, 20, W - 40, H - 40);
    g.beginPath();
    g.moveTo(W / 2, 20);
    g.lineTo(W / 2, H - 20);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, H / 2, H * 0.17, 0, Math.PI * 2);
    g.stroke();
    const boxW = W * 0.07;
    const boxH = H * 0.42;
    g.strokeRect(20, (H - boxH) / 2, boxW, boxH);
    g.strokeRect(W - 20 - boxW, (H - boxH) / 2, boxW, boxH);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(W / 2, H / 2, 12, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(W / 2, H / 2);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.font = `900 ${H * 0.1}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('FOOZTRON', 0, H * 0.3);
    g.restore();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

const wood = new THREE.MeshStandardMaterial({ color: '#3a2316', roughness: 0.55, metalness: 0.05 });
const darkWood = new THREE.MeshStandardMaterial({ color: '#24150d', roughness: 0.7 });
const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.15, metalness: 1 });
const rubber = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 });

function Table() {
  const field = useFieldTexture();
  const wallH = 0.9;
  const t = 0.3;
  const sideLen = FIELD_X * 2 + t * 2;
  const endSeg = FIELD_Z - GOAL_HALF;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[FIELD_X * 2, FIELD_Z * 2]} />
        <meshStandardMaterial map={field} roughness={0.85} />
      </mesh>
      {/* cabinet */}
      <mesh position={[0, -0.62, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[sideLen + 0.4, 1.2, FIELD_Z * 2 + t * 2 + 0.4]} />
      </mesh>
      {/* side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, wallH / 2 - 0.05, s * (FIELD_Z + t / 2)]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[sideLen, wallH, t]} />
        </mesh>
      ))}
      {/* end walls with goal mouths */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (FIELD_X + t / 2), 0, 0]}>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0, wallH / 2 - 0.05, k * (GOAL_HALF + endSeg / 2)]} material={wood} castShadow>
              <boxGeometry args={[t, wallH, endSeg]} />
            </mesh>
          ))}
          <mesh position={[0, wallH - 0.2, 0]} material={wood}>
            <boxGeometry args={[t, 0.3, GOAL_HALF * 2]} />
          </mesh>
          <mesh position={[s * 0.5, 0.15, 0]} material={darkWood}>
            <boxGeometry args={[0.8, 0.5, GOAL_HALF * 2 + 0.2]} />
          </mesh>
        </group>
      ))}
      {/* LED underglow strips */}
      {(['white', 'blue'] as Side[]).map((side) => {
        const s = side === 'white' ? -1 : 1;
        return [-1, 1].map((k) => (
          <mesh key={`${side}${k}`} position={[s * FIELD_X * 0.5, -1.22, k * (FIELD_Z + t + 0.2)]}>
            <boxGeometry args={[FIELD_X - 0.2, 0.05, 0.05]} />
            <meshBasicMaterial color={SIDE_GLOW[side]} toneMapped={false} />
          </mesh>
        ));
      })}
      {/* legs */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (FIELD_X - 0.2), -2.7, sz * (FIELD_Z - 0.2)]} material={darkWood} castShadow>
            <boxGeometry args={[0.55, 3.2, 0.55]} />
          </mesh>
        )),
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rods & players
// ---------------------------------------------------------------------------

function Man({ color, z }: { color: string; z: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 }), [color]);
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.3, 0]} material={mat} castShadow>
        <sphereGeometry args={[0.15, 20, 16]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={mat} castShadow>
        <boxGeometry args={[0.24, 0.38, 0.34]} />
      </mesh>
      <mesh position={[0, -0.42, 0]} material={mat} castShadow>
        <boxGeometry args={[0.16, 0.5, 0.26]} />
      </mesh>
      <mesh position={[0.05, -0.66, 0]} material={mat} castShadow>
        <boxGeometry args={[0.28, 0.08, 0.24]} />
      </mesh>
    </group>
  );
}

interface RodState {
  slide: number;
  rot: number;
  kickT: number;
  spinT: number;
}

// ---------------------------------------------------------------------------
// Simulation + choreography
// ---------------------------------------------------------------------------

interface Sim {
  pos: THREE.Vector2;
  vel: THREE.Vector2;
  mode: 'play' | 'goal' | 'celebrate';
  t: number;
  goalSide: Side | null;
  shake: number;
  flash: Record<Side, number>;
  burst: number;
}

const PARTICLES = 220;

function Game({ goal, reduced }: { goal: GoalSignal | null; reduced: boolean }) {
  const rodGroups = useRef<(THREE.Group | null)[]>([]);
  const rodState = useRef<RodState[]>(RODS.map(() => ({ slide: 0, rot: 0, kickT: 1, spinT: 1 })));
  const ball = useRef<THREE.Mesh>(null);
  const shakeGroup = useRef<THREE.Group>(null);
  const lights = useRef<Record<Side, THREE.PointLight | null>>({ white: null, blue: null });
  const particles = useRef<THREE.InstancedMesh>(null);
  const pdata = useMemo(
    () => Array.from({ length: PARTICLES }, () => ({ p: new THREE.Vector3(0, -100, 0), v: new THREE.Vector3(), life: 0 })),
    [],
  );
  const sim = useRef<Sim>({
    pos: new THREE.Vector2(0, 0),
    vel: new THREE.Vector2(4, 1.5),
    mode: 'play',
    t: 0,
    goalSide: null,
    shake: 0,
    flash: { white: 0, blue: 0 },
    burst: 0,
  });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Seeded with the goal present at mount so remounting doesn't replay old goals.
  const lastSeq = useRef<number | null>(goal?.seq ?? null);

  useEffect(() => {
    if (!goal || goal.seq === lastSeq.current) return;
    lastSeq.current = goal.seq;
    const s = sim.current;
    // Stage the shot: ball appears in front of the scoring side's 3-bar (or the actual rod used).
    const scorerRod = RODS.find((r) => r.side === goal.side && r.kind === goal.rod) ?? RODS[goal.side === 'white' ? 5 : 2];
    const dir = goal.side === 'white' ? 1 : -1;
    s.pos.set(scorerRod.x + dir * 0.35, (Math.random() - 0.5) * 1.2);
    const target = new THREE.Vector2(dir * (FIELD_X + 0.6), (Math.random() - 0.5) * GOAL_HALF);
    s.vel.copy(target.sub(s.pos).normalize().multiplyScalar(17));
    s.mode = 'goal';
    s.t = 0;
    s.goalSide = goal.side;
    const idx = RODS.indexOf(scorerRod);
    rodState.current[idx].kickT = 0;
  }, [goal]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const s = sim.current;
    s.t += dt;

    // --- ball ---
    if (s.mode === 'play') {
      s.pos.addScaledVector(s.vel, dt);
      s.vel.multiplyScalar(1 - 0.25 * dt);
      if (s.vel.length() < 1.2) s.vel.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);
      const maxX = FIELD_X - BALL_R;
      const maxZ = FIELD_Z - BALL_R;
      if (Math.abs(s.pos.x) > maxX) {
        s.pos.x = Math.sign(s.pos.x) * maxX;
        s.vel.x *= -0.8;
      }
      if (Math.abs(s.pos.y) > maxZ) {
        s.pos.y = Math.sign(s.pos.y) * maxZ;
        s.vel.y *= -0.8;
      }
    } else if (s.mode === 'goal') {
      s.pos.addScaledVector(s.vel, dt);
      if (Math.abs(s.pos.x) > FIELD_X + 0.4) {
        s.pos.x = Math.sign(s.pos.x) * (FIELD_X + 0.4);
        s.vel.set(0, 0);
        s.mode = 'celebrate';
        s.t = 0;
        const side = s.goalSide!;
        s.flash[side] = 1;
        s.shake = reduced ? 0 : 1;
        RODS.forEach((r, i) => r.side === side && (rodState.current[i].spinT = 0));
        // particle burst at the goal mouth
        const gx = Math.sign(s.pos.x) * FIELD_X;
        const colors = [new THREE.Color(SIDE_COLOR[side]), new THREE.Color('#ffc53d'), new THREE.Color('#ffffff')];
        pdata.forEach((p, i) => {
          p.p.set(gx, 0.6, (Math.random() - 0.5) * 1.6);
          p.v.set(-Math.sign(gx) * (2 + Math.random() * 6), 3 + Math.random() * 7, (Math.random() - 0.5) * 9);
          p.life = 1.4 + Math.random() * 1.2;
          particles.current?.setColorAt(i, colors[i % 3]);
        });
        if (particles.current?.instanceColor) particles.current.instanceColor.needsUpdate = true;
      }
    } else if (s.mode === 'celebrate' && s.t > 2.2) {
      s.mode = 'play';
      s.pos.set(0, 0);
      s.vel.set((Math.random() > 0.5 ? 1 : -1) * 4, (Math.random() - 0.5) * 3);
    }

    if (ball.current) {
      ball.current.position.set(s.pos.x, BALL_R, s.pos.y);
      ball.current.rotation.z -= (s.vel.x * dt) / BALL_R;
      ball.current.rotation.x += (s.vel.y * dt) / BALL_R;
      ball.current.visible = !(s.mode === 'celebrate' && s.t > 1.6);
    }

    // --- rods: track the ball, kick when it arrives ---
    RODS.forEach((r, i) => {
      const st = rodState.current[i];
      const nearest = r.men.reduce((best, z) => (Math.abs(s.pos.y - (z + st.slide)) < Math.abs(s.pos.y - (best + st.slide)) ? z : best), r.men[0]);
      const desired = THREE.MathUtils.clamp(s.pos.y - nearest, -r.range, r.range);
      st.slide = THREE.MathUtils.damp(st.slide, s.mode === 'play' ? desired : st.slide, 6, dt);

      const dir = r.side === 'white' ? 1 : -1;
      if (s.mode === 'play' && st.kickT > 0.45 && Math.abs(s.pos.x - r.x) < 0.3 && Math.abs(s.pos.y - (nearest + st.slide)) < 0.35 && Math.sign(s.vel.x) !== dir) {
        st.kickT = 0;
        s.pos.x = r.x + dir * 0.32;
        s.vel.set(dir * (5 + Math.random() * 6), (Math.random() - 0.5) * 7);
      }
      st.kickT += dt;
      st.spinT += dt;
      let rot = 0;
      if (st.kickT < 0.3) rot = -dir * Math.sin((st.kickT / 0.3) * Math.PI) * 1.3;
      if (st.spinT < 1.4) rot = dir * THREE.MathUtils.smootherstep(st.spinT, 0, 1.4) * Math.PI * 4; // celebration spin
      st.rot = rot;
      const g = rodGroups.current[i];
      if (g) {
        g.position.z = st.slide;
        g.rotation.z = st.rot;
      }
    });

    // --- goal lights, shake, particles ---
    for (const side of ['white', 'blue'] as Side[]) {
      s.flash[side] = Math.max(0, s.flash[side] - dt * 0.6);
      const l = lights.current[side];
      if (l) l.intensity = 2 + s.flash[side] * 60 * (0.6 + 0.4 * Math.sin(state.clock.elapsedTime * 30));
    }
    if (shakeGroup.current) {
      s.shake = Math.max(0, s.shake - dt * 1.5);
      const k = s.shake * s.shake * 0.25;
      shakeGroup.current.position.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    if (particles.current) {
      pdata.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= dt;
          p.v.y -= 9.8 * dt;
          p.p.addScaledVector(p.v, dt);
          if (p.p.y < 0.03) {
            p.p.y = 0.03;
            p.v.multiplyScalar(0.4);
            p.v.y *= -0.5;
          }
        }
        dummy.position.copy(p.life > 0 ? p.p : new THREE.Vector3(0, -100, 0));
        dummy.rotation.set(p.life * 7, p.life * 5, 0);
        dummy.scale.setScalar(p.life > 0 ? Math.min(1, p.life) : 0);
        dummy.updateMatrix();
        particles.current!.setMatrixAt(i, dummy.matrix);
      });
      particles.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={shakeGroup}>
      <Table />
      {RODS.map((r, i) => (
        <group key={i} position={[r.x, ROD_Y, 0]}>
          {/* static rod shaft passes through the walls */}
          <group
            ref={(g) => {
              rodGroups.current[i] = g;
            }}
          >
            <mesh rotation-x={Math.PI / 2} material={chrome} castShadow>
              <cylinderGeometry args={[0.055, 0.055, 11, 16]} />
            </mesh>
            <mesh position={[0, 0, (r.side === 'white' ? -1 : 1) * 5.4]} rotation-x={Math.PI / 2} material={rubber}>
              <cylinderGeometry args={[0.16, 0.16, 0.9, 20]} />
            </mesh>
            {r.men.map((z) => (
              <Man key={z} z={z} color={SIDE_COLOR[r.side]} />
            ))}
          </group>
        </group>
      ))}
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_R, 32, 24]} />
        <meshStandardMaterial color="#fff6dc" emissive="#ffcf6b" emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
      <instancedMesh ref={particles} args={[undefined, undefined, PARTICLES]}>
        <boxGeometry args={[0.09, 0.09, 0.02]} />
        <meshStandardMaterial toneMapped={false} emissive="#ffffff" emissiveIntensity={0.6} />
      </instancedMesh>
      <pointLight ref={(l) => void (lights.current.white = l)} position={[-FIELD_X - 0.5, 1.4, 0]} color={SIDE_GLOW.white} distance={7} intensity={2} />
      <pointLight ref={(l) => void (lights.current.blue = l)} position={[FIELD_X + 0.5, 1.4, 0]} color={SIDE_GLOW.blue} distance={7} intensity={2} />
    </group>
  );
}

function NameTags({ lineup, names }: { lineup: Lineup; names: Record<string, string> }) {
  const tag = (side: Side, role: 'offense' | 'defense', x: number) => (
    <Html key={`${side}${role}`} position={[x, 1.8, (side === 'white' ? -1 : 1) * 5.2]} center distanceFactor={9} zIndexRange={[10, 0]}>
      <div className={`nametag nametag-${side}`}>
        <span className="nametag-role">{role === 'offense' ? 'OFF' : 'DEF'}</span>
        {names[lineup[`${side}_${role}`]] ?? '—'}
      </div>
    </Html>
  );
  return (
    <>
      {tag('white', 'defense', -4.5)}
      {tag('white', 'offense', 1.5)}
      {tag('blue', 'offense', -1.5)}
      {tag('blue', 'defense', 4.5)}
    </>
  );
}

function CameraRig({ cinematic }: { cinematic: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const narrow = size.width < size.height;
    camera.position.set(0, narrow ? 17 : 9.5, narrow ? 14 : 11.5);
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height]);
  useFrame(({ clock }) => {
    if (!cinematic) return;
    const t = clock.elapsedTime * 0.08;
    camera.position.set(Math.sin(t) * 13, 7.5 + Math.sin(t * 2.3) * 1.5, Math.cos(t) * 13);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export interface ArenaProps {
  goal: GoalSignal | null;
  lineup?: Lineup;
  names?: Record<string, string>;
  /** Slow orbiting camera — for TVs and showing off. */
  cinematic?: boolean;
  interactive?: boolean;
  effects?: boolean;
  className?: string;
}

export default function Arena({ goal, lineup, names, cinematic = false, interactive = true, effects = true, className }: ArenaProps) {
  const reduced = prefersReducedMotion();
  return (
    <div className={className ?? 'arena-canvas'}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 42, near: 0.1, far: 200 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#070a12']} />
        <fog attach="fog" args={['#070a12', 22, 48]} />
        <hemisphereLight args={['#bcd3ff', '#1a0f08', 0.5]} />
        <spotLight position={[0, 14, 3]} angle={0.55} penumbra={0.6} intensity={350} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
        <directionalLight position={[-10, 6, -6]} intensity={0.6} color="#9db8ff" />
        <Suspense fallback={null}>
          <Game goal={goal} reduced={reduced} />
          {lineup && names && <NameTags lineup={lineup} names={names} />}
          <mesh rotation-x={-Math.PI / 2} position={[0, -4.3, 0]}>
            <planeGeometry args={[80, 80]} />
            <MeshReflectorMaterial
              resolution={512}
              blur={[300, 80]}
              mixBlur={1}
              mixStrength={18}
              roughness={1}
              depthScale={1}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.4}
              color="#0c111d"
              metalness={0.6}
              mirror={0.5}
            />
          </mesh>
          <ContactShadows position={[0, -4.28, 0]} opacity={0.6} scale={30} blur={2.5} far={6} />
          <Sparkles count={60} scale={[22, 8, 14]} position={[0, 3, 0]} size={2} speed={0.25} opacity={0.35} color="#ffd27a" />
        </Suspense>
        <CameraRig cinematic={cinematic && !reduced} />
        {interactive && !cinematic && (
          <OrbitControls enablePan={false} minDistance={8} maxDistance={26} maxPolarAngle={Math.PI / 2.15} autoRotate={!reduced} autoRotateSpeed={0.35} />
        )}
        {effects && (
          <EffectComposer multisampling={4}>
            <Bloom luminanceThreshold={0.75} luminanceSmoothing={0.2} intensity={0.9} mipmapBlur />
            <Vignette offset={0.25} darkness={0.7} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
