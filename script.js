const form = document.getElementById('loan-form');
const emiValue = document.getElementById('emi-value');
const interestValue = document.getElementById('interest-value');
const payableValue = document.getElementById('payable-value');
const graceSummary = document.getElementById('grace-summary');
const snapshotSummary = document.getElementById('snapshot-summary');
const scheduleBody = document.getElementById('schedule-body');
const scheduleCaption = document.getElementById('schedule-caption');
const resetBtn = document.getElementById('reset-btn');
const chartCanvas = document.getElementById('summary-chart');
const interestOnlyToggle = document.getElementById('interest-only-toggle');
const interestOnlyMonthsInput = document.getElementById('interest-only-months');
const interestOnlyMonthsRange = document.getElementById('interest-only-months-range');
const interestOnlyMonthsDisplay = document.getElementById('interest-only-months-value');

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const controls = [
  {
    range: document.getElementById('loan-amount-range'),
    input: document.getElementById('loan-amount'),
    display: document.getElementById('loan-amount-value'),
    formatter: (value) => formatCurrency(value),
  },
  {
    range: document.getElementById('interest-rate-range'),
    input: document.getElementById('interest-rate'),
    display: document.getElementById('interest-rate-value'),
    formatter: (value) => `${Number(value).toFixed(1)}%`,
  },
  {
    range: document.getElementById('tenure-years-range'),
    input: document.getElementById('tenure-years'),
    display: document.getElementById('tenure-years-value'),
    formatter: (value) => `${Math.round(value)} year${Math.round(value) === 1 ? '' : 's'}`,
  },
  {
    range: document.getElementById('grace-months-range'),
    input: document.getElementById('grace-months'),
    display: document.getElementById('grace-months-value'),
    formatter: (value) => `${Math.round(value)} month${Math.round(value) === 1 ? '' : 's'}`,
  },
  {
    range: interestOnlyMonthsRange,
    input: interestOnlyMonthsInput,
    display: interestOnlyMonthsDisplay,
    formatter: (value) => `${Math.round(value)} month${Math.round(value) === 1 ? '' : 's'}`,
  },
  {
    range: document.getElementById('advance-payment-range'),
    input: document.getElementById('advance-payment'),
    display: document.getElementById('advance-payment-value'),
    formatter: (value) => formatCurrency(value),
  },
];

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function calculateEmi(principal, annualRate, months) {
  if (principal <= 0 || annualRate < 0 || months <= 0) {
    return null;
  }

  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) {
    return principal / months;
  }

  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function syncControl(control) {
  const rangeValue = Number(control.range.value);
  const minValue = Number(control.input.min) || 0;
  const maxValue = Number(control.input.max) || rangeValue;
  const clampedValue = Math.min(Math.max(rangeValue, minValue), maxValue);
  control.range.value = clampedValue;
  control.input.value = clampedValue;
  control.display.textContent = control.formatter(clampedValue);
}

function buildSchedule(principal, annualRate, years, graceMonths, interestOnlyEnabled, interestOnlyMonths, advancePayment) {
  const monthlyRate = annualRate / 100 / 12;
  const totalMonths = years * 12;
  const effectivePrincipal = Math.max(principal - advancePayment, 0);
  const rows = [];
  let balance = effectivePrincipal;
  let totalInterest = 0;
  let paymentMonths = 0;

  for (let month = 1; month <= graceMonths; month += 1) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    balance += interest;
    rows.push({
      month: `G${month}`,
      payment: 0,
      interest,
      principal: 0,
      balance,
      type: 'Grace',
    });
  }

  if (interestOnlyEnabled && interestOnlyMonths > 0) {
    const interestOnlyPeriod = Math.min(interestOnlyMonths, totalMonths - graceMonths);
    for (let month = 1; month <= interestOnlyPeriod; month += 1) {
      const interest = balance * monthlyRate;
      totalInterest += interest;
      rows.push({
        month: `I${month}`,
        payment: interest,
        interest,
        principal: 0,
        balance,
        type: 'Interest-only',
      });
    }
  }

  const remainingMonths = Math.max(totalMonths - graceMonths - (interestOnlyEnabled ? Math.min(interestOnlyMonths, totalMonths - graceMonths) : 0), 1);
  const repaymentEmi = calculateEmi(balance, annualRate, remainingMonths);

  for (let month = 1; month <= remainingMonths; month += 1) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(repaymentEmi - interest, balance);
    balance = Math.max(0, balance - principalPaid);
    paymentMonths += 1;
    totalInterest += interest;
    rows.push({
      month: paymentMonths,
      payment: repaymentEmi,
      interest,
      principal: principalPaid,
      balance,
      type: 'Repayment',
    });
  }

  return {
    rows,
    totalInterest,
    repaymentEmi,
    effectivePrincipal,
    totalPayable: advancePayment + effectivePrincipal + totalInterest,
  };
}

