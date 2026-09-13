import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognitionCtor =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

// How long, after AwaazPay stops speaking, to ignore recognition results —
// covers the mic-restart race and any acoustic echo tail.
const ECHO_GUARD_MS = 700

// Ranked by how natural/pleasant they sound, best first. Matched against
// SpeechSynthesisVoice.name, which varies by OS/browser (Edge ships Azure
// "Online (Natural)" voices, Chrome/Windows ships Google + Microsoft Desktop
// voices, macOS/iOS ship Samantha/Victoria/Ava).
const PREFERRED_FEMALE_VOICES = [
  'Microsoft Aria Online (Natural)',
  'Microsoft Jenny Online (Natural)',
  'Microsoft Emma Online (Natural)',
  'Google UK English Female',
  'Google US English',
  'Samantha',
  'Ava',
  'Victoria',
  'Microsoft Zira Desktop',
  'Zira',
  'Microsoft Zira',
]

function pickFemaleVoice(voices, lang) {
  if (!voices?.length) return null

  const wantLang = lang.toLowerCase()
  const wantPrefix = wantLang.slice(0, 2)
  // Same region first (e.g. "en-US"), then same language ("en-*"), so we
  // never hand back a foreign-accented voice (e.g. UK/AU/IN English) when a
  // matching one for the requested locale exists.
  const exactRegion = voices.filter((v) => v.lang?.toLowerCase() === wantLang)
  const samePrefix = voices.filter((v) => v.lang?.toLowerCase().startsWith(wantPrefix))

  const byNameHint = (pool) => pool.find((v) => /female|zira|aria|jenny|emma|samantha|victoria|ava|susan/i.test(v.name))
  const byPreferredName = (pool) => {
    for (const name of PREFERRED_FEMALE_VOICES) {
      const match = pool.find((v) => v.name === name)
      if (match) return match
    }
    return null
  }

  return (
    byPreferredName(exactRegion) ||
    byPreferredName(samePrefix) ||
    byNameHint(exactRegion) ||
    byNameHint(samePrefix) ||
    samePrefix.find((v) => !/male/i.test(v.name)) ||
    samePrefix[0] ||
    voices[0]
  )
}

/**
 * Drives AwaazPay's "always listening" experience (PRD §7).
 *
 * - Runs speech recognition continuously, auto-restarting after silence,
 *   errors, or natural engine timeouts — the mic effectively never turns off
 *   while the app is open.
 * - Recognition is paused while AwaazPay is speaking (TTS) so the app never
 *   hears and reacts to its own voice.
 * - Exposes `speak(text)` as a promise so calling code can sequence prompts
 *   ("announce merchant" -> "ask for confirmation") without racing the mic.
 */
export function useVoice({ onFinalResult, lang = 'en-US' } = {}) {
  const [supported] = useState(() => Boolean(SpeechRecognitionCtor))
  const [micPermission, setMicPermission] = useState('unknown') // unknown | granted | denied
  const [status, setStatus] = useState('idle') // idle | listening | speaking | processing
  const [interimText, setInterimText] = useState('')
  const [lastSpoken, setLastSpoken] = useState('')

  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)
  const speakingRef = useRef(false)
  const onFinalResultRef = useRef(onFinalResult)
  onFinalResultRef.current = onFinalResult
  const voiceRef = useRef(null)
  // Timestamp of the last TTS finish. Speaker output can still be resonating
  // in the room (or bleeding into a laptop's own mic) for a moment after the
  // engine reports "done", so the mic can otherwise transcribe AwaazPay's own
  // trailing words as if the user said them.
  const lastSpeakEndRef = useRef(0)

  // ---- Voice selection ---------------------------------------------------
  // Chrome/Edge load voices asynchronously, so the list is often empty on the
  // very first render — re-resolve whenever it changes and cache the pick so
  // speak() never blocks on voice lookup.
  useEffect(() => {
    if (!window.speechSynthesis) return undefined

    const resolveVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      voiceRef.current = pickFemaleVoice(voices, lang)
    }

    resolveVoice()
    window.speechSynthesis.addEventListener('voiceschanged', resolveVoice)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', resolveVoice)
  }, [lang])

  // ---- Speech recognition setup -----------------------------------------
  useEffect(() => {
    if (!SpeechRecognitionCtor) return undefined

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onresult = (event) => {
      // Ignore anything captured in the brief window right after AwaazPay
      // finished speaking — it's almost always echo/tail audio of its own
      // voice, not the user.
      if (Date.now() - lastSpeakEndRef.current < ECHO_GUARD_MS) return

      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          setInterimText('')
          onFinalResultRef.current?.(transcript)
        } else {
          interim += transcript
        }
      }
      if (interim) setInterimText(interim)
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicPermission('denied')
        wantListeningRef.current = false
        setStatus('idle')
      }
      // 'no-speech' / 'aborted' etc. are expected and handled by onend restart
    }

    recognition.onend = () => {
      if (wantListeningRef.current && !speakingRef.current) {
        try {
          recognition.start()
        } catch {
          // already started; ignore
        }
      } else {
        setStatus((s) => (s === 'speaking' ? s : 'idle'))
      }
    }

    recognitionRef.current = recognition
    return () => {
      wantListeningRef.current = false
      try {
        recognition.stop()
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return
    try {
      await navigator.mediaDevices?.getUserMedia?.({ audio: true })
      setMicPermission('granted')
    } catch {
      setMicPermission('denied')
      return
    }
    wantListeningRef.current = true
    try {
      recognitionRef.current.start()
      setStatus('listening')
    } catch {
      // Recognition may already be running — that's fine.
      setStatus('listening')
    }
  }, [])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {
      /* noop */
    }
    setStatus('idle')
  }, [])

  // ---- Text-to-speech ------------------------------------------------------
  const speak = useCallback(
    (text) =>
      new Promise((resolve) => {
        setLastSpoken(text)
        if (!window.speechSynthesis) {
          resolve()
          return
        }

        // Pause recognition so AwaazPay doesn't transcribe its own voice.
        // abort() (vs. stop()) drops the mic immediately instead of waiting
        // to finalize whatever it was mid-hearing, so it can't still be
        // capturing audio once we start talking.
        speakingRef.current = true
        try {
          recognitionRef.current?.abort()
        } catch {
          /* noop */
        }
        setStatus('speaking')

        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang
        if (voiceRef.current) {
          utterance.voice = voiceRef.current
          utterance.lang = voiceRef.current.lang || lang
        }
        // Keep rate/pitch at the engine's natural values — pushing them off
        // 1.0 distorts synthetic voices and makes them harder to understand.
        utterance.rate = 1
        utterance.pitch = 1

        const finish = () => {
          speakingRef.current = false
          lastSpeakEndRef.current = Date.now()
          if (wantListeningRef.current) {
            try {
              recognitionRef.current?.start()
              setStatus('listening')
            } catch {
              setStatus('listening')
            }
          } else {
            setStatus('idle')
          }
          resolve()
        }

        utterance.onend = finish
        utterance.onerror = finish
        window.speechSynthesis.speak(utterance)
      }),
    [lang],
  )

  return {
    supported,
    micPermission,
    status, // idle | listening | speaking | processing
    interimText,
    lastSpoken,
    startListening,
    stopListening,
    speak,
    setProcessing: (isProcessing) => setStatus(isProcessing ? 'processing' : 'listening'),
  }
}
