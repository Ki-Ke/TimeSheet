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
const firebase = require('firebase-admin');
const moment = require('moment');

firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: "https://timesheet-81c18.firebaseio.com"
});
const db = firebase.database();

// Api.ai intents
const WELCOME_INTENT = 'input.welcome';
const CREATE_PROJECT = 'input.createProject';
const PROJECT_NAME_CONFIRMATION_YES = 'input.projectNameConfirmationYes';
const PROJECT_NAME_CONFIRMATION_NO = 'input.projectNameConfirmationNo';
const CHECK_IN_INTENT = 'input.checkIn';

// Time Sheet constants
const appName = 'Time Sheet';

exports.timeSheet = functions.https.onRequest((request, response) => {
    const app = new App({ request, response });
    const userId = app.getUser().userId;

    function welcome() {
        app.ask(`Welcome to ${appName}!, Get started by creating a team or project. 
        What would you like to create team or project`, ['create a project', 'create a team', 'help']);
    }

    /**
     * Method Related to creating a project
     */

    /**
     * Create a personal project
     * Ask user for the project name
     * @param app
     */
    function createProject(app) {
        const projectName = app.getArgument('projectName');
        app.askForConfirmation(`Are you sure you want to create a project with the name ${projectName}?`);
    }

    function projectNameConfirmationYes(app) {
        const projectName = app.getArgument('projectName');

        let user = db.ref('users/' + userId);
        let promise = user.set({userId: userId, checkInStatus: false});

        let userProjects = db.ref('projects/' + userId);

        userProjects.once("value")
            .then(function(snapshot) {
                let projectNameExists = false;
                snapshot.forEach((childSnapshot) => {
                    if (childSnapshot.val() === projectName){
                        projectNameExists = true;
                    }
                });

                if (projectNameExists){
                    app.tell(`Project name already exists`);
                } else {
                    userProjects.push(projectName);
                    app.tell(`Great! The project has been created. You can start logging right away! just say, Time sheet check in for ${projectName}`);
                }
            });
    }

    function projectNameConfirmationNo(app) {
        app.tell(`That's okay. Let's not do it now.`);
    }

    function checkInProject(app) {
        const projectName = app.getArgument('projectName');

        let userProjects = db.ref('projects/' + userId);

        userProjects.once("value")
            .then(function(snapshot) {
                let projectNameExists = false;
                snapshot.forEach((childSnapshot) => {
                    if (childSnapshot.val() === projectName){
                        projectNameExists = true;
                    }
                });

                if (projectNameExists){
                    let user = db.ref('users/' + userId);
                    user.update({checkInStatus: true});
                    let date = moment().format('DD-MM-YYYY');
                    let userLogs = db.ref('logs/' + userId + '/' + date);
                    userLogs.set({projectName: projectName, checkInTime: new Date().getTime()});

                    app.tell(`Great! You have been successfully checked in for ${projectName}.`);
                } else {
                    app.ask(`oops it looks there is no project with the name ${projectName}. Would like to create the project`);
                }
            });
    }

    const actionMap = new Map();
    // Welcome intent
    actionMap.set(WELCOME_INTENT, welcome);

    // Creating a project
    actionMap.set(CREATE_PROJECT, createProject);
    actionMap.set(PROJECT_NAME_CONFIRMATION_YES, projectNameConfirmationYes);
    actionMap.set(PROJECT_NAME_CONFIRMATION_NO, projectNameConfirmationNo);

    // Check in a project
    actionMap.set(CHECK_IN_INTENT, checkInProject);

    app.handleRequest(actionMap);
});
