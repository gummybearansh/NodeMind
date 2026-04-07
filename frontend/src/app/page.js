"use client";

import React, { useCallback, useEffect, useState, useRef } from 'react';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  Panel,
} from '@xyflow/react';
import CustomNode from '@/components/CustomNode';
import MarkdownDrawer from '@/components/MarkdownDrawer';

const nodeTypes = { custom: CustomNode };

// Hard-coded column X positions per owner — Dagre-free layout
const COLUMN_X = {
  'Project Manager':   80,
  'Frontend Engineer': 440,
  'Backend Engineer':  800,
  'QA Tester':        1160,
};
const NODE_HEIGHT = 100;
const NODE_GAP    = 24;

// Status pipeline steps
const STATUS_STEPS = {
  idle:            null,
  initiating:      { label: '⚡ Initiating swarm...',              color: '#818cf8' },
  pm:              { label: '🧠 Project Manager thinking...',       color: '#a78bfa' },
  frontend:        { label: '🎨 Frontend Engineer thinking...',     color: '#60a5fa' },
  backend:         { label: '⚙️  Backend Engineer thinking...',     color: '#f87171' },
  qa:              { label: '🔍 QA Tester thinking...',            color: '#facc15' },
  semantic_search: { label: '🕸️  Running semantic search...',      color: '#34d399' },
  linking:         { label: '🔗 Linking nodes across agents...',    color: '#22d3ee' },
  complete:        { label: '✅ Swarm complete!',                   color: '#4ade80' },
};

// Log entry type classifier
function classifyLog(msg) {
  if (msg.startsWith('[STATUS]'))            return 'status';
  if (msg.includes('Node Created'))          return 'node';
  if (msg.includes('Semantic search') || msg.includes('Linking') || msg.includes('semantic')) return 'semantic';
  if (msg.includes('Error') || msg.includes('error') || msg.includes('invalid')) return 'error';
  if (msg.includes('Swarm') || msg.includes('complete') || msg.includes('disconnected')) return 'system';
  return 'info';
}

const LOG_COLORS = {
  status:   '#818cf8',
  node:     '#4ade80',
  semantic: '#22d3ee',
  error:    '#f87171',
  system:   '#a78bfa',
  info:     '#4b5563',
};

