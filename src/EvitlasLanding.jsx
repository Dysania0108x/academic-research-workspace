import React from 'react';
import './evitlas-landing.css';

export function EvitlasMark({size=34}) {
  return <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <path d="M12 40C13 23 26 14 43 15C56 16 66 25 67 38C67 52 56 65 42 66C27 67 12 57 12 40Z" fill="#C3D0B8"/>
    <path d="M19 47C17 34 27 22 41 20C55 18 67 27 68 40C69 55 58 66 44 65C32 64 21 58 19 47Z" fill="#E9B9A3" fillOpacity=".82"/>
    <path d="M18 41C24 29 37 25 49 30C61 35 63 49 55 58C45 68 27 61 21 51C19 48 18 44 18 41Z" fill="#7FB7AE" fillOpacity=".95"/>
  </svg>;
}
function PaperArt(){
  return <div className="ev-hero-art" aria-hidden="true">
    <div className="ev-paper ev-paper-left"><span className="ev-paper-tag">RESEARCH / 01</span><div className="ev-art-lines"><i/><i/><i/></div><div className="ev-art-wave"/></div>
    <div className="ev-paper ev-paper-right"><span className="ev-paper-tag">EVIDENCE / 03</span><div className="ev-art-map"><span/><span/><span/></div><div className="ev-art-lines"><i/><i/></div></div>
    <div className="ev-paper ev-paper-main"><span className="ev-paper-tag">EVITLAS JOURNAL · 2026</span><div className="ev-paper-eyebrow">THE ART OF RESEARCH</div><div className="ev-paper-heading">Ideas become<br/><em>clearer together.</em></div><div className="ev-art-rule"/><div className="ev-art-paragraph"><i/><i/><i/><i/></div><div className="ev-art-highlight"/><div className="ev-paper-foot">01 — EVIDENCE ATLAS</div></div>
  </div>;
}
export default function EvitlasLanding({onEnter}){
  return <div className="ev-landing">
    <header className="ev-header"><a className="ev-wordmark" href="/" onClick={e=>e.preventDefault()}><EvitlasMark size={34}/><span>evitlas</span></a><nav aria-label="Landing navigation"><a href="#about">About</a><a href="#approach">Our approach</a></nav><button type="button" className="ev-top-cta" onClick={onEnter}>Sign in <span aria-hidden="true">↗</span></button></header>
    <main><section className="ev-hero"><div className="ev-hero-kicker">A QUIETER WAY TO RESEARCH <span>✳</span> EVIDENCE ATLAS</div><PaperArt/><h1>Where evidence <em>becomes insight.</em></h1><p>Read thoughtfully. Find what matters. Connect the ideas worth keeping.</p><button type="button" className="ev-main-cta" onClick={onEnter}>Enter your workspace <span aria-hidden="true">↗</span></button><span className="ev-hero-caption">A considered space for curious minds.</span></section>
    <section id="about" className="ev-about"><div><span className="ev-section-label">01 / A BETTER RESEARCH FLOW</span><h2>Less searching.<br/><em>More understanding.</em></h2></div><p>From papers to passages, from passages to perspectives. Evitlas helps you trace evidence back to its source and build a clearer picture of your research.</p></section>
    <section id="approach" className="ev-features">{[['01','Read','Explore original papers in a focused reading space.'],['02','Trace','Keep meaningful passages connected to their sources.'],['03','Connect','Build an atlas of ideas across your research.']].map(([n,title,desc])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{desc}</p></article>)}</section></main>
    <footer className="ev-footer"><span>evitlas <small>Evidence Atlas</small></span><span>Made for thoughtful research.</span></footer>
  </div>;
}
export function EvitlasAuth({mode,setMode,email,setEmail,password,setPassword,busy,error,notice,onSubmit,onBack}){
  return <div className="ev-auth-page"><div className="ev-auth-left"><button className="ev-auth-back" type="button" onClick={onBack}>← Back to Evitlas</button><div className="ev-auth-editorial"><EvitlasMark size={70}/><div className="ev-auth-quote">A space for ideas<br/>to <em>find their place.</em></div><p>From reading to reasoning, one connection at a time.</p></div><div className="ev-auth-left-foot">EVITLAS / EVIDENCE ATLAS</div></div>
  <div className="ev-auth-right"><form className="ev-auth-form" onSubmit={onSubmit}><span className="ev-section-label">YOUR RESEARCH SPACE</span><h1>{mode==='signin'?'Welcome back.':'Begin your atlas.'}</h1><p>{mode==='signin'?'Sign in to pick up where your ideas left off.':'Create a space for your papers, evidence and insights.'}</p><label htmlFor="ev-email">Email address</label><input id="ev-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label htmlFor="ev-password">Password</label><input id="ev-password" type="password" autoComplete={mode==='signin'?'current-password':'new-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/>{error&&<div className="ev-form-error" role="alert">{error}</div>}{notice&&<div className="ev-form-notice" role="status">{notice}</div>}<button className="ev-auth-submit" disabled={busy} type="submit">{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'} <span aria-hidden="true">↗</span></button><div className="ev-auth-switch">{mode==='signin'?'New to Evitlas?':'Already have an account?'} <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create an account':'Sign in'}</button></div></form></div></div>;
}
