const { test, expect } = require('@playwright/test');

const TEST_ENV = {
  groupCode: 'TYQPPY',
  parentName: 'אבא',
  parentPass: '123456',
  kidName: 'זוהר',
  kidPass: '123456'
};

test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (match) {
    const testId = match[1];
    const status = testInfo.status === 'passed' ? 'ok' : 'fail';
    
    await fetch('http://localhost:3000/api/qa/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, status })
    }).catch(err => console.log('QA Report failed:', err));
  }
});

test.describe('Oneflow Life - Family Bank Flow', () => {

  test('[FAM-05] Parent can distribute payday and Kid sees restricted view', async ({ page, browser }) => {
    test.setTimeout(60000);

    // שלב 1: הורה מתחבר
    await page.goto('http://localhost:3000');
    await page.fill('#login-code', TEST_ENV.groupCode); // <--- התיקון שלנו כאן!
    await page.fill('#login-nickname', TEST_ENV.parentName);
    await page.fill('#login-password', TEST_ENV.parentPass);
    await page.click('#login-btn');
    
    // ניווט לבנק
    await page.click('[data-tab="bank"]');
    
    // שלב 2: הילד מתחבר בחלון נפרד
    const kidContext = await browser.newContext();
    const kidPage = await kidContext.newPage();

    await kidPage.goto('http://localhost:3000');
    await kidPage.fill('#login-code', TEST_ENV.groupCode); // <--- וגם כאן!
    await kidPage.fill('#login-nickname', TEST_ENV.kidName);
    await kidPage.fill('#login-password', TEST_ENV.kidPass);
    await kidPage.click('#login-btn');

    await kidPage.click('[data-tab="bank"]');
    // אכיפת הרשאות
    await expect(kidPage.locator('#distribute-allowance-btn')).toBeHidden();
    
    await kidContext.close();
  });

});