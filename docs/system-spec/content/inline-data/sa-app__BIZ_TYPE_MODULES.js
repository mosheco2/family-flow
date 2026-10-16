// source: public/sa-app.js:14751
const BIZ_TYPE_MODULES = {
    restaurant:         ['pos','sales','pantry','shop','customers','shifts','timeclock','tasks','cashflow','budget','members','calendar','deliveries','foodcost','reviews','menu_templates','routines','reports'],
    retail:             ['pos','sales','pantry','shop','customers','cashflow','budget','members','timeclock','tasks','bank','reports'],
    services:           ['calendar','tasks','customers','cashflow','budget','members','timeclock','bank','pos','sales','reports'],
    construction:       ['equipment','tasks','shifts','timeclock','members','cashflow','customers','bank','shop','pantry','budget','reports'],
    maintenance_repair: ['calendar','tasks','customers','members','timeclock','cashflow','pantry','shop','routines','reports'],
    logistics:          ['members','timeclock','cashflow','tasks','reports'],  // חבילת לוגיסטיקה מכסה את שאר המודולים
    healthcare:         ['calendar','customers','tasks','members','timeclock','cashflow','bank','pos','pantry','reports'],
    beauty:             ['timeclock','cashflow','tasks','shop','reports'],       // חבילת יופי מכסה את שאר המודולים
    education:          ['calendar','academy','tasks','members','timeclock','cashflow','customers','pos','reports'],
    sport:              ['calendar','pos','sales','customers','members','timeclock','cashflow','tasks','equipment','shifts','reports'],
    events:             ['calendar','tasks','customers','members','timeclock','cashflow','budget','equipment','shifts','shop','menu_templates','reports'],
    food_production:    ['pantry','shop','sales','customers','tasks','members','shifts','timeclock','cashflow','equipment','deliveries','foodcost','menu_templates','reports'],
    professional:       ['sales','customers','cases','leads','timelog','documents','calendar','tasks','cashflow','budget','members','timeclock','bank','content','reports'],
    other:              [],
};
