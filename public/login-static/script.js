const APPS = {
	calsync: {
		name: 'CalSync',
		url: '/calsync/',
		favicon: '/calsync/favicon.png',
		color: '#E4840F',
		color2: '#FF9F0A',
		shadow: 'rgba(228, 132, 15, 0.3)',
	},
	dropsync: {
		name: 'DropSync',
		url: '/dropsync/',
		favicon: '/dropsync/favicon.png',
		color: '#5AC8FA',
		color2: '#30D158',
		shadow: 'rgba(90, 200, 250, 0.3)',
	},
	healthsync: {
		name: 'HealthSync',
		url: '/healthsync/',
		favicon: '/healthsync/favicon.png',
		color: '#e8282a',
		color2: '#ffffff',
		shadow: 'rgba(232, 40, 42, 0.3)',
	},
	latetracker: {
		name: 'LateTracker',
		url: '/latetracker/',
		favicon: '/login/favicon.png',
		color: '#E4840F',
		color2: '#FF9F0A',
		shadow: 'rgba(228, 132, 15, 0.3)',
	}
};

const _params = new URLSearchParams(window.location.search);
const _appKey = (_params.get('signinginto') || '').toLowerCase();
const APP = APPS[_appKey] || APPS['healthsync'];
const KEEP_LOGIN_PAGE = _params.get('keep_login_page') === 'true';

const SUPABASE_URL = 'https://stuqtqlkantewwxhwitg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nNq-PUIq-C-q5OREGoEquA_XmLrOr-r';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MFA_TRUST_KEY = 'mfa_trusted_emails';

function getMfaTrustedEmails() {
	try {
		return JSON.parse(localStorage.getItem(MFA_TRUST_KEY) || '[]');
	} catch {
		return [];
	}
}

function isMfaTrusted(email) {
	return getMfaTrustedEmails().includes(email.toLowerCase());
}

function setMfaTrusted(email) {
	const list = getMfaTrustedEmails();
	const key = email.toLowerCase();
	if (!list.includes(key)) {
		list.push(key);
		localStorage.setItem(MFA_TRUST_KEY, JSON.stringify(list));
	}
}

(function brandPage() {
    document.title = APP.name + ' - Login';

    const favEl = document.querySelector('link[rel="icon"]');
    if (favEl) favEl.href = APP.favicon;

    const logoImg = document.getElementById('logoImg');
    const logoName = document.getElementById('logoName');
    if (logoImg) {
        logoImg.src = APP.favicon;
        logoImg.alt = APP.name;
    }
    if (logoName) {
        if (APP.name.includes('Sync')) {
            const parts = APP.name.split('Sync');
            logoName.innerHTML = parts[0] + '<span>Sync</span>';
        } else {
            logoName.textContent = APP.name;
        }
    }

    const regSub = document.getElementById('registerSubtitle');
    if (regSub) {
        if (APP.name.includes('Sync')) {
            const parts = APP.name.split('Sync');
            regSub.innerHTML = `Join ${parts[0]}<span>Sync</span> and start tracking today!`;
        } else {
            regSub.textContent = `Join ${APP.name} and start tracking today!`;
        }
    }

    const liTitle = document.getElementById('loggedInTitle');
    if (liTitle) {
        if (APP.name.includes('Sync')) {
            const parts = APP.name.split('Sync');
            liTitle.innerHTML = `Welcome back to ${parts[0]}<span>Sync</span>!`;
        } else {
            liTitle.textContent = `Welcome back to ${APP.name}!`;
        }
    }

    document.documentElement.style.setProperty('--accent', APP.color);
    document.documentElement.style.setProperty('--accent2', APP.color2);
    document.documentElement.style.setProperty('--shadow-app', APP.shadow);
})();

function goToApp() {
	if (KEEP_LOGIN_PAGE) return;
	window.location.href = APP.url + '?reload=true';
}

function showView(id) {
	document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
	document.getElementById('authSection').classList.remove('active');
	const el = document.getElementById(id);
	if (el) el.classList.add('active');
}

function showAuth() {
	document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
	document.getElementById('authSection').classList.add('active');
	document.getElementById('viewLogin').classList.add('active');
}

function showReset() {
	showView('viewReset');
}

function switchTab(tab) {
	document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
	document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
	document.getElementById('viewLogin').classList.toggle('active', tab === 'login');
	document.getElementById('viewRegister').classList.toggle('active', tab === 'register');
	document.getElementById('viewConfirm').classList.remove('active');
}

