'use client';

import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { FileNode } from '@/types';
import { NodeDetailsModal } from '@/components/modals/nodeDetails';
import { ConnectionDetailsModal } from '@/components/modals/connectionDetails';
import ignoreSizeFormats from '@/utils/formats/ignoreSize.json';

// Extend Three.js line to be usable as JSX primitive
extend({ ThreeLine_: THREE.Line });

interface Node3D {
    id: string;
    name: string;
    folder: string;
    fnCount: number;
    fileSize: number;
    layer?: string;
    file: FileNode;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    color: string;
    radius: number;
}

interface Link3D {
    source: string;
    target: string;
    count: number;
}

// Layer colors matching existing 2D theme
const layerColors: Record<string, string> = {
    ui: '#3b82f6',
    service: '#a855f7',
    util: '#22c55e',
    data: '#f97316',
    config: '#eab308',
    test: '#64748b',
    default: '#6b7280',
};

// Vertical layer ordering — creates a visual hierarchy
const LAYER_Y: Record<string, number> = {
    ui: 30,
    service: 10,
    util: -5,
    data: -20,
    config: -35,
    test: -45,
};

// Size-based coloring (gradient from small to large files)
const sizeColors = [
    { threshold: 0, color: '#22c55e' },     // green — tiny
    { threshold: 100, color: '#3b82f6' },    // blue — small
    { threshold: 500, color: '#a855f7' },    // purple — medium
    { threshold: 2000, color: '#f97316' },   // orange — large
    { threshold: 5000, color: '#ef4444' },   // red — very large
];

function getSizeColor(size: number, ext: string): string {
    const isStatic = ignoreSizeFormats.staticSizeFormats.includes(`.${ext}`);
    if (isStatic) return '#64748b'; // gray for static formats

    for (let i = sizeColors.length - 1; i >= 0; i--) {
        if (size >= sizeColors[i].threshold) return sizeColors[i].color;
    }
    return sizeColors[0].color;
}

function getSizeRadius(size: number, ext: string): number {
    const isStatic = ignoreSizeFormats.staticSizeFormats.includes(`.${ext}`);
    if (isStatic) return ignoreSizeFormats.staticNodeSize / 40; // ~0.5

    // Scale: 0.4 (tiny) → 2.5 (large)
    return Math.max(0.4, Math.min(2.5, 0.3 + Math.sqrt(size) * 0.03));
}

/** Hash string to deterministic number */
function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
}

/**
 * Build initial positions based on folder structure + layer.
 */
function buildStructuredPositions(files: FileNode[]): Array<{ x: number; y: number; z: number }> {
    const folders = new Map<string, FileNode[]>();
    for (const f of files) {
        const dir = f.folder || f.path.split('/').slice(0, -1).join('/') || 'root';
        if (!folders.has(dir)) folders.set(dir, []);
        folders.get(dir)!.push(f);
    }

    const folderList = Array.from(folders.entries());
    const folderCount = folderList.length;
    const positions: Map<string, { x: number; y: number; z: number }> = new Map();

    folderList.forEach(([, dirFiles], fi) => {
        const angle = (fi / folderCount) * Math.PI * 2;
        const baseR = 20 + Math.sqrt(folderCount) * 6;
        const cx = Math.cos(angle) * baseR;
        const cz = Math.sin(angle) * baseR;

        const count = dirFiles.length;
        dirFiles.forEach((file, i) => {
            const layerY = LAYER_Y[file.layer || ''] ?? 0;
            const spread = Math.min(8, 2 + count * 0.5);
            const h = hashStr(file.path);
            const subAngle = (i / Math.max(1, count)) * Math.PI * 2;
            const subR = spread * (0.5 + (Math.abs(h) % 100) / 200);

            positions.set(file.path, {
                x: cx + Math.cos(subAngle) * subR,
                y: layerY + ((h % 10) / 10) * 4,
                z: cz + Math.sin(subAngle) * subR,
            });
        });
    });

    return files.map(f => positions.get(f.path) || { x: 0, y: 0, z: 0 });
}

