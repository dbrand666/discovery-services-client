discovery-services-client
=========================

NodeJS client for Google APIs (or any other API that supports Google
discovery service)

Many of Google's APIs can now be accessed via a discovery service, see
[Google APIs Discovery Service](https://developers.google.com/discovery).
This package queries that (or a similar) discovery service and generates
Node.js bindings to the service.

Here's a simple example:

    var google = require('discovery-services-client');
    
    google.generateAPI({
    //    apiKey: 'put-your-api-key-here-if-required'
    }, function (err, api) {
        api.plus.people.search({
            query: 'Dave',
            maxResults: 5
        }, function (err, res, user) {
            if (err) {
                console.log('ERROR:', err);
                return;
            }
            console.log(user);
        });
    });

Simple, huh?
