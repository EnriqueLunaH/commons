import './style.css';
import { copy } from './copy.js';
import {
  regions, createLife, marketOffer, monthlyStatement, closeMonth, projectGoal, projectFunding,
  basePrices, lotSizes, shiftPay, dailyWage, scheduleSale, scheduleWork, transfer, restoreLife, payBusFare, settlePayroll,
} from './economy.js';
import { createSoundscape } from './sound.js';
import { advanceClock, createClock, readClock, startSleep } from './clock.js';
import { drawCityMap } from './city-map.js';
import { destinations } from './city-layout.js';
import {
  atWorkCounter, clockIn, employmentStatus, nextCommutePoint, sellToCustomer, shiftLength,
  shopCapacity, shopCustomer, stockShop, trackShift, visitHome, workplaces,
} from './employment.js';
import { nearbyStop, readTransit, stops, waitForStop } from './transit.js';
import { customers, rememberedShift, residentIds, residents } from './residents.js';
import { bindReflection, reflectionMarkup } from './reflection.js';

const storageKey = 'commons.life.v1';
const app = document.querySelector('#app');
const sound = createSoundscape();
const actionIcons = { budget: '≡', savings: '◈', debt: '▤', work: '✦', diary: '✎' };
const actions = Object.keys(actionIcons);
const roomActions = [...actions, 'sleep'];
const markedActions = [...roomActions, 'job', 'customer', 'transport', ...residentIds];
const controlledKeys = ['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
const essentials = ['housing', 'electricity', 'water', 'internet', 'food'];
const otherExpenses = ['cost', 'incident', 'tax', 'interest'];
const preferredLocale = navigator.language.toLowerCase().startsWith('es') ? 'es-MX' : 'en-US';

function load() {
  try {
    return restoreLife(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

let life = load();
let clock = life ? createClock(life.moment, life.clock) : null;
let clockTick = null;
let lastSave = null;
let selectedLocale = life?.locale ?? preferredLocale;
let language = copy[selectedLocale];
let currency;
let clockFormat;
let selectedLot = 3;
let selectedPrice = 14;
let focusedAction = null;
let zone = 'home';
let panel = null;
let spoken = '';
let wholeCity = false;
let soundOn = false;
let room;
let closeReflection;

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
            <button type="button" class="tool" id="bed" hidden></button>
            <button type="button" class="tool" id="job"></button>
            <button type="button" class="tool" id="transport" hidden></button>
            <button type="button" class="tool" id="map" hidden></button>
            <button type="button" class="tool" id="sound"></button>
            <button type="button" class="tool" id="help"></button>
            <button type="button" class="tool" id="budget-toggle" aria-expanded="false" aria-controls="budget-drawer"></button>
          </div>
        </div>
      </header>
      <aside class="budget-drawer" id="budget-drawer" aria-labelledby="budget-title" hidden>
        <header class="budget-header">
          <div>
            <p id="budget-month" class="eyebrow"></p>
            <h2 id="budget-title"></h2>
            <p id="budget-living"></p>
          </div>
          <button type="button" class="icon-close" id="budget-close">×</button>
        </header>
        <div class="budget-scroll">
          <div id="budget-figures"></div>
          <div class="button-row">
            <button type="button" class="primary" id="budget-save" data-panel="savings"></button>
            <button type="button" class="secondary" id="budget-notebook" data-panel="budget"></button>
          </div>
        </div>
      </aside>
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
const budgetDrawer = get('budget-drawer');
const budgetToggle = get('budget-toggle');
const markerLayer = get('markers');
const markerElements = Object.fromEntries(markedActions.map((action) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'marker';
  element.dataset.panel = action === 'customer' ? 'job' : action;
  element.hidden = true;
  markerLayer.append(element);
  return [action, element];
}));

function paintMarkers(locations, { width, height }, currentZone) {
  if (zone !== currentZone) {
    zone = currentZone;
    if (registerHome()) persist();
    updateHud();
    updateThought();
  }
  focusedAction = null;
  let nearest = Math.min(width, height) * 0.18;
  for (const [action, location] of Object.entries(locations)) {
    const marker = markerElements[action];
    marker.hidden = !location.visible || (action === 'sleep' && !canSleep())
      || ((action === 'job' || action === 'customer') && currentZone !== life.employment.occupation);
    if (marker.hidden) continue;
    if (action === 'customer' && marker.dataset.guest !== location.guest) {
      marker.dataset.guest = location.guest;
      const label = language.employment.serve + ' · ' + customers[location.guest].name;
      marker.textContent = label;
      marker.setAttribute('aria-label', label);
    }
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
  clockFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
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
  clock = createClock(life.moment);
  clockTick = performance.now();
  setLocale(locale);
  enter();
  persist();
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

function innerContext() {
  const { locale, gender, cash, savings, debt, lastReceipt, lastPayroll, employment } = life;
  return {
    locale, gender, scene: language.zones[zone], day: clock.day, time: clockDuration(readClock(clock).minute),
    currency: regions[locale].currency, cash, savings, debt,
    job: language.employment.sites[employment.occupation], shift: currentShift(),
    shiftSales: employment.shift?.sold ?? 0, wagesDue: employment.pendingPay,
    lastPay: lastPayroll?.amount ?? 0, lastMonthMargin: lastReceipt?.margin ?? null,
  };
}

function localReflection() {
  if (life.lastPayroll?.day === clock.day) return language.voice.payday;
  if (life.employment.shift?.sold && life.employment.shiftDay === clock.day) return language.voice.sale;
  if (life.employment.stage === 'returning') return language.voice.home;
  return zone === 'home' && !life.lastReceipt ? language.journal : language.outsideThought[zone] ?? currentThought();
}

function enter() {
  welcome.hidden = true;
  get('play').hidden = false;
  app.classList.add('in-life');
  room?.spawn(life.moment, true, life.position, life.transit);
  if (room) {
    zone = room.zone();
    room.localizeWorkplaces(language.employment.sites);
    room.localizeTransit(language.transit.stops);
  }
  if (room || !life.position) registerHome();
  room?.setTime(readClock(clock).minute);
  updateThought();
  get('hint').textContent = language.hint;
  get('help').textContent = language.help;
  get('map').textContent = language.map;
  get('job').textContent = language.employment.title;
  get('transport').textContent = language.transit.title;
  budgetToggle.textContent = get('budget-title').textContent = language.budget.title;
  get('budget-living').textContent = language.budget.living;
  get('budget-close').setAttribute('aria-label', language.close + ' · ' + language.budget.title);
  get('budget-save').textContent = language.budget.save;
  get('budget-notebook').textContent = language.budget.notebook;
  get('bed').textContent = language.sleep;
  get('render-error').textContent = language.webgl;
  get('close').setAttribute('aria-label', language.close);
  get('dock').setAttribute('aria-label', language.sceneLabel);
  get('dock').innerHTML = actions.map((action) => `
    <button class="dock-button" type="button" data-panel="${action}">
      <span class="action-icon" aria-hidden="true">${actionIcons[action]}</span>
      <span>${language.actions[action]}</span>
    </button>`).join('');
  for (const action of markedActions) {
    const label = action === 'job' ? language.employment.title : action === 'transport' ? language.transit.title
      : residents[action]?.name ?? language.actions[action] ?? language[action];
    markerElements[action].textContent = label;
    const verb = residents[action] ? language.residents.talk : language.interact;
    markerElements[action].setAttribute('aria-label', verb + ' · ' + label);
  }
  get('move').innerHTML = Object.entries({
    w: [language.move.forward, '↑'], a: [language.move.left, '←'],
    s: [language.move.back, '↓'], d: [language.move.right, '→'],
  }).map(([key, [label, symbol]]) => `<button type="button" aria-label="${label}" data-key="${key}">${symbol}</button>`).join('');
  updateSoundButton();
  updateHud();
  if (clock.rest) showPanel('sleeping', false);
}

const money = (amount) => currency.format(amount);

function registerHome() {
  if (zone !== 'home') return false;
  const employment = visitHome(life.employment, clock.day);
  if (employment === life.employment) return false;
  life = { ...life, employment };
  return true;
}

const currentShift = () => employmentStatus(life.employment, clock.day, readClock(clock));
const atAssignedCounter = () => atWorkCounter(life.employment.occupation, room?.position());
const shouldHeadHome = (status) => ['returning', 'startHome', 'closed'].includes(status);
const unitPrice = () => workplaces[life.employment.occupation].price * regions[life.locale].scale;
const clockDuration = (minutes) => String(Math.floor(minutes / 60)).padStart(2, '0')
  + ':' + String(Math.floor(minutes % 60)).padStart(2, '0');

function guideCommute() {
  if (!room || room.transit().aboard) return;
  const status = currentShift();
  const goingHome = shouldHeadHome(status);
  if (status === 'finished' || (goingHome && zone === 'home') || (!goingHome && atAssignedCounter())) return;
  room.lookToward(nextCommutePoint(life.employment.occupation, room.position(), goingHome));
}

function renderEmployment() {
  get('job-status').textContent = language.employment.short[currentShift()];
}

function renderShop(time = readClock(clock)) {
  const job = life.employment;
  const active = job.stage === 'working' && job.shiftDay === clock.day;
  const visit = shopCustomer(job, clock.day, time);
  room?.showShop(job.occupation, active ? job.shift.stock : 0, visit);
  if (active && panel === 'job' && get('shift-minutes')) {
    const minutes = Math.floor(job.shift.minutes);
    get('shift-minutes').textContent = clockDuration(minutes) + ' / 08:00';
    get('shift-progress').value = minutes;
  }
}

function canSleep() {
  return zone === 'home' && clock && !clock.rest && readClock(clock).night;
}

function renderClock() {
  const { night, minute } = readClock(clock);
  const wholeMinute = Math.floor(minute + 1e-8) % 1_440;
  const time = clockFormat.format(new Date(wholeMinute * 60_000));
  get('world-time').textContent = time + ' · ' + (night ? language.night : language.day);
  get('bed').hidden = !room || !canSleep();
  const remaining = get('sleep-remaining');
  if (remaining) remaining.textContent = language.seconds(Math.ceil(clock.rest / 1_000));
}

function tickClock(allowHidden = false) {
  if (!clock || (document.hidden && !allowHidden)) return;
  const now = performance.now();
  const previous = clock;
  clock = advanceClock(clock, clockTick === null ? 0 : now - clockTick);
  clockTick = now;
  const before = readClock(previous);
  const after = readClock(clock);
  const job = life.employment;
  const previousShift = employmentStatus(job, previous.day, before);
  const previousVisit = shopCustomer(job, previous.day, before);
  const newDay = previous.day !== clock.day;
  if (job.stage === 'working' && (clock !== previous || newDay)) {
    const minute = newDay || after.night ? 18 * 60 : after.minute;
    const elapsed = before.night || previous.day !== job.shiftDay ? 0 : Math.max(0, minute - before.minute);
    const employment = trackShift(job, newDay ? previous.day : clock.day, minute, elapsed,
      room?.zone() === job.occupation, dailyWage(life));
    if (employment !== job) life = { ...life, employment };
  }
  const beforePayroll = life;
  life = settlePayroll(life, clock.day);
  const newShift = currentShift();
  const changed = previousShift !== newShift;
  if (newDay || changed || beforePayroll !== life) {
    if (room) registerHome();
    updateHud();
    persist();
    if (life.lastPayroll && beforePayroll.lastPayroll !== life.lastPayroll) {
      get('arrival').textContent = '“' + language.voice.payday + '”';
    }
  }
  const visit = shopCustomer(life.employment, clock.day, after);
  if (panel === 'job' && (newDay || changed || previousVisit?.phase !== visit?.phase || previousVisit?.index !== visit?.index)) {
    showPanel('job', false);
  }
  renderShop(after);
  if (panel === 'transport') renderTransit();
  room?.setTime(after.minute);
  if (Math.floor(before.minute) !== Math.floor(after.minute)
    || Math.ceil(previous.rest / 1_000) !== Math.ceil(clock.rest / 1_000)) renderClock();
  if (previous.rest && !clock.rest) {
    if (panel === 'sleeping') sheet.close();
    persist();
  } else if (panel === 'sleep' && !after.night) {
    sheet.close();
  }
  if (lastSave === null || now - lastSave >= 5_000) persist();
}

function updateHud() {
  get('identity').innerHTML = `
    <div class="wordmark"><span class="sigil" aria-hidden="true">✳</span> COMMONS</div>
    <p class="location">${language.zones[zone]} · ${language.month} ${life.month}
      <span class="when" id="world-time"></span>
    </p>
    <p class="profile">${life.age} ${language.age} · ${language.gender[life.gender]} · ${language.household[life.household]}</p>
    <p class="profile employment-line">${language.employment.roles[life.employment.occupation][life.gender]}
      · <span id="job-status"></span></p>`;
  get('pockets').innerHTML = ['cash', 'savings', 'debt'].map((key) => `
    <div><span>${language[key]}</span><strong>${money(life[key])}</strong></div>`).join('');
  if (!budgetDrawer.hidden) renderBudget();
  get('route').textContent = zone === 'home' ? language.exit : language.returnHome;
  get('route').hidden = !room || zone === 'bus';
  app.classList.toggle('in-transit', zone === 'bus');
  get('hint').textContent = zone === 'bus' ? language.transit.hint : language.hint;
  renderClock();
  renderEmployment();
  renderShop();
  room?.funded(projectFunding(life) >= projectGoal(life));
}

function persist() {
  if (!life || !clock) return;
  lastSave = performance.now();
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      ...life, clock, position: room?.position() ?? life.position, transit: room?.transit() ?? life.transit,
    }));
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

function setBudgetOpen(open) {
  budgetDrawer.hidden = !open;
  budgetToggle.setAttribute('aria-expanded', String(open));
  if (open) renderBudget();
  else budgetToggle.focus();
}

function renderBudget() {
  const budget = language.budget;
  const receipt = monthlyStatement(life);
  const fare = money(regions[life.locale].fare);
  const expenseRows = ['transitSpent', ...essentials, ...otherExpenses.filter((key) => receipt[key])]
    .map((key) => [language[key], money(receipt[key])]);
  get('budget-month').textContent = language.month + ' ' + life.month;
  get('budget-figures').innerHTML = `
    <div class="budget-margin${receipt.margin < 0 ? ' budget-short' : ''}">
      <span>${language.margin}</span><strong>${money(receipt.margin)}</strong>
      <small>${budget.marginHint}</small>
    </div>
    ${figures([
      [budget.salary, money(life.income)],
      [language.income, money(receipt.income), true],
      [language.employment.pending, money(life.employment.pendingPay)],
      ...(receipt.pendingIncome > receipt.income ? [[budget.extra, money(receipt.pendingIncome - receipt.income)]] : []),
    ])}
    <p class="budget-note">${budget.payday}</p>
    <h3>${budget.expenses}</h3>
    ${figures([...expenseRows, [budget.total, money(receipt.expenses), true]])}
    <p class="budget-note">${language.transit.title} · ${language.transit.fare(fare)}. ${budget.walk}</p>
    <div class="fund budget-reserve">
      <h3 id="reserve-goal">${budget.reserve}</h3>
      <div><span>${money(life.savings)} / ${money(receipt.essentials)}</span></div>
      <progress aria-labelledby="reserve-goal" value="${Math.min(life.savings, receipt.essentials)}" max="${Math.max(1, receipt.essentials)}"></progress>
      <small>${budget.reserveGoal}</small>
    </div>`;
}

function statement(receipt, settled = false) {
  const rows = [[language.income, money(receipt.income)]];
  if (settled && receipt.prepared) rows.push([language.sold, receipt.sold + ' / ' + receipt.prepared]);
  const householdBills = receipt.electricity === undefined ? ['housing', 'food', 'utilities'] : essentials;
  const expenses = ['cost', ...householdBills, 'transitSpent', 'incident', 'tax', 'interest'];
  for (const key of ['workPay', 'sales', ...expenses, 'shortfall']) {
    if (!receipt[key]) continue;
    const label = key === 'cost' ? language.cost + ' (' + language.paid + ')' : language[key];
    rows.push([label, money(expenses.includes(key) ? -receipt[key] : receipt[key])]);
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

function cityMapPanel() {
  return `<canvas id="city-plan" class="city-plan" width="480" height="480" role="img" aria-label="${language.mapLabel}"></canvas>
    <div class="map-legend">
      <span class="map-player">${language.mapPlayer}</span>
      <span class="map-homes">${language.zones.residential}</span>
      <span class="map-downtown">${language.zones.downtown}</span>
      <span class="map-market">${language.zones.market}</span>
      <span class="map-parks">${language.mapParks}</span>
      <span class="map-commute">${language.employment.mapRoute}</span>
      <span class="map-transit">${language.transit.mapLine}</span>
    </div>
    <div class="button-row map-actions">
      ${button('map-scale', wholeCity ? language.mapNearby : language.mapOverview, false, true)}
    </div>
    <fieldset class="map-destinations"><legend>${language.mapOrient}</legend><div class="button-row">
      ${Object.keys(destinations).map((id) => `<button type="button" class="secondary" data-destination="${id}">${language.zones[id]}</button>`).join('')}
    </div></fieldset>`;
}

function jobPanel() {
  const status = currentShift();
  const employment = language.employment;
  const job = life.employment;
  const { occupation, pendingPay, nextPayday, shift } = job;
  const onSite = atAssignedCounter();
  const time = readClock(clock);
  const customer = shopCustomer(job, clock.day, time);
  const waiting = customer?.phase === 'waiting';
  const heading = (onSite ? employment.onSite[status] : null) ?? employment.states[status];
  const goingHome = shouldHeadHome(status);
  const guide = room && zone !== 'bus' && status !== 'finished' && (goingHome ? zone !== 'home' : !onSite);
  const price = unitPrice();
  const shop = status === 'working' ? `
    <div class="fund">
      <div><strong id="shift-label">${employment.hours}</strong><span id="shift-minutes">${clockDuration(shift.minutes)} / 08:00</span></div>
      <progress id="shift-progress" aria-labelledby="shift-label" max="${shiftLength}" value="${Math.floor(shift.minutes)}"></progress>
      <small>${employment.attendance}</small>
    </div>
    ${figures([
      [employment.stock, shift.stock + ' / ' + shopCapacity],
      [employment.sold, shift.sold],
      [employment.revenue, money(shift.revenue)],
    ])}
    <p class="notice" role="status">${customer ? employment.customer[customer.phase](
      customers[customer.guest].name, customer.units, money(customer.units * price), customer.bought,
    ) : employment.noCustomer}</p>` : '';
  return `<p>${heading}</p>
    ${figures([
      [employment.site, employment.sites[occupation]],
      [employment.wage, money(dailyWage(life))],
      [employment.pending, money(pendingPay), true],
      [employment.nextPay, employment.day + ' ' + nextPayday],
      ...(life.lastPayroll ? [[employment.lastPay, money(life.lastPayroll.amount)]] : []),
    ])}
    <p class="job-pay-note">${employment.payNote}</p>
    ${shop}
    <div class="button-row">
      ${onSite && status === 'commute' ? button('clock-in', employment.clockIn) : ''}
      ${onSite && status === 'working' ? button('stock-shop', employment.tasks[occupation], shift.stock === shopCapacity) : ''}
      ${onSite && waiting ? button('sell-customer', employment.sell + ' · ' + money(customer.units * price), shift.stock < customer.units) : ''}
      ${guide ? button('guide-job', goingHome ? employment.guideHome : employment.guide, false, true) : ''}
      ${room ? button('job-map', language.map, false, true) : ''}
    </div>`;
}

function nearestStop() {
  const { x, z } = room.position();
  const distance = (stop) => Math.hypot(x - stop.platform.x, z - stop.platform.z);
  return distance(stops.neighborhood) <= distance(stops.shops) ? 'neighborhood' : 'shops';
}

function transitPanel() {
  const bus = language.transit;
  const fare = money(regions[life.locale].fare);
  return `<div class="bus-line"><strong>${bus.stops.neighborhood}</strong><span aria-hidden="true"></span><strong>${bus.stops.shops}</strong></div>
    <p id="bus-fare" class="bus-fare"></p><p id="bus-status" role="status"></p><div class="button-row">
      ${button('board-bus', bus.board + ' · ' + fare)}
      ${button('leave-bus', bus.request)}
      ${button('guide-bus', bus.guide, false, true)}
    </div>`;
}

function renderTransit() {
  const bus = language.transit;
  const service = room.transit();
  const { stop, next } = readTransit(service);
  const nearby = nearbyStop(room.position());
  const { fare } = regions[life.locale];
  const canAfford = life.cash >= fare;
  const board = content.querySelector('[data-action="board-bus"]');
  const leave = content.querySelector('[data-action="leave-bus"]');
  const guide = content.querySelector('[data-action="guide-bus"]');
  let text;
  if (service.aboard) {
    text = service.requested ? bus.requested(bus.stops[next])
      : stop ? bus.arrived(bus.stops[stop]) : bus.riding(bus.stops[next]);
  } else if (nearby) {
    const wait = waitForStop(service, nearby);
    text = !canAfford ? bus.insufficient
      : wait ? bus.waiting(bus.stops[nearby], Math.ceil(wait / 1_000)) : bus.ready(bus.stops[nearby]);
  } else {
    text = bus.needStop(bus.stops[nearestStop()]);
  }
  const status = get('bus-status');
  if (status.textContent !== text) status.textContent = text;
  const fareText = service.aboard ? bus.paid : bus.fare(money(fare));
  const fareLine = get('bus-fare');
  if (fareLine.textContent !== fareText) fareLine.textContent = fareText;
  board.hidden = service.aboard || !nearby;
  board.disabled = !canAfford || stop !== nearby;
  leave.hidden = !service.aboard;
  leave.disabled = service.requested;
  leave.textContent = stop ? bus.alight : bus.request;
  guide.hidden = service.aboard || Boolean(nearby);
}

function residentPanel(id) {
  const dialogue = language.residents;
  return `<p class="spoken-line">${spoken || dialogue.greetings[id]}</p><div class="button-row">
    ${id === 'ines' ? button('share-shift', dialogue.share, false, true) : ''}
    ${id === 'ines' || id === 'nico' ? button('remember-shift', dialogue.ask, false, true) : ''}
  </div>`;
}

function tellResident(action) {
  const dialogue = language.residents;
  const sites = language.employment.sites;
  if (action === 'share-shift' && panel === 'ines') {
    const memory = rememberedShift(life.employment);
    spoken = memory ? dialogue.thanks(sites[memory.occupation]) : dialogue.noShift;
    if (memory) life = { ...life, rememberedWork: memory };
  } else if (action === 'remember-shift') {
    const memory = life.rememberedWork;
    spoken = panel === 'nico' ? dialogue.joke
      : Number.isSafeInteger(memory?.day) && Object.hasOwn(sites, memory.occupation)
        ? dialogue.memory(sites[memory.occupation], memory.day) : dialogue.emptyMemory;
  }
}

function showPanel(id, focusView = true) {
  if (!life || (clock.rest && id !== 'sleeping') || (id === 'sleep' && !canSleep())
    || (id === 'transport' && !room)) return;
  const resident = residents[id];
  if (resident && focusView && markerElements[id].hidden) return;
  closeReflection?.();
  closeReflection = null;
  if (id !== panel) spoken = '';
  panel = id;
  room?.stop();
  room?.talk(resident ? id : null);
  if (focusView && zone === 'home' && roomActions.includes(id)) room?.focus(id);
  sheet.classList.toggle('sleeping', id === 'sleeping');
  get('sheet-title').textContent = resident ? resident.name : id === 'transport' ? language.transit.title
    : id === 'map' ? language.mapTitle
    : id === 'job' ? language.employment.title : language.actions[id] ?? language[id];
  get('sheet-subtitle').textContent = resident ? language.residents.roles[id] : id === 'transport' ? language.transit.line
    : id === 'job' ? language.employment.day + ' ' + clock.day
    : id === 'map' ? '' : id === 'sleep' || id === 'sleeping' ? language.night
    : language.subtitles[id] ?? (language.month + ' ' + (life.lastReceipt?.month ?? life.month));

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
    job: jobPanel,
    map: cityMapPanel,
    transport: transitPanel,
    diary: () => {
      return `<blockquote>“${language.trying(life.yearsTrying)}”</blockquote><p>${localReflection()}</p>
        ${reflectionMarkup(language.voice)}`;
    },
    receipt: () => `${statement(receipt, true)}${progress()}`,
    help: () => `<p>${language.controls}</p>`,
    sleep: () => `<p>${language.sleepNote}</p>${button('sleep', language.sleep)}`,
    sleeping: () => `<p id="sleep-remaining" role="status">${language.seconds(Math.ceil(clock.rest / 1_000))}</p>`,
  };
  content.innerHTML = resident ? residentPanel(id) : panels[id]();
  if (id === 'diary') closeReflection = bindReflection(content, {
    copy: language.voice, context: innerContext, fallback: localReflection,
  });
  if (id === 'map') drawCityMap(get('city-plan'), room.position(), language, wholeCity, life.employment.occupation);
  if (id === 'transport') renderTransit();
  content.scrollTop = 0;
  if (!sheet.open) sheet.showModal();
}

function gameAction(action) {
  switch (action) {
    case 'closeMonth':
      if (panel !== 'budget') return;
      life = closeMonth(life);
      updateThought();
      panel = 'receipt';
      break;
    case 'receipt':
      showPanel('receipt', false);
      return;
    case 'clock-in':
    case 'stock-shop':
    case 'sell-customer': {
      tickClock();
      if (panel !== 'job') return;
      const args = [life.employment, clock.day, readClock(clock), atAssignedCounter()];
      const employment = action === 'clock-in' ? clockIn(...args)
        : action === 'stock-shop' ? stockShop(...args) : sellToCustomer(...args, unitPrice());
      if (employment === life.employment) return;
      life = { ...life, employment };
      break;
    }
    case 'guide-job':
      sheet.close();
      guideCommute();
      return;
    case 'job-map':
      showPanel('map', false);
      return;
    case 'board-bus': {
      if (panel !== 'transport' || !room) return;
      const paid = payBusFare(life);
      if (paid !== life && room.board()) {
        life = paid;
        persist();
        updateHud();
        sheet.close();
      } else renderTransit();
      return;
    }
    case 'leave-bus':
      room.leaveBus();
      persist();
      if (room.transit().aboard) renderTransit();
      else sheet.close();
      return;
    case 'guide-bus':
      sheet.close();
      if (zone === 'home') room.focus('door');
      else if (workplaces[zone]) {
        const { x, z, depth } = workplaces[zone];
        room.lookToward({ x, z: z - depth / 2 - 0.7 });
      } else room.lookToward(stops[nearestStop()].platform);
      return;
    case 'share-shift':
    case 'remember-shift':
      tellResident(action);
      break;
    case 'map-scale':
      wholeCity = !wholeCity;
      showPanel('map', false);
      content.querySelector('[data-action="map-scale"]').focus();
      return;
    case 'sleep':
      tickClock();
      if (panel !== 'sleep' || !canSleep()) return;
      clock = startSleep(clock);
      clockTick = performance.now();
      showPanel('sleeping', false);
      renderClock();
      persist();
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
  if (control) showPanel(control.dataset.panel, !budgetDrawer.contains(control));
});
budgetToggle.addEventListener('click', () => setBudgetOpen(budgetDrawer.hidden));
get('budget-close').addEventListener('click', () => setBudgetOpen(false));
get('help').addEventListener('click', () => showPanel('help'));
get('route').addEventListener('click', () => room?.focus('door'));
get('bed').addEventListener('click', () => showPanel('sleep'));
get('job').addEventListener('click', () => showPanel('job'));
get('transport').addEventListener('click', () => showPanel('transport'));
get('map').addEventListener('click', () => showPanel('map'));
get('sound').addEventListener('click', async () => {
  get('sound').disabled = true;
  soundOn = await sound.toggle();
  updateSoundButton();
  get('sound').disabled = false;
});
get('close').addEventListener('click', () => { if (!clock?.rest) sheet.close(); });
sheet.addEventListener('cancel', (event) => { if (clock?.rest) event.preventDefault(); });
sheet.addEventListener('close', () => {
  closeReflection?.();
  closeReflection = null;
  panel = null;
  room?.talk(null);
  sheet.classList.remove('sleeping');
});
content.addEventListener('click', (event) => {
  const destination = event.target.closest('[data-destination]');
  if (destination && panel === 'map') {
    sheet.close();
    if (zone === 'home') room.focus('door');
    else room.lookToward(destinations[destination.dataset.destination]);
    return;
  }
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
  if (key === 'escape' && !budgetDrawer.hidden) {
    setBudgetOpen(false);
  } else if (key === 'e' && focusedAction && !event.repeat) {
    showPanel(markerElements[focusedAction].dataset.panel);
  } else if (key === 'm' && room && !event.repeat) {
    showPanel('map');
  } else if (key === 'g' && !event.repeat) {
    guideCommute();
  } else if (key === 'b' && room && !event.repeat) {
    showPanel('transport');
  } else if (controlledKeys.includes(key)) {
    event.preventDefault();
    room?.key(key, true);
  }
});
window.addEventListener('keyup', (event) => room?.key(event.key.toLowerCase(), false));
window.addEventListener('blur', () => room?.stop());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (clockTick !== null) tickClock(true);
    room?.stop();
    if (room) registerHome();
    persist();
  }
  clockTick = null;
  if (!document.hidden && clock) {
    // Reconcile a transition that may have finished just before the tab went away.
    if (sheet.open && ((panel === 'sleeping' && !clock.rest) || (panel === 'sleep' && !canSleep()))) sheet.close();
    renderClock();
    renderEmployment();
    tickClock();
  }
});
window.addEventListener('pagehide', () => { tickClock(true); persist(); });
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
window.setInterval(tickClock, 100);

import('./room.js').then(({ createRoom }) => {
  room = createRoom(scene, paintMarkers);
  get('route').hidden = false;
  get('map').hidden = false;
  get('transport').hidden = false;
  if (life) {
    room.spawn(life.moment, true, life.position, life.transit);
    zone = room.zone();
    room.localizeWorkplaces(language.employment.sites);
    room.localizeTransit(language.transit.stops);
    if (registerHome()) persist();
    room.setTime(readClock(clock).minute);
    updateHud();
    updateThought();
  }
}).catch((error) => {
  console.error('Could not render the room', error);
  get('render-error').hidden = false;
});
