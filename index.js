'use strict';

const proxy = require('./proxy');

function socketPath(suffix) {
  return `/tmp/server.${suffix}.sock`;
}

function newHandler(initServer) {
  console.log('initializing new handler');

  let socketSuffix = 0;
  let listening = false;

  const handler = function(event, context, callback) {
    context.callbackWaitsForEmptyEventLoop = false;

    if(!listening) {
      console.log('initializing new server')

      initServer(socketPath(socketSuffix), function(error) {

        if (error) {
          if (error.code === "EADDRINUSE") {
            console.log('recieved EADDRINUSE, trying again');
            ++socketSuffix;
          } else {
            console.log(error);
            callback(null, { statusCode: 500, headers: {}, body: JSON.stringify({ error: "Internal Server Error" }) });
          }
        } else {
          listening = true;
        }

        handler(event, context, callback);
      });

      return undefined;
    }

    console.log('sending http request to server')

    proxy.forwardRequestToSocket(socketPath(socketSuffix), event, context).then(function(data) {
      console.log('received http response from server')

      callback(null, data);
    }).catch(function(error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') {
        console.log('could not connect, rebooting server');

        listening = false;
        handler(event, context, callback);
      } else {
        console.log(error);
        callback(null, { statusCode: 502, headers: {}, body: JSON.stringify({ error: '502 Bad Gateway' }) });
      }
    });
  }

  return handler
}

exports.newHandler = newHandler