function setLoading(btnId, loading) {
	const btn = document.getElementById(btnId);
	btn.classList.toggle('loading', loading);
	btn.disabled = loading;
}

function showAlert(id, msg, type = 'error') {
	const el = document.getElementById(id);
	el.textContent = msg;
	el.className = `alert ${type} show`;
}

function hideAlert(id) {
	document.getElementById(id).className = 'alert';
}

function togglePw(inputId, btn) {
	const input = document.getElementById(inputId);
	const isHidden = input.type === 'password';
	input.type = isHidden ? 'text' : 'password';
	btn.innerHTML = isHidden ?
		`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>` :
		`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function checkPasswordStrength(val) {
	const rules = {
		len: val.length >= 8,
		upper: /[A-Z]/.test(val),
		num: /[0-9]/.test(val),
	};
	const score = Object.values(rules).filter(Boolean).length;
	const cls = ['', 'weak', 'medium', 'strong'][score] || '';

	['bar1', 'bar2', 'bar3'].forEach((id, i) => {
		document.getElementById(id).className = 'pw-bar' + (i < score ? ' ' + cls : '');
	});

	if (val.length > 0) document.getElementById('pwRules').classList.add('show');

	Object.entries(rules).forEach(([key, ok]) => {
		const rule = document.getElementById(`rule-${key}`);
		if (!rule) return;
		rule.classList.toggle('ok', ok);
		rule.querySelector('svg').innerHTML = ok ?
			`<polyline points="20 6 9 17 4 12"/>` :
			`<circle cx="12" cy="12" r="10"/>`;
	});
}

async function checkNameAvailability() {
	const val = document.getElementById('regName').value.trim();
	const msg = document.getElementById('nameMsg');
	if (!val) {
		msg.className = 'field-msg';
		return;
	}
	msg.className = 'field-msg checking show';
	msg.innerHTML = `<div class="field-spinner"></div> Checking…`;
	await new Promise(r => setTimeout(r, 400));
	msg.className = 'field-msg ok show';
	msg.textContent = '✓ Looks good';
}

async function checkEmailAvailability() {
	const val = document.getElementById('regEmail').value.trim();
	const msg = document.getElementById('emailMsg');
	if (!val || !val.includes('@')) {
		msg.className = 'field-msg';
		return;
	}
	msg.className = 'field-msg checking show';
	msg.innerHTML = `<div class="field-spinner"></div> Checking…`;
	await new Promise(r => setTimeout(r, 500));
	msg.className = 'field-msg ok show';
	msg.textContent = '✓ Email looks valid';
}

async function doRegister() {
	hideAlert('registerAlert');
	const name = document.getElementById('regName').value.trim();
	const email = document.getElementById('regEmail').value.trim();
	const password = document.getElementById('regPassword').value;
	const confirm = document.getElementById('regPasswordConfirm').value;

	if (!name) return showAlert('registerAlert', 'Please enter your name.');
	if (!email || !email.includes('@')) return showAlert('registerAlert', 'Please enter a valid email.');
	if (password.length < 8) return showAlert('registerAlert', 'Password must be at least 8 characters.');
	if (!/[A-Z]/.test(password)) return showAlert('registerAlert', 'Password needs at least one uppercase letter.');
	if (!/[0-9]/.test(password)) return showAlert('registerAlert', 'Password needs at least one number.');
	if (password !== confirm) return showAlert('registerAlert', 'Passwords do not match.');

	setLoading('registerBtn', true);
	const {
		error
	} = await _supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				full_name: name,
				display_name: name
			}
		}
	});
	setLoading('registerBtn', false);

	if (error) return showAlert('registerAlert', error.message);
	showView('viewConfirm');
}

async function doLogin() {
	hideAlert('loginAlert');
	const email = document.getElementById('loginEmail').value.trim();
	const password = document.getElementById('loginPassword').value;

	if (!email || !password) return showAlert('loginAlert', 'Please fill in all fields.');

	setLoading('loginBtn', true);
	const {
		data,
		error
	} = await _supabase.auth.signInWithPassword({
		email,
		password
	});

	if (error) {
		setLoading('loginBtn', false);
		return showAlert('loginAlert', error.message);
	}

	const {
		data: aal
	} = await _supabase.auth.mfa.getAuthenticatorAssuranceLevel();
	if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
		if (isMfaTrusted(email)) {
			setLoading('loginBtn', false);
			await handleLoggedIn(data.user);
			return;
		}
		setLoading('loginBtn', false);
		_pendingMfaEmail = email;
		await startMFAChallenge();
		return;
	}

	setLoading('loginBtn', false);
	await handleLoggedIn(data.user);
}

let _mfaChallengeId = null;
let _mfaFactorId = null;
let _pendingMfaEmail = null;

async function startMFAChallenge() {
	const {
		data: factors
	} = await _supabase.auth.mfa.listFactors();
	const totp = factors?.totp?.[0];
	if (!totp) {
		await handleLoggedIn((await _supabase.auth.getUser()).data.user);
		return;
	}

	const {
		data: challenge,
		error
	} = await _supabase.auth.mfa.challenge({
		factorId: totp.id
	});
	if (error) {
		showAlert('mfaAlert', error.message);
		return;
	}
	_mfaChallengeId = challenge.id;
	_mfaFactorId = totp.id;

	showView('viewMFA');
	setTimeout(() => document.querySelector('#otpWrap input')?.focus(), 100);
}

async function doMFAVerify() {
	const code = [...document.querySelectorAll('#otpWrap input')].map(i => i.value).join('');
	if (code.length < 6) return showAlert('mfaAlert', 'Enter all 6 digits.');

	setLoading('mfaBtn', true);
	const {
		error
	} = await _supabase.auth.mfa.verify({
		factorId: _mfaFactorId,
		challengeId: _mfaChallengeId,
		code,
	});
	setLoading('mfaBtn', false);

	if (error) return showAlert('mfaAlert', error.message);

	if (document.getElementById('mfaRememberMe')?.checked && _pendingMfaEmail) {
		setMfaTrusted(_pendingMfaEmail);
	}

	const {
		data: {
			user
		}
	} = await _supabase.auth.getUser();
	await handleLoggedIn(user);
}

let _setupFactorId = null;
let _setup2FAMode = 'setup';

async function show2FASetupOffer() {
	showView('viewSetup2FA');
	hideAlert('setup2faAlert');

	document.getElementById('qrCodeContainer').style.display = 'none';
	document.getElementById('totpSecret').style.display = 'none';

	const {
		data: existingFactors
	} = await _supabase.auth.mfa.listFactors();
	const existingTotp = existingFactors?.totp?.find(f => f.status === 'verified');

	if (existingTotp) {
		_setupFactorId = existingTotp.id;
		_setup2FAMode = 'test';

		document.querySelector('#viewSetup2FA .view-title').innerHTML =
			'Manage 2FA <span class="mfa-badge">Active</span>';
		document.querySelector('#viewSetup2FA .view-subtitle').textContent =
			'2FA is already active. Enter your current code to test it, or disable 2FA below.';
		document.querySelector('#setup2faBtn .btn-text').textContent = 'Test code';

		if (!document.getElementById('disable2faBtn')) {
			const disableBtn = document.createElement('button');
			disableBtn.id = 'disable2faBtn';
			disableBtn.className = 'btn-ghost';
			disableBtn.style.marginTop = '0.5rem';
			disableBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Disable 2FA`;
			disableBtn.onclick = disable2FA;
			const setupBtn = document.getElementById('setup2faBtn');
			setupBtn.parentNode.insertBefore(disableBtn, setupBtn.nextSibling);
		}

		document.querySelectorAll('#otpSetupWrap input').forEach(i => i.value = '');
		showAlert('setup2faAlert', '2FA is already set up. You can test your code here.', 'info');
		return;
	}

	const unverified = existingFactors?.totp?.filter(f => f.status !== 'verified') || [];
	for (const f of unverified) {
		await _supabase.auth.mfa.unenroll({
			factorId: f.id
		});
	}

	const {
		data,
		error
	} = await _supabase.auth.mfa.enroll({
		factorType: 'totp',
		issuer: APP.name,
	});

	if (error) {
		showAlert('setup2faAlert', error.message);
		return;
	}

	_setupFactorId = data.id;
	_setup2FAMode = 'setup';

	document.getElementById('qrCodeContainer').style.display = '';
	document.getElementById('totpSecret').style.display = '';
	document.querySelector('#viewSetup2FA .view-title').innerHTML =
		'Set up 2FA <span class="mfa-badge">Recommended</span>';
	document.querySelector('#viewSetup2FA .view-subtitle').textContent =
		'Scan the QR code with your authenticator app (e.g. Google Authenticator, Authy).';
	document.querySelector('#setup2faBtn .btn-text').textContent = 'Enable 2FA';

	const existingDisableBtn = document.getElementById('disable2faBtn');
	if (existingDisableBtn) existingDisableBtn.remove();

	document.getElementById('totpSecret').textContent = data.totp.secret;
	document.getElementById('qrCode').innerHTML = '';
	new QRCode(document.getElementById('qrCode'), {
		text: data.totp.uri,
		width: 160,
		height: 160,
		correctLevel: QRCode.CorrectLevel.M,
	});
}

