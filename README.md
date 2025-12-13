# tsz-idp

TheSafeZone Identity Provider - OAuth2/OIDC authentication system built on AWS Cognito.

## Prerequisites

- Node.js 18+
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`

## Build & Deploy

```bash
cd infra
npm install
npm run build
npm test

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy
cdk deploy

# With Google OAuth (optional)
cdk deploy -c googleClientId=YOUR_ID -c googleClientSecret=YOUR_SECRET
```

## Useful Commands

```bash
cdk diff      # Preview changes
cdk synth     # Generate CloudFormation template
cdk destroy   # Remove all resources
```
