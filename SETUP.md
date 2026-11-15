# Publish On&iT POS: GitHub (files) + Supabase (data and logins) + Vercel (website)

Owner = everything. Staff = New order, Orders and customers only. Both phones see the same orders.

## A. GitHub
1. Make an account at github.com. New repository named onit-pos (Private is fine).
2. Click "uploading an existing file". Drag in every file from this folder (the files, not the zip). Commit changes.

## B. Supabase
1. supabase.com > Start your project > sign in with GitHub.
2. New project: name onit-pos, save the database password, Region = Southeast Asia (Singapore), Free plan. Wait about 2 minutes.
3. Authentication > Users > Add user > Create new user. Make two: the owner and the staff.
   Use real emails, strong passwords, and tick "Auto Confirm User".
4. Authentication > Sign In / Providers: turn off "Allow new users to sign up". Save.
5. Open supabase-setup.sql in Notepad. Replace OWNER_EMAIL and STAFF_EMAIL with the two emails (lowercase, keep the quotes).
   SQL Editor > New query > paste everything > Run. You should see "Success".
6. Project Settings > API Keys. Copy the Project URL and the publishable (anon) key.
   NEVER use the secret or service_role key in this app.

## C. Connect the app
On GitHub open app-config.js > pencil icon. Paste the URL, the key and the two emails. Commit changes.

## D. Vercel
1. vercel.com > Sign up > Continue with GitHub.
2. Add New > Project > Import your onit-pos repository.
3. Framework Preset: Other. Leave build settings empty. Deploy.
4. Open the address it gives you (like onit-pos.vercel.app). Every GitHub change redeploys it automatically.

## E. First use
1. Sign in as OWNER first. This uploads the starter services (or this device's old data) to Supabase.
2. Sign in as staff on the other phone.
3. Make a test order on each phone before real customers.

## Good to know
- Orders need internet (the app does not work offline in this version).
- Free Supabase projects pause after about a week with no activity. Using the app daily prevents it.
- Back up weekly: Manage > Backup.
- The two emails and the publishable key are visible to anyone who opens the site's files. That is normal.
  The database rules in supabase-setup.sql are what keep the data private.
- Vercel's free Hobby plan is meant for personal, non-commercial use. See the note in the chat guide.
