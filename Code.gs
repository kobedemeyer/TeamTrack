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
        result = getLogs(e.parameter.limit, e.parameter.teamId, e.parameter.statusFilter);
        break;
      case 'addCategory':
        result = addCategory(e.parameter.name, e.parameter.person, e.parameter.teamId);
        break;
      case 'addLog':
        result = addLog(e.parameter.person, e.parameter.categoryId, e.parameter.count);
        break;
      case 'registerMember':
        result = registerMember(e.parameter.name, e.parameter.teamId, e.parameter.entity);
        break;
      case 'getTeams':
        result = getTeams(e.parameter.entity);
        break;
      case 'addTeam':
        result = addTeam(e.parameter.name, e.parameter.person, e.parameter.entity);
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
      case 'verifyPassword':
        result = verifyPassword(e.parameter.name, e.parameter.password);
        break;
      case 'setPassword':
        result = setPassword(e.parameter.name, e.parameter.password);
        break;
      case 'removeMemberFromTeam':
        result = removeMemberFromTeam(e.parameter.name);
        break;
      case 'deleteLog':
        result = deleteLog(e.parameter.timestamp, e.parameter.person);
        break;
      case 'deleteCategory':
        result = deleteCategory(e.parameter.categoryId);
        break;
      case 'deleteMember':
        result = deleteMember(e.parameter.name);
        break;
      case 'moveMemberToTeam':
        result = moveMemberToTeam(e.parameter.name, e.parameter.teamId);
        break;
      case 'deleteLogsByPerson':
        result = deleteLogsByPerson(e.parameter.name);
        break;
      case 'getAllSummaries':
        result = getAllSummaries(e.parameter.entity);
        break;
      case 'setAdminStatus':
        result = setAdminStatus(e.parameter.name, e.parameter.isAdmin, e.parameter.caller);
        break;
      case 'setLogStatus':
        result = setLogStatus(e.parameter.timestamp, e.parameter.person, e.parameter.status, e.parameter.caller);
        break;
      case 'getPendingLogs':
        result = getPendingLogs(e.parameter.teamId);
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

function getTeams(entity) {
  const sheet = SS.getSheetByName('Teams');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  var rows = data.slice(1);
  if (entity) {
    rows = rows.filter(function(r) {
      return (r[4] || 'Antwerpen') === entity;
    });
  }
  return rows.map(function(r) {
    return { id: r[0], name: r[1], createdBy: r[2], createdAt: r[3], entity: r[4] || 'Antwerpen' };
  });
}

function addTeam(name, person, entity) {
  if (!name || !person) return { error: 'Missing name or person' };

  const sheet = SS.getSheetByName('Teams');
  if (!sheet) return { error: 'Teams sheet not found' };
  const id = Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, name.trim(), person.trim(), new Date().toISOString(), entity || 'Antwerpen']);
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

function isPersonAdmin(personName) {
  var trimmed = personName.trim().toLowerCase();
  if (trimmed === 'kobe') return true;
  var sheet = SS.getSheetByName('Members');
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      return data[i][4] === '1' || data[i][4] === 1;
    }
  }
  return false;
}

function addLog(person, categoryId, count) {
  if (!person || !categoryId) return { error: 'Missing person or categoryId' };

  const cnt = parseInt(count, 10) || 1;
  const cats = getCategories();
  const cat = cats.find(function(c) { return c.id === categoryId; });
  if (!cat) return { error: 'Category not found' };

  var status = isPersonAdmin(person) ? 'approved' : 'pending';

  const sheet = SS.getSheetByName('Logs');
  const ts = new Date().toISOString();
  sheet.appendRow([ts, person.trim(), categoryId, cat.name, cnt, status]);
  return { ok: true, timestamp: ts, status: status };
}

