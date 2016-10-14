// request.js handles conversion of a API Gateway proxy event
// into http request options passed to http.request(...)
'use strict';

const http = require('http');
const querystring = require('querystring');

const singularHeaders = [

  // List obtained from https://nodejs.org/api/http.html#http_message_headers
  'age',
  'authorization',
  'content-length',
  'content-type',
  'etag',
  'expires',
  'from',
  'host',
  'if-modified-since',
  'if-unmodified-since',
  'last-modified',
  'location',
  'max-forwards',
  'proxy-authorization',
  'referer',
  'retry-after',
  'user-agent',

  // Note: Set-Cookie is an addition here to prevent malformed set cookie headers.
  //
  // The API Gateway proxy has the limitation of not being able to accept
  // multiple headers of the same name from a lambda function, so we only accept the first one.
  //
  // RFC 6265 (https://tools.ietf.org/html/rfc6265) states origin servers should not fold Set-Cookie headers
  'set-cookie'
]

// Accepts rawHeaders in the format defined from https://nodejs.org/api/http.html#http_message_rawheaders
// and returns an object representing the response headers to return to API Gateway
function rawHeadersToObject(rawHeaders) {
  let headers = {};
  let seenHeaders = [];

  for(let i = 0; i < rawHeaders.length; i += 2) {
    let name = rawHeaders[i].toLowerCase();
    let value = rawHeaders[i + 1];

    let lowerName = name.toLowerCase();

    if (seenHeaders.indexOf(name) != -1 && singularHeaders.indexOf(name) == -1) {
      headers[name] = headers[name] + "," + value;
    } else {
      headers[name] = value;
      seenHeaders.push(name);
    }
  }

  return headers;
}

function lowerCaseObjectKeys(object) {
  const clone = {};

  Object.keys(object).forEach(function(key) {
    clone[key.toLowerCase()] = object[key]
  });

  return clone;
}

function formatOutputHeaders(headers) {
  const clone = {};

  Object.keys(headers).forEach(function(key) {
    const newKey = key.split("-").map(function(key) { return key.charAt(0).toUpperCase() + key.slice(1) }).join("-");
    clone[newKey] = headers[key];
  });

  return clone;
}

function requestOptionsFromEvent(event) {
  let requestPath = event.path;

  const headers = lowerCaseObjectKeys(event.headers);
  const queryString = querystring.stringify(event.queryStringParameters);

  if (queryString) {
    requestPath += `?${queryString}`;
  }


  return {
    method: event.httpMethod,
    headers: headers,
    path: requestPath
  }
}

function forwardRequestToSocket(socketPath, event, context) {
  const options = requestOptionsFromEvent(event);

  options.socketPath = socketPath;

  // We don't support compression over the socket proxy
  options.headers['accept-encoding'] = 'identity';

  // Add request metadata for access in server
  options.headers['x-apigateway-event'] = JSON.stringify(event);
  options.headers['x-apigateway-context'] = JSON.stringify(context);

  return new Promise(function(resolve, reject) {
    const request = http.request(options, function(response) {
      let body = "";

      response.setEncoding('utf8');
      response.on('data', function(chunk) { body += chunk.toString('utf8') });

      response.on('end', function() {
        const headers = rawHeadersToObject(response.rawHeaders);

        // Let API Gateway manage these headers to prevent errors downstream
        delete headers['connection'];
        delete headers['transfer-encoding'];

        resolve({ statusCode: response.statusCode, headers: formatOutputHeaders(headers), body: body });
      });
    });

    if (event.body) {
      request.write(event.body);
    }

    request.on('error', function(error) {
      reject(error);
    });

    request.end();
  });
}

exports.forwardRequestToSocket = forwardRequestToSocket
