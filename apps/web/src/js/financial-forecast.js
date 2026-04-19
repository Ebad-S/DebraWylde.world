(function () {
  'use strict';

  const form = document.getElementById('forecast-form');
  if (!form) return;

  const money = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  });

  function readNumber(id) {
    const field = document.getElementById(id);
    if (!field) return 0;
    const value = Number(field.value);
    return Number.isFinite(value) ? value : 0;
  }

  function renderScenarioRows(scenarios) {
    const body = document.getElementById('scenario-body');
    if (!body) return;

    body.innerHTML = scenarios
      .map(function (scenario) {
        return [
          '<tr>',
          '<th scope="row">' + scenario.label + '</th>',
          '<td>' + money.format(scenario.revenue) + '</td>',
          '<td>' + money.format(scenario.cashIn) + '</td>',
          '<td>' + money.format(scenario.expenses) + '</td>',
          '<td>' + money.format(scenario.netCash) + '</td>',
          '<td>' + money.format(scenario.netProfit) + '</td>',
          '</tr>'
        ].join('');
      })
      .join('');
  }

  function calcScenario(label, inputs, upliftFactor) {
    const revenue = inputs.monthlySales * 12 * upliftFactor;
    const cogs = revenue * (inputs.cogsPct / 100);
    const merchantFees = revenue * (inputs.merchantFeePct / 100);
    const marketing = inputs.monthlyMarketing * 12 * upliftFactor;
    const fixedCosts = inputs.monthlyFixedCosts * 12 * upliftFactor;
    const depreciation = inputs.assetValue / Math.max(inputs.assetLifeYears, 1);

    const monthlyRate = inputs.loanRatePct / 1200;
    const terms = Math.max(inputs.loanTermYears * 12, 1);
    let annualLoanRepayment = 0;

    if (inputs.loanPrincipal > 0) {
      if (monthlyRate > 0) {
        const monthlyRepayment =
          (inputs.loanPrincipal * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -terms));
        annualLoanRepayment = monthlyRepayment * 12;
      } else {
        annualLoanRepayment = inputs.loanPrincipal / Math.max(inputs.loanTermYears, 1);
      }
    }

    const interestExpense = inputs.loanPrincipal * (inputs.loanRatePct / 100);
    const debtorLagMonths = Math.max(inputs.debtorDays / 30, 0);
    const collectionFactor = Math.max(0, 1 - debtorLagMonths / 12);
    const cashIn = revenue * collectionFactor;

    const expenses =
      cogs + merchantFees + marketing + fixedCosts + annualLoanRepayment + depreciation;
    const netCash = inputs.openingCash + cashIn - expenses;
    const gstCollected = revenue * (inputs.gstPct / (100 + inputs.gstPct));
    const taxableBase = Math.max(revenue - (cogs + merchantFees + marketing + fixedCosts + depreciation + interestExpense), 0);
    const taxExpense = taxableBase * (inputs.taxRatePct / 100);
    const netProfit = taxableBase - taxExpense;

    return {
      label: label,
      revenue: revenue,
      cashIn: cashIn,
      expenses: expenses,
      netCash: netCash,
      netProfit: netProfit,
      gstCollected: gstCollected
    };
  }

  function updateForecast() {
    const inputs = {
      openingCash: readNumber('opening-cash'),
      monthlySales: readNumber('monthly-sales'),
      growthPct: readNumber('growth-pct'),
      debtorDays: readNumber('debtor-days'),
      cogsPct: readNumber('cogs-pct'),
      merchantFeePct: readNumber('merchant-fee-pct'),
      monthlyFixedCosts: readNumber('monthly-fixed-costs'),
      monthlyMarketing: readNumber('monthly-marketing'),
      loanPrincipal: readNumber('loan-principal'),
      loanRatePct: readNumber('loan-rate-pct'),
      loanTermYears: readNumber('loan-term-years'),
      assetValue: readNumber('asset-value'),
      assetLifeYears: readNumber('asset-life-years'),
      taxRatePct: readNumber('tax-rate-pct'),
      gstPct: readNumber('gst-pct')
    };

    const growthMultiplier = 1 + inputs.growthPct / 100;
    const year1 = calcScenario('Year 1', inputs, 1);
    const year2 = calcScenario('Year 2', inputs, growthMultiplier);
    const year3 = calcScenario('Year 3', inputs, growthMultiplier * growthMultiplier);
    const scenarios = [year1, year2, year3];

    const totalRevenue = year1.revenue + year2.revenue + year3.revenue;
    const totalProfit = year1.netProfit + year2.netProfit + year3.netProfit;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const breakEvenRevenue =
      inputs.monthlySales > 0
        ? (inputs.monthlyFixedCosts * 12) /
          Math.max(1 - (inputs.cogsPct + inputs.merchantFeePct) / 100, 0.01)
        : 0;

    document.getElementById('summary-revenue').textContent = money.format(totalRevenue);
    document.getElementById('summary-profit').textContent = money.format(totalProfit);
    document.getElementById('summary-margin').textContent = avgMargin.toFixed(1) + '%';
    document.getElementById('summary-breakeven').textContent = money.format(breakEvenRevenue);

    document.getElementById('gst-year1').textContent = money.format(year1.gstCollected);
    document.getElementById('cash-year1').textContent = money.format(year1.netCash);
    document.getElementById('profit-year1').textContent = money.format(year1.netProfit);

    renderScenarioRows(scenarios);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    updateForecast();
  });

  form.querySelectorAll('input').forEach(function (input) {
    input.addEventListener('input', updateForecast);
  });

  updateForecast();
})();
