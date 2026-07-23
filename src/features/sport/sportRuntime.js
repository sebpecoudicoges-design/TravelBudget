import * as sportCatalog from './sportCatalog.js';
import * as sportFormView from './sportFormView.js';
import * as sportProgramView from './sportProgramView.js';
import * as sportTimerView from './sportTimerView.js';
import * as sportTimerController from './sportTimerController.js';
import * as sportHistoryView from './sportHistoryView.js';
import * as sportSessionSandboxView from './sportSessionSandboxView.js';
import * as sportSessionSandboxRules from './sportSessionSandboxRules.js';
import * as sportProfileRules from './sportProfileRules.js';
import * as sportProfileView from './sportProfileView.js';
import * as sportMobilityController from './sportMobilityController.js';

export function installSportRuntime(target = window) {
  target.UI = target.UI || {};
  target.Core = target.Core || {};
  target.Core.sportCatalog = {
    ...(target.Core.sportCatalog || {}),
    ...sportCatalog,
  };
  target.UI.sportFormView = {
    ...(target.UI.sportFormView || {}),
    ...sportFormView,
  };
  target.UI.sportProgramView = {
    ...(target.UI.sportProgramView || {}),
    ...sportProgramView,
  };
  target.UI.sportTimerView = {
    ...(target.UI.sportTimerView || {}),
    ...sportTimerView,
  };
  target.UI.sportTimerController = {
    ...(target.UI.sportTimerController || {}),
    ...sportTimerController,
  };
  target.UI.sportHistoryView = {
    ...(target.UI.sportHistoryView || {}),
    ...sportHistoryView,
  };
  target.UI.sportSessionSandboxView = {
    ...(target.UI.sportSessionSandboxView || {}),
    ...sportSessionSandboxView,
  };
  target.Core.sportSessionSandboxRules = {
    ...(target.Core.sportSessionSandboxRules || {}),
    ...sportSessionSandboxRules,
  };
  target.Core.sportProfileRules = {
    ...(target.Core.sportProfileRules || {}),
    ...sportProfileRules,
  };
  target.UI.sportProfileView = {
    ...(target.UI.sportProfileView || {}),
    ...sportProfileView,
  };
  target.UI.sportMobilityController = {
    ...(target.UI.sportMobilityController || {}),
    ...sportMobilityController,
  };
  return true;
}