function disable2FA() {
	if (!_setupFactorId) return;
	openDisableModal();
}

function openDisableModal() {
	let modal = document.getElementById('disable2faModal');
	if (!modal) {
		modal = document.createElement('div');
		modal.id = 'disable2faModal';
		modal.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:fadeUp 0.25s var(--ease);';
		modal.innerHTML = `
			<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:2rem;width:100%;max-width:380px;box-shadow:var(--shadow);">
				<div style="font-size:1.2rem;font-weight:700;margin-bottom:0.4rem;letter-spacing:-0.3px;">Disable 2FA</div>
				<div style="font-size:0.9rem;color:var(--text2);margin-bottom:1.4rem;line-height:1.5;">Enter your current authenticator code to confirm. This will remove 2FA from your account.<br><br>If you no longer have access to your authenticator app, <a href="#" id="supportReset2FA" style="color:var(--accent);text-decoration:none;" onclick="openSupportPage(event)">contact support</a>.</div>
				<div class="alert" id="disableModalAlert"></div>
				<div class="otp-wrap" id="otpDisableWrap" style="margin-bottom:1.2rem;">
					<input type="number" maxlength="1" min="0" max="9" oninput="otpInputDisable(this,0)" onkeydown="otpKeyDisable(this,0,event)">
					<input type="number" maxlength="1" min="0" max="9" oninput="otpInputDisable(this,1)" onkeydown="otpKeyDisable(this,1,event)">
					<input type="number" maxlength="1" min="0" max="9" oninput="otpInputDisable(this,2)" onkeydown="otpKeyDisable(this,2,event)">
					<input type="number" maxlength="1" min="0" max="9" oninput="otpInputDisable(this,3)" onkeydown="otpKeyDisable(this,3,event)">
					<input type="number" maxlength="1" min="0" max="9" oninput="otpInputDisable(this,4)" onkeydown="otpKeyDisable(this,4,event)">
					<input type="number" maxlength="1" min="0" max="9" oninput="otpInputDisable(this,5)" onkeydown="otpKeyDisable(this,5,event)">
				</div>
				<button class="btn-primary" id="confirmDisableBtn" onclick="confirmDisable2FA()" style="background:linear-gradient(135deg,#ff453a,#ff6b61);">
					<span class="btn-text">Confirm & Disable</span>
					<div class="btn-loader"></div>
				</button>
				<button class="btn-ghost" onclick="closeDisableModal()" style="margin-top:0.5rem;">Cancel</button>
			</div>`;
		modal.addEventListener('click', e => {
			if (e.target === modal) closeDisableModal();
		});
		document.body.appendChild(modal);
	} else {
		modal.style.display = 'flex';
	}
	modal.querySelectorAll('#otpDisableWrap input').forEach(i => i.value = '');
	hideAlert('disableModalAlert');
	setTimeout(() => modal.querySelector('#otpDisableWrap input').focus(), 50);
}

