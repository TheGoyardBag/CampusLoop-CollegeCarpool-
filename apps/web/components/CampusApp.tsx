'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { PublicUser, Campus, Hub, Match, RideView, Course, Vehicle, Booking, Message, Notification, Report } from '@campusloop/core';
import { api, ApiError, money, time, day, initials, mins } from '../lib/api';
type Catalog = {
    campuses: Campus[];
    hubs: Hub[];
    demo: boolean;
};
type Me = {
    user: PublicUser;
    campus: Campus;
    demo: boolean;
};
type Summary = {
    suggestedDate: string;
    upcomingConfirmed: number;
    upcomingOffers: number;
    unread: number;
    weeklyClasses: number;
};
type BookingView = Booking & {
    ride: RideView;
};
type DriverRequest = Booking & {
    rider: {
        id: string;
        name: string;
    };
    ride: RideView;
};
type Notify = (message: string, error?: boolean) => void;
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const tabs = [['overview', 'Overview', '◉'], ['find', 'Find a ride', '⌕'], ['trips', 'My trips', '⇄'], ['schedule', 'Class schedule', '▦'], ['drive', 'Driver hub', '↗'], ['inbox', 'Notifications', '♧'], ['profile', 'Profile', '◌']] as const;
function useData<T>(path: string, version = 0, interval = 0) {
    const [state, set] = useState<{
        data: T | null;
        error: string;
        loading: boolean;
    }>({ data: null, error: '', loading: true });
    useEffect(() => { let active = true; const controller = new AbortController(); const run = async () => { try {
        const data = await api<T>(path, { signal: controller.signal });
        if (active)
            set({ data, error: '', loading: false });
    }
    catch (e) {
        if (active && !(e instanceof DOMException && e.name === 'AbortError'))
            set(s => ({ ...s, error: e instanceof Error ? e.message : 'Could not load data.', loading: false }));
    } }; void run(); const timer = interval ? setInterval(() => void run(), interval) : undefined; return () => { active = false; controller.abort(); clearInterval(timer); }; }, [path, version, interval]);
    return state;
}
function useAction(notify: Notify, refresh?: () => void) { const [busy, set] = useState(false); return { busy, run: async (fn: () => Promise<unknown>, success?: string) => { if (busy)
        return; set(true); try {
        await fn();
        if (success)
            notify(success);
        refresh?.();
        return true;
    }
    catch (e) {
        notify(e instanceof Error ? e.message : 'Action failed.', true);
        return false;
    }
    finally {
        set(false);
    } } }; }
