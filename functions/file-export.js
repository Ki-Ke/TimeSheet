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

const fs = require('fs');

// Third part packages
const json2csv = require('json2csv');
const fields = ['Check In Time', 'Check Out Time', 'Description', 'Project Name', 'Total Time (Hours)'];

function generateFile(logs) {
    let userLogs = [];
    let fileName = new Date().getTime();

    logs.forEach((childSnapshot) => {
        let singleLog = {
            checkInTime: childSnapshot.checkInTime,
            checkOutTime: childSnapshot.checkOutTime,
            description: childSnapshot.description,
            projectName: childSnapshot.projectName,
            totalTime: 10
        };
        userLogs.push(singleLog)
    });

    let csv = json2csv({ data: userLogs, fields: fields});

    fs.writeFile(fileName + '.csv', csv, function(err) {
        if (err) {
            return (err);
        }
        console.log('file saved');

        return fileName
    });
}

module.exports = generateFile;