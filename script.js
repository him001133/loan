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

// Timezone calculator logic
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

populateTimezones();
// set default datetime to now (local)
(function setDefaultDatetime() {
  const now = new Date();
  const tzLocal = now.toISOString().slice(0,16);
  tzDatetime.value = tzLocal;
})();

tzConvertBtn.addEventListener('click', convertLocalToTimezone);
tzNowBtn.addEventListener('click', showNowInTimezone);
