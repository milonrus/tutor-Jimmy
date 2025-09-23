# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Grammar Tutor** application built with Next.js 15 and TypeScript that provides AI-powered grammar corrections. The app consists of a Next.js frontend and a grammar correction API that uses OpenAI's GPT models to analyze and correct text with detailed explanations.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server (runs on http://localhost:3000)
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code linting

### Environment Setup
- Copy `.env.local.example` to `.env.local` and add your OpenAI API key:
  ```
  OPENAI_API_KEY=your_openai_api_key_here
  ```

## Architecture

### Core Application Structure
- **Frontend**: Next.js 15 with React 19, using App Router (`src/app/`)
- **API**: Next.js API routes for OpenAI integration (`src/app/api/`)
- **Components**: Modular React components for UI (`src/components/`)
- **Configuration**: OpenAI model configurations and prompt management (`src/config/`, `src/prompts/`)

### Key Components
- `page.tsx` - Main application interface with text input and correction display
- `CorrectionDisplay.tsx` - Shows detailed correction results
- `SimpleCorrectionDisplay.tsx` - Simplified correction view
- `ErrorHighlight.tsx` - Highlights errors in original text with corrections
- `DebugDisplay.tsx` - Development debugging information

### API Architecture
- `api/correct-text/route.ts` - Main grammar correction endpoint
  - Accepts text input via POST
  - Uses OpenAI's chat completions API
  - Returns structured correction data with explanations
  - Includes comprehensive debug logging in development mode

### OpenAI Integration
- **Model Configuration**: Centralized in `src/config/openai-models.ts`
- **Current Model**: GPT-3.5-turbo (configurable via `DEFAULT_MODEL`)
- **Prompt System**: Grammar correction prompt stored in `src/prompts/grammar-correction.txt`
- **Response Format**: Structured JSON with corrections, explanations, and position indices

### Grammar Correction System
The application uses a sophisticated prompt system designed for English tutoring:
- Provides inline corrections with strikethrough and red highlighting
- Includes tooltip explanations for each correction
- Follows US English standards
- Generates Obsidian-compatible markup
- Focuses on practical learning with concise explanations

### Data Flow
1. User enters text in the main interface
2. Text is sent to `/api/correct-text` endpoint
3. API constructs prompt from `grammar-correction.txt` file
4. OpenAI processes the text and returns corrections
5. Response is parsed and position indices are calculated
6. Frontend displays original text with highlighted errors and corrections

### Debug System
In development mode:
- All API requests/responses are logged to `logs/` directory
- Debug information includes timestamps, prompts, and OpenAI usage data
- Debug info is displayed in the UI for troubleshooting

### Styling
- **Framework**: Tailwind CSS v4
- **Design**: Clean, modern interface with gradient backgrounds
- **Components**: Card-based layout with proper spacing and hover effects
- **Responsive**: Mobile-friendly design patterns

## Technical Notes

### Error Handling
- API includes fallback for non-JSON OpenAI responses
- Position index calculation for corrections that lack proper indices
- Comprehensive error logging and user-friendly error messages

### Performance Considerations
- OpenAI API calls are optimized with low temperature (0.1) for consistency
- Token limits set to 1000 to control costs
- Debug logging only enabled in development mode

### Model Switching
To change the OpenAI model:
1. Update `DEFAULT_MODEL` in `src/config/openai-models.ts`
2. Consider updating `max_tokens` and `temperature` in the API route if needed
3. Available models and their capabilities are documented in the config file

## Git Best Practices

### Commit Guidelines
- **Always run linting before committing**: `npm run lint`
- **Build and test before committing**: `npm run build` to ensure the application builds successfully
- **Use descriptive commit messages**: Follow conventional commit format when possible
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `style:` for formatting changes
  - `refactor:` for code refactoring
  - `test:` for adding tests

### Files to Never Commit
- **Environment files**: `.env.local` contains sensitive OpenAI API keys
- **Debug logs**: `logs/` directory contains development debug information
- **Build artifacts**: `.next/` directory (already in .gitignore)
- **Dependencies**: `node_modules/` (already in .gitignore)

### Branch Strategy
- **Main branch**: Keep stable, deployable code
- **Feature branches**: Create branches for new features or bug fixes
- **Naming convention**: Use descriptive names like `feature/model-selection` or `fix/correction-parsing`

### Pre-commit Checklist
1. Run `npm run lint` and fix any issues
2. Run `npm run build` to ensure production build works
3. Test the grammar correction functionality manually
4. Verify no sensitive information (API keys) is being committed
5. Check that debug logs are not included in the commit

### Deployment Considerations
- **Vercel Integration**: Project is configured for Vercel deployment
- **Environment Variables**: Ensure `OPENAI_API_KEY` is set in production environment
- **Build Verification**: Always test production builds before deploying