// Inner component that can call useReactFlow()
function NodeMindCanvas({ nodes, edges, onNodesChange, onEdgesChange, onNodeClick, onPaneClick,
                          onNodeDragStart, onNodeDragStop,
                          activeSessionPrompt, promptInput, setPromptInput,
                          isSubmitting, handlePromptSubmit,
                          logs, logsEndRef, statusKey,
                          highlightedNodeId }) {
  const { fitView } = useReactFlow();
  const statusInfo  = STATUS_STEPS[statusKey];

  // Neighborhood highlighting calculation
  const { connectedNodes, connectedEdges } = React.useMemo(() => {
    if (!highlightedNodeId) return { connectedNodes: new Set(), connectedEdges: new Set() };
    
    const nodeSet = new Set([highlightedNodeId]);
    const edgeSet = new Set();
    
    edges.forEach(e => {
      if (e.source === highlightedNodeId || e.target === highlightedNodeId) {
        edgeSet.add(e.id);
        nodeSet.add(e.source);
        nodeSet.add(e.target);
      }
    });

    return { connectedNodes: nodeSet, connectedEdges: edgeSet };
  }, [highlightedNodeId, edges]);

  // Apply visual state (faded/highlighted) to nodes and edges
  const displayNodes = React.useMemo(() => {
    if (!highlightedNodeId) return nodes;
    return nodes.map(n => ({
      ...n,
      data: { ...n.data, faded: !connectedNodes.has(n.id) }
    }));
  }, [nodes, highlightedNodeId, connectedNodes]);

  const displayEdges = React.useMemo(() => {
    if (!highlightedNodeId) return edges;
    return edges.map(e => ({
      ...e,
      animated: connectedEdges.has(e.id),
      style: { 
        ...e.style, 
        opacity: connectedEdges.has(e.id) ? 1 : 0.08,
        stroke:  connectedEdges.has(e.id) ? '#818cf8' : e.style?.stroke,
        strokeWidth: connectedEdges.has(e.id) ? 3 : 1,
      }
    }));
  }, [edges, highlightedNodeId, connectedEdges]);

  // Auto fit-view whenever nodes are added
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ 
        padding: { top: 60, bottom: 60, left: 60, right: 440 }, 
        duration: 400 
      }), 50);
    }
  }, [nodes.length, fitView]);

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={displayEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      minZoom={0.5}
      maxZoom={1.2}
      fitView
      fitViewOptions={{ padding: { top: 60, bottom: 60, left: 60, right: 440 } }}
    >
      <Background color="#111318" gap={28} size={1} />
      <Controls style={{ background: '#181b21', border: '1px solid #272a31' }} />

      {/* ── Input form (shown when no active session) ─────────────────────── */}
      {!activeSessionPrompt && (
        <Panel position="top-center" style={{ marginTop: 24, width: 500 }}>
          <div style={{
            background:    '#0f1117',
            padding:       '24px 28px',
            borderRadius:  14,
            border:        '1px solid #1e2028',
            boxShadow:     '0 0 40px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }} />
              <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#e2e8f0', letterSpacing: '-0.02em' }}>
                NodeMind Swarm
              </h1>
            </div>
            <p style={{ fontSize: 12, color: '#374151', margin: '0 0 18px 0', fontFamily: 'monospace' }}>
              &gt; Command the AI agent swarm to architect any system
            </p>
            <form onSubmit={handlePromptSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={promptInput}
                onChange={e => setPromptInput(e.target.value)}
                placeholder="Build a real-time chess app..."
                style={{
                  flex:         1,
                  background:   '#080a0f',
                  border:       '1px solid #1e2028',
                  color:        '#e2e8f0',
                  padding:      '11px 14px',
                  borderRadius: 8,
                  outline:      'none',
                  fontSize:     13,
                  fontFamily:   'monospace',
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background:   'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color:        'white',
                  border:       'none',
                  padding:      '11px 22px',
                  borderRadius: 8,
                  cursor:       isSubmitting ? 'not-allowed' : 'pointer',
                  fontWeight:   700,
                  fontSize:     13,
                  whiteSpace:   'nowrap',
                  boxShadow:    '0 0 16px rgba(99,102,241,0.4)',
                }}
              >
                Run Swarm
              </button>
            </form>
          </div>
        </Panel>
      )}

      {/* ── Active prompt banner ────────────────────────────────────────────── */}
      {activeSessionPrompt && (
        <Panel position="top-center" style={{ marginTop: 20, pointerEvents: 'none' }}>
          <div style={{
            background:    'rgba(8,10,15,0.85)',
            padding:       '9px 24px',
            borderRadius:  30,
            border:        '1px solid #1e2028',
            backdropFilter:'blur(16px)',
            color:         '#9ca3af',
            fontStyle:     'italic',
            fontSize:      13,
            fontFamily:    'monospace',
            maxWidth:      580,
            textAlign:     'center',
            boxShadow:     '0 0 20px rgba(0,0,0,0.6)',
          }}>
            &gt;&gt; "{activeSessionPrompt}"
          </div>
        </Panel>
      )}

      {/* ── Status pill ──────────────────────────────────────────────────────── */}
      {statusInfo && (
        <Panel position="top-center" style={{ marginTop: activeSessionPrompt ? 72 : 20, pointerEvents: 'none' }}>
          <div style={{
            display:       'flex',
            alignItems:    'center',
            gap:           8,
            background:    `${statusInfo.color}18`,
            border:        `1px solid ${statusInfo.color}55`,
            padding:       '6px 16px',
            borderRadius:  20,
            color:         statusInfo.color,
            fontSize:      12,
            fontWeight:    600,
            fontFamily:    'monospace',
            backdropFilter:'blur(8px)',
            boxShadow:     `0 0 14px ${statusInfo.color}22`,
          }}>
            <span style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   statusInfo.color,
              animation:    'swarmPulse 1.2s ease-in-out infinite',
              flexShrink:   0,
            }} />
            {statusInfo.label}
          </div>
        </Panel>
      )}

      {/* ── Agent Feed — Hacker Terminal ─────────────────────────────────────── */}
      <Panel position="top-right" style={{ margin: 16, width: 360 }}>
        <div style={{
          background:    '#060809',
          borderRadius:  10,
          border:        '1px solid #0f1117',
          height:        460,
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     '0 0 40px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,255,65,0.02)',
          overflow:      'hidden',
        }}>
          {/* Terminal top bar */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            padding:        '10px 14px',
            borderBottom:   '1px solid #0f1117',
            background:     '#080a0f',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{
              marginLeft:    8,
              fontSize:      11,
              fontFamily:    'monospace',
              color:         '#1a2a1a',
              letterSpacing: '0.05em',
            }}>
              nodemind — agent-feed
            </span>
            <span style={{
              marginLeft:    'auto',
              width:         7,
              height:        7,
              borderRadius:  '50%',
              background:    '#22c55e',
              boxShadow:     '0 0 6px #22c55e',
              animation:     'swarmPulse 2s ease-in-out infinite',
            }} />
          </div>

          {/* Log lines */}
          <div style={{
            flex:          1,
            overflowY:     'auto',
            padding:       '10px 14px',
            display:       'flex',
            flexDirection: 'column',
            gap:           3,
            scrollbarWidth:'thin',
            scrollbarColor:'#0f1117 transparent',
          }}>
            {logs.length === 0 ? (
              <div style={{
                color:      '#1a2a1a',
                fontFamily: 'monospace',
                fontSize:   12,
                marginTop:  8,
              }}>
                <span style={{ color: '#22c55e' }}>$</span> awaiting swarm activation...
                <span style={{ animation: 'blink 1s step-end infinite', color: '#22c55e' }}>█</span>
              </div>
            ) : (
              logs.map((entry, i) => {
                const type  = classifyLog(entry.raw ?? entry);
                const text  = typeof entry === 'object' ? entry.text : entry;
                const color = LOG_COLORS[type] ?? '#4b5563';
                const isStatus = type === 'status';
                return (
                  <div key={i} style={{
                    fontFamily:   'monospace',
                    fontSize:     11,
                    lineHeight:   1.6,
                    color,
                    paddingTop:   isStatus ? 6 : 0,
                    borderTop:    isStatus ? '1px solid #0f1117' : 'none',
                    paddingBottom:isStatus ? 2 : 0,
                    wordBreak:    'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace:   'pre-wrap',
                  }}>
                    <span style={{ color: '#1f2937', userSelect: 'none' }}>
                      {type === 'node'     ? '+ ' :
                       type === 'semantic' ? '~ ' :
                       type === 'error'    ? '✗ ' :
                       type === 'status'   ? '▶ ' :
                       type === 'system'   ? '• ' : '  '}
                    </span>
                    {text}
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </Panel>

      {/* ── Focus Button — Global Fit ────────────────────────────────────────── */}
      {nodes.length > 0 && (
        <Panel position="bottom-center" style={{ marginBottom: 24 }}>
          <button
            onClick={() => fitView({ padding: { top: 60, bottom: 60, left: 60, right: 440 }, duration: 800 })}
            style={{
              background:    '#080a0f',
              border:        '1px solid #1e2028',
              color:         '#60a5fa',
              padding:       '8px 18px',
              borderRadius:  30,
              fontSize:      11,
              fontWeight:    700,
              fontFamily:    'monospace',
              cursor:        'pointer',
              letterSpacing: '0.08em',
              boxShadow:     '0 4px 12px rgba(0,0,0,0.5)',
              display:       'flex',
              alignItems:    'center',
              gap:           10,
              transition:    'all 0.2s ease',
            }}
            onMouseOver={e => { e.target.style.borderColor = '#60a5fa33'; e.target.style.background = '#0d1117'; }}
            onMouseOut={e => { e.target.style.borderColor = '#1e2028'; e.target.style.background = '#080a0f'; }}
          >
            <span style={{ fontSize: 13, opacity: 0.8 }}>⛶</span>
            FOCUS & FIT
          </button>
        </Panel>
      )}
    </ReactFlow>
  );
}

export default function NodeMindDashboard() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode]  = useState(null);
  const [isDrawerOpen, setIsDrawerOpen]  = useState(false);
  const [promptInput, setPromptInput]    = useState('');
  const [activeSessionPrompt, setActiveSessionPrompt] = useState('');
  const [isSubmitting, setIsSubmitting]  = useState(false);
  const [logs, setLogs]                  = useState([]);
  const [statusKey, setStatusKey]        = useState('idle');
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const logsEndRef                       = useRef(null);
  const columnCounters                   = useRef({});
  const assignedIndices                  = useRef({}); // Stabilize ID -> Row mapping

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    ws.onopen = () => console.log('NodeMind WS connected');

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Phase 1: place node in column immediately
        if (payload.type === 'addNode' && payload.node) {
          const owner = payload.node.data?.owner ?? 'Unknown';
          const nodeId = payload.node.id;

          // Find or assign a stable vertical index for this node
          let count = assignedIndices.current[nodeId];
          if (count === undefined) {
             count = columnCounters.current[owner] ?? 0;
             columnCounters.current[owner] = count + 1;
             assignedIndices.current[nodeId] = count;
          }

          const x = COLUMN_X[owner] ?? 1520;
          const y = count * (NODE_HEIGHT + NODE_GAP) + 60;

           const newNode = {
            id:       nodeId,
            type:     'custom',
            data:     { ...payload.node.data, owner },
            position: { x, y },
          };

          setNodes(prev => {
            const idx = prev.findIndex(n => n.id === newNode.id);
            if (idx >= 0) { const u = [...prev]; u[idx] = newNode; return u; }
            return [...prev, newNode];
          });
        }

        // Phase 2: semantic edges arrive after all nodes placed
        if (payload.type === 'semanticLink' && payload.edges?.length) {
          const newEdges = payload.edges.map(e => ({
            id:       e.id,
            source:   e.source,
            target:   e.target,
            type:     'smoothstep',
            animated: true,
            style:    { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.8 },
          }));

          setEdges(prev => {
            const merged = [...prev];
            newEdges.forEach(ne => {
              if (!merged.find(e => e.id === ne.id)) merged.push(ne);
            });
            return merged;
          });
        }

        // Logs + STATUS
        if (payload.type === 'log' && payload.message) {
          const raw = payload.message;

          // Parse [STATUS] marker to drive status pill
          const statusMatch = raw.match(/\[STATUS\]\s*(\w+)/);
          if (statusMatch) setStatusKey(statusMatch[1]);

          // Clean rich-text console markup
          const text = raw
            .replace(/\[STATUS\]\s*\w+\s*/g, '')
            .replace(/\[\/?\w[\w\s=-]*\]/g, '')
            .trim();

          if (text) {
            setLogs(prev => [...prev, { raw: text, text }]);
          } else if (statusMatch) {
            // Status-only log — still show as status entry
            const statusLabel = STATUS_STEPS[statusMatch[1]]?.label ?? statusMatch[1];
            setLogs(prev => [...prev, { raw: `[STATUS] ${statusLabel}`, text: statusLabel }]);
          }
        }

      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    return () => ws.close();
  }, [setNodes, setEdges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setHighlightedNodeId(node.id);
    setIsDrawerOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setHighlightedNodeId(null);
  }, []);

  const onNodeDragStart = useCallback((_, node) => {
    setHighlightedNodeId(node.id);
  }, []);

  const onNodeDragStop = useCallback(() => {
    // Keep it highlighted after drag, reset only on pane click
    // Or if they want it only while dragging, set null here
  }, []);

  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || isSubmitting) return;

    setNodes([]);
    setEdges([]);
    setLogs([]);
    columnCounters.current  = {};
    assignedIndices.current = {}; 
    setActiveSessionPrompt(promptInput);
    setStatusKey('initiating');
    setIsSubmitting(true);

    try {
      await fetch('http://localhost:8000/api/prompt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: promptInput }),
      });
    } catch (err) {
      console.error('Failed to start swarm:', err);
    }

    setTimeout(() => setIsSubmitting(false), 120000);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#060809' }}>
      <ReactFlowProvider>
        <NodeMindCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          activeSessionPrompt={activeSessionPrompt}
          promptInput={promptInput}
          setPromptInput={setPromptInput}
          isSubmitting={isSubmitting}
          handlePromptSubmit={handlePromptSubmit}
          logs={logs}
          logsEndRef={logsEndRef}
          statusKey={statusKey}
          highlightedNodeId={highlightedNodeId}
          onPaneClick={onPaneClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
        />
      </ReactFlowProvider>

      <MarkdownDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        node={selectedNode}
      />
    </div>
  );
}
