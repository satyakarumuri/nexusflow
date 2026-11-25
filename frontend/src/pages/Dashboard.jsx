
import { useState, useCallback, useRef } from "react";

import {
  Radio,
  Workflow,
  Bell,
  Gauge,
  Plus,
  Blocks,
  Zap,
  Save,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import StatCard from "../components/StatCard";
import WorkflowCanvas from "../components/WorkflowCanvas";
import WorkflowExecution from "../components/WorkflowExecution";
import LiveSensorMonitoring from "../components/LiveSensorMonitoring";
import AlertManagement from "../components/AlertManagement";

function Dashboard() {
  const addNodeFunction = useRef(null);
  const saveWorkflowFunction = useRef(null);
  const resetWorkflowFunction = useRef(null);
  const validateWorkflowFunction = useRef(null);

  const [nodeCount, setNodeCount] = useState(3);
  const [edgeCount, setEdgeCount] = useState(2);

  const [workflowName, setWorkflowName] = useState(
    "Temperature Monitoring"
  );

  const [saveMessage, setSaveMessage] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState("Draft");

  const [validationResult, setValidationResult] = useState(null);

  const [workflowData, setWorkflowData] = useState({
    nodes: [],
    edges: [],
  });

  const [latestSensorReading, setLatestSensorReading] = useState(null);

  const [monitoringActive, setMonitoringActive] = useState(false);

  const [alertStats, setAlertStats] = useState({
    total: 0,
    active: 0,
  });

  // Register functions from WorkflowCanvas
  const registerAddNode = useCallback((fn) => {
    addNodeFunction.current = fn;
  }, []);

  const registerSaveFunction = useCallback((fn) => {
    saveWorkflowFunction.current = fn;
  }, []);

  const registerResetFunction = useCallback((fn) => {
    resetWorkflowFunction.current = fn;
  }, []);

  const registerValidateFunction = useCallback((fn) => {
    validateWorkflowFunction.current = fn;
  }, []);

  const handleAddNode = (type) => {
    if (addNodeFunction.current) {
      addNodeFunction.current(type);
      setValidationResult(null);
      setWorkflowStatus("Draft");
    } else {
      alert("Workflow canvas is still loading. Please try again.");
    }
  };

  const updateCounts = useCallback((nodes, edges) => {
    setNodeCount(nodes);
    setEdgeCount(edges);
  }, []);

  const updateWorkflowData = useCallback((nodes, edges) => {
    setWorkflowData({ nodes, edges });
  }, []);

  const handleSaveWorkflow = () => {
    if (saveWorkflowFunction.current) {
      saveWorkflowFunction.current();
      setWorkflowStatus("Saved");
      setSaveMessage("Workflow saved successfully!");

      setTimeout(() => {
        setSaveMessage("");
      }, 3000);
    } else {
      alert("Workflow canvas is not ready yet.");
    }
  };

  const handleValidateWorkflow = () => {
    if (validateWorkflowFunction.current) {
      const result = validateWorkflowFunction.current();

      setValidationResult(result);

      if (result.valid) {
        setWorkflowStatus("Validated");
      } else {
        setWorkflowStatus("Needs Fixes");
      }
    } else {
      alert("Workflow validation is not ready yet.");
    }
  };

  const handleNewWorkflow = () => {
    const confirmNew = window.confirm(
      "Create a new workflow? Your current workflow may be replaced."
    );

    if (confirmNew && resetWorkflowFunction.current) {
      const newName = window.prompt(
        "Enter your new workflow name:",
        "Untitled Workflow"
      );

      if (newName && newName.trim()) {
        resetWorkflowFunction.current();
        setWorkflowName(newName.trim());
        setWorkflowStatus("Draft");
        setSaveMessage("");
        setValidationResult(null);
      }
    } else if (confirmNew) {
      alert("Workflow canvas is not ready yet.");
    }
  };

  // Receive sensor readings and monitoring status
  const handleTemperatureUpdate = useCallback((reading) => {
    setLatestSensorReading(reading);
    setMonitoringActive(true);
  }, []);

  const handleMonitoringStatusChange = useCallback((status) => {
    setMonitoringActive(status);
  }, []);

  const handleAlertStatsChange = useCallback((stats) => {
    setAlertStats(stats);
  }, []);

  return (
    <div className="app-container">
      <Sidebar onAddNode={handleAddNode} />

      <main className="main-content">
        <Topbar />

        <section className="dashboard-content">

          {/* Page Heading */}
          <div className="page-heading">
            <div>
              <span className="eyebrow">OVERVIEW</span>
              <h1>Welcome to NexusFlow</h1>
              <p>
                Monitor your IoT workflows and sensor operations.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={handleNewWorkflow}
            >
              <Plus size={17} />
              New Workflow
            </button>
          </div>

          {/* Dynamic Dashboard Statistics */}
          <div className="stats-grid">
            <StatCard
              icon={<Radio />}
              title="Connected Sensors"
              value={monitoringActive ? "01" : "00"}
              description={
                monitoringActive
                  ? "Sensor monitoring active"
                  : "No active sensor connection"
              }
              color="blue"
            />

            <StatCard
              icon={<Workflow />}
              title="Active Workflows"
              value={
                workflowStatus === "Validated" ||
                workflowStatus === "Saved"
                  ? "01"
                  : "00"
              }
              description={`Current workflow: ${workflowStatus}`}
              color="purple"
            />

            <StatCard
              icon={<Bell />}
              title="Total Alerts"
              value={String(alertStats.total).padStart(2, "0")}
              description={`${alertStats.active} active alerts`}
              color="orange"
            />

            <StatCard
              icon={<Gauge />}
              title="System Status"
              value={monitoringActive ? "Online" : "Offline"}
              description={
                monitoringActive
                  ? "Monitoring is running"
                  : "Monitoring is paused"
              }
              color={monitoringActive ? "green" : "orange"}
            />
          </div>

          {/* Workflow Builder */}
          <section className="workflow-section">
            <div className="workflow-header">
              <div>
                <h2>
                  <Blocks size={19} />
                  Visual Workflow Builder
                </h2>

                <p>
                  Create and connect your IoT automation nodes.
                </p>
              </div>

              <div className="workflow-actions">
                <span className="draft-label">
                  ● {workflowStatus}
                </span>

                <button
                  className="validate-button"
                  onClick={handleValidateWorkflow}
                >
                  <ShieldCheck size={16} />
                  Validate Workflow
                </button>

                <button
                  className="save-button"
                  onClick={handleSaveWorkflow}
                >
                  <Save size={15} />
                  Save Workflow
                </button>
              </div>
            </div>

            <div className="canvas-toolbar">
              <div>
                <strong>{workflowName}</strong>
                <span> / Main workflow</span>
              </div>

              <span className="canvas-hint">
                Drag nodes and connect their handles
              </span>
            </div>

            <WorkflowCanvas
              registerAddNode={registerAddNode}
              registerSaveFunction={registerSaveFunction}
              registerResetFunction={registerResetFunction}
              registerValidateFunction={registerValidateFunction}
              onCountsChange={updateCounts}
              onWorkflowDataChange={updateWorkflowData}
            />

            <div className="canvas-footer">
              <span>{nodeCount} Nodes</span>
              <span>{edgeCount} Connections</span>

              <span>
                <Zap size={14} />
                Visual editor ready
              </span>
            </div>

            {saveMessage && (
              <div className="save-message">
                <CheckCircle size={16} />
                {saveMessage}
              </div>
            )}

            {validationResult && (
              <div
                className={`validation-result ${
                  validationResult.valid
                    ? "validation-success"
                    : "validation-error"
                }`}
              >
                {validationResult.valid ? (
                  <>
                    <div className="validation-title">
                      <CheckCircle size={18} />
                      Workflow validation successful!
                    </div>

                    <p>
                      All required workflow stages and connections
                      are correctly configured.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="validation-title">
                      <AlertCircle size={18} />
                      Workflow validation failed
                    </div>

                    <p>Please fix the following issues:</p>

                    <ul>
                      {validationResult.errors.map(
                        (error, index) => (
                          <li key={index}>{error}</li>
                        )
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Workflow Execution */}
          <WorkflowExecution
            nodes={workflowData.nodes}
            edges={workflowData.edges}
          />

          {/* Live Sensor Monitoring */}
          <LiveSensorMonitoring
            onTemperatureUpdate={handleTemperatureUpdate}
            onMonitoringStatusChange={handleMonitoringStatusChange}
          />

          {/* Alert Management */}
          <AlertManagement
            sensorReading={latestSensorReading}
            onAlertStatsChange={handleAlertStatsChange}
          />

        </section>
      </main>
    </div>
  );
}

export default Dashboard;
