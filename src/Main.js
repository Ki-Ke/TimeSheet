/**
 #
 # Copyright 2017 KiKe. All Rights Reserved.
 #
 # Licensed under the Apache License, Version 2.0 (the "License");
 # you may not use this file except in compliance with the License.
 # You may obtain a copy of the License at
 #
 #      http://www.apache.org/licenses/LICENSE-2.0
 #
 # Unless required by applicable law or agreed to in writing, software
 # distributed under the License is distributed on an "AS IS" BASIS,
 # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 # See the License for the specific language governing permissions and
 # limitations under the License.
 */
import React from 'react';
import firebase from 'firebase';
import firebaseui from 'firebaseui';
import SignIn from './SignIn';
import HomePage from './HomePage';

/**
 * main config of the firebase app
 * @type {{apiKey: string, authDomain: string, databaseURL: string, projectId: string, storageBucket: string, messagingSenderId: string}}
 */
let config = {
    apiKey: "",
    authDomain: "timesheet-81c18.firebaseapp.com",
    databaseURL: "https://timesheet-81c18.firebaseio.com",
    projectId: "timesheet-81c18",
    storageBucket: "timesheet-81c18.appspot.com",
    messagingSenderId: ""
};
firebase.initializeApp(config);
let authUi = new firebaseui.auth.AuthUI(firebase.auth());

class Main extends React.Component {

    constructor(props) {
        super(props);
        this.state = {isLoggedIn: false, userObject: {}};
        let _this = this;

        /**
         * checking the user login state
         */
        firebase.auth().onAuthStateChanged(function (user) {
            if (user) {
                _this.setState({isLoggedIn: true, userObject: user});
            }
        });
    };

    /**
     * setting the ui for firebase
     * login
     */
    componentDidMount() {
        var self = this;
        var uiConfig = {
            'callbacks': {
                'signInSuccess': function (user) {
                    if (self.props.onSignIn) {
                        self.props.onSignIn(user);
                    }
                    return false;
                }
            },
            'signInFlow': 'popup',
            'signInOptions': [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID
            ]
        };
        authUi.start('#firebaseui-auth', uiConfig);
    };

    /**
     * reseting the authUi
     */
    componentWillUnmount() {
        authUi.reset();
    };

    /**
     * if signed in shows home page
     * else signin page
     * @returns {XML}
     */
    render() {
           let component = this.state.isLoggedIn ? <HomePage user={this.state.userObject}/> : <SignIn/>
        return (
            <div>{component}</div>
        );
    };
}

export default Main;