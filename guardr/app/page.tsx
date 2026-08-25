export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.24),_transparent_32%),linear-gradient(180deg,_#09090b_0%,_#030712_100%)] px-6 py-10 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-between gap-10 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-fuchsia-950/30 backdrop-blur xl:p-10">
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-1 text-sm font-medium text-fuchsia-200">
              2FA for your heart
            </span>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                Guardr catches fake romantic personas before they waste anyone&apos;s
                time.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/72">
                A polished first impression for a platform built to verify
                profiles, surface risks, and keep the drama where it belongs:
                on stage.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                className="inline-flex h-12 items-center justify-center rounded-full bg-fuchsia-500 px-6 font-semibold text-white transition hover:bg-fuchsia-400"
                href="#preview"
              >
                View the debut
              </a>
              <a
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 font-semibold text-white/85 transition hover:bg-white/8"
                href="mailto:hello@guardr.app"
              >
                Contact the team
              </a>
            </div>
          </div>

          <aside
            id="preview"
            className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-black/30"
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-medium text-white/60">Risk snapshot</p>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                Safer
              </span>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/55">Identity consistency</p>
                <p className="mt-2 text-2xl font-semibold text-white">Strong</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/55">Breach exposure</p>
                <p className="mt-2 text-2xl font-semibold text-white">Low</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/55">Persona signals</p>
                <p className="mt-2 text-2xl font-semibold text-white">Verified</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            [
              "Profile checks",
              "Spot suspicious inconsistencies, reused images, and mismatched details.",
            ],
            [
              "Risk scoring",
              "Translate noisy signals into a clear safety read before a bad date happens.",
            ],
            [
              "Fast decisions",
              "Give users the confidence to keep moving, or to walk away early.",
            ],
          ].map(([title, copy]) => (
            <article
              key={title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/68">{copy}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
