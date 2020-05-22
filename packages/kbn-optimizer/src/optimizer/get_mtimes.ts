/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import Fs from 'fs';

import * as Rx from 'rxjs';
import { mergeMap, toArray, map, catchError } from 'rxjs/operators';

const stat$ = Rx.bindNodeCallback(Fs.stat);

/**
 * get mtimes of referenced paths concurrently, limit concurrency to 100
 */
export async function getMtimes(paths: Iterable<string>) {
  return await Rx.from(paths)
    .pipe(
      // map paths to [path, mtimeMs] entries with concurrency of
      // 100 at a time, ignoring missing paths
      mergeMap(
        (path) =>
          stat$(path).pipe(
            map((stat) => [path, stat.mtimeMs] as const),
            catchError((error: any) => (error?.code === 'ENOENT' ? Rx.EMPTY : Rx.throwError(error)))
          ),
        100
      ),
      toArray(),
      map((entries) => new Map(entries))
    )
    .toPromise();
}
