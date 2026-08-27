import * as analysisChartOptions from './analysisChartOptions.js';
import * as analysisCashBreakdown from './analysisCashBreakdown.js';
import * as analysisView from './analysisView.js';

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
  return true;
}
