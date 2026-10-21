import React from 'react';
import './evitlas-landing.css';

export function EvitlasMark({size=34}) {
  return <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <path d="M12 40C13 23 26 14 43 15C56 16 66 25 67 38C67 52 56 65 42 66C27 67 12 57 12 40Z" fill="#C3D0B8"/>
    <path d="M19 47C17 34 27 22 41 20C55 18 67 27 68 40C69 55 58 66 44 65C32 64 21 58 19 47Z" fill="#E9B9A3" fillOpacity=".82"/>
    <path d="M18 41C24 29 37 25 49 30C61 35 63 49 55 58C45 68 27 61 21 51C19 48 18 44 18 41Z" fill="#7FB7AE" fillOpacity=".95"/>
  </svg>;
}
function LivingAtlas(){
  const nodes=[{x:82,y:196,c:'#D8B7CB',label:'Source A'},{x:170,y:86,c:'#A8C7B9',label:'Finding'},{x:268,y:224,c:'#E7B99D',label:'Evidence'},{x:356,y:122,c:'#B7B5D7',label:'Insight'},{x:476,y:220,c:'#C9D6B9',label:'Theme'},{x:564,y:88,c:'#E6C7A7',label:'Source B'},{x:626,y:187,c:'#A8C7B9',label:'Synthesis'}];
  const edges=[[0,1],[0,2],[1,2],[1,3],[2,3],[2,4],[3,5],[3,6],[4,6],[5,6]];
  return <div className="ev-atlas" aria-label="Abstract evidence atlas illustration" role="img">
    <svg viewBox="0 0 710 315" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="evAtlasWash" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F1E5DB"/><stop offset=".55" stopColor="#E5E8DF"/><stop offset="1" stopColor="#EEE7F0"/></linearGradient></defs>
      <path d="M66 153C113 47 238 38 313 83S470 35 579 91S665 240 550 265S364 241 264 278S23 256 66 153Z" fill="url(#evAtlasWash)" opacity=".65"/>
      {edges.map(([a,b],i)=><path key={i} className="ev-atlas-link" style={{animationDelay:(i*.12)+'s'}} d={`M${nodes[a].x} ${nodes[a].y} Q${(nodes[a].x+nodes[b].x)/2} ${(nodes[a].y+nodes[b].y)/2-20} ${nodes[b].x} ${nodes[b].y}`} fill="none" stroke="#A8B1A8" strokeWidth="1.4" strokeOpacity=".65"/>)}
      {nodes.map((n,i)=><g key={i} className="ev-atlas-node" style={{animationDelay:(.35+i*.14)+'s'}}><circle cx={n.x} cy={n.y} r={i===3?19:12} fill="#F9F8F3" opacity=".9"/><circle cx={n.x} cy={n.y} r={i===3?11:7} fill={n.c}/><text x={n.x+17} y={n.y-18} fill="#8A8F87" fontSize="10" letterSpacing=".5">{n.label}</text></g>)}
      <g transform="translate(325 140)"><rect x="-75" y="-25" width="150" height="55" rx="12" fill="#FFFDF9" stroke="#E6E3DB"/><text x="0" y="-2" textAnchor="middle" fill="#59655D" fontSize="9" letterSpacing="2">EVITLAS</text><text x="0" y="15" textAnchor="middle" fill="#8A9187" fontSize="11">An atlas of ideas</text></g>
    </svg>
    <div className="ev-atlas-note">Every insight has a source. Every source has a story.</div>
  </div>;
}
export default function EvitlasLanding({onEnter}){
  return <div className="ev-landing">
    <header className="ev-header"><a className="ev-wordmark" href="/" onClick={e=>e.preventDefault()}><EvitlasMark size={34}/><span>evitlas</span></a><nav aria-label="Landing navigation"><a href="#about">About</a><a href="#approach">Our approach</a></nav><button type="button" className="ev-top-cta" onClick={onEnter}>Sign in</button></header>
    <main>
      <section className="ev-hero ev-hero-atlas"><div className="ev-hero-kicker">AN ATLAS FOR CURIOUS MINDS <span>·</span> EVIDENCE, IN CONTEXT</div><h1>Follow the evidence.<br/><em>Find your perspective.</em></h1><p>One considered space to read, question and connect what matters.</p><LivingAtlas/><button type="button" className="ev-main-cta" onClick={onEnter}>Start exploring <span aria-hidden="true">→</span></button><span className="ev-hero-caption">Thoughtful research begins with a clearer view.</span></section>
      <section id="about" className="ev-about ev-about-expanded"><div><span className="ev-section-label">01 / WHY EVITLAS</span><h2>Research is more than<br/><em>finding papers.</em></h2></div><div className="ev-about-copy"><p>Good research rarely follows a straight line. A question leads to a paper, a passage challenges an assumption, and a new connection changes how you see the whole picture.</p><p>Evitlas brings these moments together. Keep original sources close, make sense of meaningful passages, and build a research trail you can return to with confidence.</p><div className="ev-about-principle"><span>OUR PRINCIPLE</span><strong>Keep the evidence visible.<br/>Make the thinking yours.</strong></div></div></section>
      <section id="approach" className="ev-approach"><div className="ev-approach-head"><span className="ev-section-label">02 / OUR APPROACH</span><h2>From scattered reading<br/>to <em>connected understanding.</em></h2><p>A simple, source-grounded workflow that keeps you in control of your research.</p></div>
        <div className="ev-approach-steps">
          <article><span className="ev-step-index">01 / EXPLORE</span><div className="ev-step-art ev-step-read"><span className="ev-mini-page"><i/><i/><i/><i/></span><span className="ev-mini-page second"><i/><i/><i/></span></div><h3>Read with intention.</h3><p>Bring your research papers into one focused library. Discover passages related to your questions without losing the original context.</p></article>
          <article><span className="ev-step-index">02 / EXAMINE</span><div className="ev-step-art ev-step-trace"><span className="ev-quote-line"/><span className="ev-quote-line short"/><span className="ev-quote-line selected"/><span className="ev-quote-line"/></div><h3>Trace every claim.</h3><p>Review AI-suggested highlights, inspect their source passages, and decide which findings genuinely support your research.</p></article>
          <article><span className="ev-step-index">03 / CONNECT</span><div className="ev-step-art ev-step-connect"><svg viewBox="0 0 160 100" width="100%"><path d="M28 65L73 24L123 67L80 80L28 65M73 24L80 80" fill="none" stroke="#B8C3B8" strokeWidth="2"/><circle cx="28" cy="65" r="8" fill="#E8B79C"/><circle cx="73" cy="24" r="10" fill="#9CC6BA"/><circle cx="123" cy="67" r="8" fill="#C7B5D1"/><circle cx="80" cy="80" r="7" fill="#D5CEAC"/></svg></div><h3>See the bigger picture.</h3><p>Organise verified evidence into themes and relationships, building an evolving map of what you know—and what still needs exploring.</p></article>
        </div>
      </section>
      <section className="ev-final-cta"><span className="ev-section-label">YOUR NEXT IDEA STARTS HERE</span><h2>Make room for<br/><em>better questions.</em></h2><button type="button" onClick={onEnter}>Explore Evitlas <span aria-hidden="true">→</span></button></section>
    </main>
    <footer className="ev-footer"><span>evitlas <small>Evidence Atlas</small></span><span>Read · Trace · Connect</span></footer>
  </div>;
}
export function EvitlasAuth({mode,setMode,email,setEmail,password,setPassword,busy,error,notice,onSubmit,onBack}){
  return <div className="ev-auth-page"><div className="ev-auth-left"><button className="ev-auth-back" type="button" onClick={onBack}>← Back to Evitlas</button><div className="ev-auth-editorial"><EvitlasMark size={70}/><div className="ev-auth-quote">A space for ideas<br/>to <em>find their place.</em></div><p>From reading to reasoning, one connection at a time.</p></div><div className="ev-auth-left-foot">EVITLAS / EVIDENCE ATLAS</div></div>
  <div className="ev-auth-right"><form className="ev-auth-form" onSubmit={onSubmit}><span className="ev-section-label">YOUR RESEARCH SPACE</span><h1>{mode==='signin'?'Welcome back.':'Begin your atlas.'}</h1><p>{mode==='signin'?'Sign in to pick up where your ideas left off.':'Create a space for your papers, evidence and insights.'}</p><label htmlFor="ev-email">Email address</label><input id="ev-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label htmlFor="ev-password">Password</label><input id="ev-password" type="password" autoComplete={mode==='signin'?'current-password':'new-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/>{error&&<div className="ev-form-error" role="alert">{error}</div>}{notice&&<div className="ev-form-notice" role="status">{notice}</div>}<button className="ev-auth-submit" disabled={busy} type="submit">{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'} <span aria-hidden="true">↗</span></button><div className="ev-auth-switch">{mode==='signin'?'New to Evitlas?':'Already have an account?'} <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create an account':'Sign in'}</button></div></form></div></div>;
}