function otpInputDisable(el, idx) {
	const inputs = [...document.querySelectorAll('#otpDisableWrap input')];
	el.value = el.value.replace(/\D/g, '').slice(-1);
	if (el.value && idx < 5) inputs[idx + 1]?.focus();
}

function otpKeyDisable(el, idx, e) {
	const inputs = [...document.querySelectorAll('#otpDisableWrap input')];
	if (e.key === 'Backspace' && !el.value && idx > 0) inputs[idx - 1]?.focus();
	if (e.key === 'ArrowLeft' && idx > 0) inputs[idx - 1]?.focus();
	if (e.key === 'ArrowRight' && idx < 5) inputs[idx + 1]?.focus();
}

function closeDisableModal() {
	const modal = document.getElementById('disable2faModal');
	if (modal) modal.style.display = 'none';
}

async function openSupportPage(e) {
	if (e) e.preventDefault();
	const {
		data: {
			session
		}
	} = await _supabase.auth.getSession();
	const name = encodeURIComponent(
		session?.user?.user_metadata?.full_name ||
		session?.user?.user_metadata?.name ||
		session?.user?.email?.split('@')[0] || ''
	);
	const mail = encodeURIComponent(session?.user?.email || '');
	const appName = encodeURIComponent(APP.name);
	const url = `https://support.itsmarian.is-a.dev/?utm_origin=${APP.name.toLowerCase()}&utm_page=login&page_pos=2fa_access_lost&name=${name}&name-disabled=true&subject=Lost%20Access%20to%20${appName}%20-%202FA%20Issue&subject-disabled=true&mail=${mail}&mail-disabled=true&description=[DO%20NOT%20CHANGE%20THIS%20TEXT%20IN%20CAPS,%20YOUR%20NAME,%20THE%20SUBJECT%20OR%20YOUR%20MAIL%20ADRESS!%20YOU%20CAN%20CHANGE%20THE%20TEXT%20BELOW%20LIKE%20YOU%20WANT]%0A%0AHi%2C%20I%20can%20no%20longer%20access%20my%20${appName}%20account%20because%20I%20lost%20access%20to%20my%20two-factor%20authentication%20app.%20Please%20help%20me%20regain%20access%20to%20my%20account.%0A%0ABest%20Regards!`;
	window.open(url, '_blank');
}