## Security Best Practices

### Environment Variables & API Keys
- **Never commit API keys**: Always use environment variables for sensitive data
- **Use different keys per environment**: Separate keys for development, staging, and production
- **Rotate keys regularly**: Especially after team member changes or suspected exposure
- **Principle of least privilege**: Use API keys with minimal required permissions

### Firebase Security (when applicable)
#### Database Security Rules
- **Default deny**: Start with restrictive rules and open up selectively
- **User authentication**: Always verify `auth != null` before allowing access
- **Data validation**: Validate data types, lengths, and formats in security rules
- **Rate limiting**: Implement request limits to prevent abuse
```javascript
// Example Firestore security rule
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if auth != null && auth.uid == userId;
    }
  }
}
```

#### Authentication Security
- **Email verification**: Require email verification for new accounts
- **Strong password policies**: Enforce minimum password requirements
- **Multi-factor authentication**: Enable MFA for sensitive operations
- **Session management**: Implement proper session timeouts and refresh tokens
- **Social auth validation**: Verify social login tokens server-side

#### Cloud Functions Security
- **Input validation**: Sanitize and validate all inputs
- **CORS configuration**: Restrict origins to authorized domains only
- **Authentication checks**: Verify user tokens in every function
- **Error handling**: Don't expose sensitive information in error messages

### API Security
#### Request Validation
- **Input sanitization**: Sanitize all user inputs to prevent injection attacks
- **Rate limiting**: Implement per-user and per-IP rate limits
- **Request size limits**: Limit payload sizes to prevent DoS attacks
- **Content-Type validation**: Validate request content types

#### Response Security
- **Sensitive data filtering**: Never expose internal IDs, tokens, or system information
- **Error message sanitization**: Generic error messages to prevent information leakage
- **HTTPS only**: Force HTTPS for all API communications
- **Security headers**: Implement proper CORS, CSP, and other security headers

### Vercel Deployment Security
#### Environment Variables
- **Vercel environment settings**: Use Vercel dashboard to manage environment variables
- **Environment separation**: Different variables for preview and production deployments
- **Secret management**: Use Vercel's encrypted environment variables for sensitive data
- **Build-time vs runtime**: Understand which variables are exposed to client-side code

#### Domain & Access Control
- **Custom domains**: Use custom domains instead of vercel.app subdomains for production
- **Access control**: Implement proper authentication before exposing admin features
- **Preview deployment protection**: Password-protect preview deployments if containing sensitive data
- **DDoS protection**: Leverage Vercel's built-in DDoS protection and monitoring

### Code Security Practices
#### Client-Side Security
- **No secrets in frontend**: Never include API keys or sensitive data in client-side code
- **XSS prevention**: Sanitize user inputs and use React's built-in XSS protection
- **CSP headers**: Implement Content Security Policy headers
- **Dependency auditing**: Regularly run `npm audit` and update dependencies

#### Server-Side Security
- **Input validation**: Validate and sanitize all inputs on the server side
- **SQL/NoSQL injection prevention**: Use parameterized queries and proper escaping
- **Authorization checks**: Verify user permissions for every protected operation
- **Logging without sensitive data**: Log security events but exclude sensitive information

### Third-Party API Integration
#### API Key Management
- **Separate service accounts**: Use different API keys for different services
- **Key rotation strategy**: Implement regular key rotation procedures
- **Monitoring and alerting**: Set up alerts for unusual API usage patterns
- **Backup authentication methods**: Have fallback authentication mechanisms

#### Data Handling
- **Data minimization**: Only request and store necessary data from third-party APIs
- **Encryption in transit**: Ensure all API communications use HTTPS/TLS
- **Encryption at rest**: Encrypt sensitive data stored in databases
- **Data retention policies**: Implement proper data cleanup and retention policies

### Monitoring & Incident Response
#### Security Monitoring
- **Error tracking**: Use tools like Sentry to monitor application errors
- **Performance monitoring**: Track unusual performance patterns that might indicate attacks
- **Access logging**: Log authentication attempts and access patterns
- **Automated alerts**: Set up alerts for suspicious activities

#### Incident Response
- **Security incident playbook**: Document steps for handling security incidents
- **Key rotation procedures**: Quick procedures for rotating compromised keys
- **Backup and recovery**: Regular backups and tested recovery procedures
- **Communication plan**: Clear communication channels for security incidents

### Regular Security Maintenance
- **Dependency updates**: Keep all dependencies updated to latest secure versions
- **Security scanning**: Regularly scan code for vulnerabilities
- **Penetration testing**: Periodic security testing of the application
- **Security reviews**: Code reviews with security focus for sensitive changes
- **Team security training**: Regular training on secure coding practices
- when you updated the code and a user needs to test the feature, launch the app and explain user how to see the changes