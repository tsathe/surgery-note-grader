# Surgery Note Grader

An AI-powered surgery note evaluation and grading system built with Next.js, Supabase, and TypeScript.

## Features

- **Magic Link Authentication**: Secure email-based authentication
- **Two-Pane Interface**: Surgery notes on the left, grading form on the right
- **Flexible Rubric System**: Configurable domains with detailed descriptions and examples
- **Admin Dashboard**: Manage surgery notes and rubric domains
- **CSV Export**: Download grading data for analysis
- **Real-time Updates**: Live data synchronization with Supabase

## Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- Supabase account and project

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd surgery-note-grader
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set up the database

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL commands from `supabase-schema.sql` to create the necessary tables and policies

### 5. Configure authentication

1. In your Supabase dashboard, go to Authentication > Settings
2. Configure your site URL (e.g., `http://localhost:3000` for development)
3. Add your domain to the allowed redirect URLs

### 6. Run the development server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

### For Graders

1. **Sign In**: Enter your email address to receive a magic link
2. **Select a Note**: Choose a surgery note from the left panel
3. **Grade Each Domain**: Use the rubric on the right to score each domain (1-5 points)
4. **View Details**: Click the info icon next to each domain to see detailed descriptions and examples
5. **Submit Grade**: Add optional feedback and submit your grade

### For Admins

1. **Access Admin Dashboard**: Sign in with an email containing "admin" (e.g., `admin@example.com`)
2. **Manage Surgery Notes**: Add, edit, or delete surgery notes
3. **Manage Rubric Domains**: Configure the grading rubric with custom domains
4. **Export Data**: Download all grading data as a CSV file

## Database Schema

### Tables

- **surgery_notes**: Stores surgery note content and metadata
- **rubric_domains**: Stores grading rubric domains and criteria
- **grades**: Stores individual grades and feedback

### Key Features

- **Row Level Security (RLS)**: Secure data access based on user roles
- **Automatic Timestamps**: Created and updated timestamps for all records
- **JSON Storage**: Flexible domain scores storage using JSONB
- **Foreign Key Relationships**: Proper referential integrity

## Development

### Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── admin/            # Admin interface components
│   ├── auth/             # Authentication components
│   └── grading/          # Grading interface components
└── lib/                  # Utility functions
    ├── auth.ts           # Authentication utilities
    ├── supabase.ts       # Supabase client
    ├── types.ts          # TypeScript types
    └── utils.ts          # General utilities
```

### Key Technologies

- **Next.js 15**: React framework with app router
- **Supabase**: Backend as a service (database, auth, real-time)
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hook Form**: Form handling
- **Zod**: Schema validation

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Yes |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
