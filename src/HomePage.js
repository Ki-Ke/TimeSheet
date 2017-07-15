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

const style = {
    backgroundColor: '#00aedf'
};

class HomePage extends React.Component {

    render() {
        this.props.user.orderByChild('createdAt').limitToFirst(30).once('value').then((projectSnapshot) => {
            console.log(projectSnapshot.val());
        });
        return (
            <div>
                <nav className="nav-extended" style={style}>
                    <div className="nav-wrapper">
                        <a href="#" className="brand-logo">Logo</a>
                        <a href="#" data-activates="mobile-demo" className="button-collapse"><i className="material-icons">menu</i></a>
                        <ul id="nav-mobile" className="right hide-on-med-and-down">
                            <li><a href="sass.html">Sass</a></li>
                            <li><a href="badges.html">Components</a></li>
                            <li><a href="collapsible.html">JavaScript</a></li>
                        </ul>
                        <ul className="side-nav" id="mobile-demo">
                            <li><a href="sass.html">Sass</a></li>
                            <li><a href="badges.html">Components</a></li>
                            <li><a href="collapsible.html">JavaScript</a></li>
                        </ul>
                    </div>
                    <div className="nav-content">
                        <ul className="tabs tabs-transparent">
                            <li className="tab"><a href="#test1">Test 1</a></li>
                            <li className="tab"><a className="active" href="#test2">Test 2</a></li>
                            <li className="tab disabled"><a href="#test3">Disabled Tab</a></li>
                            <li className="tab"><a href="#test4">Test 4</a></li>
                        </ul>
                    </div>
                </nav>
                <div id="test1" className="col s12">Test 1</div>
                <div id="test2" className="col s12">Test 2</div>
                <div id="test3" className="col s12">Test 3</div>
                <div id="test4" className="col s12">Test 4</div>
            </div>
        );
    }
}

export default HomePage;