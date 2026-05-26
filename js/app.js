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

    week.games.forEach(game => {
      const home = getTeam(game.home);
      const away = getTeam(game.away);
      const played = game.homeScore !== null;
      const noContest = !!game.noContest;
      const forfeit = !!game.forfeit;
      const homeWon = played && game.homeScore > game.awayScore;
      const awayWon = played && game.awayScore > game.homeScore;
      const homeBadge = homeWon ? '<span class="result-badge result-win">W</span>'
                       : awayWon ? '<span class="result-badge result-loss">L</span>' : '';
      const awayBadge = awayWon ? '<span class="result-badge result-win">W</span>'
                       : homeWon ? '<span class="result-badge result-loss">L</span>' : '';

      let scoreHtml;
      if (noContest) {
        scoreHtml = `<span class="no-contest-badge">No Contest</span>`;
      } else if (forfeit) {
        scoreHtml = `<div class="score">${game.homeScore} - ${game.awayScore}</div><span class="forfeit-badge">Forfeit</span>`;
      } else if (played) {
        scoreHtml = `<div class="score">${game.homeScore} - ${game.awayScore}</div>`;
      } else {
        scoreHtml = `<span class="upcoming-badge">Upcoming</span>`;
      }

      // Forfeit games don't have box scores (no stats recorded)
      const showBoxScore = played && !forfeit;
      const cardClickAttr = showBoxScore
        ? `onclick="showGameDetail(${week.week}, '${game.home}', '${game.away}')" style="cursor:pointer;"`
        : '';

      html += `
        <div class="game-card ${played ? 'game-played' : ''} ${noContest ? 'game-no-contest' : ''} ${forfeit ? 'game-forfeit' : ''}" ${cardClickAttr}>
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
          </div>
          <div class="game-team away">
            ${awayBadge}
            <span>${away.name}</span>
            ${teamLogo(away, 32)}
          </div>
          ${showBoxScore ? '<div class="game-expand-hint">View Box Score</div>' : ''}
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
      ${summaryRow(homeTotals.touchdowns, 'Total TDs', awayTotals.touchdowns)}
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
    rushAtt: 0, rushYards: 0,
    receptions: 0, recYards: 0, touchdowns: 0,
    defInts: 0, pbu: 0, sacks: 0, flagPulls: 0
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
              <th>Rec</th>
              <th>Rec YDs</th>
              <th>TD</th>
              <th>Def INT</th>
              <th>PBU</th>
              <th>Sacks</th>
              <th>Flag Pulls</th>
            </tr>
          </thead>
          <tbody>
  `;

  players.forEach(p => {
    const total = (p.passYards||0)+(p.passTDs||0)+(p.interceptions||0)+(p.rushYards||0)+
                  (p.receptions||0)+(p.recYards||0)+(p.touchdowns||0)+(p.defInts||0)+
                  (p.pbu||0)+(p.sacks||0)+(p.flagPulls||0);
    const compAtt = (p.passAtt||0) > 0 ? `${p.passComp||0}/${p.passAtt}` : '-';
    html += `
      <tr class="${total > 0 ? '' : 'no-stats'}">
        <td class="player-number">${p.number}</td>
        <td class="player-name">${p.name}</td>
        <td>${p.position}</td>
        <td>${compAtt}</td>
        <td>${dash(p.passYards)}</td>
        <td class="${(p.passTDs||0) > 0 ? 'stat-highlight' : ''}">${dash(p.passTDs)}</td>
        <td>${dash(p.interceptions)}</td>
        <td>${dash(p.rushAtt)}</td>
        <td>${dash(p.rushYards)}</td>
        <td>${dash(p.receptions)}</td>
        <td>${dash(p.recYards)}</td>
        <td class="${(p.touchdowns||0) > 0 ? 'stat-highlight' : ''}">${dash(p.touchdowns)}</td>
        <td class="${(p.defInts||0) > 0 ? 'stat-highlight' : ''}">${dash(p.defInts)}</td>
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
    p.passYards > 0 || p.passTDs > 0 || p.passComp > 0 || p.rushYards > 0 ||
    p.receptions > 0 || p.recYards > 0 || p.touchdowns > 0 ||
    p.defInts > 0 || p.pbu > 0 || p.sacks > 0 || p.flagPulls > 0
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
              <th>Rec</th>
              <th>Rec Yds</th>
              <th>TD</th>
              <th>Def INT</th>
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
      html += `
        <tr>
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
            <td>${p.receptions || '-'}</td>
            <td>${p.recYards || '-'}</td>
            <td>${p.touchdowns || '-'}</td>
            <td>${p.defInts || '-'}</td>
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
function renderLeaders(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const categories = [
    { key: 'passYards', label: 'Passing Yards', icon: 'QBs' },
    { key: 'passTDs', label: 'Passing TDs', icon: 'QBs' },
    {
      key: 'compPct', label: 'Completion %', icon: 'QBs',
      compute: p => (p.passAtt || 0) > 0 ? (p.passComp / p.passAtt) * 100 : 0,
      filter: p => (p.passAtt || 0) >= 5,
      format: v => v.toFixed(1) + '%',
      meta: p => `${p.passComp}/${p.passAtt}`
    },
    { key: 'passComp', label: 'Pass Completions', icon: 'QBs' },
    { key: 'rushYards', label: 'Rushing Yards', icon: 'RBs' },
    { key: 'receptions', label: 'Receptions', icon: 'WRs' },
    { key: 'recYards', label: 'Receiving Yards', icon: 'WRs' },
    { key: 'touchdowns', label: 'Rush/Rec TDs', icon: 'ALL' },
    { key: 'defInts', label: 'Defensive INTs', icon: 'DBs' },
    { key: 'pbu', label: 'Pass Breakups', icon: 'DBs' },
    { key: 'sacks', label: 'Sacks', icon: 'DL' },
    { key: 'flagPulls', label: 'Flag Pulls', icon: 'DEF' }
  ];

  // Flatten all players with team info
  const allPlayers = [];
  teamsData.forEach(team => {
    team.roster.forEach(player => {
      allPlayers.push({ ...player, teamName: team.name, teamLogo: team.logo });
    });
  });

  // Check if any players have stats yet
  const hasAnyStats = allPlayers.some(p =>
    p.passYards > 0 || p.passTDs > 0 || p.passComp > 0 || p.rushYards > 0 ||
    p.receptions > 0 || p.recYards > 0 || p.touchdowns > 0 ||
    p.defInts > 0 || p.pbu > 0 || p.sacks > 0 || p.flagPulls > 0
  );

  if (!hasAnyStats) {
    container.innerHTML = '<div class="no-stats-message"><p>Stat leaders will appear here once the season kicks off.</p><p style="font-size:0.85rem; margin-top:0.5rem;">Check back after Week 1!</p></div>';
    return;
  }

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
      html += `
        <div class="leader-row">
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

  container.innerHTML = html;
}

/* ── Keyboard shortcut for closing modals ── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeGameDetail();
  }
});

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setActiveNav();

  // Homepage
  renderStandings('standings');

  // Schedule page
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
