
import { useState } from "react";
import {
  Play,
  Activity,
  CheckCircle,
  AlertTriangle,
  Trash2,
  History,
} from "lucide-react";

const HISTORY_KEY = "nexusflow-execution-history";

function WorkflowExecution({ nodes, edges }) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [sensorValue, setSensorValue] = useState(null);
  const [alertTriggered, setAlertTriggered] = useState(false);

  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  });

  const saveHistory = (reading, status) => {
    const newRecord = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      reading,
      status,
    };

    setHistory((previousHistory) => {
      const updatedHistory = [newRecord, ...previousHistory].slice(0, 20);

      try {
        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify(updatedHistory)
        );
      } catch (error) {
        console.error("Could not save execution history:", error);
      }

      return updatedHistory;
    });
  };

  const runWorkflow = () => {
    const sensors = nodes.filter((node) => node.type === "sensor");
    const processingNodes = nodes.filter(
      (node) => node.type === "processing"
    );
    const alertNodes = nodes.filter((node) => node.type === "alert");

    if (!sensors.length || !processingNodes.length || !alertNodes.length) {
      setLogs(["Workflow is incomplete. Please validate it first."]);
      return;
    }

    const sensorToProcessing = edges.some(
      (edge) =>
        sensors.some((sensor) => sensor.id === edge.source) &&
        processingNodes.some((node) => node.id === edge.target)
    );

    const processingToAlert = edges.some(
      (edge) =>
        processingNodes.some((node) => node.id === edge.source) &&
        alertNodes.some((node) => node.id === edge.target)
    );

    if (!sensorToProcessing || !processingToAlert) {
      setLogs(["Required workflow connections are missing."]);
      return;
    }

    setRunning(true);
    setAlertTriggered(false);

    const value = Number((20 + Math.random() * 20).toFixed(2));
    const processedValue = Number(value.toFixed(2));

    setSensorValue(value);

    const sensorThreshold = Number(sensors[0].data.threshold ?? 30);
    const alertThreshold = Number(alertNodes[0].data.threshold ?? 30);

    const triggered =
      value > sensorThreshold || processedValue > alertThreshold;

    const newLogs = [
      "Workflow execution started.",
      `Sensor: ${sensors[0].data.label}`,
      `Sensor reading: ${value}°C`,
      `Processing: ${processingNodes[0].data.label}`,
      `Processed value: ${processedValue}°C`,
    ];

    if (triggered) {
      newLogs.push(`ALERT: ${alertNodes[0].data.label}`);
      newLogs.push("Threshold exceeded!");
    } else {
      newLogs.push("No alert triggered.");
    }

    newLogs.push("Workflow execution completed.");

    setLogs(newLogs);
    setAlertTriggered(triggered);

    saveHistory(value, triggered ? "Alert" : "Completed");

    setRunning(false);
  };

  const clearHistory = () => {
    setHistory([]);

    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error("Could not clear execution history:", error);
    }
  };

  return (
    <div className="execution-panel">
      <div className="execution-header">
        <div>
          <h3>
            <Activity size={18} />
            Workflow Execution
          </h3>
          <p>Simulate your IoT automation workflow.</p>
        </div>

        <button
          className="run-button"
          onClick={runWorkflow}
          disabled={running}
        >
          <Play size={15} />
          Run Workflow
        </button>
      </div>

      {sensorValue !== null && (
        <div className="execution-reading">
          <span>Latest Sensor Reading</span>
          <strong>{sensorValue}°C</strong>
        </div>
      )}

      {logs.length > 0 && (
        <div className="execution-logs">
          <strong>Execution Logs</strong>

          {logs.map((log, index) => (
            <div className="execution-log" key={index}>
              {log.includes("ALERT") || log.includes("exceeded") ? (
                <AlertTriangle size={15} />
              ) : (
                <CheckCircle size={15} />
              )}

              <span>{log}</span>
            </div>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <div
          className={`execution-status ${
            alertTriggered ? "alert-active" : "execution-complete"
          }`}
        >
          {alertTriggered
            ? "Alert triggered during simulation"
            : "Simulation completed"}
        </div>
      )}

      {/* EXECUTION HISTORY */}

      <div className="history-section">
        <div className="history-header">
          <div>
            <h3>
              <History size={18} />
              Execution History
            </h3>
            <p>Previous workflow execution records.</p>
          </div>

          {history.length > 0 && (
            <button className="clear-history-button" onClick={clearHistory}>
              <Trash2 size={14} />
              Clear History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="empty-history">
            No execution records yet. Run your workflow to see its history.
          </div>
        ) : (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Date & Time</th>
                  <th>Sensor Reading</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {history.map((record, index) => (
                  <tr key={record.id}>
                    <td>#{history.length - index}</td>
                    <td>{record.date}</td>
                    <td>{record.reading}°C</td>
                    <td>
                      <span
                        className={`history-status ${
                          record.status === "Alert"
                            ? "history-alert"
                            : "history-completed"
                        }`}
                      >
                        {record.status === "Alert" ? (
                          <AlertTriangle size={13} />
                        ) : (
                          <CheckCircle size={13} />
                        )}
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkflowExecution;
