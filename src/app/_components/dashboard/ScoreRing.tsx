'use client';

interface ScoreRingProps {
    score: number;
}

const SCORE_CIRC = 2 * Math.PI * 48;

export default function ScoreRing({ score }: ScoreRingProps) {
    const offset = SCORE_CIRC * (1 - score / 100);

    return (
        <div className="dashboard-score" aria-label="Daily progress score">
            <svg viewBox="0 0 112 112" className="dashboard-score-ring">
                <defs>
                    <linearGradient id="dashboardScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#b3cbf9" />
                        <stop offset="100%" stopColor="#5948cf" />
                    </linearGradient>
                </defs>
                <circle className="dashboard-score-track" cx="56" cy="56" r="48" />
                <circle
                    className="dashboard-score-fill"
                    id="dashboardScoreRing"
                    cx="56" cy="56" r="48"
                    style={{ strokeDasharray: SCORE_CIRC, strokeDashoffset: offset }}
                />
            </svg>
            <div className="dashboard-score-inner">
                <span id="dashboardScore">{score}</span>
                <small>%</small>
            </div>
        </div>
    );
}
