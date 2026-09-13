import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognitionCtor =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

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

  // ---- Speech recognition setup -----------------------------------------
  useEffect(() => {
    if (!SpeechRecognitionCtor) return undefined

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onresult = (event) => {
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
        speakingRef.current = true
        try {
          recognitionRef.current?.stop()
        } catch {
          /* noop */
        }
        setStatus('speaking')

        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang
        utterance.rate = 1
        utterance.pitch = 1

        const finish = () => {
          speakingRef.current = false
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
