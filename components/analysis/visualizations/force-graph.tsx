'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { FileNode } from '@/types';
import theme from '@/utils/themes';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';

interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    name: string;
    folder: string;
    fnCount: number;
    layer?: string;
    file: FileNode;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: string | GraphNode;
    target: string | GraphNode;
    count: number;
}

export function ForceGraph() {
    const { data, selectedFile: selectedFilePath, setSelectedFile: setSelectedFilePath } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const nodesRef = useRef<GraphNode[] | null>(null);
    const sizeRef = useRef<{ width: number; height: number } | null>(null);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = svgRef.current.clientWidth || 1400;
        const height = svgRef.current.clientHeight || 900;

        const files = data.files;
        const fileIds = new Set(files.map(f => f.path));
        const nodes: GraphNode[] = files.map(f => ({
            id: f.path,
            name: f.name,
            folder: f.folder || 'root',
            fnCount: f.functions?.length || 0,
            layer: f.layer,
            file: f,
        }));

        const linkMap = new Map<string, GraphLink>();
        data.connections.forEach((c) => {
            if (!fileIds.has(c.source) || !fileIds.has(c.target)) return;
            const key = `${c.source}|${c.target}`;
            if (!linkMap.has(key)) {
                linkMap.set(key, { source: c.source, target: c.target, count: 0 } as GraphLink);
            }
            linkMap.get(key)!.count += c.count || 1;
        });
        const links = Array.from(linkMap.values());

        const getR = (d: GraphNode) => Math.max(8, Math.min(24, 5 + d.fnCount * 0.8));

        const folders = Array.from(new Set(nodes.map(n => n.folder)));
        const cols = Math.max(2, Math.ceil(Math.sqrt(folders.length)));
        const spacingX = 700;
        const spacingY = 500;
        const centers: Record<string, { x: number; y: number }> = {};
        folders.forEach((f, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            centers[f] = {
                x: (col + 1) * spacingX,
                y: (row + 1) * spacingY,
            };
        });

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.2, 5])
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
            });

        svg.call(zoom as any);
        svgSelectionRef.current = svg;
        zoomRef.current = zoom;

        const container = svg.append('g');
        const defs = svg.append('defs');
        defs.append('marker')
            .attr('id', 'arr')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 14)
            .attr('markerWidth', 4)
            .attr('markerHeight', 4)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-4L10,0L0,4')
            .attr('fill', '#444');

        const hullLayer = container.append('g');
        const linkLayer = container.append('g');
        const nodeLayer = container.append('g');

        const sim = d3.forceSimulation(nodes)
            .force('link', d3.forceLink<GraphNode, GraphLink>(links)
                .id((d) => d.id)
                .distance(70)
                .strength(0.3))
            .force('charge', d3.forceManyBody()
                .strength(-260)
                .distanceMax(520))
            .force('collision', d3.forceCollide<GraphNode>().radius((d) => getR(d) + 18).strength(1))
            .force('x', d3.forceX<GraphNode>((d) => centers[d.folder]?.x || width / 2).strength(0.35))
            .force('y', d3.forceY<GraphNode>((d) => centers[d.folder]?.y || height / 2).strength(0.35));

        sim.velocityDecay(0.6).alphaDecay(0.05);
        nodesRef.current = nodes;
        sizeRef.current = { width, height };

        const tooltip = d3.select('body').selectAll('.force-graph-tooltip').data([0])
            .join('div')
            .attr('class', 'force-graph-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', theme.colors.background.card)
            .style('border', `1px solid ${theme.colors.border.accent}`)
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '11px')
            .style('pointer-events', 'none')
            .style('z-index', '10000');

        const link = linkLayer.selectAll('path')
            .data(links)
            .join('path')
            .attr('fill', 'none')
            .attr('stroke', '#333')
            .attr('stroke-width', (d) => Math.max(1, Math.min(2, Math.sqrt(d.count) * 0.3)))
            .attr('stroke-opacity', 0.4)
            .attr('marker-end', 'url(#arr)');

        const node = nodeLayer.selectAll('g')
            .data(nodes)
            .join('g')
            .style('cursor', 'pointer');

        node.call((d3.drag<SVGGElement, GraphNode>()
            .on('start', (event, d) => {
                if (!event.active) sim.alphaTarget(0.1).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) sim.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }) as any));

        node.on('click', (event, d) => {
            event.stopPropagation();
            setSelectedFile(d.file);
            setModalOpen(true);
            setSelectedFilePath(d.file.path);
        });

        node.on('mouseenter', (event, d) => {
            const rect = svgRef.current?.getBoundingClientRect();
            const x = rect ? event.clientX - rect.left + 10 : event.clientX + 10;
            const y = rect ? event.clientY - rect.top + 10 : event.clientY + 10;
            tooltip
                .style('left', `${x}px`)
                .style('top', `${y}px`)
                .style('visibility', 'visible')
                .html(`${d.name}<br/>${d.fnCount} functions<br/>${d.layer || 'unknown'} layer`);
        }).on('mouseleave', () => {
            tooltip.style('visibility', 'hidden');
        });

        node.append('circle')
            .attr('class', 'nc')
            .attr('r', getR)
            .attr('fill', (d) => theme.getNodeColor(d.id))
            .attr('stroke', (d) => {
                const c = d3.color(theme.getNodeColor(d.id));
                return c ? c.brighter(0.3).toString() : '#fff';
            })
            .attr('stroke-width', 1.5);

        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 0)
            .attr('fill', '#eee')
            .attr('font-size', (d) => `${Math.max(6, Math.min(10, getR(d) * 0.6))}px`)
            .attr('font-family', 'JetBrains Mono')
            .attr('font-weight', '500')
            .attr('pointer-events', 'none')
            .text((d) => {
                const name = d.name.replace(/\.[^.]+$/, '');
                const maxLen = Math.max(4, Math.floor(getR(d) / 2));
                return name.length > maxLen + 1 ? `${name.slice(0, maxLen)}…` : name;
            });

        const folderColor = d3.scaleOrdinal<string, string>()
            .domain(folders)
            .range(theme.colors.visualization.palette);

        const updateHulls = () => {
            hullLayer.selectAll('*').remove();
            folders.forEach((f) => {
                const groupNodes = nodes.filter(n => n.folder === f);
                if (groupNodes.length < 1) return;
                const pad = 30;
                const pts: [number, number][] = [];
                groupNodes.forEach((n) => {
                    if (n.x && n.y) {
                        pts.push([n.x - pad, n.y - pad], [n.x + pad, n.y - pad], [n.x - pad, n.y + pad], [n.x + pad, n.y + pad]);
                    }
                });
                if (pts.length < 3) return;
                const hull = d3.polygonHull(pts);
                if (hull) {
                    const color = folderColor(f);
                    hullLayer.append('path')
                        .attr('d', `M${hull.join('L')}Z`)
                        .attr('fill', color)
                        .attr('fill-opacity', 0.04)
                        .attr('stroke', color)
                        .attr('stroke-width', 2)
                        .attr('stroke-opacity', 0.25);
                    const cx = d3.mean(groupNodes, (n) => n.x || 0) || 0;
                    const cy = (d3.min(groupNodes, (n) => n.y || 0) || 0) - pad - 8;
                    hullLayer.append('text')
                        .attr('x', cx)
                        .attr('y', cy)
                        .attr('text-anchor', 'middle')
                        .attr('fill', color)
                        .attr('font-size', '10px')
                        .attr('font-family', 'JetBrains Mono')
                        .attr('font-weight', '600')
                        .attr('opacity', 0.7)
                        .text(f || 'root');
                }
            });
        };

        sim.on('tick', () => {
            link.attr('d', (d) => {
                const source = d.source as GraphNode;
                const target = d.target as GraphNode;
                const dx = (target.x || 0) - (source.x || 0);
                const dy = (target.y || 0) - (source.y || 0);
                const dr = Math.sqrt(dx * dx + dy * dy);
                return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
            });
            node.attr('transform', (d) => `translate(${d.x},${d.y})`);
            updateHulls();
        });

        return () => {
            sim.stop();
            tooltip.remove();
        };
    }, [data]);

    useEffect(() => {
        if (!selectedFilePath || !svgSelectionRef.current || !zoomRef.current || !nodesRef.current || !sizeRef.current) return;
        const node = nodesRef.current.find(n => n.id === selectedFilePath);
        if (!node || node.x == null || node.y == null) return;
        const { width, height } = sizeRef.current;
        const scale = 1.2;
        const transform = d3.zoomIdentity
            .translate(width / 2 - node.x * scale, height / 2 - node.y * scale)
            .scale(scale);
        svgSelectionRef.current
            .transition()
            .duration(700)
            .call(zoomRef.current.transform as any, transform);
    }, [selectedFilePath]);

    if (!data) return null;

    const connections = useMemo(() => {
        if (!selectedFile) return { imports: 0, exports: 0 };
        const imports = data.connections.filter(c => c.target === selectedFile.path).length;
        const exports = data.connections.filter(c => c.source === selectedFile.path).length;
        return { imports, exports };
    }, [selectedFile, data]);

    return (
        <>
            <div className="w-full h-full overflow-hidden bg-black">
                <svg ref={svgRef} className="w-full h-full" />
            </div>

            <NodeDetailsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                file={selectedFile}
                connections={connections}
            />
        </>
    );
}


