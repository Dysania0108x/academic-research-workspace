import React, {useEffect,useState} from 'react';
import './evitlas.css';
const scenes=[
 {caption:'Explore the literature',color:'#1B5B92',image:'/evitlas/01.svg'},
 {caption:'Trace the evidence',color:'#D7783C',image:'/evitlas/02.svg'},
 {caption:'Connect the insights',color:'#427B83',image:'/evitlas/03.svg'}
];
export function EvitlasMark({onClick}){return <button className="ev-brand" type="button" onClick={onClick} aria-label="Evitlas home"><span className="ev-symbol"><i/><i/><i/></span><span>evitlas</span></button>}
export function EvitlasLanding({onEnter}) {
 const [active,setActive]=useState(0);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const id=window.setInterval(()=>setActive(i=>(i+1)%3),5000);return()=>window.clearInterval(id)},[]);
 return <div className="ev-root ev-landing">
  <header className="ev-nav"><EvitlasMark onClick={()=>setActive(0)}/><button type="button" className="ev-enter" onClick={onEnter}>Enter Evitlas <span aria-hidden="true">↗</span></button></header>
  <div className="ev-glow ev-glow-one"/><div className="ev-glow ev-glow-two"/><div className="ev-glow ev-glow-three"/>
  <main className="ev-hero"><div className="ev-headline"><div className="ev-eyebrow"><span className="ev-eyebrow-line"/> FOR NUS POSTGRADUATE RESEARCHERS</div><h1>Make sense <span className="ev-headline-second">of <em>more</em><b>.</b></span></h1><p className="ev-hero-subtitle">A thoughtful space to explore literature, trace evidence and connect ideas.</p></div>
   <div className="ev-story" aria-label="Research journey">{scenes.map((scene,i)=><div key={scene.caption} className={'ev-scene '+(active===i?'is-active':'')} aria-hidden={active!==i}><img src={scene.image} alt="" /></div>)}
   <div className="ev-caption" style={{color:scenes[active].color}} aria-live="polite">{scenes[active].caption}</div>
   <div className="ev-progress" aria-label="Choose research scene">{scenes.map((scene,i)=><button key={scene.caption} type="button" aria-label={scene.caption} aria-current={active===i?'step':undefined} onClick={()=>setActive(i)}><i style={{background:active===i?scene.color:undefined}}/></button>)}</div>
   </div></main>
 </div>
}
export function EvitlasAuth({mode,setMode,email,setEmail,password,setPassword,busy,error,notice,onSubmit,onBack}){
 return <div className="ev-root ev-auth">
  <section className="ev-auth-left"><EvitlasMark onClick={onBack}/><div className="ev-auth-illustration"><img src="/evitlas/04.svg" alt="Hand-drawn researcher sitting with a laptop"/><p>For curious minds, grounded in evidence.</p></div></section>
  <section className="ev-auth-right"><form className="ev-form" onSubmit={onSubmit}><div className="ev-auth-eyebrow">A RESEARCH SPACE FOR NUS POSTGRADUATES</div><h2>{mode==='signin'?'Welcome back.':'Create your space.'}</h2><p className="ev-intro">{mode==='signin'?'Pick up where your ideas left off.':'Start connecting what matters.'}</p>
  <label htmlFor="ev-email">Email address</label><input id="ev-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
  <label htmlFor="ev-password">Password</label><input id="ev-password" type="password" minLength={6} required autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/>
  {error&&<p className="ev-error" role="alert">{error}</p>}{notice&&<p className="ev-notice" role="status">{notice}</p>}
  <button className="ev-submit" disabled={busy} type="submit"><span>{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</span><span aria-hidden="true">→</span></button>
  <p className="ev-switch">{mode==='signin'?'New to Evitlas?':'Already have an account?'} <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create an account':'Sign in'}</button></p>
  </form></section>
 </div>
}