// 3D force simulation running per-frame
function useForceSimulation(sourceNodes: Node3D[], sourceLinks: Link3D[]) {
    'use no memo'; // Three.js physics requires mutable Vector3 state
    const simRef = useRef<{ nodes: Node3D[]; links: Link3D[] }>({ nodes: [], links: [] });
    const frameRef = useRef(0);
    const pendingRef = useRef<{ nodes: Node3D[]; links: Link3D[] } | null>(null);

    useEffect(() => {
        pendingRef.current = { nodes: sourceNodes, links: sourceLinks };
    }, [sourceNodes, sourceLinks]);

    useFrame(() => {
        if (pendingRef.current) {
            simRef.current = pendingRef.current;
            pendingRef.current = null;
            frameRef.current = 0;
        }
        const { nodes, links } = simRef.current;
        if (!nodes.length) return;

        frameRef.current++;
        const alpha = Math.max(0.001, 1 - frameRef.current * 0.003);
        if (alpha < 0.01) return;

        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Folder clustering
        const folderGroups = new Map<string, Node3D[]>();
        for (const n of nodes) {
            if (!folderGroups.has(n.folder)) folderGroups.set(n.folder, []);
            folderGroups.get(n.folder)!.push(n);
        }
        for (const group of folderGroups.values()) {
            if (group.length < 2) continue;
            let cx = 0, cy = 0, cz = 0;
            for (const n of group) { cx += n.position.x; cy += n.position.y; cz += n.position.z; }
            cx /= group.length; cy /= group.length; cz /= group.length;
            for (const n of group) {
                n.velocity.x += (cx - n.position.x) * 0.008 * alpha;
                n.velocity.y += (cy - n.position.y) * 0.004 * alpha;
                n.velocity.z += (cz - n.position.z) * 0.008 * alpha;
            }
        }

        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = a.position.x - b.position.x;
                const dy = a.position.y - b.position.y;
                const dz = a.position.z - b.position.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > 2500) continue;
                const dist = Math.sqrt(distSq) || 1;
                const force = (200 * alpha) / (dist * dist);
                const fx = dx / dist * force;
                const fy = dy / dist * force;
                const fz = dz / dist * force;
                a.velocity.x += fx; a.velocity.y += fy; a.velocity.z += fz;
                b.velocity.x -= fx; b.velocity.y -= fy; b.velocity.z -= fz;
            }
        }

        // Link attraction
        for (const link of links) {
            const src = nodeMap.get(link.source);
            const tgt = nodeMap.get(link.target);
            if (!src || !tgt) continue;
            const dx = tgt.position.x - src.position.x;
            const dy = tgt.position.y - src.position.y;
            const dz = tgt.position.z - src.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            const idealDist = 15 + (link.count > 3 ? 0 : 10);
            const force = (dist - idealDist) * 0.006 * alpha;
            const fx = dx / dist * force;
            const fy = dy / dist * force;
            const fz = dz / dist * force;
            src.velocity.x += fx; src.velocity.y += fy; src.velocity.z += fz;
            tgt.velocity.x -= fx; tgt.velocity.y -= fy; tgt.velocity.z -= fz;
        }

        // Layer Y anchoring
        for (const n of nodes) {
            const targetY = LAYER_Y[n.layer || ''] ?? 0;
            n.velocity.y += (targetY - n.position.y) * 0.005 * alpha;
        }

        // Center gravity on XZ
        for (const n of nodes) {
            n.velocity.x -= n.position.x * 0.0005 * alpha;
            n.velocity.z -= n.position.z * 0.0005 * alpha;
        }

        // Apply velocity with damping
        for (const n of nodes) {
            n.velocity.multiplyScalar(0.6);
            n.position.add(n.velocity);
        }
    });
}

