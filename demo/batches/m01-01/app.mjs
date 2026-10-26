import { createState, transition, resendRemaining, demoCode } from './model.mjs';
const app = document.querySelector('#app');
let state = createState();
const escapeText = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dispatch(event) { state = transition(state, event); render(); }
function top() { return `<div class="topnav"><p class="brand">fancy</p><button class="navbutton" data-action="CANCEL">Cancel</button></div>`; }
function error() { return `<p class="error" id="error" role="alert">${escapeText(state.error)}</p>`; }
function render() {
  const focused = document.activeElement?.id;
  const selection = document.activeElement?.selectionStart;
  let content = '';
  if (state.screen === 'welcome') {
    content = `<section class="screen welcome"><p class="brand">fancy</p><div class="meal-mark" aria-hidden="true"><i class="utensil"></i><div class="plate"></div><i class="utensil knife"></i></div><p class="eyebrow">THERE’S A SEAT FOR YOU HERE</p><h2>Fancy a bite?</h2><p>Meet new people over a meal.<br>A little conversation starts here.</p><div class="spacer"></div><button class="primary" data-action="START">Continue with email</button><button class="secondary" data-action="BROWSE">Explore tables first</button><p class="small">No need to sign in just to have a look.</p></section>`;
  } else if (state.screen === 'email') {
    content = `<section class="screen">${top()}<span class="badge">A seat starts with hello</span><h2>Your email.<br>Your way in.</h2><p>We’ll send a 6-digit code. No password to remember.</p>${state.origin === 'meal' ? '<p class="intent-note">Your meal will still be here after you sign in.</p>' : ''}<form id="email-form" novalidate><label class="field-label" for="email">Email address</label><input class="field" id="email" type="email" inputmode="email" autocomplete="off" placeholder="alex@example.test" value="${escapeText(state.email)}" aria-describedby="error" aria-invalid="${!!state.error}">${error()}<button class="primary" type="submit">Send code</button></form><div class="spacer"></div><p class="small">You can change your mind and keep exploring.</p></section>`;
  } else if (state.screen === 'code') {
    content = `<section class="screen">${top()}<span class="badge">One more little step</span><h2>Check your<br>inbox.</h2><p>Enter the code for<br><span class="email-note">${escapeText(state.email)}</span></p><button class="linkbutton" data-action="CHANGE_EMAIL">Use a different email</button><form id="code-form" novalidate><label class="field-label" for="code">6-digit code</label><input class="field code" id="code" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="000000" value="${escapeText(state.code)}" aria-describedby="error" aria-invalid="${!!state.error}">${error()}<button class="primary" type="submit">Verify email</button></form><div class="spacer"></div><button class="linkbutton" id="resend" data-action="RESEND" ${resendRemaining(state) > 0 ? 'disabled' : ''}>${resendLabel()}</button><p class="small">The code expires after 5 minutes. Only the latest code works.</p></section>`;
  } else if (state.screen === 'verified') {
    content = `<section class="screen"><p class="brand">fancy</p><div class="success-mark" aria-hidden="true">✓</div><h2>${state.profileComplete ? 'You’re signed in.' : 'Email verified.'}</h2><p>${state.profileComplete ? 'Pick up where you left off. Nothing has been submitted for you.' : 'Before joining or hosting, you’ll need to finish your public introduction.'}</p><div class="spacer"></div><button class="primary" data-action="CONTINUE">${state.profileComplete ? (state.origin === 'meal' ? 'Return to your meal' : 'Continue exploring') : 'See your next step'}</button><p class="small">Your next action is always yours to choose.</p></section>`;
  } else {
    const labels = { discover: ['Explore as you are.', 'Discover is the next destination.'], meal: ['Back to your meal.', 'The same meal is waiting. No application has been sent.'], profile: ['A little about you.', 'Your email is verified. Complete your profile before participating.'] };
    const [title, text] = labels[state.boundary] || labels.discover;
    content = `<section class="screen"><p class="brand">fancy</p><div class="spacer"></div><span class="badge">Preview boundary</span><h2>${title}</h2><p>${text}</p><div class="boundary"><p>${state.boundary === 'profile' ? 'Profile completion belongs to M01-04. This preview does not include the form.' : 'This preview stops at the handoff. Discover, meal details and applications are not included.'}</p></div><div class="spacer"></div><button class="secondary" data-action="RESTART">Restart this preview</button></section>`;
  }
  app.innerHTML = content;
  app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => button.dataset.action === 'RESTART' ? reset() : dispatch({ type: button.dataset.action })));
  const email = app.querySelector('#email');
  email?.addEventListener('input', e => { state = transition(state, {type:'EMAIL', value:e.target.value}); });
  app.querySelector('#email-form')?.addEventListener('submit', e => { e.preventDefault(); dispatch({type:'SEND'}); });
  const code = app.querySelector('#code');
  code?.addEventListener('input', e => { state = transition(state, {type:'CODE', value:e.target.value}); e.target.value = state.code; });
  app.querySelector('#code-form')?.addEventListener('submit', e => { e.preventDefault(); dispatch({type:'VERIFY'}); });
  const previous = focused ? document.getElementById(focused) : null;
  if (previous) { previous.focus(); if (typeof selection === 'number' && previous.type !== 'email') previous.setSelectionRange?.(selection, selection); }
  updateReview();
}
function resendLabel() { const remaining = resendRemaining(state); return remaining ? `Resend code in ${remaining}s` : 'Resend code'; }
function updateReview() {
  document.getElementById('demo-code').textContent = demoCode(state);
  document.getElementById('review-status').textContent = `模拟状态：${state.screen} · 来源：${state.origin}${state.targetId ? ' / ' + state.targetId : ''} · ${state.verified ? '邮箱已验证' : '未验证'} · 业务写入：${state.businessWrites} · 模拟时钟：${state.now}s${state.sendFailure ? ' · 下次请求失败' : ''}${state.verifyFailure ? ' · 下次验证失败' : ''}`;
}
function reset() { state = createState({origin:document.getElementById('origin').value, profileComplete:document.getElementById('profile').value === 'complete'}); render(); }
document.getElementById('reset').addEventListener('click', reset);
document.getElementById('advance30').addEventListener('click', () => dispatch({type:'ADVANCE',seconds:30}));
document.getElementById('advance300').addEventListener('click', () => dispatch({type:'ADVANCE',seconds:300}));
document.getElementById('failSend').addEventListener('click', () => dispatch({type:'FAIL_SEND'}));
document.getElementById('failVerify').addEventListener('click', () => dispatch({type:'FAIL_VERIFY'}));
setInterval(() => {
  state = transition(state,{type:'ADVANCE',seconds:1});
  const resend = document.getElementById('resend');
  if (resend) { resend.disabled = resendRemaining(state)>0; resend.textContent=resendLabel(); }
  updateReview();
},1000);
render();
