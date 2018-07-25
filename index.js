'use strict';
const puppeteer = require('puppeteer');
const inquirer = require('inquirer');

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

async function main() {
  let { username, password } = await promptForCredentials();
  let browser = await puppeteer.launch({ /* slowMo: 200, headless: false */ });
  let page = await browser.newPage();

  let packageUrls = await getAllPackageUrls(page, username);

  packageUrls = packageUrls.filter(packageUrl => {
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // ADD YOUR OWN CUSTOM LOGIC TO WHICH PACKAGES YOU WANT TO ENABLE 2FA FOR
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    return true;
  });

  console.log('Updating OTP settings for all packages...');

  for (let packageUrl of packageUrls) {
    let accessUrl = packageUrl + '/access';
    console.log('Navigating to ' + accessUrl);
    await page.goto(accessUrl);
    await ensureLoggedInAndEscalated(page, username, password);
    await update2faSettingsIfNecessary(page, accessUrl);
  }

  console.log('Done!');

  await browser.close();
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function submitForm(page, selector) {
  let navigationPromise = page.waitForNavigation();
  await page.click(selector);
  await navigationPromise;
}

async function getAllPackageUrls(page, username) {
  console.log('Finding all your npm packages...');

  await page.goto(`https://www.npmjs.com/~${username}`);

  async function findMore() {
    let links = await page.$$('a');
    let results = await Promise.all(links.map(async link => {
      let textContent = await page.evaluate(link => link.textContent, link);
      return { link, textContent };
    }));
    let match = results.find(res => res.textContent.toLowerCase().includes('show more packages'));
    return match ? match.link : null;
  }

  let more = null;
  while ((more = await findMore())) {
    let requestPromise = page.waitForRequest(req => req.url().startsWith(`https://www.npmjs.com/~${username}?page=`));
    await more.click();
    await requestPromise;
    await wait(200);
  }

  let packageLinks = await page.$$('section a[href^="/package/"]');

  let packageUrls = await Promise.all(packageLinks.map(async link => {
    return await page.evaluate(link => link.href, link);
  }));

  return packageUrls;
}

async function promptForCredentials() {
  let { username, password } = await inquirer.prompt([{
    type: 'input',
    name: 'username',
    message: 'Enter your npm username:',
    required: true,
  }, {
    type: 'password',
    name: 'password',
    message: 'Enter your npm password:',
    required: true,
  }]);
  return { username, password };
}

async function promptForOneTimePassword() {
  let { oneTimePassword } = await inquirer.prompt([{
    type: 'input',
    name: 'oneTimePassword',
    message: 'Enter a 6-digit code from your authenticator device:',
    required: true,
    validate(value) {
      return value.length === 6;
    }
  }]);

  return oneTimePassword;
}

async function ensureLoggedInAndEscalated(page, username, password) {
  if (page.url().startsWith('https://www.npmjs.com/login')) {
    console.log('Logging into npm with credentials...');
    await page.type('#login_username', username);
    await page.type('#login_password', password);
    await submitForm(page, '#login button[type="submit"]');
  }

  if (page.url().startsWith('https://www.npmjs.com/login/otp')) {
    console.log('npm is requesting a one-time password');
    let oneTimePassword = await promptForOneTimePassword();
    await page.type('#login_otp', oneTimePassword);
    await submitForm(page, '#login button[type="submit"]');
  }

  let escalate = await page.$('#escalate');

  if (escalate) {
    await page.type('#escalate_escalated_password', password);
    await submitForm(page, '#escalate button[type="submit"]');
  }
}

async function update2faSettingsIfNecessary(page, accessUrl) {
  let checked = await page.$eval('#package-settings_require2FA', el => {
    return el.checked;
  });

  if (!checked) {
    await page.click('#package-settings_require2FA');
    let requestPromise = page.waitForRequest(accessUrl);
    await page.click('#package-settings button[type="submit"]');
    await requestPromise;
    console.log('updated');
  } else {
    console.log('already enabled');
  }
}

main().catch(err => {
  console.log(err);
});
