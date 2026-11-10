import { useState, type FormEvent } from 'react';
import { geocode, type GeoResult } from '../lib/api';
import { MAP_ATTRIBUTION } from '../lib/mapImage';

interface Props { onPick: (r: GeoResult) => void; busy: boolean }

export default function AddressSearch({ onPick, busy }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) { setError('Type at least 3 characters.'); return; }
    setLoading(true); setError(null);
    try { setResults(await geocode(q.trim())); } catch (err) { setError(err instanceof Error ? err.message : 'Search failed'); setResults(null); }
    finally { setLoading(false); }
  };

  return (
    <div className="addr">
      <form className="addr-form" role="search" onSubmit={search}>
        <label className="field">
          <span>Find by address (no measuring needed)</span>
          <input type="search" value={q} maxLength={200} placeholder="Street, city" onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="submit" className="btn-secondary" disabled={loading || busy}>{loading ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p className="alert alert-danger">{error}</p>}
      {results && (results.length ? (
        <ul className="addr-results" aria-label="Address results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" className="addr-item" disabled={busy} onClick={() => { onPick(r); setResults(null); }}>{r.label}</button>
            </li>
          ))}
        </ul>
      ) : <p className="hint">No matches.</p>)}
      {busy && <p className="hint" role="status">Loading satellite image…</p>}
      <p className="addr-attrib">{MAP_ATTRIBUTION.join(' · ')}</p>
    </div>
  );
}
