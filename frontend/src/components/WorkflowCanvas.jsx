
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";

import { X, Settings, Save } from "lucide-react";

import { nodeTypes } from "./WorkflowNodes";

import "@xyflow/react/dist/style.css";

// Initial Workflow Nodes

const initialNodes = [
  {
    id: "1",
    type: "sensor",
    position: { x: 80, y: 120 },
    data: {
      label: "Temperature Sensor",
      sensorType: "Temperature",
      threshold: 30,
      description: "Collect real-time sensor readings",
    },
  },
  {
    id: "2",
    type: "processing",
    position: { x: 390, y: 120 },
    data: {
      label: "Moving Average",
      description: "Filter and calculate sensor data",
    },
  },
  {
    id: "3",
    type: "alert",
    position: { x: 700, y: 120 },
    data: {
      label: "High Temperature Alert",
      threshold: 30,
      description: "Generate alerts when limits are crossed",
    },
  },
];

// Initial Connections

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    animated: true,
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    animated: true,
  },
];

const STORAGE_KEY = "nexusflow-workflow";

// Load Saved Workflow

function loadWorkflow() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (
        Array.isArray(parsed.nodes) &&
        Array.isArray(parsed.edges)
      ) {
        return {
          nodes: parsed.nodes,
          edges: parsed.edges,
        };
      }
    }
  } catch (error) {
    console.error("Could not load workflow:", error);
  }

  return {
    nodes: initialNodes,
    edges: initialEdges,
  };
}

