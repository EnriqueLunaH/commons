import './style.css';
import { copy } from './copy.js';
import {
  regions, createLife, marketOffer, monthlyStatement, closeMonth, projectGoal, projectFunding,
  basePrices, lotSizes, shiftPay, scheduleSale, scheduleWork, transfer, restoreLife,
} from './economy.js';
import { createSoundscape } from './sound.js';

const storageKey = 'commons.life.v1';
const app = document.querySelector('#app');
const sound = createSoundscape();
const actionIcons = { budget: '≡', savings: '◈', debt: '▤', work: '✦', diary: '✎' };
const actions = Object.keys(actionIcons);
const controlledKeys = ['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
const preferredLocale = navigator.language.toLowerCase().startsWith('es') ? 'es-MX' : 'en-US';

function load() {
  try {
    return restoreLife(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

let life = load();
let selectedLocale = life?.locale ?? preferredLocale;
let language = copy[selectedLocale];
let currency;
let selectedLot = 3;
let selectedPrice = 14;
let focusedAction = null;
let zone = 'home';
let panel = null;
let soundOn = false;
let room;

app.innerHTML = `
  <main class="world">
    <div class="stage"><canvas id="view"></canvas></div>
    <div class="shade"></div>
    <section class="welcome" id="welcome"></section>
    <div class="play" id="play" hidden>
      <header class="hud">
        <div class="identity" id="identity"></div>
        <div class="hud-right">
          <div class="pockets" id="pockets"></div>
          <div class="tools">
            <button type="button" class="tool" id="route" hidden></button>
            <button type="button" class="tool" id="sound"></button>
            <button type="button" class="tool" id="help"></button>
          </div>
        </div>
      </header>
      <div class="markers" id="markers"></div>
      <div class="reticle" id="reticle" aria-hidden="true"></div>
      <div class="touch-move" id="move"></div>
      <div class="ground-ui">
        <div class="arrival" id="arrival"></div>
        <nav class="dock" id="dock"></nav>
        <p class="keyboard-hint" id="hint"></p>
      </div>
      <div class="render-error" id="render-error" hidden></div>
    </div>
  </main>
  <dialog class="sheet" id="sheet" aria-labelledby="sheet-title">
    <header class="sheet-header">
      <div>
        <div id="sheet-subtitle" class="eyebrow"></div>
        <h2 id="sheet-title"></h2>
      </div>
      <button type="button" class="icon-close" id="close" autofocus>×</button>
    </header>
    <div id="sheet-body" class="sheet-body"></div>
  </dialog>`;

const get = (id) => document.getElementById(id);
const scene = get('view');
const welcome = get('welcome');
const sheet = get('sheet');
const content = get('sheet-body');
const markerLayer = get('markers');
const markerElements = Object.fromEntries(actions.map((action) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'marker';
  element.dataset.panel = action;
  element.hidden = true;
  markerLayer.append(element);
  return [action, element];
}));

function paintMarkers(locations, { width, height }, currentZone) {
  if (zone !== currentZone) {
    zone = currentZone;
    updateHud();
    updateThought();
  }
  focusedAction = null;
  let nearest = Math.min(width, height) * 0.18;
  for (const [action, location] of Object.entries(locations)) {
    const marker = markerElements[action];
    marker.hidden = !location.visible;
    if (!location.visible) continue;
    marker.style.transform = `translate3d(${location.x}px, ${location.y}px, 0) translate(-50%, -50%)`;
    const distance = Math.hypot(location.x - width / 2, location.y - height / 2);
    if (distance < nearest) {
      nearest = distance;
      focusedAction = action;
    }
  }
  for (const [action, marker] of Object.entries(markerElements)) {
    marker.classList.toggle('aimed', action === focusedAction);
  }
  get('reticle').classList.toggle('engaged', Boolean(focusedAction));
}

function setLocale(locale) {
  selectedLocale = locale;
  language = copy[locale];
  document.documentElement.lang = locale;
  currency = new Intl.NumberFormat(locale, {
    style: 'currency', currency: regions[locale].currency, maximumFractionDigits: 0,
  });
  scene.setAttribute('aria-label', language.sceneLabel);
}

function updateSoundButton() {
  const button = get('sound');
  button.textContent = soundOn ? language.mute : language.sound;
  button.setAttribute('aria-pressed', String(soundOn));
}

function renderWelcome() {
  welcome.innerHTML = `
    <div class="intro">
      <div class="wordmark"><span class="sigil" aria-hidden="true">✳</span> COMMONS</div>
      <h1>${language.welcome}</h1>
      <p>${language.showIntro}</p>
      <fieldset class="language-choice">
        <legend>${language.choose}</legend>
        <button type="button" class="locale" data-locale="es-MX">
          <span class="country-code" aria-hidden="true">MX</span>
          <span><strong>México</strong><small>Español</small></span>
        </button>
        <button type="button" class="locale" data-locale="en-US">
          <span class="country-code" aria-hidden="true">US</span>
          <span><strong>United States</strong><small>English</small></span>
        </button>
      </fieldset>
    </div>`;
}

function begin(locale) {
  life = createLife(locale);
  setLocale(locale);
  persist();
  enter();
  get('dock').querySelector('button').focus({ preventScroll: true });
}

function currentThought() {
  const receipt = life.lastReceipt;
  if (!receipt) return language.arrive[life.moment];
  return language.thought[receipt.margin < 0 ? 'loss' : receipt.margin > 0 ? 'gain' : 'even'];
}

function updateThought() {
  get('arrival').textContent = '“' + (language.outsideThought[zone] ?? currentThought()) + '”';
}

function enter() {
  welcome.hidden = true;
  get('play').hidden = false;
  app.classList.add('in-life');
  room?.spawn(life.moment);
  updateThought();
  get('hint').textContent = language.hint;
  get('help').textContent = language.help;
  get('render-error').textContent = language.webgl;
  get('close').setAttribute('aria-label', language.close);
  get('dock').setAttribute('aria-label', language.sceneLabel);
  get('dock').innerHTML = actions.map((action) => `
    <button class="dock-button" type="button" data-panel="${action}">
      <span class="action-icon" aria-hidden="true">${actionIcons[action]}</span>
      <span>${language.actions[action]}</span>
    </button>`).join('');
  for (const action of actions) {
    markerElements[action].textContent = language.actions[action];
    markerElements[action].setAttribute('aria-label', language.interact + ' · ' + language.actions[action]);
  }
  get('move').innerHTML = Object.entries({
    w: [language.move.forward, '↑'], a: [language.move.left, '←'],
    s: [language.move.back, '↓'], d: [language.move.right, '→'],
  }).map(([key, [label, symbol]]) => `<button type="button" aria-label="${label}" data-key="${key}">${symbol}</button>`).join('');
  updateSoundButton();
  updateHud();
}

const money = (amount) => currency.format(amount);

function updateHud() {
  get('identity').innerHTML = `
    <div class="wordmark"><span class="sigil" aria-hidden="true">✳</span> COMMONS</div>
    <p class="location">${language.zones[zone]} · ${language.month} ${life.month}
      <span class="when">${language.times[life.moment]} · ${language.scene[life.moment]}</span>
    </p>
    <p class="profile">${life.age} ${language.age} · ${language.gender[life.gender]} · ${language.household[life.household]}</p>`;
  get('pockets').innerHTML = ['cash', 'savings', 'debt'].map((key) => `
    <div><span>${language[key]}</span><strong>${money(life[key])}</strong></div>`).join('');
  get('route').textContent = zone === 'home' ? language.exit : language.returnHome;
  room?.funded(projectFunding(life) >= projectGoal(life));
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(life));
  } catch {
    // The current session remains playable when storage is unavailable.
  }
}

function row(label, value, emphasis = false) {
  return `<div${emphasis ? ' class="total"' : ''}><dt>${label}</dt><dd>${value}</dd></div>`;
}

function figures(entries) {
  return `<dl class="figures">${entries.map((entry) => row(...entry)).join('')}</dl>`;
}

function statement(receipt, settled = false) {
  const rows = [[language.income, money(receipt.income)]];
  if (settled && receipt.prepared) rows.push([language.sold, receipt.sold + ' / ' + receipt.prepared]);
  for (const key of ['workPay', 'sales', 'cost', 'housing', 'food', 'utilities', 'incident', 'tax', 'interest', 'shortfall']) {
    if (!receipt[key]) continue;
    const expense = ['cost', 'housing', 'food', 'utilities', 'incident', 'tax', 'interest'].includes(key);
    const label = key === 'cost' ? language.cost + ' (' + language.paid + ')' : language[key];
    rows.push([label, money(expense ? -receipt[key] : receipt[key])]);
  }
  rows.push([language.margin, money(receipt.margin), true]);
  if (settled) rows.push([language.balance, money(receipt.balance), true]);
  return figures(rows);
}

function button(action, label, disabled = false, secondary = false) {
  return `<button type="button" class="${secondary ? 'secondary' : 'primary'}" data-action="${action}"${disabled ? ' disabled' : ''}>${label}</button>`;
}

function progress() {
  const goal = projectGoal(life);
  const raised = Math.min(projectFunding(life), goal);
  const funded = raised >= goal;
  return `<div class="fund">
    <div><span>${language.progress}</span><strong>${money(raised)} / ${money(goal)}</strong></div>
    <progress aria-label="${language.progress}" max="${goal}" value="${raised}"></progress>
    <small>${funded ? language.lit : language.taxNote}</small>
  </div>`;
}

function saleFigure() {
  const offer = marketOffer(life, selectedLot, selectedPrice);
  return figures([
    [language.customers, offer.sold + ' / ' + offer.units],
    [language.production, money(offer.cost)],
    [language.sales, money(offer.revenue)],
    [language.saleMargin, money(offer.revenue - offer.cost), true],
  ]) + (life.cash < offer.cost ? `<small class="notice">${language.noFunds}</small>` : '')
    + button('sell', language.sell, life.cash < offer.cost);
}

function works() {
  const intro = `<p>${language.workContext[life.career]}</p>`;
  if (life.activity) {
    const notice = life.activity.kind === 'sale' ? language.saleBooked : language.workBooked;
    return intro + `<div class="notice">${notice}</div>`;
  }
  const options = (values, current, label) => values.map((value) => `
    <option value="${value}"${value === current ? ' selected' : ''}>${label(value)}</option>`).join('');
  return intro + `
    <p>${language.workNote}</p>
    <div class="job">
      <strong>${language.workName[life.career]}</strong>
      <span>+${money(shiftPay(life))}</span>
    </div>
    ${button('work', language.bookWork, false, true)}
    <div class="sale">
      <h3>${language.saleTitle}</h3>
      <div class="sale-options">
        <label>${language.units}
          <select id="lot">${options(lotSizes, selectedLot, (size) => size + ' ' + language.individual)}</select>
        </label>
        <label>${language.price}
          <select id="price">${options(basePrices, selectedPrice, (price) => money(price * regions[life.locale].scale))}</select>
        </label>
      </div>
      <div id="sale-forecast">${saleFigure()}</div>
    </div>`;
}

function showPanel(id, focusView = true) {
  if (!life) return;
  panel = id;
  room?.stop();
  if (focusView && zone === 'home' && actions.includes(id)) room?.focus(id);
  get('sheet-title').textContent = language.actions[id] ?? language[id];
  get('sheet-subtitle').textContent = language.subtitles[id] ?? (language.month + ' ' + (life.lastReceipt?.month ?? life.month));

  const step = 50 * regions[life.locale].scale;
  const amount = (balance) => money(Math.min(step, balance));
  const receipt = life.lastReceipt;
  const panels = {
    budget: () => `<p>${language.budgetNote}</p><h3>${language.forecast}</h3>
      ${statement(monthlyStatement(life))}${progress()}
      <div class="button-row">${button('closeMonth', language.closeMonth)}
      ${receipt ? button('receipt', language.lastReceipt, false, true) : ''}</div>`,
    savings: () => `<p>${language.reserveNote}</p>
      ${figures([[language.cash, money(life.cash)], [language.savings, money(life.savings), true]])}
      <div class="button-row">${button('deposit', language.deposit + ' ' + amount(life.cash), life.cash === 0)}
      ${button('withdraw', language.withdraw + ' ' + amount(life.savings), life.savings === 0, true)}</div>`,
    debt: () => `<p>${language.debtNote}</p>${figures([
      [language.debt, money(life.debt)], [language.interest, money(monthlyStatement(life).interest), true],
    ])}${button('payDebt', language.pay + ' · ' + amount(Math.min(life.cash, life.debt)), !life.debt || !life.cash)}`,
    work: works,
    diary: () => {
      const mood = receipt ? currentThought() : language.journal;
      return `<blockquote>“${language.trying(life.yearsTrying)}”</blockquote><p>${mood}</p>`;
    },
    receipt: () => `${statement(receipt, true)}${progress()}`,
    help: () => `<p>${language.controls}</p>`,
  };
  content.innerHTML = panels[id]();
  content.scrollTop = 0;
  if (!sheet.open) sheet.showModal();
}

function gameAction(action) {
  switch (action) {
    case 'closeMonth':
      if (panel !== 'budget') return;
      life = closeMonth(life);
      room?.setMoment(life.moment);
      updateThought();
      panel = 'receipt';
      break;
    case 'receipt':
      showPanel('receipt', false);
      return;
    case 'work':
      life = scheduleWork(life);
      break;
    case 'sell':
      life = scheduleSale(life, selectedLot, selectedPrice);
      break;
    default:
      life = transfer(life, action);
  }
  persist();
  updateHud();
  sound.cue();
  showPanel(panel, false);
}

welcome.addEventListener('click', (event) => {
  const choice = event.target.closest('[data-locale]');
  if (choice && !life) begin(choice.dataset.locale);
});
get('play').addEventListener('click', (event) => {
  const control = event.target.closest('[data-panel]');
  if (control) showPanel(control.dataset.panel);
});
get('help').addEventListener('click', () => showPanel('help'));
get('route').addEventListener('click', () => room?.focus('door'));
get('sound').addEventListener('click', async () => {
  get('sound').disabled = true;
  soundOn = await sound.toggle();
  updateSoundButton();
  get('sound').disabled = false;
});
get('close').addEventListener('click', () => sheet.close());
sheet.addEventListener('close', () => { panel = null; });
content.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) gameAction(button.dataset.action);
});
content.addEventListener('change', (event) => {
  if (event.target.id === 'lot') selectedLot = Number(event.target.value);
  else if (event.target.id === 'price') selectedPrice = Number(event.target.value);
  else return;
  get('sale-forecast').innerHTML = saleFigure();
});

window.addEventListener('keydown', (event) => {
  if (!life || sheet.open || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'e' && focusedAction && !event.repeat) {
    showPanel(focusedAction);
  } else if (controlledKeys.includes(key)) {
    event.preventDefault();
    room?.key(key, true);
  }
});
window.addEventListener('keyup', (event) => room?.key(event.key.toLowerCase(), false));
window.addEventListener('blur', () => room?.stop());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) room?.stop();
});
get('move').addEventListener('pointerdown', (event) => {
  const button = event.target.closest('[data-key]');
  if (!button) return;
  button.setPointerCapture(event.pointerId);
  room?.key(button.dataset.key, true);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  get('move').addEventListener(type, (event) => {
    const button = event.target.closest('[data-key]');
    if (button) room?.key(button.dataset.key, false);
  });
}

setLocale(selectedLocale);
if (life) enter();
else renderWelcome();

import('./room.js').then(({ createRoom }) => {
  room = createRoom(scene, paintMarkers);
  get('route').hidden = false;
  if (life) {
    room.spawn(life.moment);
    room.funded(projectFunding(life) >= projectGoal(life));
  }
}).catch((error) => {
  console.error('Could not render the room', error);
  get('render-error').hidden = false;
});
