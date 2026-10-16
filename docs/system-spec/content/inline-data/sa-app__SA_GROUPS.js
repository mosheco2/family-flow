// source: public/sa-app.js:532
const SA_GROUPS = {
    home:       { tabs: ['pulse', 'insights', 'stats'], labels: ['דופק מערכת', 'תובנות מאוחדות', 'דוחות'], icons: ['fa-heart-pulse', 'fa-chart-pie', 'fa-chart-line'], default: 'pulse' },
    customers:  { tabs: ['comm', 'biz', 'clients', 'feed'],  labels: ['קהילות', 'עסקים', 'סביבות', 'פיד קהילתי'],  icons: ['fa-users-rays', 'fa-store', 'fa-users', 'fa-rss'],  default: 'comm' },
    shukagrp:   { tabs: ['shuka'], labels: [], icons: [], default: 'shuka' },
    finance:    { tabs: ['finance'],                    labels: [],                                  icons: [],                                         default: 'finance' },
    supportdev: { tabs: ['support', 'devops'],          labels: ['קריאות שירות', 'פיתוח ומוצר'],    icons: ['fa-headset', 'fa-code'],                  default: 'support' },
    contentmkt: { tabs: ['content', 'inbox', 'legal', 'adslots', 'games', 'marketing', 'kol-haam'],  labels: ['מיתוג ותוכן', 'שיווק', 'משפטי', 'שטחי פרסום', 'משחקי ילדים', 'שיווק והשקות', 'קול העם'], icons: ['fa-image', 'fa-bullhorn', 'fa-file-contract', 'fa-rectangle-ad', 'fa-gamepad', 'fa-whatsapp', 'fa-bullhorn'], default: 'content' },
    livegamesgrp: { tabs: ['livegames'], labels: ['משחקים חיים'], icons: ['fa-bolt'], default: 'livegames' },
    partners:   { tabs: ['partners'],                   labels: [],                                  icons: [],                                         default: 'partners' },
    system:     { tabs: ['hr', 'sysmap', 'auditlog', 'archive'], labels: ['צוות ונציגים', 'מפת המערכת', 'לוג אירועים', 'ארכיון מחוקים'], icons: ['fa-user-tie', 'fa-map', 'fa-shield-halved', 'fa-box-archive'], default: 'hr' },
    templates:  { tabs: ['templates'],                  labels: ['תבניות עסקים'],                    icons: ['fa-layer-group'],                          default: 'templates' },
    whatsapp:   { tabs: ['whatsapp'],                   labels: ['מרכז WhatsApp'],                   icons: ['fa-whatsapp'],                             default: 'whatsapp' },
    pricing:    { tabs: ['pricing'],                    labels: ['מחירון מודולים'],                  icons: ['fa-tags'],                                 default: 'pricing' },
    aibuilder:  { tabs: ['ai-builder'],                 labels: ['מחולל עסקים AI'],                  icons: ['fa-wand-magic-sparkles'],                  default: 'ai-builder' },
    masterconfig: { tabs: ['masterconfig'],             labels: ['הגדרות חיבורים'],                   icons: ['fa-database'],                             default: 'masterconfig' },
};
