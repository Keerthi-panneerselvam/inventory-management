# Admin User Setup Guide

This guide explains how to create admin users for the Subbu Decorators Inventory Management System.

## Prerequisites

- Supabase project set up (already done)
- Access to your Supabase dashboard

## Steps to Create Admin Users

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project: `lyhizszwtblupotxjndn`

2. **Navigate to Authentication**
   - Click on "Authentication" in the left sidebar
   - Click on "Users" tab

3. **Add New User**
   - Click the "Add User" button
   - Choose "Create new user"
   - Enter the admin's email address
   - Enter a strong password (minimum 6 characters)
   - Click "Create User"

4. **Verify Email (Optional)**
   - If you want to skip email verification, you can manually confirm the user:
   - Click on the user you just created
   - Toggle "Email Confirmed" to ON

### Method 2: Using SQL (Advanced)

You can also create users via SQL in the Supabase SQL Editor:

```sql
-- This creates a user but requires email confirmation
-- Replace with actual admin email and password
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'admin@example.com',
  crypt('your-password-here', gen_salt('bf')),
  NOW()
);
```

## Recommended Admin Accounts

Create at least one admin account:

**Example:**
- Email: `admin@subbudecorators.com` (or any email you prefer)
- Password: `[Choose a strong password]`

## Security Best Practices

1. **Strong Passwords**: Use passwords with at least 12 characters including uppercase, lowercase, numbers, and symbols
2. **Limit Access**: Only create admin accounts for trusted personnel
3. **Regular Updates**: Change passwords regularly
4. **Monitor Access**: Use Supabase dashboard to monitor login activity

## Testing the Login

1. Start your application: `npm run dev`
2. Visit `http://localhost:5174`
3. You should see the login page
4. Enter the admin credentials you created
5. Click "Login"

## Troubleshooting

### "Invalid login credentials"
- Double-check the email and password
- Ensure the user's email is confirmed in Supabase dashboard
- Check if the user exists in Authentication > Users

### "Email not confirmed"
- Go to Supabase Dashboard > Authentication > Users
- Click on the user
- Toggle "Email Confirmed" to ON

### Can't access Supabase Dashboard
- Make sure you're logged in to the correct Supabase account
- Check that you have access to the project

## Removing Admin Access

To remove an admin user:

1. Go to Supabase Dashboard > Authentication > Users
2. Find the user
3. Click the three dots menu
4. Select "Delete user"

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Supabase credentials in `.env` file
3. Ensure Supabase project is active and not paused
