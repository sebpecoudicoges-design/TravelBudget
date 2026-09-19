import * as analysisChartOptions from './analysisChartOptions.js';
import * as analysisCashBreakdown from './analysisCashBreakdown.js';
import * as analysisView from './analysisView.js';
import * as analysisPeriodRules from './analysisPeriodRules.js';
import * as analysisPeriodComparison from './analysisPeriodComparison.js';

export function installAnalysisRuntime(target = window) {
  target.TBAnalysisView = {
    ...(target.TBAnalysisView || {}),
    ...analysisView,
  };
target.TBAnalysisCharts = {
    ...(target.TBAnalysisCharts || {}),
    ...analysisChartOptions,
};
target.TBAnalysisCashBreakdown = analysisCashBreakdown;
target.TBAnalysisPeriodRules = analysisPeriodRules;
target.TBAnalysisPeriodComparison = analysisPeriodComparison;
  return true;
}
