/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isEmpty } from 'lodash';
import {
  AlertInstanceMeta,
  AlertInstanceState,
  RawAlertInstance,
  rawAlertInstance,
  AlertInstanceContext,
  DefaultActionGroupId,
} from '../../common';

import { parseDuration } from '../lib';

interface ScheduledExecutionOptions<
  State extends AlertInstanceState,
  Context extends AlertInstanceContext,
  ActionGroupIds extends string = DefaultActionGroupId
> {
  actionGroup: ActionGroupIds;
  context: Context;
  state: State;
}

export type PublicAlert<
  State extends AlertInstanceState = AlertInstanceState,
  Context extends AlertInstanceContext = AlertInstanceContext,
  ActionGroupIds extends string = DefaultActionGroupId
> = Pick<
  Alert<State, Context, ActionGroupIds>,
  'getState' | 'replaceState' | 'scheduleActions' | 'setContext' | 'getContext' | 'hasContext'
>;

export class Alert<
  State extends AlertInstanceState = AlertInstanceState,
  Context extends AlertInstanceContext = AlertInstanceContext,
  ActionGroupIds extends string = never
> {
  private scheduledExecutionOptions?: ScheduledExecutionOptions<State, Context, ActionGroupIds>;
  private meta: AlertInstanceMeta;
  private state: State;
  private context: Context;
  private readonly id: string;

  constructor(id: string, { state, meta = {} }: RawAlertInstance = {}) {
    this.id = id;
    this.state = (state || {}) as State;
    this.context = {} as Context;
    this.meta = meta;

    if (!this.meta.flappingHistory) {
      this.meta.flappingHistory = [];
    }
  }

  getId() {
    return this.id;
  }

  hasScheduledActions() {
    return this.scheduledExecutionOptions !== undefined;
  }

  isThrottled(throttle: string | null) {
    if (this.scheduledExecutionOptions === undefined) {
      return false;
    }
    const throttleMills = throttle ? parseDuration(throttle) : 0;
    if (
      this.meta.lastScheduledActions &&
      this.scheduledActionGroupIsUnchanged(
        this.meta.lastScheduledActions,
        this.scheduledExecutionOptions
      ) &&
      this.meta.lastScheduledActions.date.getTime() + throttleMills > Date.now()
    ) {
      return true;
    }
    return false;
  }

  scheduledActionGroupHasChanged(): boolean {
    if (!this.meta.lastScheduledActions && this.scheduledExecutionOptions) {
      // it is considered a change when there are no previous scheduled actions
      // and new scheduled actions
      return true;
    }

    if (this.meta.lastScheduledActions && this.scheduledExecutionOptions) {
      // compare previous and new scheduled actions if both exist
      return !this.scheduledActionGroupIsUnchanged(
        this.meta.lastScheduledActions,
        this.scheduledExecutionOptions
      );
    }
    // no previous and no new scheduled actions
    return false;
  }

  private scheduledActionGroupIsUnchanged(
    lastScheduledActions: NonNullable<AlertInstanceMeta['lastScheduledActions']>,
    scheduledExecutionOptions: ScheduledExecutionOptions<State, Context, ActionGroupIds>
  ) {
    return lastScheduledActions.group === scheduledExecutionOptions.actionGroup;
  }

  getLastScheduledActions() {
    return this.meta.lastScheduledActions;
  }

  getScheduledActionOptions() {
    return this.scheduledExecutionOptions;
  }

  unscheduleActions() {
    this.scheduledExecutionOptions = undefined;
    return this;
  }

  getState() {
    return this.state;
  }

  getContext() {
    return this.context;
  }

  hasContext() {
    return !isEmpty(this.context);
  }

  scheduleActions(actionGroup: ActionGroupIds, context: Context = {} as Context) {
    this.ensureHasNoScheduledActions();
    this.setContext(context);
    this.scheduledExecutionOptions = {
      actionGroup,
      context,
      state: this.state,
    };
    return this;
  }

  setContext(context: Context) {
    this.context = context;
    return this;
  }

  private ensureHasNoScheduledActions() {
    if (this.hasScheduledActions()) {
      throw new Error('Alert instance execution has already been scheduled, cannot schedule twice');
    }
  }

  replaceState(state: State) {
    this.state = state;
    return this;
  }

  updateLastScheduledActions(group: ActionGroupIds) {
    this.meta.lastScheduledActions = { group, date: new Date() };
  }

  /**
   * Used to serialize alert instance state
   */
  toJSON() {
    return rawAlertInstance.encode(this.toRaw());
  }

  toRaw(recovered: boolean = false): RawAlertInstance {
    return recovered
      ? {
          // for a recovered alert, we only care to track the flappingHistory
          // and the flapping flag
          meta: {
            flappingHistory: this.meta.flappingHistory,
            flapping: this.meta.flapping,
          },
        }
      : {
          state: this.state,
          meta: this.meta,
        };
  }

  setFlappingHistory(fh: boolean[] = []) {
    this.meta.flappingHistory = fh;
  }

  getFlappingHistory() {
    return this.meta.flappingHistory;
  }

  setFlapping(f: boolean) {
    this.meta.flapping = f;
  }

  getFlapping() {
    return this.meta.flapping || false;
  }
}
