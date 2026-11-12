const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = __dirname;
const ref = '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/taakpay-app-n86-forcing/docs/timeline_service_code_entry_mode.html';
const mdPath = path.join(repo, 'rollback.md');
const outPath = path.join(repo, 'docs', 'timeline_all_code_changes_2026_07.html');

const refHtml = fs.readFileSync(ref, 'utf8');
const baseStyle = (refHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || '';
const extraStyle = `
  .field-content table { width:100%; border-collapse:collapse; margin:10px 0; font-size:0.78rem; color:var(--text); }
  .field-content th, .field-content td { padding:6px 8px; border-bottom:1px solid var(--border); text-align:left; vertical-align:top; }
  .field-content th { color:var(--text-dim); font-weight:600; }
  .field-content ul, .field-content ol { margin-left:16px; margin-top:6px; margin-bottom:8px; }
  .field-content li { margin-bottom:4px; line-height:1.55; }
  .field-content p { margin-bottom:8px; }
  .field-content code { font-family:'JetBrains Mono',monospace; color:var(--green-glow); }
  .field-content strong { color:var(--text-bright); }
  .field-label.diff { color: var(--green-glow); }
  .controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:20px 0; }
  .controls input[type="text"] { flex:1; min-width:220px; padding:8px 12px; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--text); }
  .controls label { display:flex; align-items:center; gap:6px; white-space:nowrap; cursor:pointer; }
`;
const style = `<style>${baseStyle}${extraStyle}</style>`;

const tagMap = {
  '3fe809ca': ['introduced','changed','fixed'],
  'c454ec5': ['corrected'],
  '2ee72da': ['introduced','changed'],
  'b265280': ['fixed'],
  'cd8aad3': ['fixed'],
  'e89895e': ['changed'],
  '60f9b4c': ['introduced'],
  '0c86fbf': ['fixed','corrected'],
  'c6e2c9b': ['introduced'],
  '23dcb13': ['changed'],
  '9c6f287': ['introduced'],
  '8fea57e': ['nochange'],
  '2f4f0fe': ['changed','corrected'],
  '3632429': ['changed','fixed'],
  'a63e264': ['introduced'],
  '154a3e9': ['changed'],
  '99b464a': ['nochange'],
  '693b1b4': ['fixed']
};

function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+?)`/g,'<code>$1</code>'); }

function tableToHtml(lines){
  let has = false;
  if(lines.length > 1 && /^\|(\s*[-:]+\s*\|)+$/.test(lines[1])) has = true;
  let html = '<table><tbody>';
  let start = 0;
  if(has){
    html = '<table><thead>' + trToHtml(lines[0], 'th') + '</thead><tbody>';
    start = 2;
  }
  for(let i=start;i<lines.length;i++){
    const l = lines[i];
    if(/^\|(\s*[-:]+\s*\|)+$/.test(l)) continue;
    html += trToHtml(l, 'td');
  }
  return html + '</tbody></table>';
}
function trToHtml(line, tag){
  const cells = line.split('|').slice(1, -1).map(c => `<${tag}>${inline(c.trim())}</${tag}>`).join('');
  return `<tr>${cells}</tr>`;
}

function mdToHtml(text){
  const lines = text.trim().split('\n');
  const out = [];
  let block = [];
  let btype = null;
  function flush(){
    if(!block.length) return;
    if(btype === 'table') out.push(tableToHtml(block));
    else if(btype === 'ul') out.push('<ul>' + block.map(l => `<li>${inline(l.replace(/^(\s*[\*\-\u2022]\s+|\s+\*?\-?)\s*/, ''))}</li>`).join('') + '</ul>');
    else if(btype === 'ol') out.push('<ol>' + block.map(l => `<li>${inline(l.replace(/^\d+\.\s*/, ''))}</li>`).join('') + '</ol>');
    else if(btype === 'heading') out.push(`<p><strong>${esc(block[0].replace(/^####\s*/, ''))}</strong></p>`);
    else out.push(`<p>${inline(block.join(' '))}</p>`);
    block = [];
    btype = null;
  }
  for(const raw of lines){
    const line = raw.replace(/\s+$/, '');
    if(!line){ flush(); continue; }
    let type = 'para';
    if(/^\|.*\|$/.test(line)) type = 'table';
    else if(/^[\u2022\*\-]\s/.test(line) || /^\s{2,}[\u2022\*\-]\s/.test(line)) type = 'ul';
    else if(/^\d+\.\s/.test(line)) type = 'ol';
    else if(/^####\s/.test(line)) type = 'heading';
    if(type !== btype){ flush(); btype = type; }
    block.push(line);
  }
  flush();
  return out.join('\n');
}

function splitSubsections(body){
  const re = /#### 3\.\d+(?:\.\d+)?\s+(.+?)\n/g;
  const headings = [];
  let m;
  while((m = re.exec(body)) !== null){
    headings.push({title: m[1].trim(), index: m.index, start: m.index + m[0].length});
  }
  if(!headings.length) return [{title: 'What changed', content: body.trim()}];
  const parts = [];
  const first = headings[0].index;
  if(first > 0){
    const pre = body.slice(0, first).trim();
    if(pre) parts.push({title: 'What changed', content: pre});
  }
  for(let i=0;i<headings.length;i++){
    const h = headings[i];
    const end = i < headings.length-1 ? headings[i+1].index : body.length;
    parts.push({title: h.title, content: body.slice(h.start, end).trim()});
  }
  return parts;
}

const fileRe = /(?:^|[\s('"`])(lib\/[\w./-]+|commands\/[\w./-]+|tests\/[\w./-]+|docs\/[\w./-]+|static\/[\w./-]+|app\.js|\.gitignore|package\.json|what-changed\.md)(?=[\s,;)'"`]|$)/g;
function extractFiles(text){
  const set = new Set();
  let m;
  while((m = fileRe.exec(text)) !== null) set.add(m[1]);
  return Array.from(set).sort();
}

function getDiff(hash){
  try {
    const out = execFileSync('git', ['--no-pager', 'show', hash, '-p', '--format='], {
      cwd: repo,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    return out;
  } catch (e) {
    return `Unable to load diff for ${hash}: ${e.message}`;
  }
}

function formatDiff(text){
  return text.split('\n').map(line => {
    if(line.startsWith('+') && !line.startsWith('+++')) return `<span class="add">${esc(line)}</span>`;
    if(line.startsWith('-') && !line.startsWith('---')) return `<span class="del">${esc(line)}</span>`;
    return esc(line);
  }).join('\n');
}

const md = fs.readFileSync(mdPath, 'utf8');
const sectionRe = /### 3\.(\d+) `(.+?)` — (.+?)\n/g;
const matches = [...md.matchAll(sectionRe)];
const sections = [];

for(let i=0;i<matches.length;i++){
  const start = matches[i].index;
  const end = i < matches.length-1 ? matches[i+1].index : (() => {
    const n = md.indexOf('\n## ', start + matches[i][0].length);
    return n === -1 ? md.length : n;
  })();
  const text = md.slice(start, end);
  const hash = matches[i][2];
  const title = matches[i][3].trim();
  const dateMatch = text.match(/\*\*Date:\*\*\s*(.+)(?:\n|$)/);
  const date = dateMatch ? dateMatch[1].trim() : '';
  const body = text.replace(/^### 3\.\d+.*\n(?:\*\*.*\n)+/m, '').trim();
  const parts = splitSubsections(body);
  const files = extractFiles(body);
  const primary = hash.split(' ')[0].replace(/[^0-9a-fA-F]/g, '');
  const diff = getDiff(primary);
  sections.push({hash, title, date, parts, files, diff});
}

function buildWhatHtml(parts){
  let html = '';
  for(let i=0;i<parts.length-1;i++){
    const p = parts[i];
    if(/what changed/i.test(p.title)) html += mdToHtml(p.content);
    else html += `<p><strong>${esc(p.title)}</strong></p>` + mdToHtml(p.content);
  }
  return html;
}

function colorForTags(tags){
  if(tags.includes('introduced')) return 'green';
  if(tags.includes('fixed')) return 'red';
  if(tags.includes('corrected')) return 'blue';
  if(tags.includes('changed')) return 'orange';
  return '';
}

function entryHtml(s){
  const primary = s.hash.split(' ')[0].replace(/[^0-9a-fA-F]/g, '');
  const tags = tagMap[primary] || ['changed'];
  const color = colorForTags(tags);
  const what = buildWhatHtml(s.parts);
  const rb = mdToHtml(s.parts[s.parts.length-1].content);
  const tagsHtml = tags.map(t => `<span class="tag ${t}">${t[0].toUpperCase()+t.slice(1)}</span>`).join('');
  const filesHtml = s.files.length ? '<div class="file-refs">' + s.files.map(f => `<div class="file-ref"><span class="file-icon">📄</span><span class="filename">${esc(f)}</span><span class="lines"></span><span class="desc">touched</span></div>`).join('') + '</div>' : '';
  return `
    <div class="entry${color ? ' ' + color : ''}">
      <div class="dot"></div>
      <div class="card">
        <div class="card-head">
          <h3>${esc(s.title)}</h3>
          <span class="commit-hash">${esc(s.hash)}</span>
        </div>
        <div class="date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${esc(s.date)}
        </div>
        <div class="field-block">
          <div class="field-label service"><span class="icon">🔑</span> what_changed</div>
          <div class="field-content searchable">${what}</div>
        </div>
        <div class="field-block">
          <div class="field-label entry"><span class="icon">📡</span> rollback_note</div>
          <div class="field-content searchable">${rb}</div>
        </div>
        <div class="field-block">
          <div class="field-label diff"><span class="icon">🔒</span> diff</div>
          <div class="field-content"><pre class="code">${formatDiff(s.diff)}</pre></div>
        </div>
        <div class="tags">${tagsHtml}</div>
        ${filesHtml}
      </div>
    </div>`;
}

const summaryMatch = md.match(/### 7\.3 Heavily modified files\s*\n([\s\S]*?)(?=\n## |\n### 7\.4|\n---|\*\*End)/);
const summaryBody = summaryMatch ? summaryMatch[1].trim() : '';
const summaryHtml = summaryBody ? `<div class="summary"><h2>Heavily modified files</h2>${mdToHtml(summaryBody)}</div>` : '';

const badges = [
  'lib/Translator/lib/jsonToIsoTranslator.js',
  'lib/socketServer/lib/services/tx.service.pro.js',
  'lib/socketServer/lib/services/isoSeliaService.js',
  'lib/socketServer/lib/services/emvTagValidator.js',
  'lib/emv-packet/lib/emvPacket.js',
  'lib/iso8583/lib/packager/PROSA.js',
  'lib/iso8583/lib/packer/lll-n.js',
  'lib/socketServer/lib/routes/processing/processing.routes.js',
  'commands/test-initKeys.js',
  'docs/initKeys-service-plan.md'
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Complete Code Change Timeline — MexiPay DPS Backend (July 2026)</title>
${style}
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Complete Code Change Timeline</h1>
    <p class="subtitle">A commit-by-commit history of all changes in the MexiPay DPS backend from 2026-07-03 through current HEAD, generated from rollback.md and git history.</p>
    <div class="file-badge">${badges.map(b => `<span>${esc(b)}</span>`).join('')}</div>
  </div>
  <div class="controls">
    <label><input type="checkbox" id="latest-only"> Latest only</label>
    <input type="text" id="search" placeholder="Filter by file or description…" autocomplete="off">
  </div>
  <div class="timeline">
    ${sections.map(entryHtml).join('')}
  </div>
  ${summaryHtml}
  <div class="footer"><p>Generated from <code>rollback.md</code> and the git log since 2026-07-03 — <code>${sections.length} commits</code> documented.</p></div>
</div>
<script>
(function(){
  const latestCheckbox = document.getElementById('latest-only');
  const searchInput = document.getElementById('search');
  const entries = document.querySelectorAll('.timeline .entry');
  function getSearchText(entry){
    const els = entry.querySelectorAll('h3, .date, .file-refs .filename, .field-content.searchable');
    return Array.from(els).map(e => e.textContent).join(' ').toLowerCase();
  }
  function update(){
    const term = (searchInput.value || '').toLowerCase();
    const latestOnly = latestCheckbox.checked;
    const visible = [];
    entries.forEach(function(entry){
      const text = getSearchText(entry);
      const matches = !term || text.includes(term);
      entry.style.display = matches ? '' : 'none';
      if(matches) visible.push(entry);
    });
    if(latestOnly){
      visible.slice(0, -1).forEach(function(entry){ entry.style.display = 'none'; });
    }
  }
  searchInput.addEventListener('input', update);
  latestCheckbox.addEventListener('change', update);
})();
</script>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote', outPath);
