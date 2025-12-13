#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TheSafeZoneIdpStack } from '../lib/thesafezone-idp-stack';

const app = new cdk.App();

new TheSafeZoneIdpStack(app, 'TheSafeZoneIdpStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'TheSafeZone Identity Provider - OAuth2/OIDC compliant authentication system',
});
