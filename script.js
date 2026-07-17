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
];

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function calculateEmi(principal, annualRate, years) {
  if (principal <= 0 || annualRate < 0 || years <= 0) {
    return null;
  }

  const monthlyRate = annualRate / 100 / 12;
  const totalMonths = years * 12;

  if (monthlyRate === 0) {
    return principal / totalMonths;
  }

  const factor = Math.pow(1 + monthlyRate, totalMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function syncControl(control) {
  const rangeValue = Number(control.range.value);
  const clampedValue = Math.min(Math.max(rangeValue, Number(control.input.min) || 0), Number(control.input.max) || rangeValue);
  control.range.value = clampedValue;
  control.input.value = clampedValue;
  control.display.textContent = control.formatter(clampedValue);
}

function buildSchedule(principal, annualRate, years, graceMonths, emi) {
  const monthlyRate = annualRate / 100 / 12;
  const totalMonths = years * 12;
  const rows = [];
  let balance = principal;

  for (let month = 1; month <= graceMonths; month += 1) {
    const interest = balance * monthlyRate;
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

  for (let month = 1; month <= totalMonths; month += 1) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(emi - interest, balance);
    balance = Math.max(0, balance - principalPaid);
    rows.push({
      month,
      payment: emi,
      interest,
      principal: principalPaid,
      balance,
      type: 'Repayment',
    });
  }

  return rows;
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

  const emi = calculateEmi(principal, annualRate, years);

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

  const totalMonths = years * 12;
  const graceInterest = graceMonths > 0 ? principal * (annualRate / 100 / 12) * graceMonths : 0;
  const effectivePrincipal = principal + graceInterest;
  const adjustedEmi = calculateEmi(effectivePrincipal, annualRate, years);
  const totalPayable = adjustedEmi * totalMonths;
  const totalInterest = totalPayable - principal;

  emiValue.textContent = formatCurrency(adjustedEmi);
  interestValue.textContent = formatCurrency(totalInterest);
  payableValue.textContent = formatCurrency(totalPayable);

  if (graceMonths > 0) {
    graceSummary.textContent = `Your moratorium adds ₹${Math.round(graceInterest).toLocaleString('en-IN')} of interest before repayment starts.`;
  } else {
    graceSummary.textContent = 'No grace period selected.';
  }

  snapshotSummary.textContent = `A ${years}-year plan with ${graceMonths} month${graceMonths === 1 ? '' : 's'} of grace creates an estimated EMI of ${formatCurrency(adjustedEmi)}.`;

  const rows = buildSchedule(principal, annualRate, years, graceMonths, adjustedEmi);
  scheduleCaption.textContent = `Showing ${Math.min(rows.length, 24)} of ${rows.length} entries for a ${years}-year plan.`;
  scheduleBody.innerHTML = rows.slice(0, 24).map((row) => `
    <tr>
      <td>${row.type === 'Grace' ? row.month : row.month}</td>
      <td>${row.payment === 0 ? '—' : formatCurrency(row.payment)}</td>
      <td>${formatCurrency(row.interest)}</td>
      <td>${row.principal === 0 ? '—' : formatCurrency(row.principal)}</td>
      <td>${formatCurrency(row.balance)}</td>
    </tr>
  `).join('');

  drawChart(principal, totalInterest, totalPayable);
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

form.addEventListener('submit', updateResults);
resetBtn.addEventListener('click', () => {
  form.reset();
  controls.forEach(syncControl);
  updateResults();
});

controls.forEach(syncControl);
updateResults();
