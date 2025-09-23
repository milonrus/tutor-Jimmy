# Firebase Setup Instructions

## Firestore Setup

### Security Rules

To secure your Firestore database, you need to configure the security rules in the Firebase Console:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`jimmytutor-6af38`)
3. Navigate to **Firestore Database** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with the content from `firestore.rules` file in this project

### Database Indexes

The application requires a composite index for the correction history query. This is normal for Firestore queries that combine filtering (`where`) with ordering (`orderBy`).

#### Required Index
- **Collection**: `corrections`
- **Fields**:
  - `userId` (Ascending)
  - `createdAt` (Descending)

#### How to Create the Index

**When you see the index error:**
1. **Use the Error Link**: The console error provides a direct link to create the index. Click that link for automatic setup.

2. **Manual Creation**:
   - Go to [Firebase Console](https://console.firebase.google.com/) → Your Project
   - Navigate to **Firestore Database** → **Indexes** tab
   - Click **Create Index**
   - Set the fields as specified above
   - Click **Create**

3. **Wait for Build**: Index creation takes 1-5 minutes. Wait for status to change from "Building" to "Enabled".

4. **Test**: Once enabled, the history feature will work without errors.

#### Why This Index is Needed
- Firestore requires composite indexes for queries combining `where` + `orderBy` on different fields
- This ensures optimal query performance
- Single-field indexes are automatic, but composite indexes must be explicitly created
- This is a one-time setup per query pattern

## Authentication Setup

1. In the Firebase Console, navigate to **Authentication**
2. Click on the **Sign-in method** tab
3. Enable the following authentication methods:

### Email/Password Authentication
- Click on **Email/Password** and toggle it to **Enabled**
- Optionally enable **Email link (passwordless sign-in)**

### Google Authentication
- Click on **Google** and toggle it to **Enabled**
- Select a **Project support email** from the dropdown
- Click **Save**

4. Optionally, you can configure additional settings like:
   - Email verification requirements
   - Password reset templates
   - Authorized domains (for production deployment)

## Database Structure

The application uses the following Firestore collection structure:

### `corrections` collection
Each document contains:
- `userId` (string) - The authenticated user's UID
- `originalText` (string) - The user's input text
- `correctedText` (string) - The AI-generated corrected text with markup
- `corrections` (array) - Array of correction objects with details
- `model` (string) - The AI model used for correction
- `reasoningEffort` (string, optional) - The reasoning effort level used
- `timestamp` (timestamp) - Server timestamp when correction was made
- `createdAt` (timestamp) - Server timestamp when document was created

## Security Features

- Users can only read and write their own correction data
- All database operations require authentication
- Server-side validation ensures proper data structure
- Rate limiting through Firebase's built-in protection

## Testing the Setup

1. Start the development server: `npm run dev`
2. Test authentication methods:
   - Try signing up with email/password
   - Try signing in with Google (click "Continue with Google")
   - Test logout functionality
3. Test grammar correction functionality with authenticated users
4. Check that corrections appear in the history
5. Verify that users can only see their own data

## Troubleshooting

### Google Authentication Issues
- **Popup blocked**: Ensure your browser allows popups for localhost
- **OAuth configuration**: Make sure Google auth is properly enabled in Firebase Console
- **Domain authorization**: For production, add your domain to authorized domains in Firebase Console

### Development vs Production
- **localhost**: Google auth works on localhost for development
- **Production**: Add your production domain to Firebase authorized domains
- **HTTPS required**: Google auth requires HTTPS in production environments