function getLogs(limit, teamId, statusFilter) {
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

  // Filter by status if requested
  if (statusFilter) {
    rows = rows.filter(function(r) {
      var s = (r[5] || '').toString();
      if (statusFilter === 'pending') return s === 'pending';
      if (statusFilter === 'approved') return s === 'approved' || s === '';
      if (statusFilter === 'rejected') return s === 'rejected';
      return true;
    });
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
      count: r[4],
      status: (r[5] || '').toString() || 'approved'
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

  // Filter members by team — only include members assigned to this team
  var members = membersSheet;
  if (teamId) {
    members = members.filter(function(m) {
      return m[2] === teamId;
    });
  }

  // Build totals: { person: { categoryId: total } } — only approved logs
  var totals = {};
  logs.forEach(function(r) {
    var person = r[1];
    var catId = r[2];
    var cnt = parseInt(r[4], 10) || 0;
    var status = (r[5] || '').toString();
    if (status === 'rejected' || status === 'pending') return;
    if (!catIds[catId]) return;
    if (!totals[person]) totals[person] = {};
    totals[person][catId] = (totals[person][catId] || 0) + cnt;
  });

  // Build set of team member names
  var memberNames = {};
  members.forEach(function(m) {
    memberNames[m[0]] = true;
    if (!totals[m[0]]) totals[m[0]] = {};
  });

  // Filter totals to team members only (exclude people from other teams)
  var filteredTotals = {};
  Object.keys(totals).forEach(function(person) {
    if (memberNames[person]) filteredTotals[person] = totals[person];
  });

  return {
    categories: cats,
    members: Object.keys(filteredTotals).sort(),
    totals: filteredTotals
  };
}

// ── Members ─────────────────────────────────────────────────

function registerMember(name, teamId, entity) {
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
      // Update entity if provided
      if (entity) {
        sheet.getRange(i + 1, 7).setValue(entity);
      }
      return { ok: true, existing: true };
    }
  }

  sheet.appendRow([trimmed, new Date().toISOString(), teamId || '', '', '', '', entity || '']);
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
    var status = (r[5] || '').toString();
    if (status === 'rejected' || status === 'pending') return;
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
      result.push({ name: r[0], joinedAt: r[1], teamId: r[2], isAdmin: r[4] === '1' || r[4] === 1 || r[0].toString().toLowerCase() === 'kobe', entity: (r[6] || '').toString() });
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
      var hasPassword = !!(data[i][3]);
      var memberIsAdmin = data[i][4] === '1' || data[i][4] === 1 || data[i][0].toString().toLowerCase() === 'kobe';
      var entity = (data[i][6] || '').toString();
      return { exists: true, name: data[i][0], teamId: teamId, teamName: teamName, hasPassword: hasPassword, isAdmin: memberIsAdmin, entity: entity };
    }
  }
  return { exists: false };
}

function verifyPassword(name, password) {
  if (!name) return { error: 'Missing name' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return { error: 'Member not found' };
  var data = sheet.getDataRange().getValues();
  var trimmed = name.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      var stored = data[i][3] || '';
      if (stored === password) {
        return { ok: true };
      }
      return { error: 'Wrong password' };
    }
  }
  return { error: 'Member not found' };
}

function setPassword(name, password) {
  if (!name) return { error: 'Missing name' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return { error: 'Members sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmed = name.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      sheet.getRange(i + 1, 4).setValue(password || '');
      return { ok: true };
    }
  }
  return { error: 'Member not found' };
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
      teamName: tid ? (teamNames[tid] || 'Unknown team') : 'No team',
      isAdmin: r[4] === '1' || r[4] === 1 || r[0].toString().toLowerCase() === 'kobe',
      entity: (r[6] || '').toString()
    };
  });
}

function deleteLog(timestamp, person) {
  if (!timestamp || !person) return { error: 'Missing timestamp or person' };

  var sheet = SS.getSheetByName('Logs');
  if (!sheet) return { error: 'Logs sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmedPerson = person.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === timestamp &&
        data[i][1].toString().toLowerCase() === trimmedPerson) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Log not found' };
}

function deleteCategory(categoryId) {
  if (!categoryId) return { error: 'Missing categoryId' };

  var sheet = SS.getSheetByName('Categories');
  if (!sheet) return { error: 'Categories sheet not found' };
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === categoryId) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Category not found' };
}

function deleteMember(name) {
  if (!name) return { error: 'Missing name' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return { error: 'Members sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmed = name.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Member not found' };
}

function moveMemberToTeam(name, teamId) {
  if (!name || !teamId) return { error: 'Missing name or teamId' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return { error: 'Members sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmed = name.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      sheet.getRange(i + 1, 3).setValue(teamId);
      return { ok: true };
    }
  }
  return { error: 'Member not found' };
}

function deleteLogsByPerson(name) {
  if (!name) return { error: 'Missing name' };

  var sheet = SS.getSheetByName('Logs');
  if (!sheet) return { error: 'Logs sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmed = name.trim().toLowerCase();
  var deleted = 0;

  // Delete from bottom to top to keep row indices stable
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1].toString().toLowerCase() === trimmed) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  return { ok: true, deleted: deleted };
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

// ── Admin Status ────────────────────────────────────────────

function setAdminStatus(name, isAdminVal, caller) {
  if (!name || !caller) return { error: 'Missing name or caller' };
  if (caller.trim().toLowerCase() !== 'kobe') return { error: 'Only super-admin can set admin status' };

  var sheet = SS.getSheetByName('Members');
  if (!sheet) return { error: 'Members sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmed = name.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === trimmed) {
      sheet.getRange(i + 1, 5).setValue(isAdminVal === '1' ? '1' : '');
      return { ok: true };
    }
  }
  return { error: 'Member not found' };
}

