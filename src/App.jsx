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
  { code: 'hi', speechTag: 'hi-IN', label: 'हिन्दी' },
  { code: 'te', speechTag: 'te-IN', label: 'తెలుగు' },
  { code: 'ta', speechTag: 'ta-IN', label: 'தமிழ்' },
  { code: 'mr', speechTag: 'mr-IN', label: 'मराठी' },
]

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

function App() {
  const [englishText, setEnglishText] = useState('')
  const [hindiText, setHindiText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [hindiHasError, setHindiHasError] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [isCopied, setIsCopied] = useState(false)
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

  const activeLang = LANGUAGES.find((l) => l.code === targetLang) || LANGUAGES[0]

  function handleLangChange(event) {
    setTargetLang(event.target.value)
    setHindiText('')
    setHindiHasError(false)
    setSpeechError('')
    setIsCopied(false)
    stopAudio(audioRef.current)
    audioRef.current = null
    setIsSpeaking(false)
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
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setEnglishText((prev) => (prev ? prev + ' ' + transcript : transcript))
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
    const trimmed = englishText.trim()
    if (!trimmed) return

    setHindiHasError(false)
    setSpeechError('')
    setIsTranslating(true)
    stopAudio(audioRef.current)
    setIsSpeaking(false)

    try {
      // Primary: Google gtx endpoint
      try {
        const gtxResponse = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`,
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

        setHindiText(translated)
        return
      } catch (gtxError) {
        // Fallback: MyMemory API
        const mmResponse = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|${targetLang}`,
        )

        if (!mmResponse.ok) {
          throw new Error('MyMemory request failed')
        }

        const mmData = await mmResponse.json()
        const translated = mmData?.responseData?.translatedText?.trim()

        if (!translated) {
          throw new Error('No translation returned from MyMemory')
        }

        setHindiText(translated)
      }
    } catch {
      setHindiHasError(true)
      setHindiText('Translation could not be completed. Please try again.')
    } finally {
      setIsTranslating(false)
    }
  }

  function speakWithSynthesis(text) {
    if (!window.speechSynthesis) {
      setSpeechError('Speech synthesis is not supported in this browser.')
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = activeLang.speechTag
    utterance.rate = playbackRate

    const voices = window.speechSynthesis.getVoices()
    const matchedVoice = voices.find((v) => v.lang.startsWith(activeLang.code))
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

  async function handleReadAloud() {
    const lesson = hindiText.trim()

    if (hindiHasError || !lesson) {
      setSpeechError('Translate a lesson first, then try Read Aloud.')
      return
    }

    if (audioRef.current && !audioRef.current.paused) {
      stopAudio(audioRef.current)
      audioRef.current = null
      setIsSpeaking(false)
      return
    }

    stopAudio(audioRef.current)
    audioRef.current = null
    setSpeechError('')
    setIsSpeaking(false)

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
      speakWithSynthesis(lesson)
    })

    try {
      await audio.play()
    } catch {
      // Network / CORS / decode failure — fall back to native speech synthesis
      audioRef.current = null
      speakWithSynthesis(lesson)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hindiText)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setSpeechError('Failed to copy text.')
    }
  }

  function handleClear() {
    setEnglishText('')
    setHindiText('')
    setHindiHasError(false)
    setSpeechError('')
    setIsCopied(false)
    stopAudio(audioRef.current)
    audioRef.current = null
    setIsSpeaking(false)
  }

  function handleSaveLesson() {
    const english = englishText.trim()
    const translated = hindiText.trim()
    if (!english || !translated || hindiHasError) return

    const alreadySaved = savedLessons.some(
      (item) => item.english === english && item.lang === targetLang,
    )
    if (alreadySaved) return

    setSavedLessons((prev) => [
      ...prev,
      { id: Date.now(), english, translated, lang: targetLang },
    ])
  }

  function handleLoadLesson(item) {
    setEnglishText(item.english)
    setHindiText(item.translated)
    setTargetLang(item.lang)
    setHindiHasError(false)
    setSpeechError('')
    setIsCopied(false)
    stopAudio(audioRef.current)
    audioRef.current = null
    setIsSpeaking(false)
  }

  function handleDeleteLesson(id) {
    setSavedLessons((prev) => prev.filter((item) => item.id !== id))
  }

  function handleClearAllSaved() {
    setSavedLessons([])
  }

  return (
    <div className="min-h-svh bg-gradient-to-br from-sky-50 via-white to-amber-50 text-slate-800">
      <header className="border-b border-sky-100/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-lg font-bold text-white shadow-sm">
            वा
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Primary classroom
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Vernacular Pedagogy Assistant
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="mb-8 max-w-2xl text-base leading-relaxed text-slate-600">
          Write a lesson in English, then translate it into a vernacular
          language for young learners in the classroom.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex min-h-[22rem] flex-col rounded-3xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/80">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">English</h2>
                <button
                  type="button"
                  onClick={handleMicToggle}
                  aria-pressed={isListening}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                    isListening
                      ? 'border-rose-200 bg-rose-50 text-rose-700 animate-pulse'
                      : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                  }`}
                >
                  <span aria-hidden="true">🎙️</span>
                  {isListening ? 'Listening…' : 'Dictate'}
                </button>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                Lesson input
              </span>
            </div>
            <label htmlFor="english-lesson" className="sr-only">
              English lesson
            </label>
            <textarea
              id="english-lesson"
              value={englishText}
              onChange={(event) => setEnglishText(event.target.value)}
              placeholder="Type your lesson here… for example: The sun rises in the east."
              className="min-h-[16rem] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-base leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </section>

          <section className="flex min-h-[22rem] flex-col rounded-3xl border border-amber-100 bg-white p-6 shadow-sm shadow-amber-100/80">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{activeLang.label}</h2>
                <select
                  value={targetLang}
                  onChange={handleLangChange}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                Read only
              </span>
            </div>
            <label htmlFor="translated-lesson" className="sr-only">
              {activeLang.label} translation
            </label>
            <textarea
              id="translated-lesson"
              value={hindiText}
              readOnly
              placeholder={`${activeLang.label} translation will appear here.`}
              className={`min-h-[16rem] flex-1 resize-none rounded-2xl border bg-amber-50/40 p-4 text-base leading-relaxed outline-none placeholder:text-slate-400 ${hindiHasError
                ? 'border-rose-200 text-rose-700'
                : 'border-slate-200 text-slate-800'
                }`}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleReadAloud}
                aria-pressed={isSpeaking}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100"
              >
                <span aria-hidden="true">🔊</span>
                {isSpeaking ? 'Stop reading' : 'Read Aloud'}
              </button>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                <option value={0.75}>0.75× Slow</option>
                <option value={1}>1× Normal</option>
                <option value={1.25}>1.25× Fast</option>
              </select>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!hindiText.trim() || hindiHasError}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">{isCopied ? '✓' : '📋'}</span>
                {isCopied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleSaveLesson}
                disabled={!hindiText.trim() || hindiHasError || savedLessons.some((item) => item.english === englishText.trim() && item.lang === targetLang)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">{savedLessons.some((item) => item.english === englishText.trim() && item.lang === targetLang) ? '✓' : '🔖'}</span>
                {savedLessons.some((item) => item.english === englishText.trim() && item.lang === targetLang) ? 'Saved' : 'Save'}
              </button>
              {speechError ? (
                <p className="text-sm text-rose-600" role="alert">
                  {speechError}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isTranslating}
            aria-busy={isTranslating}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-sky-200 transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-sky-400"
          >
            {isTranslating ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
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
                Translating…
              </>
            ) : (
              'Translate Lesson'
            )}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            Clear
          </button>
        </div>

        {/* Saved Classroom Vocabulary */}
        <div className="mt-10">
          <button
            type="button"
            onClick={() => setShowSaved((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
          >
            <span className="transition-transform" style={{ display: 'inline-block', transform: showSaved ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            Saved Classroom Vocabulary
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
              {savedLessons.length}
            </span>
          </button>

          {showSaved && (
            <div className="mt-4 space-y-3">
              {savedLessons.length === 0 ? (
                <p className="text-sm text-slate-400">No saved vocabulary yet. Translate a lesson and click Save.</p>
              ) : (
                <>
                  {savedLessons.map((item) => {
                    const lang = LANGUAGES.find((l) => l.code === item.lang)
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                      >
                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          {lang?.label || item.lang}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{item.english}</p>
                          <p className="mt-1 text-sm text-slate-500">{item.translated}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadLesson(item)}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(item.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={handleClearAllSaved}
                    className="mt-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                  >
                    Clear All Saved
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
