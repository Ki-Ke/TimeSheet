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

// Third part packages
const moment = require('moment');
const timeToWords = require('humanize-duration');

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
const CHECKOUT_INTENT = 'input.checkOut';
const ALL_LOGS_INTENT = 'input.allLogs';
const LOG_SELECTED_INTENT = 'input.logSelected';

// Time Sheet constants
const appName = 'Time Sheet';

exports.timeSheet = functions.https.onRequest((request, response) => {
    const app = new App({request, response});
    const userId = app.getUser().userId;

    function welcome() {
        let user = db.ref('users/' + userId);

        user.once('value').then((snapshot) => {
            if (snapshot.exists()) {
                let userId = snapshot.val().userId;

                let userCheckIn = db.ref('checkIn/' + userId);

                userCheckIn.once('value').then((snapshot) => {
                    if (snapshot.exists() && snapshot.val().checkInStatus) {
                        const projectName = snapshot.val().projectName;
                        const checkInTime = snapshot.val().checkInTime;
                        const timeToTTS = timeToWords(checkInTime - new Date().getTime(), {round: true});

                        app.ask(`Welcome back to ${appName}! Your are currently clocked in for ${projectName}! with the work time of ${timeToTTS}`);
                    } else {
                        app.ask(`Welcome back to ${appName}! Start your day by saying '${appName} log me in for project name'`);
                    }
                });
            } else {
                app.ask(`Welcome to ${appName}!, Get started by creating a project. 
                Just say create a project or start logging by saying '${appName} log me in for project name'`, ['create a project', 'log me in', 'help']);
            }
        });
    }

    /**
     * Method Related to creating a project
     */

    /**
     * Create a personal project
     * Ask user for the project name
     */
    function createProject() {
        const projectName = app.getArgument('projectName');
        app.askForConfirmation(`Are you sure you want to create a project with the name ${projectName}?`);
    }

    function projectNameConfirmationYes() {
        const projectName = app.getArgument('projectName');

        let user = db.ref('users/' + userId);
        let promise = user.set({userId: userId});

        let userProjects = db.ref('projects/' + userId);

        userProjects.once('value').then((snapshot) => {
            let projectNameExists = false;
            snapshot.forEach((childSnapshot) => {
                if (childSnapshot.val() === projectName) {
                    projectNameExists = true;
                }
            });

            if (projectNameExists) {
                app.tell(`Project name already exists`);
            } else {
                userProjects.push(projectName);
                app.tell(`Great! The project has been created. You can start logging right away! just say, Time sheet check in for ${projectName}`);
            }
        });
    }

    function projectNameConfirmationNo() {
        app.tell(`That's okay. Let's not do it now.`);
    }

    function checkInProject() {
        const projectName = app.getArgument('projectName');

        let userProjects = db.ref('projects/' + userId);

        userProjects.once("value").then((snapshot) => {
            let projectNameExists = false;
            snapshot.forEach((childSnapshot) => {
                if (childSnapshot.val() === projectName) {
                    projectNameExists = true;
                }
            });

            if (projectNameExists) {

                const checkInTime = new Date().getTime();

                let date = moment().format('DD-MM-YYYY');
                let userLogs = db.ref('logs/' + userId);
                let userCheckIn = db.ref('checkIn/' + userId);

                userCheckIn.set({projectName: projectName, checkInTime: checkInTime, checkInStatus: true});
                userLogs.push({
                    projectName: projectName,
                    checkInDate: date,
                    checkInTime: checkInTime,
                    checkOutTime: ""
                });

                app.tell(`Great! You have been successfully checked in for ${projectName}.`);
            } else {
                app.ask(`oops! it looks like there is no project with the name ${projectName}. Would you like to create the project?`);
            }
        });
    }

    function checkOutProject() {
        const checkOutTime = new Date().getTime();
        let userCheckIn = db.ref('checkIn/' + userId);

        userCheckIn.once('value').then((checkInSnapshot) => {
            if (checkInSnapshot.exists() && checkInSnapshot.val().checkInStatus) {
                let userLogs = db.ref('logs/' + userId);

                userLogs.orderByChild('checkOutTime').equalTo('').once('value').then((logSnapshot) => {
                    console.log(logSnapshot.numChildren());
                    let projectName;
                    logSnapshot.forEach((childSnapshot) => {
                        userLogs.child(childSnapshot.key).update({checkOutTime: checkOutTime});
                        console.log(childSnapshot.val());
                        projectName = childSnapshot.val().projectName;
                    });

                    userCheckIn.update({checkInStatus: false});

                    if (projectName) {
                        app.tell(`You have been checked out for ${projectName}. have a great day!`);
                    } else {
                        app.tell(`You have been successfully checked out. have a great day!`);
                    }
                });
            } else {
                app.tell(`Sorry! You are not clocked in for any project!`);
            }
        });
    }

    function allLogs() {
        let userLogs = db.ref('logs/' + userId);

        userLogs.orderByChild('checkInDate').limitToFirst(30).once('value').then((logSnapshot) => {
            let items = [];
            let index = 0;
            logSnapshot.forEach((childLogSnapshot) => {
                index++;
                let title = index + '. ' + childLogSnapshot.val().projectName;
                const checkInTime = childLogSnapshot.val().checkInTime;
                const checkOutTime = childLogSnapshot.val().checkOutTime;
                const timeToTTS = timeToWords(checkInTime - checkOutTime, {round: true});

                items.push(app.buildOptionItem(childLogSnapshot.key)
                    .setTitle(title)
                    .setDescription(`Your work time for the project is ${timeToTTS}`)
                    .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", appName)
                )
            });

            if (items.length > 0) {
                app.askWithList(app.buildRichResponse()
                        .addSimpleResponse(`Here you go! You have ${items.length} logs available`)
                        .addSuggestions(
                            ['Create a project', 'List']),
                    app.buildList('All project list')
                        .addItems(items)
                );
            } else {
                app.tell(" Empty List ")
            }
        });
    }

    function logSelected() {
        let userLogs = db.ref('logs/' + userId);
        const logKey = app.getSelectedOption();

        if (logKey){
            userLogs.child(logKey).once('value').then((logSnapshot) => {
                app.ask(app.buildRichResponse()
                    .addSimpleResponse('This is the first simple response for a basic card')
                    .addSuggestions(
                        ['Basic Card', 'List', 'Carousel', 'Suggestions'])
                    // Create a basic card and add it to the rich response
                    .addBasicCard(app.buildBasicCard(`This is a basic card.  Text in a
      basic card can include "quotes" and most other unicode characters 
      including emoji 📱.  Basic cards also support some markdown 
      formatting like *emphasis* or _italics_, **strong** or __bold__, 
      and ***bold itallic*** or ___strong emphasis___ as well as other things
      like line  \nbreaks`)
                        .setSubtitle(logSnapshot.val().projectName)
                        .setTitle(logSnapshot.val().projectName)
                        .addButton('This is a button', 'https://assistant.google.com/')
                        .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", 'Image alternate text'))
                );
            });
        }
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

    // Check out a project
    actionMap.set(CHECKOUT_INTENT, checkOutProject);

    // Display all logs
    actionMap.set(ALL_LOGS_INTENT, allLogs);
    actionMap.set(LOG_SELECTED_INTENT, logSelected);

    app.handleRequest(actionMap);
});
