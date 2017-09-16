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
const HELP_INTENT = 'input.helpIntent';

// Work Log constants
const appName = 'Work Log';

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
                                            const checkInTime = new Date(userCheckInSnapshot.val().checkInTime);
                                            const checkOutTime = checkInTime.setMinutes(defaultCheckOutTime);
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
            let promise = user.set({userId: userId, userName: displayName, defaultCheckOutTime: 480});

            const prompt = `Next, ${displayName}, here are the things you can do.`;
            const cardView = app.buildRichResponse()
                .addSimpleResponse(prompt);
            const list = `Create projects \n`
                + `Log into a project \n`
                + `List your latest 30 projects \n`
                + `Switch between projects \n`
                + `Change your default checkout time \n`
                + `List your latest 30 logs \n`;
            cardView.addSimpleResponse(list);
            app.ask(cardView);
        } else {
            user.once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    app.ask(`No worries, say "Create a Project", to create a new Project.`);
                } else {
                    let promise = user.set({userId: userId, defaultCheckOutTime: 480});
                    app.ask(`No worries, say "Create a Project", to create a new Project.`);
                }
            });
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
        const projectName = helpers.toTitleCase(app.getArgument('projectName'));
        app.ask(`Creating Project - ${projectName} now, please confirm`);
    }

    function createProjectYes() {
        const projectName = helpers.toTitleCase(app.getArgument('projectName'));
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
                    app.ask(`Great! Project - ${projectName} is now created. You can start logging in right away! just say, ${appName} check in to ${projectName}`);
                }
            });
        } else {
            console.error('createProjectYes(): Project name is undefined @ confirmation');
            app.tell('Sorry! something went wrong');
        }
    }

    /**
     * User Project Check in
     */
    function checkInProject() {
        const projectName = helpers.toTitleCase(app.getArgument('projectName'));
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
        const projectName = helpers.toTitleCase(app.getArgument('projectName'));
        let userLogs = db.ref('logs/' + userId);

        getApplicationData().then((appData) => {
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
                                    timeToTTS = !childLogSnapshot.val().checkOutTime ? helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);
                                });
                                app.ask(app.buildRichResponse()
                                    .addSimpleResponse(`Here you go! You have 1 log available for the project ${projectName}`)
                                    .addSuggestions(
                                        ['Log me in', 'Default time out', 'Switch'])
                                    .addBasicCard(app.buildBasicCard(`${description}`)
                                        .setSubtitle(`${timeToTTS}`)
                                        .setTitle(title)
                                        .addButton('More', appData.url)
                                        .setImage(appData.image, appData.name))
                                );
                            } else if (logSnapshot.numChildren() > 1) {
                                let index = 0;
                                logSnapshot.forEach((childLogSnapshot) => {
                                    index++;
                                    let title = index + '. ' + childLogSnapshot.val().projectName;
                                    let timeToTTS = !childLogSnapshot.val().checkOutTime ? helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);
                                    items.push(app.buildOptionItem(childLogSnapshot.key)
                                        .setTitle(title)
                                        .setDescription(`Your work time for the project is ${timeToTTS}`)
                                        .setImage(appData.image, appData.name)
                                    )
                                });
                                app.askWithList(app.buildRichResponse()
                                        .addSimpleResponse(`Here you go! You have ${items.length} logs available for the project ${projectName}`)
                                        .addSuggestions(
                                            ['Log me in', 'Default time out', 'Switch']),
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
                            timeToTTS = !childLogSnapshot.val().checkOutTime ? helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);
                        });
                        app.ask(app.buildRichResponse()
                            .addSimpleResponse(`Here you go! You have 1 log available`)
                            .addSuggestions(
                                ['Create a project', 'List', 'Log me in'])
                            .addBasicCard(app.buildBasicCard(`${description}`)
                                .setSubtitle(`${timeToTTS}`)
                                .setTitle(title)
                                .addButton('More', appData.url)
                                .setImage(appData.image, appData.name))
                        );
                    } else if (logSnapshot.numChildren() > 1) {
                        let index = 0;
                        logSnapshot.forEach((childLogSnapshot) => {
                            index++;
                            let title = index + '. ' + childLogSnapshot.val().projectName;
                            let timeToTTS = !childLogSnapshot.val().checkOutTime ? helpers.timeToTTS(childLogSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(childLogSnapshot.val().checkInTime, childLogSnapshot.val().checkOutTime);

                            items.push(app.buildOptionItem(childLogSnapshot.key)
                                .setTitle(title)
                                .setDescription(`Your work time for the project is ${timeToTTS}`)
                                .setImage(appData.image, appData.name)
                            )
                        });

                        app.askWithList(app.buildRichResponse()
                                .addSimpleResponse(`Here you go! You have ${items.length} logs available`)
                                .addSuggestions(
                                    ['Create a project', 'List', 'Log me in',]),
                            app.buildList('All project list')
                                .addItems(items)
                        );
                    } else {
                        app.ask(`Sorry! You don't have any logs recorded yet. Get started by saying "Log me in for project name"!`)
                    }
                });
            }
        });
    }

    /**
     * Handle user Selected a log
     */
    function logSelected() {
        let userLogs = db.ref('logs/' + userId);
        let projects = db.ref('projects/' + userId);
        const logKey = app.getSelectedOption();

        if (logKey) {
            getApplicationData().then((appData) => {
                userLogs.child(logKey).once('value').then((logSnapshot) => {
                    if (logSnapshot.exists()) {
                        const projectName = logSnapshot.val().projectName;
                        const description = logSnapshot.val().description;
                        let timeToTTS = logSnapshot.val().checkOutTime === "" ? helpers.timeToTTS(logSnapshot.val().checkInTime, new Date().getTime()) : helpers.timeToTTS(logSnapshot.val().checkInTime, logSnapshot.val().checkOutTime);

                        app.ask(app.buildRichResponse()
                            .addSimpleResponse(`Here you go! You have worked on ${projectName} for ${timeToTTS}`)
                            .addSuggestions(
                                ['Log me in', 'Create a project', 'List'])
                            .addBasicCard(app.buildBasicCard(`${description}`)
                                .setSubtitle(`${timeToTTS}`)
                                .setTitle(projectName)
                                .addButton('More', appData.url)
                                .setImage(appData.image, appData.name))
                        );
                    } else {
                        projects.child(logKey).once('value').then((projectSnapshot) => {

                            if (projectSnapshot.exists()) {
                                const projectName = projectSnapshot.val().projectName;
                                const description = projectSnapshot.val().description;
                                const createdAt = moment(projectSnapshot.val().createdAt).format('DD MMM YYYY');

                                app.ask(app.buildRichResponse()
                                    .addSimpleResponse(`Here you go! The project ${projectName} was created on ${createdAt}`)
                                    .addSuggestions(
                                        ['Log me in', 'Create a project', 'List'])
                                    .addBasicCard(app.buildBasicCard(`${description}`)
                                        .setSubtitle(`${createdAt}`)
                                        .setTitle(projectName)
                                        .addButton('More', appData.url)
                                        .setImage(appData.image, appData.name))
                                );
                            } else {
                                console.error('logSelected(): Error with selected option with logSnapshot and projectSnapshot does not exists');
                                app.tell('Sorry! Something went wrong! please try again later.');
                            }
                        });
                    }
                });
            });
        } else {
            console.error('logSelected(): Error with selected option with logKey undefined');
            app.tell('Sorry! Something went wrong! please try again later.');
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

            app.tell(`Done. The new default session time out is now set to ${newDefaultTime} hours.`);
        } else {
            app.ask(`Sorry! can you please repeat that.`)
        }
    }

    /**
     * List the first 30 user projects
     */
    function listProjects() {
        let userProjects = db.ref('projects/' + userId);

        getApplicationData().then((appData) => {
            userProjects.orderByChild('createdAt').limitToFirst(30).once('value').then((projectSnapshot) => {
                let items = [];
                let index = 0;

                if (projectSnapshot.numChildren() <= 0) {
                    app.ask(`Sorry! Haven't seen you create a project. Say, "Create a project", to create a new project`);
                    return;
                }

                if (projectSnapshot.numChildren() === 1) {
                    let title = '';
                    let description = '';
                    let createdOn = '';
                    projectSnapshot.forEach((childLogSnapshot) => {
                        title = childLogSnapshot.val().projectName;
                        description = childLogSnapshot.val().description;
                        createdOn = moment(childLogSnapshot.val().createdAt).format('DD MMM YYYY');
                    });
                    app.ask(app.buildRichResponse()
                        .addSimpleResponse(`Here you go! ${title} is the only project available`)
                        .addSuggestions(
                            ['Create a project', 'Check me in'])
                        .addBasicCard(app.buildBasicCard(`${description}`)
                            .setSubtitle(`${createdOn}`)
                            .setTitle(title)
                            .addButton('More', appData.url)
                            .setImage(appData.image, appData.name))
                    );
                } else if (projectSnapshot.numChildren() > 1) {
                    projectSnapshot.forEach((childLogSnapshot) => {
                        index++;
                        let title = index + '. ' + childLogSnapshot.val().projectName;
                        let description = childLogSnapshot.val().description;

                        items.push(app.buildOptionItem(childLogSnapshot.key)
                            .setTitle(title)
                            .setDescription(`${description}`)
                            .setImage(appData.image, appData.name)
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

    function getApplicationData() {
        return new Promise((resolve) => {
            let appData = db.ref('appData/');
            appData.once('value').then((appDataSnapshot) => {

                if (appDataSnapshot.exists()) {
                    resolve({
                        url: appDataSnapshot.val().url,
                        image: appDataSnapshot.val().image,
                        name: appDataSnapshot.val().name
                    });
                } else {
                    resolve({
                        url: 'http://www.kike.co.in',
                        image: 'https://firebasestorage.googleapis.com/v0/b/timesheet-81c18.appspot.com/o/TimeSheet_192.png?alt=media&token=aa52b6b7-0510-47a6-9c49-1a90eba7af86',
                        name: appName
                    });
                }
            });
        });
    }

    function help() {
        const randomHelp = helpers.getRandomHelp();
        app.ask(`Just say "${randomHelp.key}" ${randomHelp.value}`)
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

    //Help intent
    actionMap.set(HELP_INTENT, help);

    app.handleRequest(actionMap);
});
