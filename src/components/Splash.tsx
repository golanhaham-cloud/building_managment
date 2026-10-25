// Branded first-load screen. Server-rendered into the very first HTML chunk, so it paints as soon as the browser gets
// anything from the server (nothing can paint before the server's first byte). It is hidden by the tiny inline script
// below - which does not depend on the JS bundles - the moment the real page content is in place (no skeleton left in <main>).
// It is hidden with an attribute (never removed) so React hydration is unaffected, and it only exists in the root layout,
// so client-side navigations never show it again (they keep the existing progress bar and loading skeletons).

const SCRIPT = `(function(){var s=document.querySelector('[data-splash]');if(!s)return;var done=false,t1,t2,o;
function ready(){var m=document.querySelector('main');return !!m&&m.childNodes.length>0&&!m.querySelector('[data-skeleton]');}
function hide(){if(done)return;done=true;s.setAttribute('data-state','done');if(o)o.disconnect();clearTimeout(t1);clearTimeout(t2);}
function check(){if(ready())hide();}
try{o=new MutationObserver(check);o.observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
document.addEventListener('DOMContentLoaded',check);window.addEventListener('load',check);
t1=setTimeout(function(){if(!done)s.setAttribute('data-state','slow');},8000);
t2=setTimeout(function(){if(!done)s.setAttribute('data-state','failed');},25000);
var b=s.querySelector('[data-retry]');if(b)b.addEventListener('click',function(){location.reload();});
check();})();`;

export default function Splash() {
  return (
    <>
      <div
        data-splash=""
        data-state="loading"
        suppressHydrationWarning
        role="status"
        aria-live="polite"
        className="splash fixed inset-0 z-[70] flex flex-col items-center justify-center bg-brand-50 px-6 text-center"
      >
        <svg
          width="112"
          height="132"
          viewBox="0 0 112 132"
          fill="none"
          stroke="#316d63"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
          className="mb-6"
        >
          <path d="M16 126V22a4 4 0 0 1 4-4h72a4 4 0 0 1 4 4v104" />
          <path d="M8 126h96" />
          <path d="M16 34h80" strokeOpacity=".45" />
          {[0, 1, 2, 3, 4].map((r) =>
            [0, 1, 2].map((c) => (
              <rect key={`${r}-${c}`} x={30 + c * 22} y={44 + r * 15} width="11" height="9" rx="1.5" strokeOpacity={r === 4 ? 0 : 0.85} />
            ))
          )}
          <path d="M46 126v-16a10 10 0 0 1 20 0v16" />
          <path d="M44 8h24" strokeOpacity=".6" />
          <path d="M56 8v10" strokeOpacity=".6" />
        </svg>
        <h1 className="text-3xl font-extrabold text-brand-700 tracking-wide">ליבנה 6</h1>
        <p className="mt-1 text-lg font-semibold text-brand-600">הבניין שלי</p>

        <div className="mt-8 min-h-[7.5rem] flex flex-col items-center gap-3 max-w-xs">
          <span className="splash-spin inline-block h-6 w-6 rounded-full border-[3px] border-brand-200 border-t-brand-600" aria-hidden="true" />
          <p className="splash-msg splash-loading text-sm text-brand-700">טוען…</p>
          <p className="splash-msg splash-slow text-sm text-brand-700">הטעינה מתארכת מהרגיל. אפשר להמתין עוד קצת או לנסות שוב.</p>
          <p className="splash-msg splash-fail text-sm text-red-800 font-semibold">לא הצלחנו לטעון את האתר. בדוק/י את החיבור ונסה/י שוב.</p>
          <button type="button" data-retry="" className="splash-retry min-h-[44px] rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white">
            ניסיון חוזר
          </button>
        </div>
      </div>
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <noscript>
        <style>{`[data-splash]{display:none !important}`}</style>
      </noscript>
    </>
  );
}
