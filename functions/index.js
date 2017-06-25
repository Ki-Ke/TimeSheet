'use strict';

const App = require('actions-on-google').ApiAiApp;
const functions = require('firebase-functions');

exports.timeSheet = functions.https.onRequest((request, response) => {
    const app = new App({ request, response });
    console.log('Request headers: ' + JSON.stringify(request.headers));
    console.log('Request body: ' + JSON.stringify(request.body));

    app.tell('Actually it looks like you heard it all. ' +
        'Thanks for listening!');
    let actionMap = new Map();
    app.handleRequest(actionMap);
});
