'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/components/context/analysis-context';
import theme from '@/utils/themes';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';
import { FileNode } from '@/types';

export function Matrix() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        // Get top functions by call count instead of files
        const functionConnections = data.connections.filter(c => c.fn && c.fn !== 'import');
        
        // Build unique function list from connections
        const functionSet = new Set<string>();
        functionConnections.forEach(conn => {
            if (conn.fn) functionSet.add(conn.fn);
        });
        
        const functions = Array.from(functionSet).slice(0, 40); // Limit to 40 for readability
        const n = functions.length;
        
        if (n === 0) {
            // No function calls to display
            const svg = d3.select(svgRef.current);
            svg.selectAll('*').remove();
            svg.append('text')
                .attr('x', 600)
                .attr('y', 600)
                .attr('text-anchor', 'middle')
                .attr('fill', theme.colors.text.accent)
                .attr('font-size', '16px')
                .text('No function calls to visualize');
            return;
        }

        const width = 1200;
        const margin = { top: 150, right: 0, bottom: 0, left: 150 };
        const cellSize = (width - margin.left) / n;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 10])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);
        svgSelectionRef.current = svg;
        zoomRef.current = zoom;

        const g = svg.append('g');

        // Tooltip
        const tooltip = d3.select('body').selectAll('.matrix-tooltip').data([0])
            .join('div')
            .attr('class', 'matrix-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', theme.colors.background.card)
            .style('border', `1px solid ${theme.colors.border.accent}`)
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');

        const x = d3.scaleBand().range([0, width - margin.left]).domain(d3.range(n).map(String));

        // Build matrix of function-to-function calls
        const matrix: any[][] = [];
        functions.forEach((fnSource, i) => {
            matrix[i] = d3.range(n).map(j => ({ x: j, y: i, z: 0, fn: functions[j] }));
        });

        // Build function call relationships (caller -> callee)
        data.files.forEach(file => {
            file.functions?.forEach(fn => {
                fn.callSites?.forEach(callSite => {
                    if (callSite.caller) {
                        const sourceIdx = functions.indexOf(callSite.caller);
                        const targetIdx = functions.indexOf(fn.name);
                        if (sourceIdx !== -1 && targetIdx !== -1 && sourceIdx !== targetIdx) {
                            matrix[sourceIdx][targetIdx].z += 1;
                        }
                    }
                });
            });
        });

        g.attr('transform', `translate(${margin.left},${margin.top})`);

        // Rows
        const row = g.selectAll('.row')
            .data(matrix)
            .join('g')
            .attr('class', 'row')
            .attr('transform', (d, i) => `translate(0,${x(String(i))})`);

        row.selectAll('.cell')
            .data((d: any) => d)
            .join('rect')
            .attr('class', 'cell')
            .attr('x', (d: any) => x(String(d.x))!)
            .attr('width', x.bandwidth())
            .attr('height', x.bandwidth())
            .attr('fill', (d: any) => d.z > 0 ? theme.colors.primary.cyan['500'] : theme.colors.background.dark)
            .attr('fill-opacity', (d: any) => Math.min(1, 0.3 + d.z * 0.2))
            .attr('stroke', theme.colors.border.default)
            .attr('stroke-width', 0.5)
            .style('cursor', 'pointer')
            .on('mouseover', function(event: any, d: any) {
                if (d.z > 0) {
                    d3.select(this).attr('stroke', theme.colors.primary.cyan['400']).attr('stroke-width', 2);
                    tooltip.style('visibility', 'visible')
                        .html(`<div style="color: ${theme.colors.text.primary}">
                            <div style="font-weight: 600">${functions[d.y]} → ${functions[d.x]}</div>
                            <div style="margin-top: 4px; color: ${theme.colors.text.secondary}">${d.z} calls</div>
                        </div>`);
                }
            })
            .on('mousemove', (event: any) => {
                tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', theme.colors.border.default).attr('stroke-width', 0.5);
                tooltip.style('visibility', 'hidden');
            })
            .on('click', (event: any, d: any) => {
                // Find the file that contains this function
                const functionName = functions[d.y];
                const file = data.files.find(f => f.functions?.some(fn => fn.name === functionName));
                if (file) {
                    setSelectedFile(file);
                    setModalOpen(true);
                }
            });

        // Labels
        row.append('text')
            .attr('x', -6)
            .attr('y', x.bandwidth() / 2)
            .attr('dy', '.32em')
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('fill', theme.colors.text.accent)
            .text((d: any, i: number) => functions[i]);

        const column = g.selectAll('.column')
            .data(d3.range(n))
            .join('g')
            .attr('class', 'column')
            .attr('transform', (i: any) => `translate(${x(String(i))},0) rotate(-90)`);

        column.append('text')
            .attr('x', 6)
            .attr('y', x.bandwidth() / 2)
            .attr('dy', '.32em')
            .attr('text-anchor', 'start')
            .attr('font-size', '10px')
            .attr('fill', theme.colors.text.accent)
            .text((i: any) => functions[i]);

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

    return (
        <>
            <div className="w-full h-full overflow-auto p-4 bg-slate-950">
                <svg
                    ref={svgRef}
                    viewBox="0 0 1200 1200"
                    className="min-w-[1200px] min-h-[1200px]"
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
