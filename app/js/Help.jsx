/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

export function renderHelp() {
    return (
        <div>
            <div>
                <a href="/static_files/help/webgishelp.pdf" target="_blank">Anleitung (PDF)</a>
            </div>
            <div>QWC2 build {process.env.BuildDate}</div>
            <div>
                <a href={process.env.QWC2RepoSource}>Verwendete QWC2 Version</a>
            </div>
        </div>
    );
}