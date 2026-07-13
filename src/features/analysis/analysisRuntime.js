import * as analysisChartOptions from './analysisChartOptions.js';
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
  return true;
}
