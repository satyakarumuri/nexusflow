
import { useEffect, useRef, useState } from "react";

import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  ShieldCheck,
} from "lucide-react";

function AlertManagement({ sensorReading, onAlertStatsChange }) {
  const [alerts, setAlerts] = useState([]);

  const previousSeverity = useRef("Normal");
  const nextAlertId = useRef(1);

  // Generate alerts from incoming sensor readings
  useEffect(() => {
    if (!sensorReading) return;

    const temperature = sensorReading.value;

    let severity = "Normal";

    if (temperature >= 35) {
      severity = "High";
    } else if (temperature >= 30) {
      severity = "Medium";
    }

    // Generate an alert only when entering a new category
    if (severity !== previousSeverity.current) {
      if (severity !== "Normal") {
        const newAlert = {
          id: nextAlertId.current++,
          title:
            severity === "High"
              ? "High Temperature Detected"
              : "Sensor Threshold Warning",
          sensor: "Temperature Sensor 01",
          reading: `${temperature}°C`,
          threshold: "30°C",
          severity,
          time: new Date(sensorReading.timestamp).toLocaleString(),
          acknowledged: false,
        };

        setAlerts((previous) => [newAlert, ...previous]);
      }

      previousSeverity.current = severity;
    }
  }, [sensorReading]);

  // Calculate and send alert statistics to Dashboard
  const activeAlerts = alerts.filter(
    (alert) => !alert.acknowledged
  ).length;

  useEffect(() => {
    onAlertStatsChange?.({
      total: alerts.length,
      active: activeAlerts,
    });
  }, [alerts, activeAlerts, onAlertStatsChange]);

  const acknowledgeAlert = (id) => {
    setAlerts((previous) =>
      previous.map((alert) =>
        alert.id === id
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const clearAlert = (id) => {
    setAlerts((previous) =>
      previous.filter((alert) => alert.id !== id)
    );
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return (
    <section className="alert-management-panel">
      <div className="alert-management-header">
        <div>
          <h2>
            <Bell size={19} />
            Alert Management
          </h2>

          <p>
            Automatically generated alerts from sensor readings.
          </p>
        </div>

        <div className="alert-summary">
          <span>{activeAlerts} Active</span>
          <span>{alerts.length} Total</span>
        </div>
      </div>

      <div className="alert-list">
        {alerts.length === 0 ? (
          <div className="empty-alerts">
            <ShieldCheck size={30} />
            <strong>All clear!</strong>
            <p>
              No temperature alerts. Start monitoring to receive alerts.
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              className={`alert-item ${
                alert.acknowledged ? "alert-acknowledged" : ""
              }`}
              key={alert.id}
            >
              <div
                className={`alert-icon ${alert.severity.toLowerCase()}`}
              >
                <AlertTriangle size={19} />
              </div>

              <div className="alert-details">
                <div className="alert-title-row">
                  <strong>{alert.title}</strong>

                  <span
                    className={`severity-badge ${alert.severity.toLowerCase()}`}
                  >
                    {alert.severity}
                  </span>
                </div>

                <p>{alert.sensor}</p>

                <div className="alert-reading">
                  <span>Reading: {alert.reading}</span>
                  <span>Threshold: {alert.threshold}</span>
                </div>

                <div className="alert-time">
                  <Clock size={12} />
                  {alert.time}
                </div>

                {alert.acknowledged && (
                  <span className="acknowledged-label">
                    <CheckCircle size={13} />
                    Acknowledged
                  </span>
                )}
              </div>

              <div className="alert-actions">
                {!alert.acknowledged && (
                  <button
                    className="acknowledge-button"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    <CheckCircle size={14} />
                    Acknowledge
                  </button>
                )}

                <button
                  className="clear-alert-button"
                  onClick={() => clearAlert(alert.id)}
                  title="Clear alert"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {alerts.length > 0 && (
        <div className="alert-management-footer">
          <span>
            Showing {alerts.length} alert records
          </span>

          <button onClick={clearAllAlerts}>
            Clear All Alerts
          </button>
        </div>
      )}
    </section>
  );
}

export default AlertManagement;
