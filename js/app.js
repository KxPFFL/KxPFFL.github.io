/* ── Data Loading ── */
let teamsData = [];
let scheduleData = [];
let gamesData = [];

async function loadData() {
  const [teamsRes, scheduleRes, gamesRes] = await Promise.all([
    fetch('data/teams.json'),
    fetch('data/schedule.json'),
    fetch('data/games.json')
  ]);
  teamsData = await teamsRes.json();
  scheduleData = await scheduleRes.json();
  gamesData = await gamesRes.json();
}

function getTeam(id) {
  return teamsData.find(t => t.id === id);
}

function teamLogo(team, size) {
  size = size || 28;
  return `<img class="team-logo" src="${team.logo}" alt="${team.name}" style="width:${size}px; height:${size}px;">`;
}

function getSortedStandings() {
  return [...teamsData].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });
}

/* ── Standings ── */
function renderStandings(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = getSortedStandings();
  const hasStats = sorted.some(t => t.wins > 0 || t.losses > 0 || t.ties > 0);

  let html = `
    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>W</th>
          <th>L</th>
          <th>T</th>
          <th>PF</th>
          <th>PA</th>
          <th>+/-</th>
        </tr>
      </thead>
      <tbody>
  `;

  sorted.forEach((team, i) => {
    const diff = team.pointsFor - team.pointsAgainst;
    html += `
      <tr onclick="navigateToTeam('${team.id}')">
        <td>${i + 1}</td>
        <td>
          <div class="team-name-cell">
            ${teamLogo(team, 28)}
            ${team.name}
          </div>
        </td>
        <td class="record-win">${team.wins}</td>
        <td class="record-loss">${team.losses}</td>
        <td>${team.ties}</td>
        <td>${team.pointsFor}</td>
        <td>${team.pointsAgainst}</td>
        <td style="color:${diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)'}">
          ${diff > 0 ? '+' : ''}${diff}
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  if (!hasStats) {
    html += '<p style="color:var(--text-muted); text-align:center; margin-top:1rem; font-size:0.9rem;">Season starts soon — standings will update after Week 1.</p>';
  }

  container.innerHTML = html;
}

/* ── Schedule ── */
let scheduleFilterTeam = 'all';

function filterScheduleByTeam(teamId) {
  scheduleFilterTeam = teamId;
  renderSchedule('schedule');
}

function populateTeamFilter() {
  const select = document.getElementById('team-filter');
  if (!select) return;
  const sorted = [...teamsData].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
  select.value = scheduleFilterTeam;
}

function renderSchedule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '';
  scheduleData.forEach(week => {
    const date = new Date(week.date + 'T00:00:00');
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    html += `
      <div class="schedule-week">
        <div class="week-header">
          <h3>Week ${week.week}</h3>
          <span class="week-date">${dateStr}</span>
        </div>
    `;

    if (week.tbd || week.games.length === 0) {
      html += `<div class="game-card tbd-week"><div class="tbd-note">${week.note || 'Matchups TBD'}</div></div>`;
      html += '</div>';
      return;
    }

    const visibleGames = scheduleFilterTeam === 'all'
      ? week.games
      : week.games.filter(g => g.home === scheduleFilterTeam || g.away === scheduleFilterTeam);

    if (visibleGames.length === 0) {
      html += `<div class="game-card tbd-week"><div class="tbd-note">Bye Week</div></div>`;
      html += '</div>';
      return;
    }

    visibleGames.forEach(game => {
      const home = getTeam(game.home);
      const away = getTeam(game.away);
      const played = game.homeScore !== null;
      const noContest = !!game.noContest;
      const forfeit = !!game.forfeit;
      const friendly = !!game.friendly;
      let homeWon = played && game.homeScore > game.awayScore;
      let awayWon = played && game.awayScore > game.homeScore;
      if (forfeit && game.forfeitWinner) {
        homeWon = game.forfeitWinner === 'home';
        awayWon = game.forfeitWinner === 'away';
      } else if (forfeit && !game.forfeitWinner) {
        homeWon = true;
        awayWon = false;
      }
      // No W/L badges for friendly games unless one side was awarded the win
      let homeBadge = '', awayBadge = '';
      if (friendly) {
        if (game.awardWinTo === 'home') homeBadge = '<span class="result-badge result-win">W</span>';
        if (game.awardWinTo === 'away') awayBadge = '<span class="result-badge result-win">W</span>';
      } else {
        homeBadge = homeWon ? '<span class="result-badge result-win">W</span>'
                   : awayWon ? '<span class="result-badge result-loss">L</span>' : '';
        awayBadge = awayWon ? '<span class="result-badge result-win">W</span>'
                   : homeWon ? '<span class="result-badge result-loss">L</span>' : '';
      }

      let scoreHtml;
      if (noContest) {
        scoreHtml = `<span class="no-contest-badge">No Contest</span>`;
      } else if (forfeit) {
        const hasScore = (game.homeScore || 0) + (game.awayScore || 0) > 0;
        scoreHtml = hasScore
          ? `<div class="score">${game.homeScore} - ${game.awayScore}</div><span class="forfeit-badge">Forfeit</span>`
          : `<span class="forfeit-badge">Forfeit</span>`;
      } else if (friendly) {
        scoreHtml = `<span class="friendly-badge">Friendly</span>`;
      } else if (played) {
        scoreHtml = `<div class="score">${game.homeScore} - ${game.awayScore}</div>`;
      } else {
        scoreHtml = `<span class="upcoming-badge">Upcoming</span>`;
      }

      // Friendly games have stats — allow box score
      const showBoxScore = (played && !forfeit) || friendly;
      const isUpcoming = !played && !noContest && !forfeit && !friendly;
      let cardClickAttr = '';
      if (showBoxScore) {
        cardClickAttr = `onclick="showGameDetail(${week.week}, '${game.home}', '${game.away}')" style="cursor:pointer;"`;
      } else if (isUpcoming) {
        cardClickAttr = `onclick="showMatchInsights(${week.week}, '${game.home}', '${game.away}')" style="cursor:pointer;"`;
      }

      html += `
        <div class="game-card ${played ? 'game-played' : ''} ${noContest ? 'game-no-contest' : ''} ${forfeit ? 'game-forfeit' : ''} ${friendly ? 'game-friendly' : ''}" ${cardClickAttr}>
          <div class="game-team">
            ${teamLogo(home, 32)}
            <span>${home.name}</span>
            ${homeBadge}
          </div>
          <div class="game-score">
            ${scoreHtml}
            <div class="game-time">${game.time} &middot; ${game.location}</div>
            ${noContest ? `<div class="no-contest-reason">${game.noContestReason || ''}</div>` : ''}
            ${forfeit ? `<div class="no-contest-reason">${game.forfeitReason || ''}</div>` : ''}
            ${friendly ? `<div class="no-contest-reason">${game.friendlyNote || 'Friendly game — stats only'}</div>` : ''}
          </div>
          <div class="game-team away">
            ${awayBadge}
            <span>${away.name}</span>
            ${teamLogo(away, 32)}
          </div>
          ${showBoxScore ? '<div class="game-expand-hint">View Box Score</div>' : ''}
          ${isUpcoming ? '<div class="game-expand-hint hint-preview">Match Preview &rarr;</div>' : ''}
        </div>
      `;
    });

    html += '</div>';
  });

  container.innerHTML = html;
}

/* ── Game Detail / Box Score Modal ── */
function showGameDetail(week, homeId, awayId) {
  const game = gamesData.find(g => g.week === week && g.home === homeId && g.away === awayId);
  if (!game) return;

  const homeTeam = getTeam(homeId);
  const awayTeam = getTeam(awayId);
  if (!homeTeam || !awayTeam) return;

  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;
  const tied = game.homeScore === game.awayScore;

  const content = document.getElementById('game-detail-content');

  let html = `
    <div class="boxscore-header">
      <div class="boxscore-matchup">
        <div class="boxscore-team ${homeWon ? 'winner' : ''}">
          ${teamLogo(homeTeam, 48)}
          <div class="boxscore-team-info">
            <div class="boxscore-team-name">${homeTeam.name}</div>
            <div class="boxscore-team-record">${homeTeam.wins}W - ${homeTeam.losses}L - ${homeTeam.ties}T</div>
          </div>
        </div>
        <div class="boxscore-final">
          <div class="boxscore-scores">
            <span class="boxscore-pts ${homeWon ? 'winning' : ''}">${game.homeScore}</span>
            <span class="boxscore-divider">-</span>
            <span class="boxscore-pts ${awayWon ? 'winning' : ''}">${game.awayScore}</span>
          </div>
          <div class="boxscore-label">FINAL</div>
        </div>
        <div class="boxscore-team ${awayWon ? 'winner' : ''}">
          <div class="boxscore-team-info" style="text-align:right;">
            <div class="boxscore-team-name">${awayTeam.name}</div>
            <div class="boxscore-team-record">${awayTeam.wins}W - ${awayTeam.losses}L - ${awayTeam.ties}T</div>
          </div>
          ${teamLogo(awayTeam, 48)}
        </div>
      </div>
      <div class="boxscore-meta">Week ${game.week} &middot; ${new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  `;

  // Team stats summary
  const homeTotals = calcTeamTotals(game.homeStats);
  const awayTotals = calcTeamTotals(game.awayStats);

  const homeTotalTDs = homeTotals.rushTDs + homeTotals.recTDs + homeTotals.defTDs;
  const awayTotalTDs = awayTotals.rushTDs + awayTotals.recTDs + awayTotals.defTDs;

  html += `
    <div class="boxscore-summary">
      <div class="summary-row summary-header">
        <span class="summary-val">${homeTeam.name}</span>
        <span class="summary-label">Team Stats</span>
        <span class="summary-val">${awayTeam.name}</span>
      </div>
      ${summaryRow(homeTotals.passYards, 'Pass Yards', awayTotals.passYards)}
      ${summaryRow(homeTotals.passTDs, 'Pass TDs', awayTotals.passTDs)}
      ${summaryRow(homeTotals.rushYards, 'Rush Yards', awayTotals.rushYards)}
      ${summaryRow(homeTotals.rushTDs, 'Rush TDs', awayTotals.rushTDs)}
      ${summaryRow(homeTotals.recTDs, 'Rec TDs', awayTotals.recTDs)}
      ${summaryRow(homeTotals.defTDs, 'Def TDs', awayTotals.defTDs)}
      ${summaryRow(homeTotalTDs, 'Total TDs', awayTotalTDs)}
      ${summaryRow(homeTotals.interceptions, 'INTs Thrown', awayTotals.interceptions)}
      ${summaryRow(homeTotals.defInts, 'Def INTs', awayTotals.defInts)}
      ${summaryRow(homeTotals.pbu, 'PBU', awayTotals.pbu)}
      ${summaryRow(homeTotals.sacks, 'Sacks', awayTotals.sacks)}
      ${summaryRow(homeTotals.flagPulls, 'Flag Pulls', awayTotals.flagPulls)}
    </div>
  `;

  // Player stats tables
  html += renderBoxScoreTable(homeTeam, game.homeStats);
  html += renderBoxScoreTable(awayTeam, game.awayStats);

  content.innerHTML = html;

  const overlay = document.getElementById('game-detail-overlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function calcTeamTotals(players) {
  const totals = {
    passComp: 0, passAtt: 0, passYards: 0, passTDs: 0, interceptions: 0,
    rushAtt: 0, rushYards: 0, rushTDs: 0,
    receptions: 0, recYards: 0, recTDs: 0,
    defInts: 0, defTDs: 0, pbu: 0, sacks: 0, flagPulls: 0
  };
  players.forEach(p => {
    for (const key of Object.keys(totals)) {
      totals[key] += p[key] || 0;
    }
  });
  return totals;
}

function summaryRow(homeVal, label, awayVal) {
  const hClass = homeVal > awayVal ? 'highlight' : '';
  const aClass = awayVal > homeVal ? 'highlight' : '';
  return `
    <div class="summary-row">
      <span class="summary-val ${hClass}">${homeVal}</span>
      <span class="summary-label">${label}</span>
      <span class="summary-val ${aClass}">${awayVal}</span>
    </div>
  `;
}

function renderBoxScoreTable(team, players) {
  const dash = v => (v || 0) > 0 ? v : '-';

  let html = `
    <div class="boxscore-roster">
      <div class="boxscore-roster-header">
        ${teamLogo(team, 24)}
        <span>${team.name}</span>
      </div>
      <div class="boxscore-table-wrap">
        <table class="boxscore-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>POS</th>
              <th>C/Att</th>
              <th>Pass YDs</th>
              <th>Pass TD</th>
              <th>INT</th>
              <th>Rush Att</th>
              <th>Rush YDs</th>
              <th>Rush TD</th>
              <th>Rec</th>
              <th>Rec YDs</th>
              <th>Rec TD</th>
              <th>Def INT</th>
              <th>Def TD</th>
              <th>PBU</th>
              <th>Sacks</th>
              <th>Flag Pulls</th>
            </tr>
          </thead>
          <tbody>
  `;

  players.forEach(p => {
    const total = (p.passYards||0)+(p.passTDs||0)+(p.interceptions||0)+(p.rushYards||0)+
                  (p.rushTDs||0)+(p.receptions||0)+(p.recYards||0)+(p.recTDs||0)+
                  (p.defInts||0)+(p.defTDs||0)+(p.pbu||0)+(p.sacks||0)+(p.flagPulls||0);
    const compAtt = (p.passAtt||0) > 0 ? `${p.passComp||0}/${p.passAtt}` : '-';
    const playerArgs = `'${team.id}', ${p.number}, ${JSON.stringify(p.name).replace(/"/g, '&quot;')}`;
    html += `
      <tr class="clickable-player ${total > 0 ? '' : 'no-stats'}" onclick="event.stopPropagation(); showPlayerInsights(${playerArgs})">
        <td class="player-number">${p.number}</td>
        <td class="player-name">${p.name}</td>
        <td>${p.position}</td>
        <td>${compAtt}</td>
        <td>${dash(p.passYards)}</td>
        <td class="${(p.passTDs||0) > 0 ? 'stat-highlight' : ''}">${dash(p.passTDs)}</td>
        <td>${dash(p.interceptions)}</td>
        <td>${dash(p.rushAtt)}</td>
        <td>${dash(p.rushYards)}</td>
        <td class="${(p.rushTDs||0) > 0 ? 'stat-highlight' : ''}">${dash(p.rushTDs)}</td>
        <td>${dash(p.receptions)}</td>
        <td>${dash(p.recYards)}</td>
        <td class="${(p.recTDs||0) > 0 ? 'stat-highlight' : ''}">${dash(p.recTDs)}</td>
        <td class="${(p.defInts||0) > 0 ? 'stat-highlight' : ''}">${dash(p.defInts)}</td>
        <td class="${(p.defTDs||0) > 0 ? 'stat-highlight' : ''}">${dash(p.defTDs)}</td>
        <td>${dash(p.pbu)}</td>
        <td class="${(p.sacks||0) > 0 ? 'stat-highlight' : ''}">${dash(p.sacks)}</td>
        <td>${dash(p.flagPulls)}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div></div>';
  return html;
}

function closeGameDetail(event) {
  if (event && event.target !== event.currentTarget) return;
  const overlay = document.getElementById('game-detail-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ── Teams Page ── */
function renderTeamCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = getSortedStandings();
  let html = '';
  sorted.forEach(team => {
    html += `
      <div class="team-card" onclick="showTeamDetail('${team.id}')">
        <div class="team-card-header">
          ${teamLogo(team, 40)}
          <h3>${team.name}</h3>
        </div>
        <p class="team-record">${team.wins}W - ${team.losses}L - ${team.ties}T &middot; PF ${team.pointsFor} / PA ${team.pointsAgainst}</p>
      </div>
    `;
  });
  container.innerHTML = html;
}

function showTeamDetail(teamId) {
  const team = getTeam(teamId);
  const detail = document.getElementById('team-detail');
  if (!team || !detail) return;

  const hasRoster = team.roster && team.roster.length > 0;
  const hasStats = team.roster && team.roster.some(p =>
    p.passYards > 0 || p.passTDs > 0 || p.passComp > 0 || p.rushYards > 0 || p.rushTDs > 0 ||
    p.receptions > 0 || p.recYards > 0 || p.recTDs > 0 ||
    p.defInts > 0 || p.defTDs > 0 || p.pbu > 0 || p.sacks > 0 || p.flagPulls > 0
  );

  let html = `
    <div class="team-detail-header">
      ${teamLogo(team, 48)}
      <h2>${team.name}</h2>
      <span class="detail-record">${team.wins}W - ${team.losses}L - ${team.ties}T</span>
      <button class="close-detail" onclick="hideTeamDetail()">Close</button>
    </div>
  `;

  if (hasRoster) {
    html += `
      <div style="overflow-x:auto">
      <table class="roster-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Pos</th>
            ${hasStats ? `
              <th>C/Att</th>
              <th>Pass Yds</th>
              <th>Pass TD</th>
              <th>INT</th>
              <th>Rush Att</th>
              <th>Rush Yds</th>
              <th>Rush TD</th>
              <th>Rec</th>
              <th>Rec Yds</th>
              <th>Rec TD</th>
              <th>Def INT</th>
              <th>Def TD</th>
              <th>PBU</th>
              <th>Sacks</th>
              <th>Flag Pulls</th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
    `;

    team.roster.forEach(p => {
      const compAtt = (p.passAtt || 0) > 0 ? `${p.passComp || 0}/${p.passAtt}` : '-';
      const playerArgs = `'${team.id}', ${p.number}, ${JSON.stringify(p.name).replace(/"/g, '&quot;')}`;
      html += `
        <tr class="clickable-player" onclick="showPlayerInsights(${playerArgs})">
          <td class="player-number">${p.number}</td>
          <td class="player-name">${p.name}</td>
          <td>${p.position}</td>
          ${hasStats ? `
            <td>${compAtt}</td>
            <td>${p.passYards || '-'}</td>
            <td>${p.passTDs || '-'}</td>
            <td>${p.interceptions || '-'}</td>
            <td>${p.rushAtt || '-'}</td>
            <td>${p.rushYards || '-'}</td>
            <td>${p.rushTDs || '-'}</td>
            <td>${p.receptions || '-'}</td>
            <td>${p.recYards || '-'}</td>
            <td>${p.recTDs || '-'}</td>
            <td>${p.defInts || '-'}</td>
            <td>${p.defTDs || '-'}</td>
            <td>${p.pbu || '-'}</td>
            <td>${p.sacks || '-'}</td>
            <td>${p.flagPulls || '-'}</td>
          ` : ''}
        </tr>
      `;
    });

    html += '</tbody></table></div>';

    if (!hasStats) {
      html += '<p style="color:var(--text-muted); margin-top:1rem; font-size:0.9rem;">Stats will appear once the season begins.</p>';
    }

    // Team game log
    html += renderTeamGameLog(team);
  } else {
    html += '<p style="color:var(--text-muted); padding:1rem 0;">Roster coming soon.</p>';
  }

  detail.innerHTML = html;
  detail.classList.add('active');
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideTeamDetail() {
  const detail = document.getElementById('team-detail');
  if (detail) detail.classList.remove('active');
}

/* ── Navigation ── */
function navigateToTeam(teamId) {
  window.location.href = `teams.html?team=${teamId}`;
}

function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ── Mobile Nav ── */
function toggleMobileNav() {
  document.querySelector('.nav-links').classList.toggle('open');
}

/* ── Stat Leaders ── */
let leaderMode = 'player';

function setLeaderMode(mode) {
  leaderMode = mode;
  document.querySelectorAll('.leader-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderLeaders('leaders');
}

function renderLeaders(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Flatten all players with team info
  const allPlayers = [];
  teamsData.forEach(team => {
    team.roster.forEach(player => {
      allPlayers.push({ ...player, teamId: team.id, teamName: team.name, teamLogo: team.logo });
    });
  });

  // Check if any stats yet
  const hasAnyStats = allPlayers.some(p =>
    p.passYards > 0 || p.passTDs > 0 || p.passComp > 0 || p.rushYards > 0 || p.rushTDs > 0 ||
    p.receptions > 0 || p.recYards > 0 || p.recTDs > 0 ||
    p.defInts > 0 || p.defTDs > 0 || p.pbu > 0 || p.sacks > 0 || p.flagPulls > 0
  );

  if (!hasAnyStats) {
    container.innerHTML = '<div class="no-stats-message"><p>Stat leaders will appear here once the season kicks off.</p><p style="font-size:0.85rem; margin-top:0.5rem;">Check back after Week 1!</p></div>';
    return;
  }

  if (leaderMode === 'team') {
    container.innerHTML = renderTeamLeaders();
  } else {
    container.innerHTML = renderPlayerLeaders(allPlayers);
  }
}

function renderPlayerLeaders(allPlayers) {
  const categories = [
    { key: 'passYards', label: 'Passing Yards', icon: 'QBs' },
    { key: 'passTDs', label: 'Passing TDs', icon: 'QBs' },
    {
      key: 'compPct', label: 'Completion %', icon: 'QBs',
      compute: p => (p.passAtt || 0) > 0 ? (p.passComp / p.passAtt) * 100 : 0,
      filter: p => (p.passAtt || 0) >= 11,
      format: v => v.toFixed(1) + '%',
      meta: p => `${p.passComp}/${p.passAtt}`
    },
    { key: 'passComp', label: 'Pass Completions', icon: 'QBs' },
    { key: 'rushYards', label: 'Rushing Yards', icon: 'RBs' },
    { key: 'rushTDs', label: 'Rushing TDs', icon: 'RBs' },
    { key: 'receptions', label: 'Receptions', icon: 'WRs' },
    { key: 'recYards', label: 'Receiving Yards', icon: 'WRs' },
    { key: 'recTDs', label: 'Receiving TDs', icon: 'WRs' },
    { key: 'defTDs', label: 'Defensive TDs', icon: 'DEF' },
    { key: 'defInts', label: 'Defensive INTs', icon: 'DBs' },
    { key: 'pbu', label: 'Pass Breakups', icon: 'DBs' },
    { key: 'sacks', label: 'Sacks', icon: 'DL' },
    { key: 'flagPulls', label: 'Flag Pulls', icon: 'DEF' }
  ];

  let html = '';
  categories.forEach(cat => {
    const getValue = p => cat.compute ? cat.compute(p) : (p[cat.key] || 0);
    const passesFilter = p => cat.filter ? cat.filter(p) : getValue(p) > 0;

    const sorted = [...allPlayers]
      .filter(passesFilter)
      .sort((a, b) => getValue(b) - getValue(a))
      .slice(0, 10);

    if (sorted.length === 0) return;

    html += `
      <div class="leader-category">
        <div class="leader-category-header">
          <span class="stat-icon">${cat.icon}</span>
          ${cat.label}
        </div>
    `;

    sorted.forEach((p, i) => {
      const value = getValue(p);
      const displayValue = cat.format ? cat.format(value) : value;
      const metaExtra = cat.meta ? ` &middot; ${cat.meta(p)}` : '';
      const playerArgs = `'${p.teamId}', ${p.number}, ${JSON.stringify(p.name).replace(/"/g, '&quot;')}`;
      html += `
        <div class="leader-row clickable-player" onclick="showPlayerInsights(${playerArgs})">
          <span class="leader-rank ${i < 3 ? 'top-3' : ''}">${i + 1}</span>
          <img class="team-logo" src="${p.teamLogo}" alt="${p.teamName}" style="width:22px; height:22px; margin-right:8px;">
          <div class="leader-info">
            <div class="leader-name">${p.name}</div>
            <div class="leader-meta">
              ${p.teamName} &middot; #${p.number} &middot; ${p.position}${metaExtra}
            </div>
          </div>
          <span class="leader-value">${displayValue}</span>
        </div>
      `;
    });
    html += '</div>';
  });
  return html;
}

let teamLeadersCache = { teams: [], sections: [] };

function renderTeamLeaders() {
  // Compute team-level aggregates from games.json (per-game stats)
  const teamStats = {};
  teamsData.forEach(t => {
    teamStats[t.id] = {
      teamId: t.id, teamName: t.name, teamLogo: t.logo,
      gamesPlayed: 0,
      passYards: 0, rushYards: 0, sacks: 0,
      defInts: 0, interceptions: 0,
      yardsAllowed: 0
    };
  });

  gamesData.forEach(g => {
    const homeAgg = teamStats[g.home];
    const awayAgg = teamStats[g.away];
    if (!homeAgg || !awayAgg) return;

    const sumStats = (statsArr) => {
      let pY = 0, rY = 0, s = 0, dI = 0, iT = 0;
      statsArr.forEach(p => {
        pY += p.passYards || 0;
        rY += p.rushYards || 0;
        s += p.sacks || 0;
        dI += p.defInts || 0;
        iT += p.interceptions || 0;
      });
      return { passYards: pY, rushYards: rY, sacks: s, defInts: dI, interceptions: iT };
    };

    const homeT = sumStats(g.homeStats);
    const awayT = sumStats(g.awayStats);

    homeAgg.gamesPlayed++;
    homeAgg.passYards += homeT.passYards;
    homeAgg.rushYards += homeT.rushYards;
    homeAgg.sacks += homeT.sacks;
    homeAgg.defInts += homeT.defInts;
    homeAgg.interceptions += homeT.interceptions;
    homeAgg.yardsAllowed += awayT.passYards + awayT.rushYards;

    awayAgg.gamesPlayed++;
    awayAgg.passYards += awayT.passYards;
    awayAgg.rushYards += awayT.rushYards;
    awayAgg.sacks += awayT.sacks;
    awayAgg.defInts += awayT.defInts;
    awayAgg.interceptions += awayT.interceptions;
    awayAgg.yardsAllowed += homeT.passYards + homeT.rushYards;
  });

  const teams = Object.values(teamStats).filter(t => t.gamesPlayed > 0);

  const sections = [
    {
      title: 'Offensive Leaders',
      categories: [
        {
          label: 'Total Yards', unit: 'YDS/G',
          compute: t => (t.passYards + t.rushYards) / t.gamesPlayed,
          format: v => v.toFixed(1),
          desc: true
        },
        {
          label: 'Passing', unit: 'YDS/G',
          compute: t => t.passYards / t.gamesPlayed,
          format: v => v.toFixed(1),
          desc: true
        },
        {
          label: 'Rushing', unit: 'YDS/G',
          compute: t => t.rushYards / t.gamesPlayed,
          format: v => v.toFixed(1),
          desc: true
        }
      ]
    },
    {
      title: 'Defensive Leaders',
      categories: [
        {
          label: 'Yards Allowed', unit: 'YDS/G',
          compute: t => t.yardsAllowed / t.gamesPlayed,
          format: v => v.toFixed(1),
          desc: false  // lower is better
        },
        {
          label: 'Sacks', unit: 'SACK',
          compute: t => t.sacks,
          format: v => v.toFixed(0),
          desc: true
        },
        {
          label: 'Turnovers', unit: 'DIFF',
          compute: t => t.defInts - t.interceptions,
          format: v => (v > 0 ? '+' : '') + v.toFixed(0),
          desc: true
        }
      ]
    }
  ];

  // Cache for the Complete Leaders modal
  teamLeadersCache = { teams, sections };

  let html = '<div class="team-leaders-wrap">';
  sections.forEach((section, sIdx) => {
    html += `<h3 class="team-leaders-section-title">${section.title}</h3>`;
    html += '<div class="team-leaders-grid">';
    section.categories.forEach((cat, cIdx) => {
      const sorted = [...teams].sort((a, b) => {
        const va = cat.compute(a), vb = cat.compute(b);
        return cat.desc ? vb - va : va - vb;
      }).slice(0, 5);

      html += `
        <div class="team-leader-card">
          <div class="team-leader-card-header">
            <span class="team-leader-stat-name">${cat.label}</span>
            <span class="team-leader-stat-unit">${cat.unit}</span>
          </div>
      `;

      sorted.forEach((t, i) => {
        const v = cat.compute(t);
        const displayValue = cat.format(v);
        html += `
          <div class="team-leader-row" onclick="navigateToTeam('${t.teamId}')">
            <span class="team-leader-rank">${i + 1}</span>
            <img class="team-leader-logo" src="${t.teamLogo}" alt="${t.teamName}">
            <span class="team-leader-name">${t.teamName}</span>
            <span class="team-leader-value">${displayValue}</span>
          </div>
        `;
      });

      html += `<a class="team-leader-complete" onclick="event.stopPropagation(); showTeamLeadersFullList(${sIdx}, ${cIdx})">Complete Leaders</a>`;
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function showTeamLeadersFullList(sectionIdx, catIdx) {
  const section = teamLeadersCache.sections[sectionIdx];
  const cat = section.categories[catIdx];
  const teams = teamLeadersCache.teams;
  const sorted = [...teams].sort((a, b) => {
    const va = cat.compute(a), vb = cat.compute(b);
    return cat.desc ? vb - va : va - vb;
  });

  // Ensure overlay exists
  let overlay = document.getElementById('team-leaders-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'team-leaders-overlay';
    overlay.className = 'team-leaders-overlay';
    overlay.innerHTML = '<div class="team-leaders-modal" id="team-leaders-modal"></div>';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeTeamLeadersFullList();
    });
    document.body.appendChild(overlay);
  }

  const modal = document.getElementById('team-leaders-modal');
  let html = `
    <button class="close-detail" onclick="closeTeamLeadersFullList()">&times;</button>
    <div class="team-leaders-modal-header">
      <div class="team-leaders-modal-title">${cat.label}</div>
      <div class="team-leaders-modal-sub">${section.title} &middot; ${cat.unit}</div>
    </div>
    <div class="team-leaders-modal-list">
  `;
  sorted.forEach((t, i) => {
    const v = cat.compute(t);
    const displayValue = cat.format(v);
    html += `
      <div class="team-leader-row" onclick="closeTeamLeadersFullList(); navigateToTeam('${t.teamId}')">
        <span class="team-leader-rank">${i + 1}</span>
        <img class="team-leader-logo" src="${t.teamLogo}" alt="${t.teamName}">
        <span class="team-leader-name">${t.teamName}</span>
        <span class="team-leader-value">${displayValue}</span>
      </div>
    `;
  });
  html += '</div>';
  modal.innerHTML = html;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeTeamLeadersFullList() {
  const overlay = document.getElementById('team-leaders-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ── Player Insights ── */
function findPlayer(teamId, number, name) {
  const team = getTeam(teamId);
  if (!team) return null;
  const player = team.roster.find(p => p.number === number && p.name === name);
  if (!player) return null;
  return { player, team };
}

function getAllLeaguePlayers() {
  const out = [];
  teamsData.forEach(t => t.roster.forEach(p => out.push({ ...p, _team: t })));
  return out;
}

function calculatePercentile(value, allValues) {
  if (allValues.length === 0) return 0;
  const lessThan = allValues.filter(v => v < value).length;
  const equal = allValues.filter(v => v === value).length;
  return Math.round(((lessThan + equal / 2) / allValues.length) * 100);
}

function getPlayerSkillPercentiles(player) {
  const allPlayers = getAllLeaguePlayers();
  const categories = [
    { key: 'Passing',   getVal: p => (p.passYards || 0) + (p.passTDs || 0) * 25 },
    { key: 'Rushing',   getVal: p => (p.rushYards || 0) + (p.rushTDs || 0) * 25 },
    { key: 'Receiving', getVal: p => (p.recYards || 0) + (p.recTDs || 0) * 25 },
    { key: 'Scoring',   getVal: p => (p.rushTDs || 0) + (p.recTDs || 0) + (p.defTDs || 0) },
    { key: 'Coverage',  getVal: p => (p.defInts || 0) * 2 + (p.pbu || 0) },
    { key: 'Pass Rush', getVal: p => p.sacks || 0 },
    { key: 'Tackling',  getVal: p => p.flagPulls || 0 },
  ];
  return categories.map(cat => {
    const playerValue = cat.getVal(player);
    const allValues = allPlayers.map(p => cat.getVal(p));
    return {
      name: cat.key,
      value: playerValue,
      percentile: calculatePercentile(playerValue, allValues)
    };
  });
}

function renderRadarChart(skills) {
  const size = 460;
  const center = size / 2;
  const maxRadius = 130;
  const n = skills.length;
  const angles = skills.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2);

  // Background rings (concentric polygons at 25, 50, 75, 100)
  const rings = [25, 50, 75, 100].map(pct => {
    const r = (pct / 100) * maxRadius;
    const points = angles.map(a => `${center + Math.cos(a) * r},${center + Math.sin(a) * r}`).join(' ');
    const fillClass = pct === 100 ? 'radar-ring-outer'
                     : pct === 75 ? 'radar-ring-75'
                     : pct === 50 ? 'radar-ring-50'
                     : 'radar-ring-25';
    return `<polygon points="${points}" class="radar-ring ${fillClass}" />`;
  }).join('');

  // Spokes
  const spokes = angles.map(a => {
    const x2 = center + Math.cos(a) * maxRadius;
    const y2 = center + Math.sin(a) * maxRadius;
    return `<line x1="${center}" y1="${center}" x2="${x2}" y2="${y2}" class="radar-spoke" />`;
  }).join('');

  // Player polygon
  const playerPoints = skills.map((s, i) => {
    const r = (Math.max(s.percentile, 3) / 100) * maxRadius;
    const a = angles[i];
    return `${center + Math.cos(a) * r},${center + Math.sin(a) * r}`;
  }).join(' ');

  // Dots at vertices
  const dots = skills.map((s, i) => {
    const r = (Math.max(s.percentile, 3) / 100) * maxRadius;
    const a = angles[i];
    return `<circle cx="${center + Math.cos(a) * r}" cy="${center + Math.sin(a) * r}" r="4" class="radar-dot" />`;
  }).join('');

  // Labels
  const labels = skills.map((s, i) => {
    const labelR = maxRadius + 40;
    const x = center + Math.cos(angles[i]) * labelR;
    const y = center + Math.sin(angles[i]) * labelR;
    return `
      <g transform="translate(${x},${y})">
        <text class="radar-label-name" text-anchor="middle">${s.name}</text>
        <text class="radar-label-pct" text-anchor="middle" dy="16">${ordinalSuffix(s.percentile)} Percentile</text>
      </g>
    `;
  }).join('');

  // Percentile markers (25, 50, 75, 100)
  const markers = [25, 50, 75, 100].map(pct => {
    const y = center - (pct / 100) * maxRadius;
    return `<text x="${center}" y="${y}" class="radar-marker" text-anchor="middle" dy="3">${pct} PCTL</text>`;
  }).join('');

  return `
    <svg class="radar-chart" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${rings}
      ${spokes}
      <polygon points="${playerPoints}" class="radar-player" />
      ${dots}
      ${markers}
      ${labels}
    </svg>
  `;
}

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderTeamGameLog(team) {
  // Get games involving this team
  const log = [];
  // Played games from games.json
  gamesData.forEach(g => {
    if (g.home !== team.id && g.away !== team.id) return;
    const isHome = g.home === team.id;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    const oppId = isHome ? g.away : g.home;
    const opponent = getTeam(oppId);
    if (!opponent || teamScore === null) return;
    const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'T';
    const teamStats = isHome ? g.homeStats : g.awayStats;
    const totals = calcTeamTotals(teamStats);
    const totalTDs = (totals.rushTDs || 0) + (totals.recTDs || 0) + (totals.defTDs || 0);
    log.push({
      week: g.week, opponent, teamScore, oppScore, result,
      totals, totalTDs
    });
  });
  // Forfeits / no contests from schedule
  scheduleData.forEach(wk => {
    (wk.games || []).forEach(g => {
      if (g.home !== team.id && g.away !== team.id) return;
      const isHome = g.home === team.id;
      const oppId = isHome ? g.away : g.home;
      const opponent = getTeam(oppId);
      if (!opponent) return;
      if (g.forfeit) {
        // Check if we already have this game from games.json
        if (log.some(l => l.week === wk.week && l.opponent.id === opponent.id)) return;
        const winnerSide = g.forfeitWinner || 'home';
        const result = ((isHome && winnerSide === 'home') || (!isHome && winnerSide === 'away')) ? 'W' : 'L';
        log.push({
          week: wk.week, opponent,
          teamScore: isHome ? (g.homeScore || 0) : (g.awayScore || 0),
          oppScore: isHome ? (g.awayScore || 0) : (g.homeScore || 0),
          result, isForfeit: true
        });
      } else if (g.noContest) {
        log.push({
          week: wk.week, opponent,
          teamScore: '—', oppScore: '—',
          result: 'L', isNoContest: true
        });
      }
    });
  });
  log.sort((a, b) => a.week - b.week);

  if (log.length === 0) {
    return '<h3 class="team-gamelog-title">Game Log</h3><p style="color:var(--text-muted);">No games played yet.</p>';
  }

  let html = '<h3 class="team-gamelog-title">Game Log</h3>';
  html += '<div style="overflow-x:auto"><table class="gamelog-table">';
  html += `
    <thead>
      <tr>
        <th>Wk</th>
        <th>Opponent</th>
        <th>Result</th>
        <th>Pass Yds</th>
        <th>Pass TD</th>
        <th>Rush Yds</th>
        <th>Rush TD</th>
        <th>Rec TD</th>
        <th>Total TD</th>
        <th>INT Thrown</th>
        <th>Def INT</th>
        <th>Def TD</th>
        <th>PBU</th>
        <th>Sacks</th>
        <th>Flag Pulls</th>
      </tr>
    </thead>
    <tbody>
  `;
  log.forEach(entry => {
    const resultClass = entry.result === 'W' ? 'result-win-cell' : entry.result === 'L' ? 'result-loss-cell' : '';
    if (entry.isNoContest) {
      html += `
        <tr>
          <td>${entry.week}</td>
          <td class="gamelog-opp"><div class="gamelog-opp-inner">
            <img class="team-logo" src="${entry.opponent.logo}" alt="" style="width:18px;height:18px;">
            <span>${entry.opponent.name}</span>
          </div></td>
          <td class="${resultClass}">No Contest</td>
          <td colspan="12" style="color:var(--text-muted); font-style:italic;">No stats recorded</td>
        </tr>
      `;
    } else if (entry.isForfeit) {
      html += `
        <tr>
          <td>${entry.week}</td>
          <td class="gamelog-opp"><div class="gamelog-opp-inner">
            <img class="team-logo" src="${entry.opponent.logo}" alt="" style="width:18px;height:18px;">
            <span>${entry.opponent.name}</span>
          </div></td>
          <td class="${resultClass}">${entry.result} (Forfeit)</td>
          <td colspan="12" style="color:var(--text-muted); font-style:italic;">No stats recorded</td>
        </tr>
      `;
    } else {
      const t = entry.totals;
      html += `
        <tr>
          <td>${entry.week}</td>
          <td class="gamelog-opp"><div class="gamelog-opp-inner">
            <img class="team-logo" src="${entry.opponent.logo}" alt="" style="width:18px;height:18px;">
            <span>${entry.opponent.name}</span>
          </div></td>
          <td class="${resultClass}">${entry.result} ${entry.teamScore}-${entry.oppScore}</td>
          <td>${t.passYards || '—'}</td>
          <td>${t.passTDs || '—'}</td>
          <td>${t.rushYards || '—'}</td>
          <td>${t.rushTDs || '—'}</td>
          <td>${t.recTDs || '—'}</td>
          <td>${entry.totalTDs || '—'}</td>
          <td>${t.interceptions || '—'}</td>
          <td>${t.defInts || '—'}</td>
          <td>${t.defTDs || '—'}</td>
          <td>${t.pbu || '—'}</td>
          <td>${t.sacks || '—'}</td>
          <td>${t.flagPulls || '—'}</td>
        </tr>
      `;
    }
  });
  html += '</tbody></table></div>';
  return html;
}

function getPlayerGameLog(player, teamId) {
  return gamesData
    .filter(g => g.home === teamId || g.away === teamId)
    .sort((a, b) => a.week - b.week)
    .map(g => {
      const isHome = g.home === teamId;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      const oppId = isHome ? g.away : g.home;
      const opponent = getTeam(oppId);
      const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'T';
      const stats = (isHome ? g.homeStats : g.awayStats).find(p =>
        p.name === player.name && p.number === player.number
      );
      return { week: g.week, date: g.date, opponent, teamScore, oppScore, result, stats, isHome };
    });
}

function showPlayerInsights(teamId, number, name) {
  const found = findPlayer(teamId, number, name);
  if (!found) return;
  const { player, team } = found;

  // Ensure overlay exists
  let overlay = document.getElementById('player-insights-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'player-insights-overlay';
    overlay.className = 'player-insights-overlay';
    overlay.innerHTML = '<div class="player-insights-modal" id="player-insights-modal"></div>';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePlayerInsights();
    });
    document.body.appendChild(overlay);
  }

  const modal = document.getElementById('player-insights-modal');
  const skills = getPlayerSkillPercentiles(player);
  const gameLog = getPlayerGameLog(player, team.id);

  const compAtt = (player.passAtt || 0) > 0 ? `${player.passComp || 0}/${player.passAtt}` : '—';
  const compPct = (player.passAtt || 0) > 0 ? `${((player.passComp / player.passAtt) * 100).toFixed(1)}%` : '—';
  const totalTDs = (player.rushTDs || 0) + (player.recTDs || 0) + (player.defTDs || 0);

  modal.innerHTML = `
    <button class="close-detail" onclick="closePlayerInsights()">×</button>
    <div class="player-insights-header">
      <img class="player-insights-logo" src="${team.logo}" alt="${team.name}">
      <div class="player-insights-title">
        <h2>${player.name}</h2>
        <div class="player-insights-meta">
          <span class="player-insights-num">#${player.number}</span>
          <span class="player-insights-pos">${player.position}</span>
          <span class="player-insights-team" onclick="navigateToTeam('${team.id}')">${team.name}</span>
        </div>
      </div>
    </div>

    <div class="player-insights-section-title">Season Stats</div>
    <div class="player-insights-summary-grid">
      ${seasonStatBlock('Pass Yards', player.passYards)}
      ${seasonStatBlock('Pass TDs', player.passTDs)}
      ${seasonStatBlock('Comp %', compPct, compAtt)}
      ${seasonStatBlock('Rush Yards', player.rushYards)}
      ${seasonStatBlock('Rush TDs', player.rushTDs)}
      ${seasonStatBlock('Receptions', player.receptions)}
      ${seasonStatBlock('Rec Yards', player.recYards)}
      ${seasonStatBlock('Rec TDs', player.recTDs)}
      ${seasonStatBlock('Total TDs', totalTDs)}
      ${seasonStatBlock('Def INTs', player.defInts)}
      ${seasonStatBlock('Def TDs', player.defTDs)}
      ${seasonStatBlock('Sacks', player.sacks)}
      ${seasonStatBlock('Flag Pulls', player.flagPulls)}
      ${seasonStatBlock('INTs Thrown', player.interceptions)}
    </div>

    <div class="player-insights-section-title">Player Skill Profile</div>
    <div class="player-insights-radar-wrap">
      ${renderRadarChart(skills)}
      <p class="radar-caption">Percentile ranking across all players in the league</p>
    </div>

    <div class="player-insights-section-title">Game Log</div>
    <div class="player-insights-gamelog">
      ${renderGameLogTable(gameLog)}
    </div>
  `;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function seasonStatBlock(label, value, sub) {
  const display = (value === undefined || value === null || value === 0 || value === '0') && label !== 'Comp %'
    ? '0' : (value === '—' ? '—' : value);
  return `
    <div class="player-stat-block">
      <div class="player-stat-value">${display}</div>
      <div class="player-stat-label">${label}</div>
      ${sub ? `<div class="player-stat-sub">${sub}</div>` : ''}
    </div>
  `;
}

function renderGameLogTable(games) {
  if (games.length === 0) {
    return '<p style="color:var(--text-muted);">No games played yet this season.</p>';
  }
  const played = games.filter(g => g.teamScore !== null);
  if (played.length === 0) {
    return '<p style="color:var(--text-muted);">No games played yet this season.</p>';
  }
  return `
    <div style="overflow-x:auto">
      <table class="gamelog-table">
        <thead>
          <tr>
            <th>Wk</th>
            <th>Opponent</th>
            <th>Result</th>
            <th>C/Att</th>
            <th>Pass Yds</th>
            <th>Pass TD</th>
            <th>Rush Yds</th>
            <th>Rush TD</th>
            <th>Rec</th>
            <th>Rec Yds</th>
            <th>Rec TD</th>
            <th>Def INT</th>
            <th>Def TD</th>
            <th>Sacks</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          ${played.map(g => {
            const s = g.stats || {};
            const compAtt = (s.passAtt || 0) > 0 ? `${s.passComp || 0}/${s.passAtt}` : '—';
            const resultClass = g.result === 'W' ? 'result-win-cell' : g.result === 'L' ? 'result-loss-cell' : '';
            return `
              <tr>
                <td>${g.week}</td>
                <td class="gamelog-opp">
                  <div class="gamelog-opp-inner">
                    <img class="team-logo" src="${g.opponent.logo}" alt="" style="width:18px;height:18px;">
                    <span>${g.opponent.name}</span>
                  </div>
                </td>
                <td class="${resultClass}">${g.result} ${g.teamScore}-${g.oppScore}</td>
                <td>${compAtt}</td>
                <td>${s.passYards || '—'}</td>
                <td>${s.passTDs || '—'}</td>
                <td>${s.rushYards || '—'}</td>
                <td>${s.rushTDs || '—'}</td>
                <td>${s.receptions || '—'}</td>
                <td>${s.recYards || '—'}</td>
                <td>${s.recTDs || '—'}</td>
                <td>${s.defInts || '—'}</td>
                <td>${s.defTDs || '—'}</td>
                <td>${s.sacks || '—'}</td>
                <td>${s.flagPulls || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function closePlayerInsights() {
  const overlay = document.getElementById('player-insights-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ── Match Insights (for upcoming games) ── */
function computeTeamAggregates(teamId) {
  const teamGames = gamesData.filter(g => g.home === teamId || g.away === teamId);
  const agg = {
    gamesPlayed: 0,
    passYards: 0, rushYards: 0, sacks: 0,
    defInts: 0, interceptions: 0,
    passTDs: 0, rushTDs: 0, recTDs: 0, defTDs: 0,
    yardsAllowed: 0, ptsFor: 0, ptsAgainst: 0,
    formHistory: []  // array of 'W'/'L'/'T' for last games (oldest first)
  };
  teamGames.sort((a, b) => a.week - b.week);
  teamGames.forEach(g => {
    const isHome = g.home === teamId;
    const teamStats = isHome ? g.homeStats : g.awayStats;
    const oppStats = isHome ? g.awayStats : g.homeStats;
    const ts = teamStats.reduce((s, p) => ({
      passYards: s.passYards + (p.passYards || 0),
      rushYards: s.rushYards + (p.rushYards || 0),
      sacks: s.sacks + (p.sacks || 0),
      defInts: s.defInts + (p.defInts || 0),
      interceptions: s.interceptions + (p.interceptions || 0),
      passTDs: s.passTDs + (p.passTDs || 0),
      rushTDs: s.rushTDs + (p.rushTDs || 0),
      recTDs: s.recTDs + (p.recTDs || 0),
      defTDs: s.defTDs + (p.defTDs || 0),
    }), { passYards:0, rushYards:0, sacks:0, defInts:0, interceptions:0, passTDs:0, rushTDs:0, recTDs:0, defTDs:0 });
    const oppYards = oppStats.reduce((s, p) => s + (p.passYards || 0) + (p.rushYards || 0), 0);
    agg.gamesPlayed++;
    Object.keys(ts).forEach(k => agg[k] += ts[k]);
    agg.yardsAllowed += oppYards;
    const myScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    agg.ptsFor += myScore || 0;
    agg.ptsAgainst += oppScore || 0;
    agg.formHistory.push(myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T');
  });
  return agg;
}

function findTopPlayers(teamId) {
  const team = getTeam(teamId);
  if (!team) return {};
  const roster = team.roster;
  // Only players with actual production
  const withStats = roster.filter(p =>
    (p.passYards || 0) + (p.rushYards || 0) + (p.recYards || 0) +
    (p.defInts || 0) + (p.pbu || 0) + (p.sacks || 0) + (p.flagPulls || 0) > 0
  );
  const top = (key) => [...withStats].sort((a, b) => (b[key] || 0) - (a[key] || 0))[0];
  return {
    topPasser: top('passYards'),
    topRusher: top('rushYards'),
    topReceiver: top('recYards'),
    topSacker: top('sacks'),
    topPuller: top('flagPulls'),
    topDB: [...withStats].sort((a, b) => ((b.defInts||0)+(b.pbu||0)+(b.defTDs||0)) - ((a.defInts||0)+(a.pbu||0)+(a.defTDs||0)))[0]
  };
}

function findHeadToHead(teamAId, teamBId) {
  const played = gamesData.filter(g =>
    (g.home === teamAId && g.away === teamBId) ||
    (g.home === teamBId && g.away === teamAId)
  );
  return played.map(g => {
    const aScore = g.home === teamAId ? g.homeScore : g.awayScore;
    const bScore = g.home === teamAId ? g.awayScore : g.homeScore;
    return { week: g.week, aScore, bScore, winner: aScore > bScore ? 'a' : aScore < bScore ? 'b' : 't' };
  });
}

function generateStoryline(home, away, homeAgg, awayAgg, h2h) {
  const stories = [];
  const homeUndef = home.wins > 0 && home.losses === 0;
  const awayUndef = away.wins > 0 && away.losses === 0;
  const homeStreak = getStreak(homeAgg.formHistory);
  const awayStreak = getStreak(awayAgg.formHistory);
  const homeDiff = (home.pointsFor || 0) - (home.pointsAgainst || 0);
  const awayDiff = (away.pointsFor || 0) - (away.pointsAgainst || 0);

  if (homeUndef && awayUndef) {
    stories.push({
      headline: '⚔️ Battle of Unbeatens',
      body: `Two perfect records collide. Only one leaves standing.`
    });
  }
  if (h2h.length > 0) {
    const last = h2h[h2h.length - 1];
    const homeWonH2H = (last.winner === 'a');
    stories.push({
      headline: '🔁 Rematch',
      body: homeWonH2H
        ? `${home.name} took the previous meeting ${last.aScore}-${last.bScore}. Can ${away.name} return the favor?`
        : `${away.name} won the last meeting ${last.bScore}-${last.aScore}. ${home.name} looks to even the score.`
    });
  }
  if (homeStreak.count >= 2 && homeStreak.type === 'W') {
    stories.push({
      headline: '🔥 Streak On The Line',
      body: `${home.name} has won ${homeStreak.count} straight and is riding a hot wave into this one.`
    });
  }
  if (awayStreak.count >= 2 && awayStreak.type === 'W') {
    stories.push({
      headline: '🔥 Streak On The Line',
      body: `${away.name} rolls in with ${awayStreak.count} consecutive wins. Their momentum is undeniable.`
    });
  }
  if (Math.abs(home.wins - away.wins) >= 3) {
    const under = home.wins < away.wins ? home : away;
    const over = home.wins < away.wins ? away : home;
    stories.push({
      headline: '🎯 Underdog Story',
      body: `${under.name} enters as the underdog against a red-hot ${over.name}. Upset alert?`
    });
  }
  const bigOffense = (homeAgg.gamesPlayed && (homeAgg.passYards + homeAgg.rushYards)/homeAgg.gamesPlayed >= 200)
                    || (awayAgg.gamesPlayed && (awayAgg.passYards + awayAgg.rushYards)/awayAgg.gamesPlayed >= 200);
  const strongDef = homeAgg.gamesPlayed && (homeAgg.yardsAllowed / homeAgg.gamesPlayed) <= 100
                    || awayAgg.gamesPlayed && (awayAgg.yardsAllowed / awayAgg.gamesPlayed) <= 100;
  if (bigOffense && strongDef) {
    stories.push({
      headline: '💥 Strength vs Strength',
      body: `Explosive offense meets a lockdown defense. Something has to give.`
    });
  }

  if (stories.length === 0) {
    stories.push({
      headline: '⚡ Every Game Matters',
      body: `Both squads still have plenty to fight for. Expect intensity from the jump.`
    });
  }
  return stories.slice(0, 2);
}

function getStreak(formHistory) {
  if (!formHistory || formHistory.length === 0) return { type: null, count: 0 };
  const last = formHistory[formHistory.length - 1];
  let count = 0;
  for (let i = formHistory.length - 1; i >= 0; i--) {
    if (formHistory[i] === last) count++;
    else break;
  }
  return { type: last, count };
}

function playerCard(label, player, statKey, statFmt) {
  if (!player) return '';
  const value = statKey ? (player[statKey] || 0) : '';
  const formatted = statFmt ? statFmt(value, player) : value;
  return `
    <div class="mi-player-card">
      <div class="mi-player-label">${label}</div>
      <div class="mi-player-name">${player.name}</div>
      <div class="mi-player-meta">#${player.number} &middot; ${player.position}</div>
      <div class="mi-player-value">${formatted}</div>
    </div>
  `;
}

function showMatchInsights(week, homeId, awayId) {
  const home = getTeam(homeId);
  const away = getTeam(awayId);
  if (!home || !away) return;

  const homeAgg = computeTeamAggregates(homeId);
  const awayAgg = computeTeamAggregates(awayId);
  const homeTop = findTopPlayers(homeId);
  const awayTop = findTopPlayers(awayId);
  const h2h = findHeadToHead(homeId, awayId);
  const stories = generateStoryline(home, away, homeAgg, awayAgg, h2h);

  // Ensure overlay exists
  let overlay = document.getElementById('match-insights-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'match-insights-overlay';
    overlay.className = 'match-insights-overlay';
    overlay.innerHTML = '<div class="match-insights-modal" id="match-insights-modal"></div>';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeMatchInsights();
    });
    document.body.appendChild(overlay);
  }

  const wkData = scheduleData.find(w => w.week === week);
  const gameData = wkData && wkData.games.find(g => g.home === homeId && g.away === awayId);
  const dateStr = wkData ? new Date(wkData.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const timeStr = gameData ? gameData.time : '';

  const avg = (val, n) => n > 0 ? (val / n).toFixed(1) : '0.0';
  const homePPG = avg(home.pointsFor, homeAgg.gamesPlayed);
  const awayPPG = avg(away.pointsFor, awayAgg.gamesPlayed);
  const homeYPG = avg(homeAgg.passYards + homeAgg.rushYards, homeAgg.gamesPlayed);
  const awayYPG = avg(awayAgg.passYards + awayAgg.rushYards, awayAgg.gamesPlayed);
  const homeYAllowed = avg(homeAgg.yardsAllowed, homeAgg.gamesPlayed);
  const awayYAllowed = avg(awayAgg.yardsAllowed, awayAgg.gamesPlayed);
  const homePassPG = avg(homeAgg.passYards, homeAgg.gamesPlayed);
  const awayPassPG = avg(awayAgg.passYards, awayAgg.gamesPlayed);
  const homeRushPG = avg(homeAgg.rushYards, homeAgg.gamesPlayed);
  const awayRushPG = avg(awayAgg.rushYards, awayAgg.gamesPlayed);

  const statRow = (label, homeV, awayV, betterHigh = true, isPct = false) => {
    const hv = parseFloat(homeV);
    const av = parseFloat(awayV);
    const homeBetter = betterHigh ? hv > av : hv < av;
    const awayBetter = betterHigh ? av > hv : av < hv;
    return `
      <div class="mi-comparison-row">
        <span class="mi-comp-val ${homeBetter ? 'mi-comp-better' : ''}">${homeV}</span>
        <span class="mi-comp-label">${label}</span>
        <span class="mi-comp-val ${awayBetter ? 'mi-comp-better' : ''}">${awayV}</span>
      </div>
    `;
  };

  const formPill = (result) => {
    const cls = result === 'W' ? 'form-w' : result === 'L' ? 'form-l' : 'form-t';
    return `<span class="mi-form-pill ${cls}">${result}</span>`;
  };

  const homeForm = homeAgg.formHistory.slice(-5).map(formPill).join('') || '<span style="color:var(--text-muted); font-size:0.8rem;">No games yet</span>';
  const awayForm = awayAgg.formHistory.slice(-5).map(formPill).join('') || '<span style="color:var(--text-muted); font-size:0.8rem;">No games yet</span>';

  let h2hHtml = '';
  if (h2h.length > 0) {
    h2hHtml = `
      <div class="mi-section-title">Head-to-Head This Season</div>
      <div class="mi-h2h-list">
        ${h2h.map(m => {
          const homeWon = m.winner === 'a';
          const awayWon = m.winner === 'b';
          return `
            <div class="mi-h2h-row">
              <span class="mi-h2h-team ${homeWon ? 'mi-h2h-winner' : ''}">${home.name}</span>
              <span class="mi-h2h-score">${m.aScore} - ${m.bScore}</span>
              <span class="mi-h2h-team ${awayWon ? 'mi-h2h-winner' : ''}">${away.name}</span>
              <span class="mi-h2h-week">Wk ${m.week}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  const modal = document.getElementById('match-insights-modal');
  modal.innerHTML = `
    <button class="close-detail" onclick="closeMatchInsights()">&times;</button>

    <div class="mi-header">
      <div class="mi-eyebrow">Match Preview &middot; Week ${week} &middot; ${dateStr}${timeStr ? ' &middot; ' + timeStr : ''}</div>
      <div class="mi-matchup">
        <div class="mi-team-block mi-team-home">
          <img src="${home.logo}" alt="${home.name}" class="mi-team-logo">
          <div class="mi-team-name">${home.name}</div>
          <div class="mi-team-record">${home.wins}-${home.losses}${home.ties?'-'+home.ties:''}</div>
        </div>
        <div class="mi-vs">
          <div class="mi-vs-text">VS</div>
          <div class="mi-vs-week">Wk ${week}</div>
        </div>
        <div class="mi-team-block mi-team-away">
          <img src="${away.logo}" alt="${away.name}" class="mi-team-logo">
          <div class="mi-team-name">${away.name}</div>
          <div class="mi-team-record">${away.wins}-${away.losses}${away.ties?'-'+away.ties:''}</div>
        </div>
      </div>
    </div>

    <div class="mi-storylines">
      ${stories.map(s => `
        <div class="mi-story">
          <div class="mi-story-headline">${s.headline}</div>
          <div class="mi-story-body">${s.body}</div>
        </div>
      `).join('')}
    </div>

    <div class="mi-section-title">Recent Form (last 5)</div>
    <div class="mi-form-grid">
      <div class="mi-form-side">
        <span class="mi-form-team">${home.name}</span>
        <div class="mi-form-pills">${homeForm}</div>
      </div>
      <div class="mi-form-side mi-form-side-right">
        <span class="mi-form-team">${away.name}</span>
        <div class="mi-form-pills">${awayForm}</div>
      </div>
    </div>

    ${h2hHtml}

    <div class="mi-section-title">Team Comparison &middot; Per Game Averages</div>
    <div class="mi-comparison">
      <div class="mi-comp-header">
        <span>${home.name}</span>
        <span></span>
        <span>${away.name}</span>
      </div>
      ${statRow('Points/G', homePPG, awayPPG)}
      ${statRow('Total YDS/G', homeYPG, awayYPG)}
      ${statRow('Pass YDS/G', homePassPG, awayPassPG)}
      ${statRow('Rush YDS/G', homeRushPG, awayRushPG)}
      ${statRow('YDS Allowed/G', homeYAllowed, awayYAllowed, false)}
      ${statRow('Sacks', homeAgg.sacks.toFixed(0), awayAgg.sacks.toFixed(0))}
      ${statRow('Def INTs', homeAgg.defInts.toFixed(0), awayAgg.defInts.toFixed(0))}
      ${statRow('Turnover Diff', (homeAgg.defInts - homeAgg.interceptions).toFixed(0), (awayAgg.defInts - awayAgg.interceptions).toFixed(0))}
    </div>

    <div class="mi-section-title">Players To Watch</div>
    <div class="mi-players-grid">
      <div class="mi-players-side">
        <div class="mi-players-team">${home.name}</div>
        ${playerCard('Top Passer', homeTop.topPasser, 'passYards', v => `${v} pass yds${homeTop.topPasser && homeTop.topPasser.passTDs ? ' / ' + homeTop.topPasser.passTDs + ' TD' : ''}`)}
        ${playerCard('Top Receiver', homeTop.topReceiver, 'recYards', v => `${v} rec yds${homeTop.topReceiver && homeTop.topReceiver.recTDs ? ' / ' + homeTop.topReceiver.recTDs + ' TD' : ''}`)}
        ${playerCard('Top Defender', homeTop.topDB, null, (_, p) => `${p.defInts||0} INT · ${p.pbu||0} PBU · ${p.flagPulls||0} FP`)}
      </div>
      <div class="mi-players-side">
        <div class="mi-players-team">${away.name}</div>
        ${playerCard('Top Passer', awayTop.topPasser, 'passYards', v => `${v} pass yds${awayTop.topPasser && awayTop.topPasser.passTDs ? ' / ' + awayTop.topPasser.passTDs + ' TD' : ''}`)}
        ${playerCard('Top Receiver', awayTop.topReceiver, 'recYards', v => `${v} rec yds${awayTop.topReceiver && awayTop.topReceiver.recTDs ? ' / ' + awayTop.topReceiver.recTDs + ' TD' : ''}`)}
        ${playerCard('Top Defender', awayTop.topDB, null, (_, p) => `${p.defInts||0} INT · ${p.pbu||0} PBU · ${p.flagPulls||0} FP`)}
      </div>
    </div>
  `;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMatchInsights() {
  const overlay = document.getElementById('match-insights-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ── Keyboard shortcut for closing modals ── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeGameDetail();
    closePlayerInsights();
    closeTeamLeadersFullList();
    closeMatchInsights();
  }
});

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setActiveNav();

  // Homepage
  renderStandings('standings');

  // Schedule page
  populateTeamFilter();
  renderSchedule('schedule');

  // Teams page
  renderTeamCards('team-cards');

  // Leaders page
  renderLeaders('leaders');

  // Check URL params for direct team link
  const params = new URLSearchParams(window.location.search);
  const teamParam = params.get('team');
  if (teamParam) {
    showTeamDetail(teamParam);
  }
});
