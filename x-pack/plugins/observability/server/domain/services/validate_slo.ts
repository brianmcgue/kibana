/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IllegalArgumentError } from '../../errors';
import { SLO } from '../models';
import { Duration, DurationUnit } from '../models/duration';
import { timeslicesBudgetingMethodSchema } from '../../types/schema';

/**
 * Asserts the SLO is valid from a business invariants point of view.
 * e.g. a 'target' objective requires a number between ]0, 1]
 * e.g. a 'timeslices' budgeting method requires an objective's timeslice_target to be defined.
 *
 * @param slo {SLO}
 */
export function validateSLO(slo: SLO) {
  if (!isValidTargetNumber(slo.objective.target)) {
    throw new IllegalArgumentError('Invalid objective.target');
  }

  if (!isValidTimeWindowDuration(slo.time_window.duration)) {
    throw new IllegalArgumentError('Invalid time_window.duration');
  }

  if (timeslicesBudgetingMethodSchema.is(slo.budgeting_method)) {
    if (
      slo.objective.timeslice_target === undefined ||
      !isValidTargetNumber(slo.objective.timeslice_target)
    ) {
      throw new IllegalArgumentError('Invalid objective.timeslice_target');
    }

    if (
      slo.objective.timeslice_window === undefined ||
      !isValidTimesliceWindowDuration(slo.objective.timeslice_window, slo.time_window.duration)
    ) {
      throw new IllegalArgumentError('Invalid objective.timeslice_window');
    }
  }

  validateSettings(slo);
}

function validateSettings(slo: SLO) {
  if (!isValidFrequencySettings(slo.settings.frequency)) {
    throw new IllegalArgumentError('Invalid settings.frequency');
  }

  if (!isValidSyncDelaySettings(slo.settings.sync_delay)) {
    throw new IllegalArgumentError('Invalid settings.sync_delay');
  }
}

function isValidTargetNumber(value: number): boolean {
  return value > 0 && value < 1;
}

function isValidTimeWindowDuration(duration: Duration): boolean {
  return [
    DurationUnit.Day,
    DurationUnit.Week,
    DurationUnit.Month,
    DurationUnit.Quarter,
    DurationUnit.Year,
  ].includes(duration.unit);
}

function isValidTimesliceWindowDuration(timesliceWindow: Duration, timeWindow: Duration): boolean {
  return (
    [DurationUnit.Minute, DurationUnit.Hour].includes(timesliceWindow.unit) &&
    timesliceWindow.isShorterThan(timeWindow)
  );
}

/**
 * validate that 1 minute <= frequency < 1 hour
 */
function isValidFrequencySettings(frequency: Duration): boolean {
  return (
    frequency.isLongerOrEqualThan(new Duration(1, DurationUnit.Minute)) &&
    frequency.isShorterThan(new Duration(1, DurationUnit.Hour))
  );
}

/**
 * validate that 1 minute <= sync_delay < 6 hour
 */
function isValidSyncDelaySettings(syncDelay: Duration): boolean {
  return (
    syncDelay.isLongerOrEqualThan(new Duration(1, DurationUnit.Minute)) &&
    syncDelay.isShorterThan(new Duration(6, DurationUnit.Hour))
  );
}
