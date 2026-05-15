const GST_RATE = 0.09;
const WHATSAPP_NUMBER = "+6583963088";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwfJ-p_WtksPVa5CyTKxOYiephFtS5GNIj5x9A2kxGAxZubncKW8_WaQi6IrHyJm2AW/exec";

const state = {
  mode: "seller",
};

const money = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  maximumFractionDigits: 0,
});

const $ = (id) => document.getElementById(id);

function cleanNumber(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function num(id) {
  const input = $(id);
  return cleanNumber(input ? input.value : 0);
}

function formatMoneyInput(input) {
  input.value = money.format(Math.max(cleanNumber(input.value), 0));
}

function clampDeposit(id) {
  const input = $(id);
  const value = cleanNumber(input.value);
  if (value > 5000) input.value = money.format(5000);
  if (value < 0) input.value = money.format(0);
}

function buyerStampDuty(amount) {
  const tiers = [
    [180000, 0.01],
    [180000, 0.02],
    [640000, 0.03],
    [500000, 0.04],
    [1500000, 0.05],
    [Infinity, 0.06],
  ];

  let remaining = amount;
  let duty = 0;

  for (const [cap, rate] of tiers) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, cap);
    duty += taxable * rate;
    remaining -= taxable;
  }

  return Math.floor(Math.max(duty, amount > 0 ? 1 : 0));
}

function commissionWithGst(base, rate, enabled) {
  if (!enabled) return 0;
  const commission = base * (rate / 100);
  return commission + commission * GST_RATE;
}

function setBreakdown(rows) {
  $("breakdown").innerHTML = rows
    .map(
      (row) => `
        <div class="breakdown-row ${row.className || ""}">
          <span>${row.label}</span>
          <strong>${money.format(row.value)}</strong>
        </div>
      `
    )
    .join("");
}

function setGroupedBreakdown(groups) {
  $("breakdown").innerHTML = groups
    .map((group) => {
      const heading = group.title ? `<div class="breakdown-heading">${group.title}</div>` : "";
      const rows = group.rows
        .map(
          (row) => `
            <div class="breakdown-row ${row.className || ""}">
              <span>${row.label}</span>
              <strong>${money.format(row.value)}</strong>
            </div>
          `
        )
        .join("");
      return `<section class="breakdown-group">${heading}${rows}</section>`;
    })
    .join("");
}

function getSellerData() {
  const sellingPrice = num("sellingPrice");
  const outstandingLoan = num("sellerLoan");
  const cpfRefund = num("cpfRefund");
  const outstandingHip = num("outstandingHip");
  const bankPenalty = num("bankPenalty");
  const resaleLevy = num("resaleLevy");
  const legal = num("sellerLegal");
  const misc = num("sellerMisc");
  const commission = commissionWithGst(
    sellingPrice,
    num("sellerCommissionRate"),
    $("sellerCommissionOn").checked
  );

  const proceeds =
    sellingPrice -
    outstandingLoan -
    cpfRefund -
    outstandingHip -
    bankPenalty -
    resaleLevy -
    legal -
    misc -
    commission;

  return {
    proceeds,
    rows: [
      { label: "Selling price", value: sellingPrice, className: "highlight" },
      { label: "Outstanding loan", value: -outstandingLoan },
      { label: "CPF refund", value: -cpfRefund },
      { label: "Outstanding HIP", value: -outstandingHip },
      { label: "Bank penalty", value: -bankPenalty },
      { label: "Resale levy", value: -resaleLevy },
      { label: "Legal fee", value: -legal },
      { label: "Miscellaneous fee", value: -misc },
      { label: "Agent commission + GST", value: -commission },
    ],
  };
}

