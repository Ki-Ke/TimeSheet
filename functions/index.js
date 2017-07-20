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

const helpers = require('./helpers');

firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: "https://timesheet-81c18.firebaseio.com"
});
const db = firebase.database();

// Api.ai intents
const WELCOME_INTENT = 'input.welcome';
const USER_PERMISSION = 'input.userPermission';
const CREATE_PROJECT = 'input.createProject';
const CREATE_PROJECT_YES = 'input.createProjectYes';
const CHECK_IN_INTENT = 'input.checkIn';
const CHECKOUT_INTENT = 'input.checkOut';
const ALL_LOGS_INTENT = 'input.allLogs';
const LOG_SELECTED_INTENT = 'input.logSelected';
const DEFAULT_CHECKOUT_TIME_INTENT = 'input.defaultCheckoutTime';
const LIST_PROJECTS_INTENT = 'input.listProjects';
const SWITCH_PROJECT_INTENT = 'input.switchProject';

// Time Sheet constants
const appName = 'Time Sheet';

exports.timeSheet = functions.https.onRequest((request, response) => {
    const app = new App({request, response});
    const userId = app.getUser().userId;

    function welcome() {
        let user = db.ref('users/' + userId);

        user.once('value').then((snapshot) => {
            if (snapshot.exists()) {

                let userProjects = db.ref('projects/' + userId);
                userProjects.once('value').then((projectSnapshot) => {
                    // Method to check if user has created any projects
                    if (projectSnapshot.numChildren() > 0) {
                        let userId = snapshot.val().userId;
                        let defaultCheckOutTime = snapshot.val().defaultCheckOutTime;

                        let userCheckIn = db.ref('checkIn/' + userId);

                        userCheckIn.once('value').then((userCheckInSnapshot) => {

                            if (userCheckInSnapshot.exists() && userCheckInSnapshot.val().checkInStatus) {
                                let userCheckInTime = moment(userCheckInSnapshot.val().checkInTime);
                                let currentTime = moment(new Date().getTime());
                                let duration = currentTime.diff(userCheckInTime, 'minutes');
                                console.log(duration);

                                if (duration < defaultCheckOutTime) {
                                    const projectName = userCheckInSnapshot.val().projectName;
                                    const checkInTime = userCheckInSnapshot.val().checkInTime;
                                    const timeToTTS = helpers.timeToTTS(checkInTime, new Date().getTime());

                                    app.ask(`Welcome back to ${appName}! You have logged in to ${projectName} for ${timeToTTS}`);
                                } else {
                                    const projectName = userCheckInSnapshot.val().projectName;

                                    if (userCheckInSnapshot.exists() && userCheckInSnapshot.val().checkInStatus) {
                                        let userLogs = db.ref('logs/' + userId);

                                        userLogs.orderByChild('checkOutTime').equalTo('').once('value').then((logSnapshot) => {
                                            const checkOutTime = new Date().getTime();
                                            logSnapshot.forEach((childSnapshot) => {
                                                userLogs.child(childSnapshot.key).update({checkOutTime: checkOutTime});
                                            });

                                            userCheckIn.update({checkInStatus: false});
                                        });
                                    }
                                    // Method to convert min to hrs
                                    const hrs = helpers.convertMinToHrs(defaultCheckOutTime);
                                    app.ask(`Welcome back to ${appName}! You were checked out automatically, as you crossed the default session time of ${hrs} hours. To change the default session time, say "Change default time".`);
                                }
                            } else {
                                app.ask(`Welcome back to ${appName}. Get started by saying "log me in"`);
                            }
                        });
                    } else {
                        app.ask(`Welcome back to ${appName}. Haven't seen you create a project. Say, "Create a project", to add a new project`);
                    }
                });
            } else {
                let permission = app.SupportedPermissions.NAME;
                app.askForPermission(`Welcome to ${appName}! First up`, permission);
            }
        });

    }

    function userPermission() {
        let user = db.ref('users/' + userId);
        if (app.isPermissionGranted()) {
            let displayName = app.getUserName().displayName;
            console.log(displayName);
            let promise = user.set({userId: userId, userName: displayName, defaultCheckOutTime: 480});

            app.ask(`Next, ${displayName}, say "Create a Project", to create a new Project.`);
        } else {
            let promise = user.set({userId: userId, defaultCheckOutTime: 480});

            app.tell(`No worries, say "Create a Project", to create a new Project.`);
        }
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
        app.ask(`Creating Project - ${projectName} now, please confirm`);
    }

    function createProjectYes() {
        const projectName = app.getArgument('projectName');
        const description = app.getArgument('description');

        if (projectName) {
            let userProjects = db.ref('projects/' + userId);

            userProjects.orderByChild('createdOn').once('value').then((snapshot) => {
                let projectNameExists = false;
                snapshot.forEach((childSnapshot) => {
                    if (childSnapshot.val().projectName.toUpperCase() === projectName.toUpperCase()) {
                        projectNameExists = true;
                    }
                });

                if (projectNameExists) {
                    app.ask(`Project - ${projectName} already exists. Say, "Log me in to ${projectName}", to log in to ${projectName}, or, say "create a project"`);
                } else {
                    userProjects.push({
                        projectName: projectName,
                        description: description,
                        createdAt: new Date().getTime()
                    });
                    app.ask(`Great! Project - ${projectName} is now created. You can start logging in right away! just say, Time sheet check in to ${projectName}`);
                }
            });
        } else {
            app.tell('Sorry! something went wrong');
        }
    }

    /**
     * User Project Check in
     */
    function checkInProject() {
        const projectName = app.getArgument('projectName');
        const description = app.getArgument('description');

        let userCheckIn = db.ref('checkIn/' + userId);

        userCheckIn.once('value').then((snapshot) => {
            if (snapshot.exists() && snapshot.val().checkInStatus) {
                let oldProjectName = snapshot.val().projectName;
                app.ask(`You are currently clocked in to ${oldProjectName}. Simply say, "Switch" to log in to another project.`);
            } else {
                let userProjects = db.ref('projects/' + userId);

                userProjects.orderByChild('createdOn').once('value').then((snapshot) => {

                    // if user have not created any projects yet
                    if (snapshot.numChildren() <= 0) {
                        app.ask(`Sorry! Haven't seen you create a project. Say, "Create a project", to create a new project.`);
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

                        app.tell(`Great! You have been successfully checked in to ${projectName}.`);
                    } else {
                        app.ask(`Oops! ${projectName} doesn't exist. Please say "create a project" to create a new one.`);
                    }
                });
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
                        app.tell(`You have been successfully checked out from ${projectName}. Cheers!`);
                    } else {
                        app.tell(`You have been successfully checked out. Cheers!`);
                    }
                });
            } else {
                app.tell(`Sorry! you are not checked in to any project!`);
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
            let userProjects = db.ref('projects/' + userId);
            userProjects.orderByChild('projectName').equalTo(projectName).once('value').then((projectSnapshot) => {
                // if project name exists
                if (projectSnapshot.exists()) {
                    userLogs.orderByChild('projectName').equalTo(projectName).limitToFirst(30).once('value').then((logSnapshot) => {
                        let items = [];

                        if (logSnapshot.numChildren() === 1) {
                            let index = 0;
                            let title = '';
                            let description = '';
                            let timeToTTS = '';
                            logSnapshot.forEach((childLogSnapshot) => {
                                index++;
                                title = childLogSnapshot.val().projectName;
                                description = childLogSnapshot.val().description;
                                timeToTTS =  childLogSnapshot.val().checkOutTime === "" ?  helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);
                            });
                            app.ask(app.buildRichResponse()
                                .addSimpleResponse(`Here you go! You have 1 log available for the project ${projectName}`)
                                .addSuggestions(
                                    ['Create a project', 'List'])
                                .addBasicCard(app.buildBasicCard(`${description}`)
                                    .setSubtitle(`${timeToTTS}`)
                                    .setTitle(title)
                                    .addButton('More', 'https://kike.co.in/')
                                    .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", 'TimeSheet'))
                            );
                        } else if (logSnapshot.numChildren() > 1) {
                            let index = 0;
                            logSnapshot.forEach((childLogSnapshot) => {
                                index++;
                                let title = index + '. ' + childLogSnapshot.val().projectName;
                                let timeToTTS =  childLogSnapshot.val().checkOutTime === "" ?  helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);
                                items.push(app.buildOptionItem(childLogSnapshot.key)
                                    .setTitle(title)
                                    .setDescription(`Your work time for the project is ${timeToTTS}`)
                                    .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", appName)
                                )
                            });
                            app.askWithList(app.buildRichResponse()
                                    .addSimpleResponse(`Here you go! You have ${items.length} logs available for the project ${projectName}`)
                                    .addSuggestions(
                                        ['Create a project', 'List']),
                                app.buildList('All project list')
                                    .addItems(items)
                            );
                        } else {
                            app.ask(`Sorry! You don't have any logs for the project name ${projectName}. Just say "Log me in for ${projectName}" to get started!`)
                        }
                    });

                } else {
                    app.ask(`Sorry! You don't have a project with the name ${projectName}. Just say "create a project" to get started!`)
                }
            });

        } else {

            userLogs.orderByChild('checkInDate').limitToFirst(30).once('value').then((logSnapshot) => {
                let items = [];

                if (logSnapshot.numChildren() === 1) {
                    let title = '';
                    let description = '';
                    let timeToTTS = '';
                    logSnapshot.forEach((childLogSnapshot) => {
                        title = childLogSnapshot.val().projectName;
                        description = childLogSnapshot.val().description;
                        timeToTTS =  childLogSnapshot.val().checkOutTime === "" ?  helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);
                    });
                    app.ask(app.buildRichResponse()
                        .addSimpleResponse(`Here you go! You have 1 log available`)
                        .addSuggestions(
                            ['Create a project', 'List'])
                        .addBasicCard(app.buildBasicCard(`${description}`)
                            .setSubtitle(`${timeToTTS}`)
                            .setTitle(title)
                            .addButton('More', 'https://kike.co.in/')
                            .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", 'TimeSheet'))
                    );
                } else if (logSnapshot.numChildren() > 1) {
                    let index = 0;
                    logSnapshot.forEach((childLogSnapshot) => {
                        index++;
                        let title = index + '. ' + childLogSnapshot.val().projectName;
                        let timeToTTS =  childLogSnapshot.val().checkOutTime === "" ?  helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);

                        items.push(app.buildOptionItem(childLogSnapshot.key)
                            .setTitle(title)
                            .setDescription(`Your work time for the project is ${timeToTTS}`)
                            .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", appName)
                        )
                    });

                    app.askWithList(app.buildRichResponse()
                            .addSimpleResponse(`Here you go! You have ${items.length} logs available`)
                            .addSuggestions(
                                ['Create a project', 'List']),
                        app.buildList('All project list')
                            .addItems(items)
                    );
                } else {
                    app.tell(`Sorry! You don't have any logs recorded yet. Get started by saying "Log me in for project name"!`)
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
                const projectName = logSnapshot.val().projectName;
                const description = logSnapshot.val().description;
                const timeToTTS = helpers.timeToTTS(logSnapshot.val().checkInTime, logSnapshot.val().checkOutTime);

                app.ask(app.buildRichResponse()
                    .addSimpleResponse(`Here you go! You have worked on ${projectName} for ${timeToTTS}`)
                    .addSuggestions(
                        ['Create a project', 'List'])
                    .addBasicCard(app.buildBasicCard(`${description}`)
                        .setSubtitle(`${timeToTTS}`)
                        .setTitle(projectName)
                        .addButton('More', 'https://kike.co.in/')
                        .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", 'TimeSheet'))
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

            app.tell(`Done. The new default session time out is now set to ${newDefaultTime} hours.`);
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

            if (projectSnapshot.numChildren() === 1) {
                let title = '';
                let description = '';
                let createdOn = '';
                projectSnapshot.forEach((childLogSnapshot) => {
                    title = childLogSnapshot.val().projectName;
                    description = childLogSnapshot.val().description;
                    createdOn = new Date(childLogSnapshot.val().createdAt).toDateString();
                });
                app.ask(app.buildRichResponse()
                    .addSimpleResponse(`Here you go! You have 1 project available`)
                    .addSuggestions(
                        ['Create a project', 'List'])
                    .addBasicCard(app.buildBasicCard(`${description}`)
                        .setSubtitle(`${createdOn}`)
                        .setTitle(title)
                        .addButton('More', 'https://kike.co.in/')
                        .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", 'TimeSheet'))
                );
            } else if (projectSnapshot.numChildren() > 1) {
                projectSnapshot.forEach((childLogSnapshot) => {
                    index++;
                    let title = index + '. ' + childLogSnapshot.val().projectName;
                    let description = childLogSnapshot.val().description;

                    items.push(app.buildOptionItem(childLogSnapshot.key)
                        .setTitle(title)
                        .setDescription(`${description}`)
                        .setImage("https://lh3.googleusercontent.com/-VrPSpmjoFJk/WVE_rJOs68I/AAAAAAABT4k/EsAIwkQnRjUAmQZU_7p3MJDtLaymXSBowCMYCGAYYCw/h192-w192/TimeSheet_192.png?sz=64", appName)
                    )
                });

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

    function switchProject() {
        const newProjectName = app.getArgument('projectName');
        const newDescription = app.getArgument('description');
        let userProjects = db.ref('projects/' + userId);

        userProjects.orderByChild('createdOn').once('value').then((projectSnapshot) => {

            if (projectSnapshot.numChildren() <= 0) {
                app.ask(`Sorry! Haven't seen you create a project. Say, "Create a project", to create a new project`);
                return;
            }

            let projectNameExists = false;
            projectSnapshot.forEach((childSnapshot) => {
                if (childSnapshot.val().projectName.toUpperCase() === newProjectName.toUpperCase()) {
                    projectNameExists = true;
                }
            });

            if (projectNameExists) {

                let userCheckIn = db.ref('checkIn/' + userId);

                userCheckIn.once('value').then((checkInSnapshot) => {

                    if (checkInSnapshot.exists() && checkInSnapshot.val().checkInStatus) {

                        let userLogs = db.ref('logs/' + userId);
                        const checkOutTime = new Date().getTime();

                        userLogs.orderByChild('checkOutTime').equalTo('').once('value').then((logSnapshot) => {
                            logSnapshot.forEach((childSnapshot) => {
                                userLogs.child(childSnapshot.key).update({checkOutTime: checkOutTime});
                            });

                            let oldProject = checkInSnapshot.val().projectName;
                            userCheckIn.update({checkInStatus: false});

                            const checkInTime = new Date().getTime();

                            let date = moment().format('DD-MM-YYYY');

                            userCheckIn.set({
                                projectName: newProjectName,
                                checkInTime: checkInTime,
                                checkInStatus: true
                            });
                            userLogs.push({
                                projectName: newProjectName,
                                checkInDate: date,
                                checkInTime: checkInTime,
                                description: newDescription,
                                checkOutTime: ""
                            });

                            app.tell(`Great! Switch successful. You are now clocked in to ${newProjectName}.`);
                        });
                    } else {
                        const checkInTime = new Date().getTime();

                        let date = moment().format('DD-MM-YYYY');
                        let userLogs = db.ref('logs/' + userId);

                        userCheckIn.set({
                            projectName: newProjectName,
                            checkInTime: checkInTime,
                            checkInStatus: true
                        });
                        userLogs.push({
                            projectName: newProjectName,
                            checkInDate: date,
                            checkInTime: checkInTime,
                            description: newDescription,
                            checkOutTime: ""
                        });
                        app.tell(`You have been successfully checked in to ${newProjectName}.`);
                    }
                });
            } else {
                app.ask(`Oops! ${newProjectName} doesn't exist. Please say "create a project" to create a new one.`);
            }
        });
    }

    const actionMap = new Map();
    // Welcome intent
    actionMap.set(WELCOME_INTENT, welcome);
    actionMap.set(USER_PERMISSION, userPermission);

    // Creating a project
    actionMap.set(CREATE_PROJECT, createProject);
    actionMap.set(CREATE_PROJECT_YES, createProjectYes);

    // Check in a project
    actionMap.set(CHECK_IN_INTENT, checkInProject);

    // Check out a project
    actionMap.set(CHECKOUT_INTENT, checkOutProject);

    // Change default timeout
    actionMap.set(DEFAULT_CHECKOUT_TIME_INTENT, changeDefaultTimeOut);

    // List projects
    actionMap.set(LIST_PROJECTS_INTENT, listProjects);

    // Switch project
    actionMap.set(SWITCH_PROJECT_INTENT, switchProject);

    // Display all logs
    actionMap.set(ALL_LOGS_INTENT, allLogs);
    actionMap.set(LOG_SELECTED_INTENT, logSelected);

    app.handleRequest(actionMap);
});
