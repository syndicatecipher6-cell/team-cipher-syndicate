import { useState } from 'react';
import {
  Search,
  Filter,
  Users,
  Phone,
  Car,
  Landmark,
  Briefcase,
  ArrowUpRight,
  UploadCloud,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvestigation } from '../context/InvestigationContext';
import { EntityBadge } from '../components/ui';

export function EntitiesIdentitiesPage() {
  const { dataset, isDataLoaded, loadSampleSIHData } = useInvestigation();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const navigate = useNavigate();

  const allItems = dataset.searchResults;

  const filtered = allItems.filter((item) => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesQuery =
      !search ||
      `${item.label} ${item.secondary} ${item.id}`.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesQuery;
  });

  return (
    <div className="entities-page-wrapper">
      <div className="entities-header-row">
        <div>
          <h1 className="dashboard-title">Entities & Identities</h1>
          <p className="dashboard-subtitle">
            Normalized entities, resolved aliases, and cross-case criminal profiles.
          </p>
        </div>
        <div className="entities-stat-pill">
          <strong>{allItems.length}</strong> Entities Tracked
        </div>
      </div>

      {!isDataLoaded ? (
        <div className="clean-workspace-card">
          <div className="clean-icon-circle">
            <Users size={36} />
          </div>
          <h2>No Entities Extracted Yet</h2>
          <p>
            The identity resolution engine has not ingested any source records. Upload FIRs, CDR files,
            or banking records to automatically extract and resolve suspects, aliases, and identifiers.
          </p>
          <div className="clean-actions-row">
            <button className="primary-action-btn" onClick={() => navigate('/ingestion')}>
              <UploadCloud size={16} />
              Go to Data Ingestion
            </button>
            <button className="secondary-action-btn" onClick={() => void loadSampleSIHData()}>
              <Sparkles size={16} />
              Load Sample SIH Dataset
            </button>
          </div>
        </div>
      ) : (
        <div className="entities-table-container">
          {/* Search & Filters */}
          <div className="entities-controls-bar">
            <div className="entities-search-input">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone number, vehicle plate, or case ID..."
              />
            </div>

            <div className="entities-filter-pills">
              <Filter size={14} className="text-muted" />
              {['all', 'person', 'phone', 'vehicle', 'account', 'case'].map((type) => (
                <button
                  key={type}
                  className={`filter-pill ${filterType === type ? 'active' : ''}`}
                  onClick={() => setFilterType(type)}
                >
                  {type === 'all' ? 'All Entities' : `${type.charAt(0).toUpperCase() + type.slice(1)}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Results Table */}
          <div className="entities-table-wrap">
            <div className="entities-table-header">
              <span>Entity / Identifier</span>
              <span>Type</span>
              <span>Related Cases</span>
              <span>Connections</span>
              <span>Source Record</span>
              <span />
            </div>

            {filtered.length === 0 ? (
              <div className="entities-empty-result">
                <p>No matching entities found for "{search}".</p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className="entities-table-row"
                  onClick={() => {
                    if (item.type === 'person') navigate(`/persons/${item.id}`);
                    else if (item.type === 'case') navigate(`/cases/${item.id}`);
                    else navigate(`/graph?entityId=${item.id}`);
                  }}
                >
                  <div className="entity-main-cell">
                    <span className="entity-type-icon-wrap">
                      {item.type === 'person' && <Users size={16} />}
                      {item.type === 'phone' && <Phone size={16} />}
                      {item.type === 'vehicle' && <Car size={16} />}
                      {item.type === 'account' && <Landmark size={16} />}
                      {item.type === 'case' && <Briefcase size={16} />}
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.secondary}</small>
                    </div>
                  </div>

                  <div>
                    <EntityBadge type={item.type} />
                  </div>

                  <div>
                    <span className="case-tag">
                      {item.relatedCases.length ? item.relatedCases.join(', ') : 'Direct Entity'}
                    </span>
                  </div>

                  <div>
                    <strong className="text-accent">{item.relationshipCount} links</strong>
                  </div>

                  <div>
                    <span className="source-record-label">{item.source || 'Ingested Record'}</span>
                  </div>

                  <div>
                    <ArrowUpRight size={15} className="row-arrow" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
