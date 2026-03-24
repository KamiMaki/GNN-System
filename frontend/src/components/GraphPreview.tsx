'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Card, Select, Tag, Descriptions, Typography, Empty, Space, Divider, theme } from 'antd';
import { EyeOutlined, NodeIndexOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import type { MockGraph, MockNode, MockEdge, MockGraphDataset } from '@/lib/mockGraphData';

const { Text } = Typography;

// Dynamically import react-force-graph-2d (uses Canvas, must be client-only)
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false },
);

// ── Color palette for classes ──
const CLASS_COLORS: Record<string, string> = {
  Normal: '#10b981',
  Critical: '#ef4444',
  Warning: '#f59e0b',
  Logic: '#0891b2',
  Sequential: '#8b5cf6',
  Pass: '#10b981',
  Marginal: '#f59e0b',
  Fail: '#ef4444',
};

const CELL_TYPE_COLORS: Record<string, string> = {
  INV: '#06b6d4',
  NAND2: '#0891b2',
  NOR2: '#0e7490',
  BUF: '#10b981',
  DFF: '#8b5cf6',
  MUX2: '#ec4899',
  AOI21: '#f59e0b',
  XOR2: '#84cc16',
  LATCH: '#a855f7',
  TGATE: '#14b8a6',
};

function getNodeColor(node: MockNode, colorBy: 'label' | 'cell_type'): string {
  if (colorBy === 'label' && node.trueLabel) {
    return CLASS_COLORS[node.trueLabel] || '#0891b2';
  }
  const ct = node.attributes.cell_type as string;
  if (ct && CELL_TYPE_COLORS[ct]) return CELL_TYPE_COLORS[ct];
  return '#0891b2';
}

// ── Main GraphPreview Component ──
interface GraphPreviewProps {
  dataset: MockGraphDataset;
}

