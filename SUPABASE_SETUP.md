# Supabase Setup Instructions for Subbu Decorators

## Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: Subbu Decorators Inventory
   - **Database Password**: (create a strong password and save it)
   - **Region**: Choose closest to your location (e.g., Mumbai for India)
5. Click "Create new project" and wait for setup to complete

## Step 2: Get Your API Credentials

1. In your Supabase project dashboard, click on the **Settings** icon (gear icon)
2. Click on **API** in the left sidebar
3. You'll see:
   - **Project URL**: This is your `VITE_SUPABASE_URL`
   - **Project API keys** → **anon public**: This is your `VITE_SUPABASE_ANON_KEY`

## Step 3: Create Database Tables

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy the entire contents of `supabase-schema.sql` file from this project
4. Paste it into the SQL editor
5. Click **Run** or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
6. You should see "Success. No rows returned"

## Step 4: Configure Your Local Project

1. In the project root directory, create a new file called `.env`
2. Copy the contents from `.env.example`
3. Replace the placeholder values with your actual credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

**IMPORTANT**: Never commit the `.env` file to git (it's already in .gitignore)

## Step 5: Verify Setup

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Check the browser console for any Supabase errors

3. Try adding a new item - it should now save to Supabase!

4. Verify in Supabase:
   - Go to **Table Editor** in Supabase
   - Select the `items` table
   - You should see your data

## Database Tables Created

### 1. **items** - Inventory items
- `id`: Unique identifier
- `name`: Item name
- `total_quantity`: Total units owned
- `assigned_quantity`: Units currently out for functions
- `category`: Item category (Backdrops, Props, etc.)
- `price`: Item value/price
- `color`: Color or theme
- `size`: Dimensions
- `condition`: Item condition
- `location`: Storage location

### 2. **functions** - Function bookings
- `id`: Unique identifier
- `function_name`: Name/type of function
- `client_name`: Client name
- `client_phone`: Client phone
- `function_date`: Date of function
- `return_date`: Expected return date
- `actual_return_date`: Actual return date
- `venue`: Function venue
- `status`: 'Ongoing' or 'Completed'

### 3. **function_items** - Items used in each function
- `id`: Unique identifier
- `function_id`: Reference to function
- `item_id`: Reference to item
- `quantity`: Quantity used

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure you created the `.env` file in the project root
- Restart your development server after creating/updating `.env`

### Error: "relation does not exist"
- Make sure you ran the SQL schema in Step 3
- Check that all tables were created in Supabase Table Editor

### Data not saving
- Check browser console for errors
- Verify your API keys are correct
- Make sure RLS policies allow operations (see schema file)

## Optional: Enable Row Level Security (RLS)

If you want to add authentication and user-specific access:

1. Uncomment the RLS section in `supabase-schema.sql`
2. Set up authentication in Supabase
3. Modify the policies based on your needs

For now, the schema allows all operations without authentication.

## Helpful Supabase Features

- **Table Editor**: View and edit data directly
- **SQL Editor**: Run custom queries
- **Database** → **Backups**: Automatic daily backups
- **API Docs**: Auto-generated API documentation for your tables
