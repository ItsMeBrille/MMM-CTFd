Module.register("MMM-CTFd", {
  defaults: {
    CTFd_URL: "https://demo.ctfd.io", // CTFd instance URL
    CTFd_token: "",                   // CTFd API token
    updateInterval: 180,              // seconds between refreshes (3 minutes)
    showTop: 10,                      // max leaderboard rows
    showCategories: true,             // show stacked category bars
    showFirstBloods: false,           // show first blood indicator
    showStats: false,                 // show the three stat boxes
    username: "",                     // username to always include on leaderboard
  },

  start: function () {
    this.standings = [];
    this.challenges = [];
    this.loaded = false;

    // Ask node_helper to fetch data (avoids CORS)
    this.sendSocketNotification("GET_CTFd", this.config);
    this.scheduleUpdate();
  },

  getStyles: function () {
    return ["MMM-CTFd.css"];
  },

  scheduleUpdate: function () {
    const self = this;
    setInterval(function () {
      self.sendSocketNotification("GET_CTFd", self.config);
    }, this.config.updateInterval * 1000);
  },

  // Receive data from node_helper
  socketNotificationReceived: function (notification, payload) {
    if (notification === "CTFd_DATA") {
      if (!payload) return;
      try {
        const scoreboardJson = payload.scoreboard;
        const challengesJson = payload.challenges;
        if (!scoreboardJson || !challengesJson) return;
        if (!scoreboardJson.success || !challengesJson.success) return;

        this.standings = Object.values(scoreboardJson.data);
        this.challenges = challengesJson.data;
        this.processData();
        this.loaded = true;
        this.updateDom(300);
      } catch (e) {
        console.error("Invalid data from node_helper", e);
      }
    }
    if (notification === "CTFd_ERROR") {
      console.error("node_helper error", payload);
    }
  },

  processData: function () {
    const standings = this.standings;
    const challenges = this.challenges;

    // Category colours
    const categoryColors = {};
    const cats = [...new Set(challenges.map((c) => c.category))];
    cats.forEach((cat) => {
      let hash = 0;
      for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
      categoryColors[cat] = "hsl(" + ((hash * 42) % 360) + ", 65%, 55%)";
    });
    this.categoryColors = categoryColors;

    // Category total points
    const categoryTotals = {};
    challenges.forEach((c) => {
      categoryTotals[c.category] = (categoryTotals[c.category] || 0) + c.value;
    });
    this.categoryTotals = categoryTotals;

    // First bloods per user
    const firstBloods = {};
    challenges.forEach((c) => {
      if (c.solves > 0) {
        const solved = standings.flatMap((s) => s.solves.filter((sol) => sol.challenge_id === c.id));
        if (solved.length > 0) {
          solved.sort((a, b) => new Date(a.date) - new Date(b.date));
          const fbUser = standings.find((s) => s.id === solved[0].account_id);
          if (fbUser) firstBloods[fbUser.name] = (firstBloods[fbUser.name] || 0) + 1;
        }
      }
    });
    this.firstBloods = firstBloods;

    // All solves for log & stats
    const allSolves = [];
    standings.forEach((account) => {
      account.solves.forEach((s) => {
        const ch = challenges.find((c) => c.id === s.challenge_id);
        if (ch) {
          const solved = standings.flatMap((st) => st.solves.filter((sol) => sol.challenge_id === ch.id));
          const firstSolve = solved.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
          const isFirstBlood = firstSolve.account_id === account.id;
          allSolves.push({
            user: account.name,
            challenge: ch.name,
            date: new Date(s.date),
            firstBlood: isFirstBlood,
            points: s.value,
          });
        }
      });
    });
    allSolves.sort((a, b) => b.date - a.date);
    this.allSolves = allSolves;

    // Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const solvesToday = allSolves.filter((s) => s.date >= today).length;
    const solvesLast7 = allSolves.filter((s) => s.date >= sevenDaysAgo);
    const solvesByUser = {};
    solvesLast7.forEach((s) => {
      solvesByUser[s.user] = (solvesByUser[s.user] || 0) + 1;
    });
    const mostUser = Object.entries(solvesByUser).sort((a, b) => b[1] - a[1])[0];

    const last15 = allSolves.slice(0, 15);
    const pointsByUser = {};
    last15.forEach((s) => {
      pointsByUser[s.user] = (pointsByUser[s.user] || 0) + s.points;
    });
    const fastest = Object.entries(pointsByUser).sort((a, b) => b[1] - a[1])[0];

    this.stats = {
      solvesToday: solvesToday,
      totalSolves: allSolves.length,
      topWeek: mostUser ? mostUser[0] + " (" + mostUser[1] + ")" : "–",
      fastest: fastest ? fastest[0] : "–",
    };
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "mmm-ctfd";

    if (!this.loaded) {
      wrapper.innerHTML = '<div class="dimmed small">Laster CTFd-resultater…</div>';
      return wrapper;
    }
    const sorted = (this.standings || []).slice().sort((a,b)=> (b.score||0) - (a.score||0));
    const maxScore = Math.max(...sorted.map((s) => s.score), 1);

    // Build displayed list: top N, but force-include a configured username if present
    let display = sorted.slice(0, this.config.showTop);
    const forced = (this.config.username || '').toString().trim();
    if (forced) {
      const forcedEntry = sorted.find(s => (s.name && s.name.toString().toLowerCase() === forced.toLowerCase()) || (s.id && s.id.toString() === forced));
      if (forcedEntry && !display.find(d => d.id === forcedEntry.id)) {
        // ensure we include top (showTop-1) + forced
        display = sorted.slice(0, Math.max(0, this.config.showTop-1));
        display.push(forcedEntry);
      }
    }

    const table = document.createElement("div");
    table.className = "ctfd-table";
    if (!this.config.showCategories) table.classList.add('no-bars');

    display.forEach((s, idx) => {
      const categoryPoints = {};
      s.solves.forEach((sol) => {
        const ch = this.challenges.find((c) => c.id === sol.challenge_id);
        if (ch) categoryPoints[ch.category] = (categoryPoints[ch.category] || 0) + sol.value;
      });

      const accountedPoints = Object.values(categoryPoints).reduce((a, b) => a + b, 0);
      const achievementPoints = s.score - accountedPoints;
      const bloodDisplay = (this.config.showFirstBloods && this.firstBloods && this.firstBloods[s.name]) ? ` 🩸×${this.firstBloods[s.name]}` : '';

      const row = document.createElement("div");
      row.className = "ctfd-row";

      const nameEl = document.createElement("div");
      nameEl.className = "ctfd-cell ctfd-name";

      // Determine real rank for display when forced user is shown
      const realRank = sorted.findIndex(x => x.id === s.id) + 1;
      const isForced = forced && ((s.name && s.name.toString().toLowerCase() === forced.toLowerCase()) || (s.id && s.id.toString() === forced));
      if (isForced) {
        row.classList.add('ctfd-highlight');
        nameEl.innerHTML = `<span class="ctfd-muted-rank">#${realRank}</span> <strong>${this.truncate(s.name, 24)}</strong>${bloodDisplay}`;
      } else {
        nameEl.textContent = this.truncate(s.name, 24) + bloodDisplay;
      }

      const scoreEl = document.createElement("div");
      scoreEl.className = "ctfd-cell ctfd-score";
      scoreEl.textContent = s.score;

      let barContainer = null;
      let barInner = null;
      if (this.config.showCategories) {
        barContainer = document.createElement("div");
        barContainer.className = "ctfd-cell ctfd-bar";
        barInner = document.createElement("div");
        barInner.className = "ctfd-lb-bar-container";
        
        Object.entries(categoryPoints)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([cat, pts]) => {
            const seg = document.createElement("div");
            seg.className = "ctfd-lb-bar-seg";
            seg.style.width = ((pts / maxScore) * 100).toFixed(2) + "%";
            seg.style.backgroundColor = this.categoryColors ? this.categoryColors[cat] : '#666';
            seg.title = cat + ": " + pts + " pts";
            barInner.appendChild(seg);
          });
      }

      if (this.config.showCategories && achievementPoints > 0) {
          const seg = document.createElement("div");
          seg.className = "ctfd-lb-bar-seg";
          seg.style.width = ((achievementPoints / maxScore) * 100).toFixed(2) + "%";
          seg.style.backgroundColor = "#333";
          seg.title = "Hidden/achievement: " + achievementPoints + " pts";
          barInner.appendChild(seg);
      }
      barContainer.appendChild(barInner);

      row.appendChild(nameEl);
      row.appendChild(scoreEl);
      if (this.config.showCategories) row.appendChild(barContainer);

      table.appendChild(row);
    });

    wrapper.appendChild(table);

    // Stat boxes (optional)
    if (this.config.showStats) {
      const statsBox = document.createElement('div');
      statsBox.className = 'ctfd-stat-boxes';

      // Determine "today" vs "last hour" for first stat
      const now = new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // If competition first solve happened today, show last hour count
      let firstSolve = null;
      if (this.allSolves && this.allSolves.length > 0) {
        firstSolve = this.allSolves[this.allSolves.length - 1].date; // earliest
      }

      const statSolvesLabel = (firstSolve && firstSolve >= todayStart) ? 'Siste time' : 'Løst i dag';
      const statSolvesValue = (firstSolve && firstSolve >= todayStart)
        ? this.allSolves.filter(s => s.date >= oneHourAgo).length
        : this.allSolves.filter(s => s.date >= todayStart).length;

      const statTotalLabel = 'Oppgaver løst totalt';
      const statTotalValue = this.stats ? this.stats.totalSolves : this.allSolves.length;

      const statTopLabel = 'Ukas toppspiller';
      const statTopValue = this.stats ? this.stats.topWeek : '–';

      const makeBox = (label, value) => {
        const el = document.createElement('div');
        el.className = 'ctfd-stat-box';
        el.innerHTML = `<div class="ctfd-stat-box-label">${label}</div><div class="ctfd-stat-box-value">${value}</div>`;
        return el;
      };

      statsBox.appendChild(makeBox(statSolvesLabel, statSolvesValue));
      statsBox.appendChild(makeBox(statTotalLabel, statTotalValue));
      statsBox.appendChild(makeBox(statTopLabel, statTopValue));

      wrapper.appendChild(statsBox);
    }

    return wrapper;
  },

  truncate: function (str, len) {
    return str.length > len ? str.substring(0, len - 1) + "…" : str;
  },
});
