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
const os = require('os');
const path = require('path');
const gcs = require('@google-cloud/storage')();
const moment = require('moment');

// Third part packages
const json2csv = require('json2csv');
const { getFullDate } = require('./helpers');
const fields = ['Check_In_Time', 'Check_Out_Time', 'Description', 'Project_Name', 'Total_Time'];

const bucketName = 'user-exports';

function generateFile(logs, userId) {
    let userLogs = [];
    let tempDir = os.tmpdir();
    let userReportPath = path.join(tempDir, userId);

    if (!fs.existsSync(`${userReportPath}`)) {
        fs.mkdirSync(`${userReportPath}`);
    }

    logs.forEach((childSnapshot) => {
        let totalTime;

        if (childSnapshot.val().checkOutTime) {
            let out = moment(childSnapshot.val().checkOutTime);
            let start = moment(childSnapshot.val().checkInTime);
            totalTime = moment.duration(out.diff(start));
        }
        let singleLog = {
            "Check_In_Time": getFullDate(childSnapshot.val().checkInTime),
            "Check_Out_Time": getFullDate(childSnapshot.val().checkOutTime),
            "Description": childSnapshot.val().description || 'N/A',
            "Project_Name": childSnapshot.val().projectName ? (childSnapshot.val().projectName).toUpperCase() : 'N/A',
            "Total_Time": totalTime ? (totalTime.asHours() > 1 ? `${totalTime.asHours().toFixed(2)} Hrs` : totalTime.asMinutes() > 1 ? `${totalTime.asMinutes().toFixed(2)} Mins` : 'N/A') : 'N/A'
        };
        userLogs.push(singleLog)
    });

    let csv = json2csv({ data: userLogs, fields: fields });

    fs.writeFile(`${userReportPath}/${userId}.csv`, csv, function(err) {
        if (err) {
            console.log(new Error(`Error: while generating report ${err}`));
        }

        userLogs = [];
        const bucket = gcs.bucket(bucketName);
        let time = new Date().getTime();
        let newFile = `${userId}_${time}.csv`;
        bucket.upload(`${userReportPath}/${userId}.csv`, {destination: `${newFile}`}).then(() => {
            console.log('User generated a report');
            fs.unlinkSync(`${userReportPath}/${userId}.csv`);
        }).catch(err => {
            console.log(new Error(`Error: while uploading report ${err}`));
        });
    });
}

module.exports = generateFile;