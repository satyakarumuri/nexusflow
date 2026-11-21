# NexusFlow – Visual IoT Telemetry & Rule Engine

**A visual platform for monitoring IoT sensor data, building workflows, processing real-time telemetry, and generating automated alerts.**

## About the Project

NexusFlow is a web-based IoT monitoring and automation platform designed to make sensor data processing easier and more interactive.

Instead of writing complex code for every monitoring task, users can create workflows using a visual drag-and-drop interface. They can connect different nodes to collect sensor data, apply filters, check conditions, and generate alerts.

The platform is designed to process real-time IoT data, monitor sensor readings, and help users identify unusual activities through automated rules and notifications.

## Objectives

- Build a visual interface for creating and managing IoT workflows.
- Collect and monitor sensor data in real time.
- Store large amounts of telemetry data efficiently.
- Process continuous data streams using reactive programming.
- Apply conditions and calculations to sensor readings.
- Generate automated alerts when sensor values cross defined limits.
- Provide an easy-to-use dashboard for monitoring and analysis.

## Key Features

### 1. Visual Workflow Builder
- Drag-and-drop interface for creating workflows.
- Connect different nodes to define data-processing steps.
- Support for sensor, filter, condition, and alert nodes.
- Save, edit, and manage workflows.

### 2. Real-Time IoT Monitoring
- Receive sensor readings continuously.
- Monitor temperature, pressure, and speed.
- Display live sensor information.
- Simulate IoT devices for testing.

### 3. Data Processing and Rule Engine
- Process continuous data streams using RxJS.
- Apply moving average filters.
- Set conditions and thresholds.
- Execute workflows based on user-defined rules.

### 4. Database Management
- Store telemetry readings with timestamps.
- Use MongoDB Time-Series Collections for sensor data.
- Manage user information, workflows, and alerts.

### 5. Dashboard and Analytics
- Display real-time sensor readings.
- Visualize data using interactive charts.
- Monitor active workflows and sensor status.
- View alert history.

### 6. Automated Alerts
- Generate alerts when sensor values exceed specified limits.
- Display notifications in the application.
- Support webhook integration and mock SMS notifications.

### 7. User Management
- User registration and login.
- Secure authentication.
- Manage individual workflows.

## Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| Vite | Frontend development environment |
| React Flow (@xyflow/react) | Visual workflow builder |
| Tailwind CSS | User interface styling |
| Node.js | Backend runtime |
| Express.js | REST API development |
| MongoDB | Database |
| MongoDB Time-Series | Sensor data storage |
| Mongoose | Database operations |
| RxJS | Reactive data processing |
| Socket.IO | Real-time communication |
| Recharts | Data visualization |
| JWT | Authentication |

## System Architecture

The application follows a modular architecture in which the frontend, backend, database, and rule engine work together.

```text
       IoT Sensors / Simulator
                |
                v
       Backend Data Ingestion
                |
                v
          MongoDB Database
                |
                v
        RxJS Rule Engine
                |
                v
        Workflow Processing
                |
          +-----+------+
          |            |
          v            v
      Dashboard     Alert System
          |
          v
      React Frontend
```

## Example Workflow

One of the main examples in NexusFlow is a turbine monitoring system.

```text
+------------------+
|  Turbine Sensor  |
+------------------+
         |
         v
+------------------+
| Moving Average   |
|     Filter       |
+------------------+
         |
         v
+------------------+
| Condition Check  |
| Temperature > 80 |
+------------------+
         |
         v
+------------------+
|   Alert System   |
+------------------+
```

**Example:** When the turbine temperature crosses the configured threshold, the rule engine processes the reading and generates an alert.

## Project Structure

```text
NexusFlow/
|
|-- frontend/
|   |-- src/
|       |-- components/
|       |-- pages/
|       |-- nodes/
|       |-- hooks/
|       |-- services/
|       |-- context/
|       |-- App.jsx
|
|-- backend/
|   |-- src/
|       |-- config/
|       |-- models/
|       |-- routes/
|       |-- controllers/
|       |-- engine/
|       |-- services/
|       |-- sockets/
|       |-- server.js
|
|-- README.md
|-- .gitignore
```

## Installation and Setup

### Prerequisites

Make sure the following software is installed:

- Node.js and npm
- Git
- Visual Studio Code
- MongoDB Atlas account or a local MongoDB installation

### 1. Clone the Repository

```bash
git clone https://github.com/satyakarumuri/nexusflow.git
```

### 2. Open the Project

```bash
cd nexusflow
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Install Backend Dependencies

```bash
cd ../backend
npm install
```

### 5. Configure Environment Variables

Create a `.env` file inside the backend directory and configure the required database connection and authentication settings.

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Never upload actual passwords, database credentials, or secret keys to GitHub.

### 6. Run the Application

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The actual commands and configuration may be updated as development progresses.

## Team Structure

This project is being developed as a group project with five members.

| Member | Responsibility |
|---|---|
| Satyasri – Team Lead | Project planning, coordination and integration |
| Raktima | Frontend development and visual workflow builder |
| Somasekhar | Backend development and API integration |
| Sarthak | Database design and management |
| Harika | IoT sensor simulation and rule engine |

## Development Roadmap

- [x] Project idea selection and initial planning
- [x] Technology stack selection
- [ ] Development environment setup
- [ ] React frontend development
- [ ] Visual workflow builder
- [ ] Backend API development
- [ ] MongoDB integration
- [ ] IoT sensor data simulation
- [ ] Real-time telemetry monitoring
- [ ] RxJS rule engine implementation
- [ ] Automated alert system
- [ ] User authentication
- [ ] Frontend and backend integration
- [ ] Testing and deployment

## Expected Outcome

The final goal of NexusFlow is to provide a working platform where users can visually create IoT data-processing workflows, monitor live sensor readings, apply custom rules, and receive automated alerts.

The project aims to simplify IoT monitoring and demonstrate how visual programming, real-time data processing, and database technologies can work together in a single application.

## Future Enhancements

- Support for physical IoT devices.
- More advanced data-processing nodes.
- Custom webhook integrations.
- Advanced analytics and reporting.
- Role-based access control.
- Cloud deployment and scalability improvements.

## License

This project is developed for educational and academic purposes.

---

**NexusFlow – Connect. Process. Monitor. Automate.**
