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

let config = {
    apiKey: "AIzaSyCFuaaRmmctGcQMNvX2psjvy7-6scrZmQc",
    authDomain: "timesheet-81c18.firebaseapp.com",
    databaseURL: "https://timesheet-81c18.firebaseio.com",
    projectId: "timesheet-81c18",
    storageBucket: "timesheet-81c18.appspot.com",
    messagingSenderId: "494017438997"
};
firebase.initializeApp(config);
let authUi = new firebaseui.auth.AuthUI(firebase.auth());

const db = firebase.database();

class Main extends React.Component {

    constructor(props) {
        super(props);
        this.state = {isLoggedIn: false, userObject: {}, userData: null};
        let _this = this;

        firebase.auth().onAuthStateChanged(function (user) {
            if (user) {
                let data = db.ref('projects/APhe68Fbqk6K_XQQcbCMKdpQ-HpQ');
                return _this.setState({isLoggedIn: true, userObject: user, userData: data});
            }
        });
    };

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
            'signInOptions': [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID
            ]
        };
        authUi.start('#firebaseui-auth', uiConfig);
    };

    componentWillUnmount() {
        authUi.reset();
    };

    render() {
        let dom;
        if (this.state.isLoggedIn) {
            dom = <HomePage user={this.state.userData}/>
        } else {
            dom = <SignIn />
        }
        return (
            <div>{dom}</div>
        );
    };
}

export default Main;