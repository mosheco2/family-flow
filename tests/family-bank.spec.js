const { test, expect } = require('@playwright/test');

// מזהים מוגדרים מראש עבור סביבת הטסטים
const TEST_ENV = {
  groupCode: 'TEST01',
  parentName: 'אבא',
  parentPass: '123456',
  kidName: 'דני',
  kidPass: '123456'
};

test.describe('Oneflow Life - Family Bank Flow', () => {

  test('Parent can distribute payday and Kid sees restricted view', async ({ browser }) => {
    // 1. פתיחת חלון עבור ההורה
    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    
    // התחברות כהורה - ודא שהכתובת תואמת לשרת המקומי שלך
    await parentPage.goto('http://localhost:3000');
    
    // הערה: נצטרך לוודא שה-ID של השדות כאן תואמים בדיוק ל-HTML שלך. 
    // אם המזהים שונים בקובץ app.js/index.html שלך, נתאים אותם בשלב הבא.
    await parentPage.fill('#login-group', TEST_ENV.groupCode);
    await parentPage.fill('#login-nickname', TEST_ENV.parentName);
    await parentPage.fill('#login-password', TEST_ENV.parentPass);
    await parentPage.click('#login-btn');
    
    // ניווט לבנק וחלוקת דמי כיס
    await parentPage.click('[data-tab="bank"]');
    await parentPage.click('#distribute-allowance-btn');
    
    // 2. פתיחת חלון מקביל עבור הילד
    const kidContext = await browser.newContext();
    const kidPage = await kidContext.newPage();

    // התחברות כילד
    await kidPage.goto('http://localhost:3000');
    await kidPage.fill('#login-group', TEST_ENV.groupCode);
    await kidPage.fill('#login-nickname', TEST_ENV.kidName);
    await kidPage.fill('#login-password', TEST_ENV.kidPass);
    await kidPage.click('#login-btn');

    await kidPage.click('[data-tab="bank"]');

    // אכיפת הרשאות: מוודאים שכפתור חלוקת הכסף מוסתר לילד
    await expect(kidPage.locator('#distribute-allowance-btn')).toBeHidden();
    
    // סיום הבדיקה וסגירת חלונות
    await parentContext.close();
    await kidContext.close();
  });

});