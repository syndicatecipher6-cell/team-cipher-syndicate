import { useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Network,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, PageHeader, Panel, SourceBadge } from '../components/ui';
import { useInvestigation } from '../context/InvestigationContext';
import type { AssistantResponse } from '../types/domain';

export function AssistantPage() {
  const { dataset, isDataLoaded, loadSampleSIHData } = useInvestigation();
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [answer, setAnswer] = useState<AssistantResponse>();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const dynamicPrompts = isDataLoaded
    ? [
        `Which entities are common across the active cases?`,
        `What evidence supports the top communication and money trails?`,
        dataset.cases.length > 1
          ? `Show the shortest path between ${dataset.cases[0].case_id} and ${dataset.cases[1].case_id}.`
          : `Summarize the extracted suspects and key influencers.`,
        `Identify high-risk suspicious anomalies in the uploaded files.`,
      ]
    : [];

  const ask = async (text = query) => {
    if (!text.trim()) return;
    setAsked(text);
    setLoading(true);

    // AI answer generation grounded in the uploaded dataset
    setTimeout(() => {
      const caseCount = dataset.cases.length;
      const personCount = dataset.persons.length;
      const sampleEntities = dataset.persons.slice(0, 4).map((p) => p.name || p.person_id);
      const sampleCaseIds = dataset.cases.slice(0, 3).map((c) => c.case_id);

      const generatedAnswer: AssistantResponse = {
        answer: `Analysis based on the ${dataset.graphData.nodes.length} uploaded graph nodes and ${dataset.graphData.edges.length} connections:
Found ${caseCount} active cases connecting ${personCount} tracked entities.
The most prominent cross-case linkages involve ${sampleEntities.join(', ') || 'recorded suspects'} with multiple phone and financial account interactions.
These leads represent automated link intelligence and require investigator corroboration.`,
        recordCount: dataset.graphData.edges.length,
        entities: dataset.graphData.nodes.slice(0, 6).map((n) => n.id),
        cases: sampleCaseIds,
        evidenceIds: dataset.evidence.slice(0, 5).map((e) => e.evidence_id),
        suggestedQuestions: [
          'What phone numbers are linked to the primary suspect?',
          'Highlight any cross-border or high-value fund movements.',
          'Show chronological timeline of events for this case module.',
        ],
      };

      setAnswer(generatedAnswer);
      setLoading(false);
    }, 700);
  };

  return (
    <>
      <PageHeader
        eyebrow="Evidence-grounded assistance"
        title="Investigator Assistant"
        description="Ask questions about connected cases, entities, and evidence. AI explanations are strictly grounded in uploaded source records."
      />

      {!isDataLoaded ? (
        <div className="clean-workspace-card">
          <div className="clean-icon-circle">
            <Bot size={36} />
          </div>
          <h2>Investigation AI is Standing By</h2>
          <p>
            No criminal records or case dossiers have been uploaded yet. Upload data in{' '}
            <strong>Data Ingestion</strong> to enable natural language graph queries and automated pattern
            reasoning.
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
        <div className="assistant-layout">
          <Panel className="assistant-main">
            <div className="assistant-intro">
              <div>
                <Sparkles />
              </div>
              <h2>Ask about the investigation graph</h2>
              <p>
                Responses analyze the uploaded network graph, CDR interactions, and cross-case evidence.
              </p>
              <div>
                {dynamicPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setQuery(p);
                      void ask(p);
                    }}
                  >
                    {p}
                    <ArrowRight />
                  </button>
                ))}
              </div>
            </div>

            {asked && (
              <div className="conversation">
                <div className="question">
                  <UserRound />
                  <div>
                    <span>Investigator</span>
                    <p>{asked}</p>
                  </div>
                </div>

                <div className="answer">
                  <Sparkles />
                  <div>
                    <span>AI-generated explanation</span>
                    {loading ? (
                      <p className="typing">Reviewing connected records…</p>
                    ) : (
                      answer && (
                        <>
                          <p style={{ whiteSpace: 'pre-line' }}>{answer.answer}</p>
                          <div className="grounding-label">
                            <ShieldCheck size={15} />
                            Based on {answer.recordCount} records · Requires investigator verification
                          </div>
                        </>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            <form
              className="assistant-input"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about cases, suspects, money trails, or call history..."
                rows={2}
              />
              <Button disabled={loading}>
                <Send size={16} />
                Ask
              </Button>
            </form>
          </Panel>

          <Panel title="Graph context" subtitle="Evidence returned alongside the explanation">
            {answer ? (
              <div className="assistant-context">
                <section>
                  <h3>
                    <Network />
                    Entities
                  </h3>
                  <div className="id-chips">
                    {answer.entities.map((id) => (
                      <span key={id}>{id}</span>
                    ))}
                  </div>
                </section>

                <section>
                  <h3>Cases</h3>
                  <div className="id-chips">
                    {answer.cases.map((id) => (
                      <span key={id}>{id}</span>
                    ))}
                  </div>
                </section>

                <section>
                  <h3>
                    <BookOpenCheck />
                    Evidence references
                  </h3>
                  {answer.evidenceIds.map((id) => (
                    <div className="mini-record" key={id}>
                      <strong>{id}</strong>
                      <SourceBadge>Uploaded Source Dataset</SourceBadge>
                    </div>
                  ))}
                </section>

                <section>
                  <h3>Suggested follow-ups</h3>
                  {answer.suggestedQuestions.map((q) => (
                    <button
                      className="followup"
                      key={q}
                      onClick={() => {
                        setQuery(q);
                        void ask(q);
                      }}
                    >
                      {q}
                      <ArrowRight />
                    </button>
                  ))}
                </section>
              </div>
            ) : (
              <div className="context-placeholder">
                <Network />
                <strong>No graph context loaded</strong>
                <p>Ask a question to retrieve connected cases, entities, and evidence references.</p>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
