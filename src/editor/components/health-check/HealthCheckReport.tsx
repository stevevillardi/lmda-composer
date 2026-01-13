import type { HealthCheckData } from './types';
import { HealthCheckSummaryCards } from './HealthCheckSummaryCards';
import { CollectionSummaryChart, TopModulesChart, LongRunningChart } from './charts';
import { 
  HostStatsTable, 
  TlistSummaryTable, 
  AgentConfigTable, 
  MessageResultsTable,
  ProcessListTable,
  TaskListTables
} from './tables';
import {
  CollectorInfoCard,
  CapacityLimitsTable,
  AppliesToQueries,
  LogsViewer
} from './sections';

interface HealthCheckReportProps {
  data: HealthCheckData;
}

export function HealthCheckReport({ data }: HealthCheckReportProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="space-y-6 p-6">
        {/* Summary Cards */}
        <HealthCheckSummaryCards data={data} />

        {/* Charts Row */}
        <div className="
          grid grid-cols-1 gap-6
          lg:grid-cols-3
        ">
          <CollectionSummaryChart data={data.collectionSummary} />
          <TopModulesChart data={data.topModules} />
          <LongRunningChart data={data.longRunning} />
        </div>

        {/* Collector Info & Configuration */}
        <div className="
          grid grid-cols-1 gap-6
          lg:grid-cols-2
        ">
          <CollectorInfoCard data={data.collectorInfo} />
          <AppliesToQueries queries={data.appliesToQueries} />
        </div>

        {/* Tables */}
        <div className="
          grid grid-cols-1 gap-6
          lg:grid-cols-2
        ">
          <HostStatsTable data={data.hostStats} />
          <TlistSummaryTable 
            data={data.tlistSummary} 
            totalInstances={data.totalInstances}
            suggestedCollectors={data.suggestedCollectors}
          />
        </div>

        {/* Agent Config */}
        <AgentConfigTable 
          currentConfig={data.agentConfig}
          defaultConfig={data.defaultConfig}
          collectorSize={data.collectorInfo.size}
        />

        {/* Capacity Limits */}
        <CapacityLimitsTable data={data.capacityLimits} />

        {/* Message Results */}
        <MessageResultsTable data={data.topMessages} />

        {/* Task Lists */}
        <TaskListTables 
          aplist={data.aplist}
          splist={data.splist}
          adlist={data.adlist}
          tplist={data.tplist}
        />

        {/* Processes */}
        <ProcessListTable data={data.processes} />

        {/* Logs */}
        <LogsViewer logs={data.logs} />
      </div>
    </div>
  );
}