function drawChart(principal, interest, payable) {
  const context = chartCanvas.getContext('2d');
  const width = chartCanvas.width;
  const height = chartCanvas.height;
  const maxValue = Math.max(principal, interest, payable);

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  const barWidth = 70;
  const gap = 40;
  const startX = 60;
  const chartHeight = 140;
  const labels = ['Principal', 'Interest', 'Total'];
  const values = [principal, interest, payable];
  const colors = ['#0f6fff', '#14a8a8', '#f59e0b'];

  context.fillStyle = '#14223b';
  context.font = '12px Inter, sans-serif';
  context.fillText('Overview of repayment', 20, 20);

  values.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = startX + index * (barWidth + gap);
    const y = height - 40 - barHeight;

    context.fillStyle = colors[index];
    context.fillRect(x, y, barWidth, barHeight);
    context.fillStyle = '#14223b';
    context.fillText(labels[index], x, height - 16);
    context.fillText(formatCurrency(value), x - 8, y - 8);
  });
}

function updateResults(event) {
  if (event) {
    event.preventDefault();
  }

  const formData = new FormData(form);
  const principal = Number(formData.get('loanAmount'));
  const annualRate = Number(formData.get('interestRate'));
  const years = Number(formData.get('tenureYears'));
  const graceMonths = Number(formData.get('graceMonths'));
  const interestOnlyEnabled = interestOnlyToggle.checked;
  const interestOnlyMonths = Number(formData.get('interestOnlyMonths'));
  const advancePayment = Number(formData.get('advancePayment'));

  const emi = calculateEmi(principal, annualRate, years * 12);

  if (!emi) {
    emiValue.textContent = '₹0';
    interestValue.textContent = '₹0';
    payableValue.textContent = '₹0';
    graceSummary.textContent = 'No grace period selected.';
    snapshotSummary.textContent = 'Your plan will be displayed here.';
    scheduleBody.innerHTML = '';
    scheduleCaption.textContent = 'A monthly repayment plan will appear here.';
    return;
  }

  const plan = buildSchedule(principal, annualRate, years, graceMonths, interestOnlyEnabled, interestOnlyMonths, advancePayment);
  const { rows, totalInterest, totalPayable, repaymentEmi, effectivePrincipal } = plan;

  emiValue.textContent = formatCurrency(repaymentEmi || emi);
  interestValue.textContent = formatCurrency(totalInterest);
  payableValue.textContent = formatCurrency(totalPayable);

  if (graceMonths > 0) {
    graceSummary.textContent = `Your moratorium adds interest before repayment begins, and an advance payment of ${formatCurrency(advancePayment)} lowers the financed balance to ${formatCurrency(effectivePrincipal)}.`;
  } else {
    graceSummary.textContent = interestOnlyEnabled && interestOnlyMonths > 0
      ? `You are paying only interest for ${interestOnlyMonths} month${interestOnlyMonths === 1 ? '' : 's'} before regular repayment starts.`
      : 'No grace or interest-only period selected.';
  }

  snapshotSummary.textContent = interestOnlyEnabled && interestOnlyMonths > 0
    ? `A ${years}-year plan with ${interestOnlyMonths} month${interestOnlyMonths === 1 ? '' : 's'} of interest-only repayment creates an EMI of ${formatCurrency(repaymentEmi || emi)} after that phase.`
    : `A ${years}-year plan with ${graceMonths} month${graceMonths === 1 ? '' : 's'} of grace creates an estimated EMI of ${formatCurrency(repaymentEmi || emi)}.`;

  scheduleCaption.textContent = `Showing ${Math.min(rows.length, 24)} of ${rows.length} entries for a ${years}-year plan.`;
  scheduleBody.innerHTML = rows.slice(0, 24).map((row) => `
    <tr>
      <td>${row.type === 'Repayment' ? row.month : row.month}</td>
      <td>${row.payment === 0 ? '—' : formatCurrency(row.payment)}</td>
      <td>${formatCurrency(row.interest)}</td>
      <td>${row.principal === 0 ? '—' : formatCurrency(row.principal)}</td>
      <td>${formatCurrency(row.balance)}</td>
    </tr>
  `).join('');

  drawChart(effectivePrincipal, totalInterest, totalPayable);
}

