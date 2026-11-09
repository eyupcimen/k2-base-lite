import type { CalcResult } from '../lib/api';
import { downloadCsv } from '../lib/csv';

interface Props { data: CalcResult | null; loading: boolean; error: string | null }

const DISCLAIMER = 'Simplified estimate, not a certified structural calculation (EN 1991).';
const fmt = (n: number, d = 1) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

export default function ResultsPanel({ data, loading, error }: Props) {
  const kpis = data ? [
    ['Panels', String(data.total_panels)],
    ['Power', `${fmt(data.total_power_kwp, 2)} kWp`],
    ['Runs', String(data.runs ?? '–')],
    ['Total rail length', `${fmt(data.rail_length_m)} m`],
    ['Weight', `${fmt(data.system_weight_kg)} kg`],
  ] : [];
  const ok = data?.load_check.status === 'ok';
  return (
    <aside className="card panel results" aria-label="Results" aria-busy={loading}>
      <div className="results-head">
        <h2>Results</h2>
        <span className="status-line" role="status">{loading ? 'Calculating…' : data ? 'Up to date' : ''}</span>
      </div>
      {error && <p className="alert alert-danger" role="alert"><strong>Error.</strong> {error}</p>}
      {data && (
        <>
          <dl className="kpis">
            {kpis.map(([k, v]) => <div key={k} className="kpi"><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <div className={`alert ${ok ? 'alert-success' : 'alert-warning'}`}>
            <strong>{ok ? '✓ Load check OK' : '! Load check warning'}</strong>
            <span>{data.load_check.message}</span>
          </div>
        </>
      )}
      <p className="disclaimer">{data?.load_check.disclaimer ?? DISCLAIMER}</p>
      {data && (
        <>
          <div className="table-wrap">
            <table className="bom">
              <thead><tr><th>Item</th><th>Description</th><th className="num">Qty</th><th>Unit</th></tr></thead>
              <tbody>
                {data.bom.map((b) => (
                  <tr key={b.item_number}><td className="mono">{b.item_number}</td><td>{b.description}</td><td className="num">{b.quantity}</td><td>{b.unit}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-primary" onClick={() => downloadCsv(data.bom)}>Export CSV</button>
        </>
      )}
    </aside>
  );
}