export default function GraphPreview({ dataset }: GraphPreviewProps) {
  const { token } = theme.useToken();
  const [selectedGraphId, setSelectedGraphId] = useState<string>(dataset.graphs[0]?.graphId || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [colorBy, setColorBy] = useState<'label' | 'cell_type'>('cell_type');
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

  const selectedGraph = useMemo(
    () => dataset.graphs.find(g => g.graphId === selectedGraphId) || dataset.graphs[0],
    [dataset.graphs, selectedGraphId],
  );

  // Convert to force-graph format
  const graphData = useMemo(() => {
    if (!selectedGraph) return { nodes: [], links: [] };
    const nodes = selectedGraph.nodes.map(n => ({
      id: n.id,
      label: n.label,
      color: getNodeColor(n, colorBy),
      _data: n,
    }));
    const links = selectedGraph.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      _data: e,
    }));
    return { nodes, links };
  }, [selectedGraph, colorBy]);

  // Detail panel data
  const detailNode = useMemo(() => {
    const id = selectedNodeId || hoveredNodeId;
    if (!id || !selectedGraph) return null;
    return selectedGraph.nodes.find(n => n.id === id) || null;
  }, [selectedNodeId, hoveredNodeId, selectedGraph]);

  const detailEdgeInfo = useMemo(() => {
    if (!selectedGraph || !detailNode) return null;
    return selectedGraph.edges.filter(
      e => e.source === detailNode.id || e.target === detailNode.id,
    );
  }, [selectedGraph, detailNode]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNodeId((prev: string | null) => prev === node.id ? null : node.id);
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNodeId(node ? node.id : null);
  }, []);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = 5;
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNodeId;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.color || '#0891b2';
    ctx.fill();

    // Highlight ring for selected/hovered
    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
    }

    // Draw label when zoomed in enough
    if (globalScale > 1.5) {
      const label = node.label || node.id;
      const fontSize = Math.max(3, 10 / globalScale);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = token.colorText || '#333';
      ctx.fillText(label, node.x, node.y + size + 2);
    }
  }, [selectedNodeId, hoveredNodeId, token.colorText]);

  if (!selectedGraph) return <Empty description="No graph data available" />;

  // Collect unique cell types for legend
  const cellTypesInGraph = useMemo(() => {
    const set = new Set<string>();
    selectedGraph.nodes.forEach(n => {
      const ct = n.attributes.cell_type as string;
      if (ct) set.add(ct);
    });
    return Array.from(set).sort();
  }, [selectedGraph]);

  return (
    <Card
      title={
        <Space>
          <EyeOutlined style={{ color: token.colorPrimary }} />
          <span>Interactive Graph Preview</span>
          <Tag color="blue">{dataset.taskLevel === 'node' ? 'Node-level' : 'Graph-level'}</Tag>
        </Space>
      }
      extra={
        <Space>
          {dataset.graphs.length > 1 && (
            <Select
              value={selectedGraphId}
              onChange={(v) => { setSelectedGraphId(v); setSelectedNodeId(null); }}
              style={{ minWidth: 180 }}
              options={dataset.graphs.map(g => ({
                value: g.graphId,
                label: (
                  <Space>
                    {g.graphName}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      ({g.nodes.length}N / {g.edges.length}E)
                    </Text>
                  </Space>
                ),
              }))}
            />
          )}
          <Select
            value={colorBy}
            onChange={setColorBy}
            style={{ minWidth: 130 }}
            options={[
              { value: 'cell_type', label: 'Color: Cell Type' },
              ...(dataset.taskLevel === 'node'
                ? [{ value: 'label' as const, label: 'Color: Label' }]
                : []),
            ]}
          />
        </Space>
      }
    >
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Tag icon={<NodeIndexOutlined />}>{selectedGraph.nodes.length} Nodes</Tag>
        <Tag>{selectedGraph.edges.length} Edges</Tag>
        {selectedGraph.graphLabel && <Tag color="gold">Label: {selectedGraph.graphLabel}</Tag>}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {colorBy === 'cell_type'
          ? cellTypesInGraph.map(ct => (
              <Tag key={ct} color={CELL_TYPE_COLORS[ct] || '#0891b2'} style={{ fontSize: 11 }}>{ct}</Tag>
            ))
          : (dataset.nodeClasses || []).map(cls => (
              <Tag key={cls} color={CLASS_COLORS[cls] || '#0891b2'} style={{ fontSize: 11 }}>{cls}</Tag>
            ))
        }
      </div>

      {/* Graph Canvas + Detail Panel side-by-side */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Graph Canvas */}
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
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, 7, 0, 2 * Math.PI);
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
              {detailNode.trueLabel && (
                <Tag color={CLASS_COLORS[detailNode.trueLabel] || 'blue'} style={{ marginLeft: 8 }}>
                  {detailNode.trueLabel}
                </Tag>
              )}
              {detailNode.predictedLabel && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Predicted: </Text>
                  <Tag color={detailNode.predictedLabel === detailNode.trueLabel ? 'success' : 'error'}>
                    {detailNode.predictedLabel}
                  </Tag>
                  {detailNode.confidence != null && (
                    <Text type="secondary" style={{ fontSize: 11 }}> ({(detailNode.confidence * 100).toFixed(1)}%)</Text>
                  )}
                </div>
              )}

              <Divider style={{ margin: '12px 0' }} />
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Node Attributes
              </Text>
              <div style={{ marginTop: 8 }}>
                {Object.entries(detailNode.attributes).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{k}</Text>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{String(v)}</Text>
                  </div>
                ))}
              </div>

              {detailEdgeInfo && detailEdgeInfo.length > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Connected Edges ({detailEdgeInfo.length})
                  </Text>
                  <div style={{ marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
                    {detailEdgeInfo.slice(0, 10).map((e, i) => (
                      <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${token.colorBorderSecondary}`, fontSize: 11 }}>
                        <Text type="secondary">{e.source} → {e.target}</Text>
                        {e.attributes && Object.entries(e.attributes).map(([k, v]) => (
                          <span key={k} style={{ marginLeft: 8 }}>
                            <Text type="secondary">{k}:</Text> {String(v)}
                          </span>
                        ))}
                      </div>
                    ))}
                    {detailEdgeInfo.length > 10 && (
                      <Text type="secondary" style={{ fontSize: 11 }}>...and {detailEdgeInfo.length - 10} more</Text>
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
      <div style={{ marginTop: 16 }}>
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 4 }}
          bordered
          title={<Text type="secondary" style={{ fontSize: 12 }}>Node Feature Schema</Text>}
        >
          {selectedGraph.nodes.length > 0 &&
            Object.entries(selectedGraph.nodes[0].attributes).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                <Tag color={typeof v === 'number' ? 'blue' : 'cyan'}>{typeof v === 'number' ? 'numeric' : 'categorical'}</Tag>
              </Descriptions.Item>
            ))
          }
        </Descriptions>

        {selectedGraph.edges[0]?.attributes && (
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 4 }}
            bordered
            style={{ marginTop: 12 }}
            title={<Text type="secondary" style={{ fontSize: 12 }}>Edge Feature Schema</Text>}
          >
            {Object.entries(selectedGraph.edges[0].attributes).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                <Tag color={typeof v === 'number' ? 'blue' : 'cyan'}>{typeof v === 'number' ? 'numeric' : 'categorical'}</Tag>
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </div>
    </Card>
  );
}