controls.forEach((control) => {
  control.range.addEventListener('input', () => {
    syncControl(control);
    updateResults();
  });

  control.input.addEventListener('input', () => {
    syncControl(control);
    updateResults();
  });
});

interestOnlyToggle.addEventListener('change', () => {
  interestOnlyMonthsInput.disabled = !interestOnlyToggle.checked;
  interestOnlyMonthsRange.disabled = !interestOnlyToggle.checked;
  if (!interestOnlyToggle.checked) {
    interestOnlyMonthsInput.value = 0;
    interestOnlyMonthsRange.value = 0;
    interestOnlyMonthsDisplay.textContent = '0 months';
  }
  updateResults();
});

form.addEventListener('submit', updateResults);
resetBtn.addEventListener('click', () => {
  form.reset();
  controls.forEach(syncControl);
  interestOnlyToggle.checked = false;
  interestOnlyMonthsInput.disabled = true;
  interestOnlyMonthsRange.disabled = true;
  interestOnlyMonthsDisplay.textContent = '0 months';
  updateResults();
});

controls.forEach(syncControl);
interestOnlyMonthsInput.disabled = true;
interestOnlyMonthsRange.disabled = true;
updateResults();

// Timezone calculator logic - only runs on timezone.html page
const tzSelect = document.getElementById('tz-target');
const tzDatetime = document.getElementById('tz-datetime');
const tzOutput = document.getElementById('tz-output');
const tzConvertBtn = document.getElementById('tz-convert');
const tzNowBtn = document.getElementById('tz-now');

const commonTimezones = [
  'UTC',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Asia/Dubai',
  'Africa/Johannesburg'
];

function populateTimezones() {
  tzSelect.innerHTML = '';
  const list = (Intl.supportedValuesOf && Intl.supportedValuesOf('timeZone')) || commonTimezones;
  const candidates = list.includes('Asia/Kolkata') ? list : commonTimezones;
  candidates.forEach((tz) => {
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz;
    tzSelect.appendChild(opt);
  });
}

function formatInZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch (e) {
    return 'Unsupported timezone';
  }
}

function convertLocalToTimezone() {
  const target = tzSelect.value;
  const localValue = tzDatetime.value;
  if (!localValue) {
    tzOutput.textContent = 'Please choose a local date & time.';
    return;
  }
  const localDate = new Date(localValue);
  tzOutput.textContent = formatInZone(localDate, target);
}

function showNowInTimezone() {
  const target = tzSelect.value;
  const now = new Date();
  tzOutput.textContent = formatInZone(now, target);
}

