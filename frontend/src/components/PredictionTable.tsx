'use client';

import React, { useState, useMemo } from 'react';
import { Card, Table, Tag, Select, Space, Typography, Input, theme } from 'antd';
import { TableOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import type { MockGraphDataset } from '@/lib/mockGraphData';

const { Text } = Typography;

interface PredictionTableProps {
  dataset: MockGraphDataset;
}

export default function PredictionTable({ dataset }: PredictionTableProps) {
  const { token } = theme.useToken();
  const isNodeLevel = dataset.taskLevel === 'node';
  const [graphFilter, setGraphFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);

  // ── Build table data ──
  const rawData = useMemo(() => {
    if (isNodeLevel) {
      // Node-level: each row = one node
      const rows: any[] = [];
      for (const graph of dataset.graphs) {
        for (const node of graph.nodes) {
          const correct = node.trueLabel === node.predictedLabel;
          rows.push({
            key: node.id,
            graphId: graph.graphId,
            graphName: graph.graphName,
            nodeId: node.id,
            nodeLabel: node.label,
            trueLabel: node.trueLabel || '-',
            predictedLabel: node.predictedLabel || '-',
            confidence: node.confidence ?? 0,
            correct,
          });
        }
      }
      return rows;
    } else {
      // Graph-level: each row = one graph
      return dataset.graphs.map(g => {
        const correct = g.graphLabel === g.predictedGraphLabel;
        return {
          key: g.graphId,
          graphId: g.graphId,
          graphName: g.graphName,
          nodeCount: g.nodes.length,
          edgeCount: g.edges.length,
          trueLabel: g.graphLabel || '-',
          predictedLabel: g.predictedGraphLabel || '-',
          confidence: g.graphConfidence ?? 0,
          correct,
        };
      });
    }
  }, [dataset, isNodeLevel]);

  // ── Filtering ──
  const filteredData = useMemo(() => {
    let data = rawData;
    if (graphFilter !== 'all') {
      data = data.filter((r: any) => r.graphId === graphFilter);
    }
    if (classFilter !== 'all') {
      data = data.filter((r: any) => r.trueLabel === classFilter);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      data = data.filter((r: any) =>
        (r.nodeLabel || r.graphName || '').toLowerCase().includes(q) ||
        (r.trueLabel || '').toLowerCase().includes(q) ||
        (r.predictedLabel || '').toLowerCase().includes(q)
      );
    }
    return data;
  }, [rawData, graphFilter, classFilter, searchText]);

  // ── Per-row metrics ──
  const correctCount = filteredData.filter((r: any) => r.correct).length;
  const totalCount = filteredData.length;
  const filteredAccuracy = totalCount > 0 ? (correctCount / totalCount) : 0;

  // ── Available classes ──
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach((r: any) => { if (r.trueLabel !== '-') set.add(r.trueLabel); });
    return Array.from(set);
  }, [rawData]);

  // ── Node-level columns ──
  const nodeColumns = [
    ...(dataset.isMultiGraph ? [{
      title: 'Graph',
      dataIndex: 'graphName',
      key: 'graphName',
      width: 120,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    }] : []),
    {
      title: 'Node',
      dataIndex: 'nodeLabel',
      key: 'nodeLabel',
      width: 100,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'True Label',
      dataIndex: 'trueLabel',
      key: 'trueLabel',
      width: 120,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Predicted',
      dataIndex: 'predictedLabel',
      key: 'predictedLabel',
      width: 120,
      render: (v: string, record: any) => (
        <Tag color={record.correct ? 'green' : 'red'}>{v}</Tag>
      ),
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 110,
      sorter: (a: any, b: any) => a.confidence - b.confidence,
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 48,
            height: 6,
            borderRadius: 3,
            background: token.colorFillSecondary,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${v * 100}%`,
              height: '100%',
              borderRadius: 3,
              background: v > 0.8 ? token.colorSuccess : v > 0.6 ? token.colorWarning : token.colorError,
            }} />
          </div>
          <Text style={{ fontSize: 12 }}>{(v * 100).toFixed(1)}%</Text>
        </div>
      ),
    },
    {
      title: 'Result',
      dataIndex: 'correct',
      key: 'correct',
      width: 80,
      filters: [
        { text: 'Correct', value: true },
        { text: 'Wrong', value: false },
      ],
      onFilter: (value: any, record: any) => record.correct === value,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'error'}>{v ? 'Correct' : 'Wrong'}</Tag>
      ),
    },
  ];

  // ── Graph-level columns ──
  const graphColumns = [
    {
      title: 'Graph',
      dataIndex: 'graphName',
      key: 'graphName',
      width: 140,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Nodes',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
      width: 80,
      sorter: (a: any, b: any) => a.nodeCount - b.nodeCount,
    },
    {
      title: 'Edges',
      dataIndex: 'edgeCount',
      key: 'edgeCount',
      width: 80,
      sorter: (a: any, b: any) => a.edgeCount - b.edgeCount,
    },
    {
      title: 'True Label',
      dataIndex: 'trueLabel',
      key: 'trueLabel',
      width: 120,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Predicted',
      dataIndex: 'predictedLabel',
      key: 'predictedLabel',
      width: 120,
      render: (v: string, record: any) => (
        <Tag color={record.correct ? 'green' : 'red'}>{v}</Tag>
      ),
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 110,
      sorter: (a: any, b: any) => a.confidence - b.confidence,
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 48,
            height: 6,
            borderRadius: 3,
            background: token.colorFillSecondary,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${v * 100}%`,
              height: '100%',
              borderRadius: 3,
              background: v > 0.8 ? token.colorSuccess : v > 0.6 ? token.colorWarning : token.colorError,
            }} />
          </div>
          <Text style={{ fontSize: 12 }}>{(v * 100).toFixed(1)}%</Text>
        </div>
      ),
    },
    {
      title: 'Result',
      dataIndex: 'correct',
      key: 'correct',
      width: 80,
      filters: [
        { text: 'Correct', value: true },
        { text: 'Wrong', value: false },
      ],
      onFilter: (value: any, record: any) => record.correct === value,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'error'}>{v ? 'Correct' : 'Wrong'}</Tag>
      ),
    },
  ];

  const columns = isNodeLevel ? nodeColumns : graphColumns;

  return (
    <Card
      title={
        <Space>
          <TableOutlined style={{ color: token.colorPrimary }} />
          <span>Prediction Results</span>
          <Tag color={isNodeLevel ? 'cyan' : 'geekblue'}>
            {isNodeLevel ? 'Node-Level Task' : 'Graph-Level Task'}
          </Tag>
        </Space>
      }
    >
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <FilterOutlined style={{ color: token.colorTextSecondary }} />

        {dataset.isMultiGraph && (
          <Select
            value={graphFilter}
            onChange={setGraphFilter}
            style={{ minWidth: 160 }}
            options={[
              { value: 'all', label: 'All Graphs' },
              ...dataset.graphs.map(g => ({ value: g.graphId, label: g.graphName })),
            ]}
          />
        )}

        <Select
          value={classFilter}
          onChange={setClassFilter}
          style={{ minWidth: 140 }}
          options={[
            { value: 'all', label: 'All Classes' },
            ...availableClasses.map(c => ({ value: c, label: c })),
          ]}
        />

        <Input
          placeholder="Search..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ maxWidth: 200 }}
          allowClear
        />

        <div style={{ flex: 1 }} />

        {/* Summary stats */}
        <Space size="middle">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {filteredData.length} {isNodeLevel ? 'nodes' : 'graphs'}
          </Text>
          <Tag color={filteredAccuracy > 0.8 ? 'green' : filteredAccuracy > 0.6 ? 'gold' : 'red'}>
            Acc: {(filteredAccuracy * 100).toFixed(1)}%
          </Tag>
          <Tag color="green">{correctCount} correct</Tag>
          <Tag color="red">{totalCount - correctCount} wrong</Tag>
        </Space>
      </div>

      {/* Overall metrics */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {dataset.metrics.accuracy != null && <Tag>Accuracy: {(dataset.metrics.accuracy * 100).toFixed(2)}%</Tag>}
        {dataset.metrics.f1 != null && <Tag>F1: {(dataset.metrics.f1 * 100).toFixed(2)}%</Tag>}
        {dataset.metrics.precision != null && <Tag>Precision: {(dataset.metrics.precision * 100).toFixed(2)}%</Tag>}
        {dataset.metrics.recall != null && <Tag>Recall: {(dataset.metrics.recall * 100).toFixed(2)}%</Tag>}
        {dataset.metrics.mse != null && <Tag>MSE: {dataset.metrics.mse.toFixed(4)}</Tag>}
        {dataset.metrics.mae != null && <Tag>MAE: {dataset.metrics.mae.toFixed(4)}</Tag>}
        {dataset.metrics.r2 != null && <Tag>R²: {dataset.metrics.r2.toFixed(4)}</Tag>}
      </div>

      {/* Table */}
      <Table
        columns={columns as any}
        dataSource={filteredData}
        size="small"
        pagination={{
          pageSize,
          pageSizeOptions: ['5', '10', '20', '50'],
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
          onShowSizeChange: (_, size) => setPageSize(size),
        }}
        scroll={{ x: 'max-content' }}
        rowClassName={(record: any) => record.correct ? '' : 'ant-table-row-wrong'}
      />
    </Card>
  );
}
