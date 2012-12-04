"use strict";

var async = require('async');
var fs = require('fs');
var request = require('request');
var url = require('url');

var defaultDiscoveryServiceUrl = 'https://www.googleapis.com/discovery/v1/apis';

// Generate an API using the information in initOpts
// generateAPI(initOpts, cb)
//
// initOpts = {
//   One of:
//     discoveryServiceFile: file containing a service discovery document
//     discoveryServiceUrl : URL for a service discovery document
//     discoveryRestFile   : file containing a single rest service document
//     discoveryRestUrl    : URL for a single rest service document
//     (if none are provided, a default discoveryServiceUrl is used)
//
//   apiKey: The API key your service provider assigned your app (optional)

function generateAPI(initOpts, cb) {
    if (!cb) {
        // initOpts is optional, cb isn't
        cb = initOpts;
        initOpts = {};
    }
    var discoveryServiceUrl = initOpts.discoveryServiceUrl ||
        defaultDiscoveryServiceUrl;
    var url = initOpts.discoveryRestUrl || discoveryServiceUrl;
    var file = initOpts.discoveryRestFile || initOpts.discoveryServiceFile;
    var isService =
        discoveryServiceUrl || initOpts.discoveryServiceFile;
    async.waterfall([
        function (cb) {
            if (!file) {
                return cb(null, null, null);
            }
            fs.readFile(file, function (err, data) {
                if (err) return cb(err);
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return cb(e);
                }
                return cb(null, file, data);
            });
            return;
        },
        function (path, body, cb) {
            if (!url || body) {
                return cb(null, path, body);
            }
            request({
                uri: url,
                json: true
            }, function (err, res, body) {
                return cb(err, url, body);
            });
        },
        function (path, body, cb) {
            if (!body) {
                return cb(new Error('Nothing returned from:' + path));
            }
            if (isService) {
                return processAPIDirectory(initOpts, path, body, cb);
            }
            processResource(initOpts, body.baseUrl, body, {}, cb);
        }
    ], cb);
}

// Run through all the APIs in the directory
function processAPIDirectory(initOpts, path, body, cb) {
    if (!body.items) {
        return cb(new Error('No items returned from:' + path));
    }
    var api = {};
    async.forEach(
        body.items,
        function (entry, cb) {
            if (!entry.preferred || !entry.discoveryRestUrl) {
                return cb();
            }
            getAPIDirectoryEntry(initOpts, entry.discoveryRestUrl, function (err, apiEntry) {
                if (err) return cb(err);
                api[entry.name] = apiEntry;
                cb();
            });
        },
        function (err) {
            if (err) api = undefined;
            cb(err, api);
        }
    );
}

// Retrieve and process an API's discovery document
function getAPIDirectoryEntry(initOpts, discoveryRestUrl, cb) {
    request({
        uri: discoveryRestUrl,
        json: true
    }, function (err, res, body) {
        if (err) return cb(err);
        if (!body) {
            return cb(new Error('Nothing returned from:', discoveryRestUrl));
        }
        processResource(initOpts, body.baseUrl, body, {}, cb);
    });
}

// Process a single resource, which may contain methods and/or embedded
// resources.
function processResource(initOpts, baseUrl, resource, apiEntry, cb) {
    async.parallel([
        function (cb) {
            processMethods(initOpts, baseUrl, resource.methods, apiEntry, cb);
        },
        function (cb) {
            processResources(initOpts, baseUrl, resource.resources, apiEntry, cb);
        }
    ], function (err) {
        if (err) return cb(err);
        return cb(null, apiEntry);
    });
}

// Process a list of resources.
function processResources(initOpts, baseUrl, resources, apiEntry, cb) {
    if (!resources) return cb(null, apiEntry);
    async.forEach(
        Object.keys(resources),
        function (name, cb) {
            var resource = resources[name];
            if (! apiEntry[name]) apiEntry[name] = {};
            processResource(initOpts, baseUrl, resource, apiEntry[name], function (err, resourceEntry) {
                if (err) return cb(err);
                cb();
            });
        },
        function (err) {
            if (err) apiEntry = undefined;
            cb(err, apiEntry);
        }
    );
}

// Generate functions for each method in an API.
function processMethods(initOpts, baseUrl, methods, resourceEntry, cb) {
    if (!methods) return cb(null, resourceEntry);
    async.forEach(
        Object.keys(methods),
        function (name, cb) {
            var method = methods[name];
            // Pass in just the values we need for the method we're
            // creating. Avoids keeping references to data we don't
            // need once initialization is complete.
/*
  This is a jslint-approved version. The downside is that all the
  generated functions are anonymous - any stack traces will be a
  bit harder to chase down.
  
            resourceEntry[name] = async.apply(commonMethod, {
                apiKey: initOpts.apiKey,
                baseUrl: baseUrl,
                httpMethod: method.httpMethod,
                path: method.path
            });
*/
/*
  An alternate version which will generate named functions.
  To avoid trouble, I remove non- \w and \d characters from the
  function name. I also prepend a $ to avoid clashing with
  reserved names (like 'delete').

  Based on an article in Marcos Cáceres' blog:
    http://marcosc.com/2012/03/dynamic-function-names-in-javascript/
*/
            var safeName = name.replace(/[^\w\d]/g, '');
            resourceEntry[name] = new Function('commonMethod', 'data', 'return function $' + safeName + '(args, cb) {' +
                'return commonMethod(data, args, cb);' +
            '}')(commonMethod, {
                apiKey: initOpts.apiKey,
                baseUrl: baseUrl,
                httpMethod: method.httpMethod,
                path: method.path
            });
/* End of alternate version */
            cb();
        },
        function (err) {
            if (err) resourceEntry = undefined;
            cb(err, resourceEntry);
        }
    );
}

// This is where the API endpoint is actually called.
function commonMethod(data, options, cb) {
    var path = data.path;
    var search = [];
    if (data.apiKey) search.push('key=' + data.apiKey);
    for (var option in options) {
        var key = '{' + option + '}';
        var value = encodeURIComponent(options[option]);
        if (path.indexOf(key) >= 0) {
            path = path.replace(key, value);
        } else {
            search.push(option + '=' + value);
        }
    }
    var uri = data.baseUrl + path + '?' + search.join('&');
    request({
        method: data.httpMethod,
        uri: uri,
        json: true
    }, function (err, res, body) {
        cb(err, body);
    });
}

exports.generateAPI = generateAPI;
