import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Network, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { createDemoSession, createStationSession } from '../security/demoSession';
import { isSupabaseConfigured, signInStation } from '../services/supabaseService';

export function LoginPage() {
  const [show, setShow] = useState(false);
  const [investigatorId, setInvestigatorId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const sharedAccessEnabled = isSupabaseConfigured();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (sharedAccessEnabled) {
        const station = await signInStation(investigatorId, password);
        createStationSession({
          userId: station.userId,
          stationId: station.stationId,
          stationName: station.stationName,
          accessToken: station.accessToken,
        });
      } else {
        createDemoSession(investigatorId);
      }
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-context">
        <div className="login-brand">
          <div><img className="login-logo-image" src="/nexusnet-logo.png" alt="NexusNet" /></div>
          <span><strong>NEXUSNET</strong>INTELLIGENCE</span>
        </div>
        <div className="login-message">
          <span>SIH26189 · Investigative intelligence</span>
          <h1>Connect fragmented records into evidence-backed investigation graphs.</h1>
          <p>Explore cross-case relationships, inspect supporting records and keep every analytical lead subject to human verification.</p>
          <div>
            <span><ShieldCheck />Evidence-first analysis</span>
            <span><Network />Multi-case graph intelligence</span>
            <span><LockKeyhole />Investigator-controlled decisions</span>
          </div>
        </div>
        <small>Investigate · Analyse · Connect</small>
      </section>

      <section className="login-form-wrap">
        <form onSubmit={submit}>
          <span className="eyebrow">Secure access</span>
          <h2>Investigation workspace</h2>
          <p>{sharedAccessEnabled ? 'Sign in with an authorised station account.' : 'Use the demonstration workspace to review the frontend.'}</p>
          <label>
            Station / Investigator ID
            <input
              required
              value={investigatorId}
              onChange={(event) => setInvestigatorId(event.target.value)}
              placeholder="e.g. station-a"
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <div>
              <input
                type={show ? 'text' : 'password'}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <div className="demo-notice">
            <ShieldCheck />
            <span>
              <strong>{sharedAccessEnabled ? 'Cross-station access enabled' : 'Demonstration access'}</strong>
              {sharedAccessEnabled
                ? 'Authorised stations can search shared case records. Every record retains its source station.'
                : 'No credentials are stored or validated while the authentication backend is unavailable.'}
            </span>
          </div>
          {error && <p className="service-disclaimer">{error}</p>}
          <Button disabled={loading}>{loading ? 'Signing in...' : 'Enter workspace'} {!loading && <ArrowRight />}</Button>
          <small>{sharedAccessEnabled ? 'Access is controlled by Supabase Auth and Row-Level Security.' : 'Configure Supabase to enable Station A/B sharing.'}</small>
        </form>
      </section>
    </main>
  );
}
