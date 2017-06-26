/**
 Copyright 2017 KiKe. All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 **/
'use strict';

const App = require('actions-on-google').ApiAiApp;
const functions = require('firebase-functions');

// Api.ai intents
const WELCOME_INTENT = 'input.welcome';
const CREATE_PROJECT = 'input.createProject';

// Time Sheet constants
const appName = 'Time Sheet';

exports.timeSheet = functions.https.onRequest((request, response) => {
    const app = new App({ request, response });

    function welcome() {
        app.ask(`Welcome to ${appName}!, Get started by creating a team or project. 
        What would you like to create team or project`, ['create a project', 'create a team', 'help']);
    }

    /**
     * Create a personal project
     * Ask user for the project name
     * @param app
     */
    function createProject(app) {
        app.tell('Created project successful');
        console.log("Created project success");
    }

    const actionMap = new Map();
    actionMap.set(WELCOME_INTENT, welcome);
    actionMap.set(CREATE_PROJECT, createProject);
    app.handleRequest(actionMap);
});