async function confirmDisable2FA() {
	if (!_setupFactorId) return;
	const code = [...document.querySelectorAll('#otpDisableWrap input')].map(i => i.value).join('');
	if (code.length < 6) return;

	setLoading('confirmDisableBtn', true);
	hideAlert('disableModalAlert');

	const {
		data: challenge,
		error: cErr
	} = await _supabase.auth.mfa.challenge({
		factorId: _setupFactorId
	});
	if (cErr) {
		showAlert('disableModalAlert', cErr.message);
		setLoading('confirmDisableBtn', false);
		return;
	}

	const {
		error: vErr
	} = await _supabase.auth.mfa.verify({
		factorId: _setupFactorId,
		challengeId: challenge.id,
		code,
	});
	if (vErr) {
		showAlert('disableModalAlert', 'Invalid code. Please try again.');
		document.querySelectorAll('#otpDisableWrap input').forEach(i => i.value = '');
		document.querySelector('#otpDisableWrap input').focus();
		setLoading('confirmDisableBtn', false);
		return;
	}

	const {
		error: uErr
	} = await _supabase.auth.mfa.unenroll({
		factorId: _setupFactorId
	});
	setLoading('confirmDisableBtn', false);

	if (uErr) {
		showAlert('disableModalAlert', 'Failed to disable 2FA: ' + uErr.message);
		return;
	}

	_setupFactorId = null;
	closeDisableModal();
	showAlert('setup2faAlert', '2FA has been disabled successfully.', 'success');
	const disableBtn = document.getElementById('disable2faBtn');
	if (disableBtn) disableBtn.remove();
	setTimeout(() => show2FASetupOffer(), 2000);
}

async function doSetup2FA() {
	const code = [...document.querySelectorAll('#otpSetupWrap input')].map(i => i.value).join('');
	if (code.length < 6) return showAlert('setup2faAlert', 'Enter all 6 digits.');

	setLoading('setup2faBtn', true);
	const {
		data: challenge
	} = await _supabase.auth.mfa.challenge({
		factorId: _setupFactorId
	});
	const {
		error
	} = await _supabase.auth.mfa.verify({
		factorId: _setupFactorId,
		challengeId: challenge.id,
		code,
	});
	setLoading('setup2faBtn', false);

	if (error) {
		showAlert('setup2faAlert', error.message);
		document.querySelectorAll('#otpSetupWrap input').forEach(i => i.value = '');
		return;
	}

	if (_setup2FAMode === 'test') {
		showAlert('setup2faAlert', 'Code correct! 2FA is working perfectly. ✅', 'success');
	} else {
		showAlert('setup2faAlert', '2FA enabled successfully! 🎉', 'success');
		setTimeout(goToApp, 1500);
	}
}

function copySecret() {
	const txt = document.getElementById('totpSecret').textContent;
	navigator.clipboard.writeText(txt).then(() => {
		const el = document.getElementById('totpSecret');
		const orig = el.textContent;
		el.textContent = 'Copied!';
		setTimeout(() => el.textContent = orig, 1500);
	});
}