function getBuyerData() {
  const purchasePrice = num("purchasePrice");
  const valuation = num("valuation");
  const keyedLoan = $("loanType").value === "No loan" ? 0 : num("approvedLoan");
  const maxLoan = purchasePrice * 0.75;
  const loan = Math.min(keyedLoan, maxLoan);
  const loanShortfall = $("loanType").value === "No loan" ? 0 : Math.max(maxLoan - loan, 0);
  const cpf = num("cpfAvailable");
  const grant = num("cpfGrant");
  const stampDutyBase = Math.max(purchasePrice, valuation);
  const bsd = buyerStampDuty(stampDutyBase);
  const absd = purchasePrice * (Number($("prAbsd").value) / 100);
  const legal = num("buyerLegal");
  const misc = num("buyerMisc");
  const cov = Math.max(purchasePrice - valuation, 0);
  const commission = commissionWithGst(
    purchasePrice,
    num("buyerCommissionRate"),
    $("buyerCommissionOn").checked
  );

  const required =
    purchasePrice +
    bsd +
    absd +
    legal +
    misc +
    commission -
    loan -
    grant;

  return {
    required,
    rows: [
      { label: "Purchase price", value: purchasePrice, className: "highlight" },
      { label: "Cash-over-valuation", value: cov, className: cov > 0 ? "warning" : "" },
      { label: "BSD basis", value: stampDutyBase },
      { label: "Buyer Stamp Duty", value: bsd },
      { label: "SPR ABSD", value: absd },
      { label: "Legal fee", value: legal },
      { label: "Miscellaneous fee", value: misc },
      { label: "Agent commission + GST", value: commission },
      { label: "Max loan at 75%", value: maxLoan },
      { label: "Approved loan", value: -loan },
      { label: "Loan shortfall to be funded", value: loanShortfall, className: loanShortfall > 0 ? "warning" : "" },
      { label: "Total grant", value: -grant },
      { label: "Total OA available", value: cpf },
    ],
  };
}

function renderSeller() {
  const seller = getSellerData();
  $("resultKicker").textContent = "Estimated seller cash proceeds";
  $("resultTotal").textContent = money.format(seller.proceeds);
  $("quickTotal").textContent = money.format(seller.proceeds);
  $("quickLabel").textContent = "Estimated sale proceeds";
  setBreakdown(seller.rows);
}

function renderBuyer() {
  const buyer = getBuyerData();
  $("resultKicker").textContent = "Estimated buyer cash / CPF required";
  $("resultTotal").textContent = money.format(buyer.required);
  $("quickTotal").textContent = money.format(buyer.required);
  $("quickLabel").textContent = "Estimated amount required";
  setBreakdown(buyer.rows);
}

function renderBoth() {
  const seller = getSellerData();
  const buyer = getBuyerData();
  const net = seller.proceeds - buyer.required;

  $("resultKicker").textContent = "Estimated net position";
  $("resultTotal").textContent = money.format(net);
  $("quickTotal").textContent = money.format(net);
  $("quickLabel").textContent = "Sale proceeds minus purchase requirement";

  setGroupedBreakdown([
    {
      title: "Overall",
      rows: [
        { label: "Estimated sale proceeds", value: seller.proceeds, className: "highlight" },
        { label: "Estimated purchase requirement", value: buyer.required, className: "highlight" },
      ],
    },
    {
      title: "Selling",
      rows: [
        ...seller.rows,
        { label: "Estimated sale proceeds", value: seller.proceeds, className: "highlight" },
      ],
    },
    {
      title: "Buying",
      rows: [
        ...buyer.rows,
        { label: "Estimated purchase requirement", value: buyer.required, className: "highlight" },
      ],
    },
  ]);
}

function getModeLabel() {
  if (state.mode === "seller") return "Selling";
  if (state.mode === "buyer") return "Buying";
  return "Buying & selling";
}

function getCurrentEstimate() {
  if (state.mode === "seller") {
    const seller = getSellerData();
    return {
      mode: getModeLabel(),
      resultLabel: "Estimated seller cash proceeds",
      resultTotal: money.format(seller.proceeds),
      rows: seller.rows,
    };
  }

  if (state.mode === "buyer") {
    const buyer = getBuyerData();
    return {
      mode: getModeLabel(),
      resultLabel: "Estimated buyer cash / CPF required",
      resultTotal: money.format(buyer.required),
      rows: buyer.rows,
    };
  }

  const seller = getSellerData();
  const buyer = getBuyerData();
  const net = seller.proceeds - buyer.required;
  return {
    mode: getModeLabel(),
    resultLabel: "Estimated net position",
    resultTotal: money.format(net),
    rows: [
      ...seller.rows,
      { label: "Estimated sale proceeds", value: seller.proceeds },
      ...buyer.rows,
      { label: "Estimated purchase requirement", value: buyer.required },
      { label: "Estimated net balance", value: net },
    ],
  };
}

