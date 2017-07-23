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

/**
 * home page is coming soon
 */
class HomePage extends React.Component {

    render() {
        return (
            <div>
                <div id="message">
                    <img className="logo" src="http://www.kike.co.in/images/kike_logo_home.png" alt="kike-logo"/>
                    <hr/>
                    <br/>
                    <h1>{this.props.user.displayName.toUpperCase()}</h1>
                </div>
                <div id="coming-soon">
                    <h1>Coming Soon</h1>
                </div>
            </div>
        );
    }
}

export default HomePage;