import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Main CDK Stack for TheSafeZone Identity Provider
 * 
 * This stack will contain:
 * - Cognito User Pool with custom attributes and security settings
 * - Cognito Identity Pool for anonymous authentication
 * - User Pool App Clients for web, mobile, and VR
 * - DynamoDB table for Device Code storage
 * - API Gateway and Lambda for Device Code flow
 */
export class TheSafeZoneIdpStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly unauthenticatedRole: iam.Role;
  public readonly authenticatedRole: iam.Role;
  public readonly webMobileClient: cognito.UserPoolClient;
  public readonly vrClient: cognito.UserPoolClient;
  public readonly deviceCodeTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool with email/password authentication
    // Requirements: 2.1, 6.1, 11.1, 13.1
    this.userPool = new cognito.UserPool(this, 'TheSafeZoneUserPool', {
      userPoolName: 'thesafezone-user-pool',
      
      // Email as primary sign-in method
      signInAliases: {
        email: true,
        username: false,
      },
      
      // Self sign-up enabled
      selfSignUpEnabled: true,
      
      // Email verification required (Requirement 2.1)
      autoVerify: {
        email: true,
      },
      
      // Standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      
      // Custom attributes for user profile (Requirement 6.1)
      customAttributes: {
        displayName: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 256,
          mutable: true,
        }),
        firstName: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 256,
          mutable: true,
        }),
        lastName: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 256,
          mutable: true,
        }),
        interests: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 2048,
          mutable: true,
        }),
      },
      
      // Password policy (secure defaults)
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      
      // Account recovery via email (Requirement 2.4)
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      // User verification
      userVerification: {
        emailSubject: 'Verify your TheSafeZone account',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      
      // Removal policy for development (change to RETAIN for production)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Configure Google Identity Provider (Requirement 3.1, 3.2)
    // Google OAuth credentials should be provided via context or environment
    const googleClientId = this.node.tryGetContext('googleClientId') || process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = this.node.tryGetContext('googleClientSecret') || process.env.GOOGLE_CLIENT_SECRET;

    if (googleClientId && googleClientSecret) {
      new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
        userPool: this.userPool,
        clientId: googleClientId,
        clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret),
        scopes: ['profile', 'email', 'openid'],
        // Attribute mapping from Google claims to Cognito attributes
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      });
    }

    // Get callback URLs from context or use defaults
    const webCallbackUrls = this.node.tryGetContext('webCallbackUrls') || ['http://localhost:3000/oauth2/callback'];
    const webLogoutUrls = this.node.tryGetContext('webLogoutUrls') || ['http://localhost:3000/logout'];
    const vrCallbackUrls = this.node.tryGetContext('vrCallbackUrls') || ['thesafezone://oauth2/callback'];
    const vrLogoutUrls = this.node.tryGetContext('vrLogoutUrls') || ['thesafezone://logout'];

    // Create public client for web/mobile (PKCE required, no secret)
    // Requirements: 10.1, 10.2, 10.3, 10.4
    this.webMobileClient = this.userPool.addClient('WebMobileClient', {
      userPoolClientName: 'thesafezone-web-mobile-client',
      generateSecret: false, // Public client - no secret
      authFlows: {
        userSrp: true, // Secure Remote Password for email/password
        userPassword: false, // Disable plain password auth
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true, // Authorization Code flow with PKCE
          implicitCodeGrant: false, // Disable implicit flow (less secure)
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: webCallbackUrls,
        logoutUrls: webLogoutUrls,
      },
      // Token validity (Requirement 11.1)
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      // Prevent token revocation issues
      enableTokenRevocation: true,
    });

    // Create public client for VR (Device Code flow)
    // Requirements: 10.1, 10.2, 10.3, 10.4
    this.vrClient = this.userPool.addClient('VRClient', {
      userPoolClientName: 'thesafezone-vr-client',
      generateSecret: false, // Public client - no secret
      authFlows: {
        userSrp: true,
        userPassword: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: vrCallbackUrls,
        logoutUrls: vrLogoutUrls,
      },
      // Token validity (Requirement 11.1)
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      enableTokenRevocation: true,
    });

    // Create Cognito Identity Pool for anonymous authentication (Requirement 4.1, 4.2)
    this.identityPool = new cognito.CfnIdentityPool(this, 'TheSafeZoneIdentityPool', {
      identityPoolName: 'thesafezone-identity-pool',
      allowUnauthenticatedIdentities: true, // Enable anonymous access
      // Link to User Pool for authenticated identities
      cognitoIdentityProviders: [
        {
          clientId: this.webMobileClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
        {
          clientId: this.vrClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    // Create IAM role for unauthenticated (anonymous) users
    this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for unauthenticated (anonymous) users',
    });

    // Create IAM role for authenticated users
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for authenticated users',
    });

    // Attach role mappings to Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        unauthenticated: this.unauthenticatedRole.roleArn,
        authenticated: this.authenticatedRole.roleArn,
      },
    });

    // Output the User Pool ID and ARN
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'WebMobileClientId', {
      value: this.webMobileClient.userPoolClientId,
      description: 'Web/Mobile App Client ID',
    });

    new cdk.CfnOutput(this, 'VRClientId', {
      value: this.vrClient.userPoolClientId,
      description: 'VR App Client ID',
    });

    // Create DynamoDB table for Device Code storage (Requirement 9.1, 9.2)
    this.deviceCodeTable = new dynamodb.Table(this, 'DeviceCodeTable', {
      tableName: 'thesafezone-device-codes',
      partitionKey: {
        name: 'deviceCode',
        type: dynamodb.AttributeType.STRING,
      },
      // Enable TTL for automatic expiration of device codes
      timeToLiveAttribute: 'ttl',
      // Billing mode - on-demand for variable traffic
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // Removal policy for development (change to RETAIN for production)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI on userCode for lookup by user code
    this.deviceCodeTable.addGlobalSecondaryIndex({
      indexName: 'userCode-index',
      partitionKey: {
        name: 'userCode',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'DeviceCodeTableName', {
      value: this.deviceCodeTable.tableName,
      description: 'DynamoDB table name for Device Codes',
    });

    new cdk.CfnOutput(this, 'DeviceCodeTableArn', {
      value: this.deviceCodeTable.tableArn,
      description: 'DynamoDB table ARN for Device Codes',
    });
  }
}
