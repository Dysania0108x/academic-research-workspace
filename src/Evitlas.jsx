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
  
  <svg className="ev-midnight-grain" aria-hidden="true" focusable="false"><filter id="ev-fine-grain"><feTurbulence type="fractalNoise" baseFrequency=".94" numOctaves="2" seed="9" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#ev-fine-grain)"/></svg>
  <main className="ev-midnight-hero">
   <section className="ev-midnight-copy">
    <h1>Make sense <span>of <em>more</em><b>.</b></span></h1>
    <button type="button" className="ev-midnight-cta" onClick={onSignUp}><span>Start exploring</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg></button>
   </section>
   <section className="ev-midnight-art" aria-label="Research journey">
    <div className="ev-midnight-paper-stage">
     {scenes.map((scene,i)=><div key={scene.caption} className={'ev-midnight-scene '+(active===i?'is-active':'')} aria-hidden={active!==i}><img src={scene.image} alt=""/></div>)}
     <div className="ev-midnight-tag ev-midnight-tag-explore">Explore</div>
     <div className="ev-midnight-tag ev-midnight-tag-verify">Verify</div>
     <div className="ev-midnight-tag ev-midnight-tag-connect">Connect</div>
    </div>
    <div className="ev-midnight-carousel-footer"><span aria-live="polite">{scenes[active].caption}</span><div className="ev-midnight-dots" aria-label="Choose research scene">{scenes.map((scene,i)=><button key={scene.caption} type="button" aria-label={scene.caption} aria-current={active===i?'step':undefined} onClick={()=>setActive(i)}><i/></button>)}</div></div>
   </section>
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