function estimateSummary() {
  const estimate = getCurrentEstimate();

  if (state.mode === "both") {
    const seller = getSellerData();
    const buyer = getBuyerData();
    const net = seller.proceeds - buyer.required;
    const sellerLines = [
      ...seller.rows,
      { label: "Estimated sale proceeds", value: seller.proceeds },
    ];
    const buyerLines = buyer.rows;

    return [
      `Mode: ${estimate.mode}`,
      `${estimate.resultLabel}: ${estimate.resultTotal}`,
      `Estimated purchase requirement: ${money.format(buyer.required)}`,
      `Estimated net balance: ${money.format(net)}`,
      "",
      ...sellerLines.map((row) => `${row.label}: ${money.format(row.value)}`),
      "",
      "",
      ...buyerLines.map((row) => `${row.label}: ${money.format(row.value)}`),
    ].join("\n");
  }

  const lines = [
    `Mode: ${estimate.mode}`,
    `${estimate.resultLabel}: ${estimate.resultTotal}`,
    "",
    ...estimate.rows.map((row) => `${row.label}: ${money.format(row.value)}`),
  ];
  return lines.join("\n");
}

function inputValue(label, id) {
  return { label, value: $(id).value || money.format(0) };
}

function fullInputDetails() {
  const sellerInputs = [
    inputValue("Selling price", "sellingPrice"),
    inputValue("Outstanding loan", "sellerLoan"),
    inputValue("CPF refund with accrued interest", "cpfRefund"),
    inputValue("Outstanding HIP, if any", "outstandingHip"),
    inputValue("Bank penalty, if any", "bankPenalty"),
    inputValue("Resale levy, if applicable", "resaleLevy"),
    inputValue("Seller legal fee", "sellerLegal"),
    inputValue("Seller miscellaneous fee", "sellerMisc"),
    { label: "Seller agent commission + GST", value: $("sellerCommissionOn").checked ? `${$("sellerCommissionRate").value}%` : "Not included" },
  ];

  const buyerInputs = [
    inputValue("Purchase price", "purchasePrice"),
    inputValue("HDB valuation", "valuation"),
    { label: "Loan type", value: $("loanType").value },
    inputValue("Approved loan amount", "approvedLoan"),
    inputValue("Total OA available", "cpfAvailable"),
    inputValue("Total grant", "cpfGrant"),
    { label: "SPR ABSD", value: $("prAbsd").selectedOptions[0].textContent },
    inputValue("Buyer legal fee", "buyerLegal"),
    inputValue("Buyer miscellaneous fee", "buyerMisc"),
    { label: "Buyer agent commission + GST", value: $("buyerCommissionOn").checked ? `${$("buyerCommissionRate").value}%` : "Not included" },
  ];

  if (state.mode === "seller") return sellerInputs;
  if (state.mode === "buyer") return buyerInputs;
  return [...sellerInputs, ...buyerInputs];
}

function fullInputSummary() {
  return fullInputDetails()
    .map((item) => `${item.label}: ${item.value}`)
    .join("\n");
}

function leadPayload() {
  const estimate = getCurrentEstimate();
  return {
    name: $("leadName").value.trim(),
    phone: $("leadPhone").value.trim(),
    contactTime: $("leadContactTime").value,
    notes: $("leadNotes").value.trim(),
    mode: estimate.mode,
    resultLabel: estimate.resultLabel,
    resultTotal: estimate.resultTotal,
    inputs: fullInputDetails(),
    inputSummary: fullInputSummary(),
    summary: estimateSummary(),
  };
}

