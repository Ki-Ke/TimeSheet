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
const DEFAULT_CHECKOUT_TIME_INTENT = 'input.defaultCheckoutTime';
const LIST_PROJECTS_INTENT = 'input.listProjects';

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
                        let userCheckInTime = moment(snapshot.val().checkInTime);
                        let currentTime = moment(new Date);
                        let duration = userCheckInTime.diff(currentTime, 'minutes');

                        if (duration < 480) {
                            const projectName = snapshot.val().projectName;
                            const checkInTime = snapshot.val().checkInTime;
                            const timeToTTS = timeToWords(checkInTime - new Date().getTime(), {round: true});

                            app.ask(`Welcome back to ${appName}! Your are currently clocked in for ${projectName}! with the work time of ${timeToTTS}`);
                        } else {
                            const projectName = snapshot.val().projectName;

                            if (snapshot.exists() && snapshot.val().checkInStatus) {
                                let userLogs = db.ref('logs/' + userId);

                                userLogs.orderByChild('checkOutTime').equalTo('').once('value').then((logSnapshot) => {
                                    const checkOutTime = new Date().getTime();
                                    logSnapshot.forEach((childSnapshot) => {
                                        userLogs.child(childSnapshot.key).update({checkOutTime: checkOutTime});
                                    });

                                    userCheckIn.update({checkInStatus: false});
                                });
                            }

                            app.ask(`Welcome back to ${appName}! Your previous project ${projectName}! was clocked out because of maximum 8hrs of work time. To change the default timeout say Change default timeout.`);
                        }
                    } else {
                        app.ask(`Welcome back to ${appName}! Start your day by saying '${appName} log me in for project name'`);
                    }
                });
            } else {

                let user = db.ref('users/' + userId);
                let promise = user.set({userId: userId, defaultCheckOutTime: 480});

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
        const description = app.getArgument('description');

        let userProjects = db.ref('projects/' + userId);

        userProjects.orderByChild('createdOn').once('value').then((snapshot) => {
            let projectNameExists = false;
            snapshot.forEach((childSnapshot) => {
                if (childSnapshot.val().projectName.toUpperCase() === projectName.toUpperCase()) {
                    projectNameExists = true;
                }
            });

            if (projectNameExists) {
                app.tell(`Project name already exists`);
            } else {
                userProjects.push({projectName: projectName, description: description, createdAt: new Date().getTime()});
                app.tell(`Great! The project ${projectName} has been created. You can start logging right away! just say, Time sheet check in for ${projectName}`);
            }
        });
    }

    function projectNameConfirmationNo() {
        app.tell(`That's okay. Let's not do it now.`);
    }

    /**
     * User Project Check in
     */
    function checkInProject() {
        const projectName = app.getArgument('projectName');
        const description = app.getArgument('description');

        let userProjects = db.ref('projects/' + userId);

        userProjects.orderByChild('createdOn').once('value').then((snapshot) => {

            // if user have not created any projects yet
            if (snapshot.numChildren <= 0){
                app.tell(`Sorry! You don't have any project created yet. Get started by saying "create a project"`);
                return;
            }

            let projectNameExists = false;
            snapshot.forEach((childSnapshot) => {
                if (childSnapshot.val().projectName.toUpperCase() === projectName.toUpperCase()) {
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
                    description: description,
                    checkOutTime: ""
                });

                app.tell(`Great! You have been successfully checked in for ${projectName}.`);
            } else {
                app.ask(`oops! it looks like there is no project with the name ${projectName}. Just say "create a project" to get started!`);
            }
        });
    }

    /**
     * User Project Checkout
     */
    function checkOutProject() {
        const checkOutTime = new Date().getTime();
        let userCheckIn = db.ref('checkIn/' + userId);

        userCheckIn.once('value').then((checkInSnapshot) => {
            if (checkInSnapshot.exists() && checkInSnapshot.val().checkInStatus) {
                let userLogs = db.ref('logs/' + userId);

                userLogs.orderByChild('checkOutTime').equalTo('').once('value').then((logSnapshot) => {
                    let projectName;
                    logSnapshot.forEach((childSnapshot) => {
                        userLogs.child(childSnapshot.key).update({checkOutTime: checkOutTime});
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

    /**
     * List the first 30 user logs
     */
    function allLogs() {
        const projectName = app.getArgument('projectName');
        let userLogs = db.ref('logs/' + userId);

        if (projectName) {

            userLogs.orderByChild('projectName').equalTo(projectName).limitToFirst(30).once('value').then((logSnapshot) => {
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
                            .addSimpleResponse(`Here you go! You have ${items.length} logs available for ${projectName}`)
                            .addSuggestions(
                                ['Create a project', 'List']),
                        app.buildList('All project list')
                            .addItems(items)
                    );
                } else {
                    app.tell(" Empty List ")
                }
            });

        } else {

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
    }

    /**
     * Handle user Selected a log
     */
    function logSelected() {
        let userLogs = db.ref('logs/' + userId);
        const logKey = app.getSelectedOption();

        if (logKey) {
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

    /**
     * Changing the user's default timeout
     * Ask user for the newDefaultTime
     */
    function changeDefaultTimeOut() {
        let user = db.ref('users/' + userId);

        const newDefaultTime = app.getArgument('newDefaultTime');

        if (newDefaultTime && (newDefaultTime * 60) > 0) {
            let minutes = parseInt(newDefaultTime) * 60;
            let promise = user.set({userId: userId, defaultCheckOutTime: minutes});
            console.log(minutes);

            app.tell(`Done. The default checkout time as been updated to ${newDefaultTime} hours`);
        } else {
            app.tell(`Please say set the default time out to 8 hours or set timeout to 10 hours`);
        }
    }

    /**
     * List the first 30 user projects
     */
    function listProjects() {
        let userProjects = db.ref('projects/' + userId);

        userProjects.orderByChild('createdAt').limitToFirst(30).once('value').then((projectSnapshot) => {
            let items = [];
            let index = 0;
            console.log(projectSnapshot.numChildren());
            projectSnapshot.forEach((childProjectSnapshot) => {
                index++;
                let title = index + '. ' + childProjectSnapshot.val().projectName;
                let description = childProjectSnapshot.val().description;

                items.push(app.buildOptionItem(childProjectSnapshot.key)
                    .setTitle(title)
                    .setDescription(`${description}`)
                    .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", appName)
                )
            });

            if (items.length > 0) {
                app.askWithList(app.buildRichResponse()
                        .addSimpleResponse(`Here you go! You have created ${items.length} projects`)
                        .addSuggestions(
                            ['Create a project', 'Log me in']),
                    app.buildList('Project lists')
                        .addItems(items)
                );
            } else {
                app.tell(" You don't have any projects yet. Start creating projects by saying 'Create a project!' ")
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

    // Check out a project
    actionMap.set(CHECKOUT_INTENT, checkOutProject);

    // Change default timeout
    actionMap.set(DEFAULT_CHECKOUT_TIME_INTENT, changeDefaultTimeOut);

    // List projects
    actionMap.set(LIST_PROJECTS_INTENT, listProjects);

    // Display all logs
    actionMap.set(ALL_LOGS_INTENT, allLogs);
    actionMap.set(LOG_SELECTED_INTENT, logSelected);

    app.handleRequest(actionMap);
});
