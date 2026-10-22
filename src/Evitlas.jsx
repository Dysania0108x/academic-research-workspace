import React, {useEffect,useState} from 'react';
import './evitlas.css';
const scenes=[
 {caption:'Explore the literature',color:'#1B5B92',image:'/evitlas/01.svg'},
 {caption:'Trace the evidence',color:'#D7783C',image:'/evitlas/02.svg'},
 {caption:'Connect the insights',color:'#427B83',image:'/evitlas/03.svg'}
];
export function EvitlasMark({onClick}){return <button className="ev-brand" type="button" onClick={onClick} aria-label="NUS Scope home"><span className="ev-symbol"><i/><i/><i/></span><span>NUS Scope</span></button>}
export function EvitlasLanding({onSignIn,onSignUp}) {
 const [active,setActive]=useState(0);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const id=window.setInterval(()=>setActive(i=>(i+1)%3),5000);return()=>window.clearInterval(id)},[]);
 return <div className="ev-root ev-landing">
  <header className="ev-nav"><EvitlasMark onClick={()=>setActive(0)}/><div className="ev-nav-right"><button type="button" className="ev-nav-signin" onClick={onSignIn}>Sign in</button><button type="button" className="ev-nav-signup ev-split-button" onClick={onSignUp}><span className="ev-split-label">Sign up</span><span className="ev-split-icon"><svg className="ev-enter-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 19 19 5M7 5h12v12"/></svg></span></button></div></header>
  
  <main className="ev-hero"><div className="ev-headline"><div className="ev-eyebrow"><span className="ev-eyebrow-line"/> FOR NUS RESEARCHERS</div><h1>Make sense <span className="ev-headline-second">of <em >more</em><b>.</b></span></h1><button type="button" className="ev-hero-start ev-split-button" onClick={onSignUp}><span className="ev-split-label">Start exploring</span><span className="ev-split-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg></span></button></div>
   <div className="ev-story" aria-label="Research journey"><svg className="ev-story-backdrop" viewBox="0 0 700 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <path d="M103 125C126 77 193 51 250 77C298 99 321 109 356 85C397 56 450 58 472 104C492 146 512 154 557 139C607 123 647 153 632 201C620 242 584 263 604 306C628 359 648 388 616 425C585 461 532 448 511 482C480 528 432 515 396 500C356 482 332 488 289 520C249 550 194 536 178 492C164 454 138 439 99 449C56 461 37 415 60 378C83 343 101 327 78 284C50 234 67 169 103 125Z" fill="#DDEFF8"/>
    <path d="M438 89C500 49 604 84 641 155C670 209 637 268 596 304C558 337 518 349 470 326C418 301 390 246 398 195C403 149 408 113 438 89Z" fill="#B7DDEB"/>
    <path d="M521 110C550 80 605 90 617 127C627 159 601 173 609 196C617 221 596 240 564 227C535 215 534 187 511 180C484 171 493 135 521 110Z" fill="#FFE1BF"/>
    <g fill="none" stroke="#6D9BB9" strokeWidth="1.5" opacity=".39">
      <ellipse cx="348" cy="318" rx="278" ry="185" transform="rotate(-21 348 318)"/>
      <ellipse cx="349" cy="313" rx="269" ry="198" transform="rotate(24 349 313)"/>
    </g>
   </svg>{scenes.map((scene,i)=><div key={scene.caption} className={'ev-scene '+(active===i?'is-active':'')} aria-hidden={active!==i}><img src={scene.image} alt="" /></div>)}
   <div className="ev-caption" style={{color:scenes[active].color}} aria-live="polite">{scenes[active].caption}</div>
   <div className="ev-progress" aria-label="Choose research scene">{scenes.map((scene,i)=><button key={scene.caption} type="button" aria-label={scene.caption} aria-current={active===i?'step':undefined} onClick={()=>setActive(i)}><i style={{background:active===i?scene.color:undefined}}/></button>)}</div>
   </div></main>
 </div>
}
export function EvitlasAuth({mode,setMode,email,setEmail,password,setPassword,busy,error,notice,onSubmit,onBack}){
 return <div className="ev-root ev-auth">
  <section className="ev-auth-left"><EvitlasMark onClick={onBack}/><div className="ev-auth-art-panel"><span className="ev-auth-panel-tag">READ · VERIFY · CONNECT</span><div className="ev-auth-illustration"><img src="/evitlas/04.svg" alt="Hand-drawn researcher sitting with a laptop"/><p>For curious minds, grounded in evidence.</p></div></div><div className="ev-auth-panel-footer"><span>DESIGNED FOR RESEARCH</span><span className="ev-auth-panel-dash"/></div></section>
  <section className="ev-auth-right"><form className="ev-form" onSubmit={onSubmit}><div className="ev-auth-eyebrow">FOR NUS RESEARCHERS</div><h2>{mode==='signin'?'Welcome back.':'Create your space.'}</h2><p className="ev-intro">{mode==='signin'?'Pick up where your ideas left off.':'Start connecting what matters.'}</p>
  <label htmlFor="ev-email">Email address</label><input id="ev-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
  <label htmlFor="ev-password">Password</label><input id="ev-password" type="password" minLength={6} required autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/>
  {error&&<p className="ev-error" role="alert">{error}</p>}{notice&&<p className="ev-notice" role="status">{notice}</p>}
  <button className="ev-submit" disabled={busy} type="submit"><span>{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</span><span aria-hidden="true">→</span></button>
  <p className="ev-switch">{mode==='signin'?'New to NUS Scope?':'Already have an account?'} <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create an account':'Sign in'}</button></p>
  </form></section>
 </div>
}
