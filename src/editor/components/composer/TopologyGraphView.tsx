import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Network, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { TopologyParseResult, TopologyEdge, TopologyVertex, TopologyHealthData } from '../../utils/output-parser';

// ============================================================================
// Types
// ============================================================================

interface TopologyNodeData extends Record<string, unknown> {
  label: string;
  type?: string;
  properties?: Record<string, unknown>;
  isExternalResource: boolean;
}

interface TopologyEdgeData extends Record<string, unknown> {
  type?: string;
  displayType?: string;
  fromInstance?: string;
  toInstance?: string;
  fromInstanceEdgeType?: string;
  toInstanceEdgeType?: string;
  instanceEdgeType?: string;
  healthData?: TopologyHealthData;
  metaData?: Record<string, string>;
  metricReportingNode?: string;
}

// ============================================================================
// Color Schemes
// ============================================================================

const EDGE_TYPE_COLORS: Record<string, string> = {
  Network: '#06b6d4', // cyan
  Bridge: '#a855f7',  // purple
  CDP: '#f97316',     // orange
  LLDP: '#22c55e',    // green
  default: '#6b7280', // gray
};

const NODE_COLORS = {
  device: 'bg-cyan-500/20 border-cyan-500/50',
  external: 'bg-grey-500/20 border-grey-500/50',
};

// ============================================================================
// Custom Node Component
// ============================================================================

interface CustomNodeProps {
  data: TopologyNodeData;
  selected?: boolean;
}

function TopologyNode({ data, selected }: CustomNodeProps) {
  const truncatedLabel = data.label.length > 25 
    ? data.label.slice(0, 22) + '…' 
    : data.label;
  
  return (
    <div
      className={cn(
        `
          max-w-[200px] min-w-[120px] rounded-lg border-2 px-3 py-2
          transition-all
        `,
        data.isExternalResource ? NODE_COLORS.external : NODE_COLORS.device,
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      <Handle type="target" position={Position.Top} className="
        bg-muted-foreground!
      " />
      <div className="flex flex-col gap-1">
        <span className="truncate text-xs font-medium" title={data.label}>
          {truncatedLabel}
        </span>
        {data.type && (
          <Badge variant="outline" className="w-fit text-[10px]">
            {data.type}
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="
        bg-muted-foreground!
      " />
    </div>
  );
}

// ============================================================================
// Custom Edge Component
// ============================================================================

interface CustomEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data?: TopologyEdgeData;
  selected?: boolean;
}

function TopologyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: CustomEdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = data?.instanceEdgeType 
    ? EDGE_TYPE_COLORS[data.instanceEdgeType] || EDGE_TYPE_COLORS.default
    : EDGE_TYPE_COLORS.default;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: edgeColor,
        strokeWidth: selected ? 3 : 2,
      }}
    />
  );
}

// ============================================================================
// Detail Panel Component
// ============================================================================

interface DetailPanelProps {
  selectedNode: Node<TopologyNodeData> | null;
  selectedEdge: Edge<TopologyEdgeData> | null;
}

