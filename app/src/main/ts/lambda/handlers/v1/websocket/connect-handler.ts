import { APIGatewayProxyHandler, APIGatewayProxyResultV2 } from 'aws-lambda';
import { dynamoDbDocument } from '../../../../dynamo/dynamo-db-document';
import { APIGatewayProxyWithLambdaAuthorizerEvent } from 'aws-lambda/trigger/api-gateway-proxy';

exports.handler = async (event: APIGatewayProxyWithLambdaAuthorizerEvent<{
    authorization_practice_pims: string;
    authorization_practice_organization_id: string;
    authorization_practice_organization_sub_id: string;
}>): Promise<APIGatewayProxyResultV2> => {
    try {
        const { authorization_practice_pims: pims,
            authorization_practice_organization_id: orgId,
            authorization_practice_organization_sub_id: orgSubId,
        } = event.requestContext.authorizer;

        const putParams = {
            TableName: process.env.CONNECTION_TABLE_NAME,
            Item: {
                connectionId: event.requestContext.connectionId,
                connectedAt: event.requestContext.connectedAt,
                practiceRowKey: `${pims}#${orgId}:${orgSubId}#`,
            }
        };

        await dynamoDbDocument.put(putParams);
    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    }

    return { statusCode: 200, body: 'Connected.' };
};
