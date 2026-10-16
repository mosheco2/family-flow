// source: public/sa-app.js:944
const SA_PENDING_ITEM_ACTIONS = {
    tickets: (item) => { if (typeof openSATicketModal === 'function') openSATicketModal(item.id); },
    debts: (item) => {
        switchSATab('finance');
        setTimeout(() => switchViewTab('finance', 'adsbilling'), 200);
        setTimeout(() => { if (typeof openClientLedger === 'function') openClientLedger(item.id, item.title); }, 500);
    },
    modules: (item) => _saPendingExpandGroup(item.id, item.title),
    community_join: (item) => { switchSATab('comm'); setTimeout(() => { switchViewTab('comm','manage'); _saPendingHighlight(item.title, 400); }, 250); },
    biz_community:  (item) => { switchSATab('comm'); setTimeout(() => { switchViewTab('comm','manage'); _saPendingHighlight(item.title, 400); }, 250); },
    removal:        (item) => { switchSATab('comm'); setTimeout(() => { switchViewTab('comm','manage'); _saPendingHighlight(item.title, 400); }, 250); },
    promos:         (item) => { switchSATab('comm'); setTimeout(() => { switchViewTab('comm','manage'); _saPendingHighlight(item.title, 400); }, 250); },
    zm_pending:     (item) => { switchSATab('partners'); _saPendingHighlight(item.subtitle || item.title, 500); },
    banners:        (item) => { switchSATab('adslots'); setTimeout(() => { switchViewTab('adslots','orders'); _saPendingHighlight(item.title, 400); }, 250); }
};