function WorkflowCanvas({
  onCountsChange,
  onWorkflowDataChange,
  registerAddNode,
  registerSaveFunction,
  registerResetFunction,
  registerValidateFunction,
}) {

  const savedWorkflow = useRef(loadWorkflow());

  const [nodes, setNodes, onNodesChange] =
    useNodesState(savedWorkflow.current.nodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(savedWorkflow.current.edges);

  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const selectedNode = nodes.find(
    (node) => node.id === selectedNodeId
  );

  const counter = useRef(
    Math.max(
      0,
      ...savedWorkflow.current.nodes.map(
        (node) => Number(node.id) || 0
      )
    ) + 1
  );

  // Connect Nodes

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          { ...connection, animated: true },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  // Add Nodes

  const addNode = useCallback(
    (type) => {

      const labels = {
        sensor: "New Sensor",
        processing: "New Processing Step",
        alert: "New Alert",
      };

      if (!labels[type]) return;

      const id = String(counter.current++);

      const newNode = {
        id,
        type,
        position: {
          x: 150 + Math.random() * 300,
          y: 250 + Math.random() * 150,
        },
        data: {
          label: labels[type],
          sensorType: "Temperature",
          threshold: 30,
          description: "",
        },
      };

      setNodes((currentNodes) => [
        ...currentNodes,
        newNode,
      ]);

      setSelectedNodeId(id);
    },
    [setNodes]
  );

  // Update Selected Node

  const updateSelectedNode = (field, value) => {

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                [field]: value,
              },
            }
          : node
      )
    );

  };

  // Validate Workflow

  const validateWorkflow = useCallback(() => {

    const errors = [];

    const sensors = nodes.filter(
      (node) => node.type === "sensor"
    );

    const processingNodes = nodes.filter(
      (node) => node.type === "processing"
    );

    const alerts = nodes.filter(
      (node) => node.type === "alert"
    );

    if (sensors.length === 0) {
      errors.push(
        "Add at least one Sensor Input node."
      );
    }

    if (processingNodes.length === 0) {
      errors.push(
        "Add at least one Data Processing node."
      );
    }

    if (alerts.length === 0) {
      errors.push(
        "Add at least one Alert Generation node."
      );
    }

    // Sensor to Processing Connection

    const sensorConnected = edges.some((edge) =>
      sensors.some(
        (sensor) => sensor.id === edge.source
      ) &&
      processingNodes.some(
        (processing) => processing.id === edge.target
      )
    );

    if (
      sensors.length > 0 &&
      processingNodes.length > 0 &&
      !sensorConnected
    ) {
      errors.push(
        "Connect a Sensor Input node to a Data Processing node."
      );
    }

    // Processing to Alert Connection

    const alertConnected = edges.some((edge) =>
      processingNodes.some(
        (processing) => processing.id === edge.source
      ) &&
      alerts.some(
        (alert) => alert.id === edge.target
      )
    );

    if (
      processingNodes.length > 0 &&
      alerts.length > 0 &&
      !alertConnected
    ) {
      errors.push(
        "Connect a Data Processing node to an Alert Generation node."
      );
    }

    // Check Node Names

    nodes.forEach((node) => {

      if (
        !node.data?.label ||
        !node.data.label.trim()
      ) {
        errors.push(
          `Node ${node.id} needs a name.`
        );
      }

    });

    const result = {
      valid: errors.length === 0,
      errors,
    };

    console.log(
      "Workflow validation result:",
      result
    );

    return result;

  }, [nodes, edges]);

  // Save Workflow

  const saveWorkflow = useCallback(() => {

    try {

      const workflowData = {
        nodes,
        edges,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(workflowData)
      );

      console.log(
        "Workflow saved:",
        workflowData
      );

    } catch (error) {

      console.error(
        "Could not save workflow:",
        error
      );

      alert("Unable to save workflow.");

    }

  }, [nodes, edges]);

  // Reset Workflow

  const resetWorkflow = useCallback(() => {

    setNodes([]);
    setEdges([]);

    setSelectedNodeId(null);

    counter.current = 1;

    localStorage.removeItem(STORAGE_KEY);

  }, [setNodes, setEdges]);

  // Register Functions With Dashboard

  useEffect(() => {
    registerAddNode?.(addNode);
  }, [addNode, registerAddNode]);

  useEffect(() => {
    registerSaveFunction?.(saveWorkflow);
  }, [saveWorkflow, registerSaveFunction]);

  useEffect(() => {
    registerResetFunction?.(resetWorkflow);
  }, [resetWorkflow, registerResetFunction]);

  useEffect(() => {
    registerValidateFunction?.(validateWorkflow);
  }, [validateWorkflow, registerValidateFunction]);

  // Update Node and Edge Counts

  useEffect(() => {

    onCountsChange?.(
      nodes.length,
      edges.length
    );

  }, [
    nodes.length,
    edges.length,
    onCountsChange,
  ]);

  // Send Workflow Data to Dashboard

  useEffect(() => {

    onWorkflowDataChange?.(
      nodes,
      edges
    );

  }, [
    nodes,
    edges,
    onWorkflowDataChange,
  ]);

  // Close Panel if Node is Deleted

  useEffect(() => {

    if (
      selectedNodeId &&
      !nodes.some(
        (node) => node.id === selectedNodeId
      )
    ) {
      setSelectedNodeId(null);
    }

  }, [nodes, selectedNodeId]);

  return (

    <div className="workflow-canvas">

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) =>
          setSelectedNodeId(node.id)
        }
        onPaneClick={() =>
          setSelectedNodeId(null)
        }
        fitView
        deleteKeyCode={[
          "Backspace",
          "Delete",
        ]}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        defaultEdgeOptions={{
          animated: true,
        }}
      >

        <Background
          color="#29364b"
          gap={20}
          size={1}
        />

        <Controls />

        <MiniMap
          nodeColor={(node) => {

            if (node.type === "sensor") {
              return "#3987f5";
            }

            if (node.type === "processing") {
              return "#9868ed";
            }

            if (node.type === "alert") {
              return "#e69a45";
            }

            return "#64748b";

          }}
        />

      </ReactFlow>

      {/* Node Configuration Panel */}

      {selectedNode && (

        <div
          className="node-config-panel"
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >

          <div className="config-header">

            <div>
              <Settings size={18} />
              <strong>Node Configuration</strong>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedNodeId(null)
              }
              title="Close settings"
            >
              <X size={18} />
            </button>

          </div>

          <div className="config-body">

            <span className="config-type">
              {selectedNode.type.toUpperCase()} NODE
            </span>

            <label>Node Name</label>

            <input
              value={selectedNode.data.label || ""}
              onChange={(event) =>
                updateSelectedNode(
                  "label",
                  event.target.value
                )
              }
              placeholder="Enter node name"
            />

            {selectedNode.type === "sensor" && (

              <>
                <label>Sensor Type</label>

                <select
                  value={
                    selectedNode.data.sensorType ||
                    "Temperature"
                  }
                  onChange={(event) =>
                    updateSelectedNode(
                      "sensorType",
                      event.target.value
                    )
                  }
                >

                  <option value="Temperature">
                    Temperature
                  </option>

                  <option value="Humidity">
                    Humidity
                  </option>

                  <option value="Motion">
                    Motion
                  </option>

                  <option value="Light">
                    Light
                  </option>

                  <option value="Gas">
                    Gas
                  </option>

                </select>

              </>

            )}

            {(selectedNode.type === "sensor" ||
              selectedNode.type === "alert") && (

              <>
                <label>Threshold Value</label>

                <input
                  type="number"
                  value={
                    selectedNode.data.threshold ?? 30
                  }
                  onChange={(event) =>
                    updateSelectedNode(
                      "threshold",
                      event.target.value
                    )
                  }
                  placeholder="Enter threshold"
                />

              </>

            )}

            <label>Description</label>

            <textarea
              value={
                selectedNode.data.description || ""
              }
              onChange={(event) =>
                updateSelectedNode(
                  "description",
                  event.target.value
                )
              }
              placeholder="Describe what this node does"
              rows={4}
            />

            <div className="config-note">

              <Save size={14} />

              Changes are applied to the node. Use Save Workflow to
              store them.

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

export default WorkflowCanvas;
