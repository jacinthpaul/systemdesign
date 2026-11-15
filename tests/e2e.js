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
    ok(await p.locator('.pitem').count() === 29, '29 palette components');
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
    await p.fill('#pfilter', ''); ok(await p.locator('.pitem:visible').count() === 29, 'clearing filter restores all');
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
    ok(c2.x >= 10 && c2.y >= 14, 'position clamped inside board');
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
    await p.click('#levelBtn'); ok(await p.locator('#levels').isVisible() && await p.locator('.level').count() === 11, 'picker shows 11 prompts');
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
    ok(ids.length === 10, 'notes exist for all 10 prompts');
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
  await section('Phone (touch)', async () => {
    ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no horizontal page scroll');
    ok(await mp.locator('.port').first().evaluate(e => getComputedStyle(e).opacity) === '1', 'connect handles visible on touch');
    await mp.locator('.pitem[data-kind="lb"]').tap();
    let n = await mp.evaluate(() => S.nodes.length); ok(n === 2, 'tap adds component');
    await mp.locator(".pitem[data-kind=\"app\"]").scrollIntoViewIfNeeded(); await mp.waitForTimeout(200); const it = await mp.locator(".pitem[data-kind=\"app\"]").boundingBox(); const sc = await mp.locator('#scroller').boundingBox();
    await touchDrag(it.x + it.width / 2, it.y + 15, sc.x + 220, sc.y + 330);
    n = await mp.evaluate(() => S.nodes.map(x => x.kind)); ok(n.length === 3 && n[2] === 'app', 'touch drag from palette adds component');
    const ids = await mp.evaluate(() => S.nodes.map(x => x.id));
    const pb = await mp.locator(`.node[data-id="${ids[0]}"] .port`).boundingBox(); const tb = await mp.locator(`.node[data-id="${ids[1]}"]`).boundingBox();
    await touchDrag(pb.x + 9, pb.y + 9, tb.x + 50, tb.y + 30);
    ok(await mp.evaluate(() => S.edges.length) === 1, 'touch drag from handle connects');
    const nb = await mp.locator(`.node[data-id="${ids[2]}"]`).boundingBox(); const y0 = await mp.evaluate(i => S.nodes.find(n => n.id === i).y, ids[2]);
    await touchDrag(nb.x + 40, nb.y + 30, nb.x + 40, nb.y + 120);
    ok(await mp.evaluate(i => S.nodes.find(n => n.id === i).y, ids[2]) > y0 + 50, 'touch drag moves node');
    await mp.locator(`.node[data-id="${ids[2]}"]`).tap(); ok(await mp.evaluate(() => sel && sel.t === 'node'), 'tap selects node');
    await mp.click('#submitBtn'); ok(await mp.evaluate(() => S.result && S.result.score != null), 'submit works on phone');
    await mp.click('#tabAdv'); ok(await mp.locator('#paneAdv .ep').count() > 0, 'Advanced notes readable on phone');
    ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'still no horizontal scroll with notes open');
    await mp.click('#advExpand'); ok(await mp.evaluate(() => getComputedStyle(document.querySelector('#advWideBody .adv-grid')).gridTemplateColumns.split(' ').length) === 1, 'wide view stacks to one column on phone');
    await mp.screenshot({ path: shot('design-round-phone-adv.png') }); await mp.click('#advWideClose');
    await mp.screenshot({ path: shot('design-round-phone.png') });
  });

  await p.screenshot({ path: shot('design-round-desktop.png') });
  await b.close();
  const fails = results.filter(r => !r[0]);
  for (const [pass, msg] of results) console.log((pass ? '  PASS ' : '  FAIL ') + msg);
  console.log(`\n${results.length - fails.length}/${results.length} passed; page errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  process.exitCode = fails.length ? 1 : 0;
})();
