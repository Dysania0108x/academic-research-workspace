import React, {useEffect,useState} from 'react';
import './evitlas.css';

const scenes=[
 {caption:'Explore the literature',color:'#EF7C00',image:'/evitlas/01.svg'},
 {caption:'Trace the evidence',color:'#F7F2E9',image:'/evitlas/02.svg'},
 {caption:'Connect the insights',color:'#B8DDEB',image:'/evitlas/03.svg'}
];
const Mark=()=> <img className="ev-outline-mark" src="/nuscope-symbol.svg" alt="" aria-hidden="true"/>;
export function EvitlasMark({onClick}){return <button className="ev-brand" type="button" onClick={onClick} aria-label="NUScope home"><Mark/><span>NUScope</span></button>}
export function EvitlasLanding({onEnter,onSignIn,onSignUp}) {
 const [active,setActive]=useState(0);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const id=window.setInterval(()=>setActive(i=>(i+1)%3),4000);return()=>window.clearInterval(id)},[]);
 return <div className="ev-root ev-landing ev-midnight-v8">
  <header className="ev-nav"><EvitlasMark onClick={()=>setActive(0)}/><div className="ev-nav-actions"><button className="ev-nav-signin" type="button" onClick={onSignIn||onEnter}>Sign in</button><button className="ev-nav-signup" type="button" onClick={onSignUp||onEnter}>Sign up</button></div></header>
  <main className="ev-v8-hero"><section className="ev-v8-copy"><div className="ev-v8-title-group"><h1>Make sense <span>of <em>more</em><b>.</b></span></h1><button className="ev-v8-cta" type="button" onClick={onSignIn||onEnter}><span>Start exploring</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg></button></div></section>
  <section className="ev-v8-visual" aria-label="Research journey"><div className="ev-v8-stage">{scenes.map((scene,i)=><div className={'ev-v8-slide '+(active===i?'is-active':'')} key={scene.caption} aria-hidden={active!==i}><img src={scene.image} alt=""/><div className="ev-v8-caption" style={{color:scene.color}}><span>{scene.caption}</span></div></div>)}</div></section></main>
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
  <p className="ev-switch">{mode==='signin'?'New to NUScope?':'Already have an account? Sign in with your existing email and password.'} <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create an account':'Sign in'}</button></p>
  </form></section>
 </div>
}
