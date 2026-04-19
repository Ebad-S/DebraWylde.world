export function buildTimeline(forecastHorizonYears = 3) {
  const months = [];
  const monthCount = forecastHorizonYears * 12;

  for (let i = 0; i < monthCount; i += 1) {
    const yearIndex = Math.floor(i / 12) + 1;
    const monthIndex = (i % 12) + 1;
    const quarterIndex = Math.floor((monthIndex - 1) / 3) + 1;
    const yearKey = `year${yearIndex}`;
    months.push({
      globalMonthIndex: i + 1,
      periodKey: `Y${yearIndex}-M${monthIndex}`,
      yearIndex,
      yearKey,
      monthIndex,
      quarterIndex,
      quarterKey: `Y${yearIndex}-Q${quarterIndex}`
    });
  }

  return {
    forecastHorizonYears,
    monthCount,
    months
  };
}

export function sumByYear(values, timeline) {
  const output = { year1: 0, year2: 0, year3: 0 };
  timeline.months.forEach((period, index) => {
    output[period.yearKey] += Number(values[index] || 0);
  });
  return output;
}

export function sumByQuarter(values, timeline) {
  const output = {};
  timeline.months.forEach((period, index) => {
    output[period.quarterKey] = Number(output[period.quarterKey] || 0) + Number(values[index] || 0);
  });
  return output;
}

export function getMonthOffsetIndex(globalMonthIndex, monthOffset, monthCount) {
  const target = globalMonthIndex + monthOffset;
  if (target < 1 || target > monthCount) return null;
  return target - 1;
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
