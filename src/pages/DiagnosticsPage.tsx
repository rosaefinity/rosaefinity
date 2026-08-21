// =============================================
// RosaeFinity — Diagnostics Page (Phase 2)
// System health dashboard, log export, service status
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api, isElectron } from '../services/electron-service';
import { Button } from '../components/ui/button';
import {
  Activity, Cpu, HardDrive, Clock, RefreshCw, Download,
  Server, Wifi, WifiOff, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Terminal, MemoryStick, Zap,
} from 'lucide-react';

interface DiagnosticsData {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
  uptime: number;
  memory: Record<string, any>;
  services: Record<string, any>;
  ipcListeners: string[];
  sseStatus: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-500/20 text-green-400 border-green-500/30',
    connected: 'bg-green-500/20 text-green-400 border-green-500/30',
    idle: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${colors[status] || colors.unknown}`}>
      {status === 'running' || status === 'connected' ? <CheckCircle2 className="w-3 h-3" /> :
       status === 'failed' ? <XCircle className="w-3 h-3" /> :
       status === 'idle' ? <AlertTriangle className="w-3 h-3" /> :
       <Server className="w-3 h-3" />}
      {status}
    </span>
  );
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        {icon}
        <span className="font-medium text-white flex-1">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 space-y-2">{children}</div>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-mono text-right">{value}</span>
    </div>
  );
}

export function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [engineStats, setEngineStats] = useState<any>(null);

  const fetchDiagnostics = useCallback(async () => {
    const a = api();
    if (!a) {
      setError('Not running in Electron');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await a.diagnosticsGet();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    // TikTok engine now runs in main process - stats come via IPC
    // No renderer-side engine to poll
  }, [fetchDiagnostics]);

  const handleExportLogs = async () => {
    const a = api();
    if (!a) return;
    try {
      const logContent = await a.logsExport();
      setLogs(logContent);
      setShowLogs(true);
    } catch (err: any) {
      setError(err.message || 'Failed to export logs');
    }
  };

  const handleDownloadLogs = () => {
    if (!logs) return;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rosaefinity-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestartService = async (serviceName: string) => {
    const a = api();
    if (!a) return;
    try {
      setRestarting(serviceName);
      await a.serviceRestart(serviceName);
      // Refresh after restart
      setTimeout(fetchDiagnostics, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to restart service');
    } finally {
      setRestarting(null);
    }
  };

  if (!isElectron()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
        <Terminal className="w-12 h-12" />
        <p>Diagnostics are only available in the Electron desktop app.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-400" />
            Diagnostics
          </h1>
          <p className="text-sm text-gray-400 mt-1">System health, service status, and log export</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDiagnostics}
            disabled={loading}
            className="border-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLogs}
            className="border-white/10"
          >
            <Download className="w-4 h-4 mr-1" />
            Export Logs
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading diagnostics...
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* System Info */}
          <Section title="System Information" icon={<Cpu className="w-4 h-4 text-blue-400" />}>
            <KV label="App Version" value={data.appVersion} />
            <KV label="Electron" value={data.electronVersion} />
            <KV label="Node.js" value={data.nodeVersion} />
            <KV label="Platform" value={data.platform} />
            <KV label="Uptime" value={formatUptime(data.uptime)} />
          </Section>

          {/* Memory */}
          <Section title="Memory Usage" icon={<MemoryStick className="w-4 h-4 text-green-400" />}>
            {data.memory && typeof data.memory === 'object' && Object.keys(data.memory).length > 0 ? (
              Object.entries(data.memory).map(([key, val]) => (
                <KV
                  key={key}
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  value={typeof val === 'number' ? formatBytes(val) : String(val)}
                />
              ))
            ) : (
              <KV label="Status" value="Memory manager not active" />
            )}
          </Section>

          {/* Services */}
          <Section title="Background Services" icon={<Server className="w-4 h-4 text-purple-400" />}>
            {data.services && typeof data.services === 'object' && Object.keys(data.services).length > 0 ? (
              Object.entries(data.services).map(([name, info]: [string, any]) => (
                <div key={name} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-200 font-medium">{name}</span>
                    <StatusBadge status={info?.status || 'unknown'} />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-gray-400 hover:text-white"
                    onClick={() => handleRestartService(name)}
                    disabled={restarting === name}
                  >
                    {restarting === name ? 'Restarting...' : 'Restart'}
                  </Button>
                </div>
              ))
            ) : (
              <KV label="Status" value="No services registered" />
            )}
          </Section>

          {/* SSE */}
          <Section title="SSE Server" icon={<Wifi className="w-4 h-4 text-cyan-400" />}>
            <div className="flex items-center justify-between">
              <KV label="Status" value={data.sseStatus} />
              {data.sseStatus === 'connected' ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-500" />
              )}
            </div>
            <KV label="Port" value="18890" />
            <KV label="Endpoint" value={`http://127.0.0.1:18890/events`} />
          </Section>

          {/* IPC Listeners */}
          <Section title="Registered IPC Channels" icon={<Terminal className="w-4 h-4 text-yellow-400" />} defaultOpen={false}>
            <div className="max-h-60 overflow-y-auto scrollbar-thin">
              {data.ipcListeners && data.ipcListeners.length > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {data.ipcListeners.map((ch) => (
                    <span key={ch} className="text-xs font-mono text-gray-400 bg-white/5 rounded px-2 py-1">
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <KV label="Count" value="0" />
              )}
            </div>
          </Section>

          {/* TikTok Engine Stats */}
          {engineStats && (
            <Section title="TikTok Engine" icon={<Zap className="w-4 h-4 text-yellow-400" />}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KV label="Connection" value={engineStats.connection.state} />
                <KV label="Latency" value={`${engineStats.connection.latency}ms`} />
                <KV label="Events/sec" value={String(engineStats.connection.eventsPerSecond)} />
                <KV label="Reconnects" value={String(engineStats.connection.reconnectCount)} />
                <KV label="Dropped Events" value={String(engineStats.pipeline.dropped)} />
                <KV label="Deduped Events" value={String(engineStats.pipeline.deduped)} />
                <KV label="Processed Events" value={String(engineStats.pipeline.processed)} />
                <KV label="Pipeline Queue" value={String(engineStats.pipeline.queueSize)} />
                <KV label="Active Combos" value={String(engineStats.combos.activeCount)} />
                <KV label="Total Combo Coins" value={String(engineStats.combos.totalCoins)} />
                <KV label="Action Executed" value={String(engineStats.actions.executed)} />
                <KV label="Action Failed" value={String(engineStats.actions.failed)} />
                <KV label="Action Queue" value={String(engineStats.actions.queueSize)} />
                <KV label="Comment Spam" value={String(engineStats.comments.spamUsers)} />
                <KV label="Viewer Current" value={String(engineStats.viewers.current)} />
                <KV label="Viewer Peak" value={String(engineStats.viewers.peak)} />
              </div>
            </Section>
          )}

          {/* Log Viewer */}
          {showLogs && logs && (
            <Section title="Log Output" icon={<Download className="w-4 h-4 text-orange-400" />}>
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={handleDownloadLogs} className="border-white/10 text-xs">
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
              <pre className="bg-black/40 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-auto max-h-80 scrollbar-thin whitespace-pre-wrap">
                {logs.slice(-5000)}
              </pre>
            </Section>
          )}
        </div>
      )}
    </motion.div>
  );
}
export default DiagnosticsPage;
