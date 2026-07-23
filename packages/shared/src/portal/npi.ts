// NPI validation (spec §4): Luhn check digit computed over the "80840"
// health-industry prefix + the first 9 digits; the 10th digit must match.

export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = ("80840" + npi.slice(0, 9)).split("").map(Number);
  let sum = 0;
  // Double every second digit from the right (rightmost of the 14 is doubled).
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i]!;
    if ((digits.length - 1 - i) % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(npi[9]);
}
