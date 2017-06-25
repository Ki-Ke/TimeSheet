'use strict';

const App = require('actions-on-google').ApiAiApp;
const functions = require('firebase-functions');

exports.timeSheet = functions.https.onRequest((request, response) => {
    const app = new App({ request, response });

    let actionMap = new Map();
    app.handleRequest(actionMap);
});
