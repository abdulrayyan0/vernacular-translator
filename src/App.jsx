import { useEffect, useRef, useState } from 'react'

function stopAudio(audio) {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

function App() {
  const [englishText, setEnglishText] = useState('')
  const [hindiText, setHindiText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [hindiHasError, setHindiHasError] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const audioRef = useRef(null)

  useEffect(() => {
    return () => {
      stopAudio(audioRef.current)
      audioRef.current = null
    }
  }, [])

  async function handleTranslate() {
    const lesson = englishText.trim()
    if (!lesson) {
      setHindiHasError(true)
      setHindiText('Please enter an English lesson first.')
      return
    }

    setHindiHasError(false)
    setSpeechError('')
    setIsTranslating(true)
    stopAudio(audioRef.current)
    audioRef.current = null
    setIsSpeaking(false)

    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(lesson)}&langpair=en|hi`,
      )

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const data = await response.json()
      const translated = data?.responseData?.translatedText?.trim()

      if (!translated) {
        throw new Error('No translation returned')
      }

      setHindiHasError(false)
      setHindiText(translated)
    } catch {
      setHindiHasError(true)
      setHindiText('Translation could not be completed. Please try again.')
    } finally {
      setIsTranslating(false)
    }
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

    const audioUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=hi&q=${encodeURIComponent(lesson)}`
    console.log('[Read Aloud] Audio URL being requested:', audioUrl)

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.addEventListener('playing', () => {
      console.log('[Read Aloud] Playback successfully started')
      setIsSpeaking(true)
    })

    audio.addEventListener('ended', () => {
      setIsSpeaking(false)
      audioRef.current = null
    })

    audio.addEventListener('error', (event) => {
      console.error('[Read Aloud] Network or playback error:', audio.error, event)
      setIsSpeaking(false)
      audioRef.current = null
      setSpeechError('Could not play the Hindi audio.')
    })

    try {
      await audio.play()
    } catch (error) {
      console.error('[Read Aloud] Network or playback error:', error)
      setIsSpeaking(false)
      audioRef.current = null
      setSpeechError('Could not play the Hindi audio.')
    }
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
          Write a lesson in English, then translate it into Hindi for young
          learners in the classroom.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex min-h-[22rem] flex-col rounded-3xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/80">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">English</h2>
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
              <h2 className="text-lg font-semibold text-slate-900">हिन्दी</h2>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                Read only
              </span>
            </div>
            <label htmlFor="hindi-lesson" className="sr-only">
              Hindi translation
            </label>
            <textarea
              id="hindi-lesson"
              value={hindiText}
              readOnly
              placeholder="Hindi translation will appear here."
              className={`min-h-[16rem] flex-1 resize-none rounded-2xl border bg-amber-50/40 p-4 text-base leading-relaxed outline-none placeholder:text-slate-400 ${
                hindiHasError
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
              {speechError ? (
                <p className="text-sm text-rose-600" role="alert">
                  {speechError}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-8">
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
        </div>
      </main>
    </div>
  )
}

export default App
