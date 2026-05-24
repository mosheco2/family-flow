const { test, expect } = require('@playwright/test');

const TEST_ENV = {
  groupCode: 'TEST01',
  parentName: 'אבא',
  parentPass: '123456',
  kidName: 'דני',
  kidPass: '123456'
};

// ============================================================
// ה"מלשין": פונקציה שרצה אחרי כל טסט ומדווחת לשרת שלנו
// ============================================================
test.afterEach(async ({}, testInfo) => {
  // חיפוש המזהה בסוגריים מרובעים (למשל: [FAM-05])
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (match) {
    const testId = match[1];
    const status = testInfo.status === 'passed' ? 'ok' : 'fail';
    
    // שליחת התוצאה לשרת ה-Node.js המקומי שלנו
    await fetch('http://localhost:3000/api/qa/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, status })
    }).catch(err => console.log('QA Report failed:', err));
  }
});

test.describe('Oneflow Life - Family Bank Flow', () => {

  test('[FAM-05] Parent can distribute payday and Kid sees restricted view', async ({ browser }) => {
    // הגדלת זמן ההמתנה לדקה כדי לאפשר לדפדפן להיפתח בפעם הראשונה מבלי לקרוס
    test.setTimeout(60000);
    
    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    
    await parentPage.goto('http://localhost:3000');
    await parentPage.fill('#login-group', TEST_ENV.groupCode);
    await parentPage.fill('#login-nickname', TEST_ENV.parentName);
    await parentPage.fill('#login-password', TEST_ENV.parentPass);
    await parentPage.click('#login-btn');
    
    await parentPage.click('[data-tab="bank"]');
    await parentPage.click('#distribute-allowance-btn');
    
    const kidContext = await browser.newContext();
    const kidPage = await kidContext.newPage();

    await kidPage.goto('http://localhost:3000');
    await kidPage.fill('#login-group', TEST_ENV.groupCode);
    await kidPage.fill('#login-nickname', TEST_ENV.kidName);
    await kidPage.fill('#login-password', TEST_ENV.kidPass);
    await kidPage.click('#login-btn');

    await kidPage.click('[data-tab="bank"]');
    await expect(kidPage.locator('#distribute-allowance-btn')).toBeHidden();
    
    await parentContext.close();
    await kidContext.close();
  });

});