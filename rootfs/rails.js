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

(() => {
  const buildPluginFunction = axios => {
    return function(next, connection) {
      const plugin = this;

      const { transaction, remote, hello } = connection;

      const addCustomHeaders = customHeader => {
        try {
          transaction.add_header(process.env.ENVELOPE_HEADER_NAME, JSON.stringify(customHeader))
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
        try {
          const authString = `actionmailbox:${process.env.ACTION_MAILBOX_PASSWORD}`;
          const authBase64 = new Buffer.from(authString).toString('base64');

          const options = {
            headers: {
              'Content-Type': 'message/rfc822',
              'User-Agent': process.env.USER_AGENT,
              'Authorization': `Basic ${authBase64}`
            }
          };

          axios.post(process.env.ACTION_MAILBOX_URL, transaction.message_stream, options).then(response => {
            if (response.status <= 299) {
              done(OK);
            } else {
              handleApiError({ response });
            }
          }).catch(err => handleApiError(err));
        } catch (err) {
          handleError(err.message);
        }
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

      if (process.env.USER_AGENT == undefined) {
        console.error('Missing USER_AGENT in /config/queue.rails.json configuration file');
      }

      if (process.env.ACTION_MAILBOX_PASSWORD == undefined) {
        console.error('Missing ACTION_MAILBOX_PASSWORD in /config/queue.rails.json configuration file');
      }

      if (process.env.ACTION_MAILBOX_URL == undefined) {
        console.error('Missing ACTION_MAILBOX_URL in /config/queue.rails.json configuration file');
      }

      if (process.env.ENVELOPE_HEADER_NAME == undefined) {
        console.error('Missing ENVELOPE_HEADER_NAME in /config/queue.rails.json configuration file');
      }
    };

    attemptLoadConfig();
  };

  exports.register = function() {
    this.register_hook('queue', 'queue_rails');
    this.load_config();
  };

  exports.queue_rails = buildPluginFunction(require('axios'));

})();
