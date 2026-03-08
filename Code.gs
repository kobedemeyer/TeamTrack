// ══════════════════════════════════════════════════════════════
//  TeamTrack — Google Apps Script Backend
//  Deploy as web app: Execute as Me, Access: Anyone
// ══════════════════════════════════════════════════════════════

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  let result;

  try {
    switch (action) {
      case 'getCategories':
        result = getCategories(e.parameter.teamId);
        break;
      case 'getSummary':
        result = getSummary(e.parameter.teamId);
        break;
      case 'getLogs':
        result = getLogs(e.parameter.limit, e.parameter.teamId);
        break;
      case 'addCategory':
        result = addCategory(e.parameter.name, e.parameter.person, e.parameter.teamId);
        break;
      case 'addLog':
        result = addLog(e.parameter.person, e.parameter.categoryId, e.parameter.count);
        break;
      case 'registerMember':
        result = registerMember(e.parameter.name, e.parameter.teamId);
        break;
      case 'getTeams':
        result = getTeams();
        break;
      case 'addTeam':
        result = addTeam(e.parameter.name, e.parameter.person);
        break;
      case 'getProfile':
        result = getProfile(e.parameter.name, e.parameter.teamId);
        break;
      case 'getMembers':
        result = getMembers(e.parameter.teamId);
        break;
      case 'getAllMembers':
        result = getAllMembers();
        break;
      case 'checkName':
        result = checkName(e.parameter.name);
        break;
      case 'removeMemberFromTeam':
        result = removeMemberFromTeam(e.parameter.name);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Teams ───────────────────────────────────────────────────

function getTeams() {
  const sheet = SS.getSheetByName('Teams');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  return rows.map(function(r) {
    return { id: r[0], name: r[1], createdBy: r[2], createdAt: r[3] };
  });
}

function addTeam(name, person) {
  if (!name || !person) return { error: 'Missing name or person' };

  const sheet = SS.getSheetByName('Teams');
  if (!sheet) return { error: 'Teams sheet not found' };
  const id = Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, name.trim(), person.trim(), new Date().toISOString()]);
  return { ok: true, id: id, name: name.trim() };
}

// ── Categories ──────────────────────────────────────────────

function getCategories(teamId) {
  const sheet = SS.getSheetByName('Categories');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  var cats = rows.map(function(r) {
    return { id: r[0], name: r[1], createdBy: r[2], teamId: r[3] || '' };
  });

  if (teamId) {
    cats = cats.filter(function(c) {
      return c.teamId === teamId || c.teamId === '';
    });
  }

  return cats;
}

function addCategory(name, person, teamId) {
  if (!name || !person) return { error: 'Missing name or person' };

  const sheet = SS.getSheetByName('Categories');
  const id = Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, name.trim(), person.trim(), teamId || '']);
  return { ok: true, id: id, name: name.trim() };
}

// ── Logs ────────────────────────────────────────────────────

function addLog(person, categoryId, count) {
  if (!person || !categoryId) return { error: 'Missing person or categoryId' };

  const cnt = parseInt(count, 10) || 1;
  const cats = getCategories();
  const cat = cats.find(function(c) { return c.id === categoryId; });
  if (!cat) return { error: 'Category not found' };

  const sheet = SS.getSheetByName('Logs');
  const ts = new Date().toISOString();
  sheet.appendRow([ts, person.trim(), categoryId, cat.name, cnt]);
  return { ok: true, timestamp: ts };
}

function getLogs(limit, teamId) {
  const sheet = SS.getSheetByName('Logs');
  const data = sheet.getDataRange().getValues();
  var rows = data.slice(1);

  // Filter by team's categories if teamId provided
  if (teamId) {
    var teamCats = getCategories(teamId);
    var catIds = {};
    teamCats.forEach(function(c) { catIds[c.id] = true; });
    rows = rows.filter(function(r) { return catIds[r[2]]; });
  }

  const max = parseInt(limit, 10) || 50;

  // Most recent first
  rows.reverse();
  const subset = rows.slice(0, max);

  return subset.map(function(r) {
    return {
      timestamp: r[0],
      person: r[1],
      categoryId: r[2],
      categoryName: r[3],
      count: r[4]
    };
  });
}

// ── Summary ─────────────────────────────────────────────────

function getSummary(teamId) {
  const logs = SS.getSheetByName('Logs').getDataRange().getValues().slice(1);
  const membersSheet = SS.getSheetByName('Members').getDataRange().getValues().slice(1);
  const cats = getCategories(teamId);

  // Build a set of valid category IDs for filtering
  var catIds = {};
  cats.forEach(function(c) { catIds[c.id] = true; });

  // Filter members by team if teamId provided
  var members = membersSheet;
  if (teamId) {
    members = members.filter(function(m) {
      return m[2] === teamId || !m[2];
    });
  }

  // Build totals: { person: { categoryId: total } }
  var totals = {};
  logs.forEach(function(r) {
    var person = r[1];
    var catId = r[2];
    var cnt = parseInt(r[4], 10) || 0;
    if (!catIds[catId]) return;
    if (!totals[person]) totals[person] = {};
    totals[person][catId] = (totals[person][catId] || 0) + cnt;
  });

  // Ensure all registered members appear
  members.forEach(function(m) {
    if (!totals[m[0]]) totals[m[0]] = {};
  });

  return {
    categories: cats,
    members: Object.keys(totals).sort(),
    totals: totals
  };
}

