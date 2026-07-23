import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Sport domain contract', () => {
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/45_sport_ui.js', 'utf8');
  const rules = fs.readFileSync('src/core/sportRules.js', 'utf8');
  const libraryRules = fs.readFileSync('src/core/sportLibraryRules.js', 'utf8');
  const repository = fs.readFileSync('src/data/sportRepository.js', 'utf8');
  const store = fs.readFileSync('src/features/sport/sportStore.js', 'utf8');
  const catalog = fs.readFileSync('src/features/sport/sportCatalog.js', 'utf8');
  const programRules = fs.readFileSync('src/features/sport/sportProgramRules.js', 'utf8');
  const programView = fs.readFileSync('src/features/sport/sportProgramView.js', 'utf8');
  const timerController = fs.readFileSync('src/features/sport/sportTimerController.js', 'utf8');
  const timerView = fs.readFileSync('src/features/sport/sportTimerView.js', 'utf8');
  const historyView = fs.readFileSync('src/features/sport/sportHistoryView.js', 'utf8');
  const formView = fs.readFileSync('src/features/sport/sportFormView.js', 'utf8');
  const sandboxRules = fs.readFileSync('src/features/sport/sportSessionSandboxRules.js', 'utf8');
  const sandboxView = fs.readFileSync('src/features/sport/sportSessionSandboxView.js', 'utf8');
  const mobilityController = fs.readFileSync('src/features/sport/sportMobilityController.js', 'utf8');
  const profileRules = fs.readFileSync('src/features/sport/sportProfileRules.js', 'utf8');
  const profileView = fs.readFileSync('src/features/sport/sportProfileView.js', 'utf8');
  const runtime = fs.readFileSync('src/features/sport/sportRuntime.js', 'utf8');

  it('exposes Sport rules, data and store through the bridge while lazy-loading Sport views', () => {
    for (const token of [
      'sportRules',
      'sportLibraryRules',
      'createSportRepository',
      'createSportStore',
      'sportCatalog',
      'sportProgramRules',
    ]) {
      expect(bridge).toContain(token);
    }
    expect(bridge).toContain('window.Core.sportRules = sportRules');
    expect(bridge).toContain('window.Data.sportRepository');
    expect(bridge).toContain('window.Data.createSportStore');
    expect(main).toContain("import('./features/sport/sportRuntime.js')");
    for (const token of [
      'sportFormView',
      'sportTimerController',
      'sportTimerView',
      'sportHistoryView',
      'sportSessionSandboxRules',
      'sportSessionSandboxView',
      'sportProfileRules',
      'sportProfileView',
      'sportMobilityController',
    ]) {
      expect(runtime).toContain(token);
    }
    expect(bridge).not.toContain("import * as sportFormView from '../features/sport/sportFormView.js'");
    expect(bridge).not.toContain("import * as sportTimerController from '../features/sport/sportTimerController.js'");
    expect(bridge).not.toContain("import * as sportTimerView from '../features/sport/sportTimerView.js'");
    expect(bridge).not.toContain("import * as sportHistoryView from '../features/sport/sportHistoryView.js'");
    expect(bridge).not.toContain("import * as sportSessionSandboxRules from '../features/sport/sportSessionSandboxRules.js'");
    expect(bridge).not.toContain("import * as sportSessionSandboxView from '../features/sport/sportSessionSandboxView.js'");
    expect(bridge).not.toContain("import * as sportProfileRules from '../features/sport/sportProfileRules.js'");
    expect(bridge).not.toContain("import * as sportProfileView from '../features/sport/sportProfileView.js'");
    expect(bridge).not.toContain("import * as sportMobilityController from '../features/sport/sportMobilityController.js'");
  });

  it('keeps catalog and library normalization out of the legacy file', () => {
    for (const token of ['CATALOG', 'EQUIPMENT', 'GOALS', 'LEVELS', 'SPORT_FAMILIES', 'PROGRAM_LOADS', 'EXERCISE_LIBRARY']) {
      expect(catalog).toContain(`export const ${token}`);
      expect(legacy).toContain(`sportCatalog.${token}`);
    }
    for (const token of ['normalizeSportExerciseRow', 'mergeSportExerciseLibraries']) {
      expect(libraryRules).toContain(`export function ${token}`);
    }
    expect(legacy).toContain('window.Core?.sportLibraryRules');
  });

  it('centralizes workout calculation and persistence row building in core rules', () => {
    for (const token of [
      'kcalFromMet',
      'estimateSportSessionKcal',
      'buildWorkoutSequence',
      'insertExerciseSet',
      'completedWorkout',
      'finalizeWorkout',
      'buildSportPersistenceRows',
      'appendCircuitRound',
    ]) {
      expect(rules).toContain(`export function ${token}`);
    }
    expect(legacy).toContain('sportRules?.buildWorkoutSequence');
    expect(legacy).toContain('sportRules?.finalizeWorkout');
    expect(legacy).toContain('sportRules?.buildSportPersistenceRows');
  });

  it('delegates repository, store and program planning responsibilities', () => {
    for (const token of ['loadHistory', 'createWorkout', 'deleteWorkout', 'updateSessionDate', 'findExistingWorkout']) {
      expect(repository).toContain(token);
      expect(legacy).toContain(`sportRepository().${token}`);
    }
    for (const token of ['createSportStore', 'hydrateRemote', 'hydrateOffline', 'appSnapshot', 'rememberLocalWorkout']) {
      expect(store).toContain(token);
    }
    expect(legacy).toContain('const sportStore = createSportStore');
    expect(legacy).toContain('sportStore.hydrateRemote');
    expect(legacy).toContain('sportStore.appSnapshot()');

    for (const token of ['currentProgramWeek', 'plannedSportWeekRows', 'nextPlannedSportRow', 'progressionIncrementKg']) {
    expect(programRules).toContain(`export function ${token}`);
      expect(
        legacy.includes(`sportProgramRules.${token}`)
        || legacy.includes(`sportProgramRules?.${token}`)
        || legacy.includes(token),
      ).toBe(true);
    }
    expect(programView).toContain('export function renderPlannedSportWeek');
    expect(programView).toContain('export function renderProgramSettings');
    expect(programView).toContain('export function renderLoadRecommendations');
    expect(legacy).toContain('sportProgramView?.renderPlannedSportWeek');
    expect(legacy).toContain('sportProgramView?.renderProgramSettings');
    expect(legacy).toContain('sportProgramView?.renderLoadRecommendations');
    expect(main).toContain("import('./features/sport/sportRuntime.js')");
    expect(runtime).toContain("import * as sportProgramView from './sportProgramView.js'");
    expect(runtime).toContain('target.UI.sportProgramView');
    expect(bridge).not.toContain("import * as sportProgramView from '../features/sport/sportProgramView.js'");
    expect(legacy).not.toContain('recommendations.map(row => `<div class="btn" style="display:grid;text-align:left;gap:7px;">');
  });

  it('delegates timer, history, sandbox and profile UI to feature modules', () => {
    for (const token of ['createTimerState', 'currentTimerStep', 'completeTimerStep', 'addSetForCurrentExercise', 'addCircuitRound']) {
      expect(timerController).toContain(`export function ${token}`);
      expect(legacy).toContain(`sportTimerController?.${token}`);
    }
    expect(timerView).toContain('export function renderSportTimer');
    expect(historyView).toContain('export function renderSportHistory');
    expect(historyView).toContain('export function isTodaySession');
    expect(legacy).toContain('sportTimerView?.renderSportTimer');
    expect(legacy).toContain('sportHistoryView?.renderSportHistory');

    for (const token of ['removeSandboxSet', 'addSandboxSetToExercise']) {
      expect(sandboxRules).toContain(`export function ${token}`);
    }
    expect(sandboxView).toContain('export function renderSandboxContent');
    expect(legacy).toContain('sportSessionSandboxRules');
    expect(legacy).toContain('sportSessionSandboxView?.renderSandboxContent');

    expect(profileRules).toContain('export function buildSportProfileRadarData');
    expect(profileView).toContain('export function renderSportProfileDashboard');
    expect(mobilityController).toContain('export async function saveMobilityAssessment');
    expect(legacy).toContain('sportProfileRules?.buildSportProfileRadarData');
    expect(legacy).toContain('sportProfileView?.renderSportProfileDashboard');
    expect(legacy).toContain('sportMobilityController?.saveMobilityAssessment');
  });

  it('delegates Sport builder form option rendering to sportFormView', () => {
    for (const token of ['renderOptionRows', 'renderDurationOptions', 'renderExerciseOptions', 'renderFormatOptions', 'renderEquipmentOptions']) {
      expect(formView).toContain(`export function ${token}`);
      expect(legacy).toContain(`sportFormView?.${token}`);
    }
  });
});