function DetailPanel({ selectedNode, selectedEdge }: DetailPanelProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="
        flex h-full items-center justify-center p-4 text-center text-xs
        text-muted-foreground
      ">
        Click a node or edge to view details
      </div>
    );
  }

  if (selectedNode) {
    const { data } = selectedNode;
    return (
      <ScrollArea className="h-full">
        <div className="space-y-3 p-3">
          <div>
            <div className="
              mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
            ">Node</div>
            <div className="text-sm font-medium break-all">{data.label}</div>
          </div>
          {data.type && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Type</div>
              <Badge variant="outline" className="text-xs">{data.type}</Badge>
            </div>
          )}
          {data.properties && Object.keys(data.properties).length > 0 && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Properties</div>
              <div className="space-y-1">
                {Object.entries(data.properties).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="font-mono">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  if (selectedEdge) {
    const { data, source, target } = selectedEdge;
    
    // Extract DataSource names from health data
    const getDataSourceNames = (healthData?: TopologyHealthData) => {
      if (!healthData) return null;
      const sources: { metric: string; dataSource: string; datapoints: string[] }[] = [];
      
      for (const [metricName, metric] of Object.entries(healthData)) {
        if (!metric) continue;
        const dsNames = new Set<string>();
        const dpNames: string[] = [];
        
        for (const direction of ['Tx', 'Rx'] as const) {
          const dirData = metric[direction];
          if (dirData) {
            for (const [ds, dp] of Object.entries(dirData)) {
              dsNames.add(ds);
              dpNames.push(`${direction}: ${dp}`);
            }
          }
        }
        
        if (dsNames.size > 0) {
          sources.push({
            metric: metricName,
            dataSource: Array.from(dsNames).join(', '),
            datapoints: dpNames,
          });
        }
      }
      
      return sources.length > 0 ? sources : null;
    };
    
    const healthSources = getDataSourceNames(data?.healthData);
    
    return (
      <ScrollArea className="h-full">
        <div className="space-y-3 p-3">
          <div>
            <div className="
              mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
            ">Connection</div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">From:</span>
                <span className="font-medium break-all">{source}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">To:</span>
                <span className="font-medium break-all">{target}</span>
              </div>
            </div>
          </div>
          
          {(data?.type || data?.displayType) && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Edge Type</div>
              <div className="flex flex-wrap gap-2">
                {data?.type && <Badge variant="outline" className="text-xs">{data.type}</Badge>}
                {data?.displayType && data.displayType !== data.type && (
                  <Badge variant="secondary" className="text-xs">{data.displayType}</Badge>
                )}
              </div>
            </div>
          )}
          
          {data?.instanceEdgeType && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Instance Edge Type</div>
              <Badge 
                className="text-xs"
                style={{ 
                  backgroundColor: `${EDGE_TYPE_COLORS[data.instanceEdgeType] || EDGE_TYPE_COLORS.default}20`,
                  color: EDGE_TYPE_COLORS[data.instanceEdgeType] || EDGE_TYPE_COLORS.default,
                }}
              >
                {data.instanceEdgeType}
              </Badge>
            </div>
          )}
          
          {(data?.fromInstance || data?.toInstance) && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Instances</div>
              <div className="space-y-1 font-mono text-xs">
                {data?.fromInstance && (
                  <div className="break-all">
                    <span className="text-muted-foreground">From: </span>
                    {data.fromInstance}
                    {data.fromInstanceEdgeType && (
                      <span className="text-muted-foreground"> ({data.fromInstanceEdgeType})</span>
                    )}
                  </div>
                )}
                {data?.toInstance && (
                  <div className="break-all">
                    <span className="text-muted-foreground">To: </span>
                    {data.toInstance}
                    {data.toInstanceEdgeType && (
                      <span className="text-muted-foreground"> ({data.toInstanceEdgeType})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {healthSources && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Health DataSources</div>
              <div className="space-y-2">
                {healthSources.map(({ metric, dataSource, datapoints }) => (
                  <div key={metric} className="text-xs">
                    <div className="font-medium">{metric}</div>
                    <div className="text-muted-foreground">
                      DS: <span className="font-mono">{dataSource}</span>
                    </div>
                    <div className="
                      font-mono text-[10px] text-muted-foreground/70
                    ">
                      {datapoints.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {data?.metaData && Object.keys(data.metaData).length > 0 && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Metadata</div>
              <div className="space-y-1">
                {Object.entries(data.metaData).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {data?.metricReportingNode && (
            <div>
              <div className="
                mb-1 text-[10px] tracking-wide text-muted-foreground uppercase
              ">Metric Reporting</div>
              <Badge variant="secondary" className="text-xs">{data.metricReportingNode}</Badge>
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  return null;
}

// ============================================================================
// Layout Utilities
// ============================================================================

function createLayoutFromTopology(
  vertices: TopologyVertex[],
  edges: TopologyEdge[]
): { nodes: Node<TopologyNodeData>[]; edges: Edge<TopologyEdgeData>[] } {
  // Collect all unique node IDs from edges (including external resources)
  const nodeIds = new Set<string>();
  
  // Add vertices
  for (const v of vertices) {
    nodeIds.add(v.id);
  }
  
  // Add nodes from edges (may include external resources not in vertices)
  for (const e of edges) {
    nodeIds.add(e.from);
    nodeIds.add(e.to);
  }
  
  // Build vertex lookup for properties
  const vertexMap = new Map<string, TopologyVertex>();
  for (const v of vertices) {
    vertexMap.set(v.id, v);
  }
  
  // Create nodes with simple grid layout
  const nodeArray = Array.from(nodeIds);
  const cols = Math.ceil(Math.sqrt(nodeArray.length));
  const spacing = { x: 250, y: 150 };
  
  const flowNodes: Node<TopologyNodeData>[] = nodeArray.map((id, idx) => {
    const vertex = vertexMap.get(id);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    
    return {
      id,
      type: 'topologyNode',
      position: { x: col * spacing.x + 50, y: row * spacing.y + 50 },
      data: {
        label: vertex?.name || id,
        type: vertex?.type,
        properties: vertex?.properties,
        isExternalResource: !vertex, // If not in vertices, it's an external resource
      },
    };
  });
  
  // Create edges
  const flowEdges: Edge<TopologyEdgeData>[] = edges.map((e, idx) => ({
    id: `edge-${idx}`,
    source: e.from,
    target: e.to,
    type: 'topologyEdge',
    data: {
      type: e.type,
      displayType: e.displayType,
      fromInstance: e.fromInstance,
      toInstance: e.toInstance,
      fromInstanceEdgeType: e.fromInstanceEdgeType,
      toInstanceEdgeType: e.toInstanceEdgeType,
      instanceEdgeType: e.instanceEdgeType,
      healthData: e.healthData,
      metaData: e.metaData,
      metricReportingNode: e.metricReportingNode,
    },
  }));
  
  return { nodes: flowNodes, edges: flowEdges };
}

// ============================================================================
// Node and Edge Types
// ============================================================================

const nodeTypes: NodeTypes = {
  topologyNode: TopologyNode,
};

const edgeTypes: EdgeTypes = {
  topologyEdge: TopologyEdgeComponent,
};

// ============================================================================
// Main Component
// ============================================================================

interface TopologyGraphViewProps {
  result: TopologyParseResult;
}

export function TopologyGraphView({ result }: TopologyGraphViewProps) {
  const { vertices, edges } = result;
  
  const [selectedNode, setSelectedNode] = useState<Node<TopologyNodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge<TopologyEdgeData> | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const initialLayout = useMemo(
    () => createLayoutFromTopology(vertices, edges),
    [vertices, edges]
  );
  
  const [nodes, , onNodesChange] = useNodesState(initialLayout.nodes);
  const [flowEdges, , onEdgesChange] = useEdgesState(initialLayout.edges);
  
  // Compute unique edge types from actual data for dynamic legend
  const uniqueEdgeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const edge of edges) {
      if (edge.instanceEdgeType) types.add(edge.instanceEdgeType);
    }
    return Array.from(types).sort();
  }, [edges]);
  
  // Check if we have both device and external nodes
  const hasExternalNodes = useMemo(() => {
    const vertexIds = new Set(vertices.map(v => v.id));
    return edges.some(e => !vertexIds.has(e.from) || !vertexIds.has(e.to));
  }, [vertices, edges]);
  
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<TopologyNodeData>) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setDetailsOpen(true); // Auto-open when selecting
  }, []);
  
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge<TopologyEdgeData>) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setDetailsOpen(true); // Auto-open when selecting
  }, []);
  
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);
  
  if (vertices.length === 0 && edges.length === 0) {
    return (
      <Empty className="h-full border-none py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Network className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No topology data</EmptyTitle>
          <EmptyDescription>
            Run a TopologySource script to visualize the network graph
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  
  return (
    <div className="relative flex h-full">
      {/* Graph Area */}
      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Controls 
            className="
              border-border! bg-card! shadow-md!
              [&>button]:border-border! [&>button]:bg-card!
              [&>button]:text-foreground!
              [&>button:hover]:bg-muted!
            " 
          />
          <Background color="hsl(var(--muted-foreground) / 0.2)" gap={20} />
        </ReactFlow>
        
        {/* Floating Legend - bottom left of graph, positioned above zoom controls */}
        <div className="
          absolute bottom-4 left-16 rounded-lg border border-border bg-card/95
          p-2 shadow-md backdrop-blur-sm
        ">
          <div className="flex items-center gap-3 text-[10px]">
            {/* Edge types */}
            {uniqueEdgeTypes.map(type => {
              const color = EDGE_TYPE_COLORS[type] || EDGE_TYPE_COLORS.default;
              return (
                <div key={type} className="flex items-center gap-1">
                  <div 
                    className="h-0.5 w-4 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <span style={{ color }}>{type}</span>
                </div>
              );
            })}
            {/* Node types separator */}
            {uniqueEdgeTypes.length > 0 && (hasExternalNodes || vertices.length > 0) && (
              <div className="h-3 w-px bg-border" />
            )}
            {/* Node types */}
            {vertices.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <div className="
                  size-2.5 rounded-sm border border-cyan-500 bg-cyan-500/50
                " />
                <span>Device</span>
              </div>
            )}
            {hasExternalNodes && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <div className="
                  size-2.5 rounded-sm border border-grey-500 bg-grey-500/50
                " />
                <span>External</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Toggle button for details panel */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="
            absolute top-4 right-4 bg-card/95 shadow-md backdrop-blur-sm
          "
          title={detailsOpen ? 'Hide details' : 'Show details'}
        >
          {detailsOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
      </div>
      
      {/* Collapsible Detail Sidebar */}
      <div 
        className={cn(
          `
            flex flex-col overflow-hidden border-l border-border bg-card
            transition-all duration-200 ease-in-out
          `,
          detailsOpen ? "w-80" : "w-0 border-l-0"
        )}
      >
        <div className="flex h-full w-80 flex-col">
          <div className="
            flex shrink-0 items-center justify-between border-b border-border
            px-3 py-2
          ">
            <span className="
              text-xs font-medium tracking-wide text-muted-foreground uppercase
            ">
              Details
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDetailsOpen(false)}
              className="size-6"
            >
              <PanelRightClose className="size-3.5" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <DetailPanel selectedNode={selectedNode} selectedEdge={selectedEdge} />
          </div>
        </div>
      </div>
    </div>
  );
}

