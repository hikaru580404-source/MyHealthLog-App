/* =============================================
   summary.css - ダークテーマ完全統合版
   ============================================= */

.summary-header {
  padding: 1.2rem 1.5rem;
  background: transparent;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex; justify-content: space-between; align-items: center;
  position: sticky; top: 0; z-index: 10;
}
.header-title {
  font-size: 1.1rem; font-weight: 800; font-family: var(--font-en);
  letter-spacing: 0.1em; color: var(--clr-text-primary);
}
.nav-back-premium {
  color: var(--clr-text-primary); text-decoration: none;
  font-size: 1.2rem; transition: opacity 0.2s;
}

.summary-container { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }

.history-card {
  background: var(--clr-surface); border-radius: var(--radius-lg);
  border: 1px solid var(--clr-border); overflow: hidden;
  backdrop-filter: blur(10px); box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; }

th {
  background: rgba(0,0,0,0.3); padding: 1rem 1.2rem;
  font-size: 0.75rem; font-weight: 700; font-family: var(--font-en);
  color: var(--clr-text-secondary); text-transform: uppercase;
  letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.1);
}
td {
  padding: 1.2rem; font-size: 0.95rem; border-bottom: 1px solid rgba(255,255,255,0.05);
  font-family: var(--font-en); color: var(--clr-text-primary); transition: background-color 0.2s ease;
}
tbody tr:hover td { background-color: rgba(255,255,255,0.03); }

.col-date { font-weight: 600; white-space: nowrap; }
.col-date .dow { font-size: 0.75rem; color: var(--clr-text-secondary); font-weight: 400; margin-left: 4px; }

.col-val { font-weight: 600; text-align: right; white-space: nowrap; }
th.col-val { text-align: right; }

.col-mental { font-family: var(--font-jp); text-align: center; }
th.col-mental { text-align: center; }

.col-note { font-family: var(--font-jp); color: var(--clr-text-secondary); font-size: 0.85rem; line-height: 1.5; min-width: 200px; }

.badge-mental {
  display: inline-block; padding: 0.3rem 0.8rem; border-radius: 99px;
  font-weight: 700; font-size: 0.75rem; letter-spacing: 0.05em;
}

/* 5段階のコンディションカラー定義（ダークテーマのネオン風発色） */
.m-5 { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); } /* 絶好調 */
.m-4 { background: rgba(56, 189, 248, 0.15); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.3); } /* 良 */
.m-3 { background: rgba(255, 255, 255, 0.1); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.2); } /* 並 */
.m-2 { background: rgba(249, 115, 22, 0.15); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); } /* 低調 */
.m-1 { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); } /* 不調 */

@media (max-width: 640px) {
  .summary-header { padding: 1rem; }
  .summary-container { margin: 1rem auto; }
  td, th { padding: 1rem 0.8rem; font-size: 0.85rem; }
  .col-note { min-width: 150px; }
}