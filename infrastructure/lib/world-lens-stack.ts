import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

interface WorldLensStackProps extends cdk.StackProps {
  bedrockRegion: string;
}

export class WorldLensStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WorldLensStackProps) {
    super(scope, id, props);

    // ─── DynamoDB Tables ──────────────────────────────────────────────

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'WorldLensSessions',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'WorldLensConnections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── Shared Lambda Environment ────────────────────────────────────

    const bedrockRegion = props.bedrockRegion;
    const sonicModelArn = `arn:aws:bedrock:${bedrockRegion}::foundation-model/amazon.nova-2-sonic-v1:0`;
    const liteModelArn = `arn:aws:bedrock:${bedrockRegion}::foundation-model/amazon.nova-2-lite-v1:0`;
    const inferenceProfileArn = `arn:aws:bedrock:${bedrockRegion}:${this.account}:inference-profile/*`;

    const lambdaEnvironment: Record<string, string> = {
      SESSIONS_TABLE: sessionsTable.tableName,
      CONNECTIONS_TABLE: connectionsTable.tableName,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    };

    // ─── Bedrock IAM Policy ───────────────────────────────────────────

    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:InvokeModelWithBidirectionalStream',
      ],
      resources: [
        sonicModelArn,
        liteModelArn,
        inferenceProfileArn,
      ],
    });

    // ─── Cognito Identity Pool (Browser Credentials) ──────────────────

    const identityPool = new cognito.CfnIdentityPool(this, 'WorldLensIdentityPool', {
      identityPoolName: 'worldlens-identity-pool',
      allowUnauthenticatedIdentities: true,
    });

    const unauthRole = new iam.Role(this, 'WorldLensUnauthRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    const authRole = new iam.Role(this, 'WorldLensAuthRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    unauthRole.addToPolicy(bedrockPolicy);
    authRole.addToPolicy(bedrockPolicy);

    new cognito.CfnIdentityPoolRoleAttachment(this, 'WorldLensIdentityPoolRoles', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authRole.roleArn,
        unauthenticated: unauthRole.roleArn,
      },
    });

    // ─── Lambda Functions ─────────────────────────────────────────────

    const connectHandler = new nodejs.NodejsFunction(this, 'WsConnectHandler', {
      functionName: 'worldlens-ws-connect',
      entry: path.join(__dirname, '../lambda/ws-connect.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: lambdaEnvironment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        forceDockerBundling: false,
        minify: true,
        sourceMap: true,
        target: 'node22',
      },
    });

    const disconnectHandler = new nodejs.NodejsFunction(this, 'WsDisconnectHandler', {
      functionName: 'worldlens-ws-disconnect',
      entry: path.join(__dirname, '../lambda/ws-disconnect.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: lambdaEnvironment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        forceDockerBundling: false,
        minify: true,
        sourceMap: true,
        target: 'node22',
      },
    });

    const messageHandler = new nodejs.NodejsFunction(this, 'WsMessageHandler', {
      functionName: 'worldlens-ws-message',
      entry: path.join(__dirname, '../lambda/ws-message.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: lambdaEnvironment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        forceDockerBundling: false,
        minify: true,
        sourceMap: true,
        target: 'node22',
      },
    });

    // Grant DynamoDB permissions
    sessionsTable.grantReadWriteData(connectHandler);
    sessionsTable.grantReadWriteData(disconnectHandler);
    sessionsTable.grantReadWriteData(messageHandler);
    connectionsTable.grantReadWriteData(connectHandler);
    connectionsTable.grantReadWriteData(disconnectHandler);
    connectionsTable.grantReadWriteData(messageHandler);

    // Grant Bedrock permissions
    messageHandler.addToRolePolicy(bedrockPolicy);

    // ─── WebSocket API ────────────────────────────────────────────────

    const webSocketApi = new apigwv2.WebSocketApi(this, 'WorldLensWebSocketApi', {
      apiName: 'WorldLensVoice',
      description: 'WorldLens real-time voice pipeline via Nova Sonic',
      connectRouteOptions: {
        integration: new apigwv2Integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          connectHandler
        ),
      },
      disconnectRouteOptions: {
        integration: new apigwv2Integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          disconnectHandler
        ),
      },
      defaultRouteOptions: {
        integration: new apigwv2Integrations.WebSocketLambdaIntegration(
          'DefaultIntegration',
          messageHandler
        ),
      },
    });

    const stage = new apigwv2.WebSocketStage(this, 'ProdStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    // Grant API Gateway management permissions to message handler
    // (so it can send messages back to connected clients)
    messageHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/${stage.stageName}/*`,
        ],
      })
    );

    // Store the callback URL in the message handler environment
    messageHandler.addEnvironment(
      'WEBSOCKET_CALLBACK_URL',
      `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`
    );

    // ─── Local Dev User ────────────────────────────────────────────────
    // Automated Zero-Touch configuration for local development
    
    const devUser = new iam.User(this, 'LocalDevUser', {
      userName: 'worldlens-dev-user',
    });

    devUser.addToPrincipalPolicy(bedrockPolicy);
    sessionsTable.grantReadWriteData(devUser);
    connectionsTable.grantReadWriteData(devUser);

    const accessKey = new iam.CfnAccessKey(this, 'LocalDevAccessKey', {
      userName: devUser.userName,
    });

    // ─── Outputs ──────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: stage.url,
      description: 'WebSocket API URL for the voice pipeline',
      exportName: 'WorldLensWebSocketUrl',
    });

    new cdk.CfnOutput(this, 'WebSocketCallbackUrl', {
      value: `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`,
      description: 'Callback URL for sending messages to connected clients',
    });

    new cdk.CfnOutput(this, 'SessionsTableName', {
      value: sessionsTable.tableName,
      description: 'DynamoDB sessions table name',
    });

    new cdk.CfnOutput(this, 'CognitoIdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID for browser auth',
      exportName: 'WorldLensIdentityPoolId',
    });

    new cdk.CfnOutput(this, 'BedrockRegion', {
      value: bedrockRegion,
      description: 'Bedrock region for Nova Sonic',
      exportName: 'WorldLensBedrockRegion',
    });

    new cdk.CfnOutput(this, 'DevUserAccessKeyId', {
      value: accessKey.ref,
      description: 'Access Key ID for local development',
    });

    new cdk.CfnOutput(this, 'DevUserSecretAccessKey', {
      value: accessKey.attrSecretAccessKey,
      description: 'Secret Access Key for local development',
    });
  }
}
