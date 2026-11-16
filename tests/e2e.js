const { chromium } = require('playwright');
const path = require('path'); const os = require('os');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const shot = (n) => path.join(os.tmpdir(), n);
const results = []; let cur = '';
function ok(cond, msg) { results.push([!!cond, cur + ' › ' + msg]); }
async function section(name, fn) { cur = name; try { await fn(); } catch (e) { results.push([false, name + ' › threw: ' + e.message.split('\n')[0]]); } }

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => ({ nodes: S.nodes.map(n => ({ ...n })), edges: S.edges.map(e => ({ ...e })), sel, hints: S.hints, result: S.result, revealed: S.revealed, current: store.current }));
  const nodeEl = id => p.locator(`.node[data-id="${id}"]`);
  async function dragPalette(kind, tx, ty) {
    const bx = await p.locator(`.pitem[data-kind="${kind}"]`).boundingBox(); const sc = await p.locator('#scroller').boundingBox();
    await p.mouse.move(bx.x + 20, bx.y + 12); await p.mouse.down();
    await p.mouse.move(bx.x + 120, bx.y + 20, { steps: 4 }); await p.mouse.move(sc.x + tx, sc.y + ty, { steps: 8 }); await p.mouse.up();
  }
  async function wire(a, b2) {
    await nodeEl(a).hover();
    const pb = await nodeEl(a).locator('.port').boundingBox(); const tb = await nodeEl(b2).boundingBox();
    await p.mouse.move(pb.x + 9, pb.y + 9); await p.mouse.down(); await p.mouse.move(tb.x + 60, tb.y + 30, { steps: 8 }); await p.mouse.up();
  }

  await section('Initial load', async () => {
    const s = await st();
    ok(s.current === 'url', 'opens on URL Shortener');
    ok(s.nodes.length === 1 && s.nodes[0].kind === 'client', 'starter Web Client on board');
    ok(await p.locator('.pitem').count() === 44, '44 palette components (29 core + 15 AI)');
    ok(await p.locator('#paneBrief').isVisible(), 'Brief tab visible');
    ok((await p.textContent('#paneBrief')).includes('Back of the envelope'), 'brief has capacity estimates');
    ok(await p.locator('#undoBtn').isDisabled(), 'Undo disabled initially');
    ok(await p.locator('#emptyHint').isVisible(), 'empty-board hint shown');
  });

  await section('Palette filter', async () => {
    await p.fill('#pfilter', 'cache');
    const vis = await p.locator('.pitem:visible').count();
    ok(vis >= 1 && vis < 29, `filter narrows list (${vis} visible)`);
    ok(await p.locator('.pgroup[data-cat="client"]').isHidden(), 'empty groups hidden');
    await p.fill('#pfilter', ''); ok(await p.locator('.pitem:visible').count() === 44, 'clearing filter restores all');
  });

  let lb, app, cache, db;
  await section('Add components', async () => {
    await dragPalette('lb', 330, 80);
    let s = await st(); lb = s.nodes.at(-1);
    ok(lb && lb.kind === 'lb', 'drag from palette adds Load Balancer');
    ok(lb.x % 10 === 0 && lb.y % 10 === 0, 'dropped position snaps to 10px grid');
    ok(s.sel && s.sel.id === lb.id && await p.locator('#paneInspect').isVisible(), 'new node selected and Inspect shown');
    ok(await p.locator('#emptyHint').isHidden(), 'empty hint hides');
    await p.locator('.pitem[data-kind="app"]').click();
    s = await st(); app = s.nodes.at(-1); ok(app.kind === 'app', 'click/tap adds App Server');
    await p.locator('.pitem[data-kind="cache"]').focus(); await p.keyboard.press('Enter');
    s = await st(); cache = s.nodes.at(-1); ok(cache.kind === 'cache', 'keyboard Enter adds Cache');
    const ov = s.nodes.filter((a, i) => s.nodes.some((b2, j) => j > i && Math.abs(a.x - b2.x) < 172 && Math.abs(a.y - b2.y) < 58));
    ok(ov.length === 0, 'tap-added nodes do not overlap');
    // drop outside board does nothing
    const n0 = s.nodes.length; const bx = await p.locator('.pitem[data-kind="sql"]').boundingBox();
    await p.mouse.move(bx.x + 20, bx.y + 10); await p.mouse.down(); await p.mouse.move(bx.x + 100, 20, { steps: 5 }); await p.mouse.up();
    ok((await st()).nodes.length === n0, 'dropping outside the board adds nothing');
    ok(await p.locator('.ghost').count() === 0, 'drag ghost cleaned up');
    await dragPalette('nosql', 680, 640); db = (await st()).nodes.at(-1);
  });

  await section('Move nodes', async () => {
    const before = (await st()).nodes.find(n => n.id === app.id);
    const bb = await nodeEl(app.id).boundingBox();
    await p.mouse.move(bb.x + 50, bb.y + 30); await p.mouse.down(); await p.mouse.move(bb.x + 50, bb.y + 30 + 137, { steps: 8 }); await p.mouse.up();
    const after = (await st()).nodes.find(n => n.id === app.id);
    ok(after.y > before.y + 100 && after.y % 10 === 0, `node moves and snaps (${before.y}→${after.y})`);
    await p.mouse.move(bb.x + 50, bb.y + 30 + 137); await p.mouse.down(); await p.mouse.move(bb.x + 50, bb.y + 30 + 137 - 137, { steps: 8 }); await p.mouse.up();
    // drag to beyond board edge is clamped
    const cb = await nodeEl(cache.id).boundingBox();
    await p.mouse.move(cb.x + 50, cb.y + 30); await p.mouse.down(); await p.mouse.move(cb.x - 2000, cb.y - 2000, { steps: 4 }); await p.mouse.up();
    const c2 = (await st()).nodes.find(n => n.id === cache.id);
    ok(c2.x >= 0 && c2.y >= 10, 'position clamped inside board');
    await p.evaluate(id => { const n = S.nodes.find(n => n.id === id); n.x = 560; n.y = 100; changed(); }, cache.id);
  });

  const client = (await st()).nodes[0];
  await section('Connect', async () => {
    await wire(client.id, lb.id); let s = await st();
    ok(s.edges.length === 1 && s.edges[0].from === client.id && s.edges[0].to === lb.id, 'port drag creates client→LB edge');
    ok(await p.locator('.wire').count() === 1, 'wire drawn');
    await wire(lb.id, client.id); s = await st();
    ok(s.edges.length === 1, 'reverse duplicate rejected');
    ok(!(await p.isHidden('#toast')) && (await p.textContent('#toast')).includes('already connected'), 'duplicate toast shown');
    await wire(lb.id, lb.id); ok((await st()).edges.length === 1, 'self-connection ignored');
    // drop on empty board
    await nodeEl(lb.id).hover(); const pb = await nodeEl(lb.id).locator('.port').boundingBox();
    await p.mouse.move(pb.x + 9, pb.y + 9); await p.mouse.down(); await p.mouse.move(pb.x + 300, pb.y + 450, { steps: 6 }); await p.mouse.up();
    ok((await st()).edges.length === 1, 'drop on empty space creates nothing');
    ok((await p.getAttribute('#tempWire', 'd')) === '', 'temp wire cleared');
    await wire(lb.id, app.id); await wire(app.id, cache.id); await wire(app.id, db.id);
    ok((await st()).edges.length === 4, '4 edges total');
  });

  await section('Select & inspect node', async () => {
    await nodeEl(app.id).click();
    ok((await st()).sel.id === app.id, 'click selects node');
    ok(await nodeEl(app.id).evaluate(e => e.classList.contains('sel')), 'selected style');
    const txt = await p.textContent('#paneInspect');
    ok(txt.includes('Stateless web/API servers'), 'description shown');
    ok(txt.includes('Load Balancer') && txt.includes('Cache'), 'connections listed');
    await p.fill('#nlabel', 'Shortener API');
    ok((await nodeEl(app.id).textContent()).includes('Shortener API'), 'label edit updates board');
    ok((await nodeEl(app.id).textContent()).includes('App Server'), 'kind shown under custom label');
    await p.click('#repPlus'); await p.click('#repPlus');
    ok((await st()).nodes.find(n => n.id === app.id).replicas === 3, 'replicas → 3');
    ok((await nodeEl(app.id).textContent()).includes('×3') && await nodeEl(app.id).evaluate(e => e.classList.contains('multi')), '×3 badge and stacked look');
    await p.click('#repMinus'); await p.click('#repMinus'); await p.click('#repMinus');
    ok((await st()).nodes.find(n => n.id === app.id).replicas === 1, 'replicas floor at 1');
    await p.click('#repPlus'); await p.click('#repPlus');
    const n0 = (await st()).nodes.length; await p.click('#dupBtn'); const s = await st();
    const dup = s.nodes.at(-1);
    ok(s.nodes.length === n0 + 1 && dup.label === 'Shortener API' && dup.replicas === 3, 'duplicate copies label and replicas');
    await p.click('#delBtn'); ok((await st()).nodes.length === n0, 'delete button removes node');
  });

  await section('Edge select / reverse / delete', async () => {
    const e = (await st()).edges.find(x => x.from === app.id && x.to === db.id);
    const box = await p.locator(`.wire[data-edge="${e.id}"] .hit`).boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    let s = await st(); ok(s.sel && s.sel.t === 'edge' && s.sel.id === e.id, 'clicking wire selects it');
    ok((await p.textContent('#paneInspect')).includes('Connection'), 'connection inspector');
    await p.click('#revBtn'); s = await st();
    const e2 = s.edges.find(x => x.id === e.id); ok(e2.from === db.id && e2.to === app.id, 'reverse direction');
    await p.click('#delBtn'); ok(!(await st()).edges.find(x => x.id === e.id), 'delete connection');
    await p.click('#undoBtn'); ok((await st()).edges.find(x => x.id === e.id), 'undo restores connection');
  });

  await section('Keyboard & deselect', async () => {
    await p.locator('.pitem[data-kind="dns"]').click(); const dns = (await st()).nodes.at(-1);
    await p.mouse.click((await nodeEl(dns.id).boundingBox()).x + 40, (await nodeEl(dns.id).boundingBox()).y + 20);
    await p.keyboard.press('Delete'); ok(!(await st()).nodes.find(n => n.id === dns.id), 'Delete key removes selected node');
    await p.keyboard.press('Control+z'); ok((await st()).nodes.find(n => n.id === dns.id), 'Ctrl+Z restores it');
    await nodeEl(dns.id).click(); await p.keyboard.press('Escape'); ok((await st()).sel === null, 'Escape deselects');
    await nodeEl(dns.id).click(); await p.mouse.click((await p.locator('#scroller').boundingBox()).x + 700, (await p.locator('#scroller').boundingBox()).y + 780);
    ok((await st()).sel === null, 'clicking empty board deselects');
    await nodeEl(app.id).click(); await p.focus('#nlabel'); await p.keyboard.press('Backspace');
    ok((await st()).nodes.find(n => n.id === app.id), 'Backspace in label input does not delete node');
    await p.fill('#nlabel', 'Shortener API');
    await nodeEl(dns.id).click(); await p.keyboard.press('Backspace');
    ok(!(await st()).nodes.find(n => n.id === dns.id), 'Backspace removes node; its wires too');
    // edges of deleted node removed
    await p.locator('.pitem[data-kind="dns"]').click(); const d2 = (await st()).nodes.at(-1); await wire(d2.id, client.id);
    const ne = (await st()).edges.length; await nodeEl(d2.id).click(); await p.keyboard.press('Delete');
    ok((await st()).edges.length === ne - 1, 'deleting node removes its connections');
  });

  await section('Undo history', async () => {
    const s0 = await st(); await p.locator('.pitem[data-kind="search"]').click(); await p.locator('.pitem[data-kind="blob"]').click();
    await p.click('#undoBtn'); await p.click('#undoBtn');
    const s1 = await st(); ok(s1.nodes.length === s0.nodes.length, 'two undos remove two adds');
    const bb = await nodeEl(lb.id).boundingBox(); const y0 = s1.nodes.find(n => n.id === lb.id).y;
    await p.mouse.move(bb.x + 50, bb.y + 30); await p.mouse.down(); await p.mouse.move(bb.x + 50, bb.y + 130, { steps: 5 }); await p.mouse.up();
    await p.click('#undoBtn'); ok((await st()).nodes.find(n => n.id === lb.id).y === y0, 'undo reverts a move');
  });

  await section('Hints', async () => {
    await p.click('#tabBrief'); await p.click('#hintBtn');
    ok((await st()).hints === 1 && await p.locator('.hint').count() === 1, 'hint 1 revealed');
    await p.click('#hintBtn'); await p.click('#hintBtn');
    ok(await p.locator('.hint').count() === 3 && await p.locator('#hintBtn').count() === 0, 'all 3 hints, button gone');
  });

  await section('Submit & score', async () => {
    await p.click('#submitBtn'); const s = await st();
    ok(await p.locator('#paneScore').isVisible(), 'Scorecard tab opens');
    const r = s.result;
    // expected: FR10 CL-FR5 FR-CP5 C10 store15 CP-DB10 cache15 CP-cache10 = 80/100, idgen missing 20 => 80 - 15 hints = 65
    ok(r.score === 65, `score computed correctly (got ${r.score}, expected 65 = 80 − 15 hint penalty)`);
    ok(r.stars === 1 && (await p.textContent('.verdict')) === 'Lean no hire', '1 star / Lean no hire');
    ok(r.items.filter(i => !i.ok && !i.bonus).length === 2, 'two missing rubric items listed');
    ok((await p.textContent('#paneScore')).includes('Hints revealed (3)'), 'hint deduction listed');
    ok((await p.textContent('#tabScore')).includes('65'), 'score badge on tab');
    ok((await p.textContent('#paneScore')).includes('Interviewer follow-ups'), 'follow-ups shown');
    ok(await p.evaluate(() => store.best.url) === 65, 'best score recorded');
  });

  await section('Penalties', async () => {
    const r = await p.evaluate(() => {
      const c = CHALLENGES[0]; const h = S.hints; S.hints = 0;
      const nodes = [{ id: 'a', kind: 'client', replicas: 1, label: 'c' }, { id: 'b', kind: 'sql', replicas: 1, label: 'db' }, { id: 'c', kind: 'cache', replicas: 1, label: 'x' }, { id: 'd', kind: 'dns', replicas: 1, label: 'lonely' }];
      const out = evaluate(c, nodes, [{ from: 'a', to: 'b' }, { from: 'c', to: 'a' }]); S.hints = h; return out;
    });
    ok(r.penalties.some(x => x.label.includes('datastore') && x.pts === 20), 'client→datastore penalty (2× capped 20)');
    ok(r.penalties.some(x => x.label.includes('lonely') && x.pts === 3), 'unconnected penalty');
    ok(r.score >= 0, 'score clamped at ≥ 0');
  });

  await section('Traffic simulation', async () => {
    await p.locator('.pitem[data-kind="warehouse"]').click(); const dw = (await st()).nodes.at(-1);
    await p.click('#trafficBtn'); await p.waitForTimeout(700);
    const packets = await p.locator('.packet').count();
    ok(packets > 0, `packets animate (${packets})`);
    ok(await nodeEl(dw.id).evaluate(e => e.classList.contains('cold')), 'unreached node dimmed');
    ok((await p.textContent('#toast')).includes('got no traffic'), 'toast reports unreached');
    await p.waitForTimeout(5000);
    ok(await p.locator('.packet').count() === 0 && !(await nodeEl(dw.id).evaluate(e => e.classList.contains('cold'))), 'animation ends and cleans up');
    await nodeEl(dw.id).click(); await p.keyboard.press('Delete');
  });

  await section('Persistence', async () => {
    const before = await st(); await p.reload(); await p.waitForTimeout(300); const after = await st();
    ok(after.nodes.length === before.nodes.length && after.edges.length === before.edges.length, 'board survives reload');
    ok(after.nodes.some(n => n.label === 'Shortener API' && n.replicas === 3), 'labels and replicas persisted');
    ok(after.result && after.result.score === 65 && await p.locator('#paneScore').isVisible(), 'last scorecard restored');
    ok(await p.evaluate(() => store.best.url) === 65, 'best persisted');
  });

  await section('Timer', async () => {
    const t1 = await p.textContent('#timer'); await p.waitForTimeout(2100); const t2 = await p.textContent('#timer');
    ok(/^\d\d:\d\d$/.test(t2) && t1 !== t2, `ticks (${t1} → ${t2})`);
    await p.evaluate(() => { S.t0 = Date.now() - 46 * 60000; }); await p.waitForTimeout(1100);
    ok(await p.locator('#timer.over').count() === 1, 'turns warning colour after 45 min');
    await p.evaluate(() => { S.t0 = Date.now(); });
  });

  await section('Reference design', async () => {
    await p.click('#refBtn'); ok((await p.textContent('#refBtn')).includes('Replace'), 'first click asks to confirm');
    await p.click('#refBtn'); const s = await st();
    ok(s.revealed && s.nodes.length === 8, 'reference loaded');
    ok(s.result.score === 93, `reference scored (100 + 8 extra credit − 15 hints = ${s.result.score})`);
    ok(await p.evaluate(() => store.best.url) === 65, 'best NOT updated after reveal');
    ok((await p.textContent('#paneScore')).includes("doesn't count"), 'note explains');
    await p.click('#undoBtn'); ok((await st()).nodes.some(n => n.label === 'Shortener API'), 'undo brings own board back');
  });

  await section('Clear', async () => {
    await p.click('#clearBtn'); ok((await p.textContent('#clearBtn')).includes('?'), 'first click asks to confirm');
    await p.waitForTimeout(3200); ok((await p.textContent('#clearBtn')) === 'Clear', 'confirmation times out');
    await p.click('#clearBtn'); await p.click('#clearBtn'); const s = await st();
    ok(s.nodes.length === 1 && s.edges.length === 0 && s.hints === 0 && !s.result && !s.revealed, 'board reset to starter, hints & result cleared');
    ok(await p.locator('#paneBrief').isVisible() && await p.locator('#hintBtn').count() === 1, 'brief shown, hints available again');
    await p.click('#undoBtn'); ok((await st()).nodes.length > 1, 'clear is undoable');
  });

  await section('Level picker & switching', async () => {
    await p.click('#levelBtn'); ok(await p.locator('#levels').isVisible() && await p.locator('.level').count() === 17, 'picker shows 17 prompts');
    ok((await p.locator('.level[data-id="url"]').textContent()).includes('best 65'), 'best score on card');
    await p.keyboard.press('Escape'); ok(await p.locator('#levels').isHidden(), 'Escape closes');
    await p.click('#levelBtn'); await p.click('#levelsClose'); ok(await p.locator('#levels').isHidden(), 'Close button closes');
    await p.click('#levelBtn'); await p.mouse.click(5, 890); ok(await p.locator('#levels').isHidden(), 'backdrop click closes');
    await p.click('#levelBtn'); await p.click('.level[data-id="chat"]');
    let s = await st(); ok(s.current === 'chat' && s.nodes.length === 1 && s.nodes[0].kind === 'mobile', 'Chat loads with Mobile starter');
    ok((await p.textContent('#pickTitle')) === 'Chat Messenger' && (await p.textContent('#pickDiff')) === 'medium', 'header updated');
    ok(await p.locator('#undoBtn').isDisabled(), 'undo history reset per prompt');
    await p.click('#levelBtn'); await p.click('.level[data-id="url"]');
    s = await st(); ok(s.nodes.some(n => n.label === 'Shortener API'), 'URL board preserved when switching back');
  });

  await section('All prompts: reference = 100, Next button', async () => {
    const ids = await p.evaluate(() => CHALLENGES.map(c => c.id));
    for (const id of ids.filter(i => i !== 'sandbox')) {
      await p.evaluate(i => loadChallenge(i), id);
      await p.click('#submitBtn'); await p.click('#refBtn'); await p.click('#refBtn');
      const s = await st();
      ok(s.result.score === 100 && s.result.stars === 3, `${id}: reference via UI scores ${s.result.score}`);
    }
    await p.evaluate(() => loadChallenge('url')); await p.click('#tabScore');
    await p.click('#nextBtn'); ok((await st()).current === 'ratelimit', 'Next goes to the following prompt');
  });

  await section('Sandbox', async () => {
    await p.evaluate(() => loadChallenge('sandbox')); let s = await st();
    ok(s.nodes.length === 0 && await p.locator('#hintBtn').count() === 0, 'empty board, no hints');
    await p.locator('.pitem[data-kind="client"]').click(); await p.locator('.pitem[data-kind="sql"]').click();
    s = await st(); await wire(s.nodes[0].id, s.nodes[1].id); await p.click('#submitBtn');
    s = await st(); ok(s.result.score == null, 'not scored');
    const t = await p.textContent('#paneScore'); ok(t.includes('aren\'t scored') && t.includes('datastore'), 'general checks flag client→DB');
    await p.click('#trafficBtn'); ok((await p.textContent('#toast')).includes('reached all 2'), 'traffic works without a rubric');
  });

  await section('Advanced notes', async () => {
    await p.evaluate(() => { loadChallenge('chat'); S.result = null; S.adv = false; persist(); renderScore(); });
    await p.click('#tabAdv');
    ok(await p.locator('#advOpen').isVisible(), 'spoiler gate shown before submitting');
    await p.click('#advOpen');
    for (const id of ['api', 'data', 'trade', 'fail', 'scale', 'metrics']) ok(await p.locator('#paneAdv #adv-' + id).isVisible(), 'section ' + id + ' rendered');
    ok(await p.evaluate(() => S.score === undefined && S.result == null), 'opening notes does not submit or score');
    await p.reload(); await p.waitForTimeout(300); await p.click('#tabAdv');
    ok(await p.locator('#advOpen').count() === 0 && await p.locator('#paneAdv .ep').count() > 0, 'opened state persists after reload');
    await p.click('[data-jump="metrics"]'); await p.waitForTimeout(700);
    const top = await p.locator('#paneAdv #adv-metrics').boundingBox(); const pane = await p.locator('#paneAdv').boundingBox();
    ok(top.y < pane.y + pane.height && top.y >= pane.y - 5, 'section links scroll to the section');
    await p.click('#advExpand');
    ok(await p.locator('#advWide').isVisible() && (await p.textContent('#advWideTitle')).includes('Chat Messenger'), 'wide view opens');
    ok(await p.locator('#advWideBody .ent').count() === 3, 'wide view shows data model');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('#advWideBody .adv-grid')).gridTemplateColumns.split(' ').length) === 2, 'wide view uses two columns');
    await p.keyboard.press('Escape'); ok(await p.locator('#advWide').isHidden(), 'Escape closes wide view');
    await p.click('#advExpand'); await p.click('#advWideClose'); ok(await p.locator('#advWide').isHidden(), 'Close button closes');
    await p.click('#advExpand'); await p.mouse.click(5, 450); ok(await p.locator('#advWide').isHidden(), 'backdrop closes');
    await p.click('#tabBrief'); await p.click('#advLink'); ok(await p.locator('#paneAdv').isVisible(), 'Brief link opens Advanced');
    await p.click('#submitBtn'); await p.click('#advLink2'); ok(await p.locator('#paneAdv').isVisible(), 'Scorecard "Go deeper" opens Advanced');
    const ids = await p.evaluate(() => Object.keys(ADV));
    ok(ids.length === 16, 'notes exist for all 16 prompts');
    for (const id of ids) {
      await p.evaluate(i => { loadChallenge(i); S.adv = true; }, id); await p.click('#tabAdv');
      const c = await p.evaluate(() => ({ ep: document.querySelectorAll('#paneAdv .ep').length, ent: document.querySelectorAll('#paneAdv .ent').length, tr: document.querySelectorAll('#paneAdv .tr').length, chosen: [...document.querySelectorAll('#paneAdv .tr')].every(t => t.querySelector('.chosen')), fl: document.querySelectorAll('#paneAdv .fl').length, st: document.querySelectorAll('#paneAdv .steps li').length, mt: document.querySelectorAll('#paneAdv .chips span').length, wide: document.getElementById('paneAdv').scrollWidth <= document.getElementById('paneAdv').clientWidth + 1 }));
      ok(c.ep >= 3 && c.ent >= 2 && c.tr >= 4 && c.fl >= 4 && c.st >= 4 && c.mt >= 4, `${id}: ${c.ep} APIs, ${c.ent} entities, ${c.tr} trade-offs, ${c.fl} failures, ${c.st} steps, ${c.mt} metrics`);
      ok(c.chosen, `${id}: every trade-off highlights its pick`);
      ok(c.wide, `${id}: no sideways overflow in panel`);
    }
    await p.evaluate(() => loadChallenge('sandbox')); await p.click('#tabAdv');
    ok(await p.locator('#advOpen').count() === 0 && (await p.textContent('#paneAdv')).includes('Interview framework'), 'Sandbox shows the interview framework, no gate');
    await p.evaluate(() => loadChallenge('url')); await p.click('#clearBtn'); await p.click('#clearBtn');
    await p.click('#tabAdv'); ok(await p.locator('#advOpen').isVisible(), 'Clear re-arms the spoiler gate');
    await p.click('#undoBtn');
  });

  await section('Scorecard: request flow and follow-up answers', async () => {
    const data = await p.evaluate(() => CHALLENGES.filter(c => c.ref).map(c => ({ id: c.id, f: c.followups.length, a: (ANSWERS[c.id] || []).length, flow: (FLOW[c.id] || '').length })));
    ok(data.every(d => d.f === d.a && d.a >= 4), 'every follow-up question has an answer (' + data.map(d => d.a).reduce((x, y) => x + y) + ' total)');
    ok(data.every(d => d.flow > 300), 'every prompt has a request-flow paragraph');
    for (const { id } of data) {
      await p.evaluate(i => loadChallenge(i), id); await p.click('#submitBtn');
      const flow = await p.textContent('#paneScore .flow');
      ok(flow === await p.evaluate(i => FLOW[i], id) && (await p.textContent('#paneScore')).includes('How a request flows · reference design'), `${id}: flow paragraph shown`);
      const qa = p.locator('#paneScore .qa');
      ok(await qa.count() >= 4 && await p.locator('#paneScore .qa[open]').count() === 0, `${id}: answers start collapsed`);
      ok(await qa.first().locator('p').isHidden(), `${id}: answer text hidden until opened`);
    }
    await qa1();
    async function qa1() {
      const first = p.locator('#paneScore .qa').first();
      await first.locator('summary').click();
      ok(await first.locator('p').isVisible() && (await first.locator('p').textContent()).length > 80, 'clicking a question reveals its answer');
      await p.click('#qaAll');
      ok(await p.locator('#paneScore .qa[open]').count() === await p.locator('#paneScore .qa').count(), 'Show all answers opens every answer');
      ok((await p.textContent('#qaAll')) === 'Hide all answers' && (await p.getAttribute('#qaAll', 'aria-pressed')) === 'true', 'button switches to Hide all answers');
      await p.click('#qaAll');
      ok(await p.locator('#paneScore .qa[open]').count() === 0, 'Hide all answers closes them');
      await p.locator('#paneScore .qa summary').nth(1).click(); await p.locator('#paneScore .qa summary').nth(0).click(); await p.locator('#paneScore .qa summary').nth(2).click(); await p.locator('#paneScore .qa summary').nth(3).click();
      await p.waitForTimeout(50);
      ok((await p.textContent('#qaAll')) === 'Hide all answers', 'opening every answer one by one updates the button');
    }
    await p.evaluate(() => loadChallenge('sandbox')); await p.click('#clearBtn'); await p.click('#clearBtn');
    for (const k of ['client', 'lb', 'app', 'cache', 'dns']) await p.locator(`.pitem[data-kind="${k}"]`).click();
    const ids = await p.evaluate(() => S.nodes.map(n => n.id));
    await p.evaluate(([a, b, c, d]) => { S.edges.push({ id: 'ex1', from: a, to: b }, { id: 'ex2', from: b, to: c }, { id: 'ex3', from: c, to: d }); changed(); }, ids);
    await p.click('#submitBtn');
    const sf = await p.textContent('#paneScore .flow');
    ok(sf.includes('Web Client → Load Balancer → App Server → Cache') && sf.includes('3 hops'), 'Sandbox traces the path through your own board');
    ok(sf.includes('1 component is not reachable'), 'Sandbox flow reports unreachable components');
    ok(await p.locator('#qaAll').count() === 0, 'Sandbox has no follow-up questions');
  });

  // ================= v2: AI components and prompts =================
  const addKind = async (k) => { await p.locator(`.pitem[data-kind="${k}"]`).click(); return (await st()).nodes.at(-1).id; };
  await section('v2 · AI palette', async () => {
    await p.evaluate(() => loadChallenge('sandbox')); await p.click('#clearBtn'); await p.click('#clearBtn');
    ok(await p.locator('.pgroup[data-scope="ai"]').count() === 5, 'five AI groups, as in the script');
    await p.click('.pscope [data-scope="ai"]');
    ok(await p.locator('.pitem:visible').count() === 15 && await p.locator('.pgroup[data-cat="client"]').isHidden(), 'AI filter shows only the 15 AI components');
    await p.click('.pscope [data-scope="core"]');
    ok(await p.locator('.pitem:visible').count() === 29 && await p.locator('.pgroup[data-cat="ai-brain"]').isHidden(), 'Core filter shows the 29 classic components');
    await p.click('.pscope [data-scope="ai"]'); await p.reload(); await p.waitForTimeout(300);
    ok((await p.getAttribute('.pscope [data-scope="ai"]', 'aria-pressed')) === 'true' && await p.locator('.pitem:visible').count() === 15, 'filter choice remembered');
    await p.fill('#pfilter', 'policy'); ok(await p.locator('.pitem:visible').count() >= 1 && await p.locator('.pitem[data-kind="policy"]').isVisible(), 'search works inside the AI filter');
    await p.fill('#pfilter', ''); await p.click('.pscope [data-scope="all"]');
  });

  await section('v2 · Controls on AI components', async () => {
    const pid = await addKind('planner');
    ok(await p.locator('#paneInspect .say').isVisible() && (await p.textContent('#paneInspect .say')).includes('hard caps'), 'interview line shown for the orchestrator');
    ok(await p.locator('#paneInspect [data-ctl]').count() === 3, 'orchestrator has three controls');
    await p.fill('#ctl-maxSteps', '8'); await p.fill('#ctl-tokenBudget', '40'); await p.check('#ctl-handoff');
    let n = (await st()).nodes.find(x => x.id === pid);
    ok(n.ctl.maxSteps === 8 && n.ctl.tokenBudget === 40 && n.ctl.handoff === true, 'controls stored on the component');
    ok((await nodeEl(pid).textContent()).includes('≤ 8 steps · 40k tokens · hands off'), 'controls shown on the board');
    await p.fill('#ctl-maxSteps', ''); n = (await st()).nodes.find(x => x.id === pid);
    ok(!('maxSteps' in n.ctl), 'clearing a control removes it');
    await p.click('#undoBtn'); n = (await st()).nodes.find(x => x.id === pid);
    ok(n.ctl && n.ctl.maxSteps === 8, 'undo restores controls');
    await nodeEl(pid).click(); await p.click('#dupBtn');
    const dup = (await st()).nodes.at(-1); ok(dup.kind === 'planner' && dup.ctl && dup.ctl.tokenBudget === 40, 'duplicate copies controls');
    const pol = await addKind('policy');
    ok((await p.textContent('#paneInspect .say')).includes('50-dollar limit'), 'policy shows the 50-dollar line');
    await p.fill('#ctl-rule', 'Refunds up to $50 auto'); ok((await nodeEl(pol).textContent()).includes('Refunds up to $50 auto'), 'policy rule shown on the board');
    await addKind('llm'); await p.selectOption('#ctl-tier', 'Small + large');
    ok((await st()).nodes.at(-1).ctl.tier === 'Small + large', 'model tier select works');
    await p.reload(); await p.waitForTimeout(300);
    ok((await st()).nodes.find(x => x.id === pol).ctl.rule === 'Refunds up to $50 auto', 'controls survive reload');
    ok(await p.locator('#drillBtn').isVisible(), 'Attack drills button appears once there is an agent');
    await p.evaluate(() => loadChallenge('url')); ok(await p.locator('#drillBtn').isHidden(), 'and stays hidden on boards without one');
  });

  await section('v2 · Scoring rules from the script', async () => {
    const r = await p.evaluate(() => {
      const c = challengeById('support'); const ref = fullRef(c); const h = S.hints; S.hints = 0;
      const sc = (mut) => { const b = buildBoard(ref.nodes, ref.edges); const k = (kd) => b.nodes.find(n => n.kind === kd).id; mut(b, k); const e = evaluate(c, b.nodes, b.edges); return { score: e.score, miss: e.items.filter(i => !i.ok && !i.bonus).map(i => i.label), pen: e.penalties.map(x => x.label) }; };
      const out = {
        full: sc(() => {}),
        bypass: sc((b, k) => b.edges.push({ id: 'x1', from: k('planner'), to: k('tools') })),
        direct: sc((b, k) => b.edges.push({ id: 'x2', from: k('planner'), to: b.nodes.find(n => n.label === 'Refund service').id })),
        noguard: sc((b, k) => b.edges.push({ id: 'x3', from: k('client'), to: k('planner') })),
        rawllm: sc((b, k) => b.edges.push({ id: 'x4', from: k('planner'), to: k('llm') })),
        noctl: sc((b, k) => { b.nodes.find(n => n.kind === 'policy').ctl = {}; }),
        nopolicy: sc((b, k) => { const pid = k('policy'); b.edges = b.edges.filter(e => e.from !== pid && e.to !== pid); b.edges.push({ id: 'x5', from: k('planner'), to: k('agentid') }); }),
      };
      S.hints = h; return out;
    });
    ok(r.full.score === 100, 'support reference scores 100');
    ok(r.bypass.miss.some(m => m.includes('without passing policy')), 'a wire from the agent straight to the tools fails the policy gate');
    ok(r.nopolicy.miss.some(m => m.includes('without passing policy')), 'removing policy from the route fails the gate');
    ok(r.direct.pen.some(m => m.includes('straight to business systems')), 'agent wired to a business service is penalised');
    ok(r.noguard.pen.some(m => m.includes('without guardrails')), 'user messages reaching the agent directly are penalised');
    ok(r.rawllm.pen.some(m => m.includes('through the LLM gateway')), 'agent calling the model directly is penalised');
    ok(r.noctl.miss.some(m => m.includes('refund rule')), 'a policy without a rule misses its rubric item (pair capability with control)');
  });

  await section('v2 · Add-AI prompts build on classic designs', async () => {
    await p.click('#levelBtn');
    ok(await p.locator('.level-sec').count() === 4 && (await p.textContent('#levelGrid')).includes('Add AI to a design'), 'picker grouped into four sections');
    ok((await p.textContent('.level[data-id="ridesupport"]')).includes('Builds on Ride-Hailing Dispatch'), 'Add-AI cards say what they build on');
    ok(await p.locator('.level[data-id="support"] .tag-ai').count() === 1 && await p.locator('.level[data-id="url"] .tag-ai').count() === 0, 'AI prompts tagged');
    await p.click('.level[data-id="ridesupport"]'); await p.waitForTimeout(200);
    await p.click('#clearBtn'); await p.click('#clearBtn');
    const s0 = await st(); const rideRef = await p.evaluate(() => challengeById('ride').ref);
    ok(s0.nodes.length === rideRef.nodes.length && s0.edges.length === rideRef.edges.length, `starts with the finished Ride-Hailing design (${s0.nodes.length} components)`);
    ok(await p.locator('#pickAI').isVisible() && (await p.textContent('#paneBrief .builds')).includes('Builds on Ride-Hailing Dispatch'), 'header AI tag and Builds-on note');
    ok(await p.locator('#paneBrief .fourq li').count() === 4, 'Brief lists the four questions');
    await p.click('#tabBrief'); ok(await p.locator('#useMine').isVisible(), 'offers to start from your own Ride-Hailing board');
    const mine = await p.evaluate(() => store.saves.ride.nodes.length);
    await p.click('#useMine'); ok((await st()).nodes.length === mine, 'Start from my board loads it');
    await p.click('#undoBtn'); ok((await st()).nodes.length === s0.nodes.length, 'undo brings the reference start back');
    await p.click('#submitBtn');
    ok(await p.locator('#paneScore .qgroup').count() === 4, 'scorecard grouped under the four questions');
    const starterScore = (await st()).result.score; ok(starterScore < 20, `the base design alone scores low (${starterScore})`);
    await p.evaluate(() => loadChallenge('ride')); await p.click('#submitBtn');
    ok(await p.locator('#aiNext').isVisible() && (await p.textContent('#aiNext')).includes('Rider Support Agent'), 'Ride-Hailing scorecard offers to continue with AI');
    await p.click('#aiNext'); ok((await st()).current === 'ridesupport', 'continue opens Rider Support Agent');
    for (const [base, ai] of [['filesync', 'askfiles'], ['feed', 'moderation']]) {
      await p.evaluate(b => loadChallenge(b), base); await p.click('#submitBtn');
      ok((await p.textContent('#aiNext')).includes(await p.evaluate(a => challengeById(a).title, ai)), `${base} → ${ai} continuity link`);
    }
  });

  await section('v2 · Attack drills', async () => {
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.evaluate(() => loadChallenge('support')); await p.click('#submitBtn'); await p.click('#refBtn'); await p.click('#refBtn');
    ok(await p.locator('#drillBtn').isVisible(), 'drills available on the support reference');
    await p.click('#drillBtn'); await p.waitForTimeout(200);
    let d = await p.evaluate(() => S.drills); ok(d && d.results.length === 5, 'five drills run');
    ok(d.results.every(r => r.state === 'ok'), 'reference design blocks all five: ' + d.results.map(r => r.id + ':' + r.state).join(' '));
    ok((await p.textContent('#paneScore')).includes('Attack drills · 5 of 5 blocked'), 'results shown on the scorecard');
    // weaken it: remove policy rule, identity and citations, planner limits
    await p.evaluate(() => { for (const n of S.nodes) { if (['policy', 'agentid', 'rag', 'planner', 'tools', 'memory'].includes(n.kind)) n.ctl = {}; } changed(); renderScore(); });
    ok((await p.textContent('#paneScore')).includes('changed since these ran'), 'stale results flagged after edits');
    await p.click('#drillAgain'); await p.waitForTimeout(200); d = await p.evaluate(() => S.drills);
    const by = Object.fromEntries(d.results.map(r => [r.id, r.state]));
    ok(by.inject !== 'ok' && by.agency === 'bad' && by.leak === 'bad' && by.halluc === 'warn' && by.cost === 'warn', 'weakened controls let attacks through: ' + JSON.stringify(by));
    ok(d.results.find(r => r.id === 'agency').text.includes('Cancelled 14 orders'), 'damage described');
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.click('#undoBtn'); await p.click('#drillBtn'); await p.waitForTimeout(600);
    ok(await p.locator('.packet.attack').count() === 1, 'animated attack travels along the wires');
    await p.waitForFunction(() => S.drills && S.drills.sig === boardSig(), null, { timeout: 30000 });
    ok(await p.evaluate(() => S.drills.results.every(r => r.state === 'ok')), 'animated run finishes and records results');
    await p.evaluate(() => loadChallenge('moderation')); ok(await p.locator('#drillBtn').isHidden(), 'no drills for a design without an agent');
  });

  await section('v2 · Advanced notes for AI prompts', async () => {
    for (const id of ['support', 'kb', 'aiplatform', 'ridesupport', 'askfiles', 'moderation']) {
      await p.evaluate(i => { loadChallenge(i); S.adv = true; }, id); await p.click('#tabAdv');
      const toc = await p.textContent('#paneAdv .adv-toc');
      ok(toc.includes('Rollout') && !toc.includes('Scaling') && await p.locator('#paneAdv #adv-rollout .steps li').count() === 4, `${id}: rollout plan instead of scaling path`);
      ok((await p.textContent('#paneAdv')).includes('Launch metrics'), `${id}: launch metrics`);
    }
    await p.evaluate(() => loadChallenge('support')); await p.click('#tabAdv');
    ok(await p.locator('#paneAdv .m-TOOL').count() >= 2, 'tool definitions in the API section');
  });

  await section('Tabs', async () => {
    for (const t of ['Brief', 'Inspect', 'Score', 'Adv']) { await p.click('#tab' + t); ok(await p.locator('#pane' + t).isVisible(), t + ' tab'); }
  });

  await section('Dark mode', async () => {
    await p.emulateMedia({ colorScheme: 'dark' });
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(bg === 'rgb(17, 22, 20)', 'dark palette applied (' + bg + ')');
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(244, 246, 243)', 'explicit light overrides OS dark');
  });

  // ---------- touch phone ----------
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const mp = await m.newPage(); mp.on('pageerror', e => errs.push('mobile: ' + e.message));
  await mp.goto(URL); await mp.waitForTimeout(300);
  const cdp = await m.newCDPSession(mp);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  async function touchDrag(x1, y1, x2, y2, steps = 12) {
    await touch('touchStart', x1, y1);
    for (let i = 1; i <= steps; i++) await touch('touchMove', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps);
    await touch('touchEnd');
  }
  const view = (pg) => pg.evaluate(() => ({ ...view }));
  const sel2 = (pg) => pg.evaluate(() => sel);
  await section('Phone (touch)', async () => {
    ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no horizontal page scroll');
    ok((await mp.locator('.bar').boundingBox()).height < 70, 'header fits on one row');
    ok(await mp.locator('#dock').isVisible() && await mp.locator('[data-dock="palette"]').isVisible(), 'bottom nav with Add button');
    ok(await mp.locator('#palette').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'palette sheet closed initially');
    ok(await mp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'panel sheet closed initially');
    const stageBox = await mp.locator('#scroller').boundingBox();
    ok(stageBox.width === 390 && stageBox.height > 600, `board fills the screen (${stageBox.width}×${Math.round(stageBox.height)})`);
    ok(await mp.locator('.port').first().evaluate(e => getComputedStyle(e).opacity) === '1', 'connect handles visible on touch');
    await mp.tap('[data-dock="palette"]'); await mp.waitForTimeout(350);
    ok(await mp.locator('#palette').evaluate(e => getComputedStyle(e).visibility) === 'visible', 'Add opens the component sheet');
    ok(await mp.evaluate(() => document.querySelector('#palette').scrollWidth <= document.querySelector('#palette').clientWidth + 1), 'component sheet has no sideways overflow');
    await mp.locator('.pitem[data-kind="lb"]').tap(); await mp.waitForTimeout(350);
    let n = await mp.evaluate(() => S.nodes.length); ok(n === 2, 'tap adds component');
    ok(await mp.locator('#palette').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'sheet closes after adding');
    const lbBox = await mp.locator('.node').nth(1).boundingBox();
    ok(lbBox.x >= 0 && lbBox.x + lbBox.width <= 390 && lbBox.y > stageBox.y, 'new component lands in view');
    ok(await mp.locator('#selbar').isVisible(), 'selection bar appears for the new component');
    await mp.tap('[data-dock="palette"]'); await mp.waitForTimeout(350);
    const it = await mp.locator('.pitem[data-kind="app"]').boundingBox();
    await touchDrag(it.x + it.width / 2, it.y + 15, 200, stageBox.y + 520, 16); await mp.waitForTimeout(300);
    n = await mp.evaluate(() => S.nodes.map(x => x.kind)); ok(n.length === 3 && n[2] === 'app', 'touch drag from the sheet onto the board adds component');
    const ids = await mp.evaluate(() => S.nodes.map(x => x.id));
    const pb = await mp.locator(`.node[data-id="${ids[0]}"] .port`).boundingBox(); const tb = await mp.locator(`.node[data-id="${ids[1]}"]`).boundingBox();
    await touchDrag(pb.x + 9, pb.y + 9, tb.x + 50, tb.y + 30);
    ok(await mp.evaluate(() => S.edges.length) === 1, 'touch drag from handle connects');
    const nb = await mp.locator(`.node[data-id="${ids[2]}"]`).boundingBox(); const y0 = await mp.evaluate(i => S.nodes.find(n => n.id === i).y, ids[2]);
    await touchDrag(nb.x + 40, nb.y + 30, nb.x + 40, nb.y - 60);
    ok(await mp.evaluate(i => S.nodes.find(n => n.id === i).y, ids[2]) < y0 - 40, 'touch drag moves node');
    await mp.locator(`.node[data-id="${ids[2]}"]`).tap(); ok((await sel2(mp)).t === 'node', 'tap selects node');
    await mp.tap('#selbar [data-act="plus"]'); await mp.tap('#selbar [data-act="plus"]');
    ok(await mp.evaluate(i => S.nodes.find(n => n.id === i).replicas, ids[2]) === 3 && (await mp.textContent('#selbar')).includes('×3'), 'selection bar + sets instances to 3');
    await mp.tap('#selbar [data-act="dup"]'); ok(await mp.evaluate(() => S.nodes.length) === 4, 'selection bar copies');
    await mp.tap('#selbar [data-act="del"]'); ok(await mp.evaluate(() => S.nodes.length) === 3, 'selection bar deletes');
    await mp.locator(`.node[data-id="${ids[2]}"]`).tap(); await mp.tap('#selbar [data-act="details"]'); await mp.waitForTimeout(350);
    ok(await mp.locator('#paneInspect').isVisible() && await mp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'visible', 'selection bar opens Inspect sheet');
    ok(await mp.locator('#selbar').isHidden(), 'selection bar hides under the sheet');
    await mp.tap('#scrim', { position: { x: 200, y: 40 } }); await mp.waitForTimeout(350);
    ok(await mp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'tapping the dimmed board closes the sheet');
    // one-finger pan on empty space
    let v0 = await view(mp);
    await touchDrag(300, stageBox.y + 150, 220, stageBox.y + 100, 8);
    let v1 = await view(mp); ok(Math.abs(v1.x - v0.x + 80) < 3 && Math.abs(v1.y - v0.y + 50) < 3, 'one-finger drag on empty space pans');
    ok((await sel2(mp)) !== null, 'panning does not clear the selection');
    // pinch zoom
    v0 = await view(mp);
    const cy = stageBox.y + 300;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: cy, id: 1 }, { x: 250, y: cy, id: 2 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150 - i * 6, y: cy, id: 1 }, { x: 250 + i * 6, y: cy, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    v1 = await view(mp); ok(v1.z > v0.z * 1.7, `pinch zooms in (${v0.z.toFixed(2)} → ${v1.z.toFixed(2)})`);
    await mp.tap('#fitBtn'); const nodesIn = await mp.evaluate(() => { const r = document.getElementById('scroller').getBoundingClientRect(); return [...document.querySelectorAll('.node')].every(n => { const b = n.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1; }); });
    ok(nodesIn, 'Fit brings every component into view');
    // header menu
    ok(await mp.locator('#clearBtn').isHidden(), 'Clear and Run traffic tucked into the ⋯ menu');
    await mp.tap('#moreBtn'); ok(await mp.locator('#trafficBtn').isVisible() && await mp.locator('#timer').isVisible(), '⋯ opens the menu');
    await mp.tap('#trafficBtn'); await mp.waitForTimeout(200); ok(await mp.locator('#trafficBtn').isHidden(), 'menu closes after choosing');
    await mp.tap('#moreBtn'); await mp.tap('#scroller', { position: { x: 100, y: 300 } }); ok(await mp.locator('#trafficBtn').isHidden(), 'tapping outside closes the menu');
    await mp.tap('#submitBtn'); await mp.waitForTimeout(350);
    ok(await mp.evaluate(() => S.result && S.result.score != null) && await mp.locator('#paneScore').isVisible(), 'Submit opens the Scorecard sheet');
    ok(await mp.locator('#dockScore').isVisible(), 'score badge on the Score button');
    ok(await mp.locator('[data-dock="score"]').getAttribute('aria-pressed') === 'true', 'Score button shows as active');
    await mp.tap('[data-dock="score"]'); await mp.waitForTimeout(350);
    ok(await mp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'tapping the active button closes the sheet');
    await mp.tap('[data-dock="adv"]'); await mp.waitForTimeout(350);
    ok(await mp.locator('#paneAdv .ep').count() > 0, 'Advanced notes readable on phone');
    ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'still no horizontal scroll with notes open');
    await mp.click('#advExpand'); ok(await mp.evaluate(() => getComputedStyle(document.querySelector('#advWideBody .adv-grid')).gridTemplateColumns.split(' ').length) === 1, 'wide view stacks to one column on phone');
    await mp.screenshot({ path: shot('designmate-phone-adv.png') }); await mp.click('#advWideClose');
    await mp.keyboard.press('Escape'); await mp.waitForTimeout(300);
    ok(await mp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'Escape closes the sheet');
    await mp.screenshot({ path: shot('designmate-phone.png') });
  });

  // ---------- tablet ----------
  for (const [w, h] of [[1024, 768], [768, 1024]]) {
    const t = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const tp = await t.newPage(); tp.on('pageerror', e => errs.push('tablet: ' + e.message));
    await tp.goto(URL); await tp.waitForTimeout(300);
    await section(`Tablet ${w}×${h}`, async () => {
      ok(await tp.evaluate(() => document.documentElement.scrollWidth) <= w, 'no horizontal page scroll');
      ok((await tp.locator('.bar').boundingBox()).height < 70, 'header fits on one row');
      const pal = await tp.locator('#palette').boundingBox();
      ok(pal && pal.width <= 100 && pal.x === 0, `components shown as a slim rail (${pal && pal.width}px)`);
      ok(await tp.locator('[data-dock="palette"]').isHidden() && await tp.locator('[data-dock="brief"]').isVisible(), 'bottom nav without Add (rail is visible)');
      ok(await tp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'panel drawer closed so the board gets the space');
      ok(await tp.locator('#clearBtn').isVisible() && await tp.locator('#moreBtn').isHidden(), 'all header actions visible, no ⋯ menu');
      ok(await tp.locator('#togglePalette').isHidden(), 'desktop-only collapse buttons hidden');
      await tp.locator('.pitem[data-kind="lb"]').tap(); ok(await tp.evaluate(() => S.nodes.length) === 2, 'tap on rail adds component');
      ok(await tp.locator('#selbar').isVisible(), 'selection bar shown');
      await tp.tap('#selbar [data-act="details"]'); await tp.waitForTimeout(300);
      const pr = await tp.locator('.panel').boundingBox();
      ok(await tp.locator('#paneInspect').isVisible() && Math.round(pr.x + pr.width) === w, 'Details opens the right-hand drawer on Inspect');
      await tp.fill('#nlabel', 'Edge LB'); ok((await tp.textContent('.node.sel')).includes('Edge LB'), 'rename from the drawer updates the board');
      await tp.tap('#panelClose'); await tp.waitForTimeout(300);
      ok(await tp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'Close hides the drawer');
      await tp.tap('[data-dock="brief"]'); await tp.waitForTimeout(300); ok(await tp.locator('#paneBrief').isVisible(), 'Brief opens from bottom nav');
      await tp.tap('[data-dock="brief"]'); await tp.waitForTimeout(300);
      ok(await tp.locator('.panel').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'tapping it again closes');
      await tp.tap('#submitBtn'); await tp.waitForTimeout(300); ok(await tp.locator('#paneScore').isVisible(), 'Submit opens the Scorecard drawer');
      await tp.screenshot({ path: shot(`designmate-tablet-${w}.png`) });
    });
    await t.close();
  }

  // ---------- desktop extras ----------
  await section('Desktop pan, zoom and panels', async () => {
    await p.emulateMedia({ colorScheme: 'light' }); await p.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    await p.evaluate(() => loadChallenge('url')); await p.waitForTimeout(100);
    ok(await p.locator('#dock').isHidden() && await p.locator('#selbar').isHidden(), 'no bottom nav or selection bar on desktop');
    const sb = await p.locator('#scroller').boundingBox();
    let v0 = await view(p);
    await p.click('#zoomIn'); let v1 = await view(p); ok(Math.abs(v1.z - v0.z * 1.2) < 1e-6, 'zoom in button');
    ok((await p.textContent('#zoomPct')) === Math.round(v1.z * 100) + '%', 'zoom % label updates');
    await p.click('#zoomOut'); ok(Math.abs((await view(p)).z - v0.z) < 1e-6, 'zoom out button');
    await p.mouse.click(sb.x + 300, sb.y + 300);
    await p.keyboard.press('='); ok((await view(p)).z > v0.z, '+ key zooms in'); await p.keyboard.press('-'); await p.keyboard.press('-'); ok((await view(p)).z < v0.z, '− key zooms out');
    for (let i = 0; i < 20 && !(await p.locator('#zoomOut').isDisabled()); i++) await p.click('#zoomOut');
    ok(Math.abs((await view(p)).z - 0.3) < 1e-6 && await p.locator('#zoomOut').isDisabled(), 'zoom stops at 30%');
    await p.keyboard.press('0');
    // ctrl+wheel keeps the point under the cursor fixed
    const cx = sb.x + 400, cy = sb.y + 300;
    v0 = await view(p); const before = await p.evaluate(([x, y]) => boardPoint(x, y), [cx, cy]);
    await p.mouse.move(cx, cy); await p.keyboard.down('Control'); await p.mouse.wheel(0, -100); await p.keyboard.up('Control'); await p.waitForTimeout(100);
    const after = await p.evaluate(([x, y]) => boardPoint(x, y), [cx, cy]); v1 = await view(p);
    ok(v1.z > v0.z && Math.abs(before.x - after.x) < 0.5 && Math.abs(before.y - after.y) < 0.5, 'Ctrl + scroll zooms around the cursor');
    v0 = await view(p); await p.mouse.wheel(40, 120); await p.waitForTimeout(100); v1 = await view(p);
    ok(Math.abs(v1.x - (v0.x - 40)) < 1 && Math.abs(v1.y - (v0.y - 120)) < 1, 'plain scroll pans');
    v0 = await view(p); await p.mouse.move(sb.x + 500, sb.y + 700); await p.mouse.down(); await p.mouse.move(sb.x + 600, sb.y + 650, { steps: 5 }); await p.mouse.up();
    v1 = await view(p); ok(Math.abs(v1.x - v0.x - 100) < 1 && Math.abs(v1.y - v0.y + 50) < 1, 'dragging empty space pans');
    // node drag and palette drop are correct when zoomed
    await p.evaluate(() => { const n = S.nodes[0], r = document.getElementById('scroller').getBoundingClientRect(); view.z = 1.5; view.x = r.width / 3 - n.x * 1.5; view.y = r.height / 3 - n.y * 1.5; applyView(); });
    const id = await p.evaluate(() => S.nodes[0].id); const nb = await p.locator(`.node[data-id="${id}"]`).boundingBox(); const x0 = await p.evaluate(i => S.nodes.find(n => n.id === i).x, id);
    await p.mouse.move(nb.x + 60, nb.y + 30); await p.mouse.down(); await p.mouse.move(nb.x + 60 + 150, nb.y + 30, { steps: 6 }); await p.mouse.up();
    const x1 = await p.evaluate(i => S.nodes.find(n => n.id === i).x, id);
    ok(Math.abs((x1 - x0) - 100) <= 10, `at 150% a 150px drag moves the component 100 board units (${x1 - x0})`);
    const bx = await p.locator('.pitem[data-kind="gateway"]').boundingBox(); const dropX = sb.x + 450, dropY = sb.y + 500;
    await p.mouse.move(bx.x + 20, bx.y + 10); await p.mouse.down(); await p.mouse.move(bx.x + 120, bx.y + 20, { steps: 4 }); await p.mouse.move(dropX, dropY, { steps: 8 }); await p.mouse.up();
    const nn = await p.locator('.node').last().boundingBox();
    ok(Math.abs(nn.x + nn.width / 2 - dropX) < 12 && Math.abs(nn.y + nn.height / 2 - dropY) < 12, 'dropped component centres under the cursor when zoomed');
    await p.click('#fitBtn');
    const allIn = await p.evaluate(() => { const r = document.getElementById('scroller').getBoundingClientRect(); return [...document.querySelectorAll('.node')].every(n => { const b = n.getBoundingClientRect(); return b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom; }); });
    ok(allIn, 'Fit brings every component into view');
    // collapse side panes
    const w0 = (await p.locator('#scroller').boundingBox()).width;
    await p.click('#togglePalette'); await p.click('#togglePanel'); await p.waitForTimeout(100);
    const w1 = (await p.locator('#scroller').boundingBox()).width;
    ok(w1 === 1440 && await p.locator('#palette').isHidden(), `hiding both panes gives the board the full width (${w0} → ${w1})`);
    await p.reload(); await p.waitForTimeout(300);
    ok(await p.locator('#palette').isHidden() && await p.locator('.panel').isHidden(), 'pane choice remembered after reload');
    await p.click('#submitBtn'); ok(await p.locator('#paneScore').isVisible(), 'Submit reopens the hidden side panel');
    await p.click('#togglePalette'); ok(await p.locator('#palette').isVisible() && (await p.getAttribute('#togglePalette', 'aria-pressed')) === 'true', 'palette toggles back');
    ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 1440, 'no horizontal page scroll');
  });

  await p.screenshot({ path: shot('designmate-desktop.png') });
  await b.close();
  const fails = results.filter(r => !r[0]);
  for (const [pass, msg] of results) console.log((pass ? '  PASS ' : '  FAIL ') + msg);
  console.log(`\n${results.length - fails.length}/${results.length} passed; page errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  process.exitCode = fails.length ? 1 : 0;
})();
