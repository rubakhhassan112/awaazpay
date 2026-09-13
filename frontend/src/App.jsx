import { useEffect, useRef, useState } from 'react'
import { useVoice } from './voice/useVoice'
import { parseIntent, INTENTS } from './voice/commands'
import { api } from './lib/api'
import { amountToSpeech, formatCurrency } from './lib/format'
import { ListenOrb } from './components/ListenOrb'
import { CaptionBar } from './components/CaptionBar'
import { BigButton } from './components/BigButton'
import { BalanceDisplay } from './components/BalanceDisplay'
import { TransactionHistory } from './components/TransactionHistory'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function App() {
  const [launched, setLaunched] = useState(false)
  const [step, setStep] = useState('loading') // loading | setup | home | nfc_searching | merchant_detected | security_challenge | confirm | processing_payment | receipt | receive_processing
  const [wallet, setWallet] = useState(null)
  const [merchants, setMerchants] = useState([])
  const [demoMerchantId, setDemoMerchantId] = useState('')
  const [currentMerchant, setCurrentMerchant] = useState(null)
  const [challengeNumber, setChallengeNumber] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const [lastTransaction, setLastTransaction] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [heardText, setHeardText] = useState('')
  const [showDemoPanel, setShowDemoPanel] = useState(false)
  const [setupInput, setSetupInput] = useState('')

  const stepRef = useRef(step)
  const merchantRef = useRef(currentMerchant)
  const challengeRef = useRef(challengeNumber)
  const attemptsRef = useRef(attempts)
  useEffect(() => { stepRef.current = step }, [step])
  useEffect(() => { merchantRef.current = currentMerchant }, [currentMerchant])
  useEffect(() => { challengeRef.current = challengeNumber }, [challengeNumber])
  useEffect(() => { attemptsRef.current = attempts }, [attempts])

  const { supported, micPermission, status, interimText, lastSpoken, startListening, speak } = useVoice({
    onFinalResult: (text) => handleTranscript(text),
  })

  // ---- Initial load ---------------------------------------------------
  useEffect(() => {
    api.getWallet().then((w) => {
      setWallet(w)
      setStep(w.is_setup ? 'home' : 'setup')
    })
    api.getMerchants().then(setMerchants).catch(() => {})
  }, [])

  async function begin() {
    setLaunched(true)
    await startListening()
    if (stepRef.current === 'setup') {
      await speak(
        'Welcome to AwaazPay. Before we begin, please choose a secret security word. Say "my secret word is" followed by your word.',
      )
    } else if (stepRef.current === 'home') {
      await speak('Welcome to AwaazPay. How can I help you?')
    }
  }

  // ---- Setup flow -------------------------------------------------------
  async function completeSetup(rawPhrase) {
    const phrase = rawPhrase
      .toLowerCase()
      .replace(/my secret word is|my secret phrase is|my passphrase is|secret word|passphrase/g, '')
      .trim()
    if (!phrase) {
      await speak('Sorry, I did not catch a word. Please say your secret word clearly.')
      return
    }
    const w = await api.setupWallet(phrase)
    setWallet(w)
    setStep('home')
    await speak(`Your secret word has been saved. Welcome to AwaazPay. How can I help you?`)
  }

  // ---- Payment flow -------------------------------------------------------
  async function startPaymentFlow() {
    setStep('nfc_searching')
    await speak('NFC payment mode activated. Please hold your phone near the payment terminal.')
    await sleep(1400)
    if (stepRef.current !== 'nfc_searching') return

    let merchant
    try {
      const res = await api.detectNfc(demoMerchantId || undefined)
      merchant = res.merchant
    } catch {
      await speak('I could not detect a payment terminal. Please try again.')
      goHome()
      return
    }
    setCurrentMerchant(merchant)
    navigator.vibrate?.(200)
    await speak('Payment terminal detected.')
    if (stepRef.current !== 'nfc_searching') return

    setStep('merchant_detected')
    await speak(
      `You are about to pay ${amountToSpeech(merchant.amount)} to ${merchant.name}. Say cancel to stop this transaction.`,
    )
    await sleep(1800)
    if (stepRef.current !== 'merchant_detected') return
    await startSecurityChallenge()
  }

  async function startSecurityChallenge() {
    const { challenge_number } = await api.getChallenge()
    setChallengeNumber(challenge_number)
    setAttempts(0)
    setStep('security_challenge')
    await speak(`For security, please say your secret word followed by the number ${challenge_number}.`)
  }

  async function handleSecurityResponse(transcript) {
    const result = await api.verifyAuth(transcript, challengeRef.current)
    if (result.verified) {
      setStep('confirm')
      const merchant = merchantRef.current
      await speak(
        `Identity confirmation successful. You are about to pay ${amountToSpeech(merchant.amount)} to ${merchant.name}. To complete the payment, say Confirm Payment.`,
      )
      return
    }
    const nextAttempts = attemptsRef.current + 1
    setAttempts(nextAttempts)
    if (nextAttempts >= 3) {
      await speak('Authentication failed too many times. Cancelling this transaction for your safety.')
      await cancelTransaction({ silent: true })
      return
    }
    await speak('Authentication failed. Please try again, saying your secret word followed by the number.')
  }

  async function processPayment() {
    setStep('processing_payment')
    const merchant = merchantRef.current
    try {
      const { transaction, wallet: w } = await api.confirmPayment(merchant.name, merchant.amount)
      setWallet(w)
      setLastTransaction(transaction)
      navigator.vibrate?.(200)
      setStep('receipt')
      await speak(
        `Payment successful. You paid ${amountToSpeech(transaction.amount)} to ${transaction.counterparty}. Your remaining balance is ${amountToSpeech(w.balance)}.`,
      )
    } catch (err) {
      await speak(err.message === 'Insufficient balance.'
        ? 'Payment failed. Your balance is insufficient for this transaction.'
        : 'Payment failed. Please try again.')
    }
    await sleep(1500)
    goHome()
  }

  async function cancelTransaction({ silent } = {}) {
    const merchant = merchantRef.current
    try {
      if (merchant) await api.cancelPayment(merchant.name, merchant.amount)
    } catch {
      /* noop */
    }
    if (!silent) await speak('Transaction cancelled.')
    goHome()
  }

  // ---- Receive money flow -------------------------------------------------
  async function startReceiveFlow() {
    setStep('receive_processing')
    await speak('Receive money mode activated.')
    await sleep(1000)
    try {
      const { transaction, wallet: w } = await api.receiveMoney('Ahmed', 5000)
      setWallet(w)
      navigator.vibrate?.(200)
      await speak(`You have received ${amountToSpeech(transaction.amount)} from ${transaction.counterparty}.`)
    } catch {
      await speak('Sorry, I could not complete that right now.')
    }
    goHome()
  }

  // ---- Informational commands ----------------------------------------------
  async function announceBalance() {
    const w = await api.getWallet()
    setWallet(w)
    await speak(`Your current AwaazPay balance is ${amountToSpeech(w.balance)}.`)
  }

  async function announceLastTransaction() {
    const txs = await api.getTransactions(1)
    if (!txs.length) {
      await speak('You do not have any transactions yet.')
      return
    }
    const tx = txs[0]
    const verb = tx.direction === 'sent' ? 'a payment of' : 'a received payment of'
    const prep = tx.direction === 'sent' ? 'to' : 'from'
    await speak(`Your most recent transaction was ${verb} ${amountToSpeech(tx.amount)} ${prep} ${tx.counterparty}.`)
  }

  async function announceRecentTransactions() {
    const txs = await api.getTransactions(3)
    setRecentTransactions(txs)
    if (!txs.length) {
      await speak('You do not have any transactions yet.')
      return
    }
    let phrase = 'Here are your recent transactions. '
    txs.forEach((tx) => {
      const verb = tx.direction === 'sent' ? 'Paid' : 'Received'
      const prep = tx.direction === 'sent' ? 'to' : 'from'
      phrase += `${verb} ${amountToSpeech(tx.amount)} ${prep} ${tx.counterparty}. `
    })
    await speak(phrase)
  }

  function goHome() {
    setCurrentMerchant(null)
    setChallengeNumber(null)
    setAttempts(0)
    setStep('home')
  }

  // ---- Central transcript router -------------------------------------------
  async function handleTranscript(transcript) {
    const text = transcript.trim()
    if (!text) return
    setHeardText(text)

    const currentStep = stepRef.current

    if (currentStep === 'setup') {
      await completeSetup(text)
      return
    }

    const intent = parseIntent(text)

    // Global safety-valve commands, available from any in-progress flow.
    if (['merchant_detected', 'security_challenge', 'confirm'].includes(currentStep) && intent === INTENTS.CANCEL) {
      await cancelTransaction()
      return
    }
    if (intent === INTENTS.REPEAT) {
      if (lastSpoken) await speak(lastSpoken)
      return
    }

    if (currentStep === 'home') {
      switch (intent) {
        case INTENTS.PAY_NFC:
          await startPaymentFlow()
          break
        case INTENTS.RECEIVE:
          await startReceiveFlow()
          break
        case INTENTS.BALANCE:
          await announceBalance()
          break
        case INTENTS.LAST_TRANSACTION:
          await announceLastTransaction()
          break
        case INTENTS.RECENT_TRANSACTIONS:
          await announceRecentTransactions()
          break
        case INTENTS.GO_HOME:
          await speak('You are already at the home screen.')
          break
        default:
          if (text.split(' ').length > 2) {
            await speak(
              'Sorry, I did not understand that. You can say things like "Pay using NFC", "Receive money", or "What is my balance".',
            )
          }
      }
      return
    }

    if (currentStep === 'security_challenge') {
      await handleSecurityResponse(text)
      return
    }

    if (currentStep === 'confirm') {
      if (intent === INTENTS.CONFIRM) {
        await processPayment()
      } else {
        await speak('Say "Confirm Payment" to complete this transaction, or "Cancel" to stop it.')
      }
      return
    }
  }

  // ---- Render ---------------------------------------------------------------
  if (!launched) {
    return <LaunchScreen onBegin={begin} supported={supported} />
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            AwaazPay
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
            Banking Beyond Sight
          </p>
        </div>
        {micPermission === 'denied' && (
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--color-danger)', color: '#2a0000' }}>
            Mic blocked
          </span>
        )}
      </header>

      {step !== 'setup' && <BalanceDisplay balance={wallet?.balance} />}

      <ListenOrb status={status} />

      <CaptionBar spokenText={lastSpoken} heardText={interimText || heardText} />

      {step === 'setup' && (
        <ManualSetupForm value={setupInput} onChange={setSetupInput} onSubmit={() => completeSetup(setupInput)} />
      )}

      {step === 'home' && (
        <div className="flex flex-col gap-3">
          <BigButton onClick={startPaymentFlow}>Pay using NFC</BigButton>
          <BigButton variant="surface" onClick={startReceiveFlow}>Receive Money</BigButton>
          <BigButton variant="surface" onClick={announceBalance}>Check Balance</BigButton>
          <BigButton variant="surface" onClick={announceRecentTransactions}>Recent Transactions</BigButton>
        </div>
      )}

      {step === 'merchant_detected' && (
        <MerchantCard merchant={currentMerchant} onCancel={() => cancelTransaction()} />
      )}

      {step === 'security_challenge' && (
        <SecurityChallengeCard
          challengeNumber={challengeNumber}
          attempts={attempts}
          onCancel={() => cancelTransaction()}
        />
      )}

      {step === 'confirm' && (
        <ConfirmCard
          merchant={currentMerchant}
          onConfirm={processPayment}
          onCancel={() => cancelTransaction()}
        />
      )}

      {step === 'receipt' && lastTransaction && <ReceiptCard transaction={lastTransaction} wallet={wallet} />}

      {step === 'home' && recentTransactions.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
            Recent activity
          </h2>
          <TransactionHistory transactions={recentTransactions} />
        </section>
      )}

      <footer className="mt-auto pt-4 text-center">
        <button
          type="button"
          onClick={() => setShowDemoPanel((v) => !v)}
          className="text-xs underline"
          style={{ color: 'var(--color-text-dim)' }}
        >
          Demo settings
        </button>
        {showDemoPanel && (
          <div className="mt-3 rounded-2xl p-4 text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <label className="mb-1 block text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Terminal to simulate on next "Pay using NFC"
            </label>
            <select
              value={demoMerchantId}
              onChange={(e) => setDemoMerchantId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              <option value="">Default demo terminal</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {formatCurrency(m.amount)}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="mt-3 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
          Hackathon prototype. Simulated NFC, simulated transactions — no real money moves.
        </p>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------

function LaunchScreen({ onBegin, supported }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <p className="font-display text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
          AwaazPay
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-dim)' }}>
          Banking Beyond Sight
        </p>
      </div>
      <p className="max-w-xs text-sm" style={{ color: 'var(--color-text-dim)' }}>
        AwaazPay listens continuously once started, so it needs your permission to use the microphone.
        Tap anywhere on the button below to begin.
      </p>
      <BigButton onClick={onBegin}>Tap to Start AwaazPay</BigButton>
      {!supported && (
        <p className="max-w-xs text-xs" style={{ color: 'var(--color-danger)' }}>
          Your browser does not support voice recognition. AwaazPay will still work with the on-screen
          buttons, but for the full voice experience, please use Google Chrome.
        </p>
      )}
    </div>
  )
}

function ManualSetupForm({ value, onChange, onSubmit }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <label htmlFor="setup-phrase" className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
        Or type your secret word here
      </label>
      <input
        id="setup-phrase"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        className="rounded-xl px-4 py-3 text-lg"
        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        placeholder="e.g. falcon"
      />
      <BigButton onClick={onSubmit}>Save secret word</BigButton>
    </div>
  )
}

