# enable-npm-2fa

This is a script which will automate the process of updating all of your
packages to use npm's 2-Factor Authentication.

You must already have 2-Factor Authentication enabled on your account.

This script will blindly enable 2FA on every package you have access to. If you
want to do something different, I recommend you just edit the script.

- Clone this repo
- Run `yarn install`
- Run `node index.js`

The script will prompt you for your username, password, and a one time password.

Beware: This script is not tested very much, I did enable 2FA for a couple
hundred packages on my own account though.

I would give the script a read-through so you understand it.

PRs improving this script are welcome.
