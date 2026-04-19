import { escapeHtml } from "../shared/format.js";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function tooltipText(label) {
  if (label.includes("(%)")) return `${label}: Enter a percentage value.`;
  if (label.includes("($)")) return `${label}: Enter a currency amount in dollars.`;
  if (label.includes("Month")) return `${label}: Enter a monthly value.`;
  return `${label}: Enter the value for this field.`;
}

function prettyLabel(option) {
  if (String(option).toUpperCase() === String(option)) return String(option);
  return String(option)
    .replaceAll("_", " ")
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function field(label, path, value, type = "text", extra = "", tooltip = "") {
  const safeValue = type === "checkbox" ? "" : escapeHtml(value ?? "");
  const hint = tooltip || tooltipText(label);
  if (type === "checkbox") {
    return `
      <label class="ff-checkbox">
        <input type="checkbox" data-path="${path}" data-type="boolean" title="${escapeHtml(hint)}" ${value ? "checked" : ""}>
        <span>${label} <small class="ff-tip" title="${escapeHtml(hint)}">ⓘ</small></span>
      </label>
    `;
  }
  return `
    <label class="ff-field">
      <span>${label} <small class="ff-tip" title="${escapeHtml(hint)}">ⓘ</small></span>
      <input type="${type}" value="${safeValue}" data-path="${path}" title="${escapeHtml(hint)}" ${extra}>
    </label>
  `;
}

function selectField(label, path, value, options, tooltip = "") {
  const htmlOptions = options
    .map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${prettyLabel(option)}</option>`)
    .join("");
  const hint = tooltip || `${label}: Choose the most accurate option.`;
  return `
    <label class="ff-field">
      <span>${label} <small class="ff-tip" title="${escapeHtml(hint)}">ⓘ</small></span>
      <select data-path="${path}" title="${escapeHtml(hint)}">${htmlOptions}</select>
    </label>
  `;
}

function renderIntro(state) {
  return `
    <section class="ff-panel">
      <p>Start with your company name, then move through each section at your own pace. Your progress saves automatically.</p>
      <div class="ff-grid ff-grid--2">
        ${field("Company Name", "setup.businessName", state.setup.businessName, "text", `placeholder="Your Business Name"`)}
        ${selectField("Forecast Currency", "meta.currency", state.meta.currency || "AUD", ["AUD", "USD", "BTC"])}
      </div>
      <p class="ff-helper">You can move freely between steps even if some sections are still incomplete.</p>
    </section>
  `;
}

function renderSetup(state) {
  return `
    <section class="ff-panel">
      <div class="ff-grid ff-grid--3">
        ${selectField("Start Month", "setup.startMonth", state.setup.startMonth, ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
        ${selectField("Trading Structure", "setup.tradingStructure", state.setup.tradingStructure, ["sole_trader", "partnership", "company", "trust", "other"])}
        ${selectField("GST Registration", "setup.gstRegistration", state.setup.gstRegistration, ["registered", "not_registered"])}
        ${field("Charge GST On Sales", "setup.chargeGstOnSales", state.setup.chargeGstOnSales, "checkbox")}
        ${selectField("BAS Frequency", "setup.basFrequency", state.setup.basFrequency, ["monthly", "quarterly", "annual"])}
        ${selectField("Report Basis", "setup.reportBasis", state.setup.reportBasis, ["cash_basis_view", "accrual_basis_view", "dual_view"])}
        ${field("Opening Cash ($)", "setup.openingCash", state.setup.openingCash, "number", `step="100"`)}
      </div>
    </section>
  `;
}

function renderSalesDetails(state) {
  const linesHtml = state.salesDetails.lines
    .map((line, index) => {
      const monthlyUnits = Array.from({ length: 12 }, (_, monthIndex) => {
        const explicit = line.uiMonthlyUnitsByMonth?.[monthIndex];
        if (explicit != null && explicit !== "") return explicit;
        return Number(line.defaultUnitsPerPeriod || 0);
      });
      const seasonality = monthlyUnits.map((value, monthIndex) =>
        field(
          `M${monthIndex + 1} (${MONTH_LABELS[monthIndex]}) Units`,
          `salesDetails.lines.${index}.uiMonthlyUnitsByMonth.${monthIndex}`,
          value,
          "number",
          `step="0.01" data-monthly-units="1" data-line-index="${index}" data-month-index="${monthIndex}"`
        )
      ).join("");
      return `
        <article class="ff-subpanel">
          <div class="ff-subsection-head">
            <h3>Revenue Line ${index + 1}</h3>
            <button class="btn btn--outline" data-action="remove-sales-line" data-index="${index}" ${state.salesDetails.lines.length === 1 ? "disabled" : ""}>Remove</button>
          </div>
          <div class="ff-grid ff-grid--3">
            ${field("Name", `salesDetails.lines.${index}.name`, line.name)}
            ${selectField("Type", `salesDetails.lines.${index}.type`, line.type, ["service", "product", "other"])}
            ${field("Unit Price ($)", `salesDetails.lines.${index}.unitPrice`, line.unitPrice, "number", `step="0.01"`)}
            ${field("Default Units/Month (Qty)", `salesDetails.lines.${index}.defaultUnitsPerPeriod`, line.defaultUnitsPerPeriod, "number", `step="0.01"`)}
            ${field("COGS Per Unit ($)", `salesDetails.lines.${index}.costOfGoodsSold`, line.costOfGoodsSold ?? "", "number", `step="0.01"`)}
            ${field("Gross Margin (%)", `salesDetails.lines.${index}.grossMarginPercent`, line.grossMarginPercent ?? "", "number", `step="0.01" readonly`)}
            ${field("Merchant Fee (%)", `salesDetails.lines.${index}.merchantFeePercent`, line.merchantFeePercent ?? 0, "number", `step="0.01"`)}
            ${field("GST Applies", `salesDetails.lines.${index}.gstApplies`, line.gstApplies, "checkbox")}
            ${field("Active", `salesDetails.lines.${index}.isActive`, line.isActive, "checkbox")}
          </div>
          <div class="ff-seasonality-grid">${seasonality}</div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="ff-panel">
      <p class="ff-helper">Total Revenue Lines: ${state.salesDetails.lines.length}</p>
      ${linesHtml}
      <div class="ff-bottom-actions">
        <button class="btn btn--outline" data-action="add-sales-line">Add Revenue Line</button>
      </div>
    </section>
  `;
}

function renderCollections(state) {
  return `
    <section class="ff-panel">
      <div class="ff-grid ff-grid--3">
        ${field("Default Debtor Days (Days)", "collectionsPolicy.defaultDebtorDays", state.collectionsPolicy.defaultDebtorDays, "number", `step="1"`)}
        ${field("Bad Debt (%)", "collectionsPolicy.badDebtPct", state.collectionsPolicy.badDebtPct, "number", `step="0.01"`)}
        ${selectField("Receivables Basis", "collectionsPolicy.receivablesBasis", state.collectionsPolicy.receivablesBasis, ["gross", "net"])}
        ${field("Opening Receivables ($)", "collectionsPolicy.openingReceivables", state.collectionsPolicy.openingReceivables, "number", `step="1"`)}
        ${field("Collection Split Month M", "collectionsPolicy.collectionSplitByMonthBucket.0", state.collectionsPolicy.collectionSplitByMonthBucket[0] ?? 0, "number", `step="0.01"`)}
        ${field("Collection Split Month M+1", "collectionsPolicy.collectionSplitByMonthBucket.1", state.collectionsPolicy.collectionSplitByMonthBucket[1] ?? 0, "number", `step="0.01"`)}
        ${field("Collection Split Month M+2", "collectionsPolicy.collectionSplitByMonthBucket.2", state.collectionsPolicy.collectionSplitByMonthBucket[2] ?? 0, "number", `step="0.01"`)}
      </div>
    </section>
  `;
}

function renderYearPlan(state, yearKey, title) {
  const year = state.years[yearKey];
  const marketingLine = year.marketing.lineItems[0] || { monthlyAmount: 0, startMonth: 1, endMonth: 12 };
  return `
    <section class="ff-panel">
      <div class="ff-grid ff-grid--3">
        ${field("Growth (%)", `years.${yearKey}.assumptions.growthPct`, year.assumptions.growthPct, "number", `step="0.01"`)}
        ${field("CPI (%)", `years.${yearKey}.assumptions.cpiPct`, year.assumptions.cpiPct, "number", `step="0.01"`)}
        ${field("Tax Rate (%)", `years.${yearKey}.assumptions.taxRatePct`, year.assumptions.taxRatePct, "number", `step="0.01" data-tax-rate="1"`)}
        ${field("GST Rate (%)", `years.${yearKey}.assumptions.gstRatePct`, year.assumptions.gstRatePct, "number", `step="0.01"`)}
        ${field("Fixed Monthly Costs ($)", `years.${yearKey}.costProfile.fixedMonthlyCost`, year.costProfile.fixedMonthlyCost, "number", `step="1"`)}
        ${field("Variable Cost (%) Of Revenue", `years.${yearKey}.costProfile.variableCostPctOfRevenue`, year.costProfile.variableCostPctOfRevenue, "number", `step="0.01"`)}
        ${field("Direct Labor (%) Of Revenue", `years.${yearKey}.costProfile.directLaborPctOfRevenue`, year.costProfile.directLaborPctOfRevenue, "number", `step="0.01"`)}
        ${field("Other Operating Monthly ($)", `years.${yearKey}.costProfile.otherOperatingExpenseMonthly`, year.costProfile.otherOperatingExpenseMonthly, "number", `step="1"`)}
        ${selectField("Owner Model", `years.${yearKey}.ownerAdjustments.modelType`, year.ownerAdjustments.modelType, ["sole_trader_drawings", "company_salary_and_distributions", "hybrid"])}
        ${field("Owner Drawings Monthly ($)", `years.${yearKey}.ownerAdjustments.ownerDrawingsMonthly`, year.ownerAdjustments.ownerDrawingsMonthly, "number", `step="1"`)}
        ${field("Director Salary Monthly ($)", `years.${yearKey}.ownerAdjustments.directorSalaryMonthly`, year.ownerAdjustments.directorSalaryMonthly, "number", `step="1"`)}
        ${field("Distributions Monthly ($)", `years.${yearKey}.ownerAdjustments.distributionsMonthly`, year.ownerAdjustments.distributionsMonthly, "number", `step="1"`)}
        ${field("Marketing Monthly Amount ($)", `years.${yearKey}.marketing.lineItems.0.monthlyAmount`, marketingLine.monthlyAmount, "number", `step="1"`)}
        ${field("Marketing Start Month (1-12)", `years.${yearKey}.marketing.lineItems.0.startMonth`, marketingLine.startMonth, "number", `step="1"`)}
        ${field("Marketing End Month (1-12)", `years.${yearKey}.marketing.lineItems.0.endMonth`, marketingLine.endMonth, "number", `step="1"`)}
      </div>
    </section>
  `;
}

function renderAssetsLoans(state) {
  const assets = state.assets.items
    .map((asset, index) => `
      <article class="ff-subpanel">
        <div class="ff-subsection-head">
          <h3>Asset ${index + 1}</h3>
          <button class="btn btn--outline" data-action="remove-asset" data-index="${index}">Remove</button>
        </div>
        <div class="ff-grid ff-grid--3">
          ${field("Name", `assets.items.${index}.name`, asset.name)}
          ${field("Purchase Amount ($)", `assets.items.${index}.purchaseAmount`, asset.purchaseAmount, "number", `step="1"`)}
          ${field("Purchase Month Index (1-36)", `assets.items.${index}.purchaseMonthIndex`, asset.purchaseMonthIndex, "number", `step="1"`)}
          ${field("Useful Life (Years)", `assets.items.${index}.usefulLifeYears`, asset.usefulLifeYears, "number", `step="1"`)}
          ${field("Residual Value ($)", `assets.items.${index}.residualValue`, asset.residualValue, "number", `step="1"`)}
        </div>
      </article>
    `)
    .join("");

  const loans = state.loans.items
    .map((loan, index) => `
      <article class="ff-subpanel">
        <div class="ff-subsection-head">
          <h3>Loan ${index + 1}</h3>
          <button class="btn btn--outline" data-action="remove-loan" data-index="${index}">Remove</button>
        </div>
        <div class="ff-grid ff-grid--3">
          ${field("Name", `loans.items.${index}.name`, loan.name)}
          ${field("Principal ($)", `loans.items.${index}.principal`, loan.principal, "number", `step="1"`)}
          ${field("Interest (%)", `loans.items.${index}.annualInterestRate`, loan.annualInterestRate, "number", `step="0.01"`)}
          ${field("Term Years", `loans.items.${index}.termYears`, loan.termYears, "number", `step="1"`)}
          ${field("Drawdown Month (1-36)", `loans.items.${index}.drawdownMonthIndex`, loan.drawdownMonthIndex, "number", `step="1"`)}
          ${field("Repayment Start Month (1-36)", `loans.items.${index}.repaymentStartMonthIndex`, loan.repaymentStartMonthIndex, "number", `step="1"`)}
        </div>
      </article>
    `)
    .join("");

  return `
    <section class="ff-panel">
      ${assets || `<p class="ff-helper">No assets added yet.</p>`}
      ${loans || `<p class="ff-helper">No loans added yet.</p>`}
      <div class="ff-bottom-actions">
        <button class="btn btn--outline" data-action="add-asset">Add Asset</button>
        <button class="btn btn--outline" data-action="add-loan">Add Loan</button>
      </div>
    </section>
  `;
}

function renderPersonal(state) {
  const entries = state.personalCashFlow.items
    .map((item, index) => `
      <article class="ff-subpanel">
        <div class="ff-subsection-head">
          <h3>Personal Input ${index + 1}</h3>
          <button class="btn btn--outline" data-action="remove-personal-item" data-index="${index}">Remove</button>
        </div>
        <div class="ff-grid ff-grid--3">
          ${field("Name", `personalCashFlow.items.${index}.name`, item.name)}
          ${field("Amount", `personalCashFlow.items.${index}.amount`, item.amount, "number", `step="1"`)}
          ${selectField("Frequency", `personalCashFlow.items.${index}.frequency`, item.frequency, ["weekly", "fortnightly", "monthly", "quarterly", "annual"])}
          ${field("Personal Use %", `personalCashFlow.items.${index}.personalUsePercent`, item.personalUsePercent, "number", `step="0.1"`)}
        </div>
      </article>
    `)
    .join("");

  return `
    <section class="ff-panel">
      <div class="ff-subsection-head"></div>
      ${field("Year 1 Only", "personalCashFlow.year1Only", state.personalCashFlow.year1Only, "checkbox")}
      ${entries || `<p class="ff-helper">No personal inputs added yet.</p>`}
      <div class="ff-bottom-actions">
        <button class="btn btn--outline" data-action="add-personal-item">Add Personal Input</button>
      </div>
    </section>
  `;
}

export function renderFormStep(stepId, state) {
  if (stepId === "intro") return renderIntro(state);
  if (stepId === "setup") return renderSetup(state);
  if (stepId === "sales-details") return renderSalesDetails(state);
  if (stepId === "collections") return renderCollections(state);
  if (stepId === "year-1") return renderYearPlan(state, "year1", "Year 1 Plan");
  if (stepId === "year-2") return renderYearPlan(state, "year2", "Year 2 Plan");
  if (stepId === "year-3") return renderYearPlan(state, "year3", "Year 3 Plan");
  if (stepId === "assets-loans") return renderAssetsLoans(state);
  if (stepId === "personal") return renderPersonal(state);
  return "";
}
