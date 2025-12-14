import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TheSafeZoneIdpStack } from '../lib/thesafezone-idp-stack';

describe('TheSafeZoneIdpStack', () => {
  let app: cdk.App;
  let stack: TheSafeZoneIdpStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new TheSafeZoneIdpStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  test('Stack can be instantiated', () => {
    expect(stack).toBeDefined();
    expect(template.toJSON()).toBeDefined();
  });

  describe('Cognito User Pool', () => {
    test('User Pool is created with email sign-in', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: ['email'],
        AutoVerifiedAttributes: ['email'],
      });
    });

    test('User Pool has custom attributes for profile', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: Match.arrayWith([
          Match.objectLike({
            Name: 'displayName',
            AttributeDataType: 'String',
            Mutable: true,
          }),
          Match.objectLike({
            Name: 'firstName',
            AttributeDataType: 'String',
            Mutable: true,
          }),
          Match.objectLike({
            Name: 'lastName',
            AttributeDataType: 'String',
            Mutable: true,
          }),
          Match.objectLike({
            Name: 'interests',
            AttributeDataType: 'String',
            Mutable: true,
          }),
        ]),
      });
    });

    test('User Pool has secure password policy', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireLowercase: true,
            RequireUppercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
          },
        },
      });
    });

    test('User Pool has email-only account recovery', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            {
              Name: 'verified_email',
              Priority: 1,
            },
          ],
        },
      });
    });
  });

  describe('Google Federation', () => {
    test('Google Identity Provider is created when credentials provided', () => {
      // Create stack with Google credentials
      const appWithGoogle = new cdk.App({
        context: {
          googleClientId: 'test-google-client-id',
          googleClientSecret: 'test-google-client-secret',
        },
      });
      const stackWithGoogle = new TheSafeZoneIdpStack(appWithGoogle, 'TestStackWithGoogle');
      const templateWithGoogle = Template.fromStack(stackWithGoogle);

      templateWithGoogle.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderName: 'Google',
        ProviderType: 'Google',
        AttributeMapping: Match.objectLike({
          email: 'email',
          given_name: 'given_name',
          family_name: 'family_name',
        }),
      });
    });

    test('Google Identity Provider is not created without credentials', () => {
      // Default stack without Google credentials
      template.resourceCountIs('AWS::Cognito::UserPoolIdentityProvider', 0);
    });
  });

  describe('Cognito Identity Pool', () => {
    test('Identity Pool is created with unauthenticated access enabled', () => {
      template.hasResourceProperties('AWS::Cognito::IdentityPool', {
        IdentityPoolName: 'thesafezone-identity-pool',
        AllowUnauthenticatedIdentities: true,
      });
    });

    test('Unauthenticated IAM role is created', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        Description: 'Role for unauthenticated (anonymous) users',
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRoleWithWebIdentity',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com',
              },
            }),
          ]),
        }),
      });
    });

    test('Authenticated IAM role is created', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        Description: 'Role for authenticated users',
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRoleWithWebIdentity',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com',
              },
            }),
          ]),
        }),
      });
    });

    test('Identity Pool role attachment is configured', () => {
      template.hasResourceProperties('AWS::Cognito::IdentityPoolRoleAttachment', {
        Roles: Match.objectLike({
          unauthenticated: Match.anyValue(),
          authenticated: Match.anyValue(),
        }),
      });
    });

    test('Identity Pool is linked to User Pool clients', () => {
      template.hasResourceProperties('AWS::Cognito::IdentityPool', {
        CognitoIdentityProviders: Match.arrayWith([
          Match.objectLike({
            ClientId: Match.anyValue(),
            ProviderName: Match.anyValue(),
          }),
        ]),
      });
    });
  });

  describe('User Pool App Clients', () => {
    test('Web/Mobile client is created as public client (no secret)', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'thesafezone-web-mobile-client',
        GenerateSecret: false,
        ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
      });
    });

    test('VR client is created as public client (no secret)', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'thesafezone-vr-client',
        GenerateSecret: false,
        ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
      });
    });

    test('Clients have correct OAuth scopes', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        AllowedOAuthScopes: Match.arrayWith(['openid', 'email', 'profile']),
        AllowedOAuthFlows: ['code'], // Authorization Code flow
      });
    });

    test('Clients have correct token validity', () => {
      // CDK converts durations to minutes internally
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        AccessTokenValidity: 60, // 1 hour in minutes
        IdTokenValidity: 60, // 1 hour in minutes
        RefreshTokenValidity: 43200, // 30 days in minutes
        TokenValidityUnits: {
          AccessToken: 'minutes',
          IdToken: 'minutes',
          RefreshToken: 'minutes',
        },
      });
    });

    test('Three app clients are created (web/mobile, VR, sample)', () => {
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 3);
    });
  });

  describe('DynamoDB Device Code Table', () => {
    test('Device Code table is created with deviceCode as partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'thesafezone-device-codes',
        KeySchema: [
          {
            AttributeName: 'deviceCode',
            KeyType: 'HASH',
          },
        ],
      });
    });

    test('Device Code table has TTL enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
      });
    });

    test('Device Code table has GSI on userCode', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'userCode-index',
            KeySchema: [
              {
                AttributeName: 'userCode',
                KeyType: 'HASH',
              },
            ],
          }),
        ]),
      });
    });

    test('Device Code table uses on-demand billing', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
      });
    });
  });
});
