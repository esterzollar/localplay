import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import { TrashIcon } from './Icons';

export default function VocabularyPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Review states
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const fetchDeckData = () => {
    setLoading(true);
    Promise.all([client.getReviewQueue(), client.getBoardCards()])
      .then(([queueData, deckData]) => {
        setQueue(queueData);
        setDeck(deckData);
        setActiveIndex(0);
        setShowAnswer(false);
      })
      .catch((err) => {
        console.error('Failed to load vocabulary data:', err);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDeckData();
  }, []);

  const handleGrade = async (rating) => {
    if (activeIndex >= queue.length) return;
    const card = queue[activeIndex];
    try {
      await client.reviewWord(card.id, rating);
      // Advance to next card
      setShowAnswer(false);
      setActiveIndex(prev => prev + 1);
      
      // Update local deck data
      client.getBoardCards().then(setDeck).catch(console.error);
    } catch (err) {
      console.error('Failed to submit card review:', err);
    }
  };

  const handleDeleteCard = async (cardId) => {
    try {
      await client.deleteBoardCard(cardId);
      setDeck(prev => prev.filter(c => c.id !== cardId));
      setQueue(prev => prev.filter(c => c.id !== cardId));
    } catch (err) {
      console.error('Failed to delete card:', err);
    }
  };

  if (loading) return <div style={styles.message}>Loading vocabulary deck…</div>;
  if (error) return <div style={styles.message}>Error loading vocabulary study board.</div>;

  const currentCard = activeIndex < queue.length ? queue[activeIndex] : null;
  const dueCount = queue.length - activeIndex;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.headerIcon}>📚</div>
          <div>
            <h1 style={styles.title}>Vocabulary Review Board</h1>
            <p style={styles.subtitle}>Spaced Repetition (SM-2) active recall cards</p>
          </div>
        </div>
      </div>

      {/* Review Section */}
      <div style={styles.deckSection}>
        <div style={styles.cardHeader}>
          <h2 style={styles.sectionTitle}>Review Session</h2>
          <span style={styles.badge}>
            {dueCount > 0 ? `${dueCount} cards due today` : 'Session complete'}
          </span>
        </div>

        {currentCard ? (
          <div style={styles.flashcard}>
            {/* Front of card */}
            <div style={styles.cardFront}>
              <div style={styles.cardWord}>{currentCard.word.word}</div>
              {currentCard.word.phonetic && (
                <div style={styles.cardPhonetic}>/{currentCard.word.phonetic}/</div>
              )}
            </div>

            {/* Back of card (revealed) */}
            {showAnswer ? (
              <div style={styles.cardBack}>
                <div style={styles.cardDivider} />
                <div style={styles.cardLabel}>Definition</div>
                <div style={styles.cardText}>{currentCard.word.definition}</div>

                {currentCard.word.example_sentence && (
                  <>
                    <div style={styles.cardLabel}>Example Sentence</div>
                    <div style={styles.cardExample}>"{currentCard.word.example_sentence}"</div>
                  </>
                )}

                <div style={styles.cardLabel}>Video Context</div>
                <div style={styles.contextRow}>
                  <div style={styles.contextText}>
                    "...{currentCard.video?.title && <strong>{currentCard.video.title}</strong>}: timestamp jumping available..."
                  </div>
                  <button
                    onClick={() => navigate(`/watch/${currentCard.video_id}`)}
                    style={styles.contextBtn}
                  >
                    🎬 Watch Video
                  </button>
                </div>

                {/* SM-2 grading choices */}
                <div style={styles.gradeSection}>
                  <div style={styles.gradeTitle}>How well did you recall this word?</div>
                  <div style={styles.gradeGrid}>
                    {[
                      { val: 0, label: '0', desc: 'Forgot' },
                      { val: 1, label: '1', desc: 'Hard' },
                      { val: 2, label: '2', desc: 'Weak' },
                      { val: 3, label: '3', desc: 'OK' },
                      { val: 4, label: '4', desc: 'Good' },
                      { val: 5, label: '5', desc: 'Easy' }
                    ].map(g => (
                      <button
                        key={g.val}
                        onClick={() => handleGrade(g.val)}
                        style={styles.gradeBtn(g.val)}
                        title={g.desc}
                      >
                        <span style={styles.gradeNum}>{g.label}</span>
                        <span style={styles.gradeLabel}>{g.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAnswer(true)}
                style={styles.revealBtn}
              >
                Reveal Definition
              </button>
            )}
          </div>
        ) : (
          <div style={styles.allCaughtUpCard}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginTop: 12 }}>All caught up!</h3>
            <p style={{ fontSize: 13, color: 'var(--yt-text-secondary)', marginTop: 4, maxWidth: 300, textAlign: 'center' }}>
              You reviewed all due cards. Watch videos with subtitle glossaries to bookmark more words.
            </p>
          </div>
        )}
      </div>

      {/* Deck List Section */}
      <div style={{ marginTop: 40 }}>
        <h2 style={styles.sectionTitle}>Your Vocabulary Deck ({deck.length} words)</h2>
        {deck.length === 0 ? (
          <div style={styles.emptyDeck}>No words bookmarked on your board yet.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.trHead}>
                  <th style={styles.th}>Word</th>
                  <th style={styles.th}>Definition</th>
                  <th style={styles.th}>Repetitions</th>
                  <th style={styles.th}>Interval</th>
                  <th style={styles.th}>Ease Factor</th>
                  <th style={styles.th}>Next Review</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deck.map(card => {
                  const isOverdue = new Date(card.next_review_at) <= new Date();
                  return (
                    <tr key={card.id} style={styles.trBody}>
                      <td style={styles.tdWord}>{card.word.word}</td>
                      <td style={styles.tdDef}>{card.word.definition}</td>
                      <td style={styles.td}>{card.repetitions}</td>
                      <td style={styles.td}>{card.interval_days} {card.interval_days === 1 ? 'day' : 'days'}</td>
                      <td style={styles.td}>{card.ease_factor.toFixed(2)}</td>
                      <td style={styles.td}>
                        <span style={{
                          color: isOverdue ? 'var(--yt-red, #ff4e45)' : 'var(--yt-text-secondary)'
                        }}>
                          {isOverdue ? 'Due Now' : new Date(card.next_review_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          style={styles.deleteBtn}
                          title="Delete card"
                        >
                          <TrashIcon width={14} height={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 32px 48px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    marginBottom: 32,
    borderBottom: '1px solid var(--yt-border)',
    paddingBottom: 24,
  },
  headerIcon: {
    fontSize: 28,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--yt-text-secondary)',
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: 'var(--accent-color, #6366f1)',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--yt-text-primary)',
  },
  deckSection: {
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--yt-border)',
    paddingBottom: 16,
    marginBottom: 20,
  },
  flashcard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    padding: '12px 0 24px',
  },
  cardFront: {
    textAlign: 'center',
  },
  cardWord: {
    fontSize: 32,
    fontWeight: 800,
    color: '#fff',
    textTransform: 'capitalize',
    letterSpacing: '-0.5px',
  },
  cardPhonetic: {
    fontSize: 16,
    color: 'var(--yt-text-secondary)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  revealBtn: {
    backgroundColor: 'var(--accent-color, #6366f1)',
    color: '#fff',
    border: 'none',
    borderRadius: 24,
    padding: '12px 32px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16,
    transition: 'opacity 0.15s',
  },
  allCaughtUpCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
  },
  cardBack: {
    width: '100%',
    maxWidth: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    animation: 'fadeIn 0.2s ease',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'var(--yt-border)',
    margin: '12px 0',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--yt-text-secondary)',
    letterSpacing: '1px',
    marginTop: 6,
  },
  cardText: {
    fontSize: 15,
    lineHeight: '22px',
    color: 'var(--yt-text-primary)',
  },
  cardExample: {
    fontSize: 14,
    lineHeight: '20px',
    color: 'var(--yt-text-secondary)',
    fontStyle: 'italic',
  },
  contextRow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  contextText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    flex: 1,
  },
  contextBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s',
  },
  gradeSection: {
    borderTop: '1px solid var(--yt-border)',
    paddingTop: 20,
    marginTop: 20,
  },
  gradeTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--yt-text-primary)',
    textAlign: 'center',
    marginBottom: 12,
  },
  gradeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 8,
  },
  gradeBtn: (val) => {
    // Custom colors depending on rating (green for easy, red for bad)
    const colors = [
      '#ef4444', // 0: red
      '#f97316', // 1: orange-red
      '#f59e0b', // 2: orange
      '#eab308', // 3: yellow
      '#84cc16', // 4: lime
      '#10b981'  // 5: green
    ];
    return {
      backgroundColor: '#1b1b1b',
      border: '1px solid #333',
      borderRadius: 8,
      padding: '8px 4px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      transition: 'border-color 0.15s, background-color 0.15s',
      ':hover': {
        borderColor: colors[val],
        backgroundColor: 'rgba(255,255,255,0.02)'
      }
    };
  },
  gradeNum: {
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
  },
  gradeLabel: {
    fontSize: 10,
    color: 'var(--yt-text-secondary)',
  },
  emptyDeck: {
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: 14,
    padding: '48px 24px',
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: 12,
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: 12,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: 13,
  },
  trHead: {
    borderBottom: '1px solid var(--yt-border)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  th: {
    padding: '12px 16px',
    fontWeight: 600,
    color: 'var(--yt-text-secondary)',
  },
  trBody: {
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  td: {
    padding: '14px 16px',
    color: 'var(--yt-text-secondary)',
  },
  tdWord: {
    padding: '14px 16px',
    fontWeight: 700,
    color: '#fff',
    textTransform: 'capitalize',
  },
  tdDef: {
    padding: '14px 16px',
    color: 'var(--yt-text-primary)',
    maxWidth: 350,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--yt-text-secondary)',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, background-color 0.15s',
  },
  message: {
    padding: '80px 40px',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '16px',
  }
};
