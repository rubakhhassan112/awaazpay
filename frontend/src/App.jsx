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
import { LogoMark, LogoLockup } from './components/Logo'

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 pb-8 pt-5">
      <header className="anim-rise sticky top-0 z-20 -mx-5 flex items-center justify-between px-5 py-3 backdrop-blur-xl">
        <LogoLockup size={38} animated={status === 'speaking' || status === 'listening'} />
        {micPermission === 'denied' ? (
          <span
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(255,107,120,0.16)', color: 'var(--color-danger)', border: '1px solid rgba(255,107,120,0.4)' }}
          >
            Mic blocked
          </span>
        ) : (
          <StatusPill status={status} />
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
          {/* The stagger lives on a wrapper: `anim-rise` uses fill-mode forwards,
              which would otherwise pin the button's transform and kill its
              hover/press feedback. */}
          <div className="anim-rise" style={{ '--d': '220ms' }}>
            <BigButton icon={<NfcIcon />} hint="Say “Pay using NFC”" onClick={startPaymentFlow}>
              Pay using NFC
            </BigButton>
          </div>
          <div className="anim-rise" style={{ '--d': '290ms' }}>
            <BigButton variant="surface" icon={<DownIcon />} hint="Say “Receive money”" onClick={startReceiveFlow}>
              Receive Money
            </BigButton>
          </div>
          <div className="anim-rise" style={{ '--d': '360ms' }}>
            <BigButton variant="surface" icon={<WalletIcon />} hint="Say “What is my balance”" onClick={announceBalance}>
              Check Balance
            </BigButton>
          </div>
          <div className="anim-rise" style={{ '--d': '430ms' }}>
            <BigButton variant="surface" icon={<ListIcon />} hint="Say “Recent transactions”" onClick={announceRecentTransactions}>
              Recent Transactions
            </BigButton>
          </div>
        </div>
      )}

      {step === 'nfc_searching' && <NfcSearchCard onCancel={() => cancelTransaction()} />}

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

      {step === 'processing_payment' && <ProcessingCard label="Processing payment…" />}
      {step === 'receive_processing' && <ProcessingCard label="Waiting for incoming transfer…" />}

      {step === 'receipt' && lastTransaction && <ReceiptCard transaction={lastTransaction} wallet={wallet} />}

      {step === 'home' && recentTransactions.length > 0 && (
        <section className="anim-rise" style={{ '--d': '500ms' }}>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-dim)' }}>
            Recent activity
          </h2>
          <TransactionHistory transactions={recentTransactions} />
        </section>
      )}

      <footer className="mt-auto pt-6 text-center">
        <button
          type="button"
          onClick={() => setShowDemoPanel((v) => !v)}
          className="pressable rounded-full px-4 py-2 text-xs font-medium"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-dim)' }}
          aria-expanded={showDemoPanel}
        >
          Demo settings
        </button>
        {showDemoPanel && (
          <div className="glass anim-rise mt-3 rounded-2xl p-4 text-left">
            <label htmlFor="demo-terminal" className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Terminal to simulate on next "Pay using NFC"
            </label>
            <select
              id="demo-terminal"
              value={demoMerchantId}
              onChange={(e) => setDemoMerchantId(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
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
        <p className="mt-4 text-[11px] leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
          Hackathon prototype. Simulated NFC, simulated transactions — no real money moves.
        </p>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------

function StatusPill({ status }) {
  const map = {
    listening: { text: 'Listening', color: 'var(--color-accent)' },
    speaking: { text: 'Speaking', color: 'var(--color-accent-2)' },
    processing: { text: 'Thinking', color: 'var(--color-accent-2)' },
    idle: { text: 'Idle', color: 'var(--color-text-dim)' },
  }
  const { text, color } = map[status] ?? map.idle
  return (
    <span
      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color }}
    >
      <span
        className={status === 'listening' ? 'anim-breathe' : ''}
        style={{ width: 7, height: 7, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}` }}
        aria-hidden="true"
      />
      {text}
    </span>
  )
}

function LaunchScreen({ onBegin, supported }) {
  const features = [
    { icon: <MicChipIcon />, label: 'Always listening' },
    { icon: <ShieldIcon />, label: 'Voice-verified' },
    { icon: <NfcIcon />, label: 'Tap to pay' },
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="anim-pop relative flex items-center justify-center" style={{ '--d': '40ms' }}>
        <span
          className="absolute h-52 w-52 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(24,165,230,0.34), transparent 68%)', filter: 'blur(26px)' }}
          aria-hidden="true"
        />
        <LogoMark size={150} animated className="anim-float relative" />
      </div>

      <div className="anim-rise" style={{ '--d': '180ms' }}>
        <h1 className="font-display text-5xl font-bold tracking-tight">
          <span style={{ color: 'var(--color-text)' }}>Awaaz</span>
          <span className="text-gradient">Pay</span>
        </h1>
        <p
          className="font-display mt-2 text-sm font-medium uppercase"
          style={{ letterSpacing: '0.3em', color: 'var(--color-text-dim)' }}
        >
          Banking Beyond Sight
        </p>
      </div>

      <ul className="anim-rise flex flex-wrap items-center justify-center gap-2" style={{ '--d': '260ms' }}>
        {features.map((f) => (
          <li
            key={f.label}
            className="glass flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
            style={{ color: 'var(--color-text-dim)' }}
          >
            <span style={{ color: 'var(--color-accent)' }} aria-hidden="true">{f.icon}</span>
            {f.label}
          </li>
        ))}
      </ul>

      <p className="anim-rise max-w-xs text-sm leading-relaxed" style={{ '--d': '340ms', color: 'var(--color-text-dim)' }}>
        AwaazPay listens continuously once started, so it needs your permission to use the microphone.
        Tap anywhere on the button below to begin.
      </p>

      <div className="anim-rise w-full" style={{ '--d': '420ms' }}>
        <BigButton onClick={onBegin} icon={<MicChipIcon />} hint="Grants microphone access">
          Tap to Start
        </BigButton>
      </div>

      {!supported && (
        <p className="anim-rise max-w-xs text-xs leading-relaxed" style={{ '--d': '480ms', color: 'var(--color-danger)' }}>
          Your browser does not support voice recognition. AwaazPay will still work with the on-screen
          buttons, but for the full voice experience, please use Google Chrome.
        </p>
      )}
    </div>
  )
}

function CardShell({ children, tone = 'brand', label, className = '' }) {
  const toneColor = {
    brand: 'var(--color-accent)',
    success: 'var(--color-success)',
    danger: 'var(--color-danger)',
  }[tone]

  return (
    <div className={`glass-accent anim-pop flex flex-col gap-4 rounded-[26px] p-5 text-center ${className}`}>
      {label && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: toneColor }}>
          {label}
        </p>
      )}
      {children}
    </div>
  )
}

function ManualSetupForm({ value, onChange, onSubmit }) {
  return (
    <div className="glass anim-rise flex flex-col gap-3 rounded-[26px] p-5" style={{ '--d': '220ms' }}>
      <label htmlFor="setup-phrase" className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
        Or type your secret word here
      </label>
      <input
        id="setup-phrase"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        className="rounded-2xl px-4 py-3.5 text-lg"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        placeholder="e.g. falcon"
      />
      <BigButton onClick={onSubmit}>Save secret word</BigButton>
    </div>
  )
}

function NfcSearchCard({ onCancel }) {
  return (
    <CardShell label="Searching for a terminal">
      <div className="relative mx-auto flex h-32 w-full max-w-55 items-center justify-center overflow-hidden rounded-3xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--color-border-strong)' }}>
        <span
          className="scan-line absolute inset-x-0 h-16"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(47,214,166,0.4), transparent)' }}
          aria-hidden="true"
        />
        <span style={{ color: 'var(--color-accent)' }} className="anim-breathe relative">
          <NfcIcon size={48} />
        </span>
      </div>
      <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
        Hold your phone near the payment terminal.
      </p>
      <BigButton variant="danger" onClick={onCancel}>Cancel</BigButton>
    </CardShell>
  )
}

function ProcessingCard({ label }) {
  return (
    <CardShell label="Please wait">
      <div className="flex items-center justify-center gap-2 py-2" aria-hidden="true">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="dot-bounce h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--color-accent)', '--d': `${d}ms` }}
          />
        ))}
      </div>
      <p className="text-lg" style={{ color: 'var(--color-text)' }}>{label}</p>
    </CardShell>
  )
}

function MerchantCard({ merchant, onCancel }) {
  if (!merchant) return null
  return (
    <CardShell label="Terminal detected">
      <p className="font-display text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
        {merchant.name}
      </p>
      <p className="font-display tabular text-gradient text-5xl font-bold">
        {formatCurrency(merchant.amount)}
      </p>
      <BigButton variant="danger" onClick={onCancel}>Cancel</BigButton>
    </CardShell>
  )
}

function SecurityChallengeCard({ challengeNumber, attempts, onCancel }) {
  return (
    <CardShell label="Security check">
      <p style={{ color: 'var(--color-text)' }}>Say your secret word followed by</p>
      <p key={challengeNumber} className="font-display tabular anim-pop text-6xl font-bold text-gradient">
        {challengeNumber}
      </p>
      <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-8 rounded-full transition-colors duration-300"
            style={{ background: i < attempts ? 'var(--color-danger)' : 'var(--color-border-strong)' }}
          />
        ))}
      </div>
      {attempts > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
          Attempt {attempts} of 3 failed.
        </p>
      )}
      <BigButton variant="danger" onClick={onCancel}>Cancel</BigButton>
    </CardShell>
  )
}

function ConfirmCard({ merchant, onConfirm, onCancel }) {
  return (
    <CardShell label="Identity confirmed" tone="success">
      <p style={{ color: 'var(--color-text-dim)' }}>Pay</p>
      <p className="font-display tabular text-gradient text-4xl font-bold">{formatCurrency(merchant?.amount)}</p>
      <p style={{ color: 'var(--color-text)' }}>to {merchant?.name}?</p>
      <BigButton variant="success" onClick={onConfirm}>Confirm Payment</BigButton>
      <BigButton variant="danger" onClick={onCancel}>Cancel</BigButton>
    </CardShell>
  )
}

function ReceiptCard({ transaction, wallet }) {
  return (
    <CardShell label="Payment successful" tone="success">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center" aria-hidden="true">
        <span
          className="burst-ring absolute inset-0 rounded-full"
          style={{ border: '2px solid var(--color-success)' }}
        />
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(43,227,154,0.14)' }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="var(--color-success)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="40"
              style={{ animation: 'tick-in 0.6s 0.1s cubic-bezier(0.65,0,0.35,1) both' }}
            />
          </svg>
        </span>
      </div>
      <p className="font-display tabular text-4xl font-bold" style={{ color: 'var(--color-text)' }}>
        {formatCurrency(transaction.amount)}
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>to {transaction.counterparty}</p>
      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Ref: {transaction.reference}</p>
      <p className="text-sm" style={{ color: 'var(--color-text)' }}>
        Remaining balance: {formatCurrency(wallet?.balance ?? transaction.balance_after)}
      </p>
    </CardShell>
  )
}

// ---- Icons -----------------------------------------------------------------

function NfcIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 8a5.5 5.5 0 0 1 0 8M12 5a9 9 0 0 1 0 14M16 2.5a12.5 12.5 0 0 1 0 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

function DownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v14M6 12l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M16 12.5h2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 7h11M8 12h11M8 17h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="7" r="1.4" fill="currentColor" />
      <circle cx="4" cy="12" r="1.4" fill="currentColor" />
      <circle cx="4" cy="17" r="1.4" fill="currentColor" />
    </svg>
  )
}

function MicChipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.3-2.9 8.2-7 9.5-4.1-1.3-7-5.2-7-9.5V6l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
