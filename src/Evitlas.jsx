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
  
  <main className="ev-v11-hero">
   <div className="ev-v11-heading"><div className="ev-v11-eyebrow"><span className="ev-eyebrow-line"/> FOR NUS RESEARCHERS</div><h1>Make sense of <em>more</em><b>.</b></h1></div>
   <div className="ev-v11-lower">
    <section className="ev-v11-visual" aria-label="Research journey">
     <div className="ev-editorial-carousel" aria-label="Research journey">
     <div className="ev-editorial-art-bg" aria-hidden="true"><svg viewBox="0 0 540 420" preserveAspectRatio="xMidYMid meet"><path d="M35 86C63 35 128 57 162 34C205 5 247 32 265 68C280 99 315 64 350 54C397 40 444 61 449 105C453 141 425 157 450 190C483 233 503 275 465 304C430 329 397 306 373 338C343 375 305 359 278 350C237 337 208 386 168 368C128 350 139 320 104 312C55 300 44 274 63 236C84 194 21 159 35 86Z" fill="#E2F1F8"/><path d="M353 55C388 26 440 36 459 69C477 99 448 123 458 148C468 172 443 192 411 175C383 160 375 134 349 129C322 123 325 77 353 55Z" fill="#C4E3EF"/><path d="M82 285C105 259 146 272 154 300C161 329 136 346 109 342C79 339 60 310 82 285Z" fill="#FFE6C8"/><path d="M42 258C125 105 315 72 467 212" fill="none" stroke="#8FB8CF" strokeWidth="1.2" strokeDasharray="4 8" opacity=".55"/></svg></div>
     {scenes.map((scene,i)=><div key={scene.caption} className={'ev-editorial-scene '+(active===i?'is-active':'')} aria-hidden={active!==i}><img src={scene.image} alt=""/></div>)}
    </div>
    <div className="ev-editorial-carousel-footer"><span className="ev-editorial-index">0{active+1} <span>/ 03</span></span><div className="ev-editorial-caption" aria-live="polite">{scenes[active].caption}</div><div className="ev-editorial-controls" aria-label="Choose research scene">{scenes.map((scene,i)=><button key={scene.caption} type="button" aria-label={scene.caption} aria-current={active===i?'step':undefined} onClick={()=>setActive(i)}><span/></button>)}</div></div>
   
    </section>
    <section className="ev-v11-message" aria-label="Explore verify connect">
     <div className="ev-v11-tiles">
      <div className="ev-v11-tile ev-v11-tile-explore">Explore<span>.</span></div>
      <div className="ev-v11-tile ev-v11-tile-verify">Verify<span>.</span></div>
      <div className="ev-v11-tile ev-v11-tile-connect">Connect <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 19 19 5M7 5h12v12"/></svg></div>
     </div>
     <button type="button" className="ev-hero-start ev-split-button ev-v11-start" onClick={onSignUp}><span className="ev-split-label">Start exploring</span><span className="ev-split-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg></span></button>
    </section>
   </div>
  </main>
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
