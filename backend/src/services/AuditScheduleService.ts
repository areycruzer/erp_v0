import { AuditRetentionService } from './AuditRetentionService';
import * as cron from 'node-cron';

export interface ScheduleConfig {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  retentionDays: number;
  enableArchiving: boolean;
  batchSize: number;
  nextRun?: Date | undefined;
  lastRun?: Date | undefined;
  lastResult?: {
    success: boolean;
    deletedCount: number;
    archivedCount: number;
    error?: string | undefined;
    executedAt: Date;
  };
}

export interface ScheduleResult {
  scheduleId: string;
  success: boolean;
  deletedCount: number;
  archivedCount: number;
  error?: string;
  executedAt: Date;
  duration: number;
}

export class AuditScheduleService {
  private static instance: AuditScheduleService;
  private schedules: Map<string, { config: ScheduleConfig; task: cron.ScheduledTask }> = new Map();
  private running = false;

  private constructor() {}

  static getInstance(): AuditScheduleService {
    if (!AuditScheduleService.instance) {
      AuditScheduleService.instance = new AuditScheduleService();
    }
    return AuditScheduleService.instance;
  }

  /**
   * Start the schedule service and load default schedules
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('🔄 Audit Schedule Service already running');
      return;
    }

    console.log('🚀 Starting Audit Schedule Service...');
    this.running = true;

    // Load default schedules
    await this.loadDefaultSchedules();

    console.log(`✅ Audit Schedule Service started with ${this.schedules.size} schedules`);
  }

  /**
   * Stop the schedule service and destroy all scheduled tasks
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log('🛑 Stopping Audit Schedule Service...');
    
    // Stop all scheduled tasks
    for (const [id, { task }] of this.schedules) {
      task.stop();
      task.destroy();
      console.log(`  🗑️ Stopped schedule: ${id}`);
    }

    this.schedules.clear();
    this.running = false;
    console.log('✅ Audit Schedule Service stopped');
  }

  /**
   * Load default cleanup schedules
   */
  private async loadDefaultSchedules(): Promise<void> {
    const defaultSchedules: Omit<ScheduleConfig, 'nextRun' | 'lastRun' | 'lastResult'>[] = [
      {
        id: 'daily-cleanup',
        name: 'Daily Audit Log Cleanup',
        cronExpression: '0 2 * * *', // Every day at 2 AM
        enabled: true,
        retentionDays: 90, // Keep logs for 90 days
        enableArchiving: true,
        batchSize: 1000
      },
      {
        id: 'weekly-deep-cleanup',
        name: 'Weekly Deep Cleanup',
        cronExpression: '0 1 * * 0', // Every Sunday at 1 AM
        enabled: true,
        retentionDays: 30, // Archive older than 30 days
        enableArchiving: true,
        batchSize: 5000
      },
      {
        id: 'monthly-archive',
        name: 'Monthly Archive Cleanup',
        cronExpression: '0 0 1 * *', // First day of every month at midnight
        enabled: false, // Disabled by default - admin can enable
        retentionDays: 365, // Keep archives for 1 year
        enableArchiving: false, // Delete archives older than 1 year
        batchSize: 10000
      }
    ];

    for (const scheduleConfig of defaultSchedules) {
      await this.createSchedule(scheduleConfig);
    }
  }

