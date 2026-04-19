import { round2 } from "./timeline.js";

function getMonthlyPayment(principal, monthlyRate, termMonths) {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (monthlyRate === 0) return principal / termMonths;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
}

export function calculateLoans(normalizedState) {
  const { timeline, loans } = normalizedState;
  const monthCount = timeline.monthCount;

  const drawdownMonthly = Array(monthCount).fill(0);
  const paymentMonthly = Array(monthCount).fill(0);
  const interestMonthly = Array(monthCount).fill(0);
  const principalMonthly = Array(monthCount).fill(0);
  const closingLoanBalanceMonthly = Array(monthCount).fill(0);

  const loanStates = (loans.items || []).map((loan) => ({
    loan,
    balance: 0,
    monthlyRate: Number(loan.annualInterestRate || 0) / 100 / 12,
    termMonths: Math.max(1, Math.round(Number(loan.termYears || 1) * 12)),
    payment: 0
  }));

  timeline.months.forEach((period, index) => {
    let draw = 0;
    let pay = 0;
    let int = 0;
    let prin = 0;
    let totalClosing = 0;

    loanStates.forEach((state) => {
      const loan = state.loan;
      if (Number(loan.drawdownMonthIndex || 1) === period.globalMonthIndex) {
        state.balance += Number(loan.principal || 0);
        draw += Number(loan.principal || 0);
        state.payment = getMonthlyPayment(state.balance, state.monthlyRate, state.termMonths);
      }

      if (period.globalMonthIndex >= Number(loan.repaymentStartMonthIndex || 1) && state.balance > 0) {
        const interest = state.balance * state.monthlyRate;
        let principal = state.payment - interest;
        if (principal > state.balance) {
          principal = state.balance;
        }
        const payment = principal + interest;
        state.balance = Math.max(0, state.balance - principal);

        int += interest;
        prin += principal;
        pay += payment;
      }

      totalClosing += state.balance;
    });

    drawdownMonthly[index] = draw;
    paymentMonthly[index] = pay;
    interestMonthly[index] = int;
    principalMonthly[index] = prin;
    closingLoanBalanceMonthly[index] = totalClosing;
  });

  return {
    drawdownMonthly: drawdownMonthly.map(round2),
    paymentMonthly: paymentMonthly.map(round2),
    interestMonthly: interestMonthly.map(round2),
    principalMonthly: principalMonthly.map(round2),
    closingLoanBalanceMonthly: closingLoanBalanceMonthly.map(round2)
  };
}
