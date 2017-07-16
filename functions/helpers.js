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
const timeToWords = require('humanize-duration');

/**
 * Method to convert time to read able test
 * @param checkInTime - time in the form millisecond
 * @param checkOutTime - time in the form millisecond
 */
function timeToTTS(checkInTime, checkOutTime) {
    return timeToWords(checkInTime - checkOutTime, {round: true});
}

/**
 *
 */
function convertMinToHrs(min) {
    let hours = Math.trunc(min / 60);
    let minutes = min % 60;
    return (hours + '.' + minutes);
}

module.exports = {
    timeToTTS,
    convertMinToHrs
};