function NodeSphere({
    node,
    isSelected,
    onSelect,
}: {
    node: Node3D;
    isSelected: boolean;
    onSelect: (node: Node3D) => void;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);
    const hovered = useRef(false);
    const hoverT = useRef(0);

    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.position.copy(node.position);

            // Smooth hover animation
            const target = hovered.current ? 1 : 0;
            hoverT.current += (target - hoverT.current) * Math.min(1, delta * 8);
            const t = hoverT.current;

            // Scale: 1.0 → 1.4 on hover
            const scale = 1 + t * 0.4;
            meshRef.current.scale.setScalar(scale);

            // Emissive glow on hover
            if (materialRef.current) {
                const baseIntensity = isSelected ? 0.5 : 0;
                materialRef.current.emissiveIntensity = baseIntensity + t * 0.6;
                materialRef.current.emissive.set(hovered.current || isSelected ? node.color : '#000000');
            }
        }
    });

    return (
        <group>
            <mesh
                ref={meshRef}
                onClick={(e) => { e.stopPropagation(); onSelect(node); }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    hovered.current = true;
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    hovered.current = false;
                    document.body.style.cursor = 'default';
                }}
            >
                <sphereGeometry args={[node.radius, 16, 16]} />
                <meshStandardMaterial
                    ref={materialRef}
                    color={node.color}
                    emissive={isSelected ? node.color : '#000000'}
                    emissiveIntensity={isSelected ? 0.5 : 0}
                    transparent
                    opacity={0.85}
                    roughness={0.4}
                    metalness={0.3}
                />
            </mesh>
            {/* Selection ring */}
            {isSelected && (
                <mesh position={node.position}>
                    <ringGeometry args={[node.radius + 0.3, node.radius + 0.5, 32]} />
                    <meshBasicMaterial color={node.color} transparent opacity={0.6} side={THREE.DoubleSide} />
                </mesh>
            )}
            <Billboard position={node.position}>
                <Text
                    fontSize={0.6}
                    color="#94a3b8"
                    anchorY="bottom"
                    position={[0, node.radius + 0.3, 0]}
                >
                    {node.name}
                </Text>
            </Billboard>
        </group>
    );
}

function LinkLine({
    source,
    target,
    strength,
    onClickLink,
}: {
    source: Node3D;
    target: Node3D;
    strength: number;
    onClickLink: (src: string, tgt: string) => void;
}) {
    const lineRef = useRef<THREE.Line>(null);
    const geometryRef = useRef<THREE.BufferGeometry>(null);
    const materialRef = useRef<THREE.LineBasicMaterial>(null);
    const hovered = useRef(false);
    const baseOpacity = Math.min(0.6, 0.1 + strength * 0.15);

    useFrame((_, delta) => {
        if (geometryRef.current) {
            const positions = geometryRef.current.attributes.position as THREE.BufferAttribute;
            if (positions) {
                positions.setXYZ(0, source.position.x, source.position.y, source.position.z);
                positions.setXYZ(1, target.position.x, target.position.y, target.position.z);
                positions.needsUpdate = true;
            }
        }
        // Hover glow for link
        if (materialRef.current) {
            const targetOpacity = hovered.current ? Math.min(0.9, baseOpacity + 0.4) : baseOpacity;
            materialRef.current.opacity += (targetOpacity - materialRef.current.opacity) * Math.min(1, delta * 10);
            materialRef.current.color.set(hovered.current ? '#60a5fa' : '#334155');
        }
    });

    const posArray = useMemo(() => new Float32Array([
        source.position.x, source.position.y, source.position.z,
        target.position.x, target.position.y, target.position.z,
    ]), [source.position, target.position]);

    return (
        <primitive
            object={new THREE.Line()}
            ref={lineRef}
            onClick={(e: THREE.Event) => {
                if (e && 'stopPropagation' in e) (e as unknown as { stopPropagation: () => void }).stopPropagation();
                onClickLink(source.id, target.id);
            }}
            onPointerOver={() => { hovered.current = true; document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { hovered.current = false; document.body.style.cursor = 'default'; }}
        >
            <bufferGeometry ref={geometryRef}>
                <bufferAttribute
                    attach="attributes-position"
                    args={[posArray, 3]}
                />
            </bufferGeometry>
            <lineBasicMaterial ref={materialRef} color="#334155" transparent opacity={baseOpacity} />
        </primitive>
    );
}

function Scene({
    onNodeClick,
    onLinkClick,
}: {
    onNodeClick: (file: FileNode) => void;
    onLinkClick: (src: string, tgt: string) => void;
}) {
    const { data, selectedFile, setSelectedFile } = useAnalysisStore();

    const initialPositions = useMemo(() => {
        if (!data) return [];
        return buildStructuredPositions(data.files);
    }, [data]);

    const { nodes, links } = useMemo(() => {
        if (!data) return { nodes: [], links: [] };

        const files = data.files;
        const fileIds = new Set(files.map(f => f.path));

        const nodes: Node3D[] = files.map((f, i) => {
            const pos = initialPositions[i] || { x: 0, y: 0, z: 0 };
            const ext = f.name.split('.').pop() || '';
            const fileSize = f.lines || 0;

            return {
                id: f.path,
                name: f.name,
                folder: f.folder || f.path.split('/').slice(0, -1).join('/') || 'root',
                fnCount: f.functions?.length || 0,
                fileSize,
                layer: f.layer,
                file: f,
                position: new THREE.Vector3(pos.x, pos.y, pos.z),
                velocity: new THREE.Vector3(0, 0, 0),
                color: getSizeColor(fileSize, ext),
                radius: getSizeRadius(fileSize, ext),
            };
        });

        const linkMap = new Map<string, Link3D>();
        data.connections.forEach(c => {
            if (!fileIds.has(c.source) || !fileIds.has(c.target)) return;
            const key = c.source < c.target ? `${c.source}|${c.target}` : `${c.target}|${c.source}`;
            if (!linkMap.has(key)) {
                linkMap.set(key, { source: c.source, target: c.target, count: 0 });
            }
            linkMap.get(key)!.count += c.count || 1;
        });

        return { nodes, links: Array.from(linkMap.values()) };
    }, [data, initialPositions]);

    useForceSimulation(nodes, links);
    const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

    const handleSelect = useCallback((node: Node3D) => {
        setSelectedFile(node.id);
        onNodeClick(node.file);
    }, [setSelectedFile, onNodeClick]);

    const handleLinkClick = useCallback((src: string, tgt: string) => {
        onLinkClick(src, tgt);
    }, [onLinkClick]);

    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight position={[50, 50, 50]} intensity={0.8} />
            <pointLight position={[-50, -50, -50]} intensity={0.3} color="#3b82f6" />

            {links.map((link, i) => {
                const src = nodeMap.get(link.source);
                const tgt = nodeMap.get(link.target);
                if (!src || !tgt) return null;
                return (
                    <LinkLine
                        key={i}
                        source={src}
                        target={tgt}
                        strength={link.count}
                        onClickLink={handleLinkClick}
                    />
                );
            })}

            {nodes.map(node => (
                <NodeSphere
                    key={node.id}
                    node={node}
                    isSelected={node.id === selectedFile}
                    onSelect={handleSelect}
                />
            ))}

            <OrbitControls
                enablePan
                enableZoom
                enableRotate
                dampingFactor={0.1}
                rotateSpeed={0.5}
                zoomSpeed={0.8}
            />
        </>
    );
}