async function doReset() {
	hideAlert('resetAlert');
	const email = document.getElementById('resetEmail').value.trim();
	if (!email) return showAlert('resetAlert', 'Please enter your email.');

	setLoading('resetBtn', true);
	const {
		data: signInData,
		error: signInErr
	} = await _supabase.auth.signInWithOtp({
		email,
		options: {
			shouldCreateUser: false
		}
	});
	setLoading('resetBtn', false);

	const {
		data: factors
	} = await _supabase.auth.mfa.listFactors().catch(() => ({
		data: null
	}));
	const has2FA = factors?.totp?.length > 0;

	if (has2FA) {
		_resetEmail = email;
		showView('viewResetMFA');
		document.querySelectorAll('#otpResetWrap input').forEach(i => i.value = '');
		setTimeout(() => document.querySelector('#otpResetWrap input')?.focus(), 100);
		return;
	}

	await sendResetEmail(email);
}

let _resetEmail = null;

async function sendResetEmail(email) {
	setLoading('resetBtn', true);
	const {
		error
	} = await _supabase.auth.resetPasswordForEmail(email, {
		redirectTo: window.location.origin + window.location.pathname + window.location.search,
	});
	setLoading('resetBtn', false);
	if (error) return showAlert('resetAlert', error.message);
	showAlert('resetAlert', 'Reset link sent! Check your inbox.', 'success');
}

async function doResetMFAVerify() {
	const code = [...document.querySelectorAll('#otpResetWrap input')].map(i => i.value).join('');
	if (code.length < 6) return showAlert('resetMfaAlert', 'Enter all 6 digits.');

	setLoading('resetMfaBtn', true);
	hideAlert('resetMfaAlert');

	const {
		data: signInData,
		error: signInErr
	} = await _supabase.auth.signInWithPassword({
		email: _resetEmail,
		password: '__dummy_wont_work__'
	}).catch(() => ({
		data: null,
		error: null
	}));

	const {
		data: factors
	} = await _supabase.auth.mfa.listFactors();
	const totp = factors?.totp?.[0];
	if (!totp) {
		await sendResetEmail(_resetEmail);
		showView('viewReset');
		setLoading('resetMfaBtn', false);
		return;
	}

	const {
		data: challenge,
		error: cErr
	} = await _supabase.auth.mfa.challenge({
		factorId: totp.id
	});
	if (cErr) {
		showAlert('resetMfaAlert', cErr.message);
		setLoading('resetMfaBtn', false);
		return;
	}

	const {
		error: vErr
	} = await _supabase.auth.mfa.verify({
		factorId: totp.id,
		challengeId: challenge.id,
		code,
	});
	setLoading('resetMfaBtn', false);

	if (vErr) {
		showAlert('resetMfaAlert', 'Invalid code. Please try again.');
		document.querySelectorAll('#otpResetWrap input').forEach(i => i.value = '');
		document.querySelector('#otpResetWrap input').focus();
		return;
	}

	showView('viewReset');
	await sendResetEmail(_resetEmail);
}

