# lambda-http
Use Express, Hapi, or other NodeJS web frameworks on API Gateway and Lambda

Inspired by https://github.com/awslabs/aws-serverless-express

# Usage

```bash
npm install lambda-http
```

# Express Example

```javascript
'use strict';

const http = require('http');
const express = require('express');
const lambdaHttp = require('lambda-htpp');

let app;
let server;

exports.handler = lambdaHttp.newHandler(function(socketPath, callback) {
  app = express();
  server = http.createServer(app);

  app.get('/foo', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ message: 'hello bar'}));
  });

  server.on('listening', function() {
    console.log('server listening on socket: ' + socketPath);

    callback(null);
  });

  server.on('error', callback);

  server.listen(socketPath);
});
```

# Hapi Example

```javascript
'use strict';

const Hapi = require('hapi');
const lambdaHttp = require('lambda-http');

let server;

exports.handler = lambdaHttp.newHandler(function(socketPath, callback) {
  server = new Hapi.Server();

  server.connection({ port: socketPath });

  server.route([
    { method: 'GET', path: '/foo', config : { auth: false, handler : function(request, reply){ return reply({ message: 'hello bar'}); } } },
  ]);

  server.start(function(error) {
    if (!error) {
      console.log('server listening on socket: ' + server.info.uri);
    }

    callback(error)
  });
});
```