export default function ForceGraph3D() {
    const [nodeModalFile, setNodeModalFile] = useState<FileNode | null>(null);
    const [nodeModalOpen, setNodeModalOpen] = useState(false);
    const [connModalData, setConnModalData] = useState<{ source: string; target: string } | null>(null);
    const [connModalOpen, setConnModalOpen] = useState(false);

    const handleNodeClick = useCallback((file: FileNode) => {
        setNodeModalFile(file);
        setNodeModalOpen(true);
    }, []);

    const handleLinkClick = useCallback((src: string, tgt: string) => {
        setConnModalData({ source: src, target: tgt });
        setConnModalOpen(true);
    }, []);

    return (
        <div className="w-full h-full">
            <Canvas
                camera={{ position: [0, 0, 80], fov: 60, near: 0.1, far: 1000 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                <Scene onNodeClick={handleNodeClick} onLinkClick={handleLinkClick} />
            </Canvas>

            {/* 3D indicator + size legend */}
            <div className="absolute top-4 right-4 z-10 space-y-2">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">3D Mode</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">Click node for details • Click link for connections</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 backdrop-blur-sm space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">File Size</span>
                    {sizeColors.map(({ threshold, color }) => (
                        <div key={threshold} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[9px] text-slate-400">
                                {threshold === 0 ? '<100' : threshold < 5000 ? `${threshold}+` : '5000+'} lines
                            </span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-800">
                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                        <span className="text-[9px] text-slate-400">Static/Config</span>
                    </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 backdrop-blur-sm space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Layers</span>
                    {Object.entries(layerColors).filter(([k]) => k !== 'default').map(([layer, color]) => (
                        <div key={layer} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[9px] text-slate-400 capitalize">{layer}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Node Details Modal */}
            <NodeDetailsModal
                open={nodeModalOpen}
                onOpenChange={setNodeModalOpen}
                file={nodeModalFile}
            />

            {/* Connection Details Modal */}
            <ConnectionDetailsModal
                open={connModalOpen}
                onOpenChange={setConnModalOpen}
                sourcePath={connModalData?.source || null}
                targetPath={connModalData?.target || null}
            />
        </div>
    );
}
