/**
 * Maps a raw speech transcript to one of AwaazPay's core voice commands
 * (PRD §7 — Core Voice Commands). Matching is intentionally forgiving:
 * a blind user speaking to a phone will rarely produce an exact phrase,
 * so we match on the presence of key words rather than exact strings.
 */
export const INTENTS = {
  PAY_NFC: 'PAY_NFC',
  RECEIVE: 'RECEIVE',
  BALANCE: 'BALANCE',
  LAST_TRANSACTION: 'LAST_TRANSACTION',
  RECENT_TRANSACTIONS: 'RECENT_TRANSACTIONS',
  GO_HOME: 'GO_HOME',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
  REPEAT: 'REPEAT',
  UNKNOWN: 'UNKNOWN',
}

function includesAny(text, words) {
  return words.some((w) => text.includes(w))
}

export function parseIntent(rawText) {
  const text = rawText.trim().toLowerCase()
  if (!text) return INTENTS.UNKNOWN

  if (includesAny(text, ['confirm payment', 'confirm the payment']) || text === 'confirm') {
    return INTENTS.CONFIRM
  }
  if (includesAny(text, ['cancel'])) return INTENTS.CANCEL
  if (includesAny(text, ['repeat', 'say again', "didn't hear", 'what did you say'])) {
    return INTENTS.REPEAT
  }
  if (includesAny(text, ['go home', 'home screen', 'main menu'])) return INTENTS.GO_HOME
  if (includesAny(text, ['receive money', 'receive payment']) || text === 'receive') {
    return INTENTS.RECEIVE
  }
  if (includesAny(text, ['nfc'])) return INTENTS.PAY_NFC
  if (includesAny(text, ['pay using', 'make a payment', 'pay someone']) || text === 'pay') {
    return INTENTS.PAY_NFC
  }
  if (includesAny(text, ['recent transaction', 'transaction history', 'my transactions'])) {
    return INTENTS.RECENT_TRANSACTIONS
  }
  if (includesAny(text, ['last transaction'])) return INTENTS.LAST_TRANSACTION
  if (includesAny(text, ['balance', 'how much money', 'how much do i have'])) {
    return INTENTS.BALANCE
  }

  return INTENTS.UNKNOWN
}
