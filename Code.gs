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
