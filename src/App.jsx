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
  const [savedLessons, setSavedLessons] = useState(() => {
    try {
      const stored = localStorage.getItem('lingoduct_saved_lessons')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [showSaved, setShowSaved] = useState(false)
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
      return
    }

    setOutputHasError(false)
    setSpeechError('')
    setIsTranslating(true)
    resetPlayback()

    try {
      // Primary: Google gtx endpoint
      try {
        const gtxResponse = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`,
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

        setOutputText(translated)
        return
      } catch (gtxError) {
        // Fallback: MyMemory API
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

  const isAlreadySaved = savedLessons.some(
    (item) => item.english === inputText.trim() && item.lang === targetLang && item.sourceLang === sourceLang,
  )

  return (
    <div className="classroom-canvas min-h-svh text-slate-800 flex flex-col font-sans">
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
          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Smartboard Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Educator Workspace */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Interactive Lesson Translator & Speech Studio
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Translate teaching prompts into regional vernaculars with crystal-clear audio pronunciation.
            </p>
          </div>
        </div>

        {/* Dual-Column Translation Cards */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] items-stretch">
          {/* Source Lesson Card */}
          <section className="flex min-h-[24rem] flex-col rounded-3xl border border-slate-200/80 border-t-4 border-t-blue-500 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            {/* Source Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="relative inline-flex items-center">
                  <span className="absolute left-3 text-xs pointer-events-none" aria-hidden="true">
                    🌐
                  </span>
                  <select
                    value={sourceLang}
                    onChange={handleSourceLangChange}
                    className="custom-select custom-select-source pl-7 pr-8 font-bold text-sm shadow-xs"
                    aria-label="Source Language"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
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

              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/80 px-3 py-1 text-xs font-bold text-blue-700">
                <span>📘</span> Source
              </span>
            </div>

            <label htmlFor="source-lesson" className="sr-only">
              {activeSourceLang.label} lesson
            </label>
            <textarea
              id="source-lesson"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="relative inline-flex items-center">
                  <span className="absolute left-3 text-xs pointer-events-none" aria-hidden="true">
                    🌐
                  </span>
                  <select
                    value={targetLang}
                    onChange={handleTargetLangChange}
                    className="custom-select custom-select-target pl-7 pr-8 font-bold text-sm shadow-xs"
                    aria-label="Target Vernacular Language"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-3 py-1 text-xs font-bold text-amber-800">
                <span>📙</span> Target Vernacular
              </span>
            </div>

            <label htmlFor="translated-lesson" className="sr-only">
              {activeTargetLang.label} translation
            </label>
            <textarea
              id="translated-lesson"
              value={outputText}
              readOnly
              placeholder={`${activeTargetLang.label} translation will appear here.`}
              className={`classroom-textarea min-h-[17rem] flex-1 resize-none rounded-2xl border p-4 leading-relaxed outline-none transition placeholder:text-slate-400 ${
                outputHasError
                  ? 'border-rose-300 bg-rose-50/40 text-rose-700'
                  : 'border-slate-200/90 bg-amber-50/20 text-slate-800'
              }`}
            />

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
          <button
            type="button"
            onClick={() => setShowSaved((prev) => !prev)}
            className="tactile-btn w-full flex items-center justify-between text-left p-1 text-slate-800 hover:text-blue-700 transition-colors"
          >
            <div className="flex items-center gap-2.5 text-base font-extrabold">
              <span className="text-xl">📚</span>
              <span>Saved Classroom Vocabulary</span>
              <span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-black">
                {savedLessons.length}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors">
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
  )
}

export default App
