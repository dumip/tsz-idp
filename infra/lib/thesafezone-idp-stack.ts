import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import * as fs from 'fs';
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
  public readonly sampleClient: cognito.UserPoolClient;
  public readonly arthurClient: cognito.UserPoolClient;
  public readonly deviceCodeTable: dynamodb.Table;
  public readonly deviceCodeLambda: lambdaNodejs.NodejsFunction;
  public readonly deviceCodeApi: apigateway.RestApi;
  public readonly loginUiBucket: s3.Bucket;
  public readonly loginUiDistribution: cloudfront.Distribution;
  public readonly sampleClientBucket: s3.Bucket;
  public readonly sampleClientDistribution: cloudfront.Distribution;

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
    // Includes /activate for device flow and /profile/callback for profile management
    const webCallbackUrls = this.node.tryGetContext('webCallbackUrls') || [
      'http://localhost:3000/oauth2/callback',
      'http://localhost:3000/activate',
      'http://localhost:3000/profile/callback',
      'http://localhost:5173/activate',
      'http://localhost:5173/profile/callback',
    ];
    const webLogoutUrls = this.node.tryGetContext('webLogoutUrls') || [
      'http://localhost:3000',
      'http://localhost:3000/logout',
      'http://localhost:5173',
    ];
    const vrCallbackUrls = this.node.tryGetContext('vrCallbackUrls') || ['thesafezone://oauth2/callback'];
    const vrLogoutUrls = this.node.tryGetContext('vrLogoutUrls') || ['thesafezone://logout'];
    const sampleClientCallbackUrls = this.node.tryGetContext('sampleClientCallbackUrls') || [
      'http://localhost:3001/callback',
      'http://localhost:5174/callback',
    ];
    const sampleClientLogoutUrls = this.node.tryGetContext('sampleClientLogoutUrls') || [
      'http://localhost:3001',
      'http://localhost:5174',
    ];
    const arthurClientCallbackUrls = this.node.tryGetContext('arthurClientCallbackUrls') || [
      'http://localhost:3001/callback',
      'http://localhost:5174/callback',
    ];
    const arthurClientLogoutUrls = this.node.tryGetContext('arthurClientLogoutUrls') || [
      'http://localhost:3001',
      'http://localhost:5174',
    ];

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
          cognito.OAuthScope.COGNITO_ADMIN, // Required for UpdateUserAttributes API
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

    // Create public client for Sample Client demo app (PKCE required, no secret)
    // This demonstrates a third-party client integrating with TheSafeZone IDP
    this.sampleClient = this.userPool.addClient('SampleClient', {
      userPoolClientName: 'thesafezone-sample-client',
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
        callbackUrls: sampleClientCallbackUrls,
        logoutUrls: sampleClientLogoutUrls,
      },
      // Token validity (Requirement 11.1)
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      enableTokenRevocation: true,
    });

    // Create public client for Arthur (Vercel-hosted app, PKCE required, no secret)
    // This is a third-party client hosted on Vercel integrating with TheSafeZone IDP
    this.arthurClient = this.userPool.addClient('ArthurClient', {
      userPoolClientName: 'thesafezone-arthur',
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
        callbackUrls: arthurClientCallbackUrls,
        logoutUrls: arthurClientLogoutUrls,
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
        {
          clientId: this.sampleClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
        {
          clientId: this.arthurClient.userPoolClientId,
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

    // Add Cognito domain for OAuth2 endpoints
    // This creates the /oauth2/authorize, /oauth2/token endpoints
    const domainPrefix = this.node.tryGetContext('cognitoDomainPrefix') || 'thesafezone-auth';
    const userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: domainPrefix,
      },
      // Use Managed Login instead of classic Hosted UI
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    // Configure Managed Login branding with TheSafeZone styling
    // Requirements: 12.1, 12.3
    // Uses CfnManagedLoginBranding for the new Managed Login experience
    const managedLoginSettings = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'cognito-ui/managed-login-settings.json'),
        'utf-8'
      )
    );

    // Read logo as base64
    const logoBase64 = fs.readFileSync(
      path.join(__dirname, 'cognito-ui/logo.png')
    ).toString('base64');

    // Apply branding to the web/mobile client
    // Valid category values: FAVICON_ICO, FAVICON_SVG, EMAIL_GRAPHIC, SMS_GRAPHIC,
    // AUTH_APP_GRAPHIC, PASSWORD_GRAPHIC, PASSKEY_GRAPHIC, PAGE_HEADER_LOGO,
    // PAGE_HEADER_BACKGROUND, PAGE_FOOTER_LOGO, PAGE_FOOTER_BACKGROUND,
    // PAGE_BACKGROUND, FORM_BACKGROUND, FORM_LOGO, IDP_BUTTON_ICON
    // Note: FAVICON_ICO requires .ico format with 1:1 aspect ratio
    new cognito.CfnManagedLoginBranding(this, 'ManagedLoginBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.webMobileClient.userPoolClientId,
      settings: managedLoginSettings,
      assets: [
        {
          category: 'FORM_LOGO',
          colorMode: 'LIGHT',
          extension: 'PNG',
          bytes: logoBase64,
        },
        {
          category: 'FORM_LOGO',
          colorMode: 'DARK',
          extension: 'PNG',
          bytes: logoBase64,
        },
      ],
    });

    // Apply same branding to sample client
    new cognito.CfnManagedLoginBranding(this, 'SampleClientBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.sampleClient.userPoolClientId,
      settings: managedLoginSettings,
      assets: [
        {
          category: 'FORM_LOGO',
          colorMode: 'LIGHT',
          extension: 'PNG',
          bytes: logoBase64,
        },
        {
          category: 'FORM_LOGO',
          colorMode: 'DARK',
          extension: 'PNG',
          bytes: logoBase64,
        },
      ],
    });

    // Apply same branding to Arthur client
    new cognito.CfnManagedLoginBranding(this, 'ArthurClientBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.arthurClient.userPoolClientId,
      settings: managedLoginSettings,
      assets: [
        {
          category: 'FORM_LOGO',
          colorMode: 'LIGHT',
          extension: 'PNG',
          bytes: logoBase64,
        },
        {
          category: 'FORM_LOGO',
          colorMode: 'DARK',
          extension: 'PNG',
          bytes: logoBase64,
        },
      ],
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

    new cdk.CfnOutput(this, 'SampleClientId', {
      value: this.sampleClient.userPoolClientId,
      description: 'Sample Client App Client ID (for testing OIDC flow)',
    });

    new cdk.CfnOutput(this, 'ArthurClientId', {
      value: this.arthurClient.userPoolClientId,
      description: 'Arthur Client App Client ID (Vercel-hosted app)',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: userPoolDomain.domainName,
      description: 'Cognito Domain (use for VITE_COGNITO_DOMAIN)',
    });

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Full Cognito Domain URL for OAuth2 endpoints',
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

    // Get verification URI from context or use default
    const verificationUri = this.node.tryGetContext('verificationUri') || 'https://thesafezone.eu/activate';

    // Create Device Code Lambda function (Requirements: 9.1, 9.2, 9.3, 9.4, 9.5)
    // Using NodejsFunction to automatically bundle and transpile TypeScript
    this.deviceCodeLambda = new lambdaNodejs.NodejsFunction(this, 'DeviceCodeLambda', {
      functionName: 'thesafezone-device-code',
      entry: path.join(__dirname, 'lambda/device-code/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        DEVICE_CODE_TABLE_NAME: this.deviceCodeTable.tableName,
        VERIFICATION_URI: verificationUri,
        USER_POOL_ID: this.userPool.userPoolId,
        USER_POOL_CLIENT_ID: this.vrClient.userPoolClientId,
      },
    });

    // Grant Lambda permissions to access DynamoDB
    this.deviceCodeTable.grantReadWriteData(this.deviceCodeLambda);

    // Create API Gateway for Device Code endpoints
    this.deviceCodeApi = new apigateway.RestApi(this, 'DeviceCodeApi', {
      restApiName: 'TheSafeZone Device Code API',
      description: 'API for Device Code Flow (RFC 8628)',
      deployOptions: {
        stageName: 'v1',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Create /device resource
    const deviceResource = this.deviceCodeApi.root.addResource('device');

    // Create Lambda integration
    const deviceCodeIntegration = new apigateway.LambdaIntegration(this.deviceCodeLambda);

    // POST /device/code - Generate device code
    const codeResource = deviceResource.addResource('code');
    codeResource.addMethod('POST', deviceCodeIntegration);

    // POST /device/token - Poll for tokens
    const tokenResource = deviceResource.addResource('token');
    tokenResource.addMethod('POST', deviceCodeIntegration);

    // POST /device/authorize - User authorizes device
    const authorizeResource = deviceResource.addResource('authorize');
    authorizeResource.addMethod('POST', deviceCodeIntegration);

    new cdk.CfnOutput(this, 'DeviceCodeApiUrl', {
      value: this.deviceCodeApi.url,
      description: 'Device Code API URL',
    });

    new cdk.CfnOutput(this, 'DeviceCodeLambdaArn', {
      value: this.deviceCodeLambda.functionArn,
      description: 'Device Code Lambda ARN',
    });

    // Create S3 bucket for Login UI static hosting (Requirement 9.3)
    this.loginUiBucket = new s3.Bucket(this, 'LoginUiBucket', {
      bucketName: `thesafezone-login-ui-${this.account}-${this.region}`,
      // Block all public access - CloudFront will access via OAC
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Enable versioning for rollback capability
      versioned: true,
      // Removal policy for development (change to RETAIN for production)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // Enable encryption
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Create CloudFront distribution for Login UI
    this.loginUiDistribution = new cloudfront.Distribution(this, 'LoginUiDistribution', {
      comment: 'TheSafeZone Login UI - Device Activation Page',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.loginUiBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // SPA routing - return index.html for all 404s
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      defaultRootObject: 'index.html',
      // Enable HTTP/2 and HTTP/3 for better performance
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Price class - use all edge locations for global coverage
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Deploy Login UI static files to S3 (if dist folder exists)
    const loginUiDistPath = path.join(__dirname, '../../login-ui/dist');
    if (fs.existsSync(loginUiDistPath)) {
      new s3deploy.BucketDeployment(this, 'LoginUiDeployment', {
        sources: [s3deploy.Source.asset(loginUiDistPath)],
        destinationBucket: this.loginUiBucket,
        distribution: this.loginUiDistribution,
        distributionPaths: ['/*'],
      });
    }

    new cdk.CfnOutput(this, 'LoginUiBucketName', {
      value: this.loginUiBucket.bucketName,
      description: 'S3 bucket name for Login UI',
    });

    new cdk.CfnOutput(this, 'LoginUiDistributionId', {
      value: this.loginUiDistribution.distributionId,
      description: 'CloudFront distribution ID for Login UI',
    });

    new cdk.CfnOutput(this, 'LoginUiUrl', {
      value: `https://${this.loginUiDistribution.distributionDomainName}`,
      description: 'Login UI URL (CloudFront)',
    });

    new cdk.CfnOutput(this, 'ActivatePageUrl', {
      value: `https://${this.loginUiDistribution.distributionDomainName}/activate`,
      description: 'Device Activation Page URL',
    });

    // ============================================================
    // Sample Client Deployment (Requirement 15.1, 15.2, 15.3, 15.4)
    // ============================================================

    // Create S3 bucket for Sample Client static hosting
    this.sampleClientBucket = new s3.Bucket(this, 'SampleClientBucket', {
      bucketName: `thesafezone-sample-client-${this.account}-${this.region}`,
      // Block all public access - CloudFront will access via OAC
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Enable versioning for rollback capability
      versioned: true,
      // Removal policy for development (change to RETAIN for production)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // Enable encryption
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Create CloudFront distribution for Sample Client
    this.sampleClientDistribution = new cloudfront.Distribution(this, 'SampleClientDistribution', {
      comment: 'TheSafeZone Sample Client - OIDC Demo Application',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.sampleClientBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // SPA routing - return index.html for all 404s
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      defaultRootObject: 'index.html',
      // Enable HTTP/2 and HTTP/3 for better performance
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Price class - use all edge locations for global coverage
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Deploy Sample Client static files to S3 (if dist folder exists)
    const sampleClientDistPath = path.join(__dirname, '../../sample-client/dist');
    if (fs.existsSync(sampleClientDistPath)) {
      new s3deploy.BucketDeployment(this, 'SampleClientDeployment', {
        sources: [s3deploy.Source.asset(sampleClientDistPath)],
        destinationBucket: this.sampleClientBucket,
        distribution: this.sampleClientDistribution,
        distributionPaths: ['/*'],
      });
    }

    new cdk.CfnOutput(this, 'SampleClientBucketName', {
      value: this.sampleClientBucket.bucketName,
      description: 'S3 bucket name for Sample Client',
    });

    new cdk.CfnOutput(this, 'SampleClientDistributionId', {
      value: this.sampleClientDistribution.distributionId,
      description: 'CloudFront distribution ID for Sample Client',
    });

    new cdk.CfnOutput(this, 'SampleClientUrl', {
      value: `https://${this.sampleClientDistribution.distributionDomainName}`,
      description: 'Sample Client URL (CloudFront) - Use this to test OIDC flow',
    });

    // ============================================================
    // Update Sample Client callback URLs with CloudFront domain
    // (Requirement 15.3 - redirect mismatch fix)
    // ============================================================
    
    // Get the underlying CfnUserPoolClient to update callback URLs
    const cfnSampleClient = this.sampleClient.node.defaultChild as cognito.CfnUserPoolClient;
    
    // Add CloudFront URLs to the callback and logout URLs
    // This includes both localhost (for dev) and CloudFront (for prod)
    cfnSampleClient.callbackUrLs = [
      'http://localhost:3001/callback',
      'http://localhost:5174/callback',
      `https://${this.sampleClientDistribution.distributionDomainName}/callback`,
    ];
    cfnSampleClient.logoutUrLs = [
      'http://localhost:3001',
      'http://localhost:5174',
      `https://${this.sampleClientDistribution.distributionDomainName}`,
    ];

    // Update WebMobileClient (login-ui) callback URLs with CloudFront domain
    const cfnWebMobileClient = this.webMobileClient.node.defaultChild as cognito.CfnUserPoolClient;
    cfnWebMobileClient.callbackUrLs = [
      'http://localhost:3000/oauth2/callback',
      'http://localhost:3000/activate',
      'http://localhost:3000/profile/callback',
      'http://localhost:5173/activate',
      'http://localhost:5173/profile/callback',
      `https://${this.loginUiDistribution.distributionDomainName}/activate`,
      `https://${this.loginUiDistribution.distributionDomainName}/profile/callback`,
    ];
    cfnWebMobileClient.logoutUrLs = [
      'http://localhost:3000',
      'http://localhost:3000/logout',
      'http://localhost:5173',
      `https://${this.loginUiDistribution.distributionDomainName}`,
    ];
  }
}