  /**
   * Create a new scheduled cleanup job
   */
  async createSchedule(config: Omit<ScheduleConfig, 'nextRun' | 'lastRun' | 'lastResult'>): Promise<ScheduleConfig> {
    // Validate cron expression
    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    // Check if schedule already exists
    if (this.schedules.has(config.id)) {
      throw new Error(`Schedule with ID '${config.id}' already exists`);
    }

    const fullConfig: ScheduleConfig = {
      ...config,
      nextRun: this.getNextRunTime(config.cronExpression)
    };

    // Create the scheduled task
    const task = cron.schedule(config.cronExpression, async () => {
      await this.executeCleanup(fullConfig);
    });

    if (config.enabled) {
      task.start();
    } else {
      task.stop();
    }

    // Store the schedule
    this.schedules.set(config.id, {
      config: fullConfig,
      task
    });

    console.log(`📅 Created schedule: ${config.name} (${config.id})`);
    console.log(`   Expression: ${config.cronExpression}`);
    console.log(`   Next run: ${fullConfig.nextRun?.toISOString()}`);
    console.log(`   Enabled: ${config.enabled}`);

    return fullConfig;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(id: string, updates: Partial<ScheduleConfig>): Promise<ScheduleConfig> {
    const existing = this.schedules.get(id);
    if (!existing) {
      throw new Error(`Schedule with ID '${id}' not found`);
    }

    // Stop existing task
    existing.task.stop();
    existing.task.destroy();

    // Create updated config
    const updatedConfig: ScheduleConfig = {
      ...existing.config,
      ...updates,
      id, // Ensure ID doesn't change
      nextRun: updates.cronExpression 
        ? this.getNextRunTime(updates.cronExpression)
        : existing.config.nextRun
    };

    // Validate cron expression if changed
    if (updates.cronExpression && !cron.validate(updates.cronExpression)) {
      throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
    }

    // Create new task
    const newTask = cron.schedule(updatedConfig.cronExpression, async () => {
      await this.executeCleanup(updatedConfig);
    });

    if (updatedConfig.enabled) {
      newTask.start();
    } else {
      newTask.stop();
    }

    // Update stored schedule
    this.schedules.set(id, {
      config: updatedConfig,
      task: newTask
    });

    console.log(`🔄 Updated schedule: ${updatedConfig.name} (${id})`);
    return updatedConfig;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    const existing = this.schedules.get(id);
    if (!existing) {
      throw new Error(`Schedule with ID '${id}' not found`);
    }

    // Stop and destroy task
    existing.task.stop();
    existing.task.destroy();

    // Remove from map
    this.schedules.delete(id);

    console.log(`🗑️ Deleted schedule: ${existing.config.name} (${id})`);
  }

  /**
   * Enable or disable a schedule
   */
  async toggleSchedule(id: string, enabled: boolean): Promise<ScheduleConfig> {
    const existing = this.schedules.get(id);
    if (!existing) {
      throw new Error(`Schedule with ID '${id}' not found`);
    }

    if (enabled) {
      existing.task.start();
    } else {
      existing.task.stop();
    }

    existing.config.enabled = enabled;
    existing.config.nextRun = enabled ? this.getNextRunTime(existing.config.cronExpression) : undefined;

    console.log(`${enabled ? '▶️' : '⏸️'} ${enabled ? 'Enabled' : 'Disabled'} schedule: ${existing.config.name} (${id})`);
    return existing.config;
  }

  /**
   * Manually execute a cleanup job
   */
  async executeCleanup(config: ScheduleConfig): Promise<ScheduleResult> {
    const startTime = Date.now();
    console.log(`🧹 Executing cleanup: ${config.name} (${config.id})`);

    try {
      const result = await AuditRetentionService.cleanupOldLogs({
        retentionDays: config.retentionDays,
        enableArchiving: config.enableArchiving,
        batchSize: config.batchSize
      });

      const duration = Date.now() - startTime;
      const scheduleResult: ScheduleResult = {
        scheduleId: config.id,
        success: true,
        deletedCount: result.deletedCount,
        archivedCount: result.archivedCount,
        executedAt: new Date(),
        duration
      };

      // Update schedule config
      config.lastRun = scheduleResult.executedAt;
      config.lastResult = {
        success: true,
        deletedCount: result.deletedCount,
        archivedCount: result.archivedCount,
        executedAt: scheduleResult.executedAt
      };
      config.nextRun = this.getNextRunTime(config.cronExpression);

      console.log(`✅ Cleanup completed: ${config.name}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Deleted: ${result.deletedCount} logs`);
      console.log(`   Archived: ${result.archivedCount} logs`);
      console.log(`   Next run: ${config.nextRun?.toISOString()}`);

      return scheduleResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const scheduleResult: ScheduleResult = {
        scheduleId: config.id,
        success: false,
        deletedCount: 0,
        archivedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date(),
        duration
      };

      // Update schedule config
      config.lastRun = scheduleResult.executedAt;
      config.lastResult = {
        success: false,
        deletedCount: 0,
        archivedCount: 0,
        error: scheduleResult.error,
        executedAt: scheduleResult.executedAt
      };
      config.nextRun = this.getNextRunTime(config.cronExpression);

      console.error(`❌ Cleanup failed: ${config.name}`);
      console.error(`   Error: ${scheduleResult.error}`);
      console.error(`   Duration: ${duration}ms`);

      return scheduleResult;
    }
  }

  /**
   * Run a cleanup job immediately (manual execution)
   */
  async runNow(id: string): Promise<ScheduleResult> {
    const existing = this.schedules.get(id);
    if (!existing) {
      throw new Error(`Schedule with ID '${id}' not found`);
    }

    console.log(`⚡ Manual execution requested: ${existing.config.name} (${id})`);
    return await this.executeCleanup(existing.config);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): ScheduleConfig[] {
    return Array.from(this.schedules.values()).map(s => s.config);
  }

  /**
   * Get a specific schedule
   */
  getSchedule(id: string): ScheduleConfig | null {
    const existing = this.schedules.get(id);
    return existing ? existing.config : null;
  }

  /**
   * Get schedule statistics
   */
  getStatistics(): {
    totalSchedules: number;
    enabledSchedules: number;
    disabledSchedules: number;
    recentExecutions: Array<{
      scheduleId: string;
      scheduleName: string;
      lastRun?: Date | undefined;
      success?: boolean | undefined;
      deletedCount?: number | undefined;
      archivedCount?: number | undefined;
    }>;
  } {
    const schedules = this.getAllSchedules();
    const enabled = schedules.filter(s => s.enabled);
    const disabled = schedules.filter(s => !s.enabled);

    const recentExecutions = schedules
      .filter(s => s.lastRun)
      .sort((a, b) => (b.lastRun?.getTime() || 0) - (a.lastRun?.getTime() || 0))
      .slice(0, 10)
      .map(s => ({
        scheduleId: s.id,
        scheduleName: s.name,
        lastRun: s.lastRun,
        success: s.lastResult?.success,
        deletedCount: s.lastResult?.deletedCount,
        archivedCount: s.lastResult?.archivedCount
      }));

    return {
      totalSchedules: schedules.length,
      enabledSchedules: enabled.length,
      disabledSchedules: disabled.length,
      recentExecutions
    };
  }

  /**
   * Calculate next run time for a cron expression
   */
  private getNextRunTime(_cronExpression: string): Date | undefined {
    try {
      // Simple approximation - in production, use a proper cron parser
      const now = new Date();
      const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours from now
      return nextRun;
    } catch (error) {
      console.error('Error calculating next run time:', error);
      return undefined;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    schedulesCount: number;
    enabledCount: number;
    uptime: number;
  } {
    return {
      running: this.running,
      schedulesCount: this.schedules.size,
      enabledCount: this.getAllSchedules().filter(s => s.enabled).length,
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
export const auditScheduleService = AuditScheduleService.getInstance();
