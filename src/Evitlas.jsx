import React, {useEffect,useState} from 'react';
import './evitlas.css';
const scenes=[
 {caption:'Explore the literature',color:'#1B5B92',image:'/evitlas/01.svg'},
 {caption:'Trace the evidence',color:'#D7783C',image:'/evitlas/02.svg'},
 {caption:'Connect the insights',color:'#427B83',image:'/evitlas/03.svg'}
];
export function EvitlasMark({onClick}){return <button className="ev-brand" type="button" onClick={onClick} aria-label="NUS Scope home"><span className="ev-symbol"><i/><i/><i/></span><span>NUS Scope</span></button>}
export function EvitlasLanding({onEnter}) {
 const [active,setActive]=useState(0);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const id=window.setInterval(()=>setActive(i=>(i+1)%3),5000);return()=>window.clearInterval(id)},[]);
 return <div className="ev-root ev-landing">
  <header className="ev-nav"><EvitlasMark onClick={()=>setActive(0)}/><div className="ev-nav-right"><span className="ev-nav-note">AN EVIDENCE-LED RESEARCH SPACE</span><button type="button" className="ev-enter" onClick={onEnter}>Enter Workspace <svg className="ev-enter-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 19 19 5M7 5h12v12"/></svg></button></div></header>
  
  <main className="ev-hero"><div className="ev-headline"><div className="ev-eyebrow"><span className="ev-eyebrow-line"/> FOR NUS RESEARCHERS</div><h1>Make sense <span className="ev-headline-second">of <em className="ev-gradient-word">more</em><b>.</b></span></h1><p className="ev-hero-subtitle">Explore literature. Verify evidence. Connect ideas.</p></div>
   <div className="ev-story" aria-label="Research journey"><svg className="ev-story-backdrop" viewBox="0 0 700 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <path d="M114 94C176 30 298 48 382 74C465 99 489 59 568 95C657 136 657 219 622 287C586 359 656 414 607 490C555 573 437 557 365 548C271 536 223 593 138 545C52 496 73 401 53 325C30 236 46 163 114 94Z" fill="#DDEFF8"/>
    <path d="M438 89C500 49 604 84 641 155C670 209 637 268 596 304C558 337 518 349 470 326C418 301 390 246 398 195C403 149 408 113 438 89Z" fill="#B7DDEB"/>
    <path d="M115 394C160 357 230 366 263 413C298 460 275 524 224 545C171 569 104 552 82 499C65 460 81 422 115 394Z" fill="#FFE1BF"/>
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
