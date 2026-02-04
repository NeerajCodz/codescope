'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { FileNode } from '@/types';
import ignoreSizeFormats from '@/utils/formats/ignore-size.json';
import theme from '@/utils/themes';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';
import { ConnectionDetailsModal } from '@/components/modals/connection-details-modal';

interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    file: FileNode;
    radius: number;
    category: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: string | GraphNode;
    target: string | GraphNode;
}

export function ClusterGraph() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedConnection, setSelectedConnection] = useState<{ source: string; target: string } | null>(null);
    const [connectionModalOpen, setConnectionModalOpen] = useState(false);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const width = 2000;
        const height = 1600;

        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height]);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform.toString());
            });

        svg.call(zoom as any);
        svgSelectionRef.current = svg;
        zoomRef.current = zoom;

        const g = svg.append('g');

        const tooltip = d3.select('body').selectAll('.cluster-graph-tooltip').data([0])
            .join('div')
            .attr('class', 'cluster-graph-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', 'rgba(0, 0, 0, 0.95)')
            .style('color', theme.colors.text.primary)
            .style('padding', '12px 16px')
            .style('border-radius', '8px')
            .style('border', `2px solid ${theme.colors.border.accent}`)
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '10000')
            .style('max-width', '400px')
            .style('box-shadow', `0 4px 12px rgba(6, 182, 212, 0.3)`);

        const getFileCategory = (file: FileNode): string => {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const path = file.path.toLowerCase();

            if (path.includes('/component')) return 'components';
            if (path.includes('/hook')) return 'hooks';
            if (path.includes('/lib') || path.includes('/util')) return 'libraries';
            if (path.includes('/api') || path.includes('/route')) return 'api';
            if (path.includes('/type')) return 'types';
            if (path.includes('/style') || ext === 'css' || ext === 'scss') return 'styles';
            if (path.includes('/test') || path.includes('spec')) return 'tests';
            if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return 'code';
            if (['json', 'yaml', 'yml', 'xml'].includes(ext)) return 'config';
            if (['md', 'txt', 'pdf'].includes(ext)) return 'docs';
            return 'other';
        };

        const nodes: GraphNode[] = data.files.map(file => {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            const isStaticSize = ignoreSizeFormats.staticSizeFormats.includes(ext);
            const radius = isStaticSize
                ? ignoreSizeFormats.staticNodeSize / 2
                : Math.max(6, Math.min(26, Math.sqrt(file.lines ?? file.size ?? 1) * 0.6));

            return {
                id: file.path,
                file,
                radius,
                category: getFileCategory(file),
            };
        });

        const links: GraphLink[] = data.connections.map(conn => ({
            source: conn.source,
            target: conn.target,
        }));

        const categoryPositions: Record<string, [number, number]> = {
            'components': [width * 0.25, height * 0.25],
            'hooks': [width * 0.75, height * 0.25],
            'libraries': [width * 0.25, height * 0.75],
            'api': [width * 0.75, height * 0.75],
            'types': [width * 0.5, height * 0.15],
            'styles': [width * 0.1, height * 0.5],
            'tests': [width * 0.9, height * 0.5],
            'code': [width * 0.4, height * 0.5],
            'config': [width * 0.6, height * 0.5],
            'docs': [width * 0.5, height * 0.85],
            'other': [width * 0.5, height * 0.5],
        };

        const simulation = d3.forceSimulation<GraphNode>(nodes)
            .force('link', d3.forceLink<GraphNode, GraphLink>(links)
                .id(d => d.id)
                .distance(80)
                .strength(0.3))
            .force('charge', d3.forceManyBody()
                .strength(-250)
                .distanceMax(400))
            .force('collision', d3.forceCollide<GraphNode>()
                .radius(d => d.radius + 8)
                .strength(0.8)
                .iterations(3))
            .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
            .force('category', d3.forceX<GraphNode>((d) => categoryPositions[d.category]?.[0] || width / 2)
                .strength(0.15))
            .force('categoryY', d3.forceY<GraphNode>((d) => categoryPositions[d.category]?.[1] || height / 2)
                .strength(0.15));

        const getNodeId = (value: string | GraphNode) => (typeof value === 'string' ? value : value.id);
        const fileMap = new Map(data.files.map((f) => [f.path, f] as const));

        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', theme.colors.visualization.edges.default)
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);

        const highlightConnections = (nodeId: string) => {
            link
                .attr('stroke', (l) => (getNodeId(l.source) === nodeId || getNodeId(l.target) === nodeId ? theme.colors.visualization.edges.hover : theme.colors.visualization.edges.default))
                .attr('stroke-opacity', (l) => (getNodeId(l.source) === nodeId || getNodeId(l.target) === nodeId ? 0.9 : 0.15))
                .attr('stroke-width', (l) => (getNodeId(l.source) === nodeId || getNodeId(l.target) === nodeId ? 2.2 : 1));

            node
                .attr('stroke', (n) => (n.id === nodeId ? theme.colors.text.accent : theme.colors.border.accent))
                .attr('stroke-width', (n) => (n.id === nodeId ? 3 : 2))
                .style('filter', (n) => (n.id === nodeId ? 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.55))' : 'none'));
        };

        const clearHighlights = () => {
            link
                .attr('stroke', theme.colors.visualization.edges.default)
                .attr('stroke-opacity', 0.6)
                .attr('stroke-width', 1);
            node
                .attr('stroke', theme.colors.border.accent)
                .attr('stroke-width', 2)
                .style('filter', 'none');
        };

        const node = g.append('g')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => {
                const ext = '.' + d.file.name.split('.').pop()?.toLowerCase();
                const isStaticSize = ignoreSizeFormats.staticSizeFormats.includes(ext);
                return isStaticSize
                    ? theme.colors.visualization.nodes.static
                    : theme.getNodeColor(d.file.path);
            })
            .attr('stroke', theme.colors.border.accent)
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('stroke', theme.colors.text.accent)
                    .attr('stroke-width', 3);

                highlightConnections(d.id);

                const complexityColor = d.file.complexity?.level === 'critical' ? '#ef4444' :
                    d.file.complexity?.level === 'high' ? '#f59e0b' :
                    d.file.complexity?.level === 'medium' ? '#eab308' : '#22c55e';

                tooltip.html(`
                    <div style="font-weight: bold; color: ${theme.colors.text.accent}; margin-bottom: 8px; font-size: 14px;">
                        ${d.file.name}
                    </div>
                    <div style="color: #888; margin-bottom: 8px; font-size: 11px;">
                        ${d.file.path}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; padding: 8px 0; border-top: 1px solid #333; border-bottom: 1px solid #333;">
                        <div>
                            <div style="color: #888; font-size: 10px;">Size</div>
                            <div style="color: ${theme.colors.text.accent}; font-weight: bold;">${(d.file.size / 1024).toFixed(1)} KB</div>
                        </div>
                        <div>
                            <div style="color: #888; font-size: 10px;">Lines</div>
                            <div style="color: ${theme.colors.text.accent}; font-weight: bold;">${d.file.lines ?? 0}</div>
                        </div>
                        <div>
                            <div style="color: #888; font-size: 10px;">Functions</div>
                            <div style="color: ${theme.colors.text.accent}; font-weight: bold;">${d.file.functions?.length || 0}</div>
                        </div>
                        <div>
                            <div style="color: #888; font-size: 10px;">Complexity</div>
                            <div style="color: ${complexityColor}; font-weight: bold;">${d.file.complexity?.level || 'low'}</div>
                        </div>
                    </div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; color: #888; font-size: 10px;">
                        Click for detailed view
                    </div>
                `)
                .style('visibility', 'visible');
            })
            .on('mousemove', function(event) {
                tooltip
                    .style('top', (event.pageY + 10) + 'px')
                    .style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('stroke', theme.colors.border.accent)
                    .attr('stroke-width', 2);
                tooltip.style('visibility', 'hidden');
                clearHighlights();
            })
            .on('click', function(event, d) {
                event.stopPropagation();
                setSelectedFile(d.file);
                setModalOpen(true);
            })
            .call(d3.drag<SVGCircleElement, GraphNode>()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }) as any);

            link.on('mouseover', (event, d) => {
                const sourceId = getNodeId(d.source);
                const targetId = getNodeId(d.target);
                const sourceFile = fileMap.get(sourceId);
                const targetFile = fileMap.get(targetId);

                link
                    .attr('stroke', (l) => (l === d ? theme.colors.visualization.edges.hover : theme.colors.visualization.edges.default))
                    .attr('stroke-opacity', (l) => (l === d ? 0.9 : 0.15))
                    .attr('stroke-width', (l) => (l === d ? 2.6 : 1));

                node
                    .attr('stroke', (n) => (n.id === sourceId || n.id === targetId ? theme.colors.text.accent : theme.colors.border.accent))
                    .attr('stroke-width', (n) => (n.id === sourceId || n.id === targetId ? 3 : 2))
                    .style('filter', (n) => (n.id === sourceId || n.id === targetId ? 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.55))' : 'none'));

                tooltip
                    .style('visibility', 'visible')
                    .html(`
                        <div style="font-weight: 600; color: ${theme.colors.text.accent}; margin-bottom: 6px; font-size: 12px;">
                            ${sourceFile?.name || sourceId} → ${targetFile?.name || targetId}
                        </div>
                        <div style="color: ${theme.colors.text.secondary}; font-size: 10px;">Hover line for details. Click for connection.</div>
                    `);
            }).on('mousemove', (event) => {
                tooltip
                    .style('top', (event.pageY + 10) + 'px')
                    .style('left', (event.pageX + 10) + 'px');
            }).on('mouseout', () => {
                tooltip.style('visibility', 'hidden');
                clearHighlights();
            }).on('click', (event, d) => {
                event.stopPropagation();
                setSelectedConnection({ source: getNodeId(d.source), target: getNodeId(d.target) });
                setConnectionModalOpen(true);
            });

        const label = g.append('g')
            .selectAll('text')
            .data(nodes.filter(d => d.radius > 8))
            .join('text')
            .text(d => d.file.name.length > 15 ? d.file.name.substring(0, 12) + '...' : d.file.name)
            .attr('font-size', 10)
            .attr('fill', theme.colors.text.primary)
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.radius + 12)
            .style('pointer-events', 'none');

        simulation.on('tick', () => {
            link
                .attr('x1', d => (d.source as GraphNode).x!)
                .attr('y1', d => (d.source as GraphNode).y!)
                .attr('x2', d => (d.target as GraphNode).x!)
                .attr('y2', d => (d.target as GraphNode).y!);

            node
                .attr('cx', d => d.x!)
                .attr('cy', d => d.y!);

            label
                .attr('x', d => d.x!)
                .attr('y', d => d.y!);
        });

        return () => {
            simulation.stop();
            tooltip.remove();
        };
    }, [data]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ action: string }>).detail;
            if (!detail?.action || !zoomRef.current || !svgSelectionRef.current) return;
            const svg = svgSelectionRef.current;
            const zoom = zoomRef.current;
            if (detail.action === 'reset') {
                svg.transition().duration(250).call(zoom.transform as any, d3.zoomIdentity);
                return;
            }
            if (detail.action === 'zoom-in') {
                svg.transition().duration(200).call(zoom.scaleBy as any, 1.2);
            }
            if (detail.action === 'zoom-out') {
                svg.transition().duration(200).call(zoom.scaleBy as any, 0.8);
            }
        };
        window.addEventListener('viz-control', handler as EventListener);
        return () => window.removeEventListener('viz-control', handler as EventListener);
    }, []);

    const connections = useMemo(() => {
        if (!data || !selectedFile) return { imports: 0, exports: 0 };
        const imports = data.connections.filter(c => c.target === selectedFile.path).length;
        const exports = data.connections.filter(c => c.source === selectedFile.path).length;
        return { imports, exports };
    }, [selectedFile, data]);

    if (!data) return null;

    return (
        <>
            <div className="w-full h-full overflow-auto bg-black">
                <svg ref={svgRef} />
            </div>

            <NodeDetailsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                file={selectedFile}
                connections={connections}
            />

            <ConnectionDetailsModal
                open={connectionModalOpen}
                onOpenChange={setConnectionModalOpen}
                sourcePath={selectedConnection?.source}
                targetPath={selectedConnection?.target}
            />
        </>
    );
}
