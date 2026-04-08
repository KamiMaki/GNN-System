'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Tag, Descriptions, Typography, Empty, Divider, theme } from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import type { GraphSampleData, GraphSampleNode } from '@/lib/api';

const { Text } = Typography;

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false },
);

const CELL_TYPE_COLORS: Record<string, string> = {
  INV: '#06b6d4', NAND2: '#0891b2', NOR2: '#0e7490', BUF: '#10b981',
  DFF: '#8b5cf6', MUX2: '#ec4899', AOI21: '#f59e0b', XOR2: '#84cc16',
  LATCH: '#a855f7', TGATE: '#14b8a6',
  Logic: '#0891b2', Buffer: '#10b981', Register: '#8b5cf6', Port: '#f59e0b',
};

function getNodeColor(node: GraphSampleNode): string {
  const ct = (node.attributes.cell_type as string) || '';
  if (ct && CELL_TYPE_COLORS[ct]) return CELL_TYPE_COLORS[ct];
  // Fallback: hash the id for a consistent color
  return '#0891b2';
}

interface GraphPreviewProps {
  graphSample: GraphSampleData;
}

export default function GraphPreview({ graphSample }: GraphPreviewProps) {
  const { token } = theme.useToken();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const nodes = graphSample.nodes.map(n => ({
      id: String(n.id),
      label: n.label,
      color: getNodeColor(n),
      _data: n,
    }));
    const nodeIdSet = new Set(nodes.map(n => n.id));
    const links = graphSample.edges
      .map((e, i) => ({
        id: `e-${i}`,
        source: String(e.source),
        target: String(e.target),
        _data: e,
      }))
      .filter(l => nodeIdSet.has(l.source) && nodeIdSet.has(l.target));
    return { nodes, links };
  }, [graphSample]);

  const detailNode = useMemo(() => {
    const id = selectedNodeId || hoveredNodeId;
    if (!id) return null;
    return graphSample.nodes.find(n => n.id === id) || null;
  }, [selectedNodeId, hoveredNodeId, graphSample]);

  const detailEdges = useMemo(() => {
    if (!detailNode) return null;
    return graphSample.edges.filter(
      e => e.source === detailNode.id || e.target === detailNode.id,
    );
  }, [graphSample, detailNode]);

  const handleNodeClick = useCallback((node: { id?: string | number; [key: string]: unknown }) => {
    const id = String(node.id ?? '');
    setSelectedNodeId((prev: string | null) => prev === id ? null : id);
  }, []);

  const handleNodeHover = useCallback((node: { id?: string | number; [key: string]: unknown } | null) => {
    setHoveredNodeId(node ? String(node.id ?? '') : null);
  }, []);

  const nodeCanvasObject = useCallback((node: { id?: string | number; x?: number; y?: number; color?: string; label?: string; [key: string]: unknown }, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = 5;
    const id = String(node.id ?? '');
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const isSelected = id === selectedNodeId;
    const isHovered = id === hoveredNodeId;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fillStyle = (node.color as string) || '#0891b2';
    ctx.fill();

    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
    }

    if (globalScale > 2) {
      const label = (node.label as string) || id;
      const fontSize = Math.max(3, 10 / globalScale);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = token.colorText || '#333';
      ctx.fillText(label, x, y + size + 2);
    }
  }, [selectedNodeId, hoveredNodeId, token.colorText]);

  // Collect unique cell types for legend
  const cellTypesInGraph = useMemo(() => {
    const set = new Set<string>();
    graphSample.nodes.forEach(n => {
      const ct = n.attributes.cell_type as string;
      if (ct) set.add(ct);
    });
    return Array.from(set).sort();
  }, [graphSample]);

  if (!graphSample.nodes.length) return <Empty description="No graph data available" />;

  return (
    <>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Tag icon={<NodeIndexOutlined />}>{graphSample.nodes.length} Nodes</Tag>
        <Tag>{graphSample.edges.length} Edges</Tag>
      </div>

      {/* Legend */}
      {cellTypesInGraph.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {cellTypesInGraph.map(ct => (
            <Tag key={ct} color={CELL_TYPE_COLORS[ct] || '#0891b2'} style={{ fontSize: 11 }}>{ct}</Tag>
          ))}
        </div>
      )}

      {/* Graph Canvas + Detail Panel side-by-side */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div
          ref={containerRef}
          style={{
            flex: 1,
            height: 420,
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
            position: 'relative',
            background: token.colorBgContainer,
          }}
        >
          <ForceGraph2D
            graphData={graphData}
            width={Math.max(300, containerWidth - 2)}
            height={418}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node: { x?: number; y?: number; [key: string]: unknown }, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, 7, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            linkColor={() => token.colorBorderSecondary || '#e5e7eb'}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            backgroundColor={token.colorBgContainer || '#ffffff'}
            cooldownTicks={80}
            d3AlphaDecay={0.03}
            d3VelocityDecay={0.3}
          />
        </div>

        {/* Detail Panel */}
        <div style={{
          width: 280,
          minHeight: 420,
          borderRadius: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
          padding: 16,
          overflow: 'auto',
          background: token.colorBgElevated,
          flexShrink: 0,
        }}>
          {detailNode ? (
            <>
              <Text strong style={{ fontSize: 14 }}>{detailNode.label}</Text>

              <Divider style={{ margin: '12px 0' }} />
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Node Attributes
              </Text>
              <div style={{ marginTop: 8 }}>
                {Object.entries(detailNode.attributes).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{k}</Text>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{v != null ? String(v) : '—'}</Text>
                  </div>
                ))}
              </div>

              {detailEdges && detailEdges.length > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Connected Edges ({detailEdges.length})
                  </Text>
                  <div style={{ marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
                    {detailEdges.slice(0, 10).map((e, i) => (
                      <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${token.colorBorderSecondary}`, fontSize: 11 }}>
                        <Text type="secondary">{e.source} → {e.target}</Text>
                        {e.attributes && Object.entries(e.attributes).map(([k, v]) => (
                          <span key={k} style={{ marginLeft: 8 }}>
                            <Text type="secondary">{k}:</Text> {v != null ? String(v) : '—'}
                          </span>
                        ))}
                      </div>
                    ))}
                    {detailEdges.length > 10 && (
                      <Text type="secondary" style={{ fontSize: 11 }}>...and {detailEdges.length - 10} more</Text>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
              <Text type="secondary">Click or hover a node to inspect</Text>
            </div>
          )}
        </div>
      </div>

      {/* Attribute summary */}
      {graphSample.nodes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 4 }}
            bordered
            title={<Text type="secondary" style={{ fontSize: 12 }}>Node Feature Schema</Text>}
          >
            {Object.entries(graphSample.nodes[0].attributes).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                <Tag color={typeof v === 'number' ? 'blue' : 'cyan'}>{typeof v === 'number' ? 'numeric' : 'categorical'}</Tag>
              </Descriptions.Item>
            ))}
          </Descriptions>

          {graphSample.edges.length > 0 && graphSample.edges[0].attributes && (
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2, md: 4 }}
              bordered
              style={{ marginTop: 12 }}
              title={<Text type="secondary" style={{ fontSize: 12 }}>Edge Feature Schema</Text>}
            >
              {Object.entries(graphSample.edges[0].attributes).map(([k, v]) => (
                <Descriptions.Item key={k} label={k}>
                  <Tag color={typeof v === 'number' ? 'blue' : 'cyan'}>{typeof v === 'number' ? 'numeric' : 'categorical'}</Tag>
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}
        </div>
      )}
    </>
  );
}
