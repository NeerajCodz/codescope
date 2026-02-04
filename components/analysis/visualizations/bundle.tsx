'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';
import { FileNode } from '@/types';
import theme from '@/utils/themes';

export function Bundle() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const width = 800;
        const radius = width / 2;
        const innerRadius = radius - 150;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([0.5, 5])
            .on('zoom', (event) => {
                const currentTransform = event.transform;
                g.attr('transform', `translate(${radius + currentTransform.x},${radius + currentTransform.y}) scale(${currentTransform.k})`);
            });

        svg.call(zoom as any);

        const g = svg.append('g')
            .attr('transform', `translate(${radius},${radius})`);

        // Tooltip
        const tooltip = d3.select('body').selectAll('.bundle-tooltip').data([0])
            .join('div')
            .attr('class', 'bundle-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', theme.colors.background.card)
            .style('border', `1px solid ${theme.colors.border.accent}`)
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');

        const cluster = d3.cluster()
            .size([360, innerRadius]);

        const buildHierarchy = (files: any[]) => {
            const root: any = { name: 'root', children: [] };
            files.slice(0, 50).forEach(file => {
                const parts = file.path.split('/');
                let current = root;
                parts.forEach((part: string) => {
                    let child = current.children.find((c: any) => c.name === part);
                    if (!child) {
                        child = { name: part, children: [] };
                        current.children.push(child);
                    }
                    current = child;
                });
                current.path = file.path;
            });
            return root;
        };

        const root = cluster(d3.hierarchy(buildHierarchy(data.files)) as any);
        const map = new Map(root.leaves().map((d: any) => [d.data.path, d]));

        const line = d3.lineRadial()
            .curve(d3.curveBundle.beta(0.85))
            .radius((d: any) => d.y)
            .angle((d: any) => d.x * Math.PI / 180);

        const links = data.connections
            .filter(c => map.has(c.source) && map.has(c.target))
            .map(c => {
                const source = map.get(c.source)!;
                const target = map.get(c.target)!;
                return source.path(target);
            });

        g.append('g')
            .attr('fill', 'none')
            .attr('stroke', theme.colors.visualization.edges.default)
            .attr('stroke-opacity', 0.3)
            .selectAll('path')
            .data(links)
            .join('path')
            .attr('d', line as any)
            .on('mouseover', function() {
                d3.select(this).attr('stroke', theme.colors.text.accent).attr('stroke-opacity', 0.7).attr('stroke-width', 1.5);
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', theme.colors.visualization.edges.default).attr('stroke-opacity', 0.3).attr('stroke-width', 1);
            });

        g.append('g')
            .selectAll('circle')
            .data(root.leaves())
            .join('circle')
            .attr('transform', (d: any) => `rotate(${d.x - 90}) translate(${d.y},0)`)
            .attr('r', 5)
            .attr('fill', (d: any) => {
                const file = data.files.find(f => f.path === d.data.path);
                return file ? theme.getNodeColor(file.path) : theme.colors.visualization.nodes.default;
            })
            .attr('stroke', theme.colors.border.accent)
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('mouseover', function(event: any, d: any) {
                d3.select(this)
                    .attr('r', 7)
                    .attr('stroke', theme.colors.text.accent)
                    .attr('stroke-width', 2);
                
                const file = data.files.find(f => f.path === d.data.path);
                if (file) {
                    tooltip.style('visibility', 'visible')
                        .html(`<div style="color: ${theme.colors.text.primary}">
                            <div style="font-weight: 600; color: ${theme.colors.text.accent}; font-size: 13px; margin-bottom: 6px">${file.name}</div>
                            <div style="color: ${theme.colors.text.secondary}; font-size: 11px; margin-bottom: 6px">${file.path}</div>
                            <div style="display: grid; grid-template-columns: auto auto; gap: 6px; padding-top: 6px; border-top: 1px solid ${theme.colors.border.accent}">
                                <div><span style="color: ${theme.colors.text.secondary}">Size:</span> <span style="color: ${theme.colors.text.accent}">${(file.size / 1024).toFixed(1)} KB</span></div>
                                <div><span style="color: ${theme.colors.text.secondary}">Lines:</span> <span style="color: ${theme.colors.text.accent}">${file.lines ?? 0}</span></div>
                                <div><span style="color: ${theme.colors.text.secondary}">Functions:</span> <span style="color: ${theme.colors.text.accent}">${file.functions?.length || 0}</span></div>
                                <div><span style="color: ${theme.colors.text.secondary}">Folder:</span> <span style="color: ${theme.colors.text.accent}">${file.folder}</span></div>
                            </div>
                        </div>`);
                }
            })
            .on('mousemove', (event: any) => {
                tooltip.style('top', (event.pageY + 10) + 'px').style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 5)
                    .attr('stroke', theme.colors.border.accent)
                    .attr('stroke-width', 1.5);
                tooltip.style('visibility', 'hidden');
            })
            .on('click', (event: any, d: any) => {
                const file = data.files.find(f => f.path === d.data.path);
                if (file) {
                    setSelectedFile(file);
                    setModalOpen(true);
                }
            });

        g.append('g')
            .selectAll('g')
            .data(root.leaves())
            .join('g')
            .attr('transform', (d: any) => `rotate(${d.x - 90}) translate(${d.y},0)`)
            .append('text')
            .attr('dy', '0.31em')
            .attr('x', (d: any) => d.x < 180 ? 6 : -6)
            .attr('text-anchor', (d: any) => d.x < 180 ? 'start' : 'end')
            .attr('transform', (d: any) => d.x >= 180 ? 'rotate(180)' : null)
            .attr('font-size', '9px')
            .attr('font-weight', 500)
            .attr('fill', theme.colors.text.primary)
            .attr('stroke', theme.colors.background.dark)
            .attr('stroke-width', 0.3)
            .attr('paint-order', 'stroke')
            .text((d: any) => d.data.name);

    }, [data]);

    return (
        <>
            <div className="w-full h-full flex items-center justify-center p-4">
                <svg
                    ref={svgRef}
                    viewBox="0 0 800 800"
                    className="w-full h-full max-w-[800px] max-h-[800px]"
                />
            </div>
            <NodeDetailsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                file={selectedFile}
                connections={selectedFile ? {
                    imports: data?.connections.filter(c => c.target === selectedFile.path).length || 0,
                    exports: data?.connections.filter(c => c.source === selectedFile.path).length || 0
                } : undefined}
            />
        </>
    );
}
