import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { AttributeType, BillingMode, ProjectionType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Construct } from 'constructs';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { AccountRecovery, IUserPool, StringAttribute, UserPool } from 'aws-cdk-lib/aws-cognito';
import { WebSocketLambdaAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';

export class WebSocketApiStack extends Stack {
    public static LAMBDA_BASE_DIR = 'app/src/main/ts/lambda/handlers';

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const { authorizer: websocketConnectAuthorizer } = this.getUserPool();

        const websocketConnectionsTable = new Table(this, `${id}-web-socket-connections-table`, {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: { name: 'connectionId', type: AttributeType.STRING },
        });

        websocketConnectionsTable.addGlobalSecondaryIndex({
            indexName: 'practiceRowKey',
            partitionKey: {
                name: 'practiceRowKey',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'connectedAt',
                type: AttributeType.NUMBER,
            },
            projectionType: ProjectionType.ALL,
        });

        const connectHandler = new NodejsFunction(this, `${id}-web-socket-connections-lambda`, {
            entry: `${WebSocketApiStack.LAMBDA_BASE_DIR}/v1/websocket/connect-handler.ts`,
            description: `POE Sandbox Websocket API - COM-4080 - Connect Lambda`,
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: Runtime.NODEJS_18_X,
            environment: {
                CONNECTION_TABLE_NAME: websocketConnectionsTable.tableName,
            },
        });

        websocketConnectionsTable.grantReadWriteData(connectHandler);

        const disconnectHandler = new NodejsFunction(this, `${id}-web-socket-disconnections-lambda`, {
            entry: `${WebSocketApiStack.LAMBDA_BASE_DIR}/v1/websocket/disconnect-handler.ts`,
            description: `POE Sandbox Websocket API - COM-4080 - Disconnect Lambda`,
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: Runtime.NODEJS_18_X,
            environment: {
                CONNECTION_TABLE_NAME: websocketConnectionsTable.tableName,
            },
        });

        websocketConnectionsTable.grantReadWriteData(disconnectHandler);

        const webSocketApi = new WebSocketApi(this, `${id}-web-socket-api`, {
            apiName: `POE Sandbox Web Socket API - COM-4080`,
            connectRouteOptions: {
                integration: new WebSocketLambdaIntegration(`${id}-web-socket-connect-integration`, connectHandler),
                authorizer: websocketConnectAuthorizer,
            },
            disconnectRouteOptions: { integration: new WebSocketLambdaIntegration(`${id}-web-socket-disconnect-integration`, disconnectHandler) },

        });

        const stageName = 'dev';

        new WebSocketStage(this, 'DevStage', {
            webSocketApi,
            stageName,
            autoDeploy: true,
        });

        const messagesTable = new Table(this, `${id}-messages-table`, {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: { name: 'messageId', type: AttributeType.STRING },
            stream: StreamViewType.NEW_AND_OLD_IMAGES,
        });

        const messageStreamHandler = new NodejsFunction(this, `${id}-web-socket-message-stream-lambda`, {
            entry: `${WebSocketApiStack.LAMBDA_BASE_DIR}/v1/messages/stream-handler.ts`,
            description: `POE Sandbox Websocket API - COM-4080 - Messages Stream Lambda`,
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: Runtime.NODEJS_18_X,
            environment: {
                MESSAGES_TABLE_NAME: messagesTable.tableName,
                CONNECTION_TABLE_NAME: websocketConnectionsTable.tableName,
                API_ENDPOINT: `https://724bain2l6.execute-api.us-east-1.amazonaws.com/dev`,
            },
            timeout: Duration.minutes(1),
        });

        messageStreamHandler.addEventSource(
            new DynamoEventSource(messagesTable, {
                startingPosition: StartingPosition.TRIM_HORIZON,
                reportBatchItemFailures: true,
                retryAttempts: 3,
            })
        );

        messagesTable.grantStreamRead(messageStreamHandler);
        websocketConnectionsTable.grantReadData(messageStreamHandler);
        webSocketApi.grantManageConnections(messageStreamHandler);

        // sqs queue
        // lambda to consume sqs
            // broadcast message to communication by id
            // needs:
                // url
                // communication id
        // when new message: broadcast to consumers
            // new message -> stream -> get connections by practice id -> for each -> put message on queue -> send to connection
    }

    public getUserPool(): { userPool: IUserPool, authorizer: WebSocketLambdaAuthorizer } {
        const userPool = new UserPool(this, `com-4080-user-pool`, {
            standardAttributes: {
                email: { required: false, mutable: true },
            },
            customAttributes: {
                poeAuthorizations: new StringAttribute({ mutable: true }),
            },
            passwordPolicy: {
                requireDigits: false,
                requireUppercase: false,
                requireSymbols: false,
            },
            accountRecovery: AccountRecovery.NONE,
            selfSignUpEnabled: false,
            signInAliases: {
                email: false,
                phone: false,
                username: true,
                preferredUsername: false,
            },
            signInCaseSensitive: false,
            removalPolicy: RemovalPolicy.RETAIN,
        });

        const appClient = userPool.addClient(`com-4080-user-pool-client`, {
            userPoolClientName: 'com-4080-user-pool-client',
            accessTokenValidity: Duration.days(1),
            idTokenValidity: Duration.days(1),
            refreshTokenValidity: Duration.days(180),
            enableTokenRevocation: true,
            authFlows: {
                adminUserPassword: true,
            },
        });

        const authHandler = new NodejsFunction(this, `com-4080-lambda-authorizer`, {
            entry: `${WebSocketApiStack.LAMBDA_BASE_DIR}/v1/websocket/connect-authorize-handler.ts`,
            description: `POE Sandbox Websocket API - COM-4080 - Connect Stream Authorizer`,
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: Runtime.NODEJS_18_X,
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                APP_CLIENT_ID: appClient.userPoolClientId,
            },
        });

        const authorizer = new WebSocketLambdaAuthorizer(`com-4080-cognito-authorizer`, authHandler, {
            identitySource: [`route.request.querystring.idToken`],
        });

        return { userPool, authorizer };
    }
}
