'use client';

import type { DrinkEntry } from '../../_lib/types';

interface DrinkLogProps {
  entries: DrinkEntry[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const today = new Date().toDateString();

export default function DrinkLog({ entries, onDelete, onClearAll }: DrinkLogProps) {
  const todayEntries = entries.filter(e => e.date === today).slice().reverse();

  return (
    <div className="log-section" id="ds-logSection">
      <div className="section-title">
        History
        <button className="btn" id="ds-clearAll" style={{ padding: '6px 6px', width: 'unset' }} onClick={onClearAll}>
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
            <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
          </svg>
        </button>
      </div>
      <div className="log-list" id="ds-logList">
        {todayEntries.length === 0
          ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-bottle-water" /></div>Nothing logged yet.<br />Time for a glass of water!</div>
          : (
            <>
              <div className="log-date-header">Today</div>
              {todayEntries.map(e => (
                <div key={e.id} className="log-item" data-id={e.id}>
                  <div className="log-emoji no-select"><i className={e.emoji} /></div>
                  <div className="log-info">
                    <div className="log-name">{e.drink}</div>
                    <div className="log-time">{fmtTime(e.ts)}</div>
                  </div>
                  <div className="log-amount">+{e.amount} ml</div>
                  <button className="log-delete" onClick={() => onDelete(e.id)}>
                    <svg height="20" viewBox="0 -960 960 960" width="20" fill="var(--text3)">
                      <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )
        }
      </div>
    </div>
  );
}