function updateLeadPreview() {
  const preview = $("leadEstimatePreview");
  if (preview) preview.textContent = estimateSummary();
}

async function submitLead(payload) {
  if (!GOOGLE_SCRIPT_URL) return { skipped: true };

  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  return { ok: true, response };
}

function openWhatsapp(payload) {
  const message = [
    "Hi, I used your HDB calculator and would like to sense-check my figures.",
    "",
    `Name: ${payload.name}`,
    `WhatsApp: ${payload.phone}`,
    `Preferred contact time: ${payload.contactTime}`,
    "",
    "Figures keyed in:",
    payload.inputSummary,
    "",
    "Calculated estimate:",
    payload.summary,
    "",
    `Notes: ${payload.notes || "-"}`,
  ].join("\n");

  const phone = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

function printEstimate() {
  const payload = leadPayload();
  $("printReport").innerHTML = `
    <h1>HDB Calculator Estimate</h1>
    <p>Generated from the HDB calculator.</p>
    <p><strong>Name:</strong> ${payload.name || "-"}<br>
    <strong>WhatsApp:</strong> ${payload.phone || "-"}<br>
    <strong>Preferred contact time:</strong> ${payload.contactTime || "-"}</p>
    <h2>Figures Keyed In</h2>
    <pre>${payload.inputSummary}</pre>
    <h2>Calculated Estimate</h2>
    <pre>${payload.summary}</pre>
    <p><strong>Notes:</strong> ${payload.notes || "-"}</p>
    <p>This estimate is based on user-entered figures. Final amounts may differ depending on HDB, CPF Board, IRAS, bank, law firm, and prevailing rules at the point of transaction.</p>
  `;
  document.body.classList.add("printing");
  window.print();
  setTimeout(() => {
    document.body.classList.remove("printing");
  }, 500);
}

function updateCommissionVisibility() {
  $("sellerCommissionFields").classList.toggle("muted", !$("sellerCommissionOn").checked);
  $("buyerCommissionFields").classList.toggle("muted", !$("buyerCommissionOn").checked);
}

function updatePanels() {
  $("sellerPanel").classList.toggle("active", state.mode === "seller" || state.mode === "both");
  $("buyerPanel").classList.toggle("active", state.mode === "buyer" || state.mode === "both");
  $("calculator").classList.toggle("combined", state.mode === "both");
}

function calculate() {
  updateCommissionVisibility();
  if (state.mode === "seller") renderSeller();
  else if (state.mode === "buyer") renderBuyer();
  else renderBoth();
}

document.querySelectorAll(".mode-btn").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll(".mode-btn").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    updatePanels();
    calculate();
  });
});

document.querySelectorAll("input, select").forEach((input) => {
  input.addEventListener("input", calculate);
  input.addEventListener("change", calculate);
});

document.querySelectorAll(".money-input").forEach((input) => {
  input.addEventListener("focus", () => {
    input.value = cleanNumber(input.value) || "";
  });
  input.addEventListener("blur", () => {
    formatMoneyInput(input);
    calculate();
  });
  formatMoneyInput(input);
});

$("openLeadForm").addEventListener("click", () => {
  updateLeadPreview();
  $("leadModal").hidden = false;
  $("leadName").focus();
});

$("closeLeadForm").addEventListener("click", () => {
  $("leadModal").hidden = true;
});

$("leadModal").addEventListener("click", (event) => {
  if (event.target === $("leadModal")) $("leadModal").hidden = true;
});

$("printEstimate").addEventListener("click", printEstimate);

$("leadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = leadPayload();
  $("leadStatus").textContent = "Preparing your estimate and opening WhatsApp...";

  try {
    const result = await submitLead(payload);
    $("leadStatus").textContent = result.skipped
      ? "WhatsApp is opening now. Google Sheets logging will start after the Apps Script URL is added."
      : "Logged successfully. WhatsApp is opening now.";
  } catch (error) {
    $("leadStatus").textContent = "WhatsApp is opening now. Google Sheets logging could not be completed.";
  }

  openWhatsapp(payload);
});

updatePanels();
calculate();