function MerchantCard({ merchant, onCancel }) {
  if (!merchant) return null
  return (
    <div className="flex flex-col gap-4 rounded-2xl p-5 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
        Terminal detected
      </p>
      <p className="font-display text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
        {merchant.name}
      </p>
      <p className="font-display tabular text-4xl font-bold" style={{ color: 'var(--color-text)' }}>
        {formatCurrency(merchant.amount)}
      </p>
      <BigButton variant="danger" onClick={onCancel}>Cancel</BigButton>
    </div>
  )
}

function SecurityChallengeCard({ challengeNumber, attempts, onCancel }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl p-5 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
        Security check
      </p>
      <p style={{ color: 'var(--color-text)' }}>
        Say your secret word followed by
      </p>
      <p className="font-display tabular text-5xl font-bold" style={{ color: 'var(--color-accent)' }}>
        {challengeNumber}
      </p>
      {attempts > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
          Attempt {attempts} of 3 failed.
        </p>
      )}
      <BigButton variant="danger" onClick={onCancel}>Cancel</BigButton>
    </div>
  )
}

function ConfirmCard({ merchant, onConfirm, onCancel }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl p-5 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
        Identity confirmed
      </p>
      <p style={{ color: 'var(--color-text)' }}>Pay {formatCurrency(merchant?.amount)} to {merchant?.name}?</p>
      <BigButton variant="success" onClick={onConfirm}>Confirm Payment</BigButton>
      <BigButton variant="danger" onClick={onCancel}>Cancel</BigButton>
    </div>
  )
}

function ReceiptCard({ transaction, wallet }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl p-5 text-center" style={{ background: 'var(--color-surface)', border: `1px solid var(--color-success)` }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-success)' }}>
        Payment successful
      </p>
      <p className="font-display tabular text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
        {formatCurrency(transaction.amount)}
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>to {transaction.counterparty}</p>
      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Ref: {transaction.reference}</p>
      <p className="text-sm" style={{ color: 'var(--color-text)' }}>
        Remaining balance: {formatCurrency(wallet?.balance ?? transaction.balance_after)}
      </p>
    </div>
  )
}
