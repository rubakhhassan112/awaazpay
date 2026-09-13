const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function threeDigitsToWords(n) {
  let s = ''
  if (n >= 100) {
    s += `${ONES[Math.floor(n / 100)]} hundred `
    n %= 100
  }
  if (n >= 20) {
    s += `${TENS[Math.floor(n / 10)]} `
    n %= 10
  }
  if (n > 0) {
    s += `${ONES[n]} `
  }
  return s.trim()
}

/** Converts an integer amount (PKR, no decimals in speech) into spoken English words. */
export function numberToWords(value) {
  let n = Math.round(Number(value))
  if (n === 0) return 'zero'
  const parts = []
  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000

  if (crore) parts.push(`${threeDigitsToWords(crore)} crore`)
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} lakh`)
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} thousand`)
  if (n) parts.push(threeDigitsToWords(n))

  return parts.join(' ').trim()
}

/** "two thousand five hundred Pakistani Rupees" style phrase used throughout the PRD scripts. */
export function amountToSpeech(value) {
  return `${numberToWords(value)} Pakistani Rupees`
}

/** PKR 2,500 style display string. */
export function formatCurrency(value) {
  const n = Number(value)
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