// Only run timezone code if on timezone page
if (tzSelect && tzDatetime) {
  populateTimezones();
  
  // set default datetime to now (local)
  (function setDefaultDatetime() {
    const now = new Date();
    const tzLocal = now.toISOString().slice(0,16);
    tzDatetime.value = tzLocal;
  })();

  tzConvertBtn.addEventListener('click', convertLocalToTimezone);
  tzNowBtn.addEventListener('click', showNowInTimezone);
  
  // Populate timezone reference grid
  const referenceGrid = document.getElementById('timezone-reference');
  if (referenceGrid) {
    const referenceTzs = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'];
    
    function updateReferenceGrid() {
      referenceGrid.innerHTML = referenceTzs.map(tz => {
        const now = new Date();
        const time = formatInZone(now, tz);
        return `
          <div class="tz-ref-card">
            <p class="tz-name">${tz}</p>
            <strong class="tz-time">${time}</strong>
          </div>
        `;
      }).join('');
    }
    
    updateReferenceGrid();
    setInterval(updateReferenceGrid, 1000);
  }
  
  // Update current time in hero
  const currentTimeEl = document.getElementById('current-time');
  if (currentTimeEl) {
    function updateCurrentTime() {
      const now = new Date();
      currentTimeEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
  }
}

// Loan Comparison Tool - only runs on index.html page
if (document.getElementById('save-scenario-btn')) {
  const saveScenarioBtn = document.getElementById('save-scenario-btn');
  const clearScenariosBtn = document.getElementById('clear-scenarios-btn');
  const scenariosContainer = document.getElementById('scenarios-container');
  const comparisonTable = document.getElementById('comparison-table');
  const comparisonBody = document.getElementById('comparison-body');

  let scenarios = JSON.parse(localStorage.getItem('loanScenarios')) || [];

  function getCurrentScenario() {
    const formData = new FormData(form);
    return {
      loanAmount: Number(formData.get('loanAmount')),
      interestRate: Number(formData.get('interestRate')),
      tenureYears: Number(formData.get('tenureYears')),
      graceMonths: Number(formData.get('graceMonths')),
      interestOnlyMonths: Number(formData.get('interestOnlyMonths')),
      advancePayment: Number(formData.get('advancePayment')),
      interestOnlyEnabled: interestOnlyToggle.checked,
    };
  }

  function calculateScenarioResults(scenario) {
    const { loanAmount, interestRate, tenureYears, graceMonths, interestOnlyMonths, advancePayment, interestOnlyEnabled } = scenario;
    const plan = buildSchedule(loanAmount, interestRate, tenureYears, graceMonths, interestOnlyEnabled, interestOnlyMonths, advancePayment);
    const emi = calculateEmi(loanAmount, interestRate, tenureYears * 12);
    
    return {
      emi: plan.repaymentEmi || emi,
      totalInterest: plan.totalInterest,
      totalPayable: plan.totalPayable,
      effectivePrincipal: plan.effectivePrincipal,
    };
  }

  function saveScenario() {
    if (scenarios.length >= 3) {
      alert('You can only compare up to 3 scenarios. Clear scenarios to add more.');
      return;
    }
    
    const scenario = getCurrentScenario();
    const results = calculateScenarioResults(scenario);
    
    scenarios.push({
      id: Date.now(),
      timestamp: new Date().toLocaleString('en-IN'),
      scenario,
      results,
      name: `Scenario ${scenarios.length + 1}`,
    });
    
    localStorage.setItem('loanScenarios', JSON.stringify(scenarios));
    renderScenarios();
    updateComparisonTable();
  }

  function removeScenario(id) {
    scenarios = scenarios.filter(s => s.id !== id);
    localStorage.setItem('loanScenarios', JSON.stringify(scenarios));
    renderScenarios();
    updateComparisonTable();
  }

  function clearAllScenarios() {
    if (confirm('Clear all saved scenarios?')) {
      scenarios = [];
      localStorage.removeItem('loanScenarios');
      renderScenarios();
      updateComparisonTable();
    }
  }

  function renderScenarios() {
    if (scenarios.length === 0) {
      scenariosContainer.innerHTML = '<div class="empty-state"><p>Save your first scenario to start comparing loans.</p></div>';
      return;
    }
    
    scenariosContainer.innerHTML = scenarios.map((s, index) => `
      <div class="scenario-card">
        <div class="scenario-header">
          <h4>${s.name}</h4>
          <div class="scenario-meta">${s.timestamp}</div>
        </div>
        <div class="scenario-details">
          <div class="scenario-detail">
            <span class="label">Loan Amount</span>
            <span class="value">${formatCurrency(s.scenario.loanAmount)}</span>
          </div>
          <div class="scenario-detail">
            <span class="label">Interest Rate</span>
            <span class="value">${s.scenario.interestRate.toFixed(1)}%</span>
          </div>
          <div class="scenario-detail">
            <span class="label">Tenure</span>
            <span class="value">${s.scenario.tenureYears} year${s.scenario.tenureYears === 1 ? '' : 's'}</span>
          </div>
          <div class="scenario-detail">
            <span class="label">Grace Period</span>
            <span class="value">${s.scenario.graceMonths} month${s.scenario.graceMonths === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="scenario-results">
          <div class="result">
            <span class="label">Monthly EMI</span>
            <strong>${formatCurrency(s.results.emi)}</strong>
          </div>
          <div class="result">
            <span class="label">Total Interest</span>
            <strong>${formatCurrency(s.results.totalInterest)}</strong>
          </div>
          <div class="result">
            <span class="label">Total Payable</span>
            <strong>${formatCurrency(s.results.totalPayable)}</strong>
          </div>
        </div>
        <button class="remove-scenario-btn" onclick="window.removeScenarioCompare(${s.id})">Remove</button>
      </div>
    `).join('');
  }

  function updateComparisonTable() {
    if (scenarios.length < 2) {
      comparisonTable.style.display = 'none';
      return;
    }
    
    comparisonTable.style.display = 'block';
    
    // Update headers
    for (let i = 1; i <= 3; i++) {
      const header = document.getElementById(`scenario-${i}-header`);
      if (i <= scenarios.length) {
        header.textContent = scenarios[i - 1].name;
        header.style.display = '';
      } else {
        header.style.display = 'none';
      }
    }
    
    const metrics = [
      { label: 'Loan Amount', key: 'loanAmount', type: 'currency' },
      { label: 'Interest Rate', key: 'interestRate', type: 'rate' },
      { label: 'Tenure', key: 'tenureYears', type: 'years' },
      { label: 'Grace Period', key: 'graceMonths', type: 'months' },
      { label: 'Monthly EMI', resultKey: 'emi', type: 'currency' },
      { label: 'Total Interest', resultKey: 'totalInterest', type: 'currency' },
      { label: 'Total Payable', resultKey: 'totalPayable', type: 'currency' },
    ];
    
    comparisonBody.innerHTML = metrics.map(metric => {
      let row = `<tr><td>${metric.label}</td>`;
      
      for (let i = 0; i < 3; i++) {
        if (i < scenarios.length) {
          let value;
          if (metric.resultKey) {
            value = scenarios[i].results[metric.resultKey];
          } else {
            value = scenarios[i].scenario[metric.key];
          }
          
          let formatted;
          if (metric.type === 'currency') {
            formatted = formatCurrency(value);
          } else if (metric.type === 'rate') {
            formatted = `${value.toFixed(1)}%`;
          } else if (metric.type === 'years') {
            formatted = `${value} year${value === 1 ? '' : 's'}`;
          } else if (metric.type === 'months') {
            formatted = `${value} month${value === 1 ? '' : 's'}`;
          }
          
          row += `<td>${formatted}</td>`;
        } else {
          row += '<td>—</td>';
        }
      }
      
      return row + '</tr>';
    }).join('');
  }

  function loadScenarioToForm(scenarioId) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    const s = scenario.scenario;
    document.getElementById('loan-amount').value = s.loanAmount;
    document.getElementById('interest-rate').value = s.interestRate;
    document.getElementById('tenure-years').value = s.tenureYears;
    document.getElementById('grace-months').value = s.graceMonths;
    document.getElementById('interest-only-months').value = s.interestOnlyMonths;
    document.getElementById('advance-payment').value = s.advancePayment;
    interestOnlyToggle.checked = s.interestOnlyEnabled;
    interestOnlyMonthsInput.disabled = !s.interestOnlyEnabled;
    interestOnlyMonthsRange.disabled = !s.interestOnlyEnabled;
    
    controls.forEach(syncControl);
    updateResults();
    
    // Scroll to calculator
    document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
  }

  // Global function for onclick handler
  window.removeScenarioCompare = removeScenario;

  saveScenarioBtn.addEventListener('click', saveScenario);
  clearScenariosBtn.addEventListener('click', clearAllScenarios);

  // Add double-click to load scenario
  scenariosContainer.addEventListener('dblclick', (e) => {
    const card = e.target.closest('.scenario-card');
    if (card && !e.target.closest('button')) {
      const scenarioId = scenarios[Array.from(scenariosContainer.querySelectorAll('.scenario-card')).indexOf(card)].id;
      loadScenarioToForm(scenarioId);
    }
  });

  // Initial render
  renderScenarios();
  updateComparisonTable();
}
