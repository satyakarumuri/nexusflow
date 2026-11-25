
import { useEffect, useState } from "react";

import {
  Activity,
  Thermometer,
  Wifi,
  WifiOff,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

function LiveSensorMonitoring({
  onTemperatureUpdate,
  onMonitoringStatusChange,
}) {
  const [isMonitoring, setIsMonitoring] = useState(false);

  const [temperature, setTemperature] = useState(25);
  const [readings, setReadings] = useState([25]);

  const [minimum, setMinimum] = useState(25);
  const [maximum, setMaximum] = useState(25);

  // Generate temperature readings while monitoring
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      const newValue = Number(
        (20 + Math.random() * 20).toFixed(1)
      );

      const timestamp = new Date().toISOString();

      setTemperature(newValue);

      setReadings((previous) => [
        ...previous.slice(-19),
        newValue,
      ]);

      setMinimum((previous) =>
        Math.min(previous, newValue)
      );

      setMaximum((previous) =>
        Math.max(previous, newValue)
      );

      // Send sensor reading to Dashboard
      onTemperatureUpdate?.({
        value: newValue,
        timestamp,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring, onTemperatureUpdate]);

  // Start monitoring
  const startMonitoring = () => {
    setIsMonitoring(true);
    onMonitoringStatusChange?.(true);
  };

  // Stop monitoring
  const stopMonitoring = () => {
    setIsMonitoring(false);
    onMonitoringStatusChange?.(false);
  };

  // Temperature status
  const getTemperatureStatus = () => {
    if (temperature >= 35) return "High";
    if (temperature >= 30) return "Warning";

    return "Normal";
  };

  return (
    <section className="live-monitoring-panel">

      {/* Header */}
      <div className="monitoring-header">
        <div>
          <h3>
            <Activity size={18} />
            Live Sensor Monitoring
          </h3>

          <p>
            Real-time temperature sensor simulation.
          </p>
        </div>

        <div className="monitoring-controls">
          {isMonitoring ? (
            <button
              className="monitor-stop-button"
              onClick={stopMonitoring}
            >
              <Square size={14} />
              Stop
            </button>
          ) : (
            <button
              className="monitor-start-button"
              onClick={startMonitoring}
            >
              <Play size={14} />
              Start Monitoring
            </button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <div className="monitoring-connection">
        {isMonitoring ? (
          <>
            <Wifi size={15} />
            Sensor Connected · Monitoring Active
          </>
        ) : (
          <>
            <WifiOff size={15} />
            Monitoring Paused
          </>
        )}
      </div>

      {/* Temperature Statistics */}
      <div className="monitoring-stats">

        {/* Current Temperature */}
        <div className="monitoring-stat-card">
          <div className="monitoring-stat-label">
            <Thermometer size={16} />
            Current Temperature
          </div>

          <strong>{temperature}°C</strong>

          <span
            className={`temperature-status ${getTemperatureStatus().toLowerCase()}`}
          >
            {getTemperatureStatus()}
          </span>
        </div>

        {/* Minimum Temperature */}
        <div className="monitoring-stat-card">
          <div className="monitoring-stat-label">
            <TrendingDown size={16} />
            Minimum
          </div>

          <strong>{minimum}°C</strong>

          <span>Lowest recorded</span>
        </div>

        {/* Maximum Temperature */}
        <div className="monitoring-stat-card">
          <div className="monitoring-stat-label">
            <TrendingUp size={16} />
            Maximum
          </div>

          <strong>{maximum}°C</strong>

          <span>Highest recorded</span>
        </div>

      </div>

      {/* Temperature Chart */}
      <div className="temperature-chart">

        <div className="chart-heading">
          <strong>Temperature Trend</strong>
          <span>Last 20 readings</span>
        </div>

        <div className="chart-bars">
          {readings.map((value, index) => (
            <div
              className="chart-bar-container"
              key={index}
            >
              <div
                className="chart-bar"
                style={{
                  height: `${Math.max(
                    8,
                    (value / 40) * 100
                  )}%`,
                }}
                title={`${value}°C`}
              />
            </div>
          ))}
        </div>

        <div className="chart-footer">
          <span>Older readings</span>
          <span>Latest reading</span>
        </div>

      </div>

    </section>
  );
}

export default LiveSensorMonitoring;
