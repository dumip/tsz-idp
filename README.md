# tsz-idp

TheSafeZone Identity Provider - OAuth2/OIDC on AWS Cognito.

## Deploy

```bash
# Install
cd infra && npm install
cd ../login-ui && npm install
cd ../sample-client && npm install

# Bootstrap (first time only)
cd ../infra
cdk bootstrap

# Deploy
npm run deploy                # Creates Cognito, CloudFront
npm run build:sample-client   # Builds sample client with prod config
npm run deploy                # Uploads sample client to S3
```

With Google OAuth:
```bash
cdk deploy -c googleClientId=YOUR_ID -c googleClientSecret=YOUR_SECRET
```

## Outputs

After deploy, check `cdk-outputs.json` for:
- `SampleClientUrl` - Demo app URL
- `LoginUiUrl` - Device activation page
- `CognitoDomain` - OAuth2 endpoints