function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Notice({ children }: {
    children: ReactNode;
}) { return <div className="notice">{children}</div>; }
function Loading({ state }: {
    state: {
        loading: boolean;
        error: string;
    };
}) { return state.error ? <div role="alert" className="error">{state.error}</div> : state.loading ? <p className="muted" role="status">Loading…</p> : null; }
function Badge({ value }: {
    value: string;
}) { return <span className={`badge ${value.toLowerCase()}`}>{value.replaceAll('_', ' ').toLowerCase()}</span>; }
function Empty({ title, children }: {
    title: string;
    children?: ReactNode;
}) { return <div className="empty"><span>↗</span><h3>{title}</h3><p>{children}</p></div>; }
function RouteSketch() { return <div className="route-sketch" aria-label="Illustrative route between a public pickup hub and campus, not a navigation map"><svg viewBox="0 0 480 170" role="img"><title>Illustrative campus commute</title><path className="grid-path" d="M0 40H480M0 90H480M0 140H480M65 0V170M150 0V170M265 0V170M375 0V170"/><path className="route-path" d="M50 126H142Q167 126 167 102V68Q167 47 190 47H330Q352 47 352 69V88H414"/><circle className="route-dot" cx="50" cy="126" r="9"/><circle className="route-dot end" cx="414" cy="88" r="12"/><text x="28" y="155">Your pickup hub</text><text x="342" y="123">Campus Commons</text><g transform="translate(198 28)"><rect rx="12" width="105" height="34"/><text x="17" y="22">Shared commute</text></g></svg><small>Route schematic · not road navigation</small></div>; }
export default function CampusApp() {
    const [me, setMe] = useState<Me | null>(null), [ready, setReady] = useState(false), [tab, setTab] = useState('overview'), [version, setVersion] = useState(0), [toast, setToast] = useState<{
        message: string;
        error: boolean;
    } | null>(null);
    const catalog = useData<Catalog>('/catalog');
    const refresh = () => setVersion(v => v + 1);
    const notify: Notify = (message, error = false) => setToast({ message, error });
    useEffect(() => { api<Me>('/me').then(setMe).catch(e => { if (!(e instanceof ApiError && e.status === 401))
        setToast({ message: e.message, error: true }); }).finally(() => setReady(true)); }, []);
    useEffect(() => { if (!toast)
        return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t); }, [toast]);
    const session = async () => { setMe(await api<Me>('/me')); refresh(); };
    if (!ready || catalog.loading)
        return <main className="auth-shell"><h1>CampusLoop</h1><p role="status">Getting things ready…</p></main>;
    if (!catalog.data)
        return <main className="auth-shell"><Loading state={catalog}/><button onClick={() => location.reload()}>Retry connection</button></main>;
    return <>{me ? <div className="shell"><a className="skip" href="#main">Skip to content</a><aside className="sidebar"><a href="/" className="brand"><b className="brand-mark">⌘</b>CampusLoop<span className="brand-dot">●</span></a><p className="sidebar-label">YOUR CAMPUS, CONNECTED</p><nav aria-label="Main navigation">{tabs.map(([key, label, icon]) => <button key={key} className={tab === key ? 'nav-item active' : 'nav-item'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}{me.user.role === 'ADMIN' && <button className={`nav-item ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}><span>◇</span>Moderation</button>}</nav><div className="sidebar-note"><b>Less parking.<br />More possibilities.</b><p>Coordinate a commute that fits your campus day.</p></div><div className="account"><span className="avatar">{initials(me.user.name)}</span><div><b>{me.user.name}</b><small>{me.user.role === 'ADMIN' ? 'Campus moderator' : 'Campus email verified'}</small></div><button className="icon-button" aria-label="Sign out" onClick={() => void api('/auth/logout', { method: 'POST', body: {} }).then(() => setMe(null)).catch(e => notify(e.message, true))}>↪</button></div></aside><main id="main" className="main"><header className="topbar"><div><span className="eyebrow">{me.campus.name}</span><small>{me.campus.timezone}</small></div><div className="top-actions">{me.demo && <span className="demo-badge">Fictional demo data</span>}<button className="secondary" onClick={() => setTab('drive')}>＋ Offer a ride</button></div></header><Workspace tab={tab} setTab={setTab} me={me} catalog={catalog.data} version={version} refresh={refresh} notify={notify} reloadMe={session}/><footer className="footer">Public pickup hubs. Private class schedules. Driver-approved rides.<span>CampusLoop · Portfolio application</span></footer></main></div> : <Auth catalog={catalog.data} onLogin={session} notify={notify}/>} {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.message}<button aria-label="Dismiss message" onClick={() => setToast(null)}>×</button></div>}</>;
}
function Auth({ catalog, onLogin, notify }: {
    catalog: Catalog;
    onLogin: () => Promise<void>;
    notify: Notify;
}) {
    const [mode, setMode] = useState('login'), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [token, setToken] = useState(''), [name, setName] = useState(''), [campusId, setCampus] = useState(catalog.campuses[0]?.id ?? '');
    const action = useAction(notify);
    const submit = (e: FormEvent) => { e.preventDefault(); void action.run(async () => { const path = mode === 'login' ? 'login' : mode === 'register' ? 'register' : mode === 'verify' ? 'verify' : mode === 'forgot' ? 'request-reset' : 'reset'; const body = mode === 'login' ? { email, password } : mode === 'register' ? { email, password, name, campusId } : mode === 'verify' ? { token } : mode === 'forgot' ? { email } : { token, password }; const result = await api<{
        message?: string;
    }>(`/auth/${path}`, { method: 'POST', body }); if (mode === 'login')
        await onLogin();
    else
        notify(result.message ?? 'Done.'); }); };
    return <main className="auth-shell"><div className="auth-brand"><span className="brand-mark">⌘</span> CampusLoop</div><div className="auth-grid"><section className="auth-story"><span className="eyebrow">THE CAMPUS COMMUTE, REIMAGINED</span><h1>Your next class.<br />Your next connection.</h1><p>Find a ride that fits your schedule. Share a seat with someone heading the same way.</p><RouteSketch /><div className="tag-row"><span>Schedule-aware matching</span><span>Campus email verification</span><span>Public pickup hubs</span></div></section><section className="panel auth-panel"><h2>{({ login: 'Welcome back', register: 'Join your campus', verify: 'Verify your email', forgot: 'Forgot your password?', reset: 'Set a new password' } as Record<string, string>)[mode]}</h2><p className="muted">{mode === 'login' ? 'Sign in to coordinate your next commute.' : 'Use the verification or reset code sent to your campus email.'}</p><form onSubmit={submit}>{mode === 'register' && <><Field label="Your name"><input required maxLength={60} value={name} onChange={e => setName(e.target.value)}/></Field><Field label="Campus"><select value={campusId} onChange={e => setCampus(e.target.value)}>{catalog.campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></>}{['login', 'register', 'forgot'].includes(mode) && <Field label="Campus email"><input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}/></Field>}{['login', 'register', 'reset'].includes(mode) && <Field label="Password (12+ characters)"><input type="password" minLength={12} maxLength={128} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)}/></Field>}{['verify', 'reset'].includes(mode) && <Field label="One-time code"><input required minLength={20} maxLength={200} value={token} autoComplete="one-time-code" onChange={e => setToken(e.target.value)}/></Field>}<button className="full" disabled={action.busy}>{action.busy ? 'Working…' : mode === 'login' ? 'Sign in →' : 'Continue →'}</button></form><div className="auth-links">{[['login', 'Sign in'], ['register', 'Create account'], ['verify', 'Verify email'], ['forgot', 'Forgot password'], ['reset', 'Reset password']].filter(([key]) => key !== mode).map(([key, label]) => <button className="link" key={key} onClick={() => setMode(key!)}>{label}</button>)}</div>{catalog.demo && <div className="demo-accounts"><b>Explore the fictional demo</b><p>No real student or driver information.</p>{['maya', 'leo', 'admin'].map(u => <button key={u} className="secondary small" onClick={() => { setMode('login'); setEmail(`${u}@students.redwood.example`); setPassword('CampusLoop-Demo-2026!'); }}>{u === 'maya' ? 'Rider' : u === 'leo' ? 'Driver' : 'Moderator'}</button>)}</div>}</section></div></main>;
}
type WorkspaceProps = {
    tab: string;
    setTab: (x: string) => void;
    me: Me;
    catalog: Catalog;
    version: number;
    refresh: () => void;
    notify: Notify;
    reloadMe: () => Promise<void>;
};
function Workspace(p: WorkspaceProps) {
    const summary = useData<Summary>('/summary', p.version, 15000);
    const date = summary.data?.suggestedDate;
    if (p.tab === 'overview')
        return <><div className="page-heading"><div><span className="eyebrow">LET’S MAKE YOUR DAY A LITTLE EASIER</span><h1>Good to see you, {p.me.user.name.split(' ')[0]}.</h1><p>Your campus day starts with a better commute.</p></div></div><section className="hero"><div><span className="pill">Made for your class schedule</span><h2>Same campus.<br />Shared direction.</h2><p>Skip the scheduling back-and-forth. Find classmates going your way, when you need to get there.</p><button onClick={() => p.setTab('find')}>Find my next ride <span>↗</span></button></div><RouteSketch /></section><div className="stats">{[[summary.data?.upcomingConfirmed ?? '—', 'Confirmed upcoming trips', '⇄'], [summary.data?.weeklyClasses ?? '—', 'Weekly class blocks', '▦'], [summary.data?.unread ?? '—', 'Unread updates', '◌']].map(([n, label, icon]) => <article className="stat" key={String(label)}><span className="stat-icon">{icon}</span><div><strong>{n}</strong><p>{label}</p></div></article>)}</div><Loading state={summary}/>{date && <FindRides {...p} initialDate={date} compact/>}</>;
    if (p.tab === 'find')
        return date ? <FindRides {...p} initialDate={date}/> : <Loading state={summary}/>;
    if (p.tab === 'schedule')
        return <Schedule {...p} initialDate={date ?? new Date().toISOString().slice(0, 10)}/>;
    if (p.tab === 'trips')
        return <Trips {...p}/>;
    if (p.tab === 'drive')
        return <Drive {...p} initialDate={date ?? new Date().toISOString().slice(0, 10)}/>;
    if (p.tab === 'inbox')
        return <Inbox {...p}/>;
    if (p.tab === 'profile')
        return <Profile {...p}/>;
    if (p.tab === 'admin')
        return <Admin {...p}/>;
    return null;
}
function FindRides(p: WorkspaceProps & {
    initialDate: string;
    compact?: boolean;
}) {
    const [date, setDate] = useState(p.initialDate), [direction, setDirection] = useState('TO_CAMPUS'), [quiet, setQuiet] = useState(false), [accessible, setAccessible] = useState(false), [target, setTarget] = useState(''), [maxCost, setMaxCost] = useState(1500), [noteRide, setNoteRide] = useState<Match | null>(null), [note, setNote] = useState('');
    const action = useAction(p.notify, p.refresh);
    const query = new URLSearchParams({ date, direction, quiet: String(quiet), accessible: String(accessible), maxCostCents: String(maxCost), ...(target ? { targetTime: target } : {}) });
    const results = useData<{
        rides: Match[];
        hasSchedule: boolean;
        limited: boolean;
    }>(`/matches?${query}`, p.version);
    return <section><div className="section-heading"><div><span className="eyebrow">A LITTLE LESS SOLO</span><h2>{p.compact ? 'Rides that fit your day' : 'Find your next ride'}</h2><p>{p.compact ? 'Matched around your classes and your public pickup hub.' : 'Your class schedule stays private. Drivers see only your request.'}</p></div>{p.compact && <button className="link" onClick={() => p.setTab('find')}>Explore all rides →</button>}</div><div className="filters"><Field label="Travel date"><input type="date" required value={date} onChange={e => setDate(e.target.value)}/></Field><Field label="Direction"><select value={direction} onChange={e => setDirection(e.target.value)}><option value="TO_CAMPUS">To campus</option><option value="FROM_CAMPUS">From campus</option></select></Field>{!p.compact && <><Field label="Target time (optional)"><input type="time" value={target} onChange={e => setTarget(e.target.value)}/></Field><Field label="Max contribution"><select value={maxCost} onChange={e => setMaxCost(Number(e.target.value))}>{[0, 300, 500, 1000, 1500, 3000].map(c => <option key={c} value={c}>{money(c)}</option>)}</select></Field><label className="check"><input type="checkbox" checked={quiet} onChange={e => setQuiet(e.target.checked)}/>Quiet ride</label><label className="check"><input type="checkbox" checked={accessible} onChange={e => setAccessible(e.target.checked)}/>Accessible vehicle</label></>}</div><Loading state={results}/>{results.data && !results.data.hasSchedule && <Notice>No classes on this date. Set a target time, or compare the driver-scheduled times.</Notice>}{results.data?.limited && <Notice>Showing the first 200 departures. Narrow the day or direction.</Notice>}<div className="ride-grid">{results.data?.rides.slice(0, p.compact ? 3 : 200).map(r => <article className="ride-card" key={r.id}><div className="ride-top"><span className="avatar">{initials(r.driver.name)}</span><div><b>{r.driver.name}</b><small>{r.vehicle.color} {r.vehicle.label}</small></div><span className="fit">{r.score} fit</span></div><div className="route"><div><b>{time(r.departureAt, p.me.campus.timezone)}</b><span className="route-node"/><p>{r.origin.name}</p></div><div><b>{time(r.arrivalAt, p.me.campus.timezone)}</b><span className="route-node filled"/><p>{r.destination.name}</p></div></div><div className="match-reason">✓ {r.reasons.find(x => x.startsWith('Arrives') || x.startsWith('Leaves')) ?? r.reasons[0]}</div><div className="tags"><span>{r.availableSeats} seats available</span>{r.quiet && <span>Quiet ride</span>}{r.vehicle.accessible && <span>Accessible</span>}</div><div className="ride-bottom"><div><strong>{money(r.costCents)}</strong><small>suggested contribution</small></div>{r.myBooking ? <Badge value={r.myBooking.status}/> : <button disabled={action.busy} onClick={() => { setNoteRide(r); setNote(''); }}>{r.availableSeats > 0 ? 'Request seat' : 'Join waitlist'} ↗</button>}</div></article>)}</div>{results.data?.rides.length === 0 && <Empty title="No matching rides yet">Try a different time, check your pickup hub, or offer a ride.</Empty>}<p className="fine-print">Fit is a transparent scheduling heuristic, not a safety rating. Distances are straight-line estimates. Times, accessibility, and vehicle details are self-reported. No payment is collected.</p>{noteRide && <div className="modal-backdrop"><section className="panel modal" role="dialog" aria-modal="true" aria-labelledby="request-title"><h2 id="request-title">Request a ride with {noteRide.driver.name.split(' ')[0]}</h2><p>Requests require driver approval. A pending request does not reserve a seat.</p><Field label="Note to the driver (optional)"><textarea maxLength={240} value={note} onChange={e => setNote(e.target.value)}/></Field><div className="button-row"><button disabled={action.busy} onClick={() => void action.run(() => api(`/rides/${noteRide.id}/bookings`, { method: 'POST', body: { note, waitlist: true }, key: crypto.randomUUID() }), 'Request sent. Check My trips for status.').then(ok => { if (ok)
        setNoteRide(null); })}>Send request</button><button className="secondary" onClick={() => setNoteRide(null)}>Close</button></div></section></div>}</section>;
}
function Schedule(p: WorkspaceProps & {
    initialDate: string;
}) {
    const state = useData<Course[]>('/courses', p.version);
    const action = useAction(p.notify, p.refresh);
    const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const form = e.currentTarget, f = new FormData(form); void action.run(() => api('/courses', { method: 'POST', body: { name: f.get('name'), weekday: Number(f.get('weekday')), start: f.get('start'), end: f.get('end'), termStart: f.get('termStart'), termEnd: f.get('termEnd') } }), 'Class added. Matching will use your updated schedule.').then(ok => { if (ok)
        form.reset(); }); };
    return <><div className="page-heading"><div><span className="eyebrow">YOUR SCHEDULE, NOT EVERYONE’S</span><h1>Class schedule</h1><p>Weekly class blocks are private to your account. All times use {p.me.campus.timezone}.</p></div></div><Loading state={state}/><div className="week-grid">{weekdays.map((name, i) => <section key={name} className="day-column"><h3>{name.slice(0, 3)}</h3>{state.data?.filter(c => c.weekday === i + 1).map(c => <article className="class-card" key={c.id}><small>{mins(c.startMinute)} – {mins(c.endMinute)}</small><b>{c.name}</b><small>{c.termStart} to {c.termEnd}</small><button className="link danger" disabled={action.busy} onClick={() => void action.run(() => api(`/courses/${c.id}`, { method: 'DELETE', body: {} }), 'Class removed.')}>Remove</button></article>)}</section>)}</div><section className="panel"><h2>Add a weekly class</h2><form className="form-grid" onSubmit={submit}><Field label="Course name"><input name="name" required maxLength={80} placeholder="CS 301 · Software Engineering"/></Field><Field label="Weekday"><select name="weekday">{weekdays.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></Field><Field label="Starts"><input type="time" name="start" required defaultValue="09:00"/></Field><Field label="Ends"><input type="time" name="end" required defaultValue="10:15"/></Field><Field label="Term starts"><input type="date" name="termStart" required defaultValue={p.initialDate}/></Field><Field label="Term ends"><input type="date" name="termEnd" required/></Field><button disabled={action.busy}>Add class</button></form><p className="fine-print">Overlapping classes and conflicts with confirmed trips are rejected. Add one entry per weekday.</p></section></>;
}
function Trips(p: WorkspaceProps) {
    const state = useData<BookingView[]>('/bookings', p.version), action = useAction(p.notify, p.refresh);
    const [thread, setThread] = useState<string | null>(null);
    return <><div className="page-heading"><div><span className="eyebrow">EVERY COMMUTE, IN ONE PLACE</span><h1>My trips</h1><p>Track requests, download confirmed trips, and coordinate with your carpool.</p></div></div><Loading state={state}/>{state.data?.length === 0 && <Empty title="Your next commute is waiting">Find a ride to send your first request.</Empty>}<div className="trip-list">{state.data?.map(b => <article className="panel trip-card" key={b.id}><div><Badge value={b.status}/><h3>{b.ride.origin.name} → {b.ride.destination.name}</h3><p>{day(b.ride.departureAt, p.me.campus.timezone)} · {time(b.ride.departureAt, p.me.campus.timezone)} · with {b.ride.driver.name}</p></div><div className="button-row">{b.status === 'CONFIRMED' && <><button className="secondary" onClick={() => setThread(b.rideId)}>Trip messages</button>{b.ride.status !== 'CANCELLED' && <a className="button secondary" href={`/api/rides/${b.rideId}/calendar.ics`}>Calendar ↓</a>}</>}{['REQUESTED', 'WAITLISTED', 'CONFIRMED'].includes(b.status) && b.ride.status === 'OPEN' && <button className="link danger" disabled={action.busy} onClick={() => { if (confirm('Cancel your request?'))
        void action.run(() => api(`/bookings/${b.id}/cancel`, { method: 'POST', body: {} }), 'Booking cancelled.'); }}>Cancel request</button>}<button className="link" onClick={() => { const reason = prompt('Describe your concern (10–1000 characters). For emergencies contact local emergency services.'); if (reason)
        void action.run(() => api(`/rides/${b.rideId}/report`, { method: 'POST', body: { reason } }), 'Report submitted to moderation.'); }}>Report</button>{b.status === 'CONFIRMED' && b.ride.status === 'COMPLETED' && <button className="link" onClick={() => { const rating = prompt('Rate this completed trip, 1 to 5.'); if (rating)
        void action.run(() => api(`/rides/${b.rideId}/reviews`, { method: 'POST', body: { rating: Number(rating), comment: '' } }), 'Review saved.'); }}>Review trip</button>}</div></article>)}</div>{thread && <Thread {...p} rideId={thread} close={() => setThread(null)}/>}</>;
}
function Drive(p: WorkspaceProps & {
    initialDate: string;
}) {
    const vehicles = useData<Vehicle[]>('/vehicles', p.version), rides = useData<RideView[]>('/rides/mine', p.version), requests = useData<DriverRequest[]>('/driver/requests', p.version, 15000);
    const action = useAction(p.notify, p.refresh);
    const [direction, setDirection] = useState('TO_CAMPUS'), [repeat, setRepeat] = useState(false), [thread, setThread] = useState<string | null>(null);
    const hubs = p.catalog.hubs.filter(h => h.campusId === p.me.user.campusId);
    const origins = hubs.filter(h => h.isCampus === (direction === 'FROM_CAMPUS')), destinations = hubs.filter(h => h.isCampus === (direction === 'TO_CAMPUS'));
    const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body = { originHubId: f.get('origin'), destinationHubId: f.get('destination'), vehicleId: f.get('vehicle'), direction, date: f.get('date'), departure: f.get('departure'), arrival: f.get('arrival'), capacity: Number(f.get('capacity')), costCents: Math.round(Number(f.get('cost')) * 100), quiet: f.get('quiet') === 'on', ...(repeat ? { repeatUntil: f.get('repeatUntil'), weekdays: f.getAll('weekdays').map(Number) } : {}) }; void action.run(() => api('/rides', { method: 'POST', body }), 'Ride offer published. Recurring offers are committed together.'); };
    return <><div className="page-heading"><div><span className="eyebrow">HAVE AN EXTRA SEAT?</span><h1>Driver hub</h1><p>Offer a ride, review requests, and coordinate your passengers.</p></div></div><section className="panel"><h2>Offer a ride</h2>{!vehicles.data?.length ? <Notice>Add your vehicle in Profile before publishing an offer.</Notice> : <form className="form-grid" onSubmit={submit}><Field label="Direction"><select value={direction} onChange={e => setDirection(e.target.value)}><option value="TO_CAMPUS">To campus</option><option value="FROM_CAMPUS">From campus</option></select></Field><Field label="Pickup hub"><select name="origin" key={`o-${direction}`}>{origins.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><Field label="Drop-off hub"><select name="destination" key={`d-${direction}`}>{destinations.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><Field label="Vehicle"><select name="vehicle">{vehicles.data.map(c => <option key={c.id} value={c.id}>{c.color} {c.label} · {c.seats} seats</option>)}</select></Field><Field label="First date"><input type="date" name="date" defaultValue={p.initialDate} required/></Field><Field label="Departure"><input type="time" name="departure" defaultValue="08:00" required/></Field><Field label="Arrival"><input type="time" name="arrival" defaultValue="08:30" required/></Field><Field label="Passenger seats"><input type="number" name="capacity" min={1} max={7} defaultValue={2} required/></Field><Field label="Suggested contribution ($)"><input type="number" name="cost" min={0} max={30} step="0.01" defaultValue={3} required/></Field><label className="check"><input type="checkbox" name="quiet"/>Quiet ride</label><label className="check"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)}/>Repeat (up to 28 days)</label>{repeat && <><Field label="Repeat until"><input type="date" name="repeatUntil" required/></Field><div className="weekday-picks">{weekdays.map((d, i) => <label className="check" key={d}><input type="checkbox" name="weekdays" value={i + 1} defaultChecked={i < 5}/>{d.slice(0, 3)}</label>)}</div></>}<button disabled={action.busy}>Publish offer →</button></form>}<p className="fine-print">You provide departure and arrival times; there is no road-routing or driving-safety verification. Contributions are informational, not charges.</p></section><section><div className="section-heading"><h2>Seat requests</h2><span className="muted">Driver approval required</span></div><Loading state={requests}/>{requests.data?.length === 0 && <Empty title="No open requests">New requests for your upcoming rides will appear here.</Empty>}{requests.data?.map(b => <article className="panel request-card" key={b.id}><div><b>{b.rider.name}</b> <Badge value={b.status}/><p>{day(b.ride.departureAt, p.me.campus.timezone)} · {time(b.ride.departureAt, p.me.campus.timezone)}{b.note && ` · “${b.note}”`}</p></div><div className="button-row">{b.status !== 'CONFIRMED' && <button disabled={action.busy} onClick={() => void action.run(() => api(`/bookings/${b.id}/approve`, { method: 'POST', body: {} }), 'Seat confirmed.')}>Approve</button>}<button className="secondary" disabled={action.busy} onClick={() => void action.run(() => api(`/bookings/${b.id}/decline`, { method: 'POST', body: {} }), 'Request declined.')}>Decline</button></div></article>)}</section><div className="section-heading"><h2>Your ride offers</h2></div><Loading state={rides}/><div className="trip-list">{rides.data?.slice().sort((a, b) => a.departureAt.localeCompare(b.departureAt)).map(r => <article className="panel trip-card" key={r.id}><div><Badge value={r.status}/><h3>{r.origin.name} → {r.destination.name}</h3><p>{day(r.departureAt, p.me.campus.timezone)} · {time(r.departureAt, p.me.campus.timezone)} · {r.seatsUsed}/{r.capacity} confirmed</p></div><div className="button-row"><button className="secondary" onClick={() => setThread(r.id)}>Messages</button>{r.status === 'OPEN' && <><button className="link danger" disabled={action.busy} onClick={() => { if (confirm('Cancel this ride and notify every requester?'))
        void action.run(() => api(`/rides/${r.id}/cancel`, { method: 'POST', body: {} }), 'Ride cancelled.'); }}>Cancel</button>{Date.parse(r.arrivalAt) < Date.now() && <button disabled={action.busy} onClick={() => void action.run(() => api(`/rides/${r.id}/complete`, { method: 'POST', body: {} }), 'Trip completed.')}>Mark complete</button>}</>}</div></article>)}</div>{thread && <Thread {...p} rideId={thread} close={() => setThread(null)}/>}</>;
}
function Thread(p: WorkspaceProps & {
    rideId: string;
    close: () => void;
}) {
    const msgs = useData<(Message & {
        author: string;
    })[]>(`/rides/${p.rideId}/messages`, p.version, 5000);
    const [text, setText] = useState(''), action = useAction(p.notify, p.refresh);
    return <div className="modal-backdrop"><section className="panel modal" role="dialog" aria-modal="true" aria-labelledby="thread-title"><div className="section-heading"><h2 id="thread-title">Trip messages</h2><button className="secondary" onClick={p.close}>Close</button></div><Notice>Only the driver and confirmed riders can access this thread. Messages refresh every five seconds.</Notice><Loading state={msgs}/><ol className="messages">{msgs.data?.map(m => <li key={m.id}><b>{m.author}</b><small>{time(m.createdAt, p.me.campus.timezone)}</small><p>{m.text}</p></li>)}</ol><form onSubmit={e => { e.preventDefault(); void action.run(() => api(`/rides/${p.rideId}/messages`, { method: 'POST', body: { text } })).then(ok => { if (ok)
        setText(''); }); }}><Field label="Message"><textarea maxLength={1000} required value={text} onChange={e => setText(e.target.value)} placeholder="Meet by the transit shelter?"/></Field><button disabled={action.busy}>Send message</button></form></section></div>;
}
function Inbox(p: WorkspaceProps) { const state = useData<Notification[]>('/notifications', p.version, 15000), action = useAction(p.notify, p.refresh); return <><div className="page-heading"><div><span className="eyebrow">STAY IN THE LOOP</span><h1>Notifications</h1><p>Booking decisions and ride updates, without sharing your class schedule.</p></div></div><Loading state={state}/>{state.data?.map(n => <article className={`panel notification ${n.readAt ? 'read' : ''}`} key={n.id}><div><h3>{n.title}</h3><p>{n.body}</p><small>{day(n.createdAt, p.me.campus.timezone)}</small></div>{!n.readAt && <button className="secondary small" disabled={action.busy} onClick={() => void action.run(() => api(`/notifications/${n.id}/read`, { method: 'POST', body: {} }))}>Mark read</button>}</article>)}</>; }
function Profile(p: WorkspaceProps) { const action = useAction(p.notify, p.refresh), cars = useData<Vehicle[]>('/vehicles', p.version); const [name, setName] = useState(p.me.user.name), [hub, setHub] = useState(p.me.user.homeHubId ?? ''); return <><div className="page-heading"><div><span className="eyebrow">SET UP YOUR COMMUTE</span><h1>Profile & vehicles</h1><p>Only your name and vehicle details appear on ride offers. Your email and schedule are private.</p></div></div><div className="two-column"><section className="panel"><h2>Your profile</h2><form onSubmit={e => { e.preventDefault(); void action.run(async () => { await api('/me', { method: 'PATCH', body: { name, homeHubId: hub || null } }); await p.reloadMe(); }, 'Profile saved.'); }}><Field label="Display name"><input required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)}/></Field><Field label="Public pickup hub"><select value={hub} onChange={e => setHub(e.target.value)}><option value="">Select a pickup hub</option>{p.catalog.hubs.filter(h => !h.isCampus && h.campusId === p.me.user.campusId).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><p className="muted">{p.me.user.email} · email verified</p><button disabled={action.busy}>Save profile</button></form></section><section className="panel"><h2>Add a vehicle</h2><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action.run(() => api('/vehicles', { method: 'POST', body: { label: f.get('label'), color: f.get('color'), seats: Number(f.get('seats')), accessible: f.get('accessible') === 'on' } }), 'Vehicle added.'); }}><Field label="Make and model"><input name="label" required maxLength={80} placeholder="Toyota Prius"/></Field><div className="two-column"><Field label="Color"><input name="color" required maxLength={40}/></Field><Field label="Passenger seats"><input name="seats" type="number" required min={1} max={7} defaultValue={3}/></Field></div><label className="check"><input type="checkbox" name="accessible"/>Vehicle has accessibility accommodations (self-reported)</label><button disabled={action.busy}>Add vehicle</button></form></section></div><section className="panel"><h2>Your vehicles</h2><Loading state={cars}/>{cars.data?.map(c => <p key={c.id}><b>{c.color} {c.label}</b> · {c.seats} passenger seats{c.accessible ? ' · Accessibility accommodations' : ''}</p>)}</section><Notice>Campus email verification confirms control of an address—not enrollment, identity, licensing, insurance, or driving suitability. This portfolio application is not a campus-endorsed transportation service.</Notice></>; }
function Admin(p: WorkspaceProps) { const state = useData<Report[]>('/admin/reports', p.version), action = useAction(p.notify, p.refresh); return <><div className="page-heading"><div><span className="eyebrow">ACCOUNTABLE COORDINATION</span><h1>Moderation</h1><p>Reports are private to moderators. No public safety guarantees are implied.</p></div></div><Loading state={state}/>{state.data?.length === 0 && <Empty title="No reports to review"/>}{state.data?.map(r => <article className="panel" key={r.id}><Badge value={r.status}/><h3>Ride report</h3><p>{r.reason}</p>{r.resolution && <p>Resolution: {r.resolution}</p>}{r.status === 'OPEN' && <div className="button-row"><button disabled={action.busy} onClick={() => { const resolution = prompt('Record your resolution (5+ characters).'); if (resolution)
    void action.run(() => api(`/admin/reports/${r.id}/resolve`, { method: 'POST', body: { resolution } }), 'Report resolved.'); }}>Resolve</button><button className="secondary danger" disabled={action.busy} onClick={() => { if (confirm('Cancel this ride and notify all requesters?'))
    void action.run(() => api(`/rides/${r.rideId}/cancel`, { method: 'POST', body: {} }), 'Ride cancelled.'); }}>Cancel reported ride</button></div>}</article>)}</>; }
