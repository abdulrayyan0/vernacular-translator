import { useEffect, useRef, useState } from 'react'

function stopAudio(audio) {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

function getPresentationFontSize(text) {
  const len = (text || '').trim().length
  if (len === 0) return 'text-2xl sm:text-3xl'
  if (len < 60) return 'text-4xl sm:text-5xl lg:text-6xl'
  if (len < 160) return 'text-3xl sm:text-4xl lg:text-5xl'
  if (len < 320) return 'text-2xl sm:text-3xl lg:text-4xl'
  return 'text-xl sm:text-2xl lg:text-3xl'
}

const LANGUAGES = [
  { code: 'en', speechTag: 'en-US', label: 'English', placeholder: 'Type lesson in English...' },
  { code: 'hi', speechTag: 'hi-IN', label: 'हिन्दी', placeholder: 'पाठ यहाँ लिखें...' },
  { code: 'te', speechTag: 'te-IN', label: 'తెలుగు', placeholder: 'పాఠాన్ని ఇక్కడ టైప్ చేయండి...' },
  { code: 'ta', speechTag: 'ta-IN', label: 'தமிழ்', placeholder: 'பாடத்தை இங்கே தட்டச்சு செய்க...' },
  { code: 'mr', speechTag: 'mr-IN', label: 'मराठी', placeholder: 'धडा येथे टाइप करा...' },
]

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

function App() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [outputHasError, setOutputHasError] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('hi')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isListening, setIsListening] = useState(false)
  const [phoneticText, setPhoneticText] = useState('')
  const [savedLessons, setSavedLessons] = useState(() => {
    try {
      const stored = localStorage.getItem('lingoduct_saved_lessons')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [showSaved, setShowSaved] = useState(false)
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const audioRef = useRef(null)
  const recognitionRef = useRef(null)

  const activeSourceLang = LANGUAGES.find((l) => l.code === sourceLang) || LANGUAGES[0]
  const activeTargetLang = LANGUAGES.find((l) => l.code === targetLang) || LANGUAGES[1]

  function resetPlayback() {
    stopAudio(audioRef.current)
    audioRef.current = null
    setIsSpeaking(false)
  }

  function handleSourceLangChange(event) {
    const newSource = event.target.value
    if (newSource === targetLang) {
      setTargetLang(sourceLang)
      setOutputText(inputText)
    }
    setSourceLang(newSource)
    setOutputText('')
    setPhoneticText('')
    setOutputHasError(false)
    setSpeechError('')
    setIsCopied(false)
    resetPlayback()
  }

  function handleTargetLangChange(event) {
    const newTarget = event.target.value
    if (newTarget === sourceLang) {
      setSourceLang(targetLang)
      setInputText(outputText)
    }
    setTargetLang(newTarget)
    setOutputText('')
    setPhoneticText('')
    setOutputHasError(false)
    setSpeechError('')
    setIsCopied(false)
    resetPlayback()
  }

  function handleSwapLanguages() {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setInputText(outputText)
    setOutputText(inputText)
    setPhoneticText('')
    setOutputHasError(false)
    setSpeechError('')
    setIsCopied(false)
    resetPlayback()
  }

  useEffect(() => {
    return () => {
      stopAudio(audioRef.current)
      audioRef.current = null
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('lingoduct_saved_lessons', JSON.stringify(savedLessons))
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [savedLessons])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresentationMode])

  useEffect(() => {
    if (isPresentationMode) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isPresentationMode])

  function handleMicToggle() {
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser.')
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = activeSourceLang.speechTag
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInputText((prev) => (prev ? prev + ' ' + transcript : transcript))
      setPhoneticText('')
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    setIsListening(true)
    recognition.start()
  }

  async function handleTranslate() {
    const trimmed = inputText.trim()
    if (!trimmed) return

    if (sourceLang === targetLang) {
      setOutputText(trimmed)
      setPhoneticText('')
      return
    }

    setOutputHasError(false)
    setSpeechError('')
    setPhoneticText('')
    setIsTranslating(true)
    resetPlayback()

    try {
      // Primary: Google gtx endpoint with translation and romanization
      try {
        const gtxResponse = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=rm&q=${encodeURIComponent(trimmed)}`,
        )

        if (!gtxResponse.ok) {
          throw new Error('Google translate request failed')
        }

        const gtxData = await gtxResponse.json()
        const translated = gtxData[0]
          .map((segment) => segment[0])
          .filter(Boolean)
          .join('')

        if (!translated) {
          throw new Error('No translation returned from Google')
        }

        // Dynamic transliteration retrieval from Google GTX payload
        let romanization = ''
        if (Array.isArray(gtxData[0])) {
          for (const item of gtxData[0]) {
            if (Array.isArray(item)) {
              if (!item[0] && typeof item[2] === 'string' && item[2].trim()) {
                romanization = item[2].trim()
                break
              }
              if (!item[0] && typeof item[3] === 'string' && item[3].trim()) {
                romanization = item[3].trim()
                break
              }
            }
          }
        }
        if (!romanization && Array.isArray(gtxData[1])) {
          for (const item of gtxData[1]) {
            if (typeof item === 'string' && item.trim()) {
              romanization = item.trim()
              break
            }
          }
        }

        setPhoneticText(romanization)
        setOutputText(translated)
        return
      } catch (gtxError) {
        // Fallback: MyMemory API
        setPhoneticText('')
        const mmResponse = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sourceLang}|${targetLang}`,
        )

        if (!mmResponse.ok) {
          throw new Error('MyMemory request failed')
        }

        const mmData = await mmResponse.json()
        const translated = mmData?.responseData?.translatedText?.trim()

        if (!translated) {
          throw new Error('No translation returned from MyMemory')
        }

        setOutputText(translated)
      }
    } catch {
      setPhoneticText('')
      setOutputHasError(true)
      setOutputText('Translation could not be completed. Please try again.')
    } finally {
      setIsTranslating(false)
    }
  }

  function speakWithSynthesis(text, langConfig) {
    if (!window.speechSynthesis) {
      setSpeechError('Speech synthesis is not supported in this browser.')
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langConfig.speechTag
    utterance.rate = playbackRate

    const voices = window.speechSynthesis.getVoices()
    const matchedVoice = voices.find((v) => v.lang.startsWith(langConfig.code))
    if (matchedVoice) {
      utterance.voice = matchedVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => {
      setIsSpeaking(false)
      setSpeechError('Could not play the audio.')
    }

    window.speechSynthesis.speak(utterance)
  }

  function handleListenSource() {
    const text = inputText.trim()
    if (!text) return

    if (isSpeaking) {
      resetPlayback()
      return
    }

    resetPlayback()
    setSpeechError('')
    speakWithSynthesis(text, activeSourceLang)
  }

  async function handleReadAloud() {
    const lesson = outputText.trim()

    if (outputHasError || !lesson) {
      setSpeechError('Translate a lesson first, then try Read Aloud.')
      return
    }

    if (audioRef.current && !audioRef.current.paused) {
      resetPlayback()
      return
    }

    resetPlayback()
    setSpeechError('')

    const audioUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${targetLang}&q=${encodeURIComponent(lesson)}`

    const audio = new Audio(audioUrl)
    audio.playbackRate = playbackRate
    audioRef.current = audio

    audio.addEventListener('playing', () => {
      setIsSpeaking(true)
    })

    audio.addEventListener('ended', () => {
      setIsSpeaking(false)
      audioRef.current = null
    })

    audio.addEventListener('error', () => {
      // Google TTS failed — fall back to native speech synthesis
      audioRef.current = null
      speakWithSynthesis(lesson, activeTargetLang)
    })

    try {
      await audio.play()
    } catch {
      // Network / CORS / decode failure — fall back to native speech synthesis
      audioRef.current = null
      speakWithSynthesis(lesson, activeTargetLang)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(outputText)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setSpeechError('Failed to copy text.')
    }
  }

  function handleClear() {
    setInputText('')
    setOutputText('')
    setPhoneticText('')
    setOutputHasError(false)
    setSpeechError('')
    setIsCopied(false)
    resetPlayback()
  }

  function handleSaveLesson() {
    const source = inputText.trim()
    const translated = outputText.trim()
    if (!source || !translated || outputHasError) return

    const alreadySaved = savedLessons.some(
      (item) => item.english === source && item.lang === targetLang && item.sourceLang === sourceLang,
    )
    if (alreadySaved) return

    setSavedLessons((prev) => [
      ...prev,
      { id: Date.now(), english: source, translated, lang: targetLang, sourceLang },
    ])
  }

  function handleLoadLesson(item) {
    setInputText(item.english)
    setOutputText(item.translated)
    setPhoneticText('')
    setSourceLang(item.sourceLang || 'en')
    setTargetLang(item.lang)
    setOutputHasError(false)
    setSpeechError('')
    setIsCopied(false)
    resetPlayback()
  }

  function handleDeleteLesson(id) {
    setSavedLessons((prev) => prev.filter((item) => item.id !== id))
  }

  function handleClearAllSaved() {
    setSavedLessons([])
  }

  function handlePrintFlashcards() {
    if (savedLessons.length === 0) return
    window.print()
  }

  const isAlreadySaved = savedLessons.some(
    (item) => item.english === inputText.trim() && item.lang === targetLang && item.sourceLang === sourceLang,
  )

  return (
    <div className="classroom-canvas min-h-svh text-slate-800 flex flex-col font-sans">
      <div className="no-print flex flex-col min-h-svh">
        {/* Classroom Header */}
      <header className="sticky top-0 z-20 border-b border-amber-200/50 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xl font-extrabold text-white shadow-md shadow-blue-500/25">
              वा
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/70 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-blue-700">
                  <span>🎓</span> Primary Classroom
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/70 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-amber-800">
                  <span>✨</span> Bilingual Pedagogy
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                Vernacular Pedagogy Assistant
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Smartboard Ready
            </span>
            <button
              type="button"
              onClick={() => setIsPresentationMode(true)}
              className="tactile-btn rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
              title="Open Smartboard Presentation Mode (Esc to exit)"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              <span>Presentation Mode</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Educator Workspace */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Interactive Lesson Translator & Speech Studio
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Translate teaching prompts into regional vernaculars with crystal-clear audio pronunciation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPresentationMode(true)}
            className="tactile-btn chip-blue self-start sm:self-auto px-4 py-2 text-xs font-bold shadow-xs hover:shadow flex items-center gap-1.5"
            title="Expand to classroom Smartboard view"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            <span>Smartboard Mode</span>
          </button>
        </div>

        {/* Dual-Column Translation Cards */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] items-stretch">
          {/* Source Lesson Card */}
          <section className="flex min-h-[24rem] flex-col rounded-3xl border border-slate-200/80 border-t-4 border-t-blue-500 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            {/* Source Header */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Clean Language Selector */}
              <div className="relative inline-flex items-center">
                <select
                  value={sourceLang}
                  onChange={handleSourceLangChange}
                  className="appearance-none rounded-full bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 pl-4 pr-8 py-1.5 text-sm font-bold shadow-xs outline-none cursor-pointer transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  aria-label="Source Language"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="text-slate-800 bg-white font-medium">
                      {lang.label}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-2.5 h-4 w-4 text-blue-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              {/* Voice Input (Speech-to-Text) */}
              <button
                type="button"
                onClick={handleMicToggle}
                aria-pressed={isListening}
                className={`tactile-btn chip-blue px-3.5 py-1.5 text-xs font-bold ${
                  isListening ? 'mic-recording' : ''
                }`}
                title="Dictate lesson with microphone voice input"
              >
                <span aria-hidden="true">🎙️</span>
                <span>{isListening ? 'Listening…' : 'Dictate'}</span>
              </button>

              {/* Pronounce Source Lesson */}
              <button
                type="button"
                onClick={handleListenSource}
                disabled={!inputText.trim()}
                className="tactile-btn chip-blue px-3 py-1.5 text-xs font-bold"
                title="Pronounce source lesson"
              >
                <span aria-hidden="true">🔊</span>
                <span>Listen</span>
              </button>
            </div>

            <label htmlFor="source-lesson" className="sr-only">
              {activeSourceLang.label} lesson
            </label>
            <textarea
              id="source-lesson"
              value={inputText}
              onChange={(event) => {
                setInputText(event.target.value)
                setPhoneticText('')
              }}
              placeholder={activeSourceLang.placeholder}
              className="classroom-textarea min-h-[17rem] flex-1 resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>
                {inputText.trim()
                  ? `${inputText.trim().split(/\s+/).filter(Boolean).length} words`
                  : 'Ready to type or dictate'}
              </span>
              <span className="font-medium text-slate-400">
                ✨ Clear display for classroom view
              </span>
            </div>
          </section>

          {/* Swap Controls */}
          <div className="flex items-center justify-center lg:flex-col py-1">
            <button
              type="button"
              onClick={handleSwapLanguages}
              className="tactile-btn h-12 w-12 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/60 shadow-sm hover:shadow-md transition-all text-xl"
              title="Swap source & target languages"
              aria-label="Swap source and target languages"
            >
              ⇄
            </button>
          </div>

          {/* Vernacular Target Output Card */}
          <section className="flex min-h-[24rem] flex-col rounded-3xl border border-slate-200/80 border-t-4 border-t-amber-500 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            {/* Target Header */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Clean Language Selector */}
              <div className="relative inline-flex items-center">
                <select
                  value={targetLang}
                  onChange={handleTargetLangChange}
                  className="appearance-none rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 pl-4 pr-8 py-1.5 text-sm font-bold shadow-xs outline-none cursor-pointer transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  aria-label="Target Vernacular Language"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="text-slate-800 bg-white font-medium">
                      {lang.label}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-2.5 h-4 w-4 text-amber-700"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            <label htmlFor="translated-lesson" className="sr-only">
              {activeTargetLang.label} translation
            </label>
            <div className="relative flex flex-1 flex-col">
              <textarea
                id="translated-lesson"
                value={outputText}
                readOnly
                placeholder={isTranslating ? '' : `${activeTargetLang.label} translation will appear here.`}
                className={`classroom-textarea min-h-[17rem] flex-1 resize-none rounded-2xl border p-4 leading-relaxed outline-none transition placeholder:text-slate-400 ${
                  outputHasError
                    ? 'border-rose-300 bg-rose-50/40 text-rose-700'
                    : 'border-slate-200/90 bg-amber-50/20 text-slate-800'
                }`}
              />
              {isTranslating ? (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/70 backdrop-blur-xs">
                  <svg
                    className="h-7 w-7 animate-spin text-amber-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  <span className="mt-2 text-xs font-bold text-amber-900">
                    Translating lesson…
                  </span>
                </div>
              ) : null}
            </div>

            {/* Phonetic Pronunciation Guidance Pill */}
            {phoneticText && !outputHasError ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-indigo-100/90 bg-indigo-50/60 px-4 py-2 text-xs text-indigo-950 shadow-xs">
                <span className="font-bold text-indigo-900 shrink-0">
                  🗣️ Pronunciation (Phonetic):
                </span>
                <span className="italic text-indigo-800/90 font-medium break-words">
                  {phoneticText}
                </span>
              </div>
            ) : null}

            {/* Target Card Audio & Utility Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {/* Read Aloud */}
              <button
                type="button"
                onClick={handleReadAloud}
                aria-pressed={isSpeaking}
                className={`tactile-btn chip-amber px-4 py-2 text-sm font-bold ${
                  isSpeaking ? 'chip-speaking' : ''
                }`}
                title="Listen to native vernacular pronunciation"
              >
                {isSpeaking ? (
                  <span className="soundwave text-amber-900" aria-hidden="true">
                    <span className="soundwave-bar"></span>
                    <span className="soundwave-bar"></span>
                    <span className="soundwave-bar"></span>
                    <span className="soundwave-bar"></span>
                  </span>
                ) : (
                  <span aria-hidden="true">🔊</span>
                )}
                <span>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
              </button>

              {/* Speed Toggle */}
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="tactile-btn chip-amber px-3 py-2 text-xs font-bold cursor-pointer outline-none"
                title="Classroom playback speed"
                aria-label="Speech Playback Speed"
              >
                <option value={0.75}>🐢 0.75× Slow</option>
                <option value={1}>⚡ 1× Normal</option>
                <option value={1.25}>🐰 1.25× Fast</option>
              </select>

              {/* Copy Action */}
              <button
                type="button"
                onClick={handleCopy}
                disabled={!outputText.trim() || outputHasError}
                className="tactile-btn chip-amber px-3.5 py-2 text-sm font-bold"
                title="Copy translated lesson to clipboard"
              >
                <span aria-hidden="true">{isCopied ? '✓' : '📋'}</span>
                <span>{isCopied ? 'Copied!' : 'Copy'}</span>
              </button>

              {/* Save Lesson Vocabulary */}
              <button
                type="button"
                onClick={handleSaveLesson}
                disabled={!outputText.trim() || outputHasError || isAlreadySaved}
                className="tactile-btn chip-amber px-3.5 py-2 text-sm font-bold"
                title={isAlreadySaved ? 'Already saved in vocabulary' : 'Save to lesson vocabulary'}
              >
                <span aria-hidden="true">{isAlreadySaved ? '✓' : '🔖'}</span>
                <span>{isAlreadySaved ? 'Saved' : 'Save'}</span>
              </button>

              {/* Presentation / Smartboard Mode Button */}
              <button
                type="button"
                onClick={() => setIsPresentationMode(true)}
                className="tactile-btn chip-amber px-3.5 py-2 text-sm font-bold flex items-center gap-1.5"
                title="Open in Smartboard Presentation Mode"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <span>Present</span>
              </button>
            </div>

            {speechError ? (
              <div className="mt-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700" role="alert">
                  <span>⚠️</span> {speechError}
                </span>
              </div>
            ) : null}
          </section>
        </div>

        {/* Primary Bottom Action Controls */}
        <div className="mt-8 flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isTranslating}
            aria-busy={isTranslating}
            className="tactile-btn btn-translate px-8 py-3.5 text-base font-extrabold"
          >
            {isTranslating ? (
              <>
                <svg
                  className="h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>Translating…</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Translate Lesson</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="tactile-btn btn-clear px-6 py-3.5 text-base font-bold"
            title="Clear current lesson text"
          >
            <span>🧹</span>
            <span>Clear</span>
          </button>
        </div>

        {/* Saved Classroom Vocabulary Drawer */}
        <section className="mt-10 rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowSaved((prev) => !prev)}
              className="tactile-btn flex items-center gap-2.5 text-left p-1 text-slate-800 hover:text-blue-700 transition-colors"
            >
              <span className="text-xl">📚</span>
              <span className="text-base font-extrabold">Saved Classroom Vocabulary</span>
              <span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-black">
                {savedLessons.length}
              </span>
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors ml-1">
                <span>{showSaved ? 'Collapse' : 'Expand'}</span>
                <span
                  className="transition-transform duration-200 text-[0.65rem]"
                  style={{
                    display: 'inline-block',
                    transform: showSaved ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  ▼
                </span>
              </span>
            </button>

            {/* Export Flashcards Trigger */}
            <button
              type="button"
              onClick={handlePrintFlashcards}
              disabled={savedLessons.length === 0}
              className="tactile-btn rounded-full border border-amber-300/90 bg-gradient-to-r from-amber-50 to-amber-100/90 hover:from-amber-100 hover:to-amber-200 text-amber-900 px-4 py-2 text-xs font-black shadow-xs hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
              title={
                savedLessons.length === 0
                  ? 'Save vocabulary items first to export flashcards'
                  : 'Export flashcard printable sheet (Print or Save as PDF)'
              }
            >
              <span aria-hidden="true">🖨️</span>
              <span>Export Flashcards (Print/PDF)</span>
            </button>
          </div>

          {showSaved && (
            <div className="mt-5 space-y-3 pt-2 border-t border-slate-100">
              {savedLessons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                  <p className="text-3xl mb-1.5">🎒</p>
                  <p className="text-sm font-bold text-slate-700">No saved vocabulary yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Translate a lesson prompt above and click "Save" to build your classroom quick-reference deck.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {savedLessons.map((item) => {
                      const srcLang = LANGUAGES.find((l) => l.code === item.sourceLang)
                      const tgtLang = LANGUAGES.find((l) => l.code === item.lang)
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:shadow-md transition-shadow"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[0.6875rem] font-bold text-blue-700">
                                  {srcLang?.label || item.sourceLang || 'EN'}
                                </span>
                                <span className="text-xs text-slate-400 font-bold">➔</span>
                                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[0.6875rem] font-bold text-amber-800">
                                  {tgtLang?.label || item.lang}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-slate-800 line-clamp-2">
                              {item.english}
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-600 line-clamp-2">
                              {item.translated}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleLoadLesson(item)}
                              className="tactile-btn chip-blue px-3 py-1 text-xs font-bold"
                              title="Load lesson onto board"
                            >
                              <span>📥 Load</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLesson(item.id)}
                              className="tactile-btn px-3 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-full"
                              title="Delete this saved card"
                            >
                              <span>🗑️ Delete</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleClearAllSaved}
                      className="tactile-btn px-4 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-full transition-colors"
                    >
                      Clear All Saved
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </main>
      </div>

      {/* Smartboard / Presentation Mode Overlay */}
      {isPresentationMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Smartboard Presentation Mode"
          className="classroom-canvas fixed inset-0 z-50 flex flex-col p-4 sm:p-7 lg:p-10 overflow-y-auto no-print"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-amber-200/60 bg-white/90 backdrop-blur-md px-5 sm:px-7 py-4 rounded-3xl shadow-sm mb-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-lg font-black text-white shadow-sm">
                वा
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-blue-700">
                    📺 Smartboard Mode
                  </span>
                  <span className="text-xs text-slate-400 hidden md:inline">
                    • Press <kbd className="font-mono bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-[0.7rem] text-slate-700">ESC</kbd> to exit
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  Classroom Pedagogy Board
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPresentationMode(false)}
              className="tactile-btn rounded-full bg-slate-900 text-white hover:bg-slate-800 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-black shadow-md hover:shadow-lg flex items-center gap-2 border border-slate-700 transition-all"
              title="Exit presentation mode (Esc)"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              <span>Exit Fullscreen</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.65rem] font-mono text-slate-300 hidden sm:inline">
                ESC
              </span>
              <span aria-hidden="true" className="text-base font-black ml-0.5">✕</span>
            </button>
          </div>

          {/* High-Contrast Split Cards */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
            {/* Source Lesson Block */}
            <div className="flex flex-col justify-between rounded-3xl border-2 border-blue-200 border-t-8 border-t-blue-600 bg-white p-6 sm:p-10 shadow-lg min-h-[20rem]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1.5 text-sm sm:text-base font-black text-blue-800">
                    <span aria-hidden="true">📘</span>
                    <span>{activeSourceLang.label}</span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600/70 hidden sm:inline">
                    Source
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleListenSource}
                  disabled={!inputText.trim()}
                  className="tactile-btn chip-blue px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-black shadow-xs flex items-center gap-1.5"
                  title="Pronounce source lesson"
                >
                  <span aria-hidden="true">🔊</span>
                  <span>Read {activeSourceLang.label}</span>
                </button>
              </div>

              <div className="my-auto py-8 sm:py-12">
                {inputText.trim() ? (
                  <p className={`${getPresentationFontSize(inputText)} font-black leading-[1.3] text-slate-900 tracking-tight whitespace-pre-wrap select-text`}>
                    {inputText}
                  </p>
                ) : (
                  <p className="text-2xl sm:text-3xl font-bold text-slate-300 italic">
                    (No lesson prompt entered yet. Type or dictate in standard view.)
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>📘 Classroom Prompt</span>
                <span>{inputText.trim() ? `${inputText.trim().split(/\s+/).filter(Boolean).length} words` : ''}</span>
              </div>
            </div>

            {/* Target Vernacular Block */}
            <div className="flex flex-col justify-between rounded-3xl border-2 border-amber-200 border-t-8 border-t-amber-500 bg-white p-6 sm:p-10 shadow-lg min-h-[20rem]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3.5 py-1.5 text-sm sm:text-base font-black text-amber-800">
                    <span aria-hidden="true">📙</span>
                    <span>{activeTargetLang.label}</span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700/70 hidden sm:inline">
                    Vernacular
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReadAloud}
                    disabled={!outputText.trim() || outputHasError}
                    aria-pressed={isSpeaking}
                    className={`tactile-btn chip-amber px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-black shadow-xs flex items-center gap-2 ${
                      isSpeaking ? 'chip-speaking' : ''
                    }`}
                    title="Listen to native vernacular pronunciation"
                  >
                    {isSpeaking ? (
                      <span className="soundwave text-amber-900" aria-hidden="true">
                        <span className="soundwave-bar"></span>
                        <span className="soundwave-bar"></span>
                        <span className="soundwave-bar"></span>
                        <span className="soundwave-bar"></span>
                      </span>
                    ) : (
                      <span aria-hidden="true">🔊</span>
                    )}
                    <span>{isSpeaking ? 'Stop Audio' : `Read ${activeTargetLang.label}`}</span>
                  </button>

                  <select
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                    className="tactile-btn chip-amber px-2.5 py-2 text-xs font-bold cursor-pointer outline-none"
                    title="Playback speed"
                    aria-label="Presentation Playback Speed"
                  >
                    <option value={0.75}>0.75×</option>
                    <option value={1}>1×</option>
                    <option value={1.25}>1.25×</option>
                  </select>
                </div>
              </div>

              <div className="my-auto py-8 sm:py-12">
                {isTranslating ? (
                  <div className="flex flex-col items-center justify-center text-amber-600 py-8">
                    <svg
                      className="h-12 w-12 animate-spin text-amber-500 mb-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <p className="text-2xl font-black text-amber-800">Translating lesson…</p>
                  </div>
                ) : outputText.trim() ? (
                  <div>
                    <p
                      className={`${getPresentationFontSize(outputText)} font-black leading-[1.3] tracking-tight whitespace-pre-wrap select-text ${
                        outputHasError ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {outputText}
                    </p>
                    {phoneticText && !outputHasError ? (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-4 py-1.5 text-sm sm:text-base text-indigo-950">
                        <span className="font-bold text-indigo-900 shrink-0">
                          🗣️ Pronunciation:
                        </span>
                        <span className="italic text-indigo-800 font-semibold">
                          {phoneticText}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-2xl sm:text-3xl font-bold text-slate-300 italic">
                    (Translation output will appear here)
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>📙 Classroom Vernacular</span>
                {speechError ? (
                  <span className="text-rose-600 font-bold">⚠️ {speechError}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Flashcard Sheet (Hidden on screen, rendered on window.print) */}
      <div className="print-only" aria-hidden="true">
        {/* Minimal Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Lingoduct Classroom Flashcard Set
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Bilingual pedagogy vocabulary flashcards • Cut along dashed guidelines
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800">
              {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {savedLessons.length} {savedLessons.length === 1 ? 'card' : 'cards'}
            </p>
          </div>
        </div>

        {/* 2-Column Flashcard Grid */}
        <div className="flashcard-sheet-grid">
          {savedLessons.map((item, idx) => {
            const srcLang = LANGUAGES.find((l) => l.code === item.sourceLang)
            const tgtLang = LANGUAGES.find((l) => l.code === item.lang)
            return (
              <div key={item.id || idx} className="flashcard-printable-card">
                {/* Top Half: Source */}
                <div className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 border border-blue-400 bg-blue-50 px-2 py-0.5 rounded">
                      📘 {srcLang?.label || item.sourceLang || 'Source'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Card #{idx + 1}</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 leading-snug">
                    {item.english}
                  </p>
                </div>

                {/* Dashed Fold / Cut Line */}
                <div className="relative my-2 border-t-2 border-dashed border-slate-300">
                  <span className="absolute right-0 -top-2.5 bg-white pl-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    ✂ fold or cut
                  </span>
                </div>

                {/* Bottom Half: Translated Target */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 border border-amber-400 bg-amber-50 px-2 py-0.5 rounded">
                      📙 {tgtLang?.label || item.lang || 'Target'}
                    </span>
                  </div>
                  <p className="text-base font-bold text-slate-900 leading-snug">
                    {item.translated}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default App
