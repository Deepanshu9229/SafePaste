// Checksum algorithms used to tell real-looking IDs apart from random numbers.

// ---------- Verhoeff (Aadhaar) ----------
// Tables from https://en.wikipedia.org/wiki/Verhoeff_algorithm

/** Multiplication table of the dihedral group D5. */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/** Permutation table, applied by digit position (from the right). */
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Inverse table. */
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** True if the digit string (check digit last) passes the Verhoeff check. */
export function isValidVerhoeff(digits: string): boolean {
  let check = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i]);
    check = VERHOEFF_D[check][VERHOEFF_P[i % 8][digit]];
  }
  return check === 0;
}

/** Check digit to append to `digits` so the result passes isValidVerhoeff. */
export function verhoeffCheckDigit(digits: string): number {
  let check = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i]);
    check = VERHOEFF_D[check][VERHOEFF_P[(i + 1) % 8][digit]];
  }
  return VERHOEFF_INV[check];
}

// ---------- Luhn (payment cards) ----------

/** True if the digit string (check digit last) passes the Luhn check. */
export function isValidLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    // Double every second digit from the right; subtract 9 if it becomes two digits.
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// ---------- GSTIN (mod 36) ----------

const GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Check character for the first 14 characters of a GSTIN. */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < first14.length; i++) {
    const value = GSTIN_CHARSET.indexOf(first14[i]);
    // Factors alternate 1, 2, 1, 2 … from the left.
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARSET[(36 - (sum % 36)) % 36];
}

/** True if the 15th character of a GSTIN matches its check character. */
export function isValidGstinChecksum(gstin: string): boolean {
  return gstin.length === 15 && gstinCheckChar(gstin.slice(0, 14)) === gstin[14];
}
