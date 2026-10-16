// source: public/business-app.js:21004
const WIZARD_STEPS_BY_TYPE_V2 = {
    restaurant:   ['identity', 'modules', 'food_type', 'menu', 'my_role', 'team'],
    beauty:       ['identity', 'modules', 'practitioners', 'services', 'my_role', 'team'],
    sport:        ['identity', 'modules', 'trainer', 'subscriptions', 'schedule', 'my_role', 'team'],
    services:     ['identity', 'modules', 'service_types', 'billing_flow', 'first_customer', 'my_role', 'team'],
    // תחזוקה ותיקונים חסר מהמפה — נופל בעבר ל-'other' הגנרי, למרות שלב service_types כבר בנוי סביב תחומי תיקונים
    // (מיזוג אוויר/אינסטלציה/חשמל/מנעולנות וכו') ו-repairServices — אותו רצף שירותים מתאים כאן ישירות
    maintenance_repair: ['identity', 'modules', 'service_types', 'billing_flow', 'first_customer', 'my_role', 'team'],
    professional: ['identity', 'modules', 'case_type', 'first_case', 'document_template', 'my_role', 'team'],
    other:        ['identity', 'modules', 'catalog', 'my_role', 'team'],
    store_only:   ['identity', 'modules', 'catalog'],
};
