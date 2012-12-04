"use strict";

//var google = require('discovery-services-client');
var google = require('..');

// First we generate the api
google.generateAPI({
//    apiKey: 'put-your-api-key-here-if-required'
}, function (err, api) {
    // Print it out just for fun
    console.log(err, api);
    // A few blank lines
    console.log('\n\n\n\n\n');
    // Make a simple call
    api.plus.people.search({
        query: 'Dave',
        maxResults: 5
    }, function (err, user) {
        if (err) {
            console.log('ERROR:', err);
            return;
        }
        console.log(user);
    });
});