// ── Log Status (Approve/Reject) ─────────────────────────────

function setLogStatus(timestamp, person, status, caller) {
  if (!timestamp || !person || !status || !caller) return { error: 'Missing parameters' };
  if (!isPersonAdmin(caller)) return { error: 'Only admins can approve/reject logs' };
  if (status !== 'approved' && status !== 'rejected') return { error: 'Invalid status' };

  var sheet = SS.getSheetByName('Logs');
  if (!sheet) return { error: 'Logs sheet not found' };
  var data = sheet.getDataRange().getValues();
  var trimmedPerson = person.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === timestamp &&
        data[i][1].toString().toLowerCase() === trimmedPerson) {
      sheet.getRange(i + 1, 6).setValue(status);
      return { ok: true };
    }
  }
  return { error: 'Log not found' };
}

// ── Pending Logs ────────────────────────────────────────────

function getPendingLogs(teamId) {
  var sheet = SS.getSheetByName('Logs');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1);

  // Filter to pending only
  rows = rows.filter(function(r) {
    return (r[5] || '').toString() === 'pending';
  });

  // Filter by team's categories if teamId provided
  if (teamId) {
    var teamCats = getCategories(teamId);
    var catIds = {};
    teamCats.forEach(function(c) { catIds[c.id] = true; });
    rows = rows.filter(function(r) { return catIds[r[2]]; });
  }

  // Most recent first
  rows.reverse();

  return rows.map(function(r) {
    return {
      timestamp: r[0],
      person: r[1],
      categoryId: r[2],
      categoryName: r[3],
      count: r[4],
      status: 'pending'
    };
  });
}

// ── All Summaries (batch) ────────────────────────────────────

function getAllSummaries(entity) {
  var teamsSheet = SS.getSheetByName('Teams');
  if (!teamsSheet) return [];
  var teams = teamsSheet.getDataRange().getValues().slice(1);
  if (entity) {
    teams = teams.filter(function(t) {
      return (t[4] || 'Antwerpen') === entity;
    });
  }

  var catsSheet = SS.getSheetByName('Categories');
  var allCats = catsSheet ? catsSheet.getDataRange().getValues().slice(1) : [];

  var membersSheet = SS.getSheetByName('Members');
  var allMembers = membersSheet ? membersSheet.getDataRange().getValues().slice(1) : [];

  var logsSheet = SS.getSheetByName('Logs');
  var allLogs = logsSheet ? logsSheet.getDataRange().getValues().slice(1) : [];

  // Build categories array with parsed objects
  var cats = allCats.map(function(r) {
    return { id: r[0], name: r[1], createdBy: r[2], teamId: r[3] || '' };
  });

  // Group categories by teamId
  var catsByTeam = {}; // teamId → [cat]
  var globalCats = [];  // cats with no teamId (shared)
  cats.forEach(function(c) {
    if (c.teamId) {
      if (!catsByTeam[c.teamId]) catsByTeam[c.teamId] = [];
      catsByTeam[c.teamId].push(c);
    } else {
      globalCats.push(c);
    }
  });

  // Group members by teamId
  var membersByTeam = {};
  allMembers.forEach(function(r) {
    var tid = r[2] || '';
    if (tid) {
      if (!membersByTeam[tid]) membersByTeam[tid] = [];
      membersByTeam[tid].push(r[0]);
    }
  });

  // Build per-team results
  return teams.map(function(t) {
    var teamId = t[0];
    var teamName = t[1];
    var teamCats = (catsByTeam[teamId] || []).concat(globalCats);
    var catIds = {};
    teamCats.forEach(function(c) { catIds[c.id] = true; });

    // Build totals from logs — only approved logs
    var totals = {};
    allLogs.forEach(function(r) {
      var person = r[1];
      var catId = r[2];
      var cnt = parseInt(r[4], 10) || 0;
      var status = (r[5] || '').toString();
      if (status === 'rejected' || status === 'pending') return;
      if (!catIds[catId]) return;
      if (!totals[person]) totals[person] = {};
      totals[person][catId] = (totals[person][catId] || 0) + cnt;
    });

    // Only include actual team members
    var teamMembers = membersByTeam[teamId] || [];
    var memberSet = {};
    teamMembers.forEach(function(name) { memberSet[name] = true; });

    // Ensure all team members appear in totals
    teamMembers.forEach(function(name) {
      if (!totals[name]) totals[name] = {};
    });

    // Filter totals to team members only
    var filteredTotals = {};
    teamMembers.forEach(function(name) {
      if (totals[name]) filteredTotals[name] = totals[name];
    });

    return {
      id: teamId,
      name: teamName,
      categories: teamCats,
      members: teamMembers.sort(),
      totals: filteredTotals
    };
  });
}