function openChangePasswordModal() {
	let modal = document.getElementById('changePasswordModal');
	if (!modal) {
		modal = document.createElement('div');
		modal.id = 'changePasswordModal';
		modal.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:fadeUp 0.25s var(--ease);';
		modal.innerHTML = `
			<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:2rem;width:100%;max-width:400px;box-shadow:var(--shadow);">
				<div style="font-size:1.2rem;font-weight:700;margin-bottom:0.4rem;letter-spacing:-0.3px;">Change Password</div>
				<div style="font-size:0.9rem;color:var(--text2);margin-bottom:1.4rem;line-height:1.5;" id="changePwModalSubtitle">First, confirm your identity with your 2FA code.</div>
				<div class="alert" id="changePwAlert"></div>

				<div id="changePwStep1">
					<div style="font-size:0.82rem;font-weight:600;color:var(--text2);margin-bottom:8px;letter-spacing:0.3px;text-transform:uppercase;">Authenticator code</div>
					<div class="otp-wrap" id="otpChangePwWrap" style="margin-bottom:1.2rem;">
						<input type="number" maxlength="1" min="0" max="9" oninput="otpInputChangePw(this,0)" onkeydown="otpKeyChangePw(this,0,event)">
						<input type="number" maxlength="1" min="0" max="9" oninput="otpInputChangePw(this,1)" onkeydown="otpKeyChangePw(this,1,event)">
						<input type="number" maxlength="1" min="0" max="9" oninput="otpInputChangePw(this,2)" onkeydown="otpKeyChangePw(this,2,event)">
						<input type="number" maxlength="1" min="0" max="9" oninput="otpInputChangePw(this,3)" onkeydown="otpKeyChangePw(this,3,event)">
						<input type="number" maxlength="1" min="0" max="9" oninput="otpInputChangePw(this,4)" onkeydown="otpKeyChangePw(this,4,event)">
						<input type="number" maxlength="1" min="0" max="9" oninput="otpInputChangePw(this,5)" onkeydown="otpKeyChangePw(this,5,event)">
					</div>
					<button class="btn-primary" id="changePwVerifyBtn" onclick="verifyChangePw2FA()">
						<span class="btn-text">Verify</span>
						<div class="btn-loader"></div>
					</button>
				</div>

				<div id="changePwStep2" style="display:none;">
					<div class="field" style="margin-bottom:1rem;">
						<label>New password</label>
						<div class="input-wrap">
							<svg class="field-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							<input type="password" id="changePwNew" placeholder="Min. 8 characters" autocomplete="new-password" oninput="checkPasswordStrength(this.value)">
							<button class="toggle-pw" type="button" onclick="togglePw('changePwNew', this)">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							</button>
						</div>
						<div class="pw-strength" style="margin-top:6px;">
							<div class="pw-bar" id="bar1"></div>
							<div class="pw-bar" id="bar2"></div>
							<div class="pw-bar" id="bar3"></div>
						</div>
					</div>
					<div class="field" style="margin-bottom:1.2rem;">
						<label>Confirm new password</label>
						<div class="input-wrap">
							<svg class="field-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							<input type="password" id="changePwConfirm" placeholder="Repeat new password" autocomplete="new-password">
							<button class="toggle-pw" type="button" onclick="togglePw('changePwConfirm', this)">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							</button>
						</div>
					</div>
					<button class="btn-primary" id="changePwSaveBtn" onclick="doChangePassword()">
						<span class="btn-text">Save new password</span>
						<div class="btn-loader"></div>
					</button>
				</div>

				<button class="btn-ghost" onclick="closeChangePasswordModal()" style="margin-top:0.5rem;">Cancel</button>
			</div>`;
		modal.addEventListener('click', e => {
			if (e.target === modal) closeChangePasswordModal();
		});
		document.body.appendChild(modal);
	} else {
		modal.style.display = 'flex';
	}

	document.getElementById('changePwStep1').style.display = '';
	document.getElementById('changePwStep2').style.display = 'none';
	document.getElementById('changePwModalSubtitle').textContent = 'First, confirm your identity with your 2FA code.';
	document.querySelectorAll('#otpChangePwWrap input').forEach(i => i.value = '');
	hideAlert('changePwAlert');
	setTimeout(() => document.querySelector('#otpChangePwWrap input')?.focus(), 50);
}

function closeChangePasswordModal() {
	const modal = document.getElementById('changePasswordModal');
	if (modal) modal.style.display = 'none';
}

function otpInputChangePw(el, idx) {
	const inputs = [...document.querySelectorAll('#otpChangePwWrap input')];
	el.value = el.value.replace(/\D/g, '').slice(-1);
	if (el.value && idx < 5) inputs[idx + 1]?.focus();
}

function otpKeyChangePw(el, idx, e) {
	const inputs = [...document.querySelectorAll('#otpChangePwWrap input')];
	if (e.key === 'Backspace' && !el.value && idx > 0) inputs[idx - 1]?.focus();
	if (e.key === 'ArrowLeft' && idx > 0) inputs[idx - 1]?.focus();
	if (e.key === 'ArrowRight' && idx < 5) inputs[idx + 1]?.focus();
}

