const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
]
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
]

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return TENS[tens] + (ones ? " " + ONES[ones] : "")
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  return (hundreds ? ONES[hundreds] + " Hundred" + (rest ? " " : "") : "") + (rest ? twoDigits(rest) : "")
}

/** Converts a non-negative rupee amount to words using the Indian numbering system (lakh/crore). */
export function amountInWords(amount: number): string {
  const rupees = Math.round(Math.abs(amount))
  if (rupees === 0) return "Rupees Zero Only"

  const crore = Math.floor(rupees / 1_00_00_000)
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((rupees % 1_00_000) / 1_000)
  const hundred = rupees % 1_000

  const parts: string[] = []
  if (crore) parts.push(threeDigits(crore) + " Crore")
  if (lakh) parts.push(threeDigits(lakh) + " Lakh")
  if (thousand) parts.push(threeDigits(thousand) + " Thousand")
  if (hundred) parts.push(threeDigits(hundred))

  return "Rupees " + parts.join(" ") + " Only"
}
