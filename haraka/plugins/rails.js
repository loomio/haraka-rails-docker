// Copied from https://github.com/mailprotector/haraka-plugin-queue-rails
// Modified to use ENV's rather than config file by Rob Guthrie <rob@loomio.org>

// MIT License

// Copyright (c) 2021 Virtual Connect

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const http = require('http');
const https = require('https');
const { URL } = require('url');

(() => {
  const buildPluginFunction = () => {
    return function(next, connection) {
      const plugin = this;

      const { transaction, remote, hello } = connection;

      const addCustomHeaders = customHeader => {
        try {
          transaction.add_header('harakadata', JSON.stringify(customHeader))
        } catch (err) {
          handleError(`Adding custom headers ${err.message}`);
        }
      };

      const done = (status, reason) => {
        next(status, reason);
      };

      const handleError = (message, errorMessage) => {
        connection.logerror(message, plugin);
        done(DENYSOFT, errorMessage);
      };

      const handleApiError = err => {
        if (err.code == 'ECONNREFUSED') {
          handleError(err.message, 'Connection refused');
          return;
        }

        if (err.code == 'ENOTFOUND') {
          handleError(err.message, 'Connection not found');
          return;
        }

        if (err.response != undefined && err.response.status != undefined) {
          let errorMessage = `HTTP ${err.response.status}`;

          if (err.response.status == 401) {
            errorMessage = 'Invalid credentials for ingress';
          }

          if (err.response.status == 403) {
            errorMessage = 'Forbidden to access ingress';
          }

          handleError(errorMessage, errorMessage);
        } else {
          handleError(err.message);
        }
      };


      const run = () => {
        const authString = `actionmailbox:${process.env.RAILS_INBOUND_EMAIL_PASSWORD}`;
        const authBase64 = Buffer.from(authString).toString('base64');

        const url = new URL(process.env.RAILS_INBOUND_EMAIL_URL);
        const client = url.protocol === 'https:' ? https : http;

        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authBase64}`,
            'Content-Type': 'message/rfc822',
            'User-Agent': 'haraka rails docker',
          },
        };

        this.loginfo(`sending request to ${url.href}`);
        const req = http.request(options, (res) => {
          this.loginfo('request status', res.statusCode);
          res.on('data', chunk => this.logdebug('Response chunk:', chunk.toString()));
        });

        req.on('error', e => this.logerror('Request error:', e));

        transaction.message_stream.pipe(req);
      };

      addCustomHeaders({
        mail_from: transaction.mail_from.address(),
        rcpt_to: transaction.rcpt_to.map(r => r.address()),
        remote_ip: remote.ip,
        remote_host: remote.host,
        helo: hello.host,
        uuid: transaction.uuid
      });

      run();
    };
  };

  exports.queue_rails_test = buildPluginFunction;

  exports.load_config = function() {
    let cfg = this.config;
    let retryCount = 0;
    const retryLimit = 2;

    const attemptLoadConfig = () => {
      retryCount += 1;
      if (retryCount >= retryLimit) {
        return;
      }
      this.loginfo('password', process.env.RAILS_INBOUND_EMAIL_PASSWORD);
      if (process.env.RAILS_INBOUND_EMAIL_PASSWORD == undefined) {
        this.logerror('Missing RAILS_INBOUND_EMAIL_PASSWORD');
      }

      if (process.env.RAILS_INBOUND_EMAIL_URL == undefined) {
        this.logerror('Missing RAILS_INBOUND_EMAIL_URL');
      }
    };

    attemptLoadConfig();
  };

  exports.register = function() {
    this.register_hook('queue', 'queue_rails');
    this.load_config();
  };

  exports.queue_rails = buildPluginFunction();

})();