async function verifyChangePw2FA() {
	const code = [...document.querySelectorAll('#otpChangePwWrap input')].map(i => i.value).join('');
	if (code.length < 6) {
		showAlert('changePwAlert', 'Enter all 6 digits.');
		return;
	}

	hideAlert('changePwAlert');

	const {
		data: factors
	} = await _supabase.auth.mfa.listFactors();
	const totp = factors?.totp?.[0];
	if (!totp) {
		document.getElementById('changePwStep1').style.display = 'none';
		document.getElementById('changePwStep2').style.display = '';
		document.getElementById('changePwModalSubtitle').textContent = 'Enter your new password below.';
		document.getElementById('changePwNew')?.focus();
		return;
	}

	setLoading('changePwVerifyBtn', true);

	const {
		data: challenge,
		error: cErr
	} = await _supabase.auth.mfa.challenge({
		factorId: totp.id
	});
	if (cErr) {
		showAlert('changePwAlert', cErr.message);
		setLoading('changePwVerifyBtn', false);
		return;
	}

	const {
		error: vErr
	} = await _supabase.auth.mfa.verify({
		factorId: totp.id,
		challengeId: challenge.id,
		code,
	});
	setLoading('changePwVerifyBtn', false);

	if (vErr) {
		showAlert('changePwAlert', 'Invalid code. Please try again.');
		document.querySelectorAll('#otpChangePwWrap input').forEach(i => i.value = '');
		document.querySelector('#otpChangePwWrap input')?.focus();
		return;
	}

	hideAlert('changePwAlert');
	document.getElementById('changePwStep1').style.display = 'none';
	document.getElementById('changePwStep2').style.display = '';
	document.getElementById('changePwModalSubtitle').textContent = 'Enter your new password below.';
	document.getElementById('changePwNew')?.focus();
}

async function doChangePassword() {
	const newPw = document.getElementById('changePwNew').value;
	const confirm = document.getElementById('changePwConfirm').value;

	if (newPw.length < 8) return showAlert('changePwAlert', 'Password must be at least 8 characters.');
	if (!/[A-Z]/.test(newPw)) return showAlert('changePwAlert', 'Password needs at least one uppercase letter.');
	if (!/[0-9]/.test(newPw)) return showAlert('changePwAlert', 'Password needs at least one number.');
	if (newPw !== confirm) return showAlert('changePwAlert', 'Passwords do not match.');

	setLoading('changePwSaveBtn', true);
	hideAlert('changePwAlert');

	const {
		error
	} = await _supabase.auth.updateUser({
		password: newPw
	});
	setLoading('changePwSaveBtn', false);

	if (error) return showAlert('changePwAlert', error.message);

	showAlert('changePwAlert', 'Password changed successfully! ✅', 'success');
	document.getElementById('changePwNew').value = '';
	document.getElementById('changePwConfirm').value = '';
	setTimeout(() => closeChangePasswordModal(), 2000);
}

async function logoutUser() {
	await _supabase.auth.signOut();
	showAuth();
}

async function handleLoggedIn(user) {
	const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
	const msg = document.getElementById('loggedInMsg');
	if (msg && name) msg.textContent = `Signed in as ${name}.`;
	showView('viewLoggedIn');
	document.querySelector('.tabs').classList.add('hidden');
	setTimeout(goToApp, 1800);
}

function otpInput(el, idx, ctx) {
	const wrap = ctx === 'setup' ? '#otpSetupWrap' : ctx === 'reset' ? '#otpResetWrap' : '#otpWrap';
	const inputs = [...document.querySelectorAll(`${wrap} input`)];
	const val = el.value.replace(/\D/g, '');

	if (val.length > 1) {
		val.split('').slice(0, 6).forEach((d, i) => {
			if (inputs[i]) inputs[i].value = d;
		});
		inputs[5]?.focus();
		return;
	}
	el.value = val.slice(-1);
	if (val && idx < 5) inputs[idx + 1]?.focus();
}

function otpKey(el, idx, e, ctx) {
	const wrap = ctx === 'setup' ? '#otpSetupWrap' : ctx === 'reset' ? '#otpResetWrap' : '#otpWrap';
	const inputs = [...document.querySelectorAll(`${wrap} input`)];
	if (e.key === 'Backspace' && !el.value && idx > 0) inputs[idx - 1]?.focus();
	if (e.key === 'ArrowLeft' && idx > 0) inputs[idx - 1]?.focus();
	if (e.key === 'ArrowRight' && idx < 5) inputs[idx + 1]?.focus();
}

document.addEventListener('keydown', e => {
	if (e.key !== 'Enter') return;
	if (document.getElementById('viewLogin')?.classList.contains('active')) doLogin();
	if (document.getElementById('viewRegister')?.classList.contains('active')) doRegister();
	if (document.getElementById('viewReset')?.classList.contains('active')) doReset();
	if (document.getElementById('viewMFA')?.classList.contains('active')) doMFAVerify();
	if (document.getElementById('viewResetMFA')?.classList.contains('active')) doResetMFAVerify();
});

(async function init() {
	if (window.location.hash.includes('type=recovery')) {
		showView('viewReset');
		return;
	}

	const {
		data: {
			session
		}
	} = await _supabase.auth.getSession();
	if (session) {
		await handleLoggedIn(session.user);
	} else {
		showAuth();
	}
})();
