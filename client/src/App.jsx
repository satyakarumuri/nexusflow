import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Activity, Bell, Blocks, Check, ChevronDown, CircleHelp, Cpu, Gauge,
  LayoutDashboard, Menu, Plus, Radio, RefreshCw, Search, Settings,
  ShieldAlert, Signal, Thermometer, Wifi, WifiOff, X, Zap
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { api, socketUrl } from './api.js';

const metricLabels = { temperature:'Temperature', humidity:'Humidity', air_quality:'Air quality' };
const fmtTime = (value) => value ? new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'â€”';

function App() {
  const [page,setPage] = useState('Overview');
  const [summary,setSummary] = useState({});
  const [devices,setDevices] = useState([]);
  const [telemetry,setTelemetry] = useState([]);
  const [rules,setRules] = useState([]);
  const [alerts,setAlerts] = useState([]);
  const [simulator,setSimulator] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [toast,setToast] = useState('');
  const [search,setSearch] = useState('');
  const [showDevice,setShowDevice] = useState(false);
  const [showRule,setShowRule] = useState(false);
  const [mobileNav,setMobileNav] = useState(false);

  const notify = (message) => { setToast(message); window.setTimeout(()=>setToast(''),2800); };

  const loadAll = useCallback(async () => {
    try {
      const [s,d,t,r,a] = await Promise.all([
        api.get('/api/dashboard/summary'), api.get('/api/devices'),
        api.get('/api/telemetry?limit=120'), api.get('/api/rules'), api.get('/api/alerts')
      ]);
      setSummary(s.data); setDevices(d.data); setTelemetry(t.data);
      setRules(r.data); setAlerts(a.data); setSimulator(s.data.simulator);
      setError('');
    } catch {
      setError('Cannot connect to the NexusFlow API. Start the backend server and refresh.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); const id=setInterval(loadAll,15000); return ()=>clearInterval(id); }, [loadAll]);

  useEffect(() => {
    const socket = io(socketUrl, { transports:['websocket','polling'] });
    socket.on('telemetry:new', reading => {
      setTelemetry(old => [...old,reading].slice(-160));
      setDevices(old => old.map(d => d.id===reading.deviceId ? {...d,status:'online',latest_metric:reading.metric,latest_value:reading.value,latest_unit:reading.unit,last_seen:reading.recordedAt} : d));
      setSummary(old => ({...old,readings:(old.readings||0)+1,onlineDevices:devices.length || old.onlineDevices}));
    });
    socket.on('alert:new', alert => { setAlerts(old=>[alert,...old]); setSummary(old=>({...old,alerts:(old.alerts||0)+1,activeAlerts:(old.activeAlerts||0)+1})); });
    socket.on('device:changed', () => loadAll());
    socket.on('device:deleted', () => loadAll());
    return ()=>socket.disconnect();
  }, [loadAll, devices.length]);

  const chartData = useMemo(() => {
    const rows = telemetry.filter(t=>t.metric==='temperature').slice(-30);
    return rows.map((r,i)=>({ time:fmtTime(r.recordedAt || r.recorded_at), value:Number(r.value), index:i }));
  }, [telemetry]);

  const startSim = async () => {
    try { const {data}=await api.post('/api/simulator/start'); setSimulator(data.running); notify('Telemetry simulator started'); }
    catch { notify('Could not start simulator'); }
  };
  const stopSim = async () => {
    try { await api.post('/api/simulator/stop'); setSimulator(false); notify('Telemetry simulator stopped'); }
    catch { notify('Could not stop simulator'); }
  };

  const acknowledge = async (id) => {
    try { await api.patch(`/api/alerts/${id}/acknowledge`); setAlerts(old=>old.map(a=>a.id===id?{...a,acknowledged:1}:a)); setSummary(old=>({...old,activeAlerts:Math.max(0,(old.activeAlerts||0)-1)})); }
    catch { notify('Unable to acknowledge alert'); }
  };
  const toggleRule = async (rule) => {
    try { await api.patch(`/api/rules/${rule.id}`,{enabled:!rule.enabled}); setRules(old=>old.map(r=>r.id===rule.id?{...r,enabled:!r.enabled}:r)); }
    catch { notify('Unable to update rule'); }
  };
  const deleteRule = async (id) => {
    if (!confirm('Delete this rule?')) return;
    try { await api.delete(`/api/rules/${id}`); setRules(old=>old.filter(r=>r.id!==id)); notify('Rule deleted'); }
    catch { notify('Unable to delete rule'); }
  };
  const deleteDevice = async (id) => {
    if (!confirm('Delete this device and its telemetry history?')) return;
    try { await api.delete(`/api/devices/${id}`); setDevices(old=>old.filter(d=>d.id!==id)); notify('Device deleted'); }
    catch { notify('Unable to delete device'); }
  };

  const nav = [
    {label:'Overview',icon:LayoutDashboard},
    {label:'Devices',icon:Cpu},
    {label:'Telemetry',icon:Activity},
    {label:'Rules',icon:Blocks},
    {label:'Alerts',icon:Bell}
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
      <div className="brand"><div className="brand-mark"><Zap size={20} fill="currentColor"/></div><div><strong>NexusFlow</strong><span>IoT OPERATIONS</span></div><button className="mobile-close icon-btn" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="workspace"><div className="workspace-avatar">NF</div><div><b>Workspace</b><small>Operations team</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(item=><button key={item.label} className={`nav-item ${page===item.label?'active':''}`} onClick={()=>{setPage(item.label);setMobileNav(false)}}><item.icon size={18}/><span>{item.label}</span>{item.label==='Alerts'&&summary.activeAlerts>0&&<em>{summary.activeAlerts}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><b>Need a hand?</b><p>Explore your telemetry and automation workspace.</p><button onClick={()=>notify('Documentation: see README.md in the project folder')}>View quick guide <span>â†—</span></button></div><button className="nav-item settings-link" onClick={()=>notify('Settings are planned for a future iteration')}><Settings size={18}/> Settings</button><div className="profile"><div className="profile-avatar">H</div><div><b>Workspace Admin</b><small>Local demo account</small></div><ChevronDown size={15}/></div></div>
    </aside>
    {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)}/>}
    <main className="main">
      <header className="topbar"><div className="top-left"><button className="mobile-menu icon-btn" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> <b>{page}</b></div></div><div className="top-actions"><div className="system-status"><span className="status-dot"/> All systems operational</div><button className="icon-btn notification-btn" onClick={()=>setPage('Alerts')}><Bell size={18}/>{summary.activeAlerts>0&&<i/>}</button><div className="top-avatar">H</div></div></header>
      <div className="content">
        {error&&<div className="error-banner"><WifiOff size={17}/>{error}<button onClick={loadAll}>Retry</button></div>}
        <div className="page-heading"><div><div className="eyebrow">MONITORING CENTER <span>â€¢</span> LIVE WORKSPACE</div><h1>{page==='Overview'?'Good morning, Harika':page}</h1><p>{page==='Overview'?'Hereâ€™s whatâ€™s happening across your connected environment.':page==='Devices'?'Manage and monitor your connected IoT endpoints.':page==='Telemetry'?'Explore sensor readings collected from your devices.':page==='Rules'?'Define conditions that automatically generate alerts.':'Review and acknowledge events from your rule engine.'}</p></div><div className="heading-actions"><button className="btn btn-light" onClick={loadAll}><RefreshCw size={16}/> Refresh</button>{page==='Devices'&&<button className="btn btn-primary" onClick={()=>setShowDevice(true)}><Plus size={17}/> Add device</button>}{page==='Rules'&&<button className="btn btn-primary" onClick={()=>setShowRule(true)}><Plus size={17}/> Create rule</button>}</div></div>

        {page==='Overview'&&<Overview summary={summary} devices={devices} alerts={alerts} chartData={chartData} simulator={simulator} startSim={startSim} stopSim={stopSim} setPage={setPage} loading={loading}/>}
        {page==='Devices'&&<Devices devices={devices} search={search} setSearch={setSearch} onDelete={deleteDevice} onAdd={()=>setShowDevice(true)}/>}
        {page==='Telemetry'&&<Telemetry telemetry={telemetry} devices={devices}/>}
        {page==='Rules'&&<Rules rules={rules} onToggle={toggleRule} onDelete={deleteRule}/>}
        {page==='Alerts'&&<Alerts alerts={alerts} onAcknowledge={acknowledge}/>}
        <footer>Â© 2026 NexusFlow <span>â€¢</span> Visual IoT Telemetry & Rule Engine <span className="footer-right">Built for connected operations</span></footer>
      </div>
    </main>
    {showDevice&&<DeviceModal onClose={()=>setShowDevice(false)} onCreated={()=>{setShowDevice(false);loadAll();notify('Device registered successfully')}}/>}
    {showRule&&<RuleModal onClose={()=>setShowRule(false)} onCreated={()=>{setShowRule(false);loadAll();notify('Rule created successfully')}}/>}
    {toast&&<div className="toast"><Check size={17}/>{toast}</div>}
  </div>;
}

function Overview({summary,devices,alerts,chartData,simulator,startSim,stopSim,setPage,loading}) {
  const metrics=[
    {label:'Total devices',value:summary.devices??'â€”',icon:Cpu,tone:'blue',note:`${summary.onlineDevices||0} currently online`},
    {label:'Telemetry readings',value:(summary.readings||0).toLocaleString(),icon:Activity,tone:'violet',note:'Stored sensor events'},
    {label:'Active alerts',value:summary.activeAlerts??0,icon:ShieldAlert,tone:'orange',note:'Require your attention'},
    {label:'Connected devices',value:`${summary.devices?Math.round((summary.onlineDevices||0)/summary.devices*100):0}%`,icon:Signal,tone:'green',note:'Device availability'}
  ];
  return <>
    <div className="welcome-strip"><div className="welcome-symbol"><Gauge size={21}/></div><div><b>Your environment at a glance</b><span>Live monitoring is {simulator?'running':'paused'}. {simulator?'New readings are arriving automatically.':'Start the simulator to generate sample sensor data.'}</span></div><button className={`btn ${simulator?'btn-stop':'btn-run'}`} onClick={simulator?stopSim:startSim}>{simulator?<><span className="pulse-dot"/> Stop simulator</>:<><Zap size={15}/> Start simulator</>}</button></div>
    <div className="section-title"><div><h2>Environment overview</h2><p>Key performance indicators across your workspace</p></div><span className="live-tag"><span/> LIVE</span></div>
    <div className="stats-grid">{metrics.map(m=><div className="stat-card" key={m.label}><div className={`stat-icon ${m.tone}`}><m.icon size={19}/></div><div className="stat-label">{m.label}</div><div className="stat-value">{loading?'â€”':m.value}</div><div className="stat-note">{m.note}</div></div>)}</div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-head"><div><h3>Temperature telemetry</h3><p>Latest sensor readings over time</p></div><div className="chart-legend"><span/> Temperature</div></div>
        {chartData.length?<ResponsiveContainer width="100%" height={250}><AreaChart data={chartData} margin={{top:12,right:8,left:-22,bottom:0}}><defs><linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d8bff" stopOpacity={.22}/><stop offset="100%" stopColor="#2d8bff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f5"/><XAxis dataKey="time" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#9aa4b4'}} minTickGap={24}/><YAxis tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#9aa4b4'}}/><Tooltip contentStyle={{border:'1px solid #e9edf3',borderRadius:12,boxShadow:'0 8px 24px #17243b12'}} formatter={v=>[`${v} Â°C`,'Temperature']}/><Area type="monotone" dataKey="value" stroke="#3189ed" strokeWidth={2.5} fill="url(#tempFill)" activeDot={{r:5,strokeWidth:0}}/></AreaChart></ResponsiveContainer>:<div className="empty-chart"><Activity size={28}/><b>Waiting for telemetry</b><span>Start the simulator to see live temperature trends.</span></div>}
        <div className="chart-foot"><span><i className="legend-dot"/> Temperature (Â°C)</span><button className="text-link" onClick={()=>setPage('Telemetry')}>View telemetry <span>â†’</span></button></div>
      </section>
      <section className="panel device-panel"><div className="panel-head"><div><h3>Device health</h3><p>Connection status by endpoint</p></div><button className="more-link" onClick={()=>setPage('Devices')}>View all</button></div>
        <div className="device-list">{devices.slice(0,4).map(d=><div className="device-row" key={d.id}><div className="device-symbol"><Cpu size={17}/></div><div className="device-info"><b>{d.name}</b><span>{d.location||d.type}</span></div><span className={`pill ${d.status==='online'?'pill-online':'pill-offline'}`}><i/>{d.status}</span></div>)}</div>
        {!devices.length&&<div className="empty-small">No devices registered yet.</div>}
        <button className="outline-full" onClick={()=>setPage('Devices')}>Manage devices <span>â†’</span></button>
      </section>
    </div>
    <section className="panel recent-panel"><div className="panel-head"><div><h3>Recent alerts</h3><p>Latest rule engine activity</p></div><button className="more-link" onClick={()=>setPage('Alerts')}>View all alerts</button></div>
      {alerts.length?<div className="table-wrap"><table><thead><tr><th>EVENT</th><th>DEVICE</th><th>SEVERITY</th><th>TIME</th><th>STATUS</th></tr></thead><tbody>{alerts.slice(0,4).map(a=><tr key={a.id}><td><b>{a.message}</b></td><td>{a.device_id}</td><td><Severity value={a.severity}/></td><td>{fmtTime(a.created_at)}</td><td><span className={`alert-status ${a.acknowledged?'ack':'unack'}`}>{a.acknowledged?'Acknowledged':'Unacknowledged'}</span></td></tr>)}</tbody></table></div>:<div className="empty-small">No alerts yet. Rules will generate alerts when readings cross their thresholds.</div>}
    </section>
  </>;
}

function Devices({devices,search,setSearch,onDelete,onAdd}) {
  const filtered = devices.filter(d =>
  [d.name, d.type, d.location, d.id]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(search.trim().toLowerCase())
);
  return <section className="panel page-panel"><div className="toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search devices..."/></div><span className="muted-count">{filtered.length} devices</span></div>
    <div className="table-wrap"><table><thead><tr><th>DEVICE</th><th>TYPE</th><th>LOCATION</th><th>LATEST READING</th><th>STATUS</th><th></th></tr></thead><tbody>{filtered.map(d=><tr key={d.id}><td><div className="table-device"><div className="device-symbol"><Cpu size={16}/></div><div><b>{d.name}</b><small>{d.id}</small></div></div></td><td>{d.type}</td><td>{d.location||'â€”'}</td><td>{d.latest_value!==null&&d.latest_value!==undefined?<b>{d.latest_value} {d.latest_unit}</b>:'No readings'}</td><td><span className={`pill ${d.status==='online'?'pill-online':'pill-offline'}`}><i/>{d.status}</span></td><td><button className="row-action" onClick={()=>onDelete(d.id)} title="Delete device"><X size={16}/></button></td></tr>)}</tbody></table></div>
    {!filtered.length&&<div className="empty-state"><Cpu size={28}/><b>No devices found</b><span>Try another search or register a device.</span><button className="btn btn-primary" onClick={onAdd}><Plus size={16}/> Add device</button></div>}
  </section>;
}

function Telemetry({telemetry,devices}) {
  const [metric,setMetric]=useState('all');
  const filtered=telemetry.filter(t=>metric==='all'||t.metric===metric).slice().reverse();
  return <section className="panel page-panel"><div className="toolbar"><div className="filter-tabs">{['all','temperature','humidity','air_quality'].map(m=><button className={metric===m?'selected':''} onClick={()=>setMetric(m)} key={m}>{m==='all'?'All metrics':metricLabels[m]}</button>)}</div><span className="muted-count">{filtered.length} readings</span></div><div className="table-wrap"><table><thead><tr><th>TIMESTAMP</th><th>DEVICE</th><th>METRIC</th><th>VALUE</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td>{new Date(t.recordedAt||t.recorded_at).toLocaleString()}</td><td>{devices.find(d=>d.id===t.deviceId||d.id===t.device_id)?.name||t.deviceId||t.device_id}</td><td><span className="metric-chip">{metricLabels[t.metric]||t.metric}</span></td><td><b>{t.value} {t.unit}</b></td></tr>)}</tbody></table></div>{!filtered.length&&<div className="empty-state"><Activity size={28}/><b>No telemetry readings</b><span>Start the simulator to populate the telemetry stream.</span></div>}</section>;
}

function Rules({rules,onToggle,onDelete}) {
  return <section className="panel page-panel"><div className="rule-intro"><div className="rule-intro-icon"><Blocks size={20}/></div><div><b>Automated condition engine</b><span>Rules are evaluated whenever a matching telemetry reading arrives. Matching conditions create alerts automatically.</span></div></div><div className="rules-list">{rules.map(r=><div className="rule-row" key={r.id}><div className="rule-symbol"><Zap size={18}/></div><div className="rule-main"><b>{r.name}</b><span>When <strong>{metricLabels[r.metric]||r.metric}</strong> <code>{r.operator} {r.threshold}</code></span></div><Severity value={r.severity}/><label className="switch"><input type="checkbox" checked={Boolean(r.enabled)} onChange={()=>onToggle(r)}/><span/></label><button className="row-action" onClick={()=>onDelete(r.id)}><X size={16}/></button></div>)}</div>{!rules.length&&<div className="empty-small">No rules configured.</div>}<div className="rule-note"><ShieldAlert size={17}/><span><b>How rules work</b> â€” The rule engine checks each incoming reading against enabled rules for the same metric. An alert is saved when the condition matches.</span></div></section>;
}

function Alerts({alerts,onAcknowledge}) {
  const [filter,setFilter]=useState('all');
  const filtered=alerts.filter(a=>filter==='all'||(filter==='open'?!a.acknowledged:!!a.acknowledged));
  return <section className="panel page-panel"><div className="toolbar"><div className="filter-tabs">{[['all','All alerts'],['open','Unacknowledged'],['done','Acknowledged']].map(([v,l])=><button className={filter===v?'selected':''} onClick={()=>setFilter(v)} key={v}>{l}</button>)}</div><span className="muted-count">{filtered.length} events</span></div><div className="alerts-list">{filtered.map(a=><div className="alert-row" key={a.id}><div className={`alert-symbol ${a.severity}`}><ShieldAlert size={18}/></div><div className="alert-main"><b>{a.message}</b><span>{a.device_name||a.device_id} Â· {new Date(a.created_at).toLocaleString()}</span></div><Severity value={a.severity}/>{a.acknowledged?<span className="alert-status ack">Acknowledged</span>:<button className="btn btn-small btn-light" onClick={()=>onAcknowledge(a.id)}><Check size={14}/> Acknowledge</button>}</div>)}</div>{!filtered.length&&<div className="empty-state"><Bell size={28}/><b>You're all caught up</b><span>No alerts in this view.</span></div>}</section>;
}

function Severity({value}) { return <span className={`severity severity-${value||'info'}`}><i/>{value||'info'}</span>; }

function DeviceModal({onClose,onCreated}) {
  const [form,setForm]=useState({name:'',type:'Temperature',location:''});
  const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setSaving(true);setError('');try{await api.post('/api/devices',form);onCreated()}catch(err){setError(err.response?.data?.error||'Could not register device')}finally{setSaving(false)}};
  return <Modal title="Register a device" subtitle="Add an IoT endpoint to your workspace." onClose={onClose}><form onSubmit={submit} className="modal-form"><label>Device name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Cold Storage Sensor"/></label><label>Device type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Temperature</option><option>Humidity</option><option>Air Quality</option><option>Pressure</option><option>Motion</option><option>Other</option></select></label><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Warehouse B"/></label>{error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving?'Saving...':'Register device'}</button></div></form></Modal>;
}

function RuleModal({onClose,onCreated}) {
  const [form,setForm]=useState({name:'',metric:'temperature',operator:'>',threshold:'40',severity:'warning'});
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setSaving(true);setError('');try{await api.post('/api/rules',{...form,threshold:Number(form.threshold)});onCreated()}catch(err){setError(err.response?.data?.error||'Could not create rule')}finally{setSaving(false)}};
  return <Modal title="Create an automation rule" subtitle="Choose a metric and condition that should trigger an alert." onClose={onClose}><form onSubmit={submit} className="modal-form"><label>Rule name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Critical temperature"/></label><div className="form-grid"><label>Metric<select value={form.metric} onChange={e=>setForm({...form,metric:e.target.value})}><option value="temperature">Temperature</option><option value="humidity">Humidity</option><option value="air_quality">Air quality</option></select></label><label>Operator<select value={form.operator} onChange={e=>setForm({...form,operator:e.target.value})}>{['>','>=','<','<=','==','!='].map(o=><option key={o}>{o}</option>)}</select></label></div><div className="form-grid"><label>Threshold<input type="number" step="any" required value={form.threshold} onChange={e=>setForm({...form,threshold:e.target.value})}/></label><label>Severity<select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label></div>{error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving?'Saving...':'Create rule'}</button></div></form></Modal>;
}

function Modal({title,subtitle,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modal-head"><div><h3>{title}</h3><p>{subtitle}</p></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</div></div>; }

export default App;

