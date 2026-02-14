const NodeHelper = require("node_helper");
const https = require("https");
const { URL } = require("url");

function fetchJson(urlStr, headers) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const options = {
        method: 'GET',
        headers: headers || {},
      };
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              const snippet = data && data.length > 200 ? data.substring(0, 200) + '...' : data;
              return reject(new Error('HTTP ' + res.statusCode + ' from ' + urlStr + ' — ' + snippet));
            }
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Invalid JSON from ' + urlStr + ' — ' + e.message + '\nResponse snippet: ' + (data && data.substring(0,200))));
          }
        });
      });
      req.on('error', (e) => reject(e));
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = NodeHelper.create({
  start: function () {
    console.log("MMM-CTFd helper started...");
  },

  socketNotificationReceived: async function (notification, payload) {
    if (notification === 'GET_CTFd') {
      const config = payload || {};
      const base = (config.CTFd_URL || '').replace(/\/+$/, '');
      const token = config.CTFd_token || '';
      const headers = {};
      if (token) {
        headers['Authorization'] = 'Token ' + token;
      }
      headers['Accept'] = 'application/json';
      headers['Content-Type'] = 'application/json';

      try {
        if (!base) throw new Error('Missing CTFd_URL in module config');
        const scoreboardUrl = base + '/api/v1/scoreboard/top/' + (config.username ? 200 : config.showTop);
        const challengesUrl = base + '/api/v1/challenges';
        const [scoreboard, challenges] = await Promise.all([
          fetchJson(scoreboardUrl, headers),
          fetchJson(challengesUrl, headers),
        ]);
        this.sendSocketNotification('CTFd_DATA', { scoreboard, challenges });
      } catch (err) {
        console.error('fetch error:', err && err.message);
        this.sendSocketNotification('CTFd_ERROR', { message: err.message });
      }
    }
  },
});
