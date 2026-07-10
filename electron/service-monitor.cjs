// =============================================
// RosaeFinity — Background Service Monitor (Phase 2)
// Health checks, auto-recovery, non-blocking notifications
// =============================================

class ServiceMonitor {
  constructor(logger, memoryManager) {
    this.logger = logger;
    this.memoryManager = memoryManager;
    this.services = new Map();
    this.mainWindow = null;
    this.HEARTBEAT_MS = 10000; // 10 seconds
    this.MAX_FAILURES = 3;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  // Register a service for monitoring
  register(name, config) {
    this.services.set(name, {
      name,
      healthCheck: config.healthCheck,
      restart: config.restart,
      isCritical: config.isCritical || false,
      lastAlive: Date.now(),
      consecutiveFailures: 0,
      status: "unknown", // unknown | running | failed | recovering
      lastError: null,
      restartCount: 0,
      startedAt: Date.now(),
    });
    this.logger.debug(`Registered service: ${name}`);
  }

  // Start monitoring all registered services
  start() {
    this.memoryManager.safeSetInterval("service-monitor", () => this.checkAll(), this.HEARTBEAT_MS);
    this.logger.info("Service monitor started", { serviceCount: this.services.size });
  }

  // Check all services
  async checkAll() {
    for (const [name, service] of this.services) {
      try {
        const alive = await service.healthCheck();

        if (alive) {
          if (service.status === "failed" || service.status === "recovering") {
            this.logger.info(`Service recovered: ${name}`);
            this._notifyRenderer("service:recovery", { name, status: "recovered" });
          }
          service.lastAlive = Date.now();
          service.consecutiveFailures = 0;
          service.status = "running";
          service.lastError = null;
        } else {
          await this._handleFailure(service);
        }
      } catch (err) {
        service.lastError = err.message;
        await this._handleFailure(service);
      }
    }
  }

  async _handleFailure(service) {
    service.consecutiveFailures++;
    this.logger.warning(`Service health check failed: ${service.name}`, {
      failures: service.consecutiveFailures,
      lastError: service.lastError,
    });

    if (service.consecutiveFailures >= this.MAX_FAILURES) {
      await this._attemptRecovery(service);
    }
  }

  async _attemptRecovery(service) {
    service.status = "recovering";
    this.logger.info(`Attempting recovery for: ${service.name}`);
    this._notifyRenderer("service:recovery", { name: service.name, status: "attempting" });

    try {
      await service.restart();
      service.consecutiveFailures = 0;
      service.restartCount++;
      service.status = "running";
      service.lastAlive = Date.now();
      this.logger.info(`Service recovered: ${service.name}`, { restartCount: service.restartCount });
      this._notifyRenderer("service:recovery", { name: service.name, status: "recovered" });
    } catch (err) {
      service.status = "failed";
      service.lastError = err.message;
      this.logger.error(`Recovery failed: ${service.name}`, { error: err.message });
      this._notifyRenderer("service:recovery", { name: service.name, status: "failed", error: err.message });
    }
  }

  _notifyRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // Get status of all services
  getStatus() {
    const result = {};
    for (const [name, service] of this.services) {
      result[name] = {
        status: service.status,
        failures: service.consecutiveFailures,
        restartCount: service.restartCount,
        lastError: service.lastError,
        uptime: Date.now() - service.startedAt,
      };
    }
    return result;
  }

  // Manual restart from UI
  async manualRestart(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Unknown service: ${name}`);
    this.logger.info(`Manual restart requested for: ${name}`);
    await this._attemptRecovery(service);
  }
}

module.exports = { ServiceMonitor };