// ── Members ─────────────────────────────────────────────────

function registerMember(name, teamId) {
  if (!name) return { error: 'Missing name' };

  const sheet = SS.getSheetByName('Members');
  const data = sheet.getDataRange().getValues();
  const trimmed = name.trim();

  // Check if already registered
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed.toLowerCase()) {
      // Update teamId if provided
      if (teamId) {
        sheet.getRange(i + 1, 3).setValue(teamId);
      }
      return { ok: true, existing: true };
    }
  }

  sheet.appendRow([trimmed, new Date().toISOString(), teamId || '']);
  return { ok: true, existing: false };
}

// ── Profile ──────────────────────────────────────────────────

function getProfile(name, teamId) {
  if (!name) return { error: 'Missing name' };

  var logsSheet = SS.getSheetByName('Logs');
  var membersSheet = SS.getSheetByName('Members');
  var logs = logsSheet ? logsSheet.getDataRange().getValues().slice(1) : [];
  var members = membersSheet ? membersSheet.getDataRange().getValues().slice(1) : [];

  var trimmed = name.trim().toLowerCase();

  // Member-since date
  var memberSince = '';
  for (var i = 0; i < members.length; i++) {
    if (members[i][0].toString().toLowerCase() === trimmed) {
      memberSince = members[i][1];
      break;
    }
  }

  // Filter logs by this person (and by team categories if teamId given)
  var catIds = null;
  if (teamId) {
    var teamCats = getCategories(teamId);
    catIds = {};
    teamCats.forEach(function(c) { catIds[c.id] = true; });
  }

  var totalActions = 0;
  var kpiCounts = {};
  logs.forEach(function(r) {
    if (r[1].toString().toLowerCase() !== trimmed) return;
    if (catIds && !catIds[r[2]]) return;
    var cnt = parseInt(r[4], 10) || 0;
    totalActions += cnt;
    var catName = r[3];
    kpiCounts[catName] = (kpiCounts[catName] || 0) + cnt;
  });

  // Top KPI
  var topKpi = { name: '—', count: 0 };
  Object.keys(kpiCounts).forEach(function(k) {
    if (kpiCounts[k] > topKpi.count) {
      topKpi = { name: k, count: kpiCounts[k] };
    }
  });

  return {
    totalActions: totalActions,
    topKpi: topKpi,
    memberSince: memberSince
  };
}

function getMembers(teamId) {
  if (!teamId) return { error: 'Missing teamId' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues().slice(1);

  var result = [];
  data.forEach(function(r) {
    if (r[2] === teamId) {
      result.push({ name: r[0], joinedAt: r[1], teamId: r[2] });
    }
  });
  return result;
}

function checkName(name) {
  if (!name) return { error: 'Missing name' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return { exists: false };
  var data = sheet.getDataRange().getValues().slice(1);
  var trimmed = name.trim().toLowerCase();

  for (var i = 0; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      var teamId = data[i][2] || '';
      var teamName = '';
      if (teamId) {
        var teamsSheet = SS.getSheetByName('Teams');
        if (teamsSheet) {
          var teams = teamsSheet.getDataRange().getValues().slice(1);
          for (var j = 0; j < teams.length; j++) {
            if (teams[j][0] === teamId) { teamName = teams[j][1]; break; }
          }
        }
      }
      return { exists: true, name: data[i][0], teamId: teamId, teamName: teamName };
    }
  }
  return { exists: false };
}

function getAllMembers() {
  var membersSheet = SS.getSheetByName('Members');
  if (!membersSheet) return [];
  var members = membersSheet.getDataRange().getValues().slice(1);

  // Build team lookup: id → name
  var teamNames = {};
  var teamsSheet = SS.getSheetByName('Teams');
  if (teamsSheet) {
    teamsSheet.getDataRange().getValues().slice(1).forEach(function(r) {
      teamNames[r[0]] = r[1];
    });
  }

  return members.map(function(r) {
    var tid = r[2] || '';
    return {
      name: r[0],
      joinedAt: r[1],
      teamId: tid,
      teamName: tid ? (teamNames[tid] || 'Unknown team') : 'No team'
    };
  });
}

function removeMemberFromTeam(name) {
  if (!name) return { error: 'Missing name' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return { error: 'Members sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmed = name.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      sheet.getRange(i + 1, 3).setValue('');
      return { ok: true };
    }
  }
  return { error: 'Member not found' };
